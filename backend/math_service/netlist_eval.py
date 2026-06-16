"""Digital netlist evaluator — DETERMINISTIC, no LLM calls.

Everything here is derived from the *actual* circuit drawn on the canvas
(nodes + edges), not from keywords or templates:
  - truth table   : evaluate every OUTPUT for all 2^n INPUT combinations
  - minimized SOP : Quine-McCluskey on the computed minterms
  - timing diagram : input/output waveforms over the input sweep
  - Verilog        : structural gate-level module from the wiring
  - BOM            : component rollup from the placed parts
  - suggestions    : structural problems found by walking the graph

This is the single source of truth for digital analysis; the LangGraph
hdl_compiler node imports `netlist_to_verilog` from here too.
"""
from itertools import product
from functools import reduce

from pydantic import BaseModel

from .kmap_minimize import KmapRequest, minimize_kmap
from .bom import BomRequest, compute_bom

_GATES = {"AND", "OR", "NOT", "NAND", "NOR", "XOR", "XNOR"}


class NetlistRequest(BaseModel):
    nodes: list[dict]
    edges: list[dict]


def _inputs_of(node_id: str, edges: list[dict]) -> list[str]:
    """Source node ids feeding node_id, ordered by target handle then edge order."""
    incoming = [e for e in edges if e.get("target") == node_id and e.get("source")]
    incoming.sort(key=lambda e: str(e.get("targetHandle") or ""))
    return [e["source"] for e in incoming]


def _apply_gate(gate: str, vals: list[bool]) -> bool:
    if not vals:
        return False
    if gate == "AND":
        return all(vals)
    if gate == "OR":
        return any(vals)
    if gate == "NOT":
        return not vals[0]
    if gate == "NAND":
        return not all(vals)
    if gate == "NOR":
        return not any(vals)
    if gate == "XOR":
        return reduce(lambda a, b: a ^ b, vals)
    if gate == "XNOR":
        return not reduce(lambda a, b: a ^ b, vals)
    # OUTPUT / buffer / unknown → pass through first input
    return vals[0]


def _input_edges(node_id: str, edges: list[dict]) -> list[tuple[str, str | None]]:
    """(source_id, source_handle) pairs feeding node_id, ordered by target handle."""
    incoming = [e for e in edges if e.get("target") == node_id and e.get("source")]
    incoming.sort(key=lambda e: str(e.get("targetHandle") or ""))
    return [(e["source"], e.get("sourceHandle")) for e in incoming]


def _eval_pin(node_id, handle, nodes, edges, assignment, memo, visiting) -> bool:
    """Evaluate whatever drives a specific input handle of node_id."""
    s, sh = _driver(node_id, handle, edges)
    if s is None:
        return False
    return _eval_out(s, sh, nodes, edges, assignment, memo, visiting)


def _eval_mux(node_id, data, nodes, edges, assignment, memo, visiting) -> bool:
    """MUX output = the data input selected by the binary select lines (s0 = LSB)."""
    sel_pins = data.get("selectorPins") or ["s0", "s1"]
    data_pins = data.get("dataPins") or ["d0", "d1", "d2", "d3"]
    sel = 0
    for i, sp in enumerate(sel_pins):
        if _eval_pin(node_id, sp, nodes, edges, assignment, memo, visiting):
            sel |= (1 << i)
    if 0 <= sel < len(data_pins):
        return _eval_pin(node_id, data_pins[sel], nodes, edges, assignment, memo, visiting)
    return False


def _eval_demux(node_id, data, out_handle, nodes, edges, assignment, memo, visiting) -> bool:
    """DEMUX routes its single input to the output pin chosen by the select lines."""
    sel_pins = data.get("selectorPins") or ["s0", "s1"]
    data_pins = data.get("dataPins") or ["d0", "d1", "d2", "d3"]
    in_pin = (data.get("outputPins") or ["out"])[0]
    sel = 0
    for i, sp in enumerate(sel_pins):
        if _eval_pin(node_id, sp, nodes, edges, assignment, memo, visiting):
            sel |= (1 << i)
    if out_handle in data_pins and data_pins.index(out_handle) == sel:
        return _eval_pin(node_id, in_pin, nodes, edges, assignment, memo, visiting)
    return False


def _eval_adder(node_id, ntype, out_handle, nodes, edges, assignment, memo, visiting) -> bool:
    """Half/Full adder. Outputs: 'sum' and 'carry' (half) / 'cout' (full)."""
    a = _eval_pin(node_id, "a", nodes, edges, assignment, memo, visiting)
    b = _eval_pin(node_id, "b", nodes, edges, assignment, memo, visiting)
    if ntype == "FULLADDER":
        cin = _eval_pin(node_id, "cin", nodes, edges, assignment, memo, visiting)
        if out_handle in ("cout", "carry"):
            return (a and b) or (cin and (a ^ b))
        return a ^ b ^ cin
    if out_handle in ("carry", "cout"):
        return a and b
    return a ^ b  # sum


def _eval_out(node_id, handle, nodes, edges, assignment, memo, visiting):
    """Evaluate the boolean at a specific OUTPUT handle of a node (handle-aware,
    so multi-output blocks like adders and DEMUX resolve the correct pin)."""
    if node_id in assignment:
        return assignment[node_id]
    key = (node_id, handle or "out")
    if key in memo:
        return memo[key]
    if key in visiting:
        return False  # break combinational cycles defensively
    visiting.add(key)

    data = nodes[node_id].get("data", {})
    ntype = str(data.get("type", "")).upper()
    if ntype == "MUX":
        result = _eval_mux(node_id, data, nodes, edges, assignment, memo, visiting)
    elif ntype == "DEMUX":
        result = _eval_demux(node_id, data, handle or "d0", nodes, edges, assignment, memo, visiting)
    elif ntype in ("HALFADDER", "FULLADDER"):
        result = _eval_adder(node_id, ntype, handle or "sum", nodes, edges, assignment, memo, visiting)
    else:
        in_vals = [_eval_out(s, sh, nodes, edges, assignment, memo, visiting) for (s, sh) in _input_edges(node_id, edges)]
        result = _apply_gate(ntype, in_vals)

    visiting.discard(key)
    memo[key] = result
    return result


def _evaluate(node_id, nodes, edges, assignment, memo, visiting):
    """Boolean output at a node's default output. Back-compat wrapper around the
    handle-aware evaluator (OUTPUT/gate nodes read their driver's source handle)."""
    return _eval_out(node_id, "out", nodes, edges, assignment, memo, visiting)


def _structural_suggestions(nodes, edges, input_ids, output_ids) -> list[dict]:
    suggestions = []
    connected_targets = {f"{e.get('target')}::{e.get('targetHandle', '')}" for e in edges}
    targets = {e.get("target") for e in edges}

    for nid, node in nodes.items():
        data = node.get("data", {})
        ntype = str(data.get("type", "")).upper()
        if ntype in _GATES:
            for handle in data.get("inputHandles", []):
                if f"{nid}::{handle}" not in connected_targets:
                    suggestions.append({
                        "id": f"float-{nid}-{handle}",
                        "description": f"Gate '{data.get('label', nid)}' input '{handle}' is floating — tie it to a signal or constant.",
                        "patch": {"node": nid, "issue": "floating_input", "handle": handle},
                    })
        if ntype == "OUTPUT" and nid not in targets:
            suggestions.append({
                "id": f"noout-{nid}",
                "description": f"Output '{data.get('label', nid)}' has no driver — connect a gate to it.",
                "patch": {"node": nid, "issue": "undriven_output"},
            })

    if not input_ids:
        suggestions.append({
            "id": "no-inputs",
            "description": "No INPUT or CLOCK blocks found — add inputs so a truth table can be generated.",
            "patch": {"issue": "no_inputs"},
        })
    if not output_ids:
        suggestions.append({
            "id": "no-outputs",
            "description": "No OUTPUT block found — the last gate is treated as the output. Add an OUTPUT to label it.",
            "patch": {"issue": "no_outputs"},
        })
    return suggestions


def netlist_to_verilog(nodes: list[dict], edges: list[dict]) -> str:
    """Structural gate-level Verilog from the wiring. Shared with hdl_compiler."""
    GATE_OP = {
        "AND": "{a} & {b}", "OR": "{a} | {b}", "NAND": "~({a} & {b})",
        "NOR": "~({a} | {b})", "XOR": "{a} ^ {b}", "XNOR": "~({a} ^ {b})",
    }
    by_id = {n["id"]: n for n in nodes}

    # Unique signal name per node (labels like "D-FF" repeat, so disambiguate).
    name_map, used = {}, {}
    for n in nodes:
        base = "".join(c if c.isalnum() else "_" for c in str(n.get("data", {}).get("label") or n["id"])) or "n"
        if base in used:
            used[base] += 1
            base = f"{base}_{used[base]}"
        else:
            used[base] = 0
        name_map[n["id"]] = base

    def wire(nid):
        return name_map.get(nid, "net")

    def src_sig(node_id, handle):
        """Verilog signal feeding input pin (node_id, handle)."""
        s, sh = _driver(node_id, handle, edges)
        if s is None:
            return "1'b0"
        sd = by_id.get(s, {})
        st = str(sd.get("data", {}).get("type", "")).upper()
        is_ff = sd.get("type") == "flipflop" or st in _FF_TYPES
        if is_ff and sh == "q_bar":
            return "~" + wire(s)
        # Multi-output blocks expose one wire per output pin (e.g. demux_d2,
        # adder_sum, adder_cout).
        if st == "DEMUX" and sh and sh != "out":
            return f"{wire(s)}_{sh}"
        if st in ("HALFADDER", "FULLADDER") and sh in ("sum", "carry", "cout"):
            return f"{wire(s)}_{sh}"
        return wire(s)

    def mux_select(node_id, sel_pins):
        """Verilog concatenation of select lines, MSB-first (s0 = LSB)."""
        sigs = [src_sig(node_id, sp) for sp in sel_pins]
        return ("{" + ", ".join(reversed(sigs)) + "}") if len(sigs) > 1 else sigs[0]

    inputs, outputs, assigns, wires = [], [], [], []
    ffs, regs, ff_blocks = [], [], []
    clock_sig = None

    for n in nodes:
        d = n.get("data", {})
        t = str(d.get("type", "")).upper()
        is_ff = n.get("type") == "flipflop" or t in _FF_TYPES
        if t == "CLOCK":
            clock_sig = wire(n["id"]); inputs.append(clock_sig)
        elif t == "INPUT":
            inputs.append(wire(n["id"]))
        elif t == "OUTPUT":
            outputs.append(wire(n["id"]))
            assigns.append(f"assign {wire(n['id'])} = {src_sig(n['id'], 'in-0')};")
        elif t == "NOT":
            wires.append(wire(n["id"]))
            assigns.append(f"assign {wire(n['id'])} = ~{src_sig(n['id'], 'in-0')};")
        elif t in GATE_OP:
            wires.append(wire(n["id"]))
            a, b = src_sig(n["id"], "in-0"), src_sig(n["id"], "in-1")
            assigns.append(f"assign {wire(n['id'])} = {GATE_OP[t].format(a=a, b=b)};")
        elif t == "MUX":
            # out = data input selected by the binary select lines (s0 = LSB).
            wires.append(wire(n["id"]))
            sel_pins = d.get("selectorPins") or ["s0", "s1"]
            data_pins = d.get("dataPins") or ["d0", "d1", "d2", "d3"]
            nsel = len(sel_pins)
            sel = mux_select(n["id"], sel_pins)
            expr = src_sig(n["id"], data_pins[-1])  # default = highest index
            for idx in range(len(data_pins) - 2, -1, -1):
                expr = f"({sel} == {nsel}'d{idx}) ? {src_sig(n['id'], data_pins[idx])} : {expr}"
            assigns.append(f"assign {wire(n['id'])} = {expr};")
        elif t == "DEMUX":
            # Route the single input to the output pin chosen by the select lines.
            sel_pins = d.get("selectorPins") or ["s0", "s1"]
            data_pins = d.get("dataPins") or ["d0", "d1", "d2", "d3"]
            in_pin = (d.get("outputPins") or ["out"])[0]
            nsel = len(sel_pins)
            sel = mux_select(n["id"], sel_pins)
            in_sig = src_sig(n["id"], in_pin)
            for idx, dp in enumerate(data_pins):
                w = f"{wire(n['id'])}_{dp}"
                wires.append(w)
                assigns.append(f"assign {w} = ({sel} == {nsel}'d{idx}) ? {in_sig} : 1'b0;")
        elif t == "HALFADDER":
            a, b = src_sig(n["id"], "a"), src_sig(n["id"], "b")
            ws, wc = f"{wire(n['id'])}_sum", f"{wire(n['id'])}_carry"
            wires += [ws, wc]
            assigns.append(f"assign {ws} = {a} ^ {b};")
            assigns.append(f"assign {wc} = {a} & {b};")
        elif t == "FULLADDER":
            a, b, cin = src_sig(n["id"], "a"), src_sig(n["id"], "b"), src_sig(n["id"], "cin")
            ws, wc = f"{wire(n['id'])}_sum", f"{wire(n['id'])}_cout"
            wires += [ws, wc]
            assigns.append(f"assign {ws} = {a} ^ {b} ^ {cin};")
            assigns.append(f"assign {wc} = ({a} & {b}) | ({cin} & ({a} ^ {b}));")
        elif is_ff:
            ffs.append(n); regs.append(wire(n["id"]))

    if ffs:
        if clock_sig is None:
            clock_sig = "clk"
            inputs.append(clock_sig)
        for ff in ffs:
            t = str(ff.get("data", {}).get("type", "")).upper()
            q = wire(ff["id"])
            if t == "JK":
                J, K = src_sig(ff["id"], "j"), src_sig(ff["id"], "k")
                stmt = f"{q} <= ({J} & ~{q}) | (~{K} & {q});"
            elif t == "SR":
                S, R = src_sig(ff["id"], "s"), src_sig(ff["id"], "r")
                stmt = f"{q} <= {S} ? 1'b1 : ({R} ? 1'b0 : {q});"
            else:  # D flip-flop
                stmt = f"{q} <= {src_sig(ff['id'], 'd')};"
            # Per-flip-flop clock source from the actual wiring. For ripple/async
            # counters the clk pin is driven by another stage's Q (or Q̄), NOT the
            # global CLOCK — so each FF gets its own sensitivity list. A Q̄-driven
            # clock is the same as triggering on the opposite edge of Q.
            edge = "negedge" if str(ff.get("data", {}).get("clockEdge")) == "falling" else "posedge"
            cks, cksh = _driver(ff["id"], "clk", edges)
            if cks is None:
                clk_sig = clock_sig
            else:
                clk_sig = wire(cks)
                if cksh == "q_bar":
                    edge = "posedge" if edge == "negedge" else "negedge"
            # Asynchronous, active-high CLR (Q→0) / PRESET (Q→1) when wired.
            cs, _ = _driver(ff["id"], "clr", edges)
            ps, _ = _driver(ff["id"], "pre", edges)
            clr = wire(cs) if cs is not None else None
            pre = wire(ps) if ps is not None else None
            sens = [f"{edge} {clk_sig}"]
            if clr:
                sens.append(f"posedge {clr}")
            if pre:
                sens.append(f"posedge {pre}")
            body = []
            if clr:
                body.append(f"if ({clr}) {q} <= 1'b0;")
            if pre:
                body.append(f"{'else ' if clr else ''}if ({pre}) {q} <= 1'b1;")
            body.append(f"{'else ' if (clr or pre) else ''}{stmt}")
            ff_blocks.append((sens, body))
        if not outputs:  # no explicit OUTPUT → expose the flip-flop Qs
            outputs = list(regs)

    inputs = sorted(set(inputs))
    out_set = list(dict.fromkeys(outputs))
    reg_set = set(regs)
    internal = sorted(set(wires) - set(out_set))
    internal_regs = sorted(reg_set - set(out_set))

    lines = ["module circuit("]
    ports = [f"    input  wire {i}" for i in (inputs or ["clk"])]
    for o in (out_set or ["y"]):
        ports.append(f"    output {'reg ' if o in reg_set else 'wire'} {o}")
    lines.append(",\n".join(ports))
    lines.append(");")
    lines.append("")
    if internal_regs:
        lines.append(f"    reg {', '.join(internal_regs)};")
    if internal:
        lines.append(f"    wire {', '.join(internal)};")
    if internal_regs or internal:
        lines.append("")
    for a in assigns:
        lines.append(f"    {a}")
    if assigns:
        lines.append("")
    for sens, body in ff_blocks:
        lines.append(f"    always @({' or '.join(sens)}) begin")
        lines.extend(f"        {s}" for s in body)
        lines.append("    end")
        lines.append("")
    lines.append("endmodule")
    return "\n".join(lines)


_FF_TYPES = {"D", "JK", "SR"}


def _is_sequential(req_nodes) -> bool:
    for n in req_nodes:
        if n.get("type") == "flipflop":
            return True
        t = str(n.get("data", {}).get("type", "")).upper()
        if t in _FF_TYPES or t == "CLOCK":
            return True
    return False


def _driver(node_id, handle, edges):
    """The (source_id, source_handle) wired into input pin (node_id, handle)."""
    for e in edges:
        if e.get("target") == node_id and e.get("targetHandle") == handle:
            return e.get("source"), e.get("sourceHandle")
    return None, None


def _seq_value(nid, handle, by_id, edges, state, inputs_now, memo, visiting, global_clk=0):
    """Combinational value of a net given the current FF state + inputs."""
    if nid is None:
        return 0
    key = (nid, handle)
    if key in memo:
        return memo[key]
    if key in visiting:
        return 0  # break (rare) combinational cycle
    visiting.add(key)
    node = by_id.get(nid, {})
    d = node.get("data", {})
    t = str(d.get("type", "")).upper()
    if node.get("type") == "flipflop" or t in _FF_TYPES:
        q = state.get(nid, 0)
        val = (1 - q) if handle == "q_bar" else q  # q / q_bar are held state
    elif t == "INPUT":
        val = inputs_now.get(nid, 0)
    elif t == "CLOCK":
        val = global_clk
    elif t in _GATES:
        ins = []
        for h in (d.get("inputHandles") or ["in-0", "in-1"]):
            s, sh = _driver(nid, h, edges)
            ins.append(bool(_seq_value(s, sh, by_id, edges, state, inputs_now, memo, visiting, global_clk)))
        val = int(_apply_gate(t, ins))
    elif t == "OUTPUT":
        s, sh = _driver(nid, "in-0", edges)
        val = _seq_value(s, sh, by_id, edges, state, inputs_now, memo, visiting, global_clk)
    else:
        s, sh = _driver(nid, (d.get("inputHandles") or ["in-0"])[0], edges)
        val = _seq_value(s, sh, by_id, edges, state, inputs_now, memo, visiting, global_clk)
    visiting.discard(key)
    memo[key] = int(bool(val))
    return memo[key]


def _clk_level(ff_id, by_id, edges, state, inputs_now, global_clk):
    """Current logic level on a flip-flop's clock pin. May be the master CLOCK,
    another flip-flop's Q/Q̄ (ripple/async), or a gated clock — read from wiring."""
    s, sh = _driver(ff_id, "clk", edges)
    if not s:
        return global_clk  # unwired clk pin defaults to the master clock
    return _seq_value(s, sh, by_id, edges, state, inputs_now, {}, set(), global_clk)


def _ff_next_value(ff, by_id, edges, state, inputs_now, global_clk):
    """Next Q for a flip-flop that is firing, from its data inputs + current Q."""
    t = str(ff.get("data", {}).get("type", "")).upper()
    fid = ff["id"]
    q = state.get(fid, 0)
    memo = {}

    def iv(h):
        s, sh = _driver(fid, h, edges)
        return _seq_value(s, sh, by_id, edges, state, inputs_now, memo, set(), global_clk)

    if t == "JK":
        J, K = iv("j"), iv("k")
        return int((J and not q) or (not K and q))
    if t == "SR":
        S, R = iv("s"), iv("r")
        return 0 if (S and R) else (1 if S else (0 if R else q))
    if t == "T":
        T = iv("t")
        return int((T and not q) or (not T and q))
    return iv("d")  # D flip-flop


def _apply_async(ffs, by_id, edges, state, inputs_now, global_clk):
    """Asynchronous, active-high CLR (Q→0) and PRESET (Q→1) — they override the
    clock whenever asserted. CLR wins if both are high. Returns True if any Q
    changed (so the settle loop keeps rippling)."""
    changed = False
    for ff in ffs:
        fid = ff["id"]
        sc, hc = _driver(fid, "clr", edges)
        sp, hp = _driver(fid, "pre", edges)
        clr = _seq_value(sc, hc, by_id, edges, state, inputs_now, {}, set(), global_clk) if sc else 0
        pre = _seq_value(sp, hp, by_id, edges, state, inputs_now, {}, set(), global_clk) if sp else 0
        forced = 0 if clr else (1 if pre else None)
        if forced is not None and state.get(fid) != forced:
            state[fid] = forced
            changed = True
    return changed


def _settle(by_id, ffs, edges, inputs_now, state, prev_clk, global_clk):
    """Apply ONE master-clock level and let clock edges propagate until stable.

    This is what makes asynchronous / ripple counters correct: when a flip-flop
    toggles, the flip-flop clocked by *its* output sees a fresh edge on the next
    iteration and fires in turn — no assumption that all flip-flops share one
    clock. Async CLR/PRESET are applied each iteration and override the clock.
    Bounded by len(ffs)+2 iterations (one per ripple stage)."""
    for _ in range(len(ffs) + 2):
        async_changed = _apply_async(ffs, by_id, edges, state, inputs_now, global_clk)
        cur = {ff["id"]: _clk_level(ff["id"], by_id, edges, state, inputs_now, global_clk) for ff in ffs}
        fired = []
        for ff in ffs:
            et = str(ff.get("data", {}).get("clockEdge", "rising"))
            p, c = prev_clk.get(ff["id"], 0), cur[ff["id"]]
            edge = (p == 0 and c == 1) if et != "falling" else (p == 1 and c == 0)
            if edge:
                fired.append(ff)
        # Record the clock samples used to detect this round's edges.
        for ff in ffs:
            prev_clk[ff["id"]] = cur[ff["id"]]
        if fired:
            nxt = {ff["id"]: _ff_next_value(ff, by_id, edges, state, inputs_now, global_clk) for ff in fired}
            for fid, v in nxt.items():
                state[fid] = int(bool(v))
            _apply_async(ffs, by_id, edges, state, inputs_now, global_clk)  # async overrides clock
        if not fired and not async_changed:
            break
    return state, prev_clk


def _ff_order(ffs, edges, by_id):
    """Order flip-flops by their Q→D shift chain when it is a clean chain,
    otherwise fall back to label order. Defines the MSB→LSB bit order."""
    ids = [ff["id"] for ff in ffs]
    id_set = set(ids)
    driven_by = {}  # ff -> the upstream ff (ripple clk chain, or shift data chain)
    for ff in ffs:
        # clk first → ripple/async counters; then data pins → shift registers.
        for h in ("clk", "d", "j", "s", "t"):
            s, sh = _driver(ff["id"], h, edges)
            if s in id_set and sh in ("q", "q_bar"):
                driven_by[ff["id"]] = s
                break
    heads = [i for i in ids if i not in driven_by]
    if len(heads) == 1:
        nextmap = {v: k for k, v in driven_by.items()}
        order, cur, seen = [], heads[0], set()
        while cur and cur not in seen:
            seen.add(cur)
            order.append(cur)
            cur = nextmap.get(cur)
        if len(order) == len(ids):
            return order
    return sorted(ids, key=lambda i: str(by_id[i].get("data", {}).get("label", i)))


def solve_sequential(req_nodes, edges, init_bits=None, cycles=8, input_bits=None):
    """Numerically evolve the flip-flop state from a given initial state for a
    number of clock cycles. Returns the labelled bit order, initial state, final state and the full state sequence."""
    by_id = {n["id"]: n for n in req_nodes}
    ffs = [n for n in req_nodes if n.get("type") == "flipflop" or str(n.get("data", {}).get("type", "")).upper() in _FF_TYPES]
    inputs = [n for n in req_nodes if str(n.get("data", {}).get("type", "")).upper() == "INPUT"]
    order = _ff_order(ffs, edges, by_id)
    
    # Disambiguate labels
    name_map, used = {}, {}
    for i in order:
        base = "".join(c if c.isalnum() else "_" for c in str(by_id[i].get("data", {}).get("label", i))) or "n"
        if base in used:
            used[base] += 1
            base = f"{base}_{used[base]}"
        else:
            used[base] = 0
        name_map[i] = base

    labels = [name_map[i] for i in order]

    state = {i: 0 for i in order}
    if init_bits:
        bits = [c for c in str(init_bits) if c in "01"]
        for idx, i in enumerate(order):
            if idx < len(bits):
                state[i] = int(bits[idx])

    def bstr(st):
        return "".join(str(st[i]) for i in order)

    # Clock idles low; initialise prev_clk from the wiring at the idle level.
    idle_inputs = {inp["id"]: 0 for inp in inputs}
    prev_clk = {i: _clk_level(i, by_id, edges, state, idle_inputs, 0) for i in order}

    seq = [bstr(state)]
    for k in range(max(int(cycles), 0)):
        inputs_now = {inp["id"]: 0 for inp in inputs}
        if input_bits and inputs:
            b = str(input_bits)
            val = int(b[k % len(b)]) if k < len(b) else int(b[-1])
            for inp in inputs:
                inputs_now[inp["id"]] = val
        # One full master-clock cycle: rising edge, then falling edge — each
        # settled so ripple effects propagate through every stage.
        _settle(by_id, ffs, edges, inputs_now, state, prev_clk, 1)
        _settle(by_id, ffs, edges, inputs_now, state, prev_clk, 0)
        seq.append(bstr(state))

    return {
        "order": labels,
        "initial": seq[0],
        "final": seq[-1],
        "sequence": seq,
        "n_ff": len(order),
        "has_inputs": len(inputs) > 0,
    }


def _simulate_sequential(req_nodes, edges, cycles=12):
    """Clock the flip-flops for N cycles → a timing diagram of CLK, inputs and
    each flip-flop's Q output. (Inputs are driven with a binary-counter pattern.)"""
    by_id = {n["id"]: n for n in req_nodes}
    ffs = [n for n in req_nodes if n.get("type") == "flipflop" or str(n.get("data", {}).get("type", "")).upper() in _FF_TYPES]
    inputs = [n for n in req_nodes if str(n.get("data", {}).get("type", "")).upper() == "INPUT"]
    outputs = [n for n in req_nodes if str(n.get("data", {}).get("type", "")).upper() == "OUTPUT"]

    state = {ff["id"]: 0 for ff in ffs}
    idle_inputs = {inp["id"]: 0 for inp in inputs}
    prev_clk = {ff["id"]: _clk_level(ff["id"], by_id, edges, state, idle_inputs, 0) for ff in ffs}
    clk_tr, in_tr = [], {i["id"]: [] for i in inputs}
    q_tr, out_tr = {ff["id"]: [] for ff in ffs}, {o["id"]: [] for o in outputs}

    for step in range(cycles * 2):
        k_full = step // 2
        global_clk = step % 2

        inputs_now = {inp["id"]: (k_full >> i) & 1 for i, inp in enumerate(inputs)}
        clk_tr.append(global_clk)

        for inp in inputs:
            in_tr[inp["id"]].append(inputs_now[inp["id"]])
        for ff in ffs:
            q_tr[ff["id"]].append(state[ff["id"]])

        mo = {}
        for o in outputs:
            s, sh = _driver(o["id"], "in-0", edges)
            out_tr[o["id"]].append(_seq_value(s, sh, by_id, edges, state, inputs_now, mo, set(), global_clk))

        # Settle this clock level so ripple/async chains propagate fully.
        _settle(by_id, ffs, edges, inputs_now, state, prev_clk, global_clk)

    def mk(name, vals):
        seq = [int(v) for v in vals] or [0]
        return {"name": name, "values": seq + [seq[-1]], "timepoints": list(range(len(seq) + 1))}

    signals = [mk("CLK", clk_tr)]
    for inp in inputs:
        signals.append(mk(str(inp.get("data", {}).get("label", "IN")), in_tr[inp["id"]]))
    for ff in ffs:
        signals.append(mk(str(ff.get("data", {}).get("label", "FF")) + ".Q", q_tr[ff["id"]]))
    for o in outputs:
        signals.append(mk(str(o.get("data", {}).get("label", "OUT")), out_tr[o["id"]]))

    return {"signals": signals, "n_ff": len(ffs), "n_input": len(inputs), "n_output": len(outputs)}


def _sequential_topology(ffs, edges, by_id):
    """Derive (not hardcode) the clocking scheme and data topology from wiring:
    asynchronous/ripple (a FF clocked by another FF) vs synchronous (all share
    the master clock); shift register (D←previous Q) vs toggle counter (D←own Q̄
    or JK toggle)."""
    ff_ids = {ff["id"] for ff in ffs}

    by_master = by_ff = 0
    for ff in ffs:
        s, _ = _driver(ff["id"], "clk", edges)
        if s is None:
            continue
        st = str(by_id.get(s, {}).get("data", {}).get("type", "")).upper()
        if st == "CLOCK":
            by_master += 1
        elif s in ff_ids:
            by_ff += 1
    clocking = "asynchronous" if by_ff > 0 else ("synchronous" if by_master else "unknown")

    shift = toggle = 0
    for ff in ffs:
        t = str(ff.get("data", {}).get("type", "")).upper()
        if t == "JK":
            sj, _ = _driver(ff["id"], "j", edges)
            sk, _ = _driver(ff["id"], "k", edges)
            if sj is None and sk is None:  # J=K=1 (tied) → toggle
                toggle += 1
            continue
        s, sh = _driver(ff["id"], "d", edges)
        if s == ff["id"] and sh == "q_bar":
            toggle += 1
        elif s in ff_ids and sh in ("q", "q_bar"):
            shift += 1
    n = max(1, len(ffs))
    if toggle >= shift and toggle >= 1:
        kind = "counter"
    elif shift >= 1:
        kind = "shift register"
    else:
        kind = "state machine"
    return {"clocking": clocking, "topology": kind}


def analyze_digital(req: NetlistRequest) -> dict:
    nodes = {n["id"]: n for n in req.nodes}

    # Sequential circuits (flip-flops / clock) have no static truth table —
    # simulate them over clock cycles and return a timing diagram instead.
    if _is_sequential(req.nodes):
        sim = _simulate_sequential(req.nodes, req.edges)
        ffs_list = [n for n in req.nodes if n.get("type") == "flipflop" or str(n.get("data", {}).get("type", "")).upper() in _FF_TYPES]
        ff_types = sorted({str(n.get("data", {}).get("type", "")).upper() for n in ffs_list})
        topo = _sequential_topology(ffs_list, req.edges, nodes)
        
        input_ids = sorted(
            [nid for nid, n in nodes.items() if str(n.get("data", {}).get("type", "")).upper() in ("INPUT", "CLOCK")],
            key=lambda nid: str(nodes[nid].get("data", {}).get("label", nid)),
        )
        output_ids = [nid for nid, n in nodes.items() if str(n.get("data", {}).get("type", "")).upper() == "OUTPUT"]
        suggestions = _structural_suggestions(nodes, req.edges, input_ids, output_ids)
        
        hdl = netlist_to_verilog(req.nodes, req.edges)
        
        components = [
            {"type": str(n.get("data", {}).get("type", "")), "label": n.get("data", {}).get("label", nid), "value": n.get("data", {}).get("value", "")}
            for nid, n in nodes.items()
            if str(n.get("data", {}).get("type", "")).upper() in {"AND", "OR", "NOT", "NAND", "NOR", "XOR", "XNOR", "MUX", "DEMUX", "D", "JK", "SR"}
        ]
        bom = compute_bom(BomRequest(components=components)) if components else None

        return {
            "truth_table": None,
            "timing": {"signals": sim["signals"], "clockPeriod": 1},
            "hdl": hdl,
            "hdl_language": "verilog",
            "bom": bom,
            "minimized": None,
            "suggestions": suggestions,
            "sequential": True,
            "summary": {
                "kind": "sequential",
                "clocking": topo["clocking"],
                "topology": topo["topology"],
                "flip_flops": sim["n_ff"],
                "ff_types": ff_types,
                "inputs": [str(n.get("data", {}).get("label", "")) for n in req.nodes if str(n.get("data", {}).get("type", "")).upper() == "INPUT"],
                "outputs": [str(n.get("data", {}).get("label", "")) for n in req.nodes if str(n.get("data", {}).get("type", "")).upper() == "OUTPUT"],
                "gate_count": sum(1 for n in req.nodes if str(n.get("data", {}).get("type", "")).upper() in _GATES),
            },
        }

    input_ids = sorted(
        [nid for nid, n in nodes.items() if str(n.get("data", {}).get("type", "")).upper() in ("INPUT", "CLOCK")],
        key=lambda nid: str(nodes[nid].get("data", {}).get("label", nid)),
    )
    output_ids = [nid for nid, n in nodes.items() if str(n.get("data", {}).get("type", "")).upper() == "OUTPUT"]
    if not output_ids:
        # No explicit OUTPUT — treat terminal gates (no outgoing edge) as outputs.
        sources = {e.get("source") for e in req.edges}
        output_ids = [
            nid for nid, n in nodes.items()
            if str(n.get("data", {}).get("type", "")).upper() in _GATES and nid not in sources
        ]

    variables = [str(nodes[nid].get("data", {}).get("label", nid)) for nid in input_ids]
    suggestions = _structural_suggestions(nodes, req.edges, input_ids, output_ids)

    truth_table = None
    timing = None
    minimized = None

    if input_ids and output_ids and len(input_ids) <= 8:
        n = len(input_ids)
        rows, primary_out, minterms = [], [], []
        out_columns = {oid: [] for oid in output_ids}

        for idx, combo in enumerate(product([False, True], repeat=n)):
            assignment = {input_ids[i]: combo[i] for i in range(n)}
            memo = {}
            for oid in output_ids:
                val = _evaluate(oid, nodes, req.edges, assignment, memo, set())
                out_columns[oid].append(val)
            rows.append(list(combo))
            first = out_columns[output_ids[0]][-1]
            primary_out.append(first)
            if first:
                minterms.append(idx)

        # Minimize the primary output from its actual minterms.
        if minterms:
            try:
                minimized = minimize_kmap(KmapRequest(variables=variables, minterms=minterms)).get("minimized")
            except Exception:
                minimized = None

        truth_table = {
            "variables": variables,
            "rows": rows,
            "outputs": primary_out,
            "minimizedExpression": minimized,
            "output_labels": [str(nodes[o].get("data", {}).get("label", o)) for o in output_ids],
            "output_columns": [out_columns[o] for o in output_ids],
        }

        # Timing: sweep inputs as a binary counter, show inputs + primary output.
        steps = len(rows)
        timepoints = list(range(steps + 1))
        signals = []
        for i, var in enumerate(variables):
            seq = [1 if rows[r][i] else 0 for r in range(steps)]
            signals.append({"name": var, "values": seq + [seq[-1]], "timepoints": timepoints})
        out_seq = [1 if v else 0 for v in primary_out]
        out_label = str(nodes[output_ids[0]].get("data", {}).get("label", "OUT"))
        signals.append({"name": out_label, "values": out_seq + [out_seq[-1]], "timepoints": timepoints})
        timing = {"signals": signals, "clockPeriod": 1}

    # Verilog from the wiring.
    hdl = netlist_to_verilog(req.nodes, req.edges)

    # BOM from placed components.
    components = [
        {"type": str(n.get("data", {}).get("type", "")), "label": n.get("data", {}).get("label", nid), "value": n.get("data", {}).get("value", "")}
        for nid, n in nodes.items()
        if str(n.get("data", {}).get("type", "")).upper() in {"AND", "OR", "NOT", "NAND", "NOR", "XOR", "XNOR", "MUX", "DEMUX", "D", "JK", "SR"}
    ]
    bom = compute_bom(BomRequest(components=components)) if components else None

    return {
        "truth_table": truth_table,
        "timing": timing,
        "hdl": hdl,
        "hdl_language": "verilog",
        "bom": bom,
        "minimized": minimized,
        "suggestions": suggestions,
        "summary": {
            "inputs": variables,
            "outputs": [str(nodes[o].get("data", {}).get("label", o)) for o in output_ids],
            "gate_count": len(components),
        },
    }

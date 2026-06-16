import re
import os

with open("backend/math_service/netlist_eval.py", "r") as f:
    content = f.read()

# 1. Update _seq_value to accept global_clk
content = content.replace(
    "def _seq_value(nid, handle, by_id, edges, state, inputs_now, memo, visiting):",
    "def _seq_value(nid, handle, by_id, edges, state, inputs_now, memo, visiting, global_clk=0):"
)
content = content.replace(
    "val = 0\n    elif t in _GATES:",
    "val = global_clk\n    elif t in _GATES:"
)
content = content.replace(
    "ins.append(bool(_seq_value(s, sh, by_id, edges, state, inputs_now, memo, visiting)))",
    "ins.append(bool(_seq_value(s, sh, by_id, edges, state, inputs_now, memo, visiting, global_clk)))"
)
content = content.replace(
    "val = _seq_value(s, sh, by_id, edges, state, inputs_now, memo, visiting)",
    "val = _seq_value(s, sh, by_id, edges, state, inputs_now, memo, visiting, global_clk)"
)

# 2. Update _next_state to handle edge detection
old_next_state = '''def _next_state(by_id, ffs, edges, inputs_now, state):
    """Compute all flip-flop next-states (sampled simultaneously on the edge)."""
    memo, nxt = {}, {}
    for ff in ffs:
        t = str(ff.get("data", {}).get("type", "")).upper()
        q = state[ff["id"]]

        def iv(h, _ff=ff):
            s, sh = _driver(_ff["id"], h, edges)
            return _seq_value(s, sh, by_id, edges, state, inputs_now, memo, set())

        if t == "JK":
            J, K = iv("j"), iv("k")
            nxt[ff["id"]] = int((J and not q) or (not K and q))
        elif t == "SR":
            S, R = iv("s"), iv("r")
            nxt[ff["id"]] = 0 if (S and R) else (1 if S else (0 if R else q))
        else:  # D flip-flop
            nxt[ff["id"]] = iv("d")
    return {fid: int(bool(v)) for fid, v in nxt.items()}'''

new_next_state = '''def _next_state(by_id, ffs, edges, inputs_now, state, prev_clk, global_clk):
    """Compute all flip-flop next-states (sampled on individual clock edges)."""
    memo, nxt = {}, {}
    cur_clk = {}

    for ff in ffs:
        s, sh = _driver(ff["id"], "clk", edges)
        if not s:
            c = global_clk
        else:
            c = _seq_value(s, sh, by_id, edges, state, inputs_now, memo, set(), global_clk)
        cur_clk[ff["id"]] = c

    for ff in ffs:
        edge_type = str(ff.get("data", {}).get("clockEdge", "rising"))
        c = cur_clk[ff["id"]]
        p = prev_clk.get(ff["id"], 0)
        is_edge = (c == 1 and p == 0) if edge_type != "falling" else (c == 0 and p == 1)
        
        q = state[ff["id"]]
        if not is_edge:
            nxt[ff["id"]] = q
            continue

        t = str(ff.get("data", {}).get("type", "")).upper()

        def iv(h, _ff=ff):
            s, sh = _driver(_ff["id"], h, edges)
            return _seq_value(s, sh, by_id, edges, state, inputs_now, memo, set(), global_clk)

        if t == "JK":
            J, K = iv("j"), iv("k")
            nxt[ff["id"]] = int((J and not q) or (not K and q))
        elif t == "SR":
            S, R = iv("s"), iv("r")
            nxt[ff["id"]] = 0 if (S and R) else (1 if S else (0 if R else q))
        elif t == "T":
            T = iv("t")
            nxt[ff["id"]] = int((T and not q) or (not T and q))
        else:  # D flip-flop
            nxt[ff["id"]] = iv("d")
            
    return {fid: int(bool(v)) for fid, v in nxt.items()}, cur_clk'''

content = content.replace(old_next_state, new_next_state)

# 3. Update solve_sequential
old_solve = '''    state = {i: 0 for i in order}
    if init_bits:
        bits = [c for c in str(init_bits) if c in "01"]
        for idx, i in enumerate(order):
            if idx < len(bits):
                state[i] = int(bits[idx])

    def bstr(st):
        return "".join(str(st[i]) for i in order)

    seq = [bstr(state)]
    for k in range(max(int(cycles), 0)):
        inputs_now = {inp["id"]: 0 for inp in inputs}
        if input_bits and inputs:
            b = str(input_bits)
            val = int(b[k % len(b)]) if k < len(b) else int(b[-1])
            for inp in inputs:
                inputs_now[inp["id"]] = val
        state = _next_state(by_id, ffs, edges, inputs_now, state)
        seq.append(bstr(state))'''

new_solve = '''    state = {i: 0 for i in order}
    prev_clk = {i: 0 for i in order}
    if init_bits:
        bits = [c for c in str(init_bits) if c in "01"]
        for idx, i in enumerate(order):
            if idx < len(bits):
                state[i] = int(bits[idx])

    def bstr(st):
        return "".join(str(st[i]) for i in order)

    seq = [bstr(state)]
    for k in range(max(int(cycles), 0)):
        inputs_now = {inp["id"]: 0 for inp in inputs}
        if input_bits and inputs:
            b = str(input_bits)
            val = int(b[k % len(b)]) if k < len(b) else int(b[-1])
            for inp in inputs:
                inputs_now[inp["id"]] = val
                
        nxt, prev_clk = _next_state(by_id, ffs, edges, inputs_now, state, prev_clk, 0)
        state = nxt
        nxt, prev_clk = _next_state(by_id, ffs, edges, inputs_now, state, prev_clk, 1)
        state = nxt
        seq.append(bstr(state))'''

content = content.replace(old_solve, new_solve)

# 4. Update _simulate_sequential
old_sim = '''    state = {ff["id"]: 0 for ff in ffs}
    clk_tr, in_tr = [], {i["id"]: [] for i in inputs}
    q_tr, out_tr = {ff["id"]: [] for ff in ffs}, {o["id"]: [] for o in outputs}

    for k in range(cycles):
        inputs_now = {inp["id"]: (k >> i) & 1 for i, inp in enumerate(inputs)}
        clk_tr.append(k % 2)
        for inp in inputs:
            in_tr[inp["id"]].append(inputs_now[inp["id"]])
        for ff in ffs:
            q_tr[ff["id"]].append(state[ff["id"]])  # value held during this cycle
        mo = {}
        for o in outputs:
            s, sh = _driver(o["id"], "in-0", edges)
            out_tr[o["id"]].append(_seq_value(s, sh, by_id, edges, state, inputs_now, mo, set()))

        # Sample all flip-flops simultaneously on the clock edge.
        state = _next_state(by_id, ffs, edges, inputs_now, state)'''

new_sim = '''    state = {ff["id"]: 0 for ff in ffs}
    prev_clk = {ff["id"]: 0 for ff in ffs}
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

        state, prev_clk = _next_state(by_id, ffs, edges, inputs_now, state, prev_clk, global_clk)'''

content = content.replace(old_sim, new_sim)

with open("backend/math_service/netlist_eval.py", "w") as f:
    f.write(content)

print("netlist_eval.py patched successfully.")

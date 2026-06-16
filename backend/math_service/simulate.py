"""Block-diagram (Simulink-style) time-domain simulator — DETERMINISTIC, no LLM.

A canvas of connected blocks (sources, gains, sums, transfer functions,
integrators, scopes) defines a dynamical system. This module steps that system
through time using SciPy and returns the signal at every Scope/output block so
the frontend can render a Scope plot.

Engine design (handles feedforward AND feedback without algebraic-loop trouble):
  - Continuous transfer functions are discretized once (Tustin) into state space.
  - Each time step runs three passes:
      1. dynamic blocks emit their output from current state (y = C x + D u_prev)
      2. algebraic blocks (source/gain/sum/scope) resolve in topological order
      3. dynamic block states advance using their freshly-computed input
    Strictly-proper dynamic blocks have no direct feedthrough, so a feedback
    loop's output depends on state (the past), which breaks the loop cleanly —
    exactly how Simulink handles it.
"""
from collections import defaultdict, deque

import numpy as np
from pydantic import BaseModel
from scipy import signal as sp

# Block kinds carried in node["data"]["type"].
# Communication blocks (MESSAGE, CARRIER, PRODUCT) let users build modulators
# such as DSB-SC = message(t) × carrier(t). BITSTREAM is the digital data source
# that feeds the digital modulators (ASK/FSK/PSK/QPSK/QAM).
_SOURCES = {"STEP", "SINE", "COSINE", "SQUARE", "IMPULSE", "RAMP", "CONSTANT",
            "MESSAGE", "CARRIER", "NOISE", "BITSTREAM"}
_DYNAMIC = {"TF", "INTEGRATOR", "DERIVATIVE", "LPF"}
_ALGEBRAIC = {"GAIN", "SUM", "PRODUCT", "MULTIPLIER", "SCOPE", "SPECTRUM", "OUTPUT", "CONSTELLATION"}

# Modulators: analog angle modulation + digital carrier modulation. Handled as
# stateful algebraic blocks (phase accumulators) in the time-stepping loop.
_MOD_ANALOG = {"FM", "PM"}
_MOD_DIGITAL = {"ASK", "OOK", "FSK", "BPSK", "PSK", "QPSK", "QAM"}
_MODULATORS = _MOD_ANALOG | _MOD_DIGITAL
_SINKS = {"SCOPE", "SPECTRUM", "OUTPUT", "CONSTELLATION"}


def _num(data: dict, *keys, default=0.0) -> float:
    """First present numeric field among keys (tolerates camelCase/snake_case)."""
    for kdef in keys:
        if data.get(kdef) is not None:
            try:
                return float(data[kdef])
            except (TypeError, ValueError):
                pass
    return float(default)


class SimulateRequest(BaseModel):
    nodes: list[dict]
    edges: list[dict]
    t_end: float = 10.0
    n_points: int = 500


_OUTPUT_HANDLES = {"out", "q", "q_bar"}


def _normalize_edges(edges: list[dict]) -> list[dict]:
    """Block diagrams are directed (source output → target input). The canvas can
    emit an edge drawn backwards (e.g. a Scope's input ends up as the edge source
    when wired in loose mode). Re-orient so the end on an OUTPUT handle is always
    the source — otherwise a sink wired backwards reads as a driver and the whole
    chain evaluates to zero."""
    fixed = []
    for e in edges:
        sh, th = e.get("sourceHandle"), e.get("targetHandle")
        if sh not in _OUTPUT_HANDLES and th in _OUTPUT_HANDLES:
            e = {**e, "source": e.get("target"), "target": e.get("source"),
                 "sourceHandle": th, "targetHandle": sh}
        fixed.append(e)
    return fixed


def _topo_order(node_ids: list[str], edges: list[dict]) -> list[str]:
    """Best-effort topological sort. Edges that would form a cycle (feedback)
    are dropped from the ordering — the time-stepping handles them via state."""
    incoming = {nid: set() for nid in node_ids}
    outgoing = defaultdict(list)
    for e in edges:
        s, t = e.get("source"), e.get("target")
        if s in incoming and t in incoming and s != t:
            if s not in incoming[t]:
                incoming[t].add(s)
                outgoing[s].append(t)

    indeg = {nid: len(incoming[nid]) for nid in node_ids}
    queue = deque([nid for nid in node_ids if indeg[nid] == 0])
    order: list[str] = []
    while queue:
        nid = queue.popleft()
        order.append(nid)
        for nxt in outgoing[nid]:
            indeg[nxt] -= 1
            if indeg[nxt] == 0:
                queue.append(nxt)

    # Append any nodes left in cycles so every block is still simulated.
    for nid in node_ids:
        if nid not in order:
            order.append(nid)
    return order


def _bit_at(pattern, bit_rate: float, t: float) -> int:
    """Current bit of a repeating bit pattern at time t (piecewise constant)."""
    from .comm import parse_bits
    bits = parse_bits(pattern)
    if bit_rate <= 0 or not bits:
        return 0
    idx = int(t * bit_rate) % len(bits)
    return bits[idx]


def _source_value(block_type: str, params: dict, t: float) -> float:
    amp = float(params.get("amplitude", 1.0))
    offset = float(params.get("offset", 0.0))
    start = float(params.get("step_time", params.get("start_time", 0.0)))
    if block_type == "CONSTANT":
        return amp + offset
    if block_type == "BITSTREAM":
        rb = _num(params, "bit_rate", "bitRate", "frequency", default=10.0)
        return float(_bit_at(params.get("pattern"), rb, t))
    if block_type == "STEP":
        return (amp if t >= start else 0.0) + offset
    if block_type == "RAMP":
        return (amp * (t - start) if t >= start else 0.0) + offset
    if block_type == "IMPULSE":
        return offset  # handled separately as an initial spike
    if block_type == "NOISE":
        return amp * (np.random.rand() * 2 - 1) + offset
    freq = float(params.get("frequency", 1.0))
    phase = np.radians(float(params.get("phase", 0.0)))  # phase entered in degrees
    if block_type in ("SINE", "MESSAGE"):
        return amp * np.sin(2 * np.pi * freq * t + phase) + offset
    if block_type in ("COSINE", "CARRIER"):
        return amp * np.cos(2 * np.pi * freq * t + phase) + offset
    if block_type == "SQUARE":
        return amp * np.sign(np.sin(2 * np.pi * freq * t + phase)) + offset
    return offset


def _discretize(num: list[float], den: list[float], dt: float):
    """Continuous (num/den) → discrete state-space matrices via Tustin."""
    num = [float(x) for x in num] or [1.0]
    den = [float(x) for x in den] or [1.0]
    # Convert to state space first so cont2discrete returns (A,B,C,D,dt).
    A, B, C, D = sp.tf2ss(num, den)
    Ad, Bd, Cd, Dd, _ = sp.cont2discrete((A, B, C, D), dt, method="tustin")
    Ad = np.atleast_2d(Ad)
    Bd = np.atleast_2d(Bd).reshape(Ad.shape[0], -1)
    Cd = np.atleast_2d(Cd).reshape(-1, Ad.shape[0])
    Dd = np.atleast_2d(Dd)
    x = np.zeros((Ad.shape[0], 1))
    return {"A": Ad, "B": Bd, "C": Cd, "D": Dd, "x": x}


def _bit_at_state(st: dict, tk: float) -> int:
    bits = st.get("bits") or [0]
    rb = st.get("rb", 10.0)
    if rb <= 0 or not bits:
        return 0
    return int(bits[int(tk * rb) % len(bits)])


def _modulator_sample(bt: str, data: dict, st: dict, in_vals: list[float], tk: float, dt: float) -> float:
    """One passband sample of a modulator block, advancing phase accumulators.

      FM:  Ac·cos(2π fc t + 2π kf ∫m dt)      (kf = Hz per unit input)
      PM:  Ac·cos(2π fc t + kp·m(t))          (kp = rad per unit input)
      FSK: continuous-phase, f = fc ± Δf per bit
      ASK/OOK: Ac·b·cos(2π fc t)
      BPSK/PSK/QPSK/QAM: Ac·(I·cos − Q·sin)(2π fc t)   from the Gray-mapped symbol
    """
    bt = bt.upper()
    fc = _num(data, "frequency", "carrier_hz", default=50.0)
    Ac = _num(data, "amplitude", default=1.0)
    ph0 = np.radians(_num(data, "phase", default=0.0))
    wct = 2 * np.pi * fc * tk + ph0
    u = in_vals[0] if in_vals else 0.0

    if bt == "FM":
        kf = _num(data, "sensitivity", "kf", default=5.0)
        y = Ac * np.cos(wct + st["phase"])
        st["phase"] += 2 * np.pi * kf * u * dt
        return y
    if bt == "PM":
        kp = _num(data, "sensitivity", "kp", default=1.0)
        return Ac * np.cos(wct + kp * u)
    if bt == "FSK":
        b = _bit_at_state(st, tk)
        fdev = _num(data, "freq_dev", "deviation", default=max(fc * 0.4, 1.0))
        f_inst = fc + (2 * b - 1) * fdev
        y = Ac * np.cos(st["phase"])
        st["phase"] += 2 * np.pi * f_inst * dt
        return y

    # Amplitude/phase digital schemes — read the active Gray-mapped symbol.
    syms = st.get("syms") or []
    rs = st.get("rs", 1.0)
    idx = int(tk * rs)
    i, q = (syms[min(idx, len(syms) - 1)]["i"], syms[min(idx, len(syms) - 1)]["q"]) if syms else (1.0, 0.0)
    if bt in ("ASK", "OOK"):
        return Ac * i * np.cos(wct)
    return Ac * (i * np.cos(wct) - q * np.sin(wct))


def simulate(req: SimulateRequest) -> dict:
    nodes = {n["id"]: n for n in req.nodes}
    node_ids = list(nodes.keys())
    n = max(int(req.n_points), 2)
    t = np.linspace(0.0, float(req.t_end), n)
    dt = t[1] - t[0]

    edges = _normalize_edges(req.edges)
    incoming = defaultdict(list)  # target_id -> [source_id, ...] in edge order
    for e in edges:
        if e.get("target") in nodes and e.get("source") in nodes:
            incoming[e["target"]].append(e["source"])

    order = _topo_order(node_ids, edges)

    # Per-block runtime state.
    dyn: dict[str, dict] = {}
    for nid, node in nodes.items():
        data = node.get("data", {})
        bt = data.get("type", "")
        if bt == "TF":
            dyn[nid] = _discretize(data.get("num", [1]), data.get("den", [1, 1]), dt)
        elif bt == "INTEGRATOR":
            dyn[nid] = _discretize([1.0], [1.0, 0.0], dt)
        elif bt == "DERIVATIVE":
            # Filtered derivative s/(tau s + 1) to stay proper.
            tau = max(dt, 1e-3)
            dyn[nid] = _discretize([1.0, 0.0], [tau, 1.0], dt)
        elif bt == "LPF":
            # 1st-order low-pass with cutoff fc: 1/(s/wc + 1), wc = 2*pi*fc.
            wc = 2 * np.pi * float(data.get("cutoff_hz", data.get("frequency", 10.0)))
            dyn[nid] = _discretize([wc], [1.0, wc], dt)

    # Modulator state: phase accumulators (FM/FSK) + resolved digital symbol streams.
    def _upstream_bitstream(mod_id: str) -> dict | None:
        for s in incoming.get(mod_id, []):
            if nodes[s].get("data", {}).get("type", "").upper() == "BITSTREAM":
                return nodes[s].get("data", {})
        return None

    mods: dict[str, dict] = {}
    for nid, node in nodes.items():
        data = node.get("data", {})
        bt = data.get("type", "").upper()
        if bt not in _MODULATORS:
            continue
        st = {"phase": 0.0}
        if bt in _MOD_DIGITAL:
            from .comm import parse_bits, map_symbols, bits_per_symbol
            bs = _upstream_bitstream(nid) or data
            bits = parse_bits(bs.get("pattern"))
            rb = _num(bs, "bit_rate", "bitRate", "frequency", default=10.0)
            scheme = "OOK" if bt == "ASK" else bt
            M = int(_num(data, "M", "order", default=(4 if bt == "QPSK" else 16 if bt == "QAM" else 2)))
            k = bits_per_symbol(scheme, M)
            st.update({
                "bits": bits, "rb": rb, "scheme": scheme, "M": M,
                "rs": rb / k if k else rb,
                "syms": map_symbols(scheme, bits, M),
            })
        mods[nid] = st

    out = {nid: np.zeros(n) for nid in node_ids}

    for k in range(n):
        tk = t[k]

        # Pass 1: dynamic outputs from current state.
        dyn_input_now: dict[str, float] = {}
        for nid, st in dyn.items():
            y = float(st["C"] @ st["x"])  # strictly proper → D≈0, ignore feedthrough
            out[nid][k] = y

        # Pass 2: algebraic blocks in topological order.
        for nid in order:
            data = nodes[nid].get("data", {})
            bt = data.get("type", "")
            srcs = incoming.get(nid, [])
            in_vals = [out[s][k] for s in srcs]

            if bt in _SOURCES:
                val = _source_value(bt, data, tk)
                if bt == "IMPULSE" and k == 0:
                    val += float(data.get("amplitude", 1.0)) / dt
                out[nid][k] = val
            elif bt == "GAIN":
                g = float(data.get("gain", 1.0))
                out[nid][k] = g * (in_vals[0] if in_vals else 0.0)
            elif bt == "SUM":
                signs = data.get("signs") or ["+"] * len(in_vals)
                total = 0.0
                for i, v in enumerate(in_vals):
                    sign = signs[i] if i < len(signs) else "+"
                    total += v if sign == "+" else -v
                out[nid][k] = total
            elif bt in ("PRODUCT", "MULTIPLIER"):
                prod = 1.0
                for v in in_vals:
                    prod *= v
                out[nid][k] = prod if in_vals else 0.0
            elif bt in _MODULATORS:
                out[nid][k] = _modulator_sample(bt, data, mods[nid], in_vals, tk, dt)
            elif bt in _SINKS:
                out[nid][k] = in_vals[0] if in_vals else 0.0
            # dynamic block inputs (for state update) computed after algebraic pass

        # Pass 3: advance dynamic block states with current inputs.
        for nid, st in dyn.items():
            srcs = incoming.get(nid, [])
            u = sum(out[s][k] for s in srcs)
            dyn_input_now[nid] = u
            uvec = np.array([[u]])
            st["x"] = st["A"] @ st["x"] + st["B"] @ uvec

    # Collect signals at Scope/Spectrum/Output blocks; fall back to dynamic outs.
    fs = 1.0 / dt if dt > 0 else 1.0
    freqs = np.fft.rfftfreq(n, d=dt)

    def spectrum_of(y: np.ndarray) -> dict:
        # Single-sided magnitude spectrum (linear), normalized by N.
        mag = np.abs(np.fft.rfft(y)) / n
        if mag.size > 1:
            mag[1:] *= 2  # account for negative-frequency mirror
        return {"freqs": freqs.tolist(), "magnitude": mag.tolist()}

    signals = []
    spectra = []
    sink_ids = [
        nid for nid in node_ids
        if nodes[nid].get("data", {}).get("type") in _SINKS
    ]
    targets = sink_ids if sink_ids else [nid for nid in node_ids if nid in dyn]
    for nid in targets:
        data = nodes[nid].get("data", {})
        label = data.get("label", nid)
        y = out[nid]
        signals.append({"id": nid, "label": label, "y": y.tolist()})
        # Every sink also gets a spectrum so modulation sidebands are visible.
        spec = spectrum_of(y)
        spectra.append({"id": nid, "label": label, **spec})

    # Constellation diagrams: each CONSTELLATION sink fed by a digital modulator.
    constellations = []
    for nid in node_ids:
        data = nodes[nid].get("data", {})
        if data.get("type", "").upper() != "CONSTELLATION":
            continue
        mod_id = next((s for s in incoming.get(nid, []) if s in mods and nodes[s].get("data", {}).get("type", "").upper() in _MOD_DIGITAL), None)
        if mod_id is None:
            continue
        mst = mods[mod_id]
        from .comm import constellation as _constellation
        snr = _num(data, "snr_db", "snr", default=15.0)
        payload = _constellation(mst["scheme"], mst["bits"], mst["M"], snr_db=snr)
        payload["id"] = nid
        payload["label"] = data.get("label", nid)
        payload["modulator"] = nodes[mod_id].get("data", {}).get("label", mod_id)
        constellations.append(payload)

    return {
        "t": t.tolist(),
        "signals": signals,
        "spectra": spectra,
        "constellations": constellations,
        "dt": float(dt),
        "fs": float(fs),
    }

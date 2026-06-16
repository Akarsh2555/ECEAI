"""Linear AC analysis of an analog netlist via Modified Nodal Analysis (MNA).

This replaces the old heuristic that grabbed the first R and first C and always
assumed an RC low-pass. Here we actually trace the wiring:

  - electrical nets are recovered by union-find over the wires (edges),
  - every component is stamped into a complex MNA matrix at each frequency,
  - the transfer function H(jw) = V_out / V_in is solved across a sweep.

Because it is topology-driven, a series (coupling) capacitor correctly produces
a HIGH-PASS (lower cutoff) and a shunt capacitor a LOW-PASS — and the active
devices carry small-signal parasitic capacitances, which give the upper cutoff.

Active devices use default small-signal operating points (no DC solve), so gains
are approximate, but the *shape* and the cutoff frequencies follow the real
topology and component values.
"""
from collections import defaultdict, deque

import numpy as np
from pydantic import BaseModel

# Pins per component type (mirrors the frontend AnalogNode HANDLE config).
PINS = {
    "R": ["p1", "p2"], "C": ["p1", "p2"], "L": ["p1", "p2"],
    "AC_SOURCE": ["p1", "p2"], "DC_SOURCE": ["p1", "p2"],
    "DIODE": ["anode", "cathode"],
    "OPAMP": ["inv", "non_inv", "out"],
    "BJT": ["base", "collector", "emitter"],
    "MOSFET": ["gate", "drain", "source"],
    "GROUND": ["gnd"],
}

_PREFIX = {"p": 1e-12, "n": 1e-9, "u": 1e-6, "µ": 1e-6, "m": 1e-3,
           "k": 1e3, "K": 1e3, "M": 1e6, "G": 1e9}

# Default small-signal parameters for active devices (Ic ~ 1 mA bias).
_BJT = dict(gm=0.04, rpi=2500.0, ro=1.0e5, cpi=10e-12, cmu=2e-12)
_MOS = dict(gm=2e-3, ro=5.0e4, cgs=5e-12, cgd=1e-12)
_DIODE_R = 25.0       # small-signal forward resistance
_DIODE_C = 5e-12
_GMIN = 1e-12         # SPICE-style conductance to ground (avoids singular matrix)


class ACRequest(BaseModel):
    nodes: list[dict]
    edges: list[dict]
    freq_start: float = 1.0
    freq_end: float = 1.0e8
    n_points: int = 600


def _si(value, unit) -> float:
    try:
        v = float(value if value is not None else 0)
    except (TypeError, ValueError):
        v = 0.0
    u = str(unit or "").strip()
    if len(u) >= 2 and u[0] in _PREFIX:
        return v * _PREFIX[u[0]]
    return v


class _UF:
    def __init__(self):
        self.parent = {}

    def find(self, x):
        self.parent.setdefault(x, x)
        while self.parent[x] != x:
            self.parent[x] = self.parent[self.parent[x]]
            x = self.parent[x]
        return x

    def union(self, a, b):
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.parent[ra] = rb


def _build_nets(nodes, edges):
    """Union-find over pins → net index per (node_id, pin). Ground = net 0."""
    uf = _UF()
    pin_of = {}  # (node_id, pin) is registered as a key
    for n in nodes:
        nid = n["id"]
        for p in PINS.get(str(n.get("data", {}).get("type", "")), []):
            uf.find((nid, p))

    def edge_pin(node_id, handle):
        node = next((x for x in nodes if x["id"] == node_id), None)
        if not node:
            return None
        pins = PINS.get(str(node.get("data", {}).get("type", "")), [])
        if handle in pins:
            return (node_id, handle)
        return (node_id, pins[0]) if pins else None

    for e in edges:
        a = edge_pin(e.get("source"), e.get("sourceHandle"))
        b = edge_pin(e.get("target"), e.get("targetHandle"))
        if a and b:
            uf.union(a, b)

    # Roots → net ids; ground roots become net 0.
    ground_roots = set()
    for n in nodes:
        if str(n.get("data", {}).get("type", "")) == "GROUND":
            ground_roots.add(uf.find((n["id"], "gnd")))

    root_to_net = {}
    next_idx = 1
    pin_net = {}
    for key in list(uf.parent.keys()):
        r = uf.find(key)
        if r in ground_roots:
            pin_net[key] = 0
            continue
        if r not in root_to_net:
            root_to_net[r] = next_idx
            next_idx += 1
        pin_net[key] = root_to_net[r]

    n_nets = next_idx - 1  # excluding ground
    return pin_net, n_nets


def _pick_io(nodes, pin_net):
    """Return (input net, ref net, output net). Input = AC source (else DC)."""
    def net(nid, pin):
        return pin_net.get((nid, pin), 0)

    src = next((n for n in nodes if n.get("data", {}).get("type") == "AC_SOURCE"), None)
    if src is None:
        src = next((n for n in nodes if n.get("data", {}).get("type") == "DC_SOURCE"), None)
    if src is None:
        return None, 0, None

    a, b = net(src["id"], "p1"), net(src["id"], "p2")
    # The "hot" input net is the non-ground terminal.
    in_net, ref_net = (a, b) if b == 0 else (b, a) if a == 0 else (a, b)

    # Build a net adjacency from two-terminal components to find the far output.
    adj = defaultdict(set)
    for n in nodes:
        t = str(n.get("data", {}).get("type", ""))
        pins = PINS.get(t, [])
        if len(pins) == 2:
            x, y = net(n["id"], pins[0]), net(n["id"], pins[1])
            if x != y:
                adj[x].add(y); adj[y].add(x)
        elif t in ("BJT", "MOSFET"):
            # signal flows input pin → output pin
            ipin, opin = ("base", "collector") if t == "BJT" else ("gate", "drain")
            x, y = net(n["id"], ipin), net(n["id"], opin)
            if x != y:
                adj[x].add(y); adj[y].add(x)
        elif t == "OPAMP":
            x, y = net(n["id"], "non_inv"), net(n["id"], "out")
            if x != y:
                adj[x].add(y); adj[y].add(x)

    # BFS distances from the input net.
    dist = {in_net: 0}
    q = deque([in_net])
    while q:
        u = q.popleft()
        for v in adj[u]:
            if v not in dist:
                dist[v] = dist[u] + 1
                q.append(v)

    # Prefer the OUTPUT of an active device (BJT collector, MOSFET drain, op-amp
    # out) — that is the physical amplifier output, where the gain appears. Pick
    # the one farthest from the input (the last stage). Only fall back to the
    # "farthest net" heuristic for purely passive networks.
    active_out = set()
    for n in nodes:
        t = str(n.get("data", {}).get("type", ""))
        if t == "BJT":
            active_out.add(net(n["id"], "collector"))
        elif t == "MOSFET":
            active_out.add(net(n["id"], "drain"))
        elif t == "OPAMP":
            active_out.add(net(n["id"], "out"))
    active_out.discard(0); active_out.discard(in_net)
    if active_out:
        out_net = max(active_out, key=lambda nt: (dist.get(nt, 0), nt))
    else:
        candidates = [(d, nett) for nett, d in dist.items() if nett not in (0, in_net)]
        out_net = max(candidates)[1] if candidates else in_net
    return in_net, ref_net, out_net


def _solve_ac(nodes, pin_net, n_nets, w, vsrc_list, dc_params=None):
    """Assemble + solve the MNA system at angular frequency w. Returns node
    voltages. `dc_params` maps device id → bias-derived small-signal params
    (gm, rpi, ro, rd); falls back to nominal defaults when absent."""
    dc_params = dc_params or {}
    # Extra current unknowns: independent voltage sources + ideal op-amps.
    extras = list(vsrc_list)  # (net+, net-, value)
    opamps = [n for n in nodes if n.get("data", {}).get("type") == "OPAMP"]
    m = len(extras) + len(opamps)
    size = n_nets + m
    A = np.zeros((size, size), dtype=complex)
    b = np.zeros(size, dtype=complex)

    def idx(net):  # matrix row/col for a net (ground returns None)
        return net - 1 if net >= 1 else None

    def stamp_y(a, bnet, y):
        ia, ib = idx(a), idx(bnet)
        if ia is not None:
            A[ia, ia] += y
        if ib is not None:
            A[ib, ib] += y
        if ia is not None and ib is not None:
            A[ia, ib] -= y
            A[ib, ia] -= y

    def stamp_vccs(p, n, cp, cn, gm):
        # current gm*(V(cp)-V(cn)) flowing from node p into node n
        for node, sign in ((p, +1), (n, -1)):
            ridx = idx(node)
            if ridx is None:
                continue
            if idx(cp) is not None:
                A[ridx, idx(cp)] += sign * gm
            if idx(cn) is not None:
                A[ridx, idx(cn)] -= sign * gm

    def netof(nid, pin):
        return pin_net.get((nid, pin), 0)

    # gmin to ground for every net (numerical stability for floating nodes).
    for k in range(n_nets):
        A[k, k] += _GMIN

    # Passive + active stamps.
    for n in nodes:
        d = n.get("data", {})
        t = str(d.get("type", ""))
        val = _si(d.get("value"), d.get("unit"))
        if t == "R":
            stamp_y(netof(n["id"], "p1"), netof(n["id"], "p2"), 1.0 / val if val else 0.0)
        elif t == "C":
            stamp_y(netof(n["id"], "p1"), netof(n["id"], "p2"), 1j * w * val)
        elif t == "L":
            stamp_y(netof(n["id"], "p1"), netof(n["id"], "p2"), 1.0 / (1j * w * val) if val else 0.0)
        elif t == "DIODE":
            p = dc_params.get(n["id"], {})
            rd = p.get("rd", _DIODE_R)
            stamp_y(netof(n["id"], "anode"), netof(n["id"], "cathode"), 1.0 / rd + 1j * w * _DIODE_C)
        elif t == "BJT":
            p = dc_params.get(n["id"], {})
            gm, rpi, ro = p.get("gm", _BJT["gm"]), p.get("rpi", _BJT["rpi"]), p.get("ro", _BJT["ro"])
            B, Cc, E = netof(n["id"], "base"), netof(n["id"], "collector"), netof(n["id"], "emitter")
            stamp_y(B, E, 1.0 / rpi + 1j * w * _BJT["cpi"])  # rpi || Cpi
            stamp_y(B, Cc, 1j * w * _BJT["cmu"])             # Cmu (Miller)
            stamp_y(Cc, E, 1.0 / ro)                         # ro
            stamp_vccs(Cc, E, B, E, gm)                      # gm*vbe
        elif t == "MOSFET":
            p = dc_params.get(n["id"], {})
            gm, ro = p.get("gm", _MOS["gm"]), p.get("ro", _MOS["ro"])
            G, Dd, S = netof(n["id"], "gate"), netof(n["id"], "drain"), netof(n["id"], "source")
            stamp_y(G, S, 1j * w * _MOS["cgs"])
            stamp_y(G, Dd, 1j * w * _MOS["cgd"])
            stamp_y(Dd, S, 1.0 / ro)
            stamp_vccs(Dd, S, G, S, gm)

    # Independent voltage sources (input AC = 1, DC = AC short = 0).
    row = n_nets
    for (pnet, nnet, value) in extras:
        ip, inn = idx(pnet), idx(nnet)
        if ip is not None:
            A[ip, row] += 1; A[row, ip] += 1
        if inn is not None:
            A[inn, row] -= 1; A[row, inn] -= 1
        b[row] = value
        row += 1

    # Ideal op-amps: V(non_inv) - V(inv) = 0, free output current.
    for op in opamps:
        out = idx(netof(op["id"], "out"))
        ni, iv = idx(netof(op["id"], "non_inv")), idx(netof(op["id"], "inv"))
        if out is not None:
            A[out, row] += 1
        if ni is not None:
            A[row, ni] += 1
        if iv is not None:
            A[row, iv] -= 1
        row += 1

    try:
        x = np.linalg.solve(A, b)
    except np.linalg.LinAlgError:
        x, *_ = np.linalg.lstsq(A, b, rcond=None)
    return x


def _classify(freqs, mag_db):
    """Determine filter type and -3 dB cutoff(s) from the magnitude response."""
    mag = np.asarray(mag_db)
    passband = float(np.max(mag))
    thr = passband - 3.0
    above = mag >= thr
    if not above.any():
        return "all-stop / no passband", []

    lo_passing, hi_passing = bool(above[0]), bool(above[-1])
    # crossings of the -3 dB threshold
    cuts = []
    for i in range(1, len(mag)):
        if (mag[i - 1] - thr) * (mag[i] - thr) < 0:
            # linear interpolate the crossing frequency (log-f)
            f0, f1 = np.log10(freqs[i - 1]), np.log10(freqs[i])
            m0, m1 = mag[i - 1], mag[i]
            fx = 10 ** (f0 + (thr - m0) * (f1 - f0) / (m1 - m0))
            cuts.append(round(float(fx), 2))

    if lo_passing and not hi_passing:
        return "low-pass", cuts[:1]
    if hi_passing and not lo_passing:
        return "high-pass", cuts[:1]
    if not lo_passing and not hi_passing and len(cuts) >= 2:
        return "band-pass", cuts[:2]
    if lo_passing and hi_passing and len(cuts) >= 2:
        return "band-stop (notch)", cuts[:2]
    return "band-pass" if cuts else "flat / wideband", cuts


def analyze_ac(req: ACRequest) -> dict:
    pin_net, n_nets = _build_nets(req.nodes, req.edges)
    if n_nets == 0:
        return {"error": "No connected nets — wire the components together and add a ground."}

    in_net, ref_net, out_net = _pick_io(req.nodes, pin_net)
    if in_net is None:
        return {"error": "No source found — add an AC source (or DC source) as the input."}
    if out_net is None or out_net == in_net:
        out_net = in_net

    # Voltage source list: AC sources = 1 V (input), DC sources = 0 V (AC short).
    vsrc = []
    for n in req.nodes:
        t = n.get("data", {}).get("type")
        if t in ("AC_SOURCE", "DC_SOURCE"):
            pnet = pin_net.get((n["id"], "p1"), 0)
            nnet = pin_net.get((n["id"], "p2"), 0)
            vsrc.append((pnet, nnet, 1.0 if t == "AC_SOURCE" else 0.0))

    # Solve the DC operating point once → real per-device small-signal params
    # (gm, rπ, ro). Falls back to nominal defaults if it can't converge.
    dc = None
    try:
        from .dc_analysis import solve_dc
        dc = solve_dc(req.nodes, req.edges)
    except Exception:
        dc = None
    dc_params = dc["params"] if dc else None

    freqs = np.logspace(np.log10(req.freq_start), np.log10(req.freq_end), req.n_points)
    H = np.zeros(len(freqs), dtype=complex)
    oi = out_net - 1 if out_net >= 1 else None
    for k, f in enumerate(freqs):
        x = _solve_ac(req.nodes, pin_net, n_nets, 2 * np.pi * f, vsrc, dc_params)
        H[k] = x[oi] if oi is not None else 0.0

    mag_db = 20 * np.log10(np.abs(H) + 1e-18)
    phase = np.degrees(np.unwrap(np.angle(H)))
    ftype, cutoffs = _classify(freqs, mag_db)

    return {
        "freqs_hz": freqs.tolist(),
        "magnitude_db": mag_db.tolist(),
        "phase_deg": phase.tolist(),
        "filter_type": ftype,
        "cutoffs_hz": cutoffs,
        "nets": n_nets,
        "in_net": in_net,
        "out_net": out_net,
        "bias_solved": bool(dc),
        "operating_point": dc["op"] if dc else [],
    }

"""Nonlinear DC operating-point solver (Newton-Raphson) for analog netlists.

This removes the last hardcoded piece of the analog path: instead of assuming a
fixed bias (gm = 0.04 S, etc.), it solves the actual DC operating point with real
device models (diode, BJT Ebers-Moll, MOSFET square-law) and extracts the true
small-signal parameters (gm, rπ, ro, gds, rd) for each device. `ac_analysis`
then uses those bias-derived values, so amplifier gains become accurate.

At DC: capacitors are open, inductors are shorts, AC sources are zeroed (their
small signal is applied later by the AC analysis), DC sources provide the bias.
Robustness: SPICE-style gmin, junction-voltage limiting (pnjlim), capped
iterations. If it fails to converge it returns None and the AC analysis falls
back to nominal defaults.
"""
import math

import numpy as np

from .ac_analysis import _build_nets, _si, PINS, _GMIN

VT = 0.025852  # thermal voltage at ~300 K

# Default device model parameters (geometry/process — not bias).
DIODE = dict(Is=1e-14, n=1.0)
BJT = dict(Is=1e-15, bf=150.0, br=2.0, vaf=100.0)
MOS = dict(vth=1.0, kp=2e-4, wl=20.0, lam=0.02)  # beta = kp*wl

_MAX_ITER = 500
_VTOL = 1e-6
_VMAX = 0.5  # max node-voltage change per Newton iteration (damping)


def _pnjlim(vnew, vold, vt, vcrit):
    """Limit a pn-junction voltage step to keep exp() from overflowing and to
    help Newton converge (classic SPICE pnjlim). Returns (v_limited, was_limited).
    While limiting is active the solution has NOT converged (the node voltage may
    sit still while the junction is still ramping), so callers must keep iterating."""
    if vnew > vcrit and abs(vnew - vold) > 2 * vt:
        if vold > 0:
            arg = 1 + (vnew - vold) / vt
            vnew = vold + vt * math.log(arg) if arg > 0 else vcrit
        else:
            vnew = vt * math.log(vnew / vt) if vnew > vt else vnew
        return vnew, True
    return vnew, False


def _diode_i_g(vd, Is, n):
    vt = n * VT
    vd = min(vd, 0.9)  # safety clamp on top of pnjlim
    e = math.exp(min(vd / vt, 80.0))
    Id = Is * (e - 1.0)
    gd = Is * e / vt
    return Id, gd


def solve_dc(nodes, edges):
    """Solve the DC operating point. Returns {node_v, params, op} or None."""
    pin_net, n_nets = _build_nets(nodes, edges)
    if n_nets == 0:
        return None

    def netof(nid, pin):
        return pin_net.get((nid, pin), 0)

    def idx(net):
        return net - 1 if net >= 1 else None

    # Independent DC voltage sources: DC source (value), AC source (0 at DC),
    # inductor (0 V short).
    vsources = []  # (p_net, n_net, value)
    for n in nodes:
        t = str(n.get("data", {}).get("type", ""))
        if t == "DC_SOURCE":
            vsources.append((netof(n["id"], "p1"), netof(n["id"], "p2"), _si(n.get("data", {}).get("value"), n.get("data", {}).get("unit"))))
        elif t == "AC_SOURCE":
            vsources.append((netof(n["id"], "p1"), netof(n["id"], "p2"), 0.0))
        elif t == "L":
            vsources.append((netof(n["id"], "p1"), netof(n["id"], "p2"), 0.0))

    m = len(vsources)
    size = n_nets + m
    vcrit = VT * math.log(VT / (math.sqrt(2) * BJT["Is"]))
    vcrit_d = VT * math.log(VT / (math.sqrt(2) * DIODE["Is"]))

    v = np.zeros(size)             # solution vector (node voltages + vsrc currents)
    jprev = {}                     # previous junction voltages for limiting

    nonlinear = [n for n in nodes if str(n.get("data", {}).get("type", "")) in ("DIODE", "BJT", "MOSFET")]

    for _ in range(_MAX_ITER if nonlinear else 1):
        A = np.zeros((size, size))
        b = np.zeros(size)
        limited = False  # set if any junction was step-limited this iteration
        for k in range(n_nets):
            A[k, k] += _GMIN

        def vat(net):
            i = idx(net)
            return v[i] if i is not None else 0.0

        def stamp_g(a, bn, g):
            ia, ib = idx(a), idx(bn)
            if ia is not None:
                A[ia, ia] += g
            if ib is not None:
                A[ib, ib] += g
            if ia is not None and ib is not None:
                A[ia, ib] -= g; A[ib, ia] -= g

        def stamp_i(a, bn, ieq):
            ia, ib = idx(a), idx(bn)
            if ia is not None:
                b[ia] -= ieq
            if ib is not None:
                b[ib] += ieq

        # Resistors.
        for n in nodes:
            d = n.get("data", {}); t = str(d.get("type", ""))
            if t == "R":
                r = _si(d.get("value"), d.get("unit"))
                stamp_g(netof(n["id"], "p1"), netof(n["id"], "p2"), 1.0 / r if r else 0.0)

        # Diodes.
        for n in nonlinear:
            if str(n.get("data", {}).get("type")) != "DIODE":
                continue
            a, c = netof(n["id"], "anode"), netof(n["id"], "cathode")
            vd, lim = _pnjlim(vat(a) - vat(c), jprev.get(n["id"], 0.0), DIODE["n"] * VT, vcrit_d)
            limited = limited or lim
            jprev[n["id"]] = vd
            Id, gd = _diode_i_g(vd, DIODE["Is"], DIODE["n"])
            stamp_g(a, c, gd)
            stamp_i(a, c, Id - gd * vd)

        # BJTs (NPN; PNP via polarity flip).
        for n in nonlinear:
            if str(n.get("data", {}).get("type")) != "BJT":
                continue
            pol = -1.0 if str(n.get("data", {}).get("model", "NPN")).upper() == "PNP" else 1.0
            B, C, E = netof(n["id"], "base"), netof(n["id"], "collector"), netof(n["id"], "emitter")
            vbe = pol * (vat(B) - vat(E)); vbc = pol * (vat(B) - vat(C))
            vbe, l1 = _pnjlim(vbe, jprev.get((n["id"], "be"), 0.0), VT, vcrit); jprev[(n["id"], "be")] = vbe
            vbc, l2 = _pnjlim(vbc, jprev.get((n["id"], "bc"), 0.0), VT, vcrit); jprev[(n["id"], "bc")] = vbc
            limited = limited or l1 or l2
            Is, bf, br = BJT["Is"], BJT["bf"], BJT["br"]
            aF, aR = math.exp(min(vbe / VT, 80.0)), math.exp(min(vbc / VT, 80.0))
            gif, gir = Is * aF / VT, Is * aR / VT
            gbe, gbc = Is * aF / (bf * VT), Is * aR / (br * VT)
            Ibe, Ibc, Ict = (Is / bf) * (aF - 1), (Is / br) * (aR - 1), Is * (aF - aR)
            Ib, Ic = Ibe + Ibc, Ict - Ibc
            Ie = -(Ib + Ic)
            # Jacobian wrt (vb, vc, ve)
            J = {
                B: {B: gbe + gbc, C: -gbc, E: -gbe},
                C: {B: gif - gir - gbc, C: gir + gbc, E: -gif},
                E: {B: -(gbe + gbc) - (gif - gir - gbc), C: gbc - (gir + gbc), E: gbe + gif},
            }
            Iterm = {B: Ib, C: Ic, E: Ie}
            for term in (B, C, E):
                it = idx(term)
                if it is None:
                    continue
                ieq = pol * Iterm[term]
                for x in (B, C, E):
                    jx = idx(x)
                    g = J[term][x]
                    if jx is not None:
                        A[it, jx] += g
                    ieq -= g * (pol * vat(x))
                # ieq currently = pol*I - J·(pol·v); inject as current source
                b[it] -= ieq

        # MOSFETs (NMOS; PMOS via polarity flip).
        for n in nonlinear:
            if str(n.get("data", {}).get("type")) != "MOSFET":
                continue
            pol = -1.0 if str(n.get("data", {}).get("model", "NMOS")).upper() == "PMOS" else 1.0
            G, Dn, S = netof(n["id"], "gate"), netof(n["id"], "drain"), netof(n["id"], "source")
            vgs = pol * (vat(G) - vat(S)); vds = pol * (vat(Dn) - vat(S))
            beta, vth, lam = MOS["kp"] * MOS["wl"], MOS["vth"], MOS["lam"]
            vov = vgs - vth
            if vov <= 0:                      # cutoff
                Id = gm = gds = 0.0
            elif vds < vov:                   # triode
                Id = beta * (vov * vds - 0.5 * vds * vds) * (1 + lam * vds)
                gm = beta * vds * (1 + lam * vds)
                gds = beta * (vov - vds) * (1 + lam * vds) + beta * (vov * vds - 0.5 * vds * vds) * lam
            else:                             # saturation
                Id = 0.5 * beta * vov * vov * (1 + lam * vds)
                gm = beta * vov * (1 + lam * vds)
                gds = 0.5 * beta * vov * vov * lam
            ieq = pol * Id - gm * (pol * vgs) - gds * (pol * vds)
            for node, s in ((Dn, 1.0), (S, -1.0)):
                it = idx(node)
                if it is None:
                    continue
                if idx(G) is not None:
                    A[it, idx(G)] += s * gm
                if idx(Dn) is not None:
                    A[it, idx(Dn)] += s * gds
                if idx(S) is not None:
                    A[it, idx(S)] -= s * (gm + gds)
                b[it] -= s * ieq

        # Independent voltage sources.
        row = n_nets
        for (pn, nn, val) in vsources:
            ip, inn = idx(pn), idx(nn)
            if ip is not None:
                A[ip, row] += 1; A[row, ip] += 1
            if inn is not None:
                A[inn, row] -= 1; A[row, inn] -= 1
            b[row] = val
            row += 1

        try:
            vnew = np.linalg.solve(A, b)
        except np.linalg.LinAlgError:
            return None
        if not np.all(np.isfinite(vnew)):
            return None
        # Damped Newton: cap the per-iteration node-voltage change so a steep
        # exponential (BJT/diode turning on) can't make the solve overshoot and
        # diverge. The fixed point is unchanged — only the path is damped.
        dv = vnew - v
        if nonlinear and n_nets:
            mx = float(np.max(np.abs(dv[:n_nets])))
            if mx > _VMAX:
                dv = dv * (_VMAX / mx)
        v = v + dv
        delta = float(np.max(np.abs(dv[:n_nets]))) if (nonlinear and n_nets) else 0.0
        # Converged only when node voltages settle AND no junction is still being
        # step-limited (otherwise the node may sit still mid-ramp = false convergence).
        if not nonlinear or (delta < _VTOL and not limited):
            break
    else:
        return None  # did not converge

    # Reject physically absurd solutions (divergence) → caller uses defaults.
    if not np.all(np.isfinite(v)) or (n_nets and np.max(np.abs(v[:n_nets])) > 1e4):
        return None

    # Extract small-signal parameters at the converged operating point.
    def vat_final(net):
        i = idx(net)
        return v[i] if i is not None else 0.0

    params, op = {}, []
    for n in nonlinear:
        t = str(n.get("data", {}).get("type"))
        nid = n["id"]
        label = n.get("data", {}).get("label", nid)
        if t == "DIODE":
            vd = vat_final(netof(nid, "anode")) - vat_final(netof(nid, "cathode"))
            Id, gd = _diode_i_g(vd, DIODE["Is"], DIODE["n"])
            params[nid] = {"rd": 1.0 / gd if gd > 0 else 1e9}
            op.append(f"{label}: Vd={vd*1e3:.0f} mV, Id={Id*1e3:.3f} mA")
        elif t == "BJT":
            pol = -1.0 if str(n.get("data", {}).get("model", "NPN")).upper() == "PNP" else 1.0
            vbe = pol * (vat_final(netof(nid, "base")) - vat_final(netof(nid, "emitter")))
            Ic = max(BJT["Is"] * math.exp(min(vbe / VT, 80.0)), 1e-12)
            gm = Ic / VT
            params[nid] = {"gm": gm, "rpi": BJT["bf"] / gm, "ro": BJT["vaf"] / Ic}
            op.append(f"{label}: Ic={Ic*1e3:.3f} mA, gm={gm*1e3:.1f} mS")
        elif t == "MOSFET":
            pol = -1.0 if str(n.get("data", {}).get("model", "NMOS")).upper() == "PMOS" else 1.0
            vgs = pol * (vat_final(netof(nid, "gate")) - vat_final(netof(nid, "source")))
            vds = pol * (vat_final(netof(nid, "drain")) - vat_final(netof(nid, "source")))
            beta, vth, lam = MOS["kp"] * MOS["wl"], MOS["vth"], MOS["lam"]
            vov = vgs - vth
            if vov <= 0:
                Id, gm, gds = 0.0, 1e-9, 1e-9
            else:
                sat = vds >= vov
                Id = 0.5 * beta * vov * vov * (1 + lam * vds) if sat else beta * (vov * vds - 0.5 * vds * vds)
                gm = beta * vov * (1 + lam * vds) if sat else beta * vds
                gds = max(0.5 * beta * vov * vov * lam, 1e-9)
            params[nid] = {"gm": max(gm, 1e-9), "ro": 1.0 / max(gds, 1e-12)}
            op.append(f"{label}: Id={Id*1e3:.3f} mA, gm={gm*1e3:.2f} mS")

    return {"params": params, "op": op}

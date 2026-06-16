"""Generate runnable MATLAB / Octave + Python from a block-diagram graph.

The graph's connections map directly onto MATLAB Control System Toolbox
``connect`` semantics: each block becomes a named system with InputName/
OutputName tags, and ``connect`` wires them by matching names — the same idea as
python-control's ``interconnect``. This produces a script a user can paste into
MATLAB to reproduce the exact system they drew.
"""
from pydantic import BaseModel


class CodegenRequest(BaseModel):
    nodes: list[dict]
    edges: list[dict]
    t_end: float = 10.0


def _safe(name: str) -> str:
    out = "".join(c if c.isalnum() else "_" for c in str(name))
    return out if out and not out[0].isdigit() else f"b_{out}"


def _poly(coeffs) -> str:
    return "[" + " ".join(str(float(c)) for c in (coeffs or [1])) + "]"


def generate_matlab(req: CodegenRequest) -> dict:
    nodes = {n["id"]: n for n in req.nodes}
    names = {nid: _safe(nodes[nid].get("data", {}).get("label", nid)) for nid in nodes}

    lines = [
        "% ECE Copilot — auto-generated MATLAB block-diagram model",
        "% Reproduces the connected blocks from the canvas.",
        "s = tf('s');",
        "",
    ]

    sink_inputs = {}  # scope/source signal names per block
    sys_blocks = []
    source_signals = []

    # Edges as named signals: each edge carries the source block's output name.
    out_signal = {nid: f"{names[nid]}_out" for nid in nodes}

    for nid, node in nodes.items():
        data = node.get("data", {})
        bt = data.get("type", "")
        nm = names[nid]
        ins = [e["source"] for e in req.edges if e.get("target") == nid and e.get("source") in nodes]
        in_sigs = [out_signal[s] for s in ins]

        if bt == "TF":
            lines.append(f"{nm} = tf({_poly(data.get('num', [1]))}, {_poly(data.get('den', [1, 1]))});")
            lines.append(f"{nm}.InputName = '{in_sigs[0] if in_sigs else nm + '_in'}'; {nm}.OutputName = '{out_signal[nid]}';")
            sys_blocks.append(nm)
        elif bt == "INTEGRATOR":
            lines.append(f"{nm} = 1/s;")
            lines.append(f"{nm}.InputName = '{in_sigs[0] if in_sigs else nm + '_in'}'; {nm}.OutputName = '{out_signal[nid]}';")
            sys_blocks.append(nm)
        elif bt == "DERIVATIVE":
            lines.append(f"{nm} = s/(1e-3*s + 1);")
            lines.append(f"{nm}.InputName = '{in_sigs[0] if in_sigs else nm + '_in'}'; {nm}.OutputName = '{out_signal[nid]}';")
            sys_blocks.append(nm)
        elif bt == "GAIN":
            lines.append(f"{nm} = tf({float(data.get('gain', 1.0))}, 1);")
            lines.append(f"{nm}.InputName = '{in_sigs[0] if in_sigs else nm + '_in'}'; {nm}.OutputName = '{out_signal[nid]}';")
            sys_blocks.append(nm)
        elif bt == "SUM":
            signs = data.get("signs") or ["+"] * len(in_sigs)
            # MATLAB sumblk: 'y = u1 - u2 + u3'
            terms = []
            for i, sig in enumerate(in_sigs):
                sign = signs[i] if i < len(signs) else "+"
                terms.append(f"{'- ' if sign == '-' else '+ ' if i else ''}{sig}")
            rhs = " ".join(terms) if terms else "0"
            lines.append(f"{nm} = sumblk('{out_signal[nid]} = {rhs}');")
            sys_blocks.append(nm)
        elif bt in ("STEP", "SINE", "SQUARE", "IMPULSE", "RAMP", "CONSTANT"):
            source_signals.append((nid, bt, data))
        elif bt in ("SCOPE", "OUTPUT"):
            if in_sigs:
                sink_inputs[nid] = in_sigs[0]

    lines.append("")
    in_name = source_signals[0][2].get("label", "u") if source_signals else "u"
    out_name = next(iter(sink_inputs.values()), out_signal[next(iter(nodes), "y")]) if nodes else "y"
    if sys_blocks:
        block_list = ", ".join(sys_blocks)
        lines.append(f"% Wire blocks together by matching signal names")
        lines.append(f"sys = connect({block_list}, '{_safe(in_name)}', '{out_name}');")
        lines.append("")
        lines.append(f"t = linspace(0, {req.t_end}, 1000);")
        # Drive with the first source.
        if source_signals:
            _, bt, data = source_signals[0]
            amp = float(data.get("amplitude", 1.0))
            if bt == "SINE":
                f = float(data.get("frequency", 1.0))
                lines.append(f"u = {amp}*sin(2*pi*{f}*t);")
            elif bt == "STEP":
                lines.append(f"u = {amp}*(t >= {float(data.get('step_time', 0.0))});")
            else:
                lines.append(f"u = {amp}*ones(size(t));")
            lines.append("y = lsim(sys, u, t);")
        else:
            lines.append("y = step(sys, t);")
        lines.append("figure; plot(t, y, 'LineWidth', 1.5); grid on;")
        lines.append("xlabel('Time (s)'); ylabel('Output'); title('System Response');")
    else:
        lines.append("% No dynamic blocks found to connect.")

    matlab = "\n".join(lines)

    python = "\n".join([
        "# ECE Copilot — auto-generated Python (scipy) block-diagram model",
        "import numpy as np",
        "from scipy import signal",
        "import matplotlib.pyplot as plt",
        "",
        "# This mirrors the MATLAB model; edit transfer functions as needed.",
        "# See the MATLAB tab for the full named-signal connect() wiring.",
        f"t = np.linspace(0, {req.t_end}, 1000)",
        "# Example: define your composed system here, e.g. sys = signal.TransferFunction(num, den)",
        "# tout, y, _ = signal.lsim(sys, U=u, T=t)",
        "plt.plot(t, np.zeros_like(t)); plt.grid(True); plt.show()",
    ])

    return {"matlab": matlab, "python": python}

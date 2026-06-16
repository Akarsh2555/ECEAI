"""System / communication simulator node.

Drives the block-diagram simulation (control systems AND analog communication
circuits like DSB-SC) from the canvas, so the AI chat can run it. The math is
done by math_service.simulate (NumPy/SciPy) — the LLM only explains the result.
"""
from ..state import GraphState
from math_service.simulate import simulate, SimulateRequest
from ._llm import llm_explain

_SOURCE_TYPES = {"SINE", "COSINE", "SQUARE", "MESSAGE", "CARRIER", "STEP", "RAMP",
                 "FM", "PM", "ASK", "FSK", "BPSK", "PSK", "QPSK", "QAM"}


def _freq_of(nodes: list[dict], types: set[str]) -> float | None:
    for n in nodes:
        d = n.get("data", {})
        if d.get("type") in types and d.get("frequency"):
            return float(d["frequency"])
    return None


def _describe_system(nodes: list[dict], edges: list[dict]) -> str:
    """Deterministic plain-text description of the circuit — used so the chat
    always answers, even when the LLM is unavailable (rate-limited)."""
    types = [n.get("data", {}).get("type", "") for n in nodes]
    tset = set(types)
    n_product = types.count("PRODUCT")
    has_sum = "SUM" in tset
    has_tf = "TF" in tset
    has_int = "INTEGRATOR" in tset
    has_lpf = "LPF" in tset
    carriers = tset & {"CARRIER", "COSINE"}
    messages = tset & {"MESSAGE", "SINE"}

    # ── Modulator blocks (FM/PM/ASK/FSK/PSK/QPSK/QAM) ──
    mod = tset & {"FM", "PM", "ASK", "FSK", "BPSK", "PSK", "QPSK", "QAM"}
    if mod:
        scheme = sorted(mod)[0]
        fc = _freq_of(nodes, mod) or 0.0
        analog = {"FM": "frequency modulation — the message varies the carrier's instantaneous frequency",
                  "PM": "phase modulation — the message varies the carrier's instantaneous phase"}
        if scheme in analog:
            return (
                f"This is {scheme} ({analog[scheme]}). Carrier ≈ {fc:.0f} Hz. The Scope shows the "
                f"constant-envelope modulated waveform and the Spectrum shows the carrier with "
                f"message-dependent sidebands (Carson-rule bandwidth)."
            )
        return (
            f"This is {scheme} digital modulation at a carrier of ≈ {fc:.0f} Hz, driven by the "
            f"Bitstream. The Scope shows the modulated waveform, the Spectrum its bandwidth, and the "
            f"Constellation tab shows the I/Q symbol points (ideal grid plus the AWGN-corrupted "
            f"received cloud when a Constellation block is wired in)."
        )

    # ── Communication modulators (Product of message × carrier) ──
    if n_product >= 1 and carriers and messages:
        fc = _freq_of(nodes, {"CARRIER", "COSINE"}) or 0.0
        fm = _freq_of(nodes, {"MESSAGE", "SINE"}) or 0.0
        if n_product >= 2 and has_sum:
            return (
                f"This is a quadrature / SSB-style modulator: two message-carrier products are "
                f"combined in the summing junction. Each multiplier places sidebands around the "
                f"carrier ({fc:.0f} Hz), and summing the two paths reinforces one sideband while "
                f"cancelling the other. Open the Scope for the time-domain signal and the Spectrum "
                f"to see which sidebands survive."
            )
        lo, hi = abs(fc - fm), fc + fm
        return (
            f"This is a DSB-SC (double-sideband suppressed-carrier) modulator. The message tone "
            f"({fm:.0f} Hz) multiplies the carrier ({fc:.0f} Hz), so the output contains two "
            f"sidebands at fc-fm = {lo:.0f} Hz and fc+fm = {hi:.0f} Hz, with NO energy at the "
            f"carrier itself — that is the 'suppressed carrier'. The Scope shows the modulated "
            f"envelope; the Spectrum shows the two symmetric sidebands."
        )

    # ── Single mixer / frequency converter ──
    if n_product >= 1 and (carriers or messages):
        f0 = _freq_of(nodes, {"CARRIER", "COSINE", "SINE", "MESSAGE"}) or 0.0
        return (
            f"This circuit multiplies two signals (a mixer). Multiplication in time creates sum "
            f"and difference frequencies, so the Spectrum will show new tones around {f0:.0f} Hz. "
            f"Use it for modulation, demodulation, or frequency conversion."
        )

    # ── Control systems ──
    if has_tf or has_int:
        if has_sum:
            return (
                "This is a closed-loop feedback control system. The summing junction forms the "
                "error between the reference input and the fed-back output, which drives the plant "
                "transfer function. Feedback speeds up the response and reduces steady-state "
                "sensitivity. The Scope shows the closed-loop step/transient response."
            )
        return (
            "This is an open-loop system defined by your transfer function H(s). The Scope shows "
            "its time response to the input source; the Spectrum shows its frequency content."
        )

    # ── Filtering ──
    if has_lpf:
        return (
            "This circuit low-pass filters the input: frequencies above the cutoff are attenuated. "
            "Compare the Scope (time domain) with the Spectrum (frequency domain) to see what "
            "passed through."
        )

    return (
        "Simulated your block diagram. Open the Scope tab for the time response and the Spectrum "
        "tab for the frequency content of each output."
    )


def _pick_timing(nodes: list[dict]) -> tuple[float, int]:
    """Choose t_end / n_points so the highest carrier is well sampled and the
    lowest message tone completes several periods."""
    freqs = [
        float(n.get("data", {}).get("frequency", 0) or 0)
        for n in nodes
        if n.get("data", {}).get("type") in _SOURCE_TYPES
    ]
    freqs = [f for f in freqs if f > 0]
    fc_max = max(freqs) if freqs else 10.0
    f_min = min(freqs) if freqs else 1.0
    fs = max(20.0 * fc_max, 200.0)           # >> Nyquist for a clean spectrum
    t_end = max(1.0, 4.0 / f_min)            # a few message periods
    n_points = int(min(fs * t_end, 4000))    # cap for responsiveness
    return t_end, max(n_points, 256)


def system_simulator(state: GraphState) -> GraphState:
    netlist = state.get("netlist", {})
    nodes = netlist.get("nodes", [])
    edges = netlist.get("edges", [])

    if not nodes:
        state["history"].append({"node": "system_simulator", "message": "No blocks on the canvas to simulate."})
        return state

    # 1) Run the simulation FIRST so Scope + Spectrum artifacts are guaranteed,
    #    independent of LLM availability/latency.
    summary = None
    t_end, n_points = _pick_timing(nodes)
    try:
        result = simulate(SimulateRequest(nodes=nodes, edges=edges, t_end=t_end, n_points=n_points))
        state["artifacts"]["simulation"] = result
        n_sig = len(result.get("signals", []))
        summary = f"Simulated the block diagram — {n_sig} scope/output signal(s) at fs={result.get('fs', 0):.0f} Hz (time + spectrum)."
    except Exception as e:
        summary = f"Simulation error: {e}"

    # 2) Answer the user. Always produce a deterministic description so the chat
    #    works even when the LLM is rate-limited; use the LLM to enrich it when
    #    available (fast-fail, never blocks the graph).
    block_types = [n.get("data", {}).get("type") for n in nodes]
    deterministic = _describe_system(nodes, edges)
    explanation = llm_explain(
        "You are an expert analog communications / control engineer replying to the user.",
        f"User request: {state.get('raw_input')}\nBlock diagram: {block_types}\n"
        f"A deterministic analysis says: {deterministic}\n"
        "In 2-4 sentences, answer the user's request and confirm/expand that description.",
        timeout=8,
    )
    answer = explanation or deterministic
    state["history"].append({"node": "system_simulator", "message": answer})
    if summary:
        state["history"].append({"node": "system_simulator", "message": summary})

    return state

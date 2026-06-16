"""Script generator — creates MATLAB and Python scripts."""
from ..state import GraphState


def script_generator(state: GraphState) -> GraphState:
    artifacts = state.get("artifacts", {})
    signal_data = artifacts.get("signal_data", {})
    filter_coeffs = artifacts.get("filter_coefficients", {})

    b = filter_coeffs.get("b", signal_data.get("b", []))
    a = filter_coeffs.get("a", signal_data.get("a", []))

    # Generate MATLAB script
    matlab_lines = [
        "% ECE Copilot — Auto-generated MATLAB script",
        "% Filter design and analysis",
        "",
        f"b = {b};",
        f"a = {a};",
        "",
        "% Frequency response",
        "[H, w] = freqz(b, a, 1024);",
        "f = w / pi * (Fs / 2);",
        "",
        "% Magnitude plot",
        "figure;",
        "subplot(2, 1, 1);",
        "plot(f, 20*log10(abs(H)));",
        "xlabel('Frequency (Hz)');",
        "ylabel('Magnitude (dB)');",
        "title('Magnitude Response');",
        "grid on;",
        "",
        "% Phase plot",
        "subplot(2, 1, 2);",
        "plot(f, unwrap(angle(H)) * 180 / pi);",
        "xlabel('Frequency (Hz)');",
        "ylabel('Phase (degrees)');",
        "title('Phase Response');",
        "grid on;",
    ]

    # Generate Python script
    python_lines = [
        "# ECE Copilot — Auto-generated Python script",
        "import numpy as np",
        "from scipy import signal",
        "import matplotlib.pyplot as plt",
        "",
        f"b = np.array({b})",
        f"a = np.array({a})",
        "",
        "# Frequency response",
        "w, H = signal.freqz(b, a, worN=1024)",
        "",
        "# Magnitude plot",
        "fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(10, 8))",
        "ax1.plot(w / np.pi, 20 * np.log10(np.abs(H) + 1e-12))",
        "ax1.set_xlabel('Normalized Frequency (×π rad/sample)')",
        "ax1.set_ylabel('Magnitude (dB)')",
        "ax1.set_title('Magnitude Response')",
        "ax1.grid(True)",
        "",
        "# Phase plot",
        "ax2.plot(w / np.pi, np.degrees(np.unwrap(np.angle(H))))",
        "ax2.set_xlabel('Normalized Frequency (×π rad/sample)')",
        "ax2.set_ylabel('Phase (degrees)')",
        "ax2.set_title('Phase Response')",
        "ax2.grid(True)",
        "",
        "plt.tight_layout()",
        "plt.show()",
    ]

    state["artifacts"]["matlab_script"] = "\n".join(matlab_lines)
    state["artifacts"]["python_script"] = "\n".join(python_lines)
    state["history"].append({"node": "script_generator", "message": "Generated MATLAB and Python scripts"})
    return state

"""FFT computation — DETERMINISTIC, no LLM calls."""
from scipy.fft import rfft, rfftfreq
from scipy import signal as sp
import numpy as np
from pydantic import BaseModel
from typing import Literal


class FFTRequest(BaseModel):
    signal: list[float]
    fs: float = 1000.0
    window: Literal["hann", "hamming", "none"] = "hann"


def compute_fft(req: FFTRequest) -> dict:
    x = np.array(req.signal)

    if req.window == "hann":
        x = x * sp.windows.hann(len(x))
    elif req.window == "hamming":
        x = x * sp.windows.hamming(len(x))

    X = rfft(x)
    freqs = rfftfreq(len(req.signal), d=1.0 / req.fs)
    mag_db = 20 * np.log10(np.abs(X) / len(req.signal) + 1e-12)
    phase_deg = np.degrees(np.angle(X))

    return {
        "freqs": freqs.tolist(),
        "magnitudes_db": mag_db.tolist(),
        "phase_deg": phase_deg.tolist(),
    }

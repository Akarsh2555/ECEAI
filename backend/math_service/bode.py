"""Bode plot computation — DETERMINISTIC, no LLM calls."""
from scipy import signal as sp
import numpy as np
from pydantic import BaseModel


class BodeRequest(BaseModel):
    b: list[float]
    a: list[float]
    freq_start: float = 1.0
    freq_end: float = 100000.0
    n_points: int = 1000
    fs: float = 0.0  # 0 = analog (freqs), >0 = digital (freqz)


def compute_bode(req: BodeRequest) -> dict:
    freqs = np.logspace(
        np.log10(req.freq_start), np.log10(req.freq_end), req.n_points
    )

    b = np.array(req.b)
    a = np.array(req.a)

    if req.fs > 0:
        w = 2 * np.pi * freqs / req.fs
        w_out, H = sp.freqz(b, a, worN=w)
        f_out = w_out * req.fs / (2 * np.pi)
    else:
        w_out, H = sp.freqs(b, a, worN=2 * np.pi * freqs)
        f_out = w_out / (2 * np.pi)

    return {
        "freqs_hz": f_out.tolist(),
        "magnitude_db": (20 * np.log10(np.abs(H) + 1e-12)).tolist(),
        "phase_deg": np.degrees(np.unwrap(np.angle(H))).tolist(),
    }

"""IIR/FIR filter design — DETERMINISTIC, no LLM calls."""
from scipy import signal as sp
import numpy as np
from pydantic import BaseModel
from typing import Literal, Optional, Union


class FilterRequest(BaseModel):
    type: Literal["butter", "cheby1", "cheby2", "bessel", "fir"]
    order: int
    cutoff_hz: Union[float, list[float]]
    fs: float
    btype: Literal["low", "high", "band", "stop"] = "low"
    window: str = "hamming"
    ripple_db: Optional[float] = 1.0


def design_filter(req: FilterRequest) -> dict:
    nyq = req.fs / 2
    if isinstance(req.cutoff_hz, list):
        wn = [f / nyq for f in req.cutoff_hz]
    else:
        wn = req.cutoff_hz / nyq

    if req.type == "butter":
        sos = sp.butter(req.order, wn, btype=req.btype, output="sos")
        b, a = sp.butter(req.order, wn, btype=req.btype)
    elif req.type == "cheby1":
        sos = sp.cheby1(req.order, req.ripple_db, wn, btype=req.btype, output="sos")
        b, a = sp.cheby1(req.order, req.ripple_db, wn, btype=req.btype)
    elif req.type == "cheby2":
        sos = sp.cheby2(req.order, req.ripple_db, wn, btype=req.btype, output="sos")
        b, a = sp.cheby2(req.order, req.ripple_db, wn, btype=req.btype)
    elif req.type == "bessel":
        sos = sp.bessel(req.order, wn, btype=req.btype, output="sos", norm="phase")
        b, a = sp.bessel(req.order, wn, btype=req.btype, norm="phase")
    elif req.type == "fir":
        b = sp.firwin(
            req.order + 1, wn, window=req.window, pass_zero=(req.btype == "low")
        )
        a = np.array([1.0])
        sos = sp.tf2sos(b, a)
    else:
        raise ValueError(f"Unknown filter type: {req.type}")

    z, p, k = sp.tf2zpk(b, a)

    return {
        "b": b.tolist(),
        "a": a.tolist() if isinstance(a, np.ndarray) else list(a),
        "sos": sos.tolist(),
        "zpk": {
            "zeros": [complex(x).real if np.isreal(x) else [complex(x).real, complex(x).imag] for x in z],
            "poles": [complex(x).real if np.isreal(x) else [complex(x).real, complex(x).imag] for x in p],
            "gain": float(k),
        },
    }

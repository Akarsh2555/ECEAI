"""Convolution — DETERMINISTIC, no LLM calls."""
import numpy as np
from pydantic import BaseModel


class ConvolutionRequest(BaseModel):
    signal1: list[float]
    signal2: list[float]


def compute_convolution(req: ConvolutionRequest) -> dict:
    result = np.convolve(np.array(req.signal1), np.array(req.signal2))
    return {"result": result.tolist()}

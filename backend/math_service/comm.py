"""Digital & analog modulation DSP — DETERMINISTIC, no LLM.

Provides the symbol mapping, baseband I/Q, constellation reference points and
an AWGN channel for the digital schemes (ASK/OOK, BPSK, QPSK, M-PSK, M-QAM, FSK)
and the helpers the time-domain simulator uses to synthesize passband waveforms.

Everything here is standard textbook DSP — Gray-coded mappings, unit-energy
normalization — not hardcoded per-case tables, so it generalizes across M.
"""
from __future__ import annotations

import numpy as np

_DEFAULT_PATTERN = "1011001010011101"


def parse_bits(pattern, fallback: str = _DEFAULT_PATTERN) -> list[int]:
    bits = [int(c) for c in str(pattern if pattern is not None else "") if c in "01"]
    return bits or [int(c) for c in fallback]


def bits_per_symbol(scheme: str, M: int) -> int:
    s = scheme.upper()
    if s in ("ASK", "OOK", "BPSK", "FSK"):
        return 1
    if s == "QPSK":
        return 2
    # M-PSK / M-QAM
    return max(1, int(round(np.log2(max(2, M)))))


def _gray_pam_map(nbits: int) -> dict[tuple[int, ...], int]:
    """Gray-coded PAM: bit-tuple -> amplitude level in {-(L-1),..,-1,1,..,L-1}."""
    L = 2 ** nbits
    levels = list(range(-(L - 1), L, 2))
    out: dict[tuple[int, ...], int] = {}
    for idx in range(L):
        g = idx ^ (idx >> 1)  # Gray code
        bits = tuple((g >> (nbits - 1 - j)) & 1 for j in range(nbits))
        out[bits] = levels[idx]
    return out


def constellation_ref(scheme: str, M: int) -> list[dict]:
    """Ideal constellation points (normalized to unit average symbol energy)
    with their Gray-coded bit labels."""
    s = scheme.upper()
    pts: list[tuple[float, float, str]] = []

    if s in ("ASK", "OOK"):
        pts = [(0.0, 0.0, "0"), (1.0, 0.0, "1")]
    elif s == "BPSK" or (s == "PSK" and M <= 2):
        pts = [(1.0, 0.0, "0"), (-1.0, 0.0, "1")]
    elif s == "QPSK" or (s == "PSK" and M == 4):
        r = 1.0 / np.sqrt(2)
        for b0 in (0, 1):
            for b1 in (0, 1):
                pts.append(((1 - 2 * b0) * r, (1 - 2 * b1) * r, f"{b0}{b1}"))
    elif s == "PSK":
        k = bits_per_symbol(s, M)
        for m in range(M):
            g = m ^ (m >> 1)
            theta = 2 * np.pi * m / M
            label = format(g, f"0{k}b")
            pts.append((np.cos(theta), np.sin(theta), label))
    elif s == "QAM":
        k = bits_per_symbol(s, M)
        nb = k // 2
        pam = _gray_pam_map(nb)
        # Average energy of the square M-QAM for unit-energy normalization.
        levels = list(pam.values())
        avg_e = np.mean([li * li + lq * lq for li in levels for lq in levels])
        norm = 1.0 / np.sqrt(avg_e)
        for bi, li in pam.items():
            for bq, lq in pam.items():
                label = "".join(map(str, bi)) + "".join(map(str, bq))
                pts.append((li * norm, lq * norm, label))
    elif s == "FSK":
        # FSK is orthogonal in frequency, not amplitude/phase — show the two
        # (binary) tones as orthonormal basis points.
        pts = [(1.0, 0.0, "0"), (0.0, 1.0, "1")]
    else:
        pts = [(1.0, 0.0, "0"), (-1.0, 0.0, "1")]

    return [{"i": float(i), "q": float(q), "bits": b} for (i, q, b) in pts]


def map_symbols(scheme: str, bits: list[int], M: int) -> list[dict]:
    """Map a bit list to a sequence of ideal I/Q symbol points (Gray-coded)."""
    s = scheme.upper()
    k = bits_per_symbol(s, M)
    ref = {p["bits"]: (p["i"], p["q"]) for p in constellation_ref(s, M)}
    syms: list[dict] = []
    nsym = len(bits) // k if k > 0 else 0
    for n in range(nsym):
        chunk = bits[n * k:(n + 1) * k]
        label = "".join(map(str, chunk))
        if label in ref:
            i, q = ref[label]
        else:
            i, q = next(iter(ref.values()))
        syms.append({"i": float(i), "q": float(q), "bits": label})
    return syms


def awgn(points: list[dict], snr_db: float, rng: np.random.Generator | None = None) -> list[dict]:
    """Add complex AWGN at the given SNR (dB) to a list of I/Q points.
    Noise power is set relative to the mean symbol energy of the points."""
    rng = rng or np.random.default_rng(0)
    if not points:
        return []
    es = np.mean([p["i"] ** 2 + p["q"] ** 2 for p in points]) or 1.0
    n0 = es / (10 ** (snr_db / 10.0))
    sigma = np.sqrt(n0 / 2.0)
    out = []
    for p in points:
        out.append({
            "i": float(p["i"] + sigma * rng.standard_normal()),
            "q": float(p["q"] + sigma * rng.standard_normal()),
            "bits": p.get("bits", ""),
        })
    return out


def constellation(scheme: str, bits: list[int], M: int, snr_db: float | None = None) -> dict:
    """Full constellation payload: ideal reference grid, the transmitted symbols,
    and (optionally) the AWGN-corrupted received cloud."""
    s = scheme.upper()
    ref = constellation_ref(s, M)
    symbols = map_symbols(s, bits, M)
    payload = {
        "scheme": s,
        "M": int(M),
        "bits_per_symbol": bits_per_symbol(s, M),
        "ideal": ref,
        "symbols": symbols,
        "noisy": awgn(symbols, snr_db) if snr_db is not None else None,
        "snr_db": snr_db,
        "axes": {"i": "In-phase (I)", "q": "Quadrature (Q)"},
    }
    return payload

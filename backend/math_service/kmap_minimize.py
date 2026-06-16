"""Quine-McCluskey K-map minimization — DETERMINISTIC, no LLM calls."""
from pydantic import BaseModel
from itertools import combinations


class KmapRequest(BaseModel):
    variables: list[str]
    minterms: list[int]
    dont_cares: list[int] = []


def _count_ones(n: int) -> int:
    return bin(n).count("1")


def _diff_bit(a: int, b: int) -> int:
    """Return the position of the single differing bit, or -1 if more than one."""
    diff = a ^ b
    if diff == 0 or (diff & (diff - 1)) != 0:
        return -1
    return diff.bit_length() - 1


def _quine_mccluskey(minterms: list[int], dont_cares: list[int], n_vars: int) -> list[tuple]:
    """Find all prime implicants using the Quine-McCluskey algorithm."""
    all_terms = set(minterms + dont_cares)

    # Group by number of 1s
    groups: dict[int, set[tuple]] = {}
    for m in all_terms:
        ones = _count_ones(m)
        if ones not in groups:
            groups[ones] = set()
        # (minterm_set, binary_representation, dash_positions)
        groups[ones].add((frozenset([m]), m, frozenset()))

    prime_implicants: set[tuple] = set()
    used: set[tuple] = set()

    while groups:
        new_groups: dict[int, set[tuple]] = {}
        all_keys = sorted(groups.keys())
        local_used: set[tuple] = set()

        for i in range(len(all_keys) - 1):
            if all_keys[i] + 1 not in groups:
                continue
            for term1 in groups[all_keys[i]]:
                for term2 in groups[all_keys[i] + 1]:
                    # Check if they differ in exactly one non-dash position
                    if term1[2] != term2[2]:
                        continue
                    bit_pos = _diff_bit(term1[1], term2[1])
                    if bit_pos < 0:
                        continue
                    new_minterms = term1[0] | term2[0]
                    new_val = term1[1] & ~(1 << bit_pos)
                    new_dashes = term1[2] | frozenset([bit_pos])
                    ones = _count_ones(new_val)

                    if ones not in new_groups:
                        new_groups[ones] = set()
                    new_groups[ones].add((new_minterms, new_val, new_dashes))
                    local_used.add(term1)
                    local_used.add(term2)

        # Terms not combined are prime implicants
        for group in groups.values():
            for term in group:
                if term not in local_used:
                    prime_implicants.add(term)

        groups = new_groups

    return list(prime_implicants)


def _implicant_to_expression(implicant: tuple, variables: list[str], n_vars: int) -> str:
    """Convert a prime implicant to a boolean expression string."""
    terms = []
    val = implicant[1]
    dashes = implicant[2]

    for i in range(n_vars - 1, -1, -1):
        if i in dashes:
            continue
        bit = (val >> i) & 1
        var = variables[n_vars - 1 - i]
        terms.append(var if bit else f"{var}'")

    return "".join(terms) if terms else "1"


def minimize_kmap(req: KmapRequest) -> dict:
    n_vars = len(req.variables)
    prime_implicants = _quine_mccluskey(req.minterms, req.dont_cares, n_vars)

    # Convert to SOP expression
    minterm_set = set(req.minterms)
    essential_pis = []

    # Find essential prime implicants
    for m in req.minterms:
        covering = [pi for pi in prime_implicants if m in pi[0]]
        if len(covering) == 1:
            if covering[0] not in essential_pis:
                essential_pis.append(covering[0])

    # Build expression from essential PIs
    expressions = [
        _implicant_to_expression(pi, req.variables, n_vars)
        for pi in (essential_pis if essential_pis else prime_implicants[:5])
    ]

    minimized = " + ".join(expressions) if expressions else "0"
    groups = [list(pi[0]) for pi in essential_pis]

    return {
        "minimized": minimized,
        "groups": groups,
        "prime_implicants_count": len(prime_implicants),
    }

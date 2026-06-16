"""BOM calculator — DETERMINISTIC, no LLM calls."""
from pydantic import BaseModel

# Reference pricing for common ECE components
COMPONENT_DB = {
    "AND": {"type": "IC", "unit_cost": 0.25, "power_mw": 5, "nand_equiv": 1},
    "OR": {"type": "IC", "unit_cost": 0.25, "power_mw": 5, "nand_equiv": 1},
    "NOT": {"type": "IC", "unit_cost": 0.15, "power_mw": 2, "nand_equiv": 1},
    "NAND": {"type": "IC", "unit_cost": 0.20, "power_mw": 4, "nand_equiv": 1},
    "NOR": {"type": "IC", "unit_cost": 0.20, "power_mw": 4, "nand_equiv": 1},
    "XOR": {"type": "IC", "unit_cost": 0.30, "power_mw": 6, "nand_equiv": 4},
    "XNOR": {"type": "IC", "unit_cost": 0.30, "power_mw": 6, "nand_equiv": 5},
    "MUX": {"type": "IC", "unit_cost": 0.50, "power_mw": 10, "nand_equiv": 8},
    "DEMUX": {"type": "IC", "unit_cost": 0.50, "power_mw": 10, "nand_equiv": 8},
    "D": {"type": "IC", "unit_cost": 0.40, "power_mw": 8, "nand_equiv": 6},
    "JK": {"type": "IC", "unit_cost": 0.45, "power_mw": 10, "nand_equiv": 8},
    "SR": {"type": "IC", "unit_cost": 0.35, "power_mw": 6, "nand_equiv": 4},
    "R": {"type": "Passive", "unit_cost": 0.02, "power_mw": 0, "nand_equiv": 0},
    "C": {"type": "Passive", "unit_cost": 0.05, "power_mw": 0, "nand_equiv": 0},
    "L": {"type": "Passive", "unit_cost": 0.15, "power_mw": 0, "nand_equiv": 0},
    "DIODE": {"type": "Semiconductor", "unit_cost": 0.10, "power_mw": 1, "nand_equiv": 0},
    "BJT": {"type": "Semiconductor", "unit_cost": 0.20, "power_mw": 50, "nand_equiv": 0},
    "MOSFET": {"type": "Semiconductor", "unit_cost": 0.30, "power_mw": 30, "nand_equiv": 0},
    "OPAMP": {"type": "IC", "unit_cost": 0.75, "power_mw": 20, "nand_equiv": 0},
    "AC_SOURCE": {"type": "Power", "unit_cost": 2.50, "power_mw": 0, "nand_equiv": 0},
    "DC_SOURCE": {"type": "Power", "unit_cost": 1.50, "power_mw": 0, "nand_equiv": 0},
    "GROUND": {"type": "Passive", "unit_cost": 0.00, "power_mw": 0, "nand_equiv": 0},
}


class BomRequest(BaseModel):
    components: list[dict]  # [{type: "AND", label: "U1", value: ""}]


def compute_bom(req: BomRequest) -> dict:
    # Count components by type
    counts: dict[str, list[dict]] = {}
    for comp in req.components:
        ctype = comp.get("type", "").upper()
        if ctype not in counts:
            counts[ctype] = []
        counts[ctype].append(comp)

    entries = []
    total_cost = 0.0
    total_power = 0.0
    total_nand = 0

    for ctype, comps in counts.items():
        ref = COMPONENT_DB.get(ctype, {"type": "Unknown", "unit_cost": 0.50, "power_mw": 5, "nand_equiv": 1})
        qty = len(comps)
        entry = {
            "component": comps[0].get("label", ctype),
            "type": ref["type"],
            "value": comps[0].get("value", ctype),
            "quantity": qty,
            "unitCost": ref["unit_cost"],
            "totalCost": ref["unit_cost"] * qty,
            "powerDissipation": ref["power_mw"] * qty,
            "nandEquivalent": ref["nand_equiv"] * qty,
        }
        entries.append(entry)
        total_cost += entry["totalCost"]
        total_power += entry["powerDissipation"]
        total_nand += entry["nandEquivalent"]

    return {
        "entries": entries,
        "totalCost": round(total_cost, 2),
        "totalPower": round(total_power, 1),
        "totalNandEquivalent": total_nand,
    }

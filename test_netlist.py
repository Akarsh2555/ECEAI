import json
import sys
sys.path.append("backend")
from math_service.netlist_eval import _simulate_sequential

nodes = [
    {"id": "in1", "type": "input", "data": {"type": "INPUT", "label": "IN"}},
    {"id": "clk1", "type": "input", "data": {"type": "CLOCK", "label": "CLK"}},
    {"id": "ff1", "type": "flipflop", "data": {"type": "D", "label": "FF1"}},
    {"id": "ff2", "type": "flipflop", "data": {"type": "D", "label": "FF2"}},
    {"id": "ff3", "type": "flipflop", "data": {"type": "D", "label": "FF3"}}
]

edges = [
    {"source": "in1", "target": "ff1", "sourceHandle": "out", "targetHandle": "d"},
    {"source": "ff2", "target": "ff2", "sourceHandle": "q_bar", "targetHandle": "d"},
    {"source": "ff3", "target": "ff3", "sourceHandle": "q_bar", "targetHandle": "d"},
    
    {"source": "clk1", "target": "ff1", "sourceHandle": "out", "targetHandle": "clk"},
    {"source": "ff1", "target": "ff2", "sourceHandle": "q", "targetHandle": "clk"},
    {"source": "ff2", "target": "ff3", "sourceHandle": "q", "targetHandle": "clk"}
]

res = _simulate_sequential(nodes, edges, cycles=8)
for sig in res["signals"]:
    print(f"{sig['name']:<10}: {sig['values']}")

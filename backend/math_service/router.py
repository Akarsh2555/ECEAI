from fastapi import APIRouter
from .truth_table import TruthTableRequest, generate_truth_table
from .kmap_minimize import KmapRequest, minimize_kmap
from .fft import FFTRequest, compute_fft
from .filter_design import FilterRequest, design_filter
from .bode import BodeRequest, compute_bode
from .convolution import ConvolutionRequest, compute_convolution
from .bom import BomRequest, compute_bom
from .simulate import SimulateRequest, simulate
from .matlab_codegen import CodegenRequest, generate_matlab
from .netlist_eval import NetlistRequest, analyze_digital
from .ac_analysis import ACRequest, analyze_ac
import asyncio

router = APIRouter()


@router.post("/truth_table")
async def truth_table_endpoint(req: TruthTableRequest):
    return await asyncio.to_thread(generate_truth_table, req)


@router.post("/kmap_minimize")
async def kmap_minimize_endpoint(req: KmapRequest):
    return await asyncio.to_thread(minimize_kmap, req)


@router.post("/fft")
async def fft_endpoint(req: FFTRequest):
    return await asyncio.to_thread(compute_fft, req)


@router.post("/filter_design")
async def filter_design_endpoint(req: FilterRequest):
    return await asyncio.to_thread(design_filter, req)


@router.post("/bode")
async def bode_endpoint(req: BodeRequest):
    return await asyncio.to_thread(compute_bode, req)


@router.post("/convolution")
async def convolution_endpoint(req: ConvolutionRequest):
    return await asyncio.to_thread(compute_convolution, req)


@router.post("/bom")
async def bom_endpoint(req: BomRequest):
    return await asyncio.to_thread(compute_bom, req)


@router.post("/simulate")
async def simulate_endpoint(req: SimulateRequest):
    return await asyncio.to_thread(simulate, req)


@router.post("/generate_matlab")
async def generate_matlab_endpoint(req: CodegenRequest):
    return await asyncio.to_thread(generate_matlab, req)


@router.post("/digital_analyze")
async def digital_analyze_endpoint(req: NetlistRequest):
    return await asyncio.to_thread(analyze_digital, req)


@router.post("/ac_analysis")
async def ac_analysis_endpoint(req: ACRequest):
    return await asyncio.to_thread(analyze_ac, req)

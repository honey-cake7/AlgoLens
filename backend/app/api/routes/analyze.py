from typing import Annotated

from fastapi import APIRouter, Depends

from app.schemas.analysis import AnalyzeRequest, AnalyzeResponse
from app.services.analysis_service import AnalysisService, get_analysis_service

router = APIRouter()


@router.post("/analyze", response_model=AnalyzeResponse, tags=["analysis"])
async def analyze(
    request: AnalyzeRequest,
    service: Annotated[AnalysisService, Depends(get_analysis_service)],
) -> AnalyzeResponse:
    """Validate input, delegate analysis, and return a validated response."""
    return await service.analyze(request)

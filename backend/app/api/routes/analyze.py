from typing import Annotated

from fastapi import APIRouter, Depends

from app.schemas.analysis import AnalyzeRequest, AnalyzeResponse
from app.schemas.algorithmic import AlgorithmicAssessment
from app.services.algorithmic_service import assess_statement
from app.services.analysis_service import AnalysisService, get_analysis_service

router = APIRouter()


@router.post("/analyze", response_model=AnalyzeResponse, tags=["analysis"])
async def analyze(
    request: AnalyzeRequest,
    service: Annotated[AnalysisService, Depends(get_analysis_service)],
) -> AnalyzeResponse:
    """Validate input, delegate analysis, and return a validated response."""
    return await service.analyze(request)


@router.post("/assess", response_model=AlgorithmicAssessment, tags=["deterministic analysis"])
def assess(request: AnalyzeRequest) -> AlgorithmicAssessment:
    """No provider/configuration dependency: always offline, including Groq failures."""
    return assess_statement(request.statement)

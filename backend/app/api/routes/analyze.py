from fastapi import APIRouter

from app.schemas.analysis import AnalyzeRequest, AnalyzeResponse
from app.services.analysis_service import analyze_problem

router = APIRouter()


@router.post("/analyze", response_model=AnalyzeResponse, tags=["analysis"])
def analyze(request: AnalyzeRequest) -> AnalyzeResponse:
    """Validate a statement and return explicitly labeled, fixed demo data."""
    return analyze_problem(request)

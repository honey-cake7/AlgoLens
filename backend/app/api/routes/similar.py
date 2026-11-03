from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.schemas.retrieval import SimilarRequest, SimilarResponse
from app.services.similar_problem_service import SimilarProblemService, get_similar_service

router = APIRouter()


@router.post("/similar", response_model=SimilarResponse, tags=["retrieval"])
def similar(request: SimilarRequest, service: Annotated[SimilarProblemService, Depends(get_similar_service)]) -> SimilarResponse:
    """CPU work runs in FastAPI's worker pool, without any LLM dependency."""
    try:
        return service.search(request.statement, request.k)
    except Exception:
        raise HTTPException(status_code=503, detail={"code": "retrieval_unavailable", "message": "Local practice search is unavailable. Check the retrieval settings and catalog."}) from None

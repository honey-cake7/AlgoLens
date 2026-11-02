from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.router import api_router
from app.core.config import get_cors_origins
from app.core.errors import AnalysisError


async def analysis_error_handler(_request: Request, error: AnalysisError) -> JSONResponse:
    return JSONResponse(
        status_code=error.status_code,
        content={"detail": {"code": error.code, "message": error.message}},
    )


def create_app() -> FastAPI:
    application = FastAPI(title="AlgoLens AI API", version="0.1.0")
    application.add_exception_handler(AnalysisError, analysis_error_handler)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=get_cors_origins(),
        allow_methods=["GET", "POST"],
        allow_headers=["Accept", "Content-Type"],
    )
    application.include_router(api_router)
    return application


app = create_app()

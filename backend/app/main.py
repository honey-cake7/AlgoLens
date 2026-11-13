from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.router import api_router
from app.core.config import get_cors_origins
from app.core.errors import AnalysisError
from app.core.observability import RequestLogMiddleware, configure_logging
from app.core.security import BodySizeLimitMiddleware, SecurityHeadersMiddleware


async def analysis_error_handler(_request: Request, error: AnalysisError) -> JSONResponse:
    return JSONResponse(
        status_code=error.status_code,
        content={"detail": {"code": error.code, "message": error.message}},
    )


async def unexpected_error_handler(_request: Request, _error: Exception) -> JSONResponse:
    # Any unhandled failure gets the same fixed JSON shape; no traceback or
    # exception text reaches the client.
    error = AnalysisError("internal_error")
    return JSONResponse(status_code=error.status_code, content={"detail": {"code": error.code, "message": error.message}})


def create_app() -> FastAPI:
    configure_logging()
    application = FastAPI(title="AlgoLens AI API", version="0.1.0")
    application.add_exception_handler(AnalysisError, analysis_error_handler)
    application.add_exception_handler(Exception, unexpected_error_handler)
    # Starlette runs the last-added middleware first. CORS stays outermost so
    # browsers can read 413/500 JSON errors from the inner layers.
    application.add_middleware(SecurityHeadersMiddleware)
    application.add_middleware(BodySizeLimitMiddleware)
    application.add_middleware(RequestLogMiddleware)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=get_cors_origins(),
        allow_methods=["GET", "POST"],
        allow_headers=["Accept", "Content-Type"],
    )
    application.include_router(api_router)
    return application


app = create_app()

from fastapi import APIRouter

from app.api.routes.analyze import router as analyze_router
from app.api.routes.health import router as health_router
from app.api.routes.similar import router as similar_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health_router)
api_router.include_router(analyze_router)
api_router.include_router(similar_router)

"""Aggregate all route modules into a single APIRouter."""

from fastapi import APIRouter

from app.api.health import router as health_router
from app.api.auth_routes import router as auth_router
from app.api.admin import router as admin_router
from app.api.tx import router as tx_router
from app.api.analytics import router as analytics_router
from app.api.certificate import router as cert_router
from app.api.metadata import router as metadata_router
from app.api.polls import router as polls_router
from app.api.sessions import router as sessions_router
from app.api.certs import router as certs_router
from app.api.faculty import router as faculty_router

router = APIRouter()

# ── Public / shared ──────────────────────────────────────
router.include_router(health_router, tags=["health"])
router.include_router(auth_router, prefix="/auth", tags=["auth"])
router.include_router(metadata_router, prefix="/metadata", tags=["metadata"])

# ── List views (Indexer/BFF-cache backed, all roles) ─────
router.include_router(polls_router, prefix="/polls", tags=["polls"])
router.include_router(sessions_router, prefix="/attendance/sessions", tags=["attendance"])
router.include_router(certs_router, prefix="/certs", tags=["certificates"])
router.include_router(cert_router, prefix="/cert", tags=["certificate-verify"])

# ── Role-restricted write endpoints ──────────────────────
router.include_router(faculty_router, prefix="/faculty", tags=["faculty"])
router.include_router(admin_router, prefix="/admin", tags=["admin"])

# ── Utility ──────────────────────────────────────────────
router.include_router(tx_router, prefix="/tx", tags=["tx"])
router.include_router(analytics_router, prefix="/analytics", tags=["analytics"])

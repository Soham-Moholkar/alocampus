"""Aggregate all route modules into a single APIRouter."""

from fastapi import APIRouter

from app.api.activity import router as activity_router
from app.api.announcements import router as announcements_router
from app.api.admin import router as admin_router
from app.api.ai import router as ai_router
from app.api.analytics import router as analytics_router
from app.api.attendance_records import router as attendance_records_router
from app.api.auth_routes import router as auth_router
from app.api.certificate import router as cert_router
from app.api.certs import router as certs_router
from app.api.coordination import router as coordination_router
from app.api.faculty import router as faculty_router
from app.api.feedback import router as feedback_router
from app.api.health import router as health_router
from app.api.me import router as me_router
from app.api.metadata import router as metadata_router
from app.api.polls import router as polls_router
from app.api.profile import router as profile_router
from app.api.sessions import router as sessions_router
from app.api.system import router as system_router
from app.api.tx import router as tx_router

router = APIRouter()

# Public/shared
router.include_router(health_router, tags=["health"])
router.include_router(system_router, prefix="/system", tags=["system"])
router.include_router(auth_router, prefix="/auth", tags=["auth"])
router.include_router(me_router, tags=["auth"])
router.include_router(metadata_router, prefix="/metadata", tags=["metadata"])
router.include_router(profile_router, prefix="/profile", tags=["profile"])

# List views
router.include_router(polls_router, prefix="/polls", tags=["polls"])
router.include_router(sessions_router, prefix="/attendance/sessions", tags=["attendance"])
router.include_router(attendance_records_router, prefix="/attendance/records", tags=["attendance-records"])
router.include_router(certs_router, prefix="/certs", tags=["certificates"])
router.include_router(cert_router, prefix="/cert", tags=["certificate-verify"])
router.include_router(activity_router, prefix="/activity", tags=["activity"])
router.include_router(announcements_router, prefix="/announcements", tags=["announcements"])

# Role-restricted and write flows
router.include_router(faculty_router, prefix="/faculty", tags=["faculty"])
router.include_router(admin_router, prefix="/admin", tags=["admin"])
router.include_router(feedback_router, prefix="/feedback", tags=["feedback"])
router.include_router(coordination_router, prefix="/coordination", tags=["coordination"])
router.include_router(ai_router, tags=["ai"])

# Utility
router.include_router(tx_router, prefix="/tx", tags=["tx"])
router.include_router(analytics_router, prefix="/analytics", tags=["analytics"])

"""Domain / API models (Pydantic v2)."""

from __future__ import annotations

from enum import Enum
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class Role(str, Enum):
    ADMIN = "admin"
    FACULTY = "faculty"
    STUDENT = "student"


# Auth
class NonceRequest(BaseModel):
    address: str = Field(..., min_length=58, max_length=58)


class NonceResponse(BaseModel):
    nonce: str


class VerifyRequest(BaseModel):
    address: str = Field(..., min_length=58, max_length=58)
    nonce: str
    signature: str


class TokenResponse(BaseModel):
    jwt: str


class MeResponse(BaseModel):
    address: str
    role: str


# Admin
class SetRoleRequest(BaseModel):
    address: str = Field(..., min_length=58, max_length=58)
    role: Role


class SetRoleResponse(BaseModel):
    ok: bool
    message: str


# Transaction tracking
class TrackTxRequest(BaseModel):
    tx_id: str = Field(..., min_length=52, max_length=52)
    kind: str = Field(..., pattern=r"^(vote|checkin|cert|deposit|feedback|coordination|ai|other)$")
    session_id: int | None = Field(default=None, ge=0)
    course_code: str | None = Field(default=None, min_length=1, max_length=64)
    student_address: str | None = Field(default=None, min_length=58, max_length=58)


class TxStatus(BaseModel):
    tx_id: str
    kind: str
    status: str
    confirmed_round: Optional[int] = None


# Analytics
class AnalyticsSummary(BaseModel):
    total_polls: int = 0
    total_votes: int = 0
    total_sessions: int = 0
    total_checkins: int = 0
    total_certs: int = 0


# Polls
class CreatePollRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=500)
    options: list[str] = Field(..., min_length=2, max_length=10)
    start_round: int = Field(..., ge=0)
    end_round: int = Field(..., ge=1)


class PollResponse(BaseModel):
    poll_id: int
    question: str
    options: list[str]
    start_round: int
    end_round: int
    creator: str
    app_id: int
    tx_id: Optional[str] = None
    created: Optional[float] = None


class PollListResponse(BaseModel):
    polls: list[PollResponse]
    count: int


# Sessions
class CreateSessionRequest(BaseModel):
    course_code: str = Field(..., min_length=1, max_length=50)
    session_ts: int = Field(..., ge=0)
    open_round: int = Field(..., ge=0)
    close_round: int = Field(..., ge=1)


class SessionResponse(BaseModel):
    session_id: int
    course_code: str
    session_ts: int
    open_round: int
    close_round: int
    creator: str
    app_id: int
    tx_id: Optional[str] = None
    created: Optional[float] = None


class SessionListResponse(BaseModel):
    sessions: list[SessionResponse]
    count: int


# Certificates
class IssueCertRequest(BaseModel):
    recipient_address: str = Field(..., min_length=58, max_length=58)
    recipient_name: str = Field(..., min_length=1, max_length=200)
    course_code: str = Field(..., min_length=1, max_length=50)
    title: str = Field(..., min_length=1, max_length=200)
    description: str = ""


class IssueCertResponse(BaseModel):
    cert_hash: str
    asset_id: int
    metadata_url: str
    tx_id: str


class CertListItem(BaseModel):
    cert_hash: str
    recipient: str
    asset_id: Optional[int] = None
    created: Optional[float] = None


class CertListResponse(BaseModel):
    certs: list[CertListItem]
    count: int


class CertVerifyResponse(BaseModel):
    valid: bool
    cert_hash: str
    recipient: Optional[str] = None
    asset_id: Optional[int] = None
    issued_ts: Optional[int] = None
    metadata_url: Optional[str] = None
    message: str = ""


class ARC3Metadata(BaseModel):
    name: str
    description: str
    image: str = ""
    properties: dict = Field(default_factory=dict)


# Profiles
class UserProfileResponse(BaseModel):
    address: str
    display_name: str | None = None
    avatar_url: str | None = None
    avatar_hash: str | None = None
    avatar_anchor_tx_id: str | None = None
    updated: float | None = None


class AvatarUploadResponse(BaseModel):
    ok: bool
    message: str
    profile: UserProfileResponse


# Activity
class ActivityItem(BaseModel):
    id: str
    kind: str
    title: str
    description: str = ""
    actor: str | None = None
    tx_id: str | None = None
    created: float
    tags: list[str] = Field(default_factory=list)


class ActivityListResponse(BaseModel):
    items: list[ActivityItem]
    count: int


# System health
class SystemHealthComponent(BaseModel):
    status: Literal["ok", "degraded", "error"]
    detail: str = ""


class SystemHealthResponse(BaseModel):
    status: Literal["ok", "degraded", "error"]
    service: str = "algocampus-bff"
    backend: str
    bff: SystemHealthComponent
    db: SystemHealthComponent
    algod: SystemHealthComponent
    indexer: SystemHealthComponent
    kmd: SystemHealthComponent


# Feedback
class FeedbackCommitRequest(BaseModel):
    feedback_hash: str = Field(..., min_length=64, max_length=128)
    course_code: str = Field(default="", max_length=64)
    tx_id: str | None = Field(default=None, min_length=52, max_length=52)
    metadata: dict[str, Any] = Field(default_factory=dict)


class FeedbackCommitResponse(BaseModel):
    ok: bool
    id: str
    message: str


class FeedbackAggregateResponse(BaseModel):
    total_commits: int
    unique_authors: int
    recent: list[dict[str, Any]] = Field(default_factory=list)


# Coordination
class CoordinationTaskCreateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(default="", max_length=2000)


class CoordinationTaskResponse(BaseModel):
    task_id: str
    title: str
    description: str
    owner: str
    status: str
    payload_hash: str | None = None
    anchor_tx_id: str | None = None
    created: float
    updated: float


class CoordinationTaskListResponse(BaseModel):
    tasks: list[CoordinationTaskResponse]
    count: int


class CoordinationAnchorRequest(BaseModel):
    payload: dict[str, Any] = Field(default_factory=dict)


class CoordinationVerifyResponse(BaseModel):
    task_id: str
    verified: bool
    payload_hash: str | None = None
    anchor_tx_id: str | None = None
    message: str = ""


# AI
class AiRiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class AiExecutionMode(str, Enum):
    AUTO = "auto"
    APPROVAL_REQUIRED = "approval_required"


class AiActionType(str, Enum):
    FACULTY_POLL = "faculty_poll_plan"
    FACULTY_SESSION = "faculty_session_plan"
    FACULTY_CERT = "faculty_certificate_plan"
    ADMIN_ROLE_RISK = "admin_role_risk_plan"
    ADMIN_SYSTEM = "admin_system_remediation_plan"
    COORD_TASK = "coordination_task_plan"


class AiPlanRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=5000)
    context: dict[str, Any] = Field(default_factory=dict)
    auto_execute: bool = False


class AiPlanResponse(BaseModel):
    intent_id: str
    intent_hash: str
    action_type: AiActionType
    risk_level: AiRiskLevel
    execution_mode: AiExecutionMode
    plan: dict[str, Any] = Field(default_factory=dict)
    message: str = ""


class AiExecuteResponse(BaseModel):
    intent_id: str
    status: str
    risk_level: AiRiskLevel
    execution_mode: AiExecutionMode
    tx_id: str | None = None
    confirmed_round: int | None = None
    message: str = ""


# Announcements + poll context
class AnnouncementCreateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    body: str = Field(..., min_length=1, max_length=4000)
    poll_id: int | None = Field(default=None, ge=0)
    category: str = Field(default="general", min_length=1, max_length=64)
    audience: str = Field(default="all", min_length=1, max_length=32)
    is_pinned: bool = False


class AnnouncementUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    body: str | None = Field(default=None, min_length=1, max_length=4000)
    category: str | None = Field(default=None, min_length=1, max_length=64)
    audience: str | None = Field(default=None, min_length=1, max_length=32)
    is_pinned: bool | None = None


class AnnouncementResponse(BaseModel):
    id: str
    title: str
    body: str
    poll_id: int | None = None
    category: str
    audience: str
    author_address: str
    author_role: str
    is_pinned: bool = False
    hash: str
    anchor_tx_id: str | None = None
    created: float
    updated: float


class AnnouncementListResponse(BaseModel):
    items: list[AnnouncementResponse]
    count: int


class PollContextUpdateRequest(BaseModel):
    purpose: str = Field(..., min_length=1, max_length=1500)
    audience: str = Field(..., min_length=1, max_length=64)
    category: str = Field(..., min_length=1, max_length=64)
    extra_note: str = Field(default="", max_length=2000)


class PollContextResponse(BaseModel):
    poll_id: int
    purpose: str
    audience: str
    category: str
    extra_note: str
    updated_by: str
    hash: str
    anchor_tx_id: str | None = None
    updated: float


# Attendance records
class AttendanceRecordResponse(BaseModel):
    id: str
    session_id: int
    course_code: str
    student_address: str
    status: str
    tx_id: str | None = None
    anchor_tx_id: str | None = None
    attended_at: float
    created: float


class AttendanceRecordListResponse(BaseModel):
    records: list[AttendanceRecordResponse]
    count: int


class AttendanceRecordStatusUpdateRequest(BaseModel):
    status: str = Field(..., pattern=r"^(present|absent|late|excused)$")

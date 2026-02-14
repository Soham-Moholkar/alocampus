"""Domain / API models (Pydantic v2)."""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# ── Roles ────────────────────────────────────────────────

class Role(str, Enum):
    ADMIN = "admin"
    FACULTY = "faculty"
    STUDENT = "student"


# ── Auth ─────────────────────────────────────────────────

class NonceRequest(BaseModel):
    address: str = Field(..., min_length=58, max_length=58)


class NonceResponse(BaseModel):
    nonce: str


class VerifyRequest(BaseModel):
    address: str = Field(..., min_length=58, max_length=58)
    nonce: str
    signature: str  # base64-encoded ed25519 sig


class TokenResponse(BaseModel):
    jwt: str


class MeResponse(BaseModel):
    address: str
    role: str


# ── Admin ────────────────────────────────────────────────

class SetRoleRequest(BaseModel):
    address: str = Field(..., min_length=58, max_length=58)
    role: Role


class SetRoleResponse(BaseModel):
    ok: bool
    message: str


# ── Transaction tracking ─────────────────────────────────

class TrackTxRequest(BaseModel):
    tx_id: str = Field(..., min_length=52, max_length=52)
    kind: str = Field(..., pattern=r"^(vote|checkin|cert|deposit|other)$")


class TxStatus(BaseModel):
    tx_id: str
    kind: str
    status: str  # pending | confirmed | failed
    confirmed_round: Optional[int] = None


# ── Analytics ────────────────────────────────────────────

class AnalyticsSummary(BaseModel):
    total_polls: int = 0
    total_votes: int = 0
    total_sessions: int = 0
    total_checkins: int = 0
    total_certs: int = 0


# ── Polls ────────────────────────────────────────────────

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


# ── Attendance sessions ──────────────────────────────────

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


# ── Certificate issuance ─────────────────────────────────

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


# ── Metadata (ARC-3) ────────────────────────────────────

class ARC3Metadata(BaseModel):
    """Minimal ARC-3 compatible metadata served locally."""
    name: str
    description: str
    image: str = ""
    properties: dict = Field(default_factory=dict)

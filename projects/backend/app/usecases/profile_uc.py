"""Profile use-cases: load/upload/remove avatar with on-chain hash anchor."""

from __future__ import annotations

import hashlib
import os
import time
from pathlib import Path

from app.domain.models import AvatarUploadResponse, UserProfileResponse
from app.infra.algorand.chain import anchor_note_on_chain
from app.infra.db.models import clear_user_avatar, get_user_profile, upsert_user_profile
from app.usecases import activity_uc

_MAX_AVATAR_BYTES = 3 * 1024 * 1024
_ALLOWED_EXT = {".png", ".jpg", ".jpeg", ".webp"}


def _uploads_root() -> Path:
    base = Path(".data/uploads/avatars")
    base.mkdir(parents=True, exist_ok=True)
    return base


def _avatar_url_from_path(path: str | None) -> str | None:
    if not path:
        return None
    name = Path(path).name
    return f"/profile/avatar/{name}"


async def get_me(address: str) -> UserProfileResponse:
    row = await get_user_profile(address)
    if not row:
        return UserProfileResponse(address=address)
    return UserProfileResponse(
        address=address,
        display_name=row.get("display_name"),
        avatar_url=_avatar_url_from_path(row.get("avatar_path")),
        avatar_hash=row.get("avatar_hash"),
        avatar_anchor_tx_id=row.get("avatar_anchor_tx_id"),
        updated=float(row.get("updated") or 0),
    )


async def save_avatar(address: str, filename: str, content: bytes) -> AvatarUploadResponse:
    ext = Path(filename).suffix.lower()
    if ext not in _ALLOWED_EXT:
        raise ValueError("Unsupported avatar file type")
    if len(content) == 0:
        raise ValueError("Avatar file is empty")
    if len(content) > _MAX_AVATAR_BYTES:
        raise ValueError("Avatar must be <= 3MB")

    digest = hashlib.sha256(content).hexdigest()
    ts = int(time.time())
    stored_name = f"{address}-{ts}{ext}"
    full_path = _uploads_root() / stored_name
    full_path.write_bytes(content)

    note = f"profile:{address}:{digest}:{ts}".encode()
    anchor_tx_id = anchor_note_on_chain(note)

    await upsert_user_profile(
        address=address,
        avatar_path=str(full_path),
        avatar_hash=digest,
        avatar_anchor_tx_id=anchor_tx_id,
    )

    await activity_uc.log_event(
        kind="profile_avatar_updated",
        title="Profile avatar updated",
        description=f"hash={digest[:12]}...",
        actor=address,
        tx_id=anchor_tx_id,
        tags=["profile", f"profile:{address}"],
    )

    profile = await get_me(address)
    return AvatarUploadResponse(ok=True, message="avatar updated", profile=profile)


async def remove_avatar(address: str) -> UserProfileResponse:
    row = await get_user_profile(address)
    if row and row.get("avatar_path"):
        try:
            os.remove(str(row["avatar_path"]))
        except OSError:
            pass

    await clear_user_avatar(address)

    await activity_uc.log_event(
        kind="profile_avatar_removed",
        title="Profile avatar removed",
        actor=address,
        tags=["profile", f"profile:{address}"],
    )
    return await get_me(address)


def avatar_file_path(filename: str) -> Path:
    safe = Path(filename).name
    path = _uploads_root() / safe
    if not path.exists():
        raise FileNotFoundError(safe)
    return path

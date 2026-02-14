"""Profile routes for avatar and identity metadata."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse

from app.auth import TokenPayload, get_current_user
from app.domain.models import AvatarUploadResponse, UserProfileResponse
from app.usecases import profile_uc

router = APIRouter()


@router.get("/me", response_model=UserProfileResponse)
async def get_me_profile(user: Annotated[TokenPayload, Depends(get_current_user)]) -> UserProfileResponse:
    return await profile_uc.get_me(user.address)


@router.post("/avatar", response_model=AvatarUploadResponse)
async def upload_avatar(
    user: Annotated[TokenPayload, Depends(get_current_user)],
    file: UploadFile = File(...),
) -> AvatarUploadResponse:
    try:
        payload = await file.read()
        return await profile_uc.save_avatar(user.address, file.filename or "avatar.png", payload)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


@router.delete("/avatar", response_model=UserProfileResponse)
async def delete_avatar(user: Annotated[TokenPayload, Depends(get_current_user)]) -> UserProfileResponse:
    return await profile_uc.remove_avatar(user.address)


@router.get("/avatar/{filename}")
async def get_avatar_file(filename: str) -> FileResponse:
    try:
        path = profile_uc.avatar_file_path(filename)
    except FileNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "avatar not found")
    return FileResponse(path)

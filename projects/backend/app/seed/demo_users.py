"""Idempotent seed for local demo credential users."""

from __future__ import annotations

from dataclasses import dataclass
import logging

import bcrypt

from app.infra.db import models as db

logger = logging.getLogger(__name__)

DEFAULT_DEMO_PASSWORD = "AlgoCampus@123"


@dataclass(frozen=True)
class SeedUser:
    id: str
    role: str
    username: str
    display_name: str
    identifier: str


def _seed_catalog() -> list[SeedUser]:
    users: list[SeedUser] = [
        SeedUser(
            id="demo-admin-001",
            role="admin",
            username="admin01",
            display_name="Ops Admin",
            identifier="ADM-0001",
        )
    ]

    faculty_names = [
        ("faculty01", "Dr. Priya Mentor", "FAC-0001"),
        ("faculty02", "Dr. Rowan Faculty", "FAC-0002"),
        ("faculty03", "Prof. Gayatri Asalkar", "FAC-0003"),
        ("faculty04", "Prof. Mandar Diwakar", "FAC-0004"),
        ("faculty05", "Prof. Keshav Tambre", "FAC-0005"),
    ]
    for idx, (username, display_name, identifier) in enumerate(faculty_names, start=1):
        users.append(
            SeedUser(
                id=f"demo-faculty-{idx:03d}",
                role="faculty",
                username=username,
                display_name=display_name,
                identifier=identifier,
            )
        )

    for idx in range(1, 31):
        users.append(
            SeedUser(
                id=f"demo-student-{idx:03d}",
                role="student",
                username=f"student{idx:02d}",
                display_name=f"Student {idx:02d}",
                identifier=f"STU-{1000 + idx}",
            )
        )
    return users


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


async def seed_demo_users() -> None:
    catalog = _seed_catalog()
    created = 0
    for user in catalog:
        existing = await db.get_demo_user(user.role, user.username)
        if existing and existing.get("password_hash"):
            password_hash = str(existing["password_hash"])
        else:
            password_hash = _hash_password(DEFAULT_DEMO_PASSWORD)
            created += 1

        await db.upsert_demo_user(
            user_id=user.id,
            role=user.role,
            username=user.username,
            password_hash=password_hash,
            display_name=user.display_name,
            identifier=user.identifier,
            is_active=True,
        )
    logger.info("Demo users ensured: %d total (%d newly hashed)", len(catalog), created)


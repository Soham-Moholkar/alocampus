"""Application settings loaded from environment / .env file."""

from __future__ import annotations

from pathlib import Path
from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── Algorand LocalNet ────────────────────────────────
    algod_server: str = "http://localhost"
    algod_port: int = 4001
    algod_token: str = "a" * 64

    indexer_server: str = "http://localhost"
    indexer_port: int = 8980
    indexer_token: str = "a" * 64

    kmd_server: str = "http://localhost"
    kmd_port: int = 4002
    kmd_token: str = "a" * 64

    # ── JWT ──────────────────────────────────────────────
    jwt_secret: str = "algocampus-local-dev-secret-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60

    # ── Paths ────────────────────────────────────────────
    app_manifest_path: str = "../contracts/smart_contracts/artifacts/app_manifest.json"
    db_path: str = ".data/algocampus.db"

    # ── BFF base URL (for local metadata serving) ────────
    bff_base_url: str = "http://localhost:8000"

    model_config = {"env_file": ".env.localnet", "env_file_encoding": "utf-8"}

    # Convenience helpers ─────────────────────────────────
    @property
    def algod_url(self) -> str:
        return f"{self.algod_server}:{self.algod_port}"

    @property
    def indexer_url(self) -> str:
        return f"{self.indexer_server}:{self.indexer_port}"

    @property
    def kmd_url(self) -> str:
        return f"{self.kmd_server}:{self.kmd_port}"

    @property
    def db_full_path(self) -> Path:
        p = Path(self.db_path)
        p.parent.mkdir(parents=True, exist_ok=True)
        return p


@lru_cache
def get_settings() -> Settings:
    return Settings()

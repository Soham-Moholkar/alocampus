"""Algorand SDK client factories for algod, indexer, and KMD (all LocalNet)."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Optional

from algosdk import kmd, account, mnemonic
from algosdk.v2client.algod import AlgodClient
from algosdk.v2client.indexer import IndexerClient

from app.config import Settings, get_settings


# ── Client factories ─────────────────────────────────────

@lru_cache
def get_algod(settings: Settings | None = None) -> AlgodClient:
    s = settings or get_settings()
    return AlgodClient(s.algod_token, s.algod_url)


@lru_cache
def get_indexer(settings: Settings | None = None) -> IndexerClient:
    s = settings or get_settings()
    return IndexerClient(s.indexer_token, s.indexer_url)


@lru_cache
def get_kmd(settings: Settings | None = None) -> kmd.KMDClient:
    s = settings or get_settings()
    return kmd.KMDClient(s.kmd_token, s.kmd_url)


# ── KMD dev account helper ───────────────────────────────

def get_localnet_default_account() -> tuple[str, str]:
    """Return (address, private_key) of the default-funded LocalNet account via KMD."""
    kmd_client = get_kmd()
    wallets = kmd_client.list_wallets()
    default_wallet_id: Optional[str] = None
    for w in wallets:
        if w["name"] == "unencrypted-default-wallet":
            default_wallet_id = w["id"]
            break
    if default_wallet_id is None:
        raise RuntimeError("LocalNet default wallet not found – is localnet running?")

    handle = kmd_client.init_wallet_handle(default_wallet_id, "")
    keys = kmd_client.list_keys(handle)
    if not keys:
        raise RuntimeError("No keys in default wallet")
    address = keys[0]
    private_key = kmd_client.export_key(handle, "", address)
    return address, private_key


# ── App manifest ─────────────────────────────────────────

_manifest_cache: Optional[dict[str, int]] = None


def get_app_ids() -> dict[str, int]:
    """Load app IDs from the manifest written by the deploy step."""
    global _manifest_cache
    if _manifest_cache is not None:
        return _manifest_cache
    s = get_settings()
    p = Path(s.app_manifest_path)
    if not p.exists():
        raise FileNotFoundError(
            f"App manifest not found at {p.resolve()}.  "
            "Run `algokit project run deploy` in the contracts project first."
        )
    _manifest_cache = json.loads(p.read_text())
    return _manifest_cache

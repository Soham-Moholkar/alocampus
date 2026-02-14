"""Certificate issuance use-case.

Flow:
  1. Build ARC-3 metadata JSON and persist locally (served by BFF).
  2. Mint an ASA/NFT on LocalNet via algod (using KMD dev account).
  3. Register cert_hash on-chain in CertificateRegistryContract.
"""

from __future__ import annotations

import hashlib
import json
import logging
import time

from algosdk import transaction, encoding
from algosdk.abi import Method
from algosdk.atomic_transaction_composer import (
    AtomicTransactionComposer,
    AccountTransactionSigner,
)

from app.config import get_settings
from app.domain.models import IssueCertRequest, IssueCertResponse
from app.infra.algorand.client import get_algod, get_app_ids, get_localnet_default_account
from app.infra.db.models import store_cert_metadata

logger = logging.getLogger(__name__)

_REGISTER = Method.from_signature(
    "register_cert(byte[],address,uint64,uint64)bool"
)


async def issue(req: IssueCertRequest) -> IssueCertResponse:
    """Full certificate issuance pipeline."""

    settings = get_settings()
    algod_client = get_algod()
    sender, sk = get_localnet_default_account()
    sp = algod_client.suggested_params()

    # 1 ── build canonical payload + hash ─────────────────
    canonical = {
        "recipient": req.recipient_address,
        "name": req.recipient_name,
        "course": req.course_code,
        "title": req.title,
        "description": req.description,
        "issued_ts": int(time.time()),
    }
    canonical_bytes = json.dumps(canonical, sort_keys=True, separators=(",", ":")).encode()
    cert_hash = hashlib.sha256(canonical_bytes).digest()
    cert_hash_hex = cert_hash.hex()

    # 2 ── persist ARC-3 metadata locally ─────────────────
    metadata_url = f"{settings.bff_base_url}/metadata/cert/{cert_hash_hex}.json"
    arc3 = {
        "name": f"Certificate: {req.title}",
        "description": req.description or f"AlgoCampus certificate for {req.course_code}",
        "image": "",
        "properties": {
            "recipient": req.recipient_address,
            "recipient_name": req.recipient_name,
            "course_code": req.course_code,
            "issued_ts": canonical["issued_ts"],
        },
    }

    # 3 ── mint ASA/NFT (total=1, decimals=0) ─────────────
    txn_create = transaction.AssetConfigTxn(
        sender=sender,
        sp=sp,
        total=1,
        decimals=0,
        default_frozen=False,
        unit_name="CERT",
        asset_name=f"AC-{req.course_code[:8]}",
        url=metadata_url,
        manager=sender,
        reserve=sender,
        strict_empty_address_check=False,
    )
    signed = txn_create.sign(sk)
    tx_id = algod_client.send_transaction(signed)
    result = transaction.wait_for_confirmation(algod_client, tx_id, 4)
    asset_id = result["asset-index"]
    logger.info("Minted ASA %d  tx=%s", asset_id, tx_id)

    # (Optional) opt-in recipient + transfer the NFT
    # Skipped for LocalNet hackathon — the dev account holds the NFT

    # 4 ── register cert_hash on-chain via ATC ────────────
    try:
        ids = get_app_ids()
        cert_app_id = ids.get("CertificateRegistryContract")
        if cert_app_id:
            atc = AtomicTransactionComposer()
            signer = AccountTransactionSigner(sk)
            atc.add_method_call(
                app_id=cert_app_id,
                method=_REGISTER,
                sender=sender,
                sp=sp,
                signer=signer,
                method_args=[
                    cert_hash,
                    req.recipient_address,
                    asset_id,
                    canonical["issued_ts"],
                ],
            )
            atc_result = atc.execute(algod_client, wait_rounds=4)
            logger.info("Cert registered on-chain tx=%s", atc_result.tx_ids[0])
    except Exception:
        logger.exception("On-chain cert registration failed (non-fatal)")

    # 5 ── persist metadata in SQLite ─────────────────────
    await store_cert_metadata(
        cert_hash=cert_hash_hex,
        recipient=req.recipient_address,
        asset_id=asset_id,
        metadata_json=json.dumps(arc3),
    )

    return IssueCertResponse(
        cert_hash=cert_hash_hex,
        asset_id=asset_id,
        metadata_url=metadata_url,
        tx_id=tx_id,
    )

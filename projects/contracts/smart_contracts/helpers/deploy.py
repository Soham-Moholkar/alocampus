"""Deploy all contracts to LocalNet using algokit-utils."""

from __future__ import annotations

import json
import logging
import sys
from pathlib import Path

import algokit_utils
from algosdk.v2client.algod import AlgodClient
from dotenv import load_dotenv

from smart_contracts.config import get_contracts

logger = logging.getLogger(__name__)

ARTIFACTS_DIR = Path(__file__).resolve().parent.parent / "artifacts"
ENV_FILE = Path(__file__).resolve().parent.parent.parent / ".env.localnet"


def _get_algod() -> AlgodClient:
    """Create an algod client pointing at LocalNet."""
    return algokit_utils.get_algod_client(
        algokit_utils.AlgoClientConfig(
            server="http://localhost",
            port=4001,
            token="a" * 64,
        )
    )


def _deploy_one(
    algod_client: AlgodClient,
    deployer: algokit_utils.Account,
    name: str,
) -> int:
    spec_path = ARTIFACTS_DIR / name / f"{name}.arc32.json"
    if not spec_path.exists():
        raise FileNotFoundError(f"App spec not found: {spec_path}")

    app_spec = algokit_utils.ApplicationSpecification.from_json(
        spec_path.read_text()
    )

    app_client = algokit_utils.ApplicationClient(
        algod_client=algod_client,
        app_spec=app_spec,
        signer=deployer.signer,
        sender=deployer.address,
    )

    app_client.deploy(
        version="1.0",
        on_schema_break=algokit_utils.OnSchemaBreak.AppendApp,
        on_update=algokit_utils.OnUpdate.AppendApp,
        create_args=algokit_utils.ABICallArgs(method="create_application"),
    )

    logger.info(
        "  ✔ %s deployed — app_id=%s  app_addr=%s",
        name,
        app_client.app_id,
        app_client.app_address,
    )

    return app_client.app_id  # type: ignore[return-value]


def deploy_all() -> None:
    logging.basicConfig(level=logging.INFO, stream=sys.stdout)
    load_dotenv(ENV_FILE)

    algod_client = _get_algod()
    deployer = algokit_utils.get_localnet_default_account(algod_client)

    logger.info("Deployer: %s", deployer.address)

    deployed: dict[str, int] = {}
    for contract in get_contracts():
        app_id = _deploy_one(algod_client, deployer, contract.name)
        deployed[contract.name] = app_id

    # Write a small manifest so the BFF can discover app IDs
    manifest_path = ARTIFACTS_DIR / "app_manifest.json"
    manifest_path.write_text(json.dumps(deployed, indent=2))
    logger.info("Manifest written to %s", manifest_path)


if __name__ == "__main__":
    deploy_all()

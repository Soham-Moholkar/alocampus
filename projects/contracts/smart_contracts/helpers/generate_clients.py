"""Generate TypeScript typed clients from ARC-32 app specs into frontend/src/contracts/."""

from __future__ import annotations

import logging
import subprocess
import sys
from pathlib import Path

from smart_contracts.config import get_contracts

logger = logging.getLogger(__name__)

ARTIFACTS_DIR = Path(__file__).resolve().parent.parent / "artifacts"
FRONTEND_CONTRACTS = (
    Path(__file__).resolve().parent.parent.parent.parent
    / "frontend"
    / "src"
    / "contracts"
)


def generate_all() -> None:
    logging.basicConfig(level=logging.INFO, stream=sys.stdout)
    FRONTEND_CONTRACTS.mkdir(parents=True, exist_ok=True)

    for contract in get_contracts():
        spec = ARTIFACTS_DIR / contract.name / f"{contract.name}.arc32.json"
        if not spec.exists():
            logger.warning("Skipping %s – spec not found at %s", contract.name, spec)
            continue

        out = FRONTEND_CONTRACTS / f"{contract.name}Client.ts"
        cmd = [
            "algokit",
            "generate",
            "client",
            str(spec.resolve()),
            "--output",
            str(out.resolve()),
            "--language",
            "typescript",
        ]
        logger.info("Generating client: %s", " ".join(cmd))
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            logger.error(result.stderr)
            raise RuntimeError(f"Client generation failed for {contract.name}")
        logger.info("  → %s", out)

    logger.info("All typed clients generated.")


if __name__ == "__main__":
    generate_all()

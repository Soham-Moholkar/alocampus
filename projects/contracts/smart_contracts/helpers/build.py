"""Compile all AlgoPy contracts into TEAL + ARC-32 app-spec artifacts."""

from __future__ import annotations

import logging
import subprocess
import sys
from pathlib import Path

from smart_contracts.config import get_contracts

logger = logging.getLogger(__name__)

ARTIFACTS_DIR = Path(__file__).resolve().parent.parent / "artifacts"


def _build_one(source: Path, output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    cmd = [
        "algokit",
        "--no-color",
        "compile",
        "python",
        str(source.resolve()),
        f"--out-dir={output_dir.resolve()}",
        "--output-arc32",
    ]
    logger.info("Running: %s", " ".join(cmd))
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        logger.error("stdout:\n%s", result.stdout)
        logger.error("stderr:\n%s", result.stderr)
        raise RuntimeError(f"Compilation failed for {source.name}")
    logger.info(result.stdout)


def build_all() -> None:
    logging.basicConfig(level=logging.INFO, stream=sys.stdout)
    for contract in get_contracts():
        out = ARTIFACTS_DIR / contract.name
        logger.info("Building %s -> %s", contract.name, out)
        _build_one(contract.source_path, out)
    logger.info("All contracts built successfully.")


if __name__ == "__main__":
    build_all()

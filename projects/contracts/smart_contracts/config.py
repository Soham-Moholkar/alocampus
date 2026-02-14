"""Registry of contracts to build / deploy."""

from __future__ import annotations

import dataclasses
from pathlib import Path


@dataclasses.dataclass(frozen=True)
class SmartContract:
    """Metadata for one smart-contract module."""

    source_path: Path
    name: str  # class name used for the artifact folder


def get_contracts() -> list[SmartContract]:
    base = Path(__file__).parent
    return [
        SmartContract(
            source_path=base / "voting" / "contract.py",
            name="VotingContract",
        ),
        SmartContract(
            source_path=base / "attendance" / "contract.py",
            name="AttendanceContract",
        ),
        SmartContract(
            source_path=base / "certificate" / "contract.py",
            name="CertificateRegistryContract",
        ),
    ]

"""CLI entry-point: ``python -m smart_contracts build|deploy``."""

from __future__ import annotations

import sys
from pathlib import Path


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python -m smart_contracts <build|deploy>")
        sys.exit(1)

    command = sys.argv[1]

    if command == "build":
        from smart_contracts.helpers.build import build_all

        build_all()
    elif command == "deploy":
        from smart_contracts.helpers.deploy import deploy_all

        deploy_all()
    else:
        print(f"Unknown command: {command}")
        sys.exit(1)


if __name__ == "__main__":
    main()

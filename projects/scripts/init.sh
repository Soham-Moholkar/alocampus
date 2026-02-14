#!/usr/bin/env bash
# ── AlgoCampus Platform Init Script ──────────────────────
# Usage: bash scripts/init.sh
# Prerequisites: Docker Desktop running, AlgoKit installed, Python 3.12

set -euo pipefail

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }
step()  { echo -e "\n${BOLD}── $1 ──${NC}"; }

# ── Pre-flight checks ───────────────────────
step "Pre-flight checks"

command -v docker  >/dev/null 2>&1 || error "Docker not found. Install Docker Desktop first."
command -v algokit >/dev/null 2>&1 || error "AlgoKit not found. Run: pipx install algokit"
docker info >/dev/null 2>&1      || error "Docker daemon not running. Start Docker Desktop."

log "Docker OK"
log "AlgoKit OK"

# ── Start LocalNet ───────────────────────────
step "Starting Algorand LocalNet"

algokit localnet start
sleep 3

# Wait for algod
for i in {1..30}; do
    if curl -sf http://localhost:4001/v2/status > /dev/null 2>&1; then
        log "algod is healthy"
        break
    fi
    [ "$i" -eq 30 ] && error "algod did not start in time"
    sleep 1
done

# Wait for indexer
for i in {1..30}; do
    if curl -sf http://localhost:8980/health > /dev/null 2>&1; then
        log "indexer is healthy"
        break
    fi
    [ "$i" -eq 30 ] && error "indexer did not start in time"
    sleep 1
done

log "LocalNet running (algod :4001, indexer :8980, KMD :4002)"

# ── Build & deploy contracts ────────────────
step "Building & deploying smart contracts"

cd projects/contracts

if [ ! -d ".venv" ]; then
    python -m venv .venv
fi
source .venv/bin/activate 2>/dev/null || source .venv/Scripts/activate 2>/dev/null
pip install -q -r requirements.txt 2>/dev/null || pip install -q -e ".[dev]" 2>/dev/null || true
pip install -q algokit-utils py-algorand-sdk puyapy algorand-python 2>/dev/null || true

python -m smart_contracts build
log "Contracts compiled"

python -m smart_contracts deploy
log "Contracts deployed (app IDs in artifacts/app_manifest.json)"

# ── Generate TypeScript clients ─────────────
step "Generating TypeScript clients"

if command -v algokit >/dev/null 2>&1; then
    algokit project run generate_client 2>/dev/null || warn "Client generation skipped (will use REST API)"
fi

cd ../..

# ── Setup backend ───────────────────────────
step "Setting up backend"

cd projects/backend

if [ ! -d ".venv" ]; then
    python -m venv .venv
fi
source .venv/bin/activate 2>/dev/null || source .venv/Scripts/activate 2>/dev/null
pip install -q -r requirements.txt

log "Backend dependencies installed"

cd ../..

# ── Setup frontend ──────────────────────────
step "Setting up frontend"

cd projects/frontend

if [ -f "package.json" ]; then
    npm install
    log "Frontend dependencies installed"
else
    warn "No package.json found — run 'npm install' manually in projects/frontend/"
fi

cd ../..

# ── Summary ─────────────────────────────────
step "Setup complete!"

echo ""
echo -e "${BOLD}Start the services:${NC}"
echo "  Backend:  cd projects/backend && uvicorn app.main:app --reload"
echo "  Frontend: cd projects/frontend && npm run dev"
echo ""
echo -e "${BOLD}URLs:${NC}"
echo "  Backend API:  http://localhost:8000"
echo "  Swagger Docs: http://localhost:8000/docs"
echo "  Frontend:     http://localhost:5173"
echo "  Algod:        http://localhost:4001"
echo "  Indexer:      http://localhost:8980"
echo ""

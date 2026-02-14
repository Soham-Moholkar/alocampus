# ── AlgoCampus Platform Init Script (Windows PowerShell) ──
# Usage: .\scripts\init.ps1
# Prerequisites: Docker Desktop running, AlgoKit installed, Python 3.12

$ErrorActionPreference = "Stop"

function Log($msg)   { Write-Host "[OK] $msg" -ForegroundColor Green }
function Warn($msg)  { Write-Host "[!] $msg" -ForegroundColor Yellow }
function Err($msg)   { Write-Host "[X] $msg" -ForegroundColor Red; exit 1 }
function Step($msg)  { Write-Host "`n-- $msg --" -ForegroundColor Cyan }

# ── Pre-flight checks ───────────────────────
Step "Pre-flight checks"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { Err "Docker not found. Install Docker Desktop first." }
if (-not (Get-Command algokit -ErrorAction SilentlyContinue)) { Err "AlgoKit not found. Run: pipx install algokit" }

try { docker info 2>&1 | Out-Null } catch { Err "Docker daemon not running. Start Docker Desktop." }

Log "Docker OK"
Log "AlgoKit OK"

# ── Start LocalNet ───────────────────────────
Step "Starting Algorand LocalNet"

algokit localnet start
Start-Sleep -Seconds 3

# Wait for algod
$retries = 30
for ($i = 0; $i -lt $retries; $i++) {
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:4001/v2/status" -UseBasicParsing -TimeoutSec 2
        if ($resp.StatusCode -eq 200) { Log "algod is healthy"; break }
    } catch {}
    if ($i -eq ($retries - 1)) { Err "algod did not start in time" }
    Start-Sleep -Seconds 1
}

# Wait for indexer
for ($i = 0; $i -lt $retries; $i++) {
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:8980/health" -UseBasicParsing -TimeoutSec 2
        if ($resp.StatusCode -eq 200) { Log "indexer is healthy"; break }
    } catch {}
    if ($i -eq ($retries - 1)) { Err "indexer did not start in time" }
    Start-Sleep -Seconds 1
}

Log "LocalNet running (algod :4001, indexer :8980, KMD :4002)"

# ── Build & deploy contracts ────────────────
Step "Building & deploying smart contracts"

Push-Location projects\contracts

if (-not (Test-Path ".venv")) { python -m venv .venv }
& .\.venv\Scripts\Activate.ps1
pip install -q -r requirements.txt 2>$null
pip install -q algokit-utils py-algorand-sdk puyapy algorand-python 2>$null

python -m smart_contracts build
Log "Contracts compiled"

python -m smart_contracts deploy
Log "Contracts deployed (app IDs in artifacts/app_manifest.json)"

Pop-Location

# ── Setup backend ───────────────────────────
Step "Setting up backend"

Push-Location projects\backend

if (-not (Test-Path ".venv")) { python -m venv .venv }
& .\.venv\Scripts\Activate.ps1
pip install -q -r requirements.txt

Log "Backend dependencies installed"

Pop-Location

# ── Setup frontend ──────────────────────────
Step "Setting up frontend"

Push-Location projects\frontend

if (Test-Path "package.json") {
    npm install
    Log "Frontend dependencies installed"
} else {
    Warn "No package.json found -- run 'npm install' manually in projects/frontend/"
}

Pop-Location

# ── Summary ─────────────────────────────────
Step "Setup complete!"

Write-Host ""
Write-Host "Start the services:" -ForegroundColor White
Write-Host "  Backend:  cd projects\backend; uvicorn app.main:app --reload"
Write-Host "  Frontend: cd projects\frontend; npm run dev"
Write-Host ""
Write-Host "URLs:" -ForegroundColor White
Write-Host "  Backend API:  http://localhost:8000"
Write-Host "  Swagger Docs: http://localhost:8000/docs"
Write-Host "  Frontend:     http://localhost:5173"
Write-Host "  Algod:        http://localhost:4001"
Write-Host "  Indexer:      http://localhost:8980"
Write-Host ""

<p align="center">
  <img src="https://img.shields.io/badge/Algorand-000000?style=for-the-badge&logo=algorand&logoColor=white" />
  <img src="https://img.shields.io/badge/Python-3.12-3776AB?style=for-the-badge&logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/AlgoKit-v2-blueviolet?style=for-the-badge" />
</p>

# AlgoCampus — Blockchain-Powered Campus Platform

> A fully local, Algorand-backed academic platform for **voting**, **attendance tracking**, and **verifiable certificate issuance** — with role-based dashboards for Students, Faculty, and Admins.

Everything runs on **AlgoKit LocalNet**. No data leaves your machine. No Pinata, no IPFS gateways, no external APIs.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [Smart Contracts](#smart-contracts)
  - [VotingContract](#1-votingcontract)
  - [AttendanceContract](#2-attendancecontract)
  - [CertificateRegistryContract](#3-certificateregistrycontract)
  - [Shared: Role Management](#shared-role-management)
  - [Atomic Transaction Group](#atomic-transaction-group)
- [Backend (BFF API)](#backend-bff-api)
  - [Architecture Layers](#architecture-layers)
  - [Complete API Reference](#complete-api-reference)
  - [Authentication Flow](#authentication-flow)
  - [Database Schema](#database-schema)
  - [Rate Limiting](#rate-limiting)
- [Frontend Route Map](#frontend-route-map)
- [Cohesion Rules](#cohesion-rules)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Quick Start (Windows)](#quick-start-windows)
  - [Quick Start (Bash / macOS / Linux)](#quick-start-bash--macos--linux)
- [Environment Variables](#environment-variables)
- [Typed Client Generation](#typed-client-generation)
- [Known Issues & Fixes](#known-issues--fixes)
- [License](#license)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AlgoCampus Platform                          │
├─────────────┬───────────────────────────┬───────────────────────────┤
│  Frontend   │      BFF (FastAPI)        │   Algorand LocalNet       │
│  React/TS   │                           │                           │
│             │  ┌─────────┐              │  ┌───────────────────┐    │
│  /student/* │  │ API     │──── algod ──►│  │ VotingContract    │    │
│  /faculty/* │  │ Routes  │              │  │ (ARC-4 + boxes)   │    │
│  /admin/*   │  ├─────────┤              │  ├───────────────────┤    │
│             │  │UseCases │──── KMD  ───►│  │ AttendanceContract│    │
│  Typed TS   │  ├─────────┤              │  │ (ARC-4 + boxes)   │    │
│  Clients    │  │ Infra   │── Indexer ──►│  ├───────────────────┤    │
│  (ARC-32)   │  │ ┌─────┐│              │  │ CertificateRegistry│   │
│             │  │ │SQLite││              │  │ (ARC-4 + ASA/NFT) │   │
│             │  │ └─────┘│              │  └───────────────────┘    │
└─────────────┴───────────────────────────┴───────────────────────────┘
```

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Smart Contracts** | AlgoPy (ARC-4), Boxes, Inner Txns | On-chain state, role enforcement, NFT minting |
| **BFF API** | FastAPI, SQLite, Algorand SDK | Auth (JWT), caching, tx tracking, metadata serving |
| **Frontend** | React + Vite + TypeScript | Role-based dashboards, typed contract clients |
| **LocalNet** | algod + indexer + KMD (Docker) | Full local Algorand network |

---

## Project Structure

```
E:\MLSC\
├── .algokit.toml                          # AlgoKit workspace root
├── README.md
│
├── projects/
│   ├── contracts/                         # Algorand smart contracts
│   │   ├── .algokit.toml                  # Build/deploy/client-gen config
│   │   ├── .env.localnet                  # LocalNet connection vars
│   │   ├── pyproject.toml                 # Poetry: algorand-python, puyapy
│   │   └── smart_contracts/
│   │       ├── __init__.py
│   │       ├── __main__.py                # CLI: build | deploy
│   │       ├── config.py                  # Contract registry
│   │       ├── voting/
│   │       │   └── contract.py            # VotingContract
│   │       ├── attendance/
│   │       │   └── contract.py            # AttendanceContract
│   │       ├── certificate/
│   │       │   └── contract.py            # CertificateRegistryContract
│   │       └── helpers/
│   │           ├── build.py               # Compile → TEAL + ARC-32
│   │           ├── deploy.py              # Deploy → LocalNet + app_manifest.json
│   │           └── generate_clients.py    # → frontend/src/contracts/*.ts
│   │
│   ├── backend/                           # FastAPI BFF
│   │   ├── .algokit.toml
│   │   ├── .env.localnet                  # All env vars
│   │   ├── pyproject.toml                 # Poetry: fastapi, aiosqlite, etc.
│   │   ├── requirements.txt
│   │   └── app/
│   │       ├── __init__.py
│   │       ├── main.py                    # App factory + lifespan
│   │       ├── config.py                  # Pydantic Settings
│   │       ├── auth.py                    # JWT + role dependencies
│   │       ├── rate_limit.py              # Token-bucket middleware
│   │       ├── api/                       # Controller layer
│   │       │   ├── __init__.py            # Router aggregation
│   │       │   ├── health.py              # GET /health
│   │       │   ├── auth_routes.py         # /auth/nonce, /auth/verify, /auth/me
│   │       │   ├── admin.py               # POST /admin/role
│   │       │   ├── faculty.py             # /faculty/polls, /sessions, /cert/issue
│   │       │   ├── polls.py               # GET /polls, /polls/{id}
│   │       │   ├── sessions.py            # GET /attendance/sessions, /{id}
│   │       │   ├── certs.py               # GET /certs, /certs/verify
│   │       │   ├── certificate.py         # GET /cert/verify (public alias)
│   │       │   ├── tx.py                  # /tx/track
│   │       │   ├── analytics.py           # GET /analytics/summary
│   │       │   └── metadata.py            # GET /metadata/cert/{hash}.json
│   │       ├── usecases/                  # Business logic layer
│   │       │   ├── auth_uc.py
│   │       │   ├── roles_uc.py
│   │       │   ├── polls_uc.py
│   │       │   ├── sessions_uc.py
│   │       │   ├── certificate_uc.py
│   │       │   ├── certs_uc.py
│   │       │   ├── tx_uc.py
│   │       │   └── analytics_uc.py
│   │       ├── domain/                    # Domain models (Pydantic)
│   │       │   └── models.py
│   │       └── infra/                     # Infrastructure layer
│   │           ├── db/
│   │           │   ├── database.py        # SQLite init + schema
│   │           │   └── models.py          # CRUD query helpers
│   │           └── algorand/
│   │               ├── client.py          # algod/indexer/KMD factories
│   │               ├── chain.py           # On-chain ABI call helpers
│   │               └── indexer.py         # Analytics + tx lookup
│   │
│   └── frontend/
│       └── src/contracts/                 # Generated typed TS clients
│           ├── VotingClient.ts
│           ├── AttendanceClient.ts
│           └── CertificateRegistryClient.ts
```

---

## Smart Contracts

All three contracts follow the same patterns:
- **ARC-4** (`ARC4Contract` + `@arc4.abimethod`)
- **Box-backed storage** (no global state bloat)
- **Round-window time constraints** (start/end rounds)
- **On-chain role enforcement** (admin + faculty allowlists in boxes)

### 1. VotingContract

On-chain polling with one-address-one-vote enforcement.

| Method | Parameters | Returns | Access |
|--------|-----------|---------|--------|
| `create_application()` | — | void | create only |
| `set_admin(addr, enabled)` | Address, Bool | void | creator only |
| `set_faculty(addr, enabled)` | Address, Bool | void | admin |
| `create_poll(question, options, start_round, end_round)` | String, String[], UInt64, UInt64 | UInt64 (poll_id) | admin/faculty |
| `cast_vote(poll_id, option_index)` | UInt64, UInt64 | Bool | anyone (round window) |
| `cast_vote_with_deposit(pay, poll_id, option_index)` | PaymentTxn, UInt64, UInt64 | Bool | anyone (atomic group) |
| `get_poll(poll_id)` | UInt64 | (question, num_opts, start, end) | readonly |
| `get_result(poll_id, option_index)` | UInt64, UInt64 | UInt64 (count) | readonly |

**Box maps:** `poll_questions`, `poll_num_options`, `poll_start_round`, `poll_end_round`, `poll_options` (poll+idx), `vote_counts` (poll+idx), `voter_flags` (poll+voter)

### 2. AttendanceContract

On-chain session attendance with per-address check-in.

| Method | Parameters | Returns | Access |
|--------|-----------|---------|--------|
| `create_application()` | — | void | create only |
| `set_admin(addr, enabled)` | Address, Bool | void | creator only |
| `set_faculty(addr, enabled)` | Address, Bool | void | admin |
| `create_session(course_code, session_ts, open_round, close_round)` | String, UInt64, UInt64, UInt64 | UInt64 (session_id) | admin/faculty |
| `check_in(session_id)` | UInt64 | Bool | anyone (round window) |
| `is_present(session_id, addr)` | UInt64, Address | Bool | readonly |
| `get_session(session_id)` | UInt64 | (course, ts, open, close) | readonly |

**Box maps:** `session_course`, `session_ts`, `session_open`, `session_close`, `roster` (session+addr)

### 3. CertificateRegistryContract

Verifiable certificate registry with ASA/NFT minting support.

| Method | Parameters | Returns | Access |
|--------|-----------|---------|--------|
| `create_application()` | — | void | create only |
| `set_admin(addr, enabled)` | Address, Bool | void | creator only |
| `set_faculty(addr, enabled)` | Address, Bool | void | admin |
| `register_cert(cert_hash, recipient, asset_id, issued_ts)` | DynamicBytes, Address, UInt64, UInt64 | Bool | admin/faculty |
| `reissue_cert(cert_hash, recipient, asset_id, issued_ts)` | DynamicBytes, Address, UInt64, UInt64 | Bool | admin only |
| `mint_and_register(cert_hash, recipient, metadata_url, issued_ts)` | DynamicBytes, Address, String, UInt64 | UInt64 (asset_id) | admin/faculty |
| `verify_cert(cert_hash)` | DynamicBytes | (recipient, asset_id, issued_ts) | readonly |

**Box maps:** `cert_recipient`, `cert_asset`, `cert_ts`

**Inner transaction:** `mint_and_register` creates an ARC-3 NFT (total=1, decimals=0, unit=`CERT`) via `itxn.AssetConfig`.

### Shared: Role Management

All three contracts share an identical interface:

```
set_admin(address, bool)   → only the original creator (deployer)
set_faculty(address, bool) → any admin
```

Stored in box maps with prefixes `adm` and `fac`. Checked via subroutines `_is_admin()` and `_is_admin_or_faculty()`.

When the BFF's `/admin/role` endpoint is called, it pushes the role to **all three contracts** simultaneously.

### Atomic Transaction Group

**`cast_vote_with_deposit`** on VotingContract demonstrates a real atomic group:
- Transaction 0: `PaymentTransaction` (≥ 1000 µAlgo to the app address)
- Transaction 1: `ApplicationCallTransaction` (the vote app-call)

Both succeed or both fail — enforced by `gtxn.PaymentTransaction` reference in the ABI method.

---

## Backend (BFF API)

A FastAPI Backend-for-Frontend that bridges the React frontend to Algorand LocalNet.

### Architecture Layers

```
app/api/           → Controller layer (FastAPI routes)
app/usecases/      → Business logic (pure orchestration)
app/domain/        → Pydantic models (request/response)
app/infra/db/      → SQLite (aiosqlite) persistence
app/infra/algorand/→ Algorand SDK (algod, indexer, KMD, ATC calls)
```

### Complete API Reference

#### Public Endpoints (No Auth)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness check → `{"status": "ok"}` |
| `POST` | `/auth/nonce` | Request challenge nonce for wallet address |
| `POST` | `/auth/verify` | Verify Ed25519 signature → issue JWT |
| `GET` | `/polls` | List all polls (paginated: `?limit=&offset=`) |
| `GET` | `/polls/{poll_id}` | Get single poll details |
| `GET` | `/attendance/sessions` | List all sessions (paginated) |
| `GET` | `/attendance/sessions/{session_id}` | Get single session details |
| `GET` | `/certs/verify?cert_hash=<hex>` | On-chain certificate verification |
| `GET` | `/cert/verify?cert_hash=<hex>` | Alias for above |
| `POST` | `/tx/track` | Record tx for background confirmation polling |
| `GET` | `/tx/track/{tx_id}` | Get tx confirmation status |
| `GET` | `/analytics/summary` | Indexer-backed aggregate counts |
| `GET` | `/metadata/cert/{hash}.json` | Serve ARC-3 metadata JSON locally |

#### Authenticated Endpoints (JWT Required)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| `GET` | `/auth/me` | any | Return address + role of current user |
| `GET` | `/certs` | any (filtered) | Students see own certs; faculty/admin see all |

#### Faculty/Admin Write Endpoints

| Method | Path | Role | Description |
|--------|------|------|-------------|
| `POST` | `/faculty/polls` | faculty/admin | Create poll on-chain + BFF cache |
| `POST` | `/faculty/sessions` | faculty/admin | Create session on-chain + BFF cache |
| `POST` | `/faculty/cert/issue` | faculty/admin | Mint ASA/NFT + register cert on-chain |

#### Admin-Only Endpoints

| Method | Path | Role | Description |
|--------|------|------|-------------|
| `POST` | `/admin/role` | admin | Set role (SQLite + on-chain push to all contracts) |

### Authentication Flow

```
1. Frontend → POST /auth/nonce { address }
   ← { nonce: "random-hex" }

2. Wallet signs message: "AlgoCampus auth nonce: <nonce>"

3. Frontend → POST /auth/verify { address, nonce, signature }
   ← { jwt: "eyJ..." }    (HS256, 60 min expiry, contains sub + role)

4. All subsequent requests include:
   Authorization: Bearer <jwt>
```

The JWT payload contains `sub` (Algorand address), `role` (admin/faculty/student), `iat`, `exp`.

### Database Schema

Six SQLite tables in `.data/algocampus.db`:

| Table | Primary Key | Purpose |
|-------|------------|---------|
| `roles` | `address` | Role cache (admin/faculty/student) |
| `nonces` | `address` | One-time auth challenge nonces |
| `tx_tracking` | `tx_id` | Background transaction confirmation polling |
| `cert_metadata` | `cert_hash` | ARC-3 metadata JSON store (local, no IPFS) |
| `polls` | `poll_id` | BFF cache of on-chain polls |
| `sessions` | `session_id` | BFF cache of on-chain attendance sessions |

### Rate Limiting

In-memory token-bucket middleware on `/auth/*` and `/admin/*` paths:
- **Capacity:** 20 tokens per IP
- **Refill:** 2 tokens/second
- **Exceeded:** HTTP 429

---

## Frontend Route Map

The frontend uses role-based routing: `GET /auth/me` returns the role, which determines the landing dashboard.

| Role | Redirect | Dashboard |
|------|----------|-----------|
| Student | `/student/dashboard` | Voting, Attendance, Certificates, Feedback, Profile |
| Faculty | `/faculty/dashboard` | Create polls/sessions, Issue certs, Analytics, Profile |
| Admin | `/admin/dashboard` | Role management, System overview, Analytics |

### Route Table

**Shared (all roles):**
`/connect` · `/verify/certificate` · `/activity` · `/settings`

**Student routes:**
`/student/dashboard` · `/student/voting` · `/student/attendance` · `/student/certificates` · `/student/feedback` · `/student/profile`

**Faculty routes:**
`/faculty/dashboard` · `/faculty/voting` · `/faculty/attendance` · `/faculty/certificates` · `/faculty/analytics` · `/faculty/profile`

**Admin routes:**
`/admin/dashboard` · `/admin/roles` · `/admin/system` · `/admin/analytics`

---

## Cohesion Rules

These are the non-negotiable architectural constraints:

| # | Rule | Enforcement |
|---|------|-------------|
| 1 | **Certificates: BFF mints** | Frontend calls `POST /faculty/cert/issue`. BFF mints ASA via KMD dev account + registers on-chain. Frontend never mints directly. |
| 2 | **Read strategy: Indexer/BFF-cache** | List views (`/polls`, `/attendance/sessions`, `/certs`) served from BFF SQLite. Contract getters used only for verification (`verify_cert`, `is_present`). |
| 3 | **Roles: on-chain enforced** | BFF stores SQLite cache AND pushes `set_admin`/`set_faculty` to all 3 contracts. Contracts enforce access in every write method. |
| 4 | **Typed clients** | After contract changes, run `generate_clients.py`. Frontend imports only from `projects/frontend/src/contracts/**`. |
| 5 | **Local-only** | No Pinata, IPFS, or external APIs. Certificate metadata served from `GET /metadata/cert/{hash}.json`. |

---

## Getting Started

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| [AlgoKit CLI](https://github.com/algorandfoundation/algokit-cli) | ≥ 2.0 | Workspace management, LocalNet, compilation |
| [Python](https://python.org) | ≥ 3.12 | Contracts + backend |
| [Poetry](https://python-poetry.org) | ≥ 1.7 | Dependency management |
| [Docker Desktop](https://docker.com) | Latest | LocalNet (algod + indexer + KMD) |
| [Node.js](https://nodejs.org) | ≥ 18 | Frontend + client generation |

### Quick Start (Windows)

```powershell
# 1) Start LocalNet (Docker containers)
algokit localnet start

# 2) Bootstrap all sub-projects (installs all dependencies)
cd E:\MLSC
algokit project bootstrap all

# 3) Build smart contracts (compile AlgoPy → TEAL + ARC-32)
cd projects\contracts
poetry install
poetry run python -m smart_contracts build

# 4) Deploy all 3 contracts to LocalNet
poetry run python -m smart_contracts deploy
#    → Creates: smart_contracts/artifacts/app_manifest.json

# 5) Generate TypeScript typed clients for the frontend
poetry run python -m smart_contracts.helpers.generate_clients
#    → Creates: ../frontend/src/contracts/{Voting,Attendance,CertificateRegistry}Client.ts

# 6) Start the FastAPI BFF
cd ..\backend
copy .env.localnet .env
poetry install
poetry run uvicorn app.main:app --reload --port 8000
#    → Swagger UI: http://localhost:8000/docs

# 7) Start the frontend (separate terminal)
cd ..\frontend
npm install
npm run dev
#    → http://localhost:5173
```

### Quick Start (Bash / macOS / Linux)

```bash
# 1) Start LocalNet
algokit localnet start

# 2) Bootstrap
cd /path/to/MLSC
algokit project bootstrap all

# 3) Build contracts
cd projects/contracts
poetry install
poetry run python -m smart_contracts build

# 4) Deploy
poetry run python -m smart_contracts deploy

# 5) Generate clients
poetry run python -m smart_contracts.helpers.generate_clients

# 6) Start BFF
cd ../backend
cp .env.localnet .env
poetry install
poetry run uvicorn app.main:app --reload --port 8000

# 7) Start frontend
cd ../frontend
npm install
npm run dev
```

---

## Environment Variables

All backend config lives in `projects/backend/.env.localnet`:

| Variable | Default | Description |
|----------|---------|-------------|
| `ALGOD_SERVER` | `http://localhost` | Algorand node server |
| `ALGOD_PORT` | `4001` | Algorand node port |
| `ALGOD_TOKEN` | `a×64` | Algorand node auth token |
| `INDEXER_SERVER` | `http://localhost` | Indexer server |
| `INDEXER_PORT` | `8980` | Indexer port |
| `INDEXER_TOKEN` | `a×64` | Indexer auth token |
| `KMD_SERVER` | `http://localhost` | Key Management Daemon |
| `KMD_PORT` | `4002` | KMD port |
| `KMD_TOKEN` | `a×64` | KMD auth token |
| `JWT_SECRET` | `algocampus-local-dev-secret...` | HMAC signing key |
| `JWT_ALGORITHM` | `HS256` | JWT signing algorithm |
| `JWT_EXPIRE_MINUTES` | `60` | Token expiry |
| `APP_MANIFEST_PATH` | `../contracts/.../app_manifest.json` | Deployed contract IDs |
| `DB_PATH` | `.data/algocampus.db` | SQLite database file |
| `BFF_BASE_URL` | `http://localhost:8000` | BFF public URL (for metadata URLs) |

---

## Typed Client Generation

Contracts produce ARC-32 app specs during build. The generation pipeline:

```
AlgoPy source  →  algokit compile python  →  TEAL + ARC-32 JSON
                                                      │
                                            algokit generate client
                                                      │
                                                      ▼
                                    frontend/src/contracts/*Client.ts
```

**Config** (in `projects/contracts/.algokit.toml`):

| Contract | Output File |
|----------|-------------|
| VotingContract | `VotingClient.ts` |
| AttendanceContract | `AttendanceClient.ts` |
| CertificateRegistryContract | `CertificateRegistryClient.ts` |

**Important:** After any contract changes, always re-run:
```bash
poetry run python -m smart_contracts build
poetry run python -m smart_contracts deploy
poetry run python -m smart_contracts.helpers.generate_clients
```

---

## Frontend Endpoint Mapping TODO

Current frontend endpoint map is centralized at `projects/frontend/src/lib/endpoints.ts`.
Detected naming mismatches and fallbacks:

- `GET /me` expected by UI spec maps to backend `GET /auth/me`.
- `POST /cert/issue` expected by UI spec maps to backend `POST /faculty/cert/issue`.
- `GET /activity` is not present in backend; frontend falls back to a synthetic activity feed built from `/polls`, `/attendance/sessions`, and `/certs`.
- `GET /system/health` is not present in backend; frontend falls back to `/health` plus `/analytics/summary`.

---

## Known Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| **AlgoPy API differences** | `algorand-python` / `puyapy` version mismatches | Pin versions in `pyproject.toml`; check compiler error messages for exact required syntax |
| **Box MBR (minimum balance)** | Each box creation requires the app account to be funded | Send Algos to app address before creating polls/sessions/certs (dev account has funds) |
| **`nacl` import error** | `PyNaCl` not installed | Comes with `python-jose[cryptography]`; fallback: `pip install pynacl` |
| **Indexer lag** | Indexer takes 1-2 rounds to index | `/tx/track` polls with 2s intervals, up to 60s total |
| **NFT stays with dev account** | Recipient opt-in not implemented for LocalNet demo | NFT held by deployer; add opt-in + transfer for production |
| **App manifest not found** | BFF started before contracts deployed | Run deploy step first, then start BFF |
| **`AlgoClientConfig` deprecation** | algokit-utils v3 may change API | Currently pinned to `>=2.2.0,<3` |

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Smart Contracts | AlgoPy (Algorand Python), ARC-4, Boxes, Inner Transactions |
| Compilation | PuyaPy → TEAL + ARC-32 JSON |
| Backend API | FastAPI 0.110+, Uvicorn, Pydantic v2 |
| Database | SQLite via aiosqlite |
| Auth | Ed25519 wallet signatures → JWT (HS256) |
| Algorand SDK | py-algorand-sdk 2.6+, Atomic Transaction Composer |
| Frontend | React + Vite + TypeScript (planned) |
| Infrastructure | AlgoKit LocalNet (Docker: algod + indexer + KMD) |
| Client Gen | algokit-client-generator → TypeScript |

---

## License

This project was built for the MLSC hackathon. See individual dependency licenses for third-party software.

# AlgoCampus - Deep Technical Context

**Version**: 0.1.0  
**Last Updated**: February 15, 2026  
**Purpose**: Comprehensive technical documentation for AI agents and development teams

---

## v2.4 Update Snapshot (Additive)

1. Public route `/` is now a landing page; role entry starts at `/connect` and continues to `/login/:role`.
2. Credential demo auth was added with seeded local users (30 students, 5 faculty, 1 admin) via backend `demo-auth` routes.
3. Role login keeps existing wallet/JWT and on-chain role enforcement unchanged; protected writes still require wallet JWT role.
4. Certificate verify page now supports manual hash, JSON/text upload, QR link/image, and PDF best-effort extraction with backend upload fallback.
5. Faculty attendance now includes create, edit, close, exception review, and analytics tabs, with additive `PATCH` and close APIs.
6. Production-only AWS WAF deployment blueprint added under `infra/aws-waf-blueprint.md` and optional Terraform scaffold.

---

## 🎯 Executive Summary

AlgoCampus is a **fully local**, **blockchain-powered** academic platform built on **Algorand LocalNet** using **AlgoKit v2**. It provides three core functionalities through smart contracts: **voting/polls**, **attendance tracking**, and **certificate issuance**. The system uses a **Backend-for-Frontend (BFF)** pattern with FastAPI serving as the orchestration layer between the React frontend and Algorand blockchain.

**Key Architectural Decision**: No external dependencies (no IPFS, no Pinata, no external APIs) - everything runs locally on the developer's machine via Docker.

---

## 📐 System Architecture

### Architecture Diagram
```
┌─────────────────────────────────────────────────────────────────────┐
│                        AlgoCampus Platform                          │
├──────────────────┬──────────────────────────┬──────────────────────┤
│  Frontend        │    BFF (FastAPI)         │   Algorand LocalNet  │
│  React/TS/Vite   │    Python 3.12           │   Docker Containers  │
│                  │                          │                       │
│  ┌────────────┐  │  ┌─────────────────┐    │  ┌─────────────────┐ │
│  │ Auth       │──┼─▶│ JWT Validation  │    │  │ VotingContract  │ │
│  │ Context    │  │  │ Role Checking   │────┼─▶│ (ARC-4 + Boxes) │ │
│  └────────────┘  │  └─────────────────┘    │  └─────────────────┘ │
│                  │                          │                       │
│  ┌────────────┐  │  ┌─────────────────┐    │  ┌─────────────────┐ │
│  │ Wallet     │──┼─▶│ Signature       │    │  │ AttendanceContr │ │
│  │ Provider   │  │  │ Verification    │────┼─▶│ (ARC-4 + Boxes) │ │
│  └────────────┘  │  └─────────────────┘    │  └─────────────────┘ │
│                  │                          │                       │
│  ┌────────────┐  │  ┌─────────────────┐    │  ┌─────────────────┐ │
│  │ Contract   │──┼─▶│ ATC Builder     │    │  │ CertificateReg  │ │
│  │ Clients    │  │  │ Tx Submission   │────┼─▶│ (ASA/NFT Mint)  │ │
│  └────────────┘  │  └─────────────────┘    │  └─────────────────┘ │
│                  │                          │                       │
│                  │  ┌─────────────────┐    │  ┌─────────────────┐ │
│                  │  │ SQLite/Postgres │    │  │ algod (4001)    │ │
│                  │  │ Cache Layer     │    │  │ indexer (8980)  │ │
│                  │  └─────────────────┘    │  │ KMD (4002)      │ │
│                  │                          │  └─────────────────┘ │
└──────────────────┴──────────────────────────┴──────────────────────┘
```

---

## 🔐 Security & Authentication Flow

### Complete Authentication Sequence

```mermaid
sequenceDiagram
    participant F as Frontend
    participant B as BFF
    participant W as Wallet (KMD)
    participant C as Smart Contract
    
    F->>B: POST /auth/nonce {address}
    B->>B: Generate random nonce (32 bytes hex)
    B->>B: Store in nonces table (TTL: 5 min)
    B-->>F: {nonce: "abc123..."}
    
    F->>F: Format message: "AlgoCampus auth nonce: abc123..."
    F->>W: signData(message, {scope: AUTH, encoding: utf-8})
    W->>W: Sign with private key
    W-->>F: {signature: base64}
    
    F->>B: POST /auth/verify {address, nonce, signature}
    B->>B: Lookup stored nonce
    B->>B: Verify signature using algosdk.util.verify_bytes()
    B->>B: Load role from roles table (default: student)
    B->>B: Generate JWT with payload: {sub: address, role, iat, exp}
    B->>B: Delete nonce (prevent replay)
    B-->>F: {jwt: "eyJ..."}
    
    F->>F: Store JWT in localStorage
    F->>F: Set Authorization header for all requests
    
    Note over F,C: Subsequent requests use JWT
    F->>B: GET /me (with Authorization: Bearer eyJ...)
    B->>B: Decode & validate JWT
    B->>B: Extract address & role from payload
    B-->>F: {address, role}
```

### Role Synchronization Pattern

**On-Chain Storage** (Source of truth):
```python
# In each contract (voting, attendance, certificate):
self.admin_list = BoxMap(arc4.Address, arc4.Bool, key_prefix=b"adm")
self.faculty_list = BoxMap(arc4.Address, arc4.Bool, key_prefix=b"fac")

@arc4.abimethod
def set_faculty(self, addr: arc4.Address, enabled: arc4.Bool) -> None:
    assert self._is_admin(Txn.sender), "only admin"
    if enabled.native:
        self.faculty_list[addr] = arc4.Bool(True)
    elif addr in self.faculty_list:
        del self.faculty_list[addr]
```

**BFF Cache** (Performance optimization):
```python
# Database: projects/backend/app/infra/db/models.py
async def upsert_role(address: str, role: str) -> None:
    await execute(
        "INSERT INTO roles (address, role) VALUES (?, ?) "
        "ON CONFLICT(address) DO UPDATE SET role=excluded.role",
        (address, role),
    )
```

**Sync Strategy**:
1. Admin updates role via `/admin/role` endpoint
2. BFF calls `contract.set_faculty(address, True)` on-chain
3. Wait for confirmation (4 rounds)
4. Update local cache in `roles` table
5. New JWT issued on next login reflects updated role

---

## 🧩 Smart Contract Deep Dive

### Contract Deployment Architecture

**File**: `projects/contracts/smart_contracts/helpers/deploy.py`

```python
def _deploy_one(algod_client, indexer_client, deployer, name: str) -> int:
    spec_path = ARTIFACTS_DIR / name / f"{name}.arc32.json"
    app_spec = algokit_utils.ApplicationSpecification.from_json(spec_path.read_text())
    
    app_client = algokit_utils.ApplicationClient(
        algod_client=algod_client,
        indexer_client=indexer_client,
        app_spec=app_spec,
        creator=deployer.address,
        signer=deployer.signer,
        sender=deployer.address,
    )
    
    # Deploy with schema break handling
    app_client.deploy(
        version="1.0",
        on_schema_break=algokit_utils.OnSchemaBreak.AppendApp,  # Create new app if schema changes
        on_update=algokit_utils.OnUpdate.AppendApp,              # Create new app on updates
        create_args=algokit_utils.ABICallArgs(method="create_application"),
    )
    
    return app_client.app_id
```

**Manifest Generation**:
After deployment, app IDs are written to `projects/contracts/smart_contracts/artifacts/app_manifest.json`:
```json
{
  "VotingContract": 1234,
  "AttendanceContract": 1235,
  "CertificateRegistryContract": 1236
}
```

This manifest is loaded by BFF at startup via `get_app_ids()` in `infra/algorand/client.py`.

---

### VotingContract - Detailed Implementation

**File**: `projects/contracts/smart_contracts/voting/contract.py`

#### State Schema
```python
# Global State (Contract-level)
self.poll_counter = UInt64(0)  # Incrementing poll ID
self.admin = Account()          # Creator address

# Box Storage (Key-Value Pairs)
# Role Lists
self.admin_list[arc4.Address] → arc4.Bool     # Key: address, Value: true
self.faculty_list[arc4.Address] → arc4.Bool   # Key: address, Value: true

# Poll Metadata (Key = poll_id as 8-byte big-endian)
self.poll_questions[Bytes] → arc4.String      # Key: itob(poll_id)
self.poll_num_options[Bytes] → arc4.UInt64    # Key: itob(poll_id)
self.poll_start_round[Bytes] → arc4.UInt64    # Key: itob(poll_id)
self.poll_end_round[Bytes] → arc4.UInt64      # Key: itob(poll_id)

# Option Names (Key = poll_id ‖ option_index)
self.poll_options[Bytes] → arc4.String        # Key: itob(poll_id) + itob(option_idx)

# Vote Counts (Key = poll_id ‖ option_index)
self.vote_counts[Bytes] → arc4.UInt64         # Key: itob(poll_id) + itob(option_idx)

# Voter Deduplication (Key = poll_id ‖ voter_address)
self.voter_flags[Bytes] → arc4.Bool           # Key: itob(poll_id) + voter.bytes

# AI Intent System
self.ai_intent_expiry[Bytes] → arc4.UInt64    # Key: intent_hash
self.ai_intent_used[Bytes] → arc4.Bool        # Key: intent_hash
```

#### Key Methods

**Poll Creation (Faculty Only)**:
```python
@arc4.abimethod
def create_poll(
    self,
    question: arc4.String,
    options: arc4.DynamicArray[arc4.String],
    start_round: arc4.UInt64,
    end_round: arc4.UInt64,
) -> arc4.UInt64:
    # 1. Authorization check
    assert self._is_admin_or_faculty(Txn.sender), "not authorised"
    
    # 2. Validation
    assert start_round.native < end_round.native, "bad round range"
    num = options.length
    assert num >= UInt64(2), "need >=2 options"
    
    # 3. Increment counter
    new_id = self.poll_counter + UInt64(1)
    self.poll_counter = new_id
    pid = op.itob(new_id)  # Convert to 8-byte big-endian
    
    # 4. Store metadata
    self.poll_questions[pid] = question
    self.poll_num_options[pid] = arc4.UInt64(num)
    self.poll_start_round[pid] = start_round
    self.poll_end_round[pid] = end_round
    
    # 5. Store options and initialize vote counts
    for i in urange(num):
        key = pid + op.itob(i)
        self.poll_options[key] = options[i]
        self.vote_counts[key] = arc4.UInt64(0)
    
    return arc4.UInt64(new_id)
```

**Voting (Students)**:
```python
@arc4.abimethod
def cast_vote(
    self, poll_id: arc4.UInt64, option_index: arc4.UInt64
) -> arc4.Bool:
    return arc4.Bool(self._do_cast_vote(poll_id.native, option_index.native))

@subroutine
def _do_cast_vote(self, poll_id: UInt64, option_index: UInt64) -> bool:
    pid = op.itob(poll_id)
    
    # 1. Existence check
    assert pid in self.poll_num_options, "poll not found"
    
    # 2. Time window check
    assert Global.round >= self.poll_start_round[pid].native, "not started"
    assert Global.round <= self.poll_end_round[pid].native, "ended"
    
    # 3. Option validation
    num = self.poll_num_options[pid].native
    assert option_index < num, "bad option"
    
    # 4. Deduplication check
    voter_key = pid + Txn.sender.bytes
    assert voter_key not in self.voter_flags, "already voted"
    self.voter_flags[voter_key] = arc4.Bool(True)
    
    # 5. Increment vote count
    opt_key = pid + op.itob(option_index)
    cur = self.vote_counts[opt_key].native
    self.vote_counts[opt_key] = arc4.UInt64(cur + UInt64(1))
    
    return True
```

**Atomic Transaction Group Voting**:
```python
@arc4.abimethod
def cast_vote_with_deposit(
    self,
    pay: gtxn.PaymentTransaction,  # Group transaction reference
    poll_id: arc4.UInt64,
    option_index: arc4.UInt64,
) -> arc4.Bool:
    # 1. Validate payment transaction
    assert pay.receiver == Global.current_application_address, "pay to app"
    assert pay.amount >= UInt64(1_000), "min 1 000 µAlgo deposit"
    
    # 2. Cast vote (same logic as cast_vote)
    return arc4.Bool(self._do_cast_vote(poll_id.native, option_index.native))
```

**Usage from Frontend**:
```typescript
// Build atomic transaction group
const payTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
  from: userAddress,
  to: appAddress,
  amount: 1000,
  suggestedParams,
})

const atc = new AtomicTransactionComposer()
atc.addTransaction({ txn: payTxn, signer })
atc.addMethodCall({
  appID: votingAppId,
  method: getMethodByName("cast_vote_with_deposit"),
  methodArgs: [undefined, pollId, optionIndex],  // undefined = use previous txn
  sender: userAddress,
  signer,
  suggestedParams,
})

const result = await atc.execute(algodClient, 4)
```

---

### AttendanceContract - Detailed Implementation

**File**: `projects/contracts/smart_contracts/attendance/contract.py`

#### State Schema
```python
# Global State
self.session_counter = UInt64(0)
self.admin = Account()

# Role Lists (same as VotingContract)
self.admin_list[arc4.Address] → arc4.Bool
self.faculty_list[arc4.Address] → arc4.Bool

# Session Metadata (Key = session_id as 8-byte BE)
self.session_course[Bytes] → arc4.String      # Course code
self.session_ts[Bytes] → arc4.UInt64          # Unix timestamp
self.session_open[Bytes] → arc4.UInt64        # Open round
self.session_close[Bytes] → arc4.UInt64       # Close round

# Roster (Key = session_id ‖ student_address)
self.roster[Bytes] → arc4.Bool                # Attendance flag

# AI Intent System (same as VotingContract)
self.ai_intent_expiry[Bytes] → arc4.UInt64
self.ai_intent_used[Bytes] → arc4.Bool
```

#### Key Methods

**Session Creation (Faculty Only)**:
```python
@arc4.abimethod
def create_session(
    self,
    course_code: arc4.String,
    session_ts: arc4.UInt64,
    open_round: arc4.UInt64,
    close_round: arc4.UInt64,
) -> arc4.UInt64:
    # Authorization
    assert self._is_admin_or_faculty(Txn.sender), "not authorised"
    assert open_round.native < close_round.native, "bad round range"
    
    # Increment counter
    new_id = self.session_counter + UInt64(1)
    self.session_counter = new_id
    sid = op.itob(new_id)
    
    # Store metadata
    self.session_course[sid] = course_code
    self.session_ts[sid] = session_ts
    self.session_open[sid] = open_round
    self.session_close[sid] = close_round
    
    return arc4.UInt64(new_id)
```

**Student Check-In**:
```python
@arc4.abimethod
def check_in(self, session_id: arc4.UInt64) -> arc4.Bool:
    sid = op.itob(session_id.native)
    
    # 1. Existence check
    assert sid in self.session_open, "session not found"
    
    # 2. Time window check
    assert Global.round >= self.session_open[sid].native, "not open yet"
    assert Global.round <= self.session_close[sid].native, "closed"
    
    # 3. Deduplication check
    key = sid + Txn.sender.bytes
    assert key not in self.roster, "already checked in"
    
    # 4. Mark attendance
    self.roster[key] = arc4.Bool(True)
    
    return arc4.Bool(True)
```

**Presence Verification (Read-Only)**:
```python
@arc4.abimethod(readonly=True)
def is_present(
    self, session_id: arc4.UInt64, addr: arc4.Address
) -> arc4.Bool:
    sid = op.itob(session_id.native)
    key = sid + addr.bytes
    return arc4.Bool(key in self.roster)
```

---

### CertificateRegistryContract - Detailed Implementation

**File**: `projects/contracts/smart_contracts/certificate/contract.py`

#### State Schema
```python
# Global State
self.admin = Account()

# Role Lists
self.admin_list[arc4.Address] → arc4.Bool
self.faculty_list[arc4.Address] → arc4.Bool

# Certificate Registry (Key = cert_hash bytes)
self.cert_recipient[Bytes] → arc4.Address     # Recipient address
self.cert_asset[Bytes] → arc4.UInt64          # ASA ID
self.cert_ts[Bytes] → arc4.UInt64             # Issued timestamp

# AI Intent System
self.ai_intent_expiry[Bytes] → arc4.UInt64
self.ai_intent_used[Bytes] → arc4.Bool
```

#### Key Methods

**Certificate Registration (After ASA Minting)**:
```python
@arc4.abimethod
def register_cert(
    self,
    cert_hash: arc4.DynamicBytes,
    recipient: arc4.Address,
    asset_id: arc4.UInt64,
    issued_ts: arc4.UInt64,
) -> arc4.Bool:
    # Authorization
    assert self._is_admin_or_faculty(Txn.sender), "not authorised"
    
    # Uniqueness check
    h = cert_hash.native
    assert h not in self.cert_recipient, "already registered"
    
    # Store certificate data
    self.cert_recipient[h] = recipient
    self.cert_asset[h] = asset_id
    self.cert_ts[h] = issued_ts
    
    return arc4.Bool(True)
```

**Mint and Register (Inner Transaction)**:
```python
@arc4.abimethod
def mint_and_register(
    self,
    cert_hash: arc4.DynamicBytes,
    recipient: arc4.Address,
    metadata_url: arc4.String,
    issued_ts: arc4.UInt64,
) -> arc4.UInt64:
    # Authorization
    assert self._is_admin_or_faculty(Txn.sender), "not authorised"
    
    h = cert_hash.native
    assert h not in self.cert_recipient, "already registered"
    
    # Create ASA via inner transaction
    itxn.AssetConfig(
        total=1,  # NFT: single unit
        decimals=0,
        default_frozen=False,
        unit_name=b"CERT",
        asset_name=b"AlgoCampus Cert",
        url=metadata_url.native,
        manager=Global.creator_address,
        reserve=Global.creator_address,
    ).submit()
    
    # Get created asset ID
    asset_id = itxn.CreatedAssetID
    
    # Register certificate
    self.cert_recipient[h] = recipient
    self.cert_asset[h] = arc4.UInt64(asset_id)
    self.cert_ts[h] = issued_ts
    
    return arc4.UInt64(asset_id)
```

**Verification (Read-Only)**:
```python
@arc4.abimethod(readonly=True)
def verify_cert(self, cert_hash: arc4.DynamicBytes) -> arc4.Tuple[arc4.Bool, arc4.Address, arc4.UInt64, arc4.UInt64]:
    h = cert_hash.native
    if h not in self.cert_recipient:
        return arc4.Tuple((arc4.Bool(False), arc4.Address(), arc4.UInt64(0), arc4.UInt64(0)))
    
    return arc4.Tuple((
        arc4.Bool(True),
        self.cert_recipient[h],
        self.cert_asset[h],
        self.cert_ts[h],
    ))
```

---

## 🎛️ Backend (FastAPI BFF) - Complete Architecture

### Layer-by-Layer Breakdown

#### Layer 1: Domain Models (`app/domain/models.py`)

**Pydantic v2 Models** (All API contracts):

```python
from pydantic import BaseModel, Field
from enum import Enum

class Role(str, Enum):
    ADMIN = "admin"
    FACULTY = "faculty"
    STUDENT = "student"

# Auth Models
class NonceRequest(BaseModel):
    address: str = Field(..., min_length=58, max_length=58)

class NonceResponse(BaseModel):
    nonce: str

class VerifyRequest(BaseModel):
    address: str = Field(..., min_length=58, max_length=58)
    nonce: str
    signature: str

class TokenResponse(BaseModel):
    jwt: str

class MeResponse(BaseModel):
    address: str
    role: str

# Poll Models
class CreatePollRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=500)
    options: list[str] = Field(..., min_length=2, max_length=10)
    start_round: int = Field(..., ge=0)
    end_round: int = Field(..., ge=1)

class PollResponse(BaseModel):
    poll_id: int
    question: str
    options: list[str]
    start_round: int
    end_round: int
    creator: str
    app_id: int
    tx_id: Optional[str] = None
    created: Optional[float] = None

# ... 50+ more models for sessions, certs, AI, etc.
```

---

#### Layer 2: Infrastructure (`app/infra/`)

##### Database Layer (`app/infra/db/`)

**File**: `app/infra/db/database.py`

```python
import aiosqlite
import asyncpg
from typing import Any, Optional

_sqlite_db: aiosqlite.Connection | None = None
_pg_pool: Any = None
_backend: str = "sqlite"  # Default to SQLite

async def init_db() -> None:
    """Initialize database connection (SQLite or PostgreSQL)."""
    global _sqlite_db, _pg_pool, _backend
    settings = get_settings()
    
    if settings.database_url and settings.database_url.startswith("postgresql"):
        # PostgreSQL mode
        try:
            _pg_pool = await asyncpg.create_pool(
                settings.database_url,
                min_size=5,
                max_size=settings.db_pool_size,
                timeout=settings.db_timeout_seconds,
            )
            _backend = "postgres"
            logger.info("Database: PostgreSQL connected")
            await _run_migrations_pg()
        except Exception:
            logger.exception("PostgreSQL connection failed, falling back to SQLite")
            _backend = "sqlite"
    
    if _backend == "sqlite":
        # SQLite fallback
        db_path = settings.db_full_path
        _sqlite_db = await aiosqlite.connect(str(db_path))
        _sqlite_db.row_factory = aiosqlite.Row
        logger.info(f"Database: SQLite at {db_path}")
        await _run_schema_sqlite()

async def execute(sql: str, params: tuple = ()) -> None:
    """Execute a write query (INSERT, UPDATE, DELETE)."""
    if _backend == "postgres":
        async with _pg_pool.acquire() as conn:
            await conn.execute(sql.replace("?", "$1"), *params)
    else:
        await _sqlite_db.execute(sql, params)
        await _sqlite_db.commit()

async def fetch_one(sql: str, params: tuple = ()) -> Optional[dict[str, Any]]:
    """Fetch a single row."""
    if _backend == "postgres":
        async with _pg_pool.acquire() as conn:
            row = await conn.fetchrow(sql.replace("?", "$1"), *params)
            return dict(row) if row else None
    else:
        async with _sqlite_db.execute(sql, params) as cursor:
            row = await cursor.fetchone()
            return dict(row) if row else None

async def fetch_all(sql: str, params: tuple = ()) -> list[dict[str, Any]]:
    """Fetch multiple rows."""
    if _backend == "postgres":
        async with _pg_pool.acquire() as conn:
            rows = await conn.fetch(sql.replace("?", "$1"), *params)
            return [dict(row) for row in rows]
    else:
        async with _sqlite_db.execute(sql, params) as cursor:
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]
```

**Database Schema** (15 tables):

```sql
-- Authentication & Authorization
CREATE TABLE roles (
    address TEXT PRIMARY KEY,
    role TEXT NOT NULL DEFAULT 'student' CHECK(role IN ('admin','faculty','student'))
);

CREATE TABLE nonces (
    address TEXT PRIMARY KEY,
    nonce TEXT NOT NULL,
    created REAL NOT NULL,
    expires_at REAL NOT NULL  -- Auto-expire after 5 minutes
);

-- Transaction Tracking
CREATE TABLE tx_tracking (
    tx_id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,  -- 'vote', 'checkin', 'cert', 'deposit', 'feedback', 'ai', 'other'
    status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'confirmed', 'failed'
    confirmed_round INTEGER,
    session_id INTEGER,
    course_code TEXT,
    student_address TEXT,
    created REAL NOT NULL,
    updated REAL NOT NULL
);

-- Certificate Metadata (ARC-3 JSON storage)
CREATE TABLE cert_metadata (
    cert_hash TEXT PRIMARY KEY,  -- SHA-256 of canonical cert data
    recipient TEXT NOT NULL,
    asset_id INTEGER,
    metadata TEXT NOT NULL,  -- Full ARC-3 JSON
    created REAL NOT NULL
);

-- Poll Cache (Performance optimization)
CREATE TABLE polls (
    poll_id INTEGER PRIMARY KEY,
    question TEXT NOT NULL,
    options_json TEXT NOT NULL,  -- JSON array of strings
    start_round INTEGER NOT NULL,
    end_round INTEGER NOT NULL,
    creator TEXT NOT NULL,
    app_id INTEGER NOT NULL,
    tx_id TEXT,
    created REAL NOT NULL
);

-- Session Cache
CREATE TABLE sessions (
    session_id INTEGER PRIMARY KEY,
    course_code TEXT NOT NULL,
    session_ts INTEGER NOT NULL,  -- Unix timestamp
    open_round INTEGER NOT NULL,
    close_round INTEGER NOT NULL,
    creator TEXT NOT NULL,
    app_id INTEGER NOT NULL,
    tx_id TEXT,
    created REAL NOT NULL
);

-- Activity Feed (Audit Trail)
CREATE TABLE activity_events (
    id TEXT PRIMARY KEY,  -- UUID
    kind TEXT NOT NULL,  -- 'poll_created', 'vote_cast', 'session_created', etc.
    title TEXT NOT NULL,
    description TEXT,
    actor TEXT,  -- Address of user who triggered action
    tx_id TEXT,  -- Link to blockchain transaction
    created REAL NOT NULL,
    tags_json TEXT NOT NULL DEFAULT '[]'  -- JSON array for filtering
);

-- Feedback System
CREATE TABLE feedback_commits (
    id TEXT PRIMARY KEY,
    author TEXT NOT NULL,
    hash TEXT NOT NULL,  -- Content hash
    course_code TEXT,
    metadata_json TEXT,
    tx_id TEXT,
    created REAL NOT NULL
);

-- Coordination Tasks
CREATE TABLE coordination_tasks (
    task_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    owner TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',  -- 'open', 'in_progress', 'completed', 'archived'
    payload_hash TEXT,  -- Hash of task data
    anchor_tx_id TEXT,  -- Blockchain anchor
    created REAL NOT NULL,
    updated REAL NOT NULL
);

-- AI Intent System
CREATE TABLE ai_intents (
    intent_id TEXT PRIMARY KEY,
    intent_hash TEXT NOT NULL UNIQUE,  -- Hash of intent data
    action_type TEXT NOT NULL,  -- 'faculty_poll_plan', 'faculty_session_plan', etc.
    risk_level TEXT NOT NULL,  -- 'low', 'medium', 'high'
    payload_json TEXT NOT NULL,
    auto_execute INTEGER NOT NULL DEFAULT 0,  -- Boolean
    status TEXT NOT NULL,  -- 'planned', 'approved', 'executed', 'failed'
    created REAL NOT NULL,
    updated REAL NOT NULL,
    created_by TEXT NOT NULL
);

CREATE TABLE ai_executions (
    execution_id TEXT PRIMARY KEY,
    intent_id TEXT NOT NULL,
    status TEXT NOT NULL,
    message TEXT,
    tx_id TEXT,
    confirmed_round INTEGER,
    created REAL NOT NULL
);

-- Announcements
CREATE TABLE announcements (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    poll_id INTEGER,  -- Optional link to poll
    category TEXT NOT NULL,  -- 'academic', 'administrative', 'social', etc.
    audience TEXT NOT NULL,  -- 'all', 'students', 'faculty', etc.
    author_address TEXT NOT NULL,
    author_role TEXT NOT NULL,
    is_pinned INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    hash TEXT NOT NULL,
    anchor_tx_id TEXT,
    created REAL NOT NULL,
    updated REAL NOT NULL
);

-- Poll Context (Rich metadata for polls)
CREATE TABLE poll_context (
    poll_id INTEGER PRIMARY KEY,
    purpose TEXT NOT NULL,
    audience TEXT NOT NULL,
    category TEXT NOT NULL,
    extra_note TEXT,
    updated_by TEXT NOT NULL,
    hash TEXT NOT NULL,
    anchor_tx_id TEXT,
    updated REAL NOT NULL
);

-- Attendance Records (Faculty review system)
CREATE TABLE attendance_records (
    id TEXT PRIMARY KEY,
    session_id INTEGER NOT NULL,
    course_code TEXT NOT NULL,
    student_address TEXT NOT NULL,
    status TEXT NOT NULL,  -- 'present', 'absent', 'late', 'excused'
    tx_id TEXT,
    anchor_tx_id TEXT,
    attended_at REAL NOT NULL,
    created REAL NOT NULL,
    UNIQUE(session_id, student_address)
);

-- User Profiles
CREATE TABLE user_profiles (
    address TEXT PRIMARY KEY,
    display_name TEXT,
    avatar_url TEXT,
    avatar_hash TEXT,
    avatar_anchor_tx_id TEXT,
    updated REAL NOT NULL
);
```

---

##### Algorand Layer (`app/infra/algorand/`)

**File**: `app/infra/algorand/client.py`

```python
from algosdk import account, kmd, mnemonic
from algosdk.v2client.algod import AlgodClient
from algosdk.v2client.indexer import IndexerClient
from functools import lru_cache
from pathlib import Path
import json

@lru_cache
def get_algod(settings: Settings | None = None) -> AlgodClient:
    """Create algod client for LocalNet."""
    s = settings or get_settings()
    return AlgodClient(s.algod_token, s.algod_url)

@lru_cache
def get_indexer(settings: Settings | None = None) -> IndexerClient:
    """Create indexer client for LocalNet."""
    s = settings or get_settings()
    return IndexerClient(s.indexer_token, s.indexer_url)

@lru_cache
def get_kmd(settings: Settings | None = None) -> kmd.KMDClient:
    """Create KMD client for LocalNet."""
    s = settings or get_settings()
    return kmd.KMDClient(s.kmd_token, s.kmd_url)

def get_localnet_default_account() -> tuple[str, str]:
    """
    Return (address, private_key) of the default-funded LocalNet account.
    
    This account has ~1000 Algos and is used for:
    - Deploying contracts
    - Funding new accounts
    - Paying transaction fees for certificate minting
    """
    kmd_client = get_kmd()
    wallets = kmd_client.list_wallets()
    
    # Find the default wallet
    default_wallet_id: Optional[str] = None
    for w in wallets:
        if w["name"] == "unencrypted-default-wallet":
            default_wallet_id = w["id"]
            break
    
    if default_wallet_id is None:
        raise RuntimeError("LocalNet default wallet not found – is localnet running?")
    
    # Get wallet handle
    handle = kmd_client.init_wallet_handle(default_wallet_id, "")
    keys = kmd_client.list_keys(handle)
    
    if not keys:
        raise RuntimeError("No keys in default wallet")
    
    address = keys[0]
    private_key = kmd_client.export_key(handle, "", address)
    
    return address, private_key

_manifest_cache: Optional[dict[str, int]] = None

def get_app_ids() -> dict[str, int]:
    """
    Load deployed app IDs from manifest.
    
    Returns:
        {
            "VotingContract": 1234,
            "AttendanceContract": 1235,
            "CertificateRegistryContract": 1236
        }
    """
    global _manifest_cache
    if _manifest_cache is not None:
        return _manifest_cache
    
    s = get_settings()
    p = Path(s.app_manifest_path)
    
    if not p.exists():
        raise FileNotFoundError(
            f"App manifest not found at {p.resolve()}. "
            "Run `algokit project run deploy` in the contracts project first."
        )
    
    _manifest_cache = json.loads(p.read_text())
    return _manifest_cache
```

**File**: `app/infra/algorand/indexer.py` (Current file)

```python
import base64
import hashlib
from algosdk.v2client.indexer import IndexerClient

def _selector(sig: str) -> str:
    """
    Compute ABI method selector (first 4 bytes of SHA-512/256 hash).
    
    Example:
        _selector("create_poll(string,string[],uint64,uint64)uint64")
        → "vfKR7w==" (base64-encoded 4 bytes)
    """
    h = hashlib.new("sha512_256", sig.encode()).digest()[:4]
    return base64.b64encode(h).decode()

# Pre-compute selectors for all contract methods
_SEL_CREATE_POLL = _selector("create_poll(string,string[],uint64,uint64)uint64")
_SEL_CAST_VOTE = _selector("cast_vote(uint64,uint64)bool")
_SEL_CAST_VOTE_DEP = _selector("cast_vote_with_deposit(pay,uint64,uint64)bool")
_SEL_CREATE_SESSION = _selector("create_session(string,uint64,uint64,uint64)uint64")
_SEL_CHECK_IN = _selector("check_in(uint64)bool")
_SEL_REGISTER_CERT = _selector("register_cert(byte[],address,uint64,uint64)bool")
_SEL_MINT_REG = _selector("mint_and_register(byte[],address,string,uint64)uint64")

def _search_app_txns(app_id: int, limit: int = 500) -> list[dict]:
    """Fetch all application call transactions for an app."""
    idx = get_indexer()
    try:
        resp = idx.search_transactions(application_id=app_id, limit=limit)
        return resp.get("transactions", [])
    except Exception:
        logger.debug("Indexer search failed for app %d", app_id, exc_info=True)
        return []

def _count_by_selector(txns: list[dict]) -> dict[str, int]:
    """
    Group transactions by their method selector.
    
    Returns:
        {
            "vfKR7w==": 5,  # 5 create_poll calls
            "xYzAbc==": 23, # 23 cast_vote calls
            ...
        }
    """
    counts: dict[str, int] = {}
    for tx in txns:
        app_call = tx.get("application-transaction", {})
        args = app_call.get("application-args", [])
        
        # First arg is the method selector (base64)
        sel = args[0] if args else "bare"
        counts[sel] = counts.get(sel, 0) + 1
    
    return counts

def get_analytics_summary() -> dict[str, int]:
    """
    Build analytics summary by counting contract method calls.
    
    Returns:
        {
            "total_polls": 12,
            "total_votes": 345,
            "total_sessions": 8,
            "total_checkins": 156,
            "total_certs": 5
        }
    """
    try:
        ids = get_app_ids()
    except FileNotFoundError:
        # Contracts not deployed yet
        return {
            "total_polls": 0,
            "total_votes": 0,
            "total_sessions": 0,
            "total_checkins": 0,
            "total_certs": 0,
        }
    
    # Fetch transactions for each contract
    voting_id = ids.get("VotingContract", 0)
    attendance_id = ids.get("AttendanceContract", 0)
    cert_id = ids.get("CertificateRegistryContract", 0)
    
    # Count by selector
    v_counts = _count_by_selector(_search_app_txns(voting_id)) if voting_id else {}
    a_counts = _count_by_selector(_search_app_txns(attendance_id)) if attendance_id else {}
    c_counts = _count_by_selector(_search_app_txns(cert_id)) if cert_id else {}
    
    return {
        "total_polls": v_counts.get(_SEL_CREATE_POLL, 0),
        "total_votes": v_counts.get(_SEL_CAST_VOTE, 0) + v_counts.get(_SEL_CAST_VOTE_DEP, 0),
        "total_sessions": a_counts.get(_SEL_CREATE_SESSION, 0),
        "total_checkins": a_counts.get(_SEL_CHECK_IN, 0),
        "total_certs": c_counts.get(_SEL_REGISTER_CERT, 0) + c_counts.get(_SEL_MINT_REG, 0),
    }

def lookup_tx(tx_id: str) -> Optional[dict[str, Any]]:
    """
    Lookup transaction in indexer.
    
    Returns None if not yet indexed (usually takes 1-2 rounds).
    """
    idx = get_indexer()
    try:
        resp = idx.transaction(tx_id)
        return resp.get("transaction")
    except Exception:
        return None
```

**File**: `app/infra/algorand/chain.py` (Chain interaction helpers)

```python
from algosdk import transaction
from algosdk.atomic_transaction_composer import (
    AtomicTransactionComposer,
    AccountTransactionSigner,
)
from algosdk.abi import Method

def current_round() -> int:
    """Get current blockchain round."""
    algod = get_algod()
    status = algod.status()
    return status["last-round"]

def create_poll_on_chain(
    question: str,
    options: list[str],
    start_round: int,
    end_round: int,
) -> tuple[int, str]:
    """
    Call VotingContract.create_poll() on-chain.
    
    Returns:
        (poll_id, tx_id)
    """
    algod = get_algod()
    sender, sk = get_localnet_default_account()
    sp = algod.suggested_params()
    
    app_id = get_app_ids()["VotingContract"]
    
    # Build ATC
    atc = AtomicTransactionComposer()
    signer = AccountTransactionSigner(sk)
    
    method = Method.from_signature("create_poll(string,string[],uint64,uint64)uint64")
    
    atc.add_method_call(
        app_id=app_id,
        method=method,
        sender=sender,
        sp=sp,
        signer=signer,
        method_args=[question, options, start_round, end_round],
    )
    
    result = atc.execute(algod, wait_rounds=4)
    tx_id = result.tx_ids[0]
    
    # Extract return value (poll_id) from logs
    poll_id = result.abi_results[0].return_value
    
    return int(poll_id), tx_id

def create_poll_ai_on_chain(
    question: str,
    options: list[str],
    start_round: int,
    end_round: int,
    intent_hash: bytes,
    expires_round: int,
) -> tuple[int, str]:
    """
    Call VotingContract.create_poll_ai() with AI intent consumption.
    
    Process:
    1. Record intent on-chain first (if not already recorded)
    2. Call create_poll_ai which consumes the intent
    """
    algod = get_algod()
    sender, sk = get_localnet_default_account()
    sp = algod.suggested_params()
    
    app_id = get_app_ids()["VotingContract"]
    atc = AtomicTransactionComposer()
    signer = AccountTransactionSigner(sk)
    
    # First, record the intent
    record_method = Method.from_signature("record_ai_intent(byte[],uint64)bool")
    atc.add_method_call(
        app_id=app_id,
        method=record_method,
        sender=sender,
        sp=sp,
        signer=signer,
        method_args=[intent_hash, expires_round],
    )
    
    # Then, call create_poll_ai which consumes it
    create_method = Method.from_signature(
        "create_poll_ai(string,string[],uint64,uint64,byte[])uint64"
    )
    atc.add_method_call(
        app_id=app_id,
        method=create_method,
        sender=sender,
        sp=sp,
        signer=signer,
        method_args=[question, options, start_round, end_round, intent_hash],
    )
    
    result = atc.execute(algod, wait_rounds=4)
    tx_id = result.tx_ids[1]  # Second transaction
    poll_id = result.abi_results[1].return_value
    
    return int(poll_id), tx_id

# Similar functions for:
# - create_session_on_chain()
# - create_session_ai_on_chain()
# - register_cert_on_chain()
```

---

##### AI Layer (`app/infra/ai/`)

**File**: `app/infra/ai/policy.py`

```python
from app.domain.models import AiActionType, AiRiskLevel, AiExecutionMode

def infer_risk(action_type: AiActionType) -> AiRiskLevel:
    """
    Classify risk level based on action type.
    
    LOW: Routine academic operations
    MEDIUM: Actions affecting multiple users
    HIGH: Administrative/financial operations
    """
    low_risk = {
        AiActionType.FACULTY_POLL,
        AiActionType.FACULTY_SESSION,
        AiActionType.FACULTY_CERT,
        AiActionType.COORD_TASK,
    }
    
    high_risk = {
        AiActionType.ADMIN_ROLE_RISK,
        AiActionType.ADMIN_SYSTEM,
    }
    
    if action_type in low_risk:
        return AiRiskLevel.LOW
    elif action_type in high_risk:
        return AiRiskLevel.HIGH
    else:
        return AiRiskLevel.MEDIUM

def execution_mode(
    action_type: AiActionType,
    user_requested_auto: bool,
    system_auto_enabled: bool,
) -> AiExecutionMode:
    """
    Determine if action should auto-execute or require approval.
    
    Rules:
    1. HIGH risk → Always require approval
    2. LOW risk + auto enabled → Auto-execute
    3. Otherwise → Require approval
    """
    risk = infer_risk(action_type)
    
    if risk == AiRiskLevel.HIGH:
        return AiExecutionMode.APPROVAL_REQUIRED
    
    if risk == AiRiskLevel.LOW and (user_requested_auto or system_auto_enabled):
        return AiExecutionMode.AUTO
    
    return AiExecutionMode.APPROVAL_REQUIRED
```

**File**: `app/infra/ai/gemini_client.py`

```python
import httpx
from app.config import get_settings

async def generate_plan(
    action_type: str,
    prompt: str,
    context: dict,
) -> dict:
    """
    Call Gemini API to generate action plan.
    
    Returns:
        {
            "course_code": "CSE101",
            "session_ts": 1709251200,
            "open_round": 12345,
            "close_round": 12445
        }
    """
    settings = get_settings()
    
    if not settings.ai_enabled or not settings.gemini_api_key:
        raise RuntimeError("Gemini API not configured")
    
    # Build prompt
    system_prompt = f"""You are an AI assistant for AlgoCampus, an academic blockchain platform.
Action Type: {action_type}
Generate a valid JSON response for this action based on the user's prompt.
"""
    
    user_message = f"Prompt: {prompt}\nContext: {json.dumps(context)}"
    
    # Call Gemini API
    async with httpx.AsyncClient(timeout=settings.gemini_timeout_seconds) as client:
        response = await client.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_model}:generateContent",
            headers={
                "Content-Type": "application/json",
                "x-goog-api-key": settings.gemini_api_key,
            },
            json={
                "contents": [
                    {"role": "user", "parts": [{"text": system_prompt}]},
                    {"role": "user", "parts": [{"text": user_message}]},
                ],
                "generationConfig": {
                    "temperature": 0.2,
                    "topK": 32,
                    "topP": 1,
                    "maxOutputTokens": 1024,
                },
            },
        )
    
    # Extract JSON from response
    data = response.json()
    text = data["candidates"][0]["content"]["parts"][0]["text"]
    
    # Parse JSON (handle markdown code blocks)
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0]
    elif "```" in text:
        text = text.split("```")[1].split("```")[0]
    
    return json.loads(text.strip())
```

**File**: `app/infra/ai/fallback_client.py`

```python
import time
from app.infra.algorand.client import get_algod

def build_plan(action_type: str, prompt: str, context: dict) -> dict:
    """
    Rule-based fallback when Gemini API is unavailable.
    
    Uses simple heuristics to generate valid action plans.
    """
    algod = get_algod()
    status = algod.status()
    current_round = status["last-round"]
    
    if action_type == "faculty_poll_plan":
        return {
            "question": f"Auto-generated poll: {prompt[:100]}",
            "options": ["Yes", "No", "Abstain"],
            "start_round": current_round + 5,
            "end_round": current_round + 100,
        }
    
    elif action_type == "faculty_session_plan":
        return {
            "course_code": context.get("payload", {}).get("course_code", "AUTO-SESSION"),
            "session_ts": int(time.time()),
            "open_round": current_round + 5,
            "close_round": current_round + 50,
        }
    
    elif action_type == "faculty_certificate_plan":
        return {
            "recipient_address": context.get("recipient", ""),
            "recipient_name": context.get("name", "Student"),
            "course_code": context.get("course", "COURSE"),
            "title": f"Certificate: {prompt[:100]}",
            "description": prompt,
        }
    
    else:
        raise ValueError(f"Unknown action type: {action_type}")
```

---

#### Layer 3: Use Cases (`app/usecases/`)

**File**: `app/usecases/auth_uc.py`

```python
import secrets
from algosdk import util
from app.auth import create_jwt
from app.infra.db.models import upsert_nonce, get_nonce, delete_nonce, get_role

async def generate_nonce(address: str) -> str:
    """
    Generate and store a random nonce for signature challenge.
    
    Nonce expires after 5 minutes.
    """
    nonce = secrets.token_hex(16)  # 32-character hex string
    await upsert_nonce(address, nonce)
    return nonce

def _verify_signature(address: str, message: bytes, signature_b64: str) -> bool:
    """
    Verify Ed25519 signature using algosdk.
    
    Args:
        address: Algorand address (58 chars base32)
        message: Original message bytes
        signature_b64: Base64-encoded signature
    
    Returns:
        True if signature is valid
    """
    try:
        return bool(util.verify_bytes(message, signature_b64, address))
    except Exception:
        return False

async def verify_and_issue_jwt(address: str, nonce: str, signature: str) -> str | None:
    """
    Complete authentication flow:
    1. Verify nonce matches stored value
    2. Verify signature
    3. Issue JWT with role
    4. Clear nonce (prevent replay)
    
    Returns:
        JWT string on success, None on failure
    """
    # Check nonce
    stored = await get_nonce(address)
    if stored is None or stored != nonce:
        await activity_uc.log_event(
            kind="auth_verify_failed",
            title="Auth verification failed",
            description="nonce mismatch",
            actor=address,
            tags=["auth", "failed"],
        )
        return None
    
    # Verify signature
    message = f"AlgoCampus auth nonce: {nonce}".encode()
    if not _verify_signature(address, message, signature):
        await activity_uc.log_event(
            kind="auth_verify_failed",
            title="Auth verification failed",
            description="signature mismatch",
            actor=address,
            tags=["auth", "failed"],
        )
        return None
    
    # Delete nonce (one-time use)
    await delete_nonce(address)
    
    # Load role from database
    role = await get_role(address)  # Default: "student"
    
    # Create JWT
    token = create_jwt(address, role)
    
    # Log success
    await activity_uc.log_event(
        kind="auth_verified",
        title="Auth verified",
        description=f"role={role}",
        actor=address,
        tags=["auth", f"role:{role}"],
    )
    
    return token
```

**File**: `app/usecases/certificate_uc.py`

```python
import hashlib
import json
import time
from algosdk import transaction, encoding
from algosdk.abi import Method
from algosdk.atomic_transaction_composer import (
    AtomicTransactionComposer,
    AccountTransactionSigner,
)
from app.domain.models import IssueCertRequest, IssueCertResponse
from app.infra.algorand.client import get_algod, get_app_ids, get_localnet_default_account
from app.infra.db.models import store_cert_metadata

async def issue(req: IssueCertRequest) -> IssueCertResponse:
    """
    Complete certificate issuance pipeline.
    
    Steps:
    1. Build canonical payload + compute hash
    2. Generate ARC-3 metadata JSON
    3. Mint ASA/NFT with metadata URL
    4. Register cert hash on-chain
    5. Store metadata in database
    6. Log activity event
    
    Returns:
        IssueCertResponse with cert_hash, asset_id, metadata_url, tx_id
    """
    settings = get_settings()
    algod_client = get_algod()
    sender, sk = get_localnet_default_account()
    sp = algod_client.suggested_params()
    
    # Step 1: Canonical payload + hash
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
    
    # Step 2: ARC-3 metadata
    metadata_url = f"{settings.bff_base_url}/metadata/cert/{cert_hash_hex}.json"
    arc3 = {
        "name": f"Certificate: {req.title}",
        "description": req.description or f"AlgoCampus certificate for {req.course_code}",
        "image": "",  # Could host badge image
        "properties": {
            "recipient": req.recipient_address,
            "recipient_name": req.recipient_name,
            "course_code": req.course_code,
            "issued_ts": canonical["issued_ts"],
        },
    }
    
    # Step 3: Mint ASA/NFT
    txn_create = transaction.AssetConfigTxn(
        sender=sender,
        sp=sp,
        total=1,  # NFT: single unit
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
    
    # Step 4: Register on-chain (optional but recommended)
    try:
        ids = get_app_ids()
        cert_app_id = ids.get("CertificateRegistryContract")
        if cert_app_id:
            atc = AtomicTransactionComposer()
            signer = AccountTransactionSigner(sk)
            
            method = Method.from_signature("register_cert(byte[],address,uint64,uint64)bool")
            
            atc.add_method_call(
                app_id=cert_app_id,
                method=method,
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
    
    # Step 5: Store metadata in database
    await store_cert_metadata(
        cert_hash=cert_hash_hex,
        recipient=req.recipient_address,
        asset_id=asset_id,
        metadata_json=json.dumps(arc3),
    )
    
    # Step 6: Log activity
    await activity_uc.log_event(
        kind="cert_issued",
        title="Certificate issued",
        description=req.title,
        actor=req.recipient_address,
        tx_id=tx_id,
        tags=[f"cert:{cert_hash_hex}", f"course:{req.course_code}"],
    )
    
    return IssueCertResponse(
        cert_hash=cert_hash_hex,
        asset_id=asset_id,
        metadata_url=metadata_url,
        tx_id=tx_id,
    )
```

**File**: `app/usecases/ai_uc.py`

```python
import hashlib
import json
import uuid
from app.domain.models import (
    AiActionType,
    AiPlanRequest,
    AiPlanResponse,
    AiExecuteResponse,
    AiRiskLevel,
    AiExecutionMode,
)
from app.infra.ai import gemini_client, fallback_client, policy
from app.infra.algorand.chain import (
    create_poll_ai_on_chain,
    create_session_ai_on_chain,
    current_round,
)
from app.infra.db.models import (
    add_ai_intent,
    get_ai_intent,
    update_ai_intent_status,
    add_ai_execution,
    insert_poll,
    insert_session,
)

def _canonical_hash(payload: dict) -> str:
    """Compute deterministic hash of payload."""
    packed = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(packed).hexdigest()

async def _provider_plan(action_type: AiActionType, req: AiPlanRequest) -> dict:
    """Generate plan using Gemini or fallback."""
    settings = get_settings()
    
    if settings.ai_enabled and settings.gemini_api_key:
        try:
            return await gemini_client.generate_plan(
                action_type.value,
                req.prompt,
                req.context,
            )
        except Exception:
            logger.warning("Gemini API failed, using fallback")
            return fallback_client.build_plan(
                action_type.value,
                req.prompt,
                req.context,
            )
    
    return fallback_client.build_plan(
        action_type.value,
        req.prompt,
        req.context,
    )

async def create_plan(
    action_type: AiActionType,
    req: AiPlanRequest,
    actor: str,
) -> AiPlanResponse:
    """
    Create AI plan with risk assessment.
    
    Flow:
    1. Classify risk level
    2. Determine execution mode
    3. Generate plan via AI
    4. Store intent in database
    5. Auto-execute if low risk
    
    Returns:
        AiPlanResponse with intent_id, plan, execution status
    """
    settings = get_settings()
    
    # Step 1: Risk classification
    risk = policy.infer_risk(action_type)
    
    # Step 2: Execution mode
    mode = policy.execution_mode(
        action_type,
        req.auto_execute,
        settings.ai_auto_execute_low_risk,
    )
    
    # Step 3: Generate plan
    generated = await _provider_plan(action_type, req)
    
    # Build payload
    payload = {
        "prompt": req.prompt,
        "context": req.context,
        "generated": generated,
        "payload": req.context.get("payload", {}),
    }
    
    # Compute intent hash
    intent_hash = _canonical_hash({
        "action_type": action_type.value,
        "payload": payload,
    })
    
    intent_id = f"intent-{uuid.uuid4().hex[:12]}"
    
    # Step 4: Store intent
    await add_ai_intent(
        intent_id=intent_id,
        intent_hash=intent_hash,
        action_type=action_type.value,
        risk_level=risk.value,
        payload_json=json.dumps(payload),
        auto_execute=mode == AiExecutionMode.AUTO,
        status="planned",
        created_by=actor,
    )
    
    # Log activity
    await activity_uc.log_event(
        kind="ai_plan_created",
        title=f"AI plan created ({action_type.value})",
        description=req.prompt[:180],
        actor=actor,
        tags=["ai", f"intent:{intent_id}", f"risk:{risk.value}"],
    )
    
    message = "plan created"
    
    # Step 5: Auto-execute if allowed
    if mode == AiExecutionMode.AUTO:
        exec_result = await execute_intent(intent_id, actor)
        message = f"auto execution status: {exec_result.status}"
    
    return AiPlanResponse(
        intent_id=intent_id,
        intent_hash=intent_hash,
        action_type=action_type,
        risk_level=risk,
        execution_mode=mode,
        plan={"generated": generated, "payload": payload.get("payload", {})},
        message=message,
    )

async def execute_intent(intent_id: str, actor: str) -> AiExecuteResponse:
    """
    Execute a planned AI intent.
    
    Process:
    1. Load intent from database
    2. Check risk level vs execution mode
    3. Extract action parameters
    4. Call appropriate contract method with AI intent consumption
    5. Update intent status
    6. Log execution
    """
    # Step 1: Load intent
    row = await get_ai_intent(intent_id)
    if row is None:
        raise RuntimeError("intent not found")
    
    action_type = AiActionType(str(row["action_type"]))
    risk = AiRiskLevel(str(row["risk_level"]))
    mode = (
        AiExecutionMode.AUTO
        if bool(row.get("auto_execute"))
        else AiExecutionMode.APPROVAL_REQUIRED
    )
    
    # Step 2: Risk check
    if risk != AiRiskLevel.LOW and mode != AiExecutionMode.AUTO:
        await update_ai_intent_status(intent_id, "approval_required")
        return AiExecuteResponse(
            intent_id=intent_id,
            status="approval_required",
            risk_level=risk,
            execution_mode=AiExecutionMode.APPROVAL_REQUIRED,
            message="high-risk action requires manual approval",
        )
    
    # Step 3: Extract parameters
    payload = json.loads(str(row["payload_json"]))
    action_payload = payload.get("payload", {})
    intent_hash_hex = str(row["intent_hash"])
    intent_hash = bytes.fromhex(intent_hash_hex)
    expires_round = current_round() + 30  # 30 rounds ≈ 2.5 minutes
    
    tx_id: str | None = None
    message = "executed"
    
    try:
        # Step 4: Execute based on action type
        if action_type == AiActionType.FACULTY_POLL:
            question = str(action_payload.get("question", "")).strip()
            options = list(action_payload.get("options", []))
            start_round = int(action_payload.get("start_round", 0))
            end_round = int(action_payload.get("end_round", 0))
            
            if not question or len(options) < 2 or end_round <= start_round:
                raise RuntimeError("invalid poll payload")
            
            poll_id, tx_id = create_poll_ai_on_chain(
                question,
                options,
                start_round,
                end_round,
                intent_hash,
                expires_round,
            )
            
            # Cache in database
            app_ids = get_app_ids()
            app_id = int(app_ids.get("VotingContract", 0))
            if app_id:
                await insert_poll(
                    poll_id=int(poll_id),
                    question=question,
                    options_json=json.dumps(options),
                    start_round=start_round,
                    end_round=end_round,
                    creator=actor,
                    app_id=app_id,
                    tx_id=tx_id,
                )
            
            message = f"poll created via ai: {poll_id}"
        
        elif action_type == AiActionType.FACULTY_SESSION:
            course_code = str(action_payload.get("course_code", "")).strip()
            session_ts = int(action_payload.get("session_ts", 0))
            open_round = int(action_payload.get("open_round", 0))
            close_round = int(action_payload.get("close_round", 0))
            
            if not course_code or close_round <= open_round:
                raise RuntimeError("invalid session payload")
            
            session_id, tx_id = create_session_ai_on_chain(
                course_code,
                session_ts,
                open_round,
                close_round,
                intent_hash,
                expires_round,
            )
            
            # Cache in database
            app_ids = get_app_ids()
            app_id = int(app_ids.get("AttendanceContract", 0))
            if app_id:
                await insert_session(
                    session_id=int(session_id),
                    course_code=course_code,
                    session_ts=session_ts,
                    open_round=open_round,
                    close_round=close_round,
                    creator=actor,
                    app_id=app_id,
                    tx_id=tx_id,
                )
            
            message = f"session created via ai: {session_id}"
        
        else:
            raise RuntimeError(f"unsupported action type: {action_type}")
        
        # Step 5: Update status
        await update_ai_intent_status(intent_id, "executed")
        
        # Log execution
        await add_ai_execution(
            execution_id=f"exec-{uuid.uuid4().hex[:12]}",
            intent_id=intent_id,
            status="executed",
            message=message,
            tx_id=tx_id,
        )
        
        await activity_uc.log_event(
            kind="ai_executed",
            title=f"AI intent executed ({action_type.value})",
            description=message,
            actor=actor,
            tx_id=tx_id,
            tags=["ai", f"intent:{intent_id}", "executed"],
        )
        
        return AiExecuteResponse(
            intent_id=intent_id,
            status="executed",
            risk_level=risk,
            execution_mode=mode,
            tx_id=tx_id,
            message=message,
        )
    
    except Exception as e:
        # Step 5: Update status on failure
        await update_ai_intent_status(intent_id, "failed")
        
        error_msg = str(e)
        await add_ai_execution(
            execution_id=f"exec-{uuid.uuid4().hex[:12]}",
            intent_id=intent_id,
            status="failed",
            message=error_msg,
            tx_id=None,
        )
        
        await activity_uc.log_event(
            kind="ai_execution_failed",
            title=f"AI execution failed ({action_type.value})",
            description=error_msg,
            actor=actor,
            tags=["ai", f"intent:{intent_id}", "failed"],
        )
        
        return AiExecuteResponse(
            intent_id=intent_id,
            status="failed",
            risk_level=risk,
            execution_mode=mode,
            message=error_msg,
        )
```

---

#### Layer 4: API Routes (`app/api/`)

**File**: `app/api/auth_routes.py`

```python
from fastapi import APIRouter
from app.domain.models import (
    NonceRequest,
    NonceResponse,
    VerifyRequest,
    TokenResponse,
)
from app.usecases import auth_uc

router = APIRouter()

@router.post("/nonce", response_model=NonceResponse)
async def request_nonce(body: NonceRequest) -> NonceResponse:
    """
    Generate authentication nonce for address.
    
    User will sign this nonce with their wallet.
    """
    nonce = await auth_uc.generate_nonce(body.address)
    return NonceResponse(nonce=nonce)

@router.post("/verify", response_model=TokenResponse)
async def verify_signature(body: VerifyRequest) -> TokenResponse:
    """
    Verify signature and issue JWT.
    
    Raises 401 if verification fails.
    """
    jwt = await auth_uc.verify_and_issue_jwt(
        body.address,
        body.nonce,
        body.signature,
    )
    
    if jwt is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid nonce or signature",
        )
    
    return TokenResponse(jwt=jwt)
```

**File**: `app/api/me.py`

```python
from typing import Annotated
from fastapi import APIRouter, Depends
from app.auth import TokenPayload, get_current_user
from app.domain.models import MeResponse

router = APIRouter()

@router.get("/me", response_model=MeResponse)
async def get_me(
    user: Annotated[TokenPayload, Depends(get_current_user)],
) -> MeResponse:
    """
    Get current user's profile from JWT.
    
    Requires: Authorization header with Bearer token
    """
    return MeResponse(
        address=user.address,
        role=user.role,
    )
```

**File**: `app/api/faculty.py`

```python
from typing import Annotated
from fastapi import APIRouter, Depends
from app.auth import TokenPayload, require_faculty
from app.domain.models import (
    CreatePollRequest,
    PollResponse,
    CreateSessionRequest,
    SessionResponse,
    IssueCertRequest,
    IssueCertResponse,
)
from app.usecases import polls_uc, sessions_uc, certificate_uc

router = APIRouter()

@router.post("/polls", response_model=PollResponse)
async def create_poll(
    body: CreatePollRequest,
    user: Annotated[TokenPayload, Depends(require_faculty)],
) -> PollResponse:
    """
    Faculty creates a poll on-chain + BFF cache.
    
    Requires: JWT with role=faculty or admin
    """
    return await polls_uc.create(body, creator=user.address)

@router.post("/sessions", response_model=SessionResponse)
async def create_session(
    body: CreateSessionRequest,
    user: Annotated[TokenPayload, Depends(require_faculty)],
) -> SessionResponse:
    """
    Faculty creates an attendance session on-chain + BFF cache.
    
    Requires: JWT with role=faculty or admin
    """
    return await sessions_uc.create(body, creator=user.address)

@router.post("/cert/issue", response_model=IssueCertResponse)
async def issue_cert(
    body: IssueCertRequest,
    _fac: Annotated[TokenPayload, Depends(require_faculty)],
) -> IssueCertResponse:
    """
    Faculty issues a certificate: BFF mints ASA/NFT + registers on-chain.
    
    Requires: JWT with role=faculty or admin
    """
    return await certificate_uc.issue(body)
```

**File**: `app/api/admin.py`

```python
from typing import Annotated
from fastapi import APIRouter, Depends
from app.auth import TokenPayload, require_admin
from app.domain.models import SetRoleRequest, SetRoleResponse
from app.usecases import roles_uc

router = APIRouter()

@router.post("/role", response_model=SetRoleResponse)
async def set_role(
    body: SetRoleRequest,
    _admin: Annotated[TokenPayload, Depends(require_admin)],
) -> SetRoleResponse:
    """
    Admin sets role for an address (on-chain + BFF cache).
    
    Requires: JWT with role=admin
    
    Process:
    1. Call all contracts' set_admin() or set_faculty() methods
    2. Wait for confirmation
    3. Update roles table in database
    """
    msg = await roles_uc.set_role(body.address, body.role.value)
    return SetRoleResponse(ok=True, message=msg)
```

**File**: `app/api/ai.py`

```python
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from app.auth import TokenPayload, require_faculty
from app.domain.models import (
    AiActionType,
    AiPlanRequest,
    AiPlanResponse,
    AiExecuteResponse,
)
from app.usecases import ai_uc

router = APIRouter()

@router.post("/ai/faculty/poll/plan", response_model=AiPlanResponse)
async def plan_faculty_poll(
    body: AiPlanRequest,
    user: Annotated[TokenPayload, Depends(require_faculty)],
) -> AiPlanResponse:
    """
    AI-assisted poll creation planning.
    
    Requires: JWT with role=faculty or admin
    """
    return await ai_uc.create_plan(
        AiActionType.FACULTY_POLL,
        body,
        user.address,
    )

@router.post("/ai/faculty/session/plan", response_model=AiPlanResponse)
async def plan_faculty_session(
    body: AiPlanRequest,
    user: Annotated[TokenPayload, Depends(require_faculty)],
) -> AiPlanResponse:
    """
    AI-assisted session creation planning.
    
    Requires: JWT with role=faculty or admin
    """
    return await ai_uc.create_plan(
        AiActionType.FACULTY_SESSION,
        body,
        user.address,
    )

@router.post("/ai/intents/{intent_id}/execute", response_model=AiExecuteResponse)
async def execute_ai_intent(
    intent_id: str,
    user: Annotated[TokenPayload, Depends(require_faculty)],
) -> AiExecuteResponse:
    """
    Execute a planned AI intent.
    
    Requires: JWT with role=faculty or admin
    """
    return await ai_uc.execute_intent(intent_id, user.address)
```

---

## 🎨 Frontend Deep Dive

### Context System

**File**: `src/context/AuthContext.tsx`

The AuthContext is the **heart of frontend state management**, handling:
- Wallet connection (KMD LocalNet provider)
- Authentication flow (nonce → signature → JWT)
- Session persistence (localStorage)
- Automatic profile refresh
- Unauthorized handling (token expiry)

```typescript
interface AuthContextValue {
  isLoading: boolean
  isAuthenticated: boolean
  jwt: string | null
  role: Role | null
  address: string | null
  wallets: WalletAccount[]
  activeAddress: string | null
  activeWalletId: string | null
  connectWallet: (walletId: string) => Promise<void>
  disconnectWallet: () => Promise<void>
  signIn: (options?: SignInOptions) => Promise<MeResponse>
  logout: (reason?: string, redirectToConnect?: boolean) => Promise<void>
  refreshProfile: () => Promise<void>
}

// Key implementation details:

// 1. JWT reference stored in ref for auth interceptor
const jwtRef = useRef<string | null>(null)

// 2. Configure API auth on mount
useEffect(() => {
  configureApiAuth(
    () => jwtRef.current,  // Token provider
    () => void logout('Session expired', true),  // Unauthorized handler
  )
}, [logout])

// 3. Bootstrap: Load session from localStorage
useEffect(() => {
  const session = loadSession()  // {jwt, role, address}
  if (!session.jwt) return
  
  setJwt(session.jwt)
  setRole(session.role)
  setAddress(session.address)
  jwtRef.current = session.jwt
  
  // Verify session is still valid
  refreshProfile().catch(() => logout())
}, [])

// 4. Sign-in flow
const signIn = async (options) => {
  // Request nonce
  const { nonce } = await apiRequest('/auth/nonce', {
    method: 'POST',
    body: { address: activeAddress },
    auth: false,
  })
  
  // Sign with wallet
  const message = `AlgoCampus auth nonce: ${nonce}`
  const { signature } = await signData(message, {
    scope: ScopeType.AUTH,
    encoding: 'utf-8',
  })
  
  // Verify signature
  const { jwt } = await apiRequest('/auth/verify', {
    method: 'POST',
    body: {
      address: activeAddress,
      nonce,
      signature: toBase64(signature),
    },
    auth: false,
  })
  
  // Load profile
  const profile = await apiRequest('/me')
  
  // Save session
  saveSession(jwt, profile.role, profile.address)
  setJwt(jwt)
  setRole(profile.role)
  setAddress(profile.address)
  jwtRef.current = jwt
  
  // Redirect based on role
  if (profile.role === 'admin') {
    navigate('/admin/dashboard')
  } else if (profile.role === 'faculty') {
    navigate('/faculty/dashboard')
  } else {
    navigate('/student/dashboard')
  }
  
  return profile
}
```

---

### Wallet Integration

**File**: `src/lib/wallet.ts`

Custom KMD wallet provider for LocalNet:

```typescript
// Load LocalNet default account from KMD
const loadLocalnetAccount = async (): Promise<{
  address: string
  secretKey: Uint8Array
}> => {
  const kmd = new algosdk.Kmd(config.kmdToken, config.kmdServer, config.kmdPort)
  
  // Find wallet
  const wallets = await kmd.listWallets()
  const localWallet = wallets.find(w => w.name === 'unencrypted-default-wallet')
  
  if (!localWallet) {
    throw new Error('LocalNet wallet not found. Run `algokit localnet start`.')
  }
  
  // Get handle
  const handleRaw = await kmd.initWalletHandle(localWallet.id, '')
  const handle = toHandleToken(handleRaw)
  
  try {
    // List keys
    const keys = await kmd.listKeys(handle)
    const address = firstAddress(keys)
    
    // Export secret key
    const secretRaw = await kmd.exportKey(handle, '', address)
    const secretKey = toSecretKey(secretRaw)
    
    return { address, secretKey }
  } finally {
    await kmd.releaseWalletHandle(handle)
  }
}

// Custom wallet provider
const customProvider = {
  connect: async () => {
    const { address, secretKey } = await loadLocalnetAccount()
    connected = {
      name: 'LocalNet Dev Account',
      address,
    }
    localStorage.setItem('algocampus.customWallet.address', address)
    return [connected]
  },
  
  disconnect: async () => {
    connected = null
    localStorage.removeItem('algocampus.customWallet.address')
  },
  
  signTransactions: async (txnGroup) => {
    const { secretKey } = await loadLocalnetAccount()
    
    return txnGroup.map(txn => {
      if (txn instanceof Uint8Array) {
        const decoded = algosdk.decodeUnsignedTransaction(txn)
        return decoded.signTxn(secretKey)
      }
      return txn.signTxn(secretKey)
    })
  },
  
  signData: async (data, options) => {
    const { address, secretKey } = await loadLocalnetAccount()
    
    let bytes: Uint8Array
    if (options.encoding === 'utf-8') {
      bytes = new TextEncoder().encode(data)
    } else {
      bytes = fromStringToBytes(data)
    }
    
    // Sign with Ed25519
    const signature = nacl.sign.detached(bytes, secretKey)
    
    return {
      signature,
      address,
    }
  },
}

// Register provider
export const getWalletManager = (): WalletManager => {
  const manager = new WalletManager({
    wallets: [
      {
        id: WalletId.CUSTOM,
        metadata: { name: 'LocalNet Dev Account', icon: '' },
        async getProvider() {
          return customProvider
        },
      },
    ],
  })
  
  return manager
}
```

---

### Contract Interaction

**File**: `src/contracts/votingActions.ts`

Typed contract interaction using ARC-32 generated clients:

```typescript
import algosdk from 'algosdk'
import { VotingClient } from './VotingClient'

interface ContractContext {
  algodClient: AlgodClient
  transactionSigner: TransactionSigner
  sender: string
  appId: number
}

export const castVote = async (
  ctx: ContractContext,
  pollId: number,
  optionIndex: number,
): Promise<string> => {
  const client = new VotingClient(
    {
      sender: ctx.sender,
      resolveBy: 'id',
      id: ctx.appId,
    },
    ctx.algodClient,
  )
  
  const result = await client.castVote(
    {
      pollId: BigInt(pollId),
      optionIndex: BigInt(optionIndex),
    },
    {
      sender: ctx.sender,
      signer: ctx.transactionSigner,
    },
  )
  
  return result.txID
}

export const castVoteWithDeposit = async (
  ctx: ContractContext,
  pollId: number,
  optionIndex: number,
  depositAmount: number,
): Promise<string> => {
  const client = new VotingClient(
    {
      sender: ctx.sender,
      resolveBy: 'id',
      id: ctx.appId,
    },
    ctx.algodClient,
  )
  
  // Build payment transaction
  const sp = await ctx.algodClient.getTransactionParams().do()
  const appAddress = algosdk.getApplicationAddress(ctx.appId)
  
  const payTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from: ctx.sender,
    to: appAddress,
    amount: depositAmount,
    suggestedParams: sp,
  })
  
  // Build atomic transaction composer
  const atc = new algosdk.AtomicTransactionComposer()
  
  // Add payment
  atc.addTransaction({
    txn: payTxn,
    signer: ctx.transactionSigner,
  })
  
  // Add app call
  await client.castVoteWithDeposit(
    {
      pay: undefined,  // Use previous transaction in group
      pollId: BigInt(pollId),
      optionIndex: BigInt(optionIndex),
    },
    {
      sender: ctx.sender,
      signer: ctx.transactionSigner,
      sendParams: { atc },  // Use existing ATC
    },
  )
  
  // Execute group
  const result = await atc.execute(ctx.algodClient, 4)
  
  return result.txIDs[1]  // Return app call tx ID
}

export const getPollInfo = async (
  ctx: ContractContext,
  pollId: number,
): Promise<{
  question: string
  numOptions: number
  startRound: number
  endRound: number
}> => {
  const client = new VotingClient(
    {
      sender: ctx.sender,
      resolveBy: 'id',
      id: ctx.appId,
    },
    ctx.algodClient,
  )
  
  const result = await client.getPoll({
    pollId: BigInt(pollId),
  })
  
  return {
    question: result.return[0],
    numOptions: Number(result.return[1]),
    startRound: Number(result.return[2]),
    endRound: Number(result.return[3]),
  }
}
```

---

### Transaction Tracking Component

**File**: `src/components/TxStatus.tsx`

Real-time transaction status monitoring:

```typescript
import { useEffect, useState } from 'react'
import { apiRequest } from '../lib/api'
import { endpoints } from '../lib/endpoints'
import type { TxStatus as TxStatusModel } from '../types/api'

interface TxStatusProps {
  txId: string
  pollInterval?: number  // Default: 2000ms
}

export const TxStatus = ({ txId, pollInterval = 2000 }: TxStatusProps) => {
  const [status, setStatus] = useState<TxStatusModel | null>(null)
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    let mounted = true
    let timer: NodeJS.Timeout
    
    const poll = async () => {
      try {
        const result = await apiRequest<TxStatusModel>(
          endpoints.txStatus(txId),
        )
        
        if (mounted) {
          setStatus(result)
          setLoading(false)
          
          // Stop polling if confirmed or failed
          if (result.status === 'confirmed' || result.status === 'failed') {
            return
          }
          
          // Continue polling
          timer = setTimeout(poll, pollInterval)
        }
      } catch (error) {
        if (mounted) {
          setLoading(false)
          // Retry on error
          timer = setTimeout(poll, pollInterval)
        }
      }
    }
    
    void poll()
    
    return () => {
      mounted = false
      clearTimeout(timer)
    }
  }, [txId, pollInterval])
  
  if (loading) {
    return <div className="tx-status tx-pending">⏳ Pending...</div>
  }
  
  if (!status) {
    return <div className="tx-status tx-unknown">❓ Unknown</div>
  }
  
  if (status.status === 'confirmed') {
    return (
      <div className="tx-status tx-confirmed">
        ✅ Confirmed (Round {status.confirmed_round})
        <a
          href={`https://testnet.algoexplorer.io/tx/${txId}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          View
        </a>
      </div>
    )
  }
  
  if (status.status === 'failed') {
    return <div className="tx-status tx-failed">❌ Failed</div>
  }
  
  return <div className="tx-status tx-pending">⏳ Pending...</div>
}
```

---

## 🔧 Development Workflow

### Local Setup Commands

```bash
# 1. Start LocalNet (Docker containers)
cd projects/contracts
algokit localnet start

# 2. Deploy contracts
algokit project deploy localnet
# → Writes app IDs to artifacts/app_manifest.json

# 3. Start backend
cd ../backend
poetry install
poetry run uvicorn app.main:app --reload --port 8000
# → Loads app_manifest.json on startup
# → SQLite DB at .data/algocampus.db

# 4. Start frontend
cd ../frontend
npm install
npm run dev
# → Vite dev server at http://localhost:5173
```

### Environment Variables

**Contracts** (`.env.localnet`):
```bash
ALGOD_SERVER=http://localhost
ALGOD_PORT=4001
ALGOD_TOKEN=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
INDEXER_SERVER=http://localhost
INDEXER_PORT=8980
INDEXER_TOKEN=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
KMD_SERVER=http://localhost
KMD_PORT=4002
KMD_TOKEN=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
```

**Backend** (`.env.localnet`):
```bash
# Algorand
ALGOD_SERVER=http://localhost
ALGOD_PORT=4001
ALGOD_TOKEN=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
INDEXER_SERVER=http://localhost
INDEXER_PORT=8980
INDEXER_TOKEN=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
KMD_SERVER=http://localhost
KMD_PORT=4002
KMD_TOKEN=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa

# JWT
JWT_SECRET=algocampus-local-dev-secret-change-in-production
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=60

# Paths
APP_MANIFEST_PATH=../contracts/smart_contracts/artifacts/app_manifest.json
DB_PATH=.data/algocampus.db

# Database (Optional PostgreSQL)
DATABASE_URL=
SQLITE_FALLBACK_URL=sqlite+aiosqlite:///.data/algocampus.db
DB_POOL_SIZE=20
DB_MAX_OVERFLOW=20
DB_TIMEOUT_SECONDS=30

# AI (Optional)
AI_ENABLED=false
GEMINI_API_KEY=
GEMINI_MODEL=gemini-1.5-flash
GEMINI_TIMEOUT_SECONDS=8
AI_AUTO_EXECUTE_LOW_RISK=true

# BFF
BFF_BASE_URL=http://localhost:8000
```

**Frontend** (`.env.localnet`):
```bash
VITE_ALGOD_SERVER=http://localhost
VITE_ALGOD_PORT=4001
VITE_ALGOD_TOKEN=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
VITE_INDEXER_SERVER=http://localhost
VITE_INDEXER_PORT=8980
VITE_INDEXER_TOKEN=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
VITE_KMD_SERVER=http://localhost
VITE_KMD_PORT=4002
VITE_KMD_TOKEN=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
VITE_ALGOD_NETWORK=localnet
VITE_BFF_BASE_URL=http://localhost:8000
```

---

## 🚀 Deployment Architecture

### LocalNet Production

For hackathons/demos, everything runs on a single machine:

```
Docker Compose:
├── algod (Port 4001)
│   ├── Consensus protocol
│   ├── Block production (~4.5s blocks)
│   └── Transaction submission
├── indexer (Port 8980)
│   ├── Postgres database
│   ├── Transaction history
│   └── Application call logs
└── kmd (Port 4002)
    ├── Key management
    ├── Wallet operations
    └── Account funding

Native Processes:
├── FastAPI Backend (Port 8000)
│   ├── SQLite database
│   ├── Application server (Uvicorn)
│   └── 4 worker processes
└── Vite Frontend (Port 5173)
    ├── Dev server (HMR)
    └── Production build → Nginx
```

### Scaling Considerations

For production deployment:

1. **Database**: Switch to PostgreSQL
   ```python
   DATABASE_URL=postgresql://user:pass@host:5432/algocampus
   ```

2. **Backend**: Deploy with Gunicorn + multiple workers
   ```bash
   gunicorn app.main:app \
     --workers 4 \
     --worker-class uvicorn.workers.UvicornWorker \
     --bind 0.0.0.0:8000
   ```

3. **Frontend**: Build and serve with Nginx
   ```bash
   npm run build
   # Serves dist/ folder
   ```

4. **Caching**: Add Redis for:
   - Session storage
   - Transaction status cache
   - Analytics cache

5. **Monitoring**:
   - Prometheus metrics
   - Grafana dashboards
   - Sentry error tracking

---

## 🧪 Testing Strategy

### Smart Contract Tests

**File**: `projects/contracts/tests/test_voting.py`

```python
import pytest
from algokit_utils import get_localnet_default_account
from algosdk.v2client.algod import AlgodClient
from smart_contracts.voting.contract import VotingContract

@pytest.fixture
def algod() -> AlgodClient:
    return get_algod_client()

@pytest.fixture
def deployer():
    return get_localnet_default_account()

def test_create_poll(algod, deployer):
    # Deploy contract
    client = VotingContract(...)
    client.create_application()
    
    # Create poll
    result = client.create_poll(
        question="Test poll?",
        options=["Yes", "No"],
        start_round=100,
        end_round=200,
    )
    
    assert result.return_value == 1  # First poll ID
    
    # Verify poll data
    poll = client.get_poll(poll_id=1)
    assert poll.return_value[0] == "Test poll?"
    assert poll.return_value[1] == 2  # num_options

def test_cast_vote(algod, deployer):
    client = VotingContract(...)
    # ... setup ...
    
    # Fast-forward to start_round
    algod.status_after_block(100)
    
    # Cast vote
    result = client.cast_vote(poll_id=1, option_index=0)
    assert result.return_value == True
    
    # Check vote count
    count = client.get_result(poll_id=1, option_index=0)
    assert count.return_value == 1
    
    # Cannot vote again
    with pytest.raises(Exception, match="already voted"):
        client.cast_vote(poll_id=1, option_index=1)
```

### Backend Tests

**File**: `projects/backend/tests/test_auth.py`

```python
import pytest
from httpx import AsyncClient
from app.main import app
from algosdk import account, util

@pytest.mark.asyncio
async def test_auth_flow():
    async with AsyncClient(app=app, base_url="http://test") as client:
        # Generate test account
        private_key, address = account.generate_account()
        
        # Request nonce
        resp = await client.post("/auth/nonce", json={"address": address})
        assert resp.status_code == 200
        nonce = resp.json()["nonce"]
        
        # Sign nonce
        message = f"AlgoCampus auth nonce: {nonce}".encode()
        signature = util.sign_bytes(message, private_key)
        
        # Verify signature
        resp = await client.post(
            "/auth/verify",
            json={
                "address": address,
                "nonce": nonce,
                "signature": signature,
            },
        )
        assert resp.status_code == 200
        jwt = resp.json()["jwt"]
        
        # Use JWT
        resp = await client.get(
            "/me",
            headers={"Authorization": f"Bearer {jwt}"},
        )
        assert resp.status_code == 200
        assert resp.json()["address"] == address
        assert resp.json()["role"] == "student"  # Default role
```

### Frontend Tests

```typescript
// tests/auth.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider } from '../src/context/AuthContext'
import { ConnectPage } from '../src/pages/shared/ConnectPage'

test('sign in flow', async () => {
  render(
    <AuthProvider>
      <ConnectPage />
    </AuthProvider>
  )
  
  // Click connect wallet
  const connectBtn = screen.getByText('Connect Wallet')
  await userEvent.click(connectBtn)
  
  // Wait for wallet to connect
  await waitFor(() => {
    expect(screen.getByText(/Connected:/)).toBeInTheDocument()
  })
  
  // Click sign in
  const signInBtn = screen.getByText('Sign In')
  await userEvent.click(signInBtn)
  
  // Wait for redirect
  await waitFor(() => {
    expect(window.location.pathname).toBe('/student/dashboard')
  })
})
```

---

## 📊 Performance Metrics

### Blockchain Performance

- **Block Time**: ~4.5 seconds
- **Finality**: Immediate (single round)
- **TPS**: ~1000 transactions/second (LocalNet)
- **Contract Call Cost**: 0.001 Algos + box storage fees

### Backend Performance

- **Auth Latency**: 50-100ms (nonce + verify)
- **Contract Call**: 5-10s (4 rounds confirmation)
- **Database Query**: 1-5ms (SQLite) / <1ms (PostgreSQL)
- **Analytics Aggregation**: 100-500ms (depends on tx count)

### Frontend Performance

- **Initial Load**: <2s (Vite dev)
- **Route Change**: <100ms (React Router)
- **Contract Interaction**: 5-10s (includes confirmation)
- **Transaction Polling**: 2s intervals

---

## 🔐 Security Considerations

### Smart Contract Security

1. **Role Validation**: All write methods check `_is_admin_or_faculty()`
2. **Deduplication**: Box keys prevent double-voting/double-checkin
3. **Time Windows**: Round-based access control
4. **AI Intent Expiry**: Intents expire after 30 rounds
5. **Box Storage Limits**: Prevent DoS via excessive box creation

### Backend Security

1. **JWT Expiry**: Tokens expire after 60 minutes
2. **Nonce TTL**: Nonces expire after 5 minutes
3. **Rate Limiting**: 100 requests/minute per IP
4. **SQL Injection**: Parameterized queries only
5. **CORS**: Restricted to frontend origin in production

### Frontend Security

1. **XSS Prevention**: React escapes all user input
2. **CSRF Protection**: JWT in Authorization header (not cookies)
3. **Secret Key Storage**: Never expose private keys (KMD only)
4. **Content Security Policy**: Restrict script sources

---

## 📚 Additional Resources

### Documentation Links

- **AlgoPy**: https://algorandfoundation.github.io/puya/
- **AlgoKit**: https://developer.algorand.org/docs/algokit/
- **Algorand SDK**: https://developer.algorand.org/docs/sdks/
- **ARC Standards**: https://arc.algorand.foundation/

### Repository Structure

```
E:\MLSC\
├── README.md                          # User-facing documentation
├── CONTEXT.md                         # This file (technical deep dive)
├── .algokit.toml                      # AlgoKit workspace config
├── projects/
│   ├── contracts/                     # Smart contracts
│   │   ├── smart_contracts/
│   │   │   ├── voting/contract.py
│   │   │   ├── attendance/contract.py
│   │   │   ├── certificate/contract.py
│   │   │   ├── helpers/
│   │   │   │   ├── build.py           # Compile to TEAL + ARC-32
│   │   │   │   ├── deploy.py          # Deploy to LocalNet
│   │   │   │   └── generate_clients.py # Generate TypeScript clients
│   │   │   └── artifacts/
│   │   │       ├── app_manifest.json  # Deployed app IDs
│   │   │       ├── VotingContract/
│   │   │       ├── AttendanceContract/
│   │   │       └── CertificateRegistryContract/
│   │   ├── tests/                     # Contract tests
│   │   ├── .algokit.toml              # Contract project config
│   │   └── pyproject.toml             # Poetry dependencies
│   ├── backend/                       # FastAPI BFF
│   │   ├── app/
│   │   │   ├── domain/models.py       # Pydantic models
│   │   │   ├── infra/                 # Infrastructure layer
│   │   │   │   ├── db/                # Database (SQLite/PostgreSQL)
│   │   │   │   ├── algorand/          # Algorand clients
│   │   │   │   └── ai/                # AI integration
│   │   │   ├── usecases/              # Business logic
│   │   │   ├── api/                   # FastAPI routes
│   │   │   ├── core/                  # Config, auth, middleware
│   │   │   └── main.py                # Application factory
│   │   ├── alembic/                   # Database migrations
│   │   ├── tests/                     # Backend tests
│   │   ├── .env.localnet              # Environment variables
│   │   └── pyproject.toml             # Poetry dependencies
│   └── frontend/                      # React + TypeScript
│       ├── src/
│       │   ├── pages/                 # Route components
│       │   │   ├── student/
│       │   │   ├── faculty/
│       │   │   ├── admin/
│       │   │   └── shared/
│       │   ├── components/            # Reusable UI components
│       │   ├── context/               # React context providers
│       │   ├── lib/                   # Utilities
│       │   │   ├── api.ts             # API client
│       │   │   ├── wallet.ts          # Wallet integration
│       │   │   ├── config.ts          # Environment validation
│       │   │   └── endpoints.ts       # API endpoint definitions
│       │   ├── contracts/             # Generated TypeScript clients
│       │   ├── types/                 # TypeScript types
│       │   ├── App.tsx                # Root component
│       │   └── main.tsx               # Entry point
│       ├── .env.localnet              # Environment variables
│       ├── package.json               # npm dependencies
│       └── vite.config.ts             # Vite configuration
└── .gitignore
```

---

## 🎓 Learning Path for New Contributors

### Beginner (1-2 hours)

1. Read [README.md](README.md) - High-level overview
2. Start LocalNet: `algokit localnet start`
3. Deploy contracts: `algokit project deploy localnet`
4. Start backend: `poetry run uvicorn app.main:app --reload`
5. Start frontend: `npm run dev`
6. Sign in and create a test poll

### Intermediate (4-6 hours)

1. Read this CONTEXT.md file
2. Trace authentication flow:
   - Frontend: `src/context/AuthContext.tsx`
   - Backend: `app/usecases/auth_uc.py`
   - API: `app/api/auth_routes.py`
3. Trace poll creation flow:
   - Frontend: `src/pages/faculty/FacultyVotingPage.tsx`
   - Backend: `app/usecases/polls_uc.py` → `app/infra/algorand/chain.py`
   - Contract: `smart_contracts/voting/contract.py`
4. Explore database schema: `app/infra/db/database.py`
5. Test contract interaction: `tests/test_voting.py`

### Advanced (8-12 hours)

1. Implement a new feature (e.g., poll edit):
   - Add contract method: `update_poll()`
   - Add backend use case: `polls_uc.update()`
   - Add API route: `PUT /polls/{poll_id}`
   - Add frontend UI: Update `FacultyVotingPage.tsx`
2. Add database migration: `alembic revision -m "add_poll_edit_log"`
3. Write tests for new feature
4. Study AI intent system: `app/usecases/ai_uc.py`
5. Explore atomic transaction groups: `voting/contract.py` → `cast_vote_with_deposit()`

---

## 🐛 Common Issues & Solutions

### Issue: "App manifest not found"

**Cause**: Contracts not deployed  
**Solution**:
```bash
cd projects/contracts
algokit project deploy localnet
```

### Issue: "LocalNet default wallet not found"

**Cause**: LocalNet not running  
**Solution**:
```bash
algokit localnet start
```

### Issue: "Transaction expired"

**Cause**: Round window passed  
**Solution**: Use `current_round() + N` for future rounds

### Issue: "Box not found"

**Cause**: Contract state not initialized  
**Solution**: Call `create_application()` on deployment

### Issue: "JWT expired"

**Cause**: Token TTL exceeded (60 minutes)  
**Solution**: User must sign in again

### Issue: "Signature verification failed"

**Cause**: Nonce mismatch or expired  
**Solution**: Request new nonce and retry

---

## 🚀 Future Enhancements

### Planned Features

1. **Poll Delegation**: Users can delegate voting power
2. **Session QR Codes**: Generate QR codes for quick checkin
3. **Certificate Transfers**: Transfer NFT certificates to other addresses
4. **Multi-signature Admin**: Require multiple admin signatures for role changes
5. **Poll Templates**: Pre-configured poll types (yes/no, ranked choice, etc.)
6. **Analytics Dashboard**: Real-time charts and graphs
7. **Notification System**: Push notifications for poll results, session reminders
8. **Mobile App**: React Native port of frontend

### Technical Debt

1. **Contract Upgradability**: Implement proxy pattern for contracts
2. **Database Migrations**: Full Alembic migration suite
3. **Integration Tests**: End-to-end test suite with Playwright
4. **Performance Monitoring**: Add APM (Application Performance Monitoring)
5. **Error Boundaries**: Better error handling in frontend
6. **Logging**: Structured logging with ELK stack
7. **Documentation**: API documentation with Swagger/OpenAPI

---

## 📝 Changelog

### Version 0.1.0 (February 15, 2026)

**Initial Release**

- ✅ VotingContract with polls and voting
- ✅ AttendanceContract with sessions and check-ins
- ✅ CertificateRegistryContract with NFT minting
- ✅ FastAPI BFF with SQLite/PostgreSQL support
- ✅ React frontend with role-based routing
- ✅ JWT authentication with wallet signatures
- ✅ AI-assisted action planning with Gemini integration
- ✅ Transaction tracking and monitoring
- ✅ Activity feed and audit trail
- ✅ Announcement system with poll context
- ✅ Attendance record review system
- ✅ User profiles with avatar support

---

## 🤝 Contributing

### Code Style

**Python (Backend)**:
- Follow PEP 8
- Use type hints
- Max line length: 120 characters
- Use `black` formatter
- Use `ruff` linter

**TypeScript (Frontend)**:
- Use ESLint + Prettier
- Prefer functional components + hooks
- Use TypeScript strict mode
- Max line length: 100 characters

**AlgoPy (Contracts)**:
- Follow Algorand Python style guide
- Use type annotations
- Document all public methods
- Keep methods under 30 lines

### Commit Messages

Follow Conventional Commits:
```
feat(voting): add poll delegation feature
fix(auth): resolve nonce expiry issue
docs(readme): update installation steps
chore(deps): upgrade algopy to v1.1.0
```

### Pull Request Process

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Commit changes with conventional commits
4. Run tests: `pytest` (backend), `npm test` (frontend)
5. Push to fork: `git push origin feat/my-feature`
6. Create pull request with detailed description

---

## 📞 Support

- **Issues**: https://github.com/algocampus/algocampus/issues
- **Discord**: https://discord.gg/algorand
- **Email**: support@algocampus.dev

---

**This context document is living documentation. Last updated: February 15, 2026**

"""CertificateRegistryContract – ARC-4 verifiable certificate registry + ASA/NFT minting."""

from algopy import (
    ARC4Contract,
    Account,
    BoxMap,
    Bytes,
    Global,
    Txn,
    UInt64,
    arc4,
    itxn,
    op,
    subroutine,
)


class CertificateRegistryContract(ARC4Contract):
    """
    On-chain certificate registry.

    * ``cert_hash`` (SHA-256 of canonical payload) is the primary key – no PII on-chain.
    * ``mint_and_register`` creates an ARC-3 NFT via **inner transaction** and registers
      the hash in one call — the BFF constructs the metadata URL first.
    * Overwrite is blocked unless admin explicitly calls ``reissue``.
    """

    def __init__(self) -> None:
        # ── global state ─────────────────────────────────
        self.admin = Account()

        # ── role allow-lists ─────────────────────────────
        self.admin_list = BoxMap(arc4.Address, arc4.Bool, key_prefix=b"adm")
        self.faculty_list = BoxMap(arc4.Address, arc4.Bool, key_prefix=b"fac")

        # ── certificate registry (key = cert_hash bytes) ─
        self.cert_recipient = BoxMap(Bytes, arc4.Address, key_prefix=b"cr")
        self.cert_asset = BoxMap(Bytes, arc4.UInt64, key_prefix=b"ca")
        self.cert_ts = BoxMap(Bytes, arc4.UInt64, key_prefix=b"ct")
        self.ai_intent_expiry = BoxMap(Bytes, arc4.UInt64, key_prefix=b"aie")
        self.ai_intent_used = BoxMap(Bytes, arc4.Bool, key_prefix=b"aiu")

    # ═══════════════════════════════════════════════════════
    # Lifecycle
    # ═══════════════════════════════════════════════════════

    @arc4.abimethod(create="require")
    def create_application(self) -> None:
        self.admin = Txn.sender

    # ═══════════════════════════════════════════════════════
    # Role management
    # ═══════════════════════════════════════════════════════

    @arc4.abimethod
    def set_admin(self, addr: arc4.Address, enabled: arc4.Bool) -> None:
        assert Txn.sender == self.admin, "only creator"
        if enabled.native:
            self.admin_list[addr] = arc4.Bool(True)  # noqa: FBT003
        elif addr in self.admin_list:
            del self.admin_list[addr]

    @arc4.abimethod
    def set_faculty(self, addr: arc4.Address, enabled: arc4.Bool) -> None:
        assert self._is_admin(Txn.sender), "only admin"
        if enabled.native:
            self.faculty_list[addr] = arc4.Bool(True)  # noqa: FBT003
        elif addr in self.faculty_list:
            del self.faculty_list[addr]

    @subroutine
    def _is_admin(self, addr: Account) -> bool:
        if addr == self.admin:
            return True
        return arc4.Address(addr) in self.admin_list

    @subroutine
    def _is_admin_or_faculty(self, addr: Account) -> bool:
        if self._is_admin(addr):
            return True
        return arc4.Address(addr) in self.faculty_list

    @arc4.abimethod
    def record_ai_intent(
        self,
        intent_hash: arc4.DynamicBytes,
        expires_round: arc4.UInt64,
    ) -> arc4.Bool:
        assert self._is_admin_or_faculty(Txn.sender), "not authorised"
        assert expires_round.native >= Global.round, "already expired"
        h = intent_hash.native
        self.ai_intent_expiry[h] = expires_round
        self.ai_intent_used[h] = arc4.Bool(False)
        return arc4.Bool(True)

    @arc4.abimethod
    def cancel_ai_intent(self, intent_hash: arc4.DynamicBytes) -> arc4.Bool:
        assert self._is_admin_or_faculty(Txn.sender), "not authorised"
        h = intent_hash.native
        assert h in self.ai_intent_expiry, "intent missing"
        if h in self.ai_intent_used:
            assert not self.ai_intent_used[h].native, "intent already used"
            del self.ai_intent_used[h]
        del self.ai_intent_expiry[h]
        return arc4.Bool(True)

    @subroutine
    def _consume_ai_intent(self, intent_hash: Bytes) -> None:
        assert intent_hash in self.ai_intent_expiry, "intent missing"
        assert Global.round <= self.ai_intent_expiry[intent_hash].native, "intent expired"
        if intent_hash in self.ai_intent_used:
            assert not self.ai_intent_used[intent_hash].native, "intent already used"
        self.ai_intent_used[intent_hash] = arc4.Bool(True)

    # ═══════════════════════════════════════════════════════
    # Certificate registration
    # ═══════════════════════════════════════════════════════

    @arc4.abimethod
    def register_cert(
        self,
        cert_hash: arc4.DynamicBytes,
        recipient: arc4.Address,
        asset_id: arc4.UInt64,
        issued_ts: arc4.UInt64,
    ) -> arc4.Bool:
        """Register a certificate hash. Caller is admin or faculty."""
        assert self._is_admin_or_faculty(Txn.sender), "not authorised"
        h = cert_hash.native
        assert h not in self.cert_recipient, "already registered"

        self.cert_recipient[h] = recipient
        self.cert_asset[h] = asset_id
        self.cert_ts[h] = issued_ts
        return arc4.Bool(True)  # noqa: FBT003

    @arc4.abimethod
    def register_cert_ai(
        self,
        cert_hash: arc4.DynamicBytes,
        recipient: arc4.Address,
        asset_id: arc4.UInt64,
        issued_ts: arc4.UInt64,
        intent_hash: arc4.DynamicBytes,
    ) -> arc4.Bool:
        """AI-assisted certificate registration with intent consumption."""
        assert self._is_admin_or_faculty(Txn.sender), "not authorised"
        self._consume_ai_intent(intent_hash.native)
        h = cert_hash.native
        assert h not in self.cert_recipient, "already registered"

        self.cert_recipient[h] = recipient
        self.cert_asset[h] = asset_id
        self.cert_ts[h] = issued_ts
        return arc4.Bool(True)

    @arc4.abimethod
    def reissue_cert(
        self,
        cert_hash: arc4.DynamicBytes,
        recipient: arc4.Address,
        asset_id: arc4.UInt64,
        issued_ts: arc4.UInt64,
    ) -> arc4.Bool:
        """Admin-only: overwrite an existing certificate entry."""
        assert self._is_admin(Txn.sender), "only admin"
        h = cert_hash.native
        self.cert_recipient[h] = recipient
        self.cert_asset[h] = asset_id
        self.cert_ts[h] = issued_ts
        return arc4.Bool(True)  # noqa: FBT003

    # ═══════════════════════════════════════════════════════
    # Mint + Register (inner txn for ASA/NFT)
    # ═══════════════════════════════════════════════════════

    @arc4.abimethod
    def mint_and_register(
        self,
        cert_hash: arc4.DynamicBytes,
        recipient: arc4.Address,
        metadata_url: arc4.String,
        issued_ts: arc4.UInt64,
    ) -> arc4.UInt64:
        """
        Mint a unique ARC-3 certificate NFT via inner transaction,
        then register the cert hash on-chain. Returns the new asset ID.
        """
        assert self._is_admin_or_faculty(Txn.sender), "not authorised"
        h = cert_hash.native
        assert h not in self.cert_recipient, "already registered"

        # Inner txn: create ASA (total=1, decimals=0 → NFT)
        asset_params = itxn.AssetConfig(
            total=UInt64(1),
            decimals=UInt64(0),
            default_frozen=False,
            unit_name=Bytes(b"CERT"),
            asset_name=Bytes(b"AlgoCampusCert"),
            url=metadata_url.native.bytes,
            manager=Global.current_application_address,
            reserve=Global.current_application_address,
            fee=UInt64(0),
        )
        result = asset_params.submit()
        asset_id = result.created_asset.id

        # Register on-chain
        self.cert_recipient[h] = recipient
        self.cert_asset[h] = arc4.UInt64(asset_id)
        self.cert_ts[h] = issued_ts

        return arc4.UInt64(asset_id)

    @arc4.abimethod
    def mint_and_register_ai(
        self,
        cert_hash: arc4.DynamicBytes,
        recipient: arc4.Address,
        metadata_url: arc4.String,
        issued_ts: arc4.UInt64,
        intent_hash: arc4.DynamicBytes,
    ) -> arc4.UInt64:
        """
        AI-assisted mint and register flow with intent consumption.
        """
        assert self._is_admin_or_faculty(Txn.sender), "not authorised"
        self._consume_ai_intent(intent_hash.native)
        h = cert_hash.native
        assert h not in self.cert_recipient, "already registered"

        asset_params = itxn.AssetConfig(
            total=UInt64(1),
            decimals=UInt64(0),
            default_frozen=False,
            unit_name=Bytes(b"CERT"),
            asset_name=Bytes(b"AlgoCampusCert"),
            url=metadata_url.native.bytes,
            manager=Global.current_application_address,
            reserve=Global.current_application_address,
            fee=UInt64(0),
        )
        result = asset_params.submit()
        asset_id = result.created_asset.id

        self.cert_recipient[h] = recipient
        self.cert_asset[h] = arc4.UInt64(asset_id)
        self.cert_ts[h] = issued_ts

        return arc4.UInt64(asset_id)

    # ═══════════════════════════════════════════════════════
    # Verification query
    # ═══════════════════════════════════════════════════════

    @arc4.abimethod(readonly=True)
    def verify_cert(
        self, cert_hash: arc4.DynamicBytes
    ) -> arc4.Tuple[arc4.Address, arc4.UInt64, arc4.UInt64]:
        """Returns (recipient, asset_id, issued_ts) or asserts if unknown."""
        h = cert_hash.native
        assert h in self.cert_recipient, "cert not found"
        return arc4.Tuple(
            (
                self.cert_recipient[h],
                self.cert_asset[h],
                self.cert_ts[h],
            )
        )

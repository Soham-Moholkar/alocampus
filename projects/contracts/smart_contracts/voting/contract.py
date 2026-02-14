"""VotingContract – ARC-4 on-chain polls with box-backed storage and atomic-group deposits."""

from algopy import (
    ARC4Contract,
    Account,
    BoxMap,
    Bytes,
    Global,
    Txn,
    UInt64,
    arc4,
    gtxn,
    op,
    subroutine,
    urange,
)


class VotingContract(ARC4Contract):
    """
    Fully on-chain voting.

    * Polls stored in boxes (question, options, round window).
    * One-address-one-vote enforced via per-(poll, voter) box flag.
    * ``cast_vote_with_deposit`` demonstrates an **atomic transaction group**
      (payment + app-call in same group).
    """

    def __init__(self) -> None:
        # ── global state ─────────────────────────────────
        self.poll_counter = UInt64(0)
        self.admin = Account()

        # ── role allow-lists (boxes) ─────────────────────
        self.admin_list = BoxMap(arc4.Address, arc4.Bool, key_prefix=b"adm")
        self.faculty_list = BoxMap(arc4.Address, arc4.Bool, key_prefix=b"fac")

        # ── poll metadata (key = poll_id as 8-byte BE) ───
        self.poll_questions = BoxMap(Bytes, arc4.String, key_prefix=b"pq")
        self.poll_num_options = BoxMap(Bytes, arc4.UInt64, key_prefix=b"pn")
        self.poll_start_round = BoxMap(Bytes, arc4.UInt64, key_prefix=b"ps")
        self.poll_end_round = BoxMap(Bytes, arc4.UInt64, key_prefix=b"pe")

        # ── option names  (key = poll_id‖option_idx) ─────
        self.poll_options = BoxMap(Bytes, arc4.String, key_prefix=b"po")

        # ── vote counts   (key = poll_id‖option_idx) ─────
        self.vote_counts = BoxMap(Bytes, arc4.UInt64, key_prefix=b"vc")

        # ── voter de-dup  (key = poll_id‖voter_addr) ─────
        self.voter_flags = BoxMap(Bytes, arc4.Bool, key_prefix=b"vf")

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

    # ═══════════════════════════════════════════════════════
    # Poll CRUD
    # ═══════════════════════════════════════════════════════

    @arc4.abimethod
    def create_poll(
        self,
        question: arc4.String,
        options: arc4.DynamicArray[arc4.String],
        start_round: arc4.UInt64,
        end_round: arc4.UInt64,
    ) -> arc4.UInt64:
        assert self._is_admin_or_faculty(Txn.sender), "not authorised"
        assert start_round.native < end_round.native, "bad round range"
        num = options.length
        assert num >= UInt64(2), "need >=2 options"

        new_id = self.poll_counter + UInt64(1)
        self.poll_counter = new_id
        pid = op.itob(new_id)

        self.poll_questions[pid] = question.copy()
        self.poll_num_options[pid] = arc4.UInt64(num)
        self.poll_start_round[pid] = start_round.copy()
        self.poll_end_round[pid] = end_round.copy()

        for i in urange(num):
            key = pid + op.itob(i)
            self.poll_options[key] = options[i].copy()
            self.vote_counts[key] = arc4.UInt64(0)

        return arc4.UInt64(new_id)

    # ═══════════════════════════════════════════════════════
    # Voting
    # ═══════════════════════════════════════════════════════

    @subroutine
    def _do_cast_vote(self, poll_id: UInt64, option_index: UInt64) -> bool:
        pid = op.itob(poll_id)
        assert pid in self.poll_num_options, "poll not found"
        assert Global.round >= self.poll_start_round[pid].native, "not started"
        assert Global.round <= self.poll_end_round[pid].native, "ended"

        num = self.poll_num_options[pid].native
        assert option_index < num, "bad option"

        voter_key = pid + Txn.sender.bytes
        assert voter_key not in self.voter_flags, "already voted"
        self.voter_flags[voter_key] = arc4.Bool(True)  # noqa: FBT003

        opt_key = pid + op.itob(option_index)
        cur = self.vote_counts[opt_key].native
        self.vote_counts[opt_key] = arc4.UInt64(cur + UInt64(1))
        return True

    @arc4.abimethod
    def cast_vote(
        self, poll_id: arc4.UInt64, option_index: arc4.UInt64
    ) -> arc4.Bool:
        return arc4.Bool(self._do_cast_vote(poll_id.native, option_index.native))

    @arc4.abimethod
    def cast_vote_with_deposit(
        self,
        pay: gtxn.PaymentTransaction,
        poll_id: arc4.UInt64,
        option_index: arc4.UInt64,
    ) -> arc4.Bool:
        """Atomic-group variant: a payment deposit followed by the vote app-call."""
        assert pay.receiver == Global.current_application_address, "pay to app"
        assert pay.amount >= UInt64(1_000), "min 1 000 µAlgo deposit"
        return arc4.Bool(self._do_cast_vote(poll_id.native, option_index.native))

    # ═══════════════════════════════════════════════════════
    # Read-only queries
    # ═══════════════════════════════════════════════════════

    @arc4.abimethod(readonly=True)
    def get_poll(
        self, poll_id: arc4.UInt64
    ) -> arc4.Tuple[arc4.String, arc4.UInt64, arc4.UInt64, arc4.UInt64]:
        """Returns (question, num_options, start_round, end_round)."""
        pid = op.itob(poll_id.native)
        assert pid in self.poll_questions, "poll not found"
        return arc4.Tuple(
            (
                self.poll_questions[pid].copy(),
                self.poll_num_options[pid].copy(),
                self.poll_start_round[pid].copy(),
                self.poll_end_round[pid].copy(),
            )
        )

    @arc4.abimethod(readonly=True)
    def get_result(
        self, poll_id: arc4.UInt64, option_index: arc4.UInt64
    ) -> arc4.UInt64:
        """Paginated getter – one option at a time."""
        pid = op.itob(poll_id.native)
        key = pid + op.itob(option_index.native)
        assert key in self.vote_counts, "no such option"
        return self.vote_counts[key].copy()

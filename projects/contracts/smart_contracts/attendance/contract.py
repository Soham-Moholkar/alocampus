"""AttendanceContract – ARC-4 session attendance with box-backed roster."""

from algopy import (
    ARC4Contract,
    Account,
    BoxMap,
    Bytes,
    Global,
    Txn,
    UInt64,
    arc4,
    op,
    subroutine,
)


class AttendanceContract(ARC4Contract):
    """
    On-chain class/session attendance.

    * Faculty creates sessions with a round window.
    * Students call ``check_in`` while the window is open.
    * One check-in per address per session (box flag).
    """

    def __init__(self) -> None:
        # ── global state ─────────────────────────────────
        self.session_counter = UInt64(0)
        self.admin = Account()

        # ── role allow-lists ─────────────────────────────
        self.admin_list = BoxMap(arc4.Address, arc4.Bool, key_prefix=b"adm")
        self.faculty_list = BoxMap(arc4.Address, arc4.Bool, key_prefix=b"fac")

        # ── session metadata (key = session_id as 8-byte BE)
        self.session_course = BoxMap(Bytes, arc4.String, key_prefix=b"sc")
        self.session_ts = BoxMap(Bytes, arc4.UInt64, key_prefix=b"st")
        self.session_open = BoxMap(Bytes, arc4.UInt64, key_prefix=b"so")
        self.session_close = BoxMap(Bytes, arc4.UInt64, key_prefix=b"se")

        # ── roster (key = session_id‖student_addr) ───────
        self.roster = BoxMap(Bytes, arc4.Bool, key_prefix=b"r")

    # ═══════════════════════════════════════════════════════
    # Lifecycle
    # ═══════════════════════════════════════════════════════

    @arc4.abimethod(create="require")
    def create_application(self) -> None:
        self.admin = Txn.sender

    # ═══════════════════════════════════════════════════════
    # Role management (identical interface across contracts)
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
    # Session management
    # ═══════════════════════════════════════════════════════

    @arc4.abimethod
    def create_session(
        self,
        course_code: arc4.String,
        session_ts: arc4.UInt64,
        open_round: arc4.UInt64,
        close_round: arc4.UInt64,
    ) -> arc4.UInt64:
        """Create a new attendance session. Only admin/faculty."""
        assert self._is_admin_or_faculty(Txn.sender), "not authorised"
        assert open_round.native < close_round.native, "bad round range"

        new_id = self.session_counter + UInt64(1)
        self.session_counter = new_id
        sid = op.itob(new_id)

        self.session_course[sid] = course_code.copy()
        self.session_ts[sid] = session_ts.copy()
        self.session_open[sid] = open_round.copy()
        self.session_close[sid] = close_round.copy()

        return arc4.UInt64(new_id)

    # ═══════════════════════════════════════════════════════
    # Check-in
    # ═══════════════════════════════════════════════════════

    @arc4.abimethod
    def check_in(self, session_id: arc4.UInt64) -> arc4.Bool:
        """Student checks in to an open session. One check-in per address."""
        sid = op.itob(session_id.native)
        assert sid in self.session_open, "session not found"
        assert Global.round >= self.session_open[sid].native, "not open yet"
        assert Global.round <= self.session_close[sid].native, "closed"

        key = sid + Txn.sender.bytes
        assert key not in self.roster, "already checked in"
        self.roster[key] = arc4.Bool(True)  # noqa: FBT003

        return arc4.Bool(True)  # noqa: FBT003

    # ═══════════════════════════════════════════════════════
    # Queries
    # ═══════════════════════════════════════════════════════

    @arc4.abimethod(readonly=True)
    def is_present(
        self, session_id: arc4.UInt64, addr: arc4.Address
    ) -> arc4.Bool:
        sid = op.itob(session_id.native)
        key = sid + addr.bytes
        return arc4.Bool(key in self.roster)

    @arc4.abimethod(readonly=True)
    def get_session(
        self, session_id: arc4.UInt64
    ) -> arc4.Tuple[arc4.String, arc4.UInt64, arc4.UInt64, arc4.UInt64]:
        """Returns (course_code, session_ts, open_round, close_round)."""
        sid = op.itob(session_id.native)
        assert sid in self.session_course, "session not found"
        return arc4.Tuple(
            (
                self.session_course[sid].copy(),
                self.session_ts[sid].copy(),
                self.session_open[sid].copy(),
                self.session_close[sid].copy(),
            )
        )

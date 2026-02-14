"""role content, profile avatar, and attendance records

Revision ID: 0002_role_content_profile_attendance
Revises: 0001_baseline
Create Date: 2026-02-14
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "0002_role_content_profile_attendance"
down_revision = "0001_baseline"
branch_labels = None
depends_on = None


def upgrade() -> None:
    dialect = op.get_bind().dialect.name
    tx_cols = [
        ("session_id", "BIGINT"),
        ("course_code", "TEXT"),
        ("student_address", "TEXT"),
    ]
    for column, col_type in tx_cols:
        statement = (
            f"ALTER TABLE tx_tracking ADD COLUMN IF NOT EXISTS {column} {col_type}"
            if dialect != "sqlite"
            else f"ALTER TABLE tx_tracking ADD COLUMN {column} {col_type}"
        )
        try:
            op.execute(statement)
        except Exception:
            # SQLite raises if column already exists.
            pass

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS announcements (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            body TEXT NOT NULL,
            poll_id BIGINT,
            category TEXT NOT NULL,
            audience TEXT NOT NULL,
            author_address TEXT NOT NULL,
            author_role TEXT NOT NULL,
            is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
            is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
            hash TEXT NOT NULL,
            anchor_tx_id TEXT,
            created DOUBLE PRECISION NOT NULL,
            updated DOUBLE PRECISION NOT NULL
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS poll_context (
            poll_id BIGINT PRIMARY KEY,
            purpose TEXT NOT NULL,
            audience TEXT NOT NULL,
            category TEXT NOT NULL,
            extra_note TEXT NOT NULL DEFAULT '',
            updated_by TEXT NOT NULL,
            hash TEXT NOT NULL,
            anchor_tx_id TEXT,
            updated DOUBLE PRECISION NOT NULL
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS user_profiles (
            address TEXT PRIMARY KEY,
            display_name TEXT,
            avatar_path TEXT,
            avatar_hash TEXT,
            avatar_anchor_tx_id TEXT,
            updated DOUBLE PRECISION NOT NULL
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS attendance_records (
            id TEXT PRIMARY KEY,
            session_id BIGINT NOT NULL,
            course_code TEXT NOT NULL,
            student_address TEXT NOT NULL,
            status TEXT NOT NULL,
            tx_id TEXT,
            anchor_tx_id TEXT,
            attended_at DOUBLE PRECISION NOT NULL,
            created DOUBLE PRECISION NOT NULL,
            UNIQUE(session_id, student_address)
        )
        """
    )

    op.execute("CREATE INDEX IF NOT EXISTS idx_announcements_updated ON announcements(updated DESC)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_announcements_poll ON announcements(poll_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_attendance_records_student ON attendance_records(student_address, attended_at DESC)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_attendance_records_course ON attendance_records(course_code, attended_at DESC)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_attendance_records_course")
    op.execute("DROP INDEX IF EXISTS idx_attendance_records_student")
    op.execute("DROP INDEX IF EXISTS idx_announcements_poll")
    op.execute("DROP INDEX IF EXISTS idx_announcements_updated")
    op.execute("DROP TABLE IF EXISTS attendance_records")
    op.execute("DROP TABLE IF EXISTS user_profiles")
    op.execute("DROP TABLE IF EXISTS poll_context")
    op.execute("DROP TABLE IF EXISTS announcements")

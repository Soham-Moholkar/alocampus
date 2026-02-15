"""add demo users table for role credential login

Revision ID: 0003_demo_users
Revises: 0002_role_content_profile_attendance
Create Date: 2026-02-15
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "0003_demo_users"
down_revision = "0002_role_content_profile_attendance"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS demo_users (
            id TEXT PRIMARY KEY,
            role TEXT NOT NULL,
            username TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            display_name TEXT NOT NULL,
            identifier TEXT NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created DOUBLE PRECISION NOT NULL,
            updated DOUBLE PRECISION NOT NULL,
            UNIQUE(role, username),
            UNIQUE(role, identifier)
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS idx_demo_users_role ON demo_users(role)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_demo_users_role")
    op.execute("DROP TABLE IF EXISTS demo_users")


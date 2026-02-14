"""baseline schema for scalable backend

Revision ID: 0001_baseline
Revises:
Create Date: 2026-02-14
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "0001_baseline"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS roles (
            address TEXT PRIMARY KEY,
            role TEXT NOT NULL DEFAULT 'student'
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS nonces (
            address TEXT PRIMARY KEY,
            nonce TEXT NOT NULL,
            created DOUBLE PRECISION NOT NULL
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS tx_tracking (
            tx_id TEXT PRIMARY KEY,
            kind TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            confirmed_round BIGINT
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS cert_metadata (
            cert_hash TEXT PRIMARY KEY,
            recipient TEXT NOT NULL,
            asset_id BIGINT,
            metadata TEXT NOT NULL,
            created DOUBLE PRECISION NOT NULL
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS polls (
            poll_id BIGINT PRIMARY KEY,
            question TEXT NOT NULL,
            options_json TEXT NOT NULL,
            start_round BIGINT NOT NULL,
            end_round BIGINT NOT NULL,
            creator TEXT NOT NULL,
            app_id BIGINT NOT NULL,
            tx_id TEXT,
            created DOUBLE PRECISION NOT NULL
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS sessions (
            session_id BIGINT PRIMARY KEY,
            course_code TEXT NOT NULL,
            session_ts BIGINT NOT NULL,
            open_round BIGINT NOT NULL,
            close_round BIGINT NOT NULL,
            creator TEXT NOT NULL,
            app_id BIGINT NOT NULL,
            tx_id TEXT,
            created DOUBLE PRECISION NOT NULL
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS activity_events (
            id TEXT PRIMARY KEY,
            kind TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            actor TEXT,
            tx_id TEXT,
            created DOUBLE PRECISION NOT NULL,
            tags_json TEXT NOT NULL DEFAULT '[]'
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS feedback_commits (
            id TEXT PRIMARY KEY,
            author TEXT NOT NULL,
            hash TEXT NOT NULL,
            course_code TEXT,
            metadata_json TEXT,
            tx_id TEXT,
            created DOUBLE PRECISION NOT NULL
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS coordination_tasks (
            task_id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            owner TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'open',
            payload_hash TEXT,
            anchor_tx_id TEXT,
            created DOUBLE PRECISION NOT NULL,
            updated DOUBLE PRECISION NOT NULL
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS ai_intents (
            intent_id TEXT PRIMARY KEY,
            intent_hash TEXT NOT NULL UNIQUE,
            action_type TEXT NOT NULL,
            risk_level TEXT NOT NULL,
            payload_json TEXT NOT NULL,
            auto_execute BOOLEAN NOT NULL DEFAULT FALSE,
            status TEXT NOT NULL,
            created DOUBLE PRECISION NOT NULL,
            updated DOUBLE PRECISION NOT NULL,
            created_by TEXT NOT NULL
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS ai_executions (
            execution_id TEXT PRIMARY KEY,
            intent_id TEXT NOT NULL,
            status TEXT NOT NULL,
            message TEXT,
            tx_id TEXT,
            confirmed_round BIGINT,
            created DOUBLE PRECISION NOT NULL
        )
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS ai_executions")
    op.execute("DROP TABLE IF EXISTS ai_intents")
    op.execute("DROP TABLE IF EXISTS coordination_tasks")
    op.execute("DROP TABLE IF EXISTS feedback_commits")
    op.execute("DROP TABLE IF EXISTS activity_events")
    op.execute("DROP TABLE IF EXISTS sessions")
    op.execute("DROP TABLE IF EXISTS polls")
    op.execute("DROP TABLE IF EXISTS cert_metadata")
    op.execute("DROP TABLE IF EXISTS tx_tracking")
    op.execute("DROP TABLE IF EXISTS nonces")
    op.execute("DROP TABLE IF EXISTS roles")

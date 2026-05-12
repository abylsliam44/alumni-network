"""Rework messaging domain for 1:1 conversations

Revision ID: 8b4c1d92f4d0
Revises: 7c2b9f8d4ef3
Create Date: 2025-12-09 12:00:00
"""
from __future__ import annotations

import uuid
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "8b4c1d92f4d0"
down_revision: Union[str, None] = "7c2b9f8d4ef3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Conversation metadata
    op.add_column(
        "conversations",
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    # New participant mapping table
    op.create_table(
        "conversation_participants",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("conversation_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["conversation_id"], ["conversations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("conversation_id", "user_id", name="uq_conversation_user"),
    )
    op.create_index(
        "ix_conversation_participants_user_id",
        "conversation_participants",
        ["user_id"],
        unique=False,
    )

    # Backfill participant rows from legacy columns if they exist
    connection = op.get_bind()
    legacy_conversations = connection.execute(
        sa.text("SELECT id, participant1_id, participant2_id, created_at FROM conversations")
    ).fetchall()
    for convo in legacy_conversations:
        for participant_id in (convo.participant1_id, convo.participant2_id):
            if participant_id:
                connection.execute(
                    sa.text(
                        """
                        INSERT INTO conversation_participants (id, conversation_id, user_id, created_at)
                        VALUES (:id, :conversation_id, :user_id, :created_at)
                        ON CONFLICT DO NOTHING
                        """
                    ),
                    {
                        "id": str(uuid.uuid4()),
                        "conversation_id": str(convo.id),
                        "user_id": str(participant_id),
                        "created_at": convo.created_at,
                    },
                )

    # Clean up legacy participant columns
    op.drop_constraint("conversations_participant1_id_fkey", "conversations", type_="foreignkey")
    op.drop_constraint("conversations_participant2_id_fkey", "conversations", type_="foreignkey")
    op.drop_column("conversations", "participant1_id")
    op.drop_column("conversations", "participant2_id")

    # Messages table updates
    op.add_column("messages", sa.Column("text", sa.Text(), nullable=True))
    op.add_column("messages", sa.Column("read_at", sa.DateTime(), nullable=True))
    op.add_column(
        "messages",
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.alter_column("messages", "is_read", server_default=sa.false(), nullable=False)
    op.alter_column(
        "messages",
        "conversation_id",
        existing_type=sa.UUID(),
        nullable=False,
    )

    # Backfill text from legacy content column
    connection.execute(sa.text("UPDATE messages SET text = content"))
    op.alter_column("messages", "text", nullable=False)

    # Drop legacy columns we no longer use
    op.drop_constraint("messages_recipient_id_fkey", "messages", type_="foreignkey")
    op.drop_column("messages", "recipient_id")
    op.drop_column("messages", "attachments")
    op.drop_column("messages", "content")


def downgrade() -> None:
    # Recreate legacy message columns
    op.add_column("messages", sa.Column("content", sa.Text(), nullable=True))
    op.add_column(
        "messages",
        sa.Column("attachments", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column("messages", sa.Column("recipient_id", sa.UUID(), nullable=True))

    connection = op.get_bind()

    # Restore content from text
    connection.execute(sa.text("UPDATE messages SET content = text"))

    # Derive recipient_id from conversation participants (other participant)
    participant_map = connection.execute(
        sa.text(
            """
            SELECT conversation_id, ARRAY_AGG(user_id) AS users
            FROM conversation_participants
            GROUP BY conversation_id
            """
        )
    ).fetchall()
    participants_by_convo = {row.conversation_id: row.users for row in participant_map}
    messages = connection.execute(
        sa.text("SELECT id, conversation_id, sender_id FROM messages")
    ).fetchall()
    for msg in messages:
        users = participants_by_convo.get(msg.conversation_id, [])
        recipient = None
        if users:
            recipient = users[1] if users[0] == msg.sender_id else users[0]
        if recipient:
            connection.execute(
                sa.text(
                    "UPDATE messages SET recipient_id = :recipient WHERE id = :id"
                ),
                {"recipient": str(recipient), "id": str(msg.id)},
            )

    # Ensure required columns are not null
    op.alter_column("messages", "recipient_id", nullable=False)
    op.alter_column("messages", "content", nullable=False)

    # Drop new message columns
    op.drop_column("messages", "is_system")
    op.drop_column("messages", "read_at")
    op.drop_column("messages", "text")

    # Restore conversations participant columns
    op.add_column("conversations", sa.Column("participant2_id", sa.UUID(), nullable=True))
    op.add_column("conversations", sa.Column("participant1_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "conversations_participant2_id_fkey", "conversations", "users", ["participant2_id"], ["id"]
    )
    op.create_foreign_key(
        "conversations_participant1_id_fkey", "conversations", "users", ["participant1_id"], ["id"]
    )

    # Backfill participant columns from mapping table
    conversations = connection.execute(
        sa.text(
            """
            SELECT conversation_id, ARRAY_AGG(user_id ORDER BY created_at) AS users
            FROM conversation_participants
            GROUP BY conversation_id
            """
        )
    ).fetchall()
    for row in conversations:
        users = row.users
        participant1 = users[0] if users else None
        participant2 = users[1] if len(users) > 1 else None
        connection.execute(
            sa.text(
                """
                UPDATE conversations
                SET participant1_id = :p1, participant2_id = :p2
                WHERE id = :conversation_id
                """
            ),
            {"p1": participant1, "p2": participant2, "conversation_id": row.conversation_id},
        )

    op.alter_column("conversations", "participant1_id", nullable=False)
    op.alter_column("conversations", "participant2_id", nullable=False)

    # Drop participant mapping table and new conversation metadata
    op.drop_index("ix_conversation_participants_user_id", table_name="conversation_participants")
    op.drop_table("conversation_participants")
    op.drop_column("conversations", "is_archived")

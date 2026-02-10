# Repo Sanction Python
from database.python.connection import get_connection, dict_from_row

def get_by_guild(guild_id: str, limit: int = 100):
    """Toutes les sanctions d'une guild."""
    with get_connection() as conn:
        cursor = conn.execute("""
            SELECT s.*, u.username
            FROM sanctions s
            LEFT JOIN users u ON s.user_id = u.discord_id AND s.guild_id = u.guild_id
            WHERE s.guild_id = ?
            ORDER BY s.created_at DESC
            LIMIT ?
        """, (guild_id, limit))
        return [dict_from_row(row) for row in cursor.fetchall()]

def get_by_user(user_id: str, guild_id: str):
    """Sanctions d'un user."""
    with get_connection() as conn:
        cursor = conn.execute("""
            SELECT s.*, u.username
            FROM sanctions s
            LEFT JOIN users u ON s.user_id = u.discord_id AND s.guild_id = u.guild_id
            WHERE s.user_id = ? AND s.guild_id = ?
            ORDER BY s.created_at DESC
        """, (user_id, guild_id))
        return [dict_from_row(row) for row in cursor.fetchall()]

def get_active(guild_id: str):
    """Sanctions actives (bans/mutes en cours)."""
    with get_connection() as conn:
        cursor = conn.execute("""
            SELECT s.*, u.username
            FROM sanctions s
            LEFT JOIN users u ON s.user_id = u.discord_id AND s.guild_id = u.guild_id
            WHERE s.guild_id = ? AND s.active = 1
            ORDER BY s.created_at DESC
        """, (guild_id,))
        return [dict_from_row(row) for row in cursor.fetchall()]

def get_by_type(guild_id: str, sanction_type: str):
    """Sanctions par type (ban, mute, kick)."""
    with get_connection() as conn:
        cursor = conn.execute("""
            SELECT s.*, u.username
            FROM sanctions s
            LEFT JOIN users u ON s.user_id = u.discord_id AND s.guild_id = u.guild_id
            WHERE s.guild_id = ? AND s.type = ?
            ORDER BY s.created_at DESC
            LIMIT 100
        """, (guild_id, sanction_type))
        return [dict_from_row(row) for row in cursor.fetchall()]

def get_stats_by_type(guild_id: str):
    """Stats par type pour pie chart."""
    with get_connection() as conn:
        cursor = conn.execute("""
            SELECT type, COUNT(*) as count
            FROM sanctions
            WHERE guild_id = ?
            GROUP BY type
        """, (guild_id,))
        return [dict_from_row(row) for row in cursor.fetchall()]

def get_stats_by_day(guild_id: str, days: int = 30):
    """Sanctions par jour pour line chart."""
    with get_connection() as conn:
        cursor = conn.execute("""
            SELECT DATE(created_at) as date, type, COUNT(*) as count
            FROM sanctions
            WHERE guild_id = ?
            AND created_at >= datetime('now', ?)
            GROUP BY DATE(created_at), type
            ORDER BY date
        """, (guild_id, f'-{days} days'))
        return [dict_from_row(row) for row in cursor.fetchall()]

def create(sanction_data: dict):
    """Créer une nouvelle sanction."""
    with get_connection() as conn:
        cursor = conn.execute("""
            INSERT INTO sanctions (guild_id, user_id, moderator_id, type, reason, duration, expires_at, active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            sanction_data.get('guild_id'),
            sanction_data.get('user_id'),
            sanction_data.get('moderator_id'),
            sanction_data.get('type'),
            sanction_data.get('duration'),
            sanction_data.get('expires_at'),
            sanction_data.get('active', 1)
        ))
        conn.commit()
        return cursor.lastrowid

def deactivate(sanction_id: int):
    """Désactiver une sanction."""
    with get_connection() as conn:
        conn.execute(
            "UPDATE sanctions SET active = 0 WHERE id = ?",
            (sanction_id,)
        )
        conn.commit()

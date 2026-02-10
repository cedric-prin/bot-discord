# Repo Warning Python
from database.python.connection import get_connection, dict_from_row
from datetime import datetime, timedelta

def get_by_guild(guild_id: str, limit: int = 100):
    """Tous les warnings d'une guild."""
    with get_connection() as conn:
        cursor = conn.execute("""
            SELECT w.*, u.username 
            FROM warnings w
            LEFT JOIN users u ON w.user_id = u.discord_id AND w.guild_id = u.guild_id
            WHERE w.guild_id = ?
            ORDER BY w.created_at DESC
            LIMIT ?
        """, (guild_id, limit))
        return [dict_from_row(row) for row in cursor.fetchall()]

def get_by_user(user_id: str, guild_id: str):
    """Warnings d'un user."""
    with get_connection() as conn:
        cursor = conn.execute("""
            SELECT w.*, u.username 
            FROM warnings w
            LEFT JOIN users u ON w.user_id = u.discord_id AND w.guild_id = u.guild_id
            WHERE w.user_id = ? AND w.guild_id = ?
            ORDER BY w.created_at DESC
        """, (user_id, guild_id))
        return [dict_from_row(row) for row in cursor.fetchall()]

def get_active_by_user(user_id: str, guild_id: str):
    """Warnings actifs seulement."""
    with get_connection() as conn:
        cursor = conn.execute("""
            SELECT w.*, u.username 
            FROM warnings w
            LEFT JOIN users u ON w.user_id = u.discord_id AND w.guild_id = u.guild_id
            WHERE w.user_id = ? AND w.guild_id = ? AND w.active = 1
            ORDER BY w.created_at DESC
        """, (user_id, guild_id))
        return [dict_from_row(row) for row in cursor.fetchall()]

def get_recent(guild_id: str, days: int = 7):
    """Warnings récents."""
    with get_connection() as conn:
        cursor = conn.execute("""
            SELECT w.*, u.username 
            FROM warnings w
            LEFT JOIN users u ON w.user_id = u.discord_id AND w.guild_id = u.guild_id
            WHERE w.guild_id = ? 
            AND w.created_at >= datetime('now', ?)
            ORDER BY w.created_at DESC
            LIMIT 50
        """, (guild_id, f'-{days} days'))
        return [dict_from_row(row) for row in cursor.fetchall()]

def get_stats_by_day(guild_id: str, days: int = 30):
    """Warnings par jour pour graphique."""
    with get_connection() as conn:
        cursor = conn.execute("""
            SELECT DATE(created_at) as date, COUNT(*) as count
            FROM warnings
            WHERE guild_id = ?
            AND created_at >= datetime('now', ?)
            GROUP BY DATE(created_at)
            ORDER BY date
        """, (guild_id, f'-{days} days'))
        return [dict_from_row(row) for row in cursor.fetchall()]

def get_top_warned_users(guild_id: str, limit: int = 10):
    """Users avec le plus de warnings."""
    with get_connection() as conn:
        cursor = conn.execute("""
            SELECT user_id, COUNT(*) as warning_count
            FROM warnings
            WHERE guild_id = ? AND active = 1
            GROUP BY user_id
            ORDER BY warning_count DESC
            LIMIT ?
        """, (guild_id, limit))
        return [dict_from_row(row) for row in cursor.fetchall()]

# Repo Guild Python
import json
from database.python.connection import get_connection, dict_from_row

def get_all():
    """Récupère toutes les guilds."""
    with get_connection() as conn:
        cursor = conn.execute("SELECT * FROM guilds ORDER BY name")
        return [dict_from_row(row) for row in cursor.fetchall()]

def get_by_id(guild_id: str):
    """Récupère une guild par ID."""
    with get_connection() as conn:
        cursor = conn.execute(
            "SELECT * FROM guilds WHERE id = ?", 
            (guild_id,)
        )
        row = cursor.fetchone()
        if row:
            data = dict_from_row(row)
            # Parse JSON automod_config
            if data.get('automod_config'):
                data['automod_config'] = json.loads(data['automod_config'])
            return data
        return None

def get_stats(guild_id: str):
    """Statistiques d'une guild."""
    with get_connection() as conn:
        stats = {}
        
        # Total warnings
        cursor = conn.execute(
            "SELECT COUNT(*) FROM warnings WHERE guild_id = ?",
            (guild_id,)
        )
        stats['total_warnings'] = cursor.fetchone()[0]
        
        # Total sanctions
        cursor = conn.execute(
            "SELECT COUNT(*) FROM sanctions WHERE guild_id = ?",
            (guild_id,)
        )
        stats['total_sanctions'] = cursor.fetchone()[0]
        
        # Sanctions actives
        cursor = conn.execute(
            "SELECT COUNT(*) FROM sanctions WHERE guild_id = ? AND active = 1",
            (guild_id,)
        )
        stats['active_sanctions'] = cursor.fetchone()[0]
        
        # Users trackés
        cursor = conn.execute(
            "SELECT COUNT(*) FROM users WHERE guild_id = ?",
            (guild_id,)
        )
        stats['tracked_users'] = cursor.fetchone()[0]
        
        return stats

def update_settings(guild_id: str, settings: dict):
    """Met à jour les settings depuis le panel."""
    with get_connection() as conn:
        # Construire la requête dynamiquement
        fields = []
        values = []
        for key, value in settings.items():
            if key == 'automod_config':
                value = json.dumps(value)
            fields.append(f"{key} = ?")
            values.append(value)
        
        values.append(guild_id)
        query = f"UPDATE guilds SET {', '.join(fields)}, updated_at = datetime('now') WHERE id = ?"
        conn.execute(query, values)
        conn.commit()

# Connexion à la base SQLite
import sqlite3
import os
from pathlib import Path

# Chemin vers la BDD (relative au projet)
DB_PATH = Path(__file__).parent.parent.parent / 'database' / 'cardinal.db'

def get_connection():
    """Retourne une connexion à la BDD."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row  # Accès par nom de colonne
    return conn

def dict_from_row(row):
    """Convertit une Row en dict."""
    if row is None:
        return None
    return dict(row)

class DatabaseConnection:
    """Context manager pour connexions."""
    def __enter__(self):
        self.conn = get_connection()
        return self.conn
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.conn.close()

# Usage:
# with DatabaseConnection() as conn:
#     cursor = conn.execute("SELECT * FROM guilds")
#     rows = cursor.fetchall()

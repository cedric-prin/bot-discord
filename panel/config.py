import os
from dotenv import load_dotenv

# Charger les variables d'environnement
load_dotenv()

# Configuration Base de données
DATABASE_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', 3306)),
    'user': os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD', ''),
    'database': os.getenv('DB_NAME', 'discord_bot')
}

# Configuration Panel
PANEL_CONFIG = {
    'title': 'Bot Modération - Panel',
    'version': '1.0.0',
    'debug': os.getenv('DEBUG', 'false').lower() == 'true'
}

# Configuration Auth
AUTH_CONFIG = {
    'enabled': os.getenv('PANEL_AUTH_ENABLED', 'true').lower() == 'true',
    'username': os.getenv('PANEL_USERNAME', 'admin'),
    'password': os.getenv('PANEL_PASSWORD', 'admin'),  # À changer!
    'session_expiry': 3600 * 24  # 24 heures
}

# Configuration Discord API (pour récupérer infos)
DISCORD_CONFIG = {
    'bot_token': os.getenv('DISCORD_TOKEN'),
    'api_base': 'https://discord.com/api/v10'
}

# Couleurs
COLORS = {
    'primary': '#5865F2',      # Discord Blurple
    'success': '#57F287',      # Discord Green
    'warning': '#FEE75C',      # Discord Yellow
    'danger': '#ED4245',       # Discord Red
    'info': '#5865F2',
    'dark': '#2C2F33',
    'darker': '#23272A'
}

# Limites pagination
PAGINATION = {
    'default_page_size': 20,
    'max_page_size': 100
}

from datetime import datetime, timedelta
import re

def parse_duration(duration_str: str) -> timedelta:
    """
    Parse une chaîne de durée en timedelta
    Ex: "1d", "2h", "30m", "1w"
    """
    if not duration_str:
        return None
    
    pattern = r'^(\d+)([smhdw])$'
    match = re.match(pattern, duration_str.lower())
    
    if not match:
        return None
    
    value = int(match.group(1))
    unit = match.group(2)
    
    units = {
        's': 'seconds',
        'm': 'minutes',
        'h': 'hours',
        'd': 'days',
        'w': 'weeks'
    }
    
    return timedelta(**{units[unit]: value})

def format_timedelta(td: timedelta) -> str:
    """
    Formate un timedelta en chaîne lisible
    """
    if td is None:
        return "N/A"
    
    total_seconds = int(td.total_seconds())
    
    if total_seconds < 60:
        return f"{total_seconds}s"
    elif total_seconds < 3600:
        return f"{total_seconds // 60}m"
    elif total_seconds < 86400:
        return f"{total_seconds // 3600}h"
    elif total_seconds < 604800:
        return f"{total_seconds // 86400}j"
    else:
        return f"{total_seconds // 604800}sem"

def time_ago(dt: datetime) -> str:
    """
    Retourne le temps écoulé de manière lisible
    Ex: "Il y a 5 minutes", "Il y a 2 jours"
    """
    if dt is None:
        return "N/A"
    
    now = datetime.now()
    diff = now - dt
    
    seconds = diff.total_seconds()
    
    if seconds < 60:
        return "À l'instant"
    elif seconds < 3600:
        minutes = int(seconds / 60)
        return f"Il y a {minutes}min"
    elif seconds < 86400:
        hours = int(seconds / 3600)
        return f"Il y a {hours}h"
    elif seconds < 604800:
        days = int(seconds / 86400)
        return f"Il y a {days}j"
    elif seconds < 2592000:
        weeks = int(seconds / 604800)
        return f"Il y a {weeks}sem"
    else:
        months = int(seconds / 2592000)
        return f"Il y a {months}mois"

def truncate(text: str, max_length: int = 50) -> str:
    """
    Tronque un texte avec ellipsis
    """
    if text is None:
        return ""
    if len(text) <= max_length:
        return text
    return text[:max_length - 3] + "..."

def sanitize_input(text: str) -> str:
    """
    Nettoie une entrée utilisateur
    """
    if text is None:
        return ""
    # Supprimer les caractères dangereux
    return re.sub(r'[<>&"\']', '', text.strip())

def validate_discord_id(id_str: str) -> bool:
    """
    Valide un ID Discord (snowflake)
    """
    if not id_str:
        return False
    return bool(re.match(r'^\d{17,20}$', str(id_str)))

def format_number(n: int) -> str:
    """
    Formate un nombre avec séparateurs
    """
    if n is None:
        return "0"
    return f"{n:,}".replace(",", " ")

def calculate_percentage(part: int, total: int) -> float:
    """
    Calcule un pourcentage safe
    """
    if total == 0:
        return 0
    return round((part / total) * 100, 1)

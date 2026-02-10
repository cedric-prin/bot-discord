-- Schéma SQL complet pour le bot Discord Cardinal
-- À exécuter avec : sqlite3 cardinal.db < schema.sql

-- Table guilds - Configuration serveurs
CREATE TABLE IF NOT EXISTS guilds (
  id TEXT PRIMARY KEY,
  name TEXT,
  prefix TEXT DEFAULT '!',
  log_channel_id TEXT,
  mod_log_channel_id TEXT,
  mute_role_id TEXT,
  automod_enabled INTEGER DEFAULT 1,
  automod_config TEXT,
  welcome_channel_id TEXT,
  welcome_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table users - Utilisateurs trackés
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  username TEXT,
  total_warnings INTEGER DEFAULT 0,
  total_sanctions INTEGER DEFAULT 0,
  risk_score INTEGER DEFAULT 0,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(discord_id, guild_id)
);

-- Table warnings - Avertissements
CREATE TABLE IF NOT EXISTS warnings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  moderator_id TEXT NOT NULL,
  reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  active INTEGER DEFAULT 1,
  expires_at DATETIME
);

-- Table sanctions - Bans/Mutes/Kicks
CREATE TABLE IF NOT EXISTS sanctions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  moderator_id TEXT NOT NULL,
  type TEXT CHECK(type IN ('kick', 'ban', 'mute', 'unmute', 'unban', 'timeout')),
  reason TEXT,
  duration INTEGER, -- en secondes, NULL si permanent
  expires_at DATETIME,
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table mod_logs - Historique actions modération
CREATE TABLE IF NOT EXISTS mod_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  action_type TEXT,
  target_id TEXT,
  moderator_id TEXT,
  reason TEXT,
  details TEXT, -- JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table automod_logs - Actions automod
CREATE TABLE IF NOT EXISTS automod_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  trigger_type TEXT CHECK(trigger_type IN ('spam', 'links', 'invites', 'caps', 'mass_mentions', 'blacklist')),
  message_content TEXT,
  action_taken TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table ai_logs - Logs IA (Phase 9)
CREATE TABLE IF NOT EXISTS ai_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT,
  user_id TEXT,
  action_type TEXT,
  input_text TEXT,
  output_text TEXT,
  tokens_used INTEGER,
  cost REAL,
  model TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_warnings_guild_user ON warnings(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_sanctions_guild_user ON sanctions(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_sanctions_active ON sanctions(active, expires_at);
CREATE INDEX IF NOT EXISTS idx_mod_logs_guild ON mod_logs(guild_id, created_at);
CREATE INDEX IF NOT EXISTS idx_automod_logs_guild ON automod_logs(guild_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_logs_guild ON ai_logs(guild_id, created_at);

-- Trigger pour mettre à jour updated_at
CREATE TRIGGER IF NOT EXISTS update_guilds_timestamp 
AFTER UPDATE ON guilds
BEGIN
  UPDATE guilds SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
AFTER UPDATE ON users
BEGIN
  UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

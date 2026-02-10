-- Migration de la base de données existante vers le nouveau schéma
-- À exécuter avec : sqlite3 database/db.sqlite < migration.sql

-- Vérifier si les nouvelles colonnes existent avant de les ajouter

-- Mise à jour de la table guilds
ALTER TABLE guilds ADD COLUMN name TEXT;
ALTER TABLE guilds ADD COLUMN log_channel_id TEXT;
ALTER TABLE guilds ADD COLUMN mod_log_channel_id TEXT;
ALTER TABLE guilds ADD COLUMN mute_role_id TEXT;
ALTER TABLE guilds ADD COLUMN automod_enabled INTEGER DEFAULT 1;
ALTER TABLE guilds ADD COLUMN automod_config TEXT;
ALTER TABLE guilds ADD COLUMN welcome_channel_id TEXT;
ALTER TABLE guilds ADD COLUMN welcome_message TEXT;
ALTER TABLE guilds ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;

-- Créer la table users si elle n'existe pas
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

-- Ajouter colonnes manquantes à warnings si nécessaire
ALTER TABLE warnings ADD COLUMN active INTEGER DEFAULT 1;
ALTER TABLE warnings ADD COLUMN expires_at DATETIME;

-- Ajouter colonnes manquantes à sanctions si nécessaire
ALTER TABLE sanctions ADD COLUMN duration INTEGER;
ALTER TABLE sanctions ADD COLUMN expires_at DATETIME;
ALTER TABLE sanctions ADD COLUMN active INTEGER DEFAULT 1;

-- Créer les tables manquantes
CREATE TABLE IF NOT EXISTS mod_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  action_type TEXT,
  target_id TEXT,
  moderator_id TEXT,
  reason TEXT,
  details TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS automod_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  trigger_type TEXT CHECK(trigger_type IN ('spam', 'links', 'invites', 'caps', 'mass_mentions', 'blacklist')),
  message_content TEXT,
  action_taken TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

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

-- Créer les index pour performance
CREATE INDEX IF NOT EXISTS idx_warnings_guild_user ON warnings(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_sanctions_guild_user ON sanctions(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_sanctions_active ON sanctions(active, expires_at);
CREATE INDEX IF NOT EXISTS idx_mod_logs_guild ON mod_logs(guild_id, created_at);
CREATE INDEX IF NOT EXISTS idx_automod_logs_guild ON automod_logs(guild_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_logs_guild ON ai_logs(guild_id, created_at);
CREATE INDEX IF NOT EXISTS idx_users_discord_guild ON users(discord_id, guild_id);

-- Créer les triggers pour updated_at
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

-- Mettre à jour les types de sanctions si nécessaire
UPDATE sanctions SET type = 'timeout' WHERE type = 'TEMPOUT' OR type = 'tempout';
UPDATE sanctions SET type = 'unmute' WHERE type = 'UNMUTE';
UPDATE sanctions SET type = 'unban' WHERE type = 'UNBAN';

-- Nettoyer les données invalides
DELETE FROM warnings WHERE user_id IS NULL OR guild_id IS NULL;
DELETE FROM sanctions WHERE user_id IS NULL OR guild_id IS NULL OR moderator_id IS NULL;

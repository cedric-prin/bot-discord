-- Schéma SQL unifié pour le bot Discord Cardinal
-- Version: 2.0 - Schéma complet et cohérent
-- À exécuter avec : sqlite3 cardinal.db < schema-unified.sql

-- Activer les contraintes de clés étrangères
PRAGMA foreign_keys = ON;

-- Table guilds - Configuration serveurs
CREATE TABLE IF NOT EXISTS guilds (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  prefix TEXT DEFAULT '!',
  log_channel_id TEXT,
  mod_log_channel_id TEXT,
  mute_role_id TEXT,
  welcome_channel_id TEXT,
  welcome_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table automod - Configuration AutoMod par serveur
CREATE TABLE IF NOT EXISTS automod (
  guild_id TEXT PRIMARY KEY,
  enabled INTEGER DEFAULT 0,
  exempt_roles TEXT DEFAULT '[]',
  exempt_channels TEXT DEFAULT '[]',
  spam_enabled INTEGER DEFAULT 1,
  spam_max_messages INTEGER DEFAULT 5,
  spam_time_window INTEGER DEFAULT 5000,
  spam_max_duplicates INTEGER DEFAULT 3,
  spam_action TEXT DEFAULT 'delete',
  invites_enabled INTEGER DEFAULT 1,
  invites_allow_own_server INTEGER DEFAULT 1,
  invites_action TEXT DEFAULT 'delete',
  badwords_enabled INTEGER DEFAULT 0,
  badwords_detect_leet INTEGER DEFAULT 1,
  badwords_whole_word_only INTEGER DEFAULT 0,
  badwords_action TEXT DEFAULT 'delete',
  badwords_count INTEGER DEFAULT 0,
  links_enabled INTEGER DEFAULT 0,
  links_block_all INTEGER DEFAULT 0,
  links_action TEXT DEFAULT 'delete',
  caps_enabled INTEGER DEFAULT 1,
  caps_max_percentage INTEGER DEFAULT 70,
  caps_min_length INTEGER DEFAULT 10,
  caps_action TEXT DEFAULT 'delete',
  mentions_enabled INTEGER DEFAULT 1,
  mentions_max_user_mentions INTEGER DEFAULT 5,
  mentions_max_role_mentions INTEGER DEFAULT 3,
  mentions_block_everyone INTEGER DEFAULT 0,
  mentions_action TEXT DEFAULT 'delete',
  antiraid_enabled INTEGER DEFAULT 1,
  antiraid_join_threshold INTEGER DEFAULT 10,
  antiraid_join_window INTEGER DEFAULT 10000,
  antiraid_account_age INTEGER DEFAULT 7,
  antiraid_action TEXT DEFAULT 'lockdown',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
);

-- Table users - Utilisateurs trackés par serveur
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  username TEXT,
  total_warnings INTEGER DEFAULT 0,
  total_sanctions INTEGER DEFAULT 0,
  risk_score INTEGER DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(discord_id, guild_id),
  FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
);

-- Table warnings - Avertissements modération
CREATE TABLE IF NOT EXISTS warnings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  moderator_id TEXT NOT NULL,
  reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  active INTEGER DEFAULT 1,
  expires_at DATETIME,
  FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
);

-- Table sanctions - Bans/Mutes/Kicks/Timeouts
CREATE TABLE IF NOT EXISTS sanctions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  moderator_id TEXT NOT NULL,
  type TEXT CHECK(type IN ('kick', 'ban', 'mute', 'unmute', 'unban', 'timeout')) NOT NULL,
  reason TEXT,
  duration INTEGER,
  expires_at DATETIME,
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
);

-- Table mod_logs - Historique complet des actions de modération
CREATE TABLE IF NOT EXISTS mod_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  target_id TEXT,
  moderator_id TEXT,
  reason TEXT,
  details TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
);

-- Table automod_logs - Actions automatiques de modération (optimisée)
CREATE TABLE IF NOT EXISTS automod_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  moderator_id TEXT,
  channel_id TEXT,
  message_id TEXT,
  trigger_type TEXT CHECK(trigger_type IN ('spam', 'links', 'invites', 'caps', 'mass_mentions', 'blacklist', 'bad_words')),
  trigger_content TEXT,
  action_taken TEXT,
  severity INTEGER DEFAULT 1,
  confidence_score REAL,
  details TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
);

-- Table ai_logs - Logs des fonctionnalités IA
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
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
);

-- Index pour optimiser les performances
CREATE INDEX IF NOT EXISTS idx_users_discord_guild ON users(discord_id, guild_id);
CREATE INDEX IF NOT EXISTS idx_warnings_guild_user ON warnings(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_warnings_active ON warnings(active, expires_at);
CREATE INDEX IF NOT EXISTS idx_sanctions_guild_user ON sanctions(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_sanctions_active ON sanctions(active, expires_at);
CREATE INDEX IF NOT EXISTS idx_mod_logs_guild ON mod_logs(guild_id, created_at);
CREATE INDEX IF NOT EXISTS idx_automod_logs_guild ON automod_logs(guild_id, created_at);
CREATE INDEX IF NOT EXISTS idx_automod_logs_guild_user ON automod_logs(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_automod_logs_trigger_type ON automod_logs(trigger_type);
CREATE INDEX IF NOT EXISTS idx_automod_logs_user ON automod_logs(user_id, trigger_type);
CREATE INDEX IF NOT EXISTS idx_ai_logs_guild ON ai_logs(guild_id, created_at);
CREATE INDEX IF NOT EXISTS idx_automod_guild ON automod(guild_id);
CREATE INDEX IF NOT EXISTS idx_automod_words_guild_word ON automod_words(guild_id, word);

-- Triggers pour maintenir les timestamps à jour
CREATE TRIGGER IF NOT EXISTS update_guilds_timestamp 
AFTER UPDATE ON guilds
BEGIN
  UPDATE guilds SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_automod_timestamp 
AFTER UPDATE ON automod
BEGIN
  UPDATE automod SET updated_at = CURRENT_TIMESTAMP WHERE guild_id = NEW.guild_id;
END;

CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
AFTER UPDATE ON users
BEGIN
  UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Vue pour les statistiques de modération par serveur
CREATE VIEW IF NOT EXISTS guild_stats AS
SELECT 
  g.id as guild_id,
  g.name as guild_name,
  COUNT(DISTINCT u.discord_id) as total_users,
  COUNT(DISTINCT CASE WHEN w.active = 1 THEN w.id END) as active_warnings,
  COUNT(DISTINCT CASE WHEN s.active = 1 AND s.type IN ('ban', 'mute') THEN s.id END) as active_sanctions,
  COUNT(DISTINCT al.id) as automod_actions,
  COUNT(DISTINCT ml.id) as total_mod_actions,
  MAX(w.created_at) as last_warning,
  MAX(s.created_at) as last_sanction
FROM guilds g
LEFT JOIN users u ON g.id = u.guild_id
LEFT JOIN warnings w ON g.id = w.guild_id
LEFT JOIN sanctions s ON g.id = s.guild_id
LEFT JOIN automod_logs al ON g.id = al.guild_id
LEFT JOIN mod_logs ml ON g.id = ml.guild_id
GROUP BY g.id, g.name;

// Accès JS à la base de données
const sqlite3 = require('sqlite3').verbose();
const config = require('../../config/config');
const logger = require('../../bot/utils/logger');

const db = new sqlite3.Database(config.database.path, (err) => {
  if (err) {
    logger.error('Erreur de connexion à la base de données', { error: err.message });
  } else {
    logger.info('Connecté à la base de données SQLite');
    initializeTables();
  }
});

function initializeTables() {
  // Table des guilds
  db.run(`CREATE TABLE IF NOT EXISTS guilds (
    id TEXT PRIMARY KEY,
    name TEXT,
    prefix TEXT DEFAULT '!',
    logs_channel TEXT,
    mod_role TEXT,
    admin_role TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Table des users
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT,
    discriminator TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Table des warnings
  db.run(`CREATE TABLE IF NOT EXISTS warnings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    guild_id TEXT,
    moderator_id TEXT,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (guild_id) REFERENCES guilds(id)
  )`);

  // Table des sanctions
  db.run(`CREATE TABLE IF NOT EXISTS sanctions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    guild_id TEXT,
    type TEXT, -- 'ban', 'kick', 'mute', 'warn'
    reason TEXT,
    moderator_id TEXT,
    duration INTEGER, -- en ms, null pour permanent
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    active BOOLEAN DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (guild_id) REFERENCES guilds(id)
  )`);

  logger.info('Tables initialisées');
}

module.exports = db;

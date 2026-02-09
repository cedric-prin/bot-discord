const db = require('./index');

// Activer les clés étrangères
db.run('PRAGMA foreign_keys = ON');

const tableQueries = [
    `CREATE TABLE IF NOT EXISTS guilds (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
    `CREATE TABLE IF NOT EXISTS config (
    guild_id INTEGER PRIMARY KEY,
    prefix TEXT DEFAULT '!',
    log_channel_id INTEGER,
    mod_role_id INTEGER,
    anti_spam INTEGER DEFAULT 0,
    anti_link INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
  )`,
    `CREATE TABLE IF NOT EXISTS users (
    id INTEGER NOT NULL,
    guild_id INTEGER NOT NULL,
    username TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, guild_id),
    FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
  )`,
    `CREATE TABLE IF NOT EXISTS warnings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    moderator_id INTEGER NOT NULL,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id, guild_id) REFERENCES users(id, guild_id) ON DELETE CASCADE
  )`,
    `CREATE TABLE IF NOT EXISTS sanctions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    moderator_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    reason TEXT,
    duration INTEGER,
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id, guild_id) REFERENCES users(id, guild_id) ON DELETE CASCADE,
    FOREIGN KEY (moderator_id, guild_id) REFERENCES users(id, guild_id)
  )`
];

tableQueries.forEach(query => {
    db.run(query, err => {
        if (err) console.error('Erreur création table :', err.message);
    });
});

console.log('Initialisation des tables terminée.');

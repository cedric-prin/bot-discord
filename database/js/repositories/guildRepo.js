// Repo Guild - opérations CRUD

const db = require('../index');
const Guild = require('../models/Guild');

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function runCb(err) {
      if (err) return reject(err);
      resolve({ changes: this.changes, lastID: this.lastID });
    });
  });
}

const ALLOWED_UPDATE_FIELDS = new Set([
  'name',
  'prefix',
  'log_channel_id',
  'mod_log_channel_id',
  'mute_role_id',
  'automod_enabled',
  'automod_config',
  'welcome_channel_id',
  'welcome_message',
  'warn_thresholds',
]);

const guildRepo = {
  async findById(guildId) {
    const row = await dbGet('SELECT * FROM guilds WHERE id = ?', [guildId]);
    return row ? new Guild(row) : null;
  },

  // Alias pratique pour récupérer les "settings" de la guild
  async getSettings(guildId) {
    const row = await dbGet('SELECT * FROM guilds WHERE id = ?', [guildId]);
    if (!row) return null;
    
    // Parser les settings JSON
    const settings = {};
    if (row.automod_config) {
      try {
        settings.automod = JSON.parse(row.automod_config);
      } catch (e) {
        settings.automod = {};
      }
    }
    
    if (row.warn_thresholds) {
      try {
        settings.warnThresholds = JSON.parse(row.warn_thresholds);
      } catch (e) {
        settings.warnThresholds = {};
      }
    }
    
    // Autres champs
    if (row.log_channel_id) settings.logChannelId = row.log_channel_id;
    if (row.mod_log_channel_id) settings.modLogChannelId = row.mod_log_channel_id;
    if (row.mute_role_id) settings.muteRoleId = row.mute_role_id;
    
    return settings;
  },

  findOrCreate(guildId, guildName) {
    // Atomique: transaction + INSERT OR IGNORE + SELECT
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN IMMEDIATE', (beginErr) => {
          if (beginErr) return reject(beginErr);

          db.run(
            `
            INSERT OR IGNORE INTO guilds (id, name, created_at, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `,
            [guildId, guildName],
            (insertErr) => {
              if (insertErr) {
                return db.run('ROLLBACK', () => reject(insertErr));
              }

              db.get(
                'SELECT * FROM guilds WHERE id = ?',
                [guildId],
                (selectErr, row) => {
                  if (selectErr) {
                    return db.run('ROLLBACK', () => reject(selectErr));
                  }

                  db.run('COMMIT', (commitErr) => {
                    if (commitErr) return reject(commitErr);
                    resolve(row ? new Guild(row) : null);
                  });
                }
              );
            }
          );
        });
      });
    });
  },

  async update(guildId, data = {}) {
    if (!data || typeof data !== 'object') {
      throw new TypeError('update expects an object');
    }

    const entries = Object.entries(data).filter(([k, v]) => v !== undefined && ALLOWED_UPDATE_FIELDS.has(k));
    if (entries.length === 0) {
      return this.findById(guildId);
    }

    const fields = entries.map(([k]) => k);
    const values = entries.map(([, v]) => v);
    const setClause = fields.map((f) => `${f} = ?`).join(', ');

    await dbRun(
      `
      UPDATE guilds
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [...values, guildId]
    );

    return this.findById(guildId);
  },

  updateSettings: async function(guildId, settings) {
    return this.update(guildId, settings);
  },

  setLogChannel(guildId, channelId) {
    return this.update(guildId, { log_channel_id: channelId });
  },

  setModLogChannel(guildId, channelId) {
    return this.update(guildId, { mod_log_channel_id: channelId });
  },

  setMuteRole(guildId, roleId) {
    return this.update(guildId, { mute_role_id: roleId });
  },

  async getAll() {
    const rows = await dbAll('SELECT * FROM guilds ORDER BY updated_at DESC, created_at DESC');
    return rows.map((r) => new Guild(r));
  },

  async delete(guildId) {
    const res = await dbRun('DELETE FROM guilds WHERE id = ?', [guildId]);
    return res.changes > 0;
  },
};

module.exports = guildRepo;

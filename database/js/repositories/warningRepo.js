// Repo Warning - opérations CRUD

const db = require('../index');
const Warning = require('../models/Warning');

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

function toSQLiteDateValue(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

const warningRepo = {
  async create(warning) {
    const w = warning instanceof Warning ? warning : new Warning(warning);
    const data = w.toDatabase();

    const expiresAt = toSQLiteDateValue(data.expires_at);

    const res = await dbRun(
      `
      INSERT INTO warnings
        (guild_id, user_id, moderator_id, reason, created_at, active, expires_at)
      VALUES
        (?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)
      `,
      [
        data.guild_id,
        data.user_id,
        data.moderator_id,
        data.reason,
        data.active ? 1 : 0,
        expiresAt,
      ]
    );

    return this.findById(res.lastID);
  },

  async findById(id) {
    const row = await dbGet('SELECT * FROM warnings WHERE id = ?', [id]);
    return row ? new Warning(row) : null;
  },

  async findByUser(userId, guildId) {
    const rows = await dbAll(
      `
      SELECT * FROM warnings
      WHERE user_id = ? AND guild_id = ?
      ORDER BY datetime(created_at) DESC
      `,
      [userId, guildId]
    );
    return rows.map((r) => new Warning(r));
  },

  async findActiveByUser(userId, guildId) {
    const rows = await dbAll(
      `
      SELECT * FROM warnings
      WHERE user_id = ? AND guild_id = ?
        AND active = 1
        AND (expires_at IS NULL OR datetime(expires_at) > CURRENT_TIMESTAMP)
      ORDER BY datetime(created_at) DESC
      `,
      [userId, guildId]
    );
    return rows.map((r) => new Warning(r));
  },

  async countActiveByUser(userId, guildId) {
    const row = await dbGet(
      `
      SELECT COUNT(*) AS count
      FROM warnings
      WHERE user_id = ? AND guild_id = ?
        AND active = 1
        AND (expires_at IS NULL OR datetime(expires_at) > CURRENT_TIMESTAMP)
      `,
      [userId, guildId]
    );
    return row ? Number(row.count) : 0;
  },

  async deactivate(id) {
    await dbRun('UPDATE warnings SET active = 0 WHERE id = ?', [id]);
    return this.findById(id);
  },

  async deactivateAllForUser(userId, guildId) {
    const res = await dbRun(
      `
      UPDATE warnings
      SET active = 0
      WHERE user_id = ? AND guild_id = ? AND active = 1
      `,
      [userId, guildId]
    );
    return res.changes;
  },

  async deleteById(id) {
    const res = await dbRun('DELETE FROM warnings WHERE id = ?', [id]);
    return res.changes > 0;
  },

  async getRecent(guildId, limit = 50) {
    const rows = await dbAll(
      `
      SELECT * FROM warnings
      WHERE guild_id = ?
      ORDER BY datetime(created_at) DESC
      LIMIT ?
      `,
      [guildId, limit]
    );
    return rows.map((r) => new Warning(r));
  },

  async cleanExpired() {
    // Nettoyage: on désactive ceux arrivés à expiration
    const res = await dbRun(
      `
      UPDATE warnings
      SET active = 0
      WHERE active = 1
        AND expires_at IS NOT NULL
        AND datetime(expires_at) <= CURRENT_TIMESTAMP
      `
    );
    return res.changes;
  },
};

module.exports = warningRepo;

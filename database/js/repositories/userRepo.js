// Repo User - opérations CRUD

const { dbGet, dbRun, dbAll } = require('../index');
const User = require('../models/User');

const ALLOWED_UPDATE_FIELDS = new Set([
  'username',
  'total_warnings',
  'total_sanctions',
  'risk_score',
  'notes',
]);

function normalizeUpdateData(data = {}) {
  // Accepte camelCase ET snake_case en entrée
  const mapped = {
    username: data.username,
    total_warnings: data.total_warnings ?? data.totalWarnings,
    total_sanctions: data.total_sanctions ?? data.totalSanctions,
    risk_score: data.risk_score ?? data.riskScore,
    notes: data.notes,
  };

  return Object.fromEntries(
    Object.entries(mapped).filter(([k, v]) => v !== undefined && ALLOWED_UPDATE_FIELDS.has(k))
  );
}

const userRepo = {
  async findByDiscordId(discordId, guildId) {
    const row = await dbGet(
      `
      SELECT * FROM users
      WHERE discord_id = ? AND guild_id = ?
      `,
      [discordId, guildId]
    );
    return row ? new User(row) : null;
  },

  findOrCreate(discordId, guildId, username = '') {
    // Atomique: transaction + INSERT OR IGNORE + SELECT
    return new Promise((resolve, reject) => {
      const { getDb } = require('../index');
      const db = getDb();
      
      db.serialize(() => {
        db.run('BEGIN IMMEDIATE', (beginErr) => {
          if (beginErr) return reject(beginErr);

          db.run(
            `
            INSERT OR IGNORE INTO users (discord_id, guild_id, username, created_at, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `,
            [discordId, guildId, username],
            (insertErr) => {
              if (insertErr) {
                return db.run('ROLLBACK', () => reject(insertErr));
              }

              db.get(
                `
                SELECT * FROM users
                WHERE discord_id = ? AND guild_id = ?
                `,
                [discordId, guildId],
                (selectErr, row) => {
                  if (selectErr) {
                    return db.run('ROLLBACK', () => reject(selectErr));
                  }

                  db.run('COMMIT', (commitErr) => {
                    if (commitErr) return reject(commitErr);
                    resolve(row ? new User(row) : null);
                  });
                }
              );
            }
          );
        });
      });
    });
  },

  async update(discordId, guildId, data = {}) {
    const normalized = normalizeUpdateData(data);
    const entries = Object.entries(normalized).filter(([, v]) => v !== undefined);

    if (entries.length === 0) {
      return this.findByDiscordId(discordId, guildId);
    }

    const fields = entries.map(([k]) => k);
    const values = entries.map(([, v]) => v);
    const setClause = fields.map((f) => `${f} = ?`).join(', ');

    await dbRun(
      `
      UPDATE users
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE discord_id = ? AND guild_id = ?
      `,
      [...values, discordId, guildId]
    );

    return this.findByDiscordId(discordId, guildId);
  },

  async incrementWarnings(discordId, guildId) {
    await dbRun(
      `
      UPDATE users
      SET total_warnings = total_warnings + 1,
          risk_score = (total_warnings + 1) * 10 + total_sanctions * 25,
          updated_at = CURRENT_TIMESTAMP
      WHERE discord_id = ? AND guild_id = ?
      `,
      [discordId, guildId]
    );

    return this.findByDiscordId(discordId, guildId);
  },

  async incrementSanctions(discordId, guildId) {
    await dbRun(
      `
      UPDATE users
      SET total_sanctions = total_sanctions + 1,
          risk_score = total_warnings * 10 + (total_sanctions + 1) * 25,
          updated_at = CURRENT_TIMESTAMP
      WHERE discord_id = ? AND guild_id = ?
      `,
      [discordId, guildId]
    );

    return this.findByDiscordId(discordId, guildId);
  },

  async updateRiskScore(discordId, guildId, score) {
    return this.update(discordId, guildId, { risk_score: score });
  },

  async getTopRiskUsers(guildId, limit = 10) {
    const rows = await dbAll(
      `
      SELECT * FROM users
      WHERE guild_id = ?
      ORDER BY risk_score DESC
      LIMIT ?
      `,
      [guildId, limit]
    );
    return rows.map((r) => new User(r));
  },

  async addNote(discordId, guildId, note) {
    // Append simple avec retour à la ligne
    await dbRun(
      `
      UPDATE users
      SET notes =
        CASE
          WHEN notes IS NULL OR notes = '' THEN ?
          ELSE notes || '\n' || ?
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE discord_id = ? AND guild_id = ?
      `,
      [String(note ?? ''), String(note ?? ''), discordId, guildId]
    );

    return this.findByDiscordId(discordId, guildId);
  },

  async getByGuild(guildId) {
    const rows = await dbAll(
      `
      SELECT * FROM users
      WHERE guild_id = ?
      ORDER BY risk_score DESC, total_warnings DESC, total_sanctions DESC
      `,
      [guildId]
    );
    return rows.map((r) => new User(r));
  },
};

module.exports = userRepo;

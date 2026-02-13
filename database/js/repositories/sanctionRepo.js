// Repo Sanction - opérations CRUD

const { dbGet, dbRun, dbAll } = require('../index');
const Sanction = require('../models/Sanction');

function toSQLiteDateValue(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

const sanctionRepo = {
  async create(sanction) {
    const s = sanction instanceof Sanction ? sanction : new Sanction(sanction);
    const data = s.toDatabase();

    const providedExpiresAt = toSQLiteDateValue(data.expires_at);
    const duration = data.duration ?? null; // secondes

    // Si expires_at n'est pas fourni mais duration oui, calcul auto côté SQLite.
    const res = await dbRun(
      `
      INSERT INTO sanctions
        (guild_id, user_id, moderator_id, type, reason, duration, expires_at, active, created_at)
      VALUES
        (?, ?, ?, ?, ?, ?,
          COALESCE(
            ?,
            CASE
              WHEN ? IS NOT NULL THEN datetime(CURRENT_TIMESTAMP, '+' || ? || ' seconds')
              ELSE NULL
            END
          ),
          ?,
          CURRENT_TIMESTAMP
        )
      `,
      [
        data.guild_id,
        data.user_id,
        data.moderator_id,
        data.type,
        data.reason,
        duration,
        providedExpiresAt,
        duration,
        duration,
        data.active ? 1 : 0,
      ]
    );

    return this.findById(res.lastID);
  },

  async findById(id) {
    const row = await dbGet('SELECT * FROM sanctions WHERE id = ?', [id]);
    return row ? new Sanction(row) : null;
  },

  async findByUser(userId, guildId) {
    const rows = await dbAll(
      `
      SELECT * FROM sanctions
      WHERE user_id = ? AND guild_id = ?
      ORDER BY datetime(created_at) DESC
      `,
      [userId, guildId]
    );
    return rows.map((r) => new Sanction(r));
  },

  async findActiveByUser(userId, guildId) {
    const rows = await dbAll(
      `
      SELECT * FROM sanctions
      WHERE user_id = ? AND guild_id = ?
        AND active = 1
        AND (expires_at IS NULL OR datetime(expires_at) > CURRENT_TIMESTAMP)
      ORDER BY datetime(created_at) DESC
      `,
      [userId, guildId]
    );
    return rows.map((r) => new Sanction(r));
  },

  async findActiveByType(guildId, type) {
    const rows = await dbAll(
      `
      SELECT * FROM sanctions
      WHERE guild_id = ?
        AND type = ?
        AND active = 1
        AND (expires_at IS NULL OR datetime(expires_at) > CURRENT_TIMESTAMP)
      ORDER BY datetime(created_at) DESC
      `,
      [guildId, type]
    );
    return rows.map((r) => new Sanction(r));
  },

  async findExpired() {
    const rows = await dbAll(
      `
      SELECT * FROM sanctions
      WHERE active = 1
        AND expires_at IS NOT NULL
        AND datetime(expires_at) <= CURRENT_TIMESTAMP
      ORDER BY datetime(expires_at) ASC
      `
    );
    return rows.map((r) => new Sanction(r));
  },

  async deactivate(id) {
    await dbRun('UPDATE sanctions SET active = 0 WHERE id = ?', [id]);
    return this.findById(id);
  },

  async deactivateByUserAndType(userId, guildId, type) {
    const res = await dbRun(
      `
      UPDATE sanctions
      SET active = 0
      WHERE user_id = ? AND guild_id = ? AND type = ? AND active = 1
      `,
      [userId, guildId, type]
    );
    return res.changes;
  },

  async getRecent(guildId, limit = 50) {
    const rows = await dbAll(
      `
      SELECT * FROM sanctions
      WHERE guild_id = ?
      ORDER BY datetime(created_at) DESC
      LIMIT ?
      `,
      [guildId, limit]
    );
    return rows.map((r) => new Sanction(r));
  },

  async getStats(guildId) {
    return dbAll(
      `
      SELECT
        type,
        COUNT(*) AS total,
        SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) AS active
      FROM sanctions
      WHERE guild_id = ?
      GROUP BY type
      `,
      [guildId]
    );
  },

  /**
   * Révoque tous les mutes actifs pour un utilisateur dans une guild
   * et enregistre une sanction "unmute" pour l'historique.
   */
  async revokeActiveMute(guildId, userId, moderatorId, reason) {
    const revokedCount = await this.deactivateByUserAndType(userId, guildId, 'mute');

    const unmuteSanction = await this.create({
      guildId,
      userId,
      moderatorId,
      type: 'unmute',
      reason: reason || 'Unmute sans raison spécifiée',
      duration: null,
    });

    return { revokedCount, unmuteSanction };
  },
};

module.exports = sanctionRepo;

// Repo AutomodLog - opérations CRUD pour les logs d'AutoMod

const db = require('../index');

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

const automodLogRepo = {
  /**
   * Crée un nouveau log d'AutoMod
   */
  async create(data) {
    const res = await dbRun(
      `
      INSERT INTO automod_logs
        (guild_id, user_id, trigger_type, message_content, action_taken, created_at)
      VALUES
        (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `,
      [
        data.guildId,
        data.userId,
        data.triggerType,
        data.messageContent,
        data.actionTaken
      ]
    );

    return this.findById(res.lastID);
  },

  /**
   * Récupère un log par son ID
   */
  async findById(id) {
    const row = await dbGet('SELECT * FROM automod_logs WHERE id = ?', [id]);
    return row;
  },

  /**
   * Récupère tous les logs pour une guild
   */
  async findByGuild(guildId, limit = 100) {
    const rows = await dbAll(
      `
      SELECT * FROM automod_logs
      WHERE guild_id = ?
      ORDER BY datetime(created_at) DESC
      LIMIT ?
      `,
      [guildId, limit]
    );
    return rows;
  },

  /**
   * Récupère tous les logs pour un utilisateur dans une guild
   */
  async findByUser(guildId, userId, limit = 50) {
    const rows = await dbAll(
      `
      SELECT * FROM automod_logs
      WHERE guild_id = ? AND user_id = ?
      ORDER BY datetime(created_at) DESC
      LIMIT ?
      `,
      [guildId, userId, limit]
    );
    return rows;
  },

  /**
   * Récupère les logs par type de trigger
   */
  async findByTriggerType(guildId, triggerType, limit = 50) {
    const rows = await dbAll(
      `
      SELECT * FROM automod_logs
      WHERE guild_id = ? AND trigger_type = ?
      ORDER BY datetime(created_at) DESC
      LIMIT ?
      `,
      [guildId, triggerType, limit]
    );
    return rows;
  },

  /**
   * Récupère les statistiques d'AutoMod pour une guild
   */
  async getStats(guildId, timeRange = '24h') {
    let timeCondition = '';
    
    switch (timeRange) {
      case '1h':
        timeCondition = "AND datetime(created_at) >= datetime('now', '-1 hour')";
        break;
      case '24h':
        timeCondition = "AND datetime(created_at) >= datetime('now', '-1 day')";
        break;
      case '7d':
        timeCondition = "AND datetime(created_at) >= datetime('now', '-7 days')";
        break;
      case '30d':
        timeCondition = "AND datetime(created_at) >= datetime('now', '-30 days')";
        break;
      default:
        timeCondition = '';
    }

    const rows = await dbAll(
      `
      SELECT
        trigger_type,
        action_taken,
        COUNT(*) as count,
        COUNT(DISTINCT user_id) as unique_users
      FROM automod_logs
      WHERE guild_id = ? ${timeCondition}
      GROUP BY trigger_type, action_taken
      ORDER BY count DESC
      `,
      [guildId]
    );

    return rows;
  },

  /**
   * Récupère les utilisateurs les plus sanctionnés par AutoMod
   */
  async getTopUsers(guildId, limit = 10, timeRange = '24h') {
    let timeCondition = '';
    
    switch (timeRange) {
      case '1h':
        timeCondition = "AND datetime(created_at) >= datetime('now', '-1 hour')";
        break;
      case '24h':
        timeCondition = "AND datetime(created_at) >= datetime('now', '-1 day')";
        break;
      case '7d':
        timeCondition = "AND datetime(created_at) >= datetime('now', '-7 days')";
        break;
      case '30d':
        timeCondition = "AND datetime(created_at) >= datetime('now', '-30 days')";
        break;
    }

    const rows = await dbAll(
      `
      SELECT
        user_id,
        COUNT(*) as total_actions,
        COUNT(DISTINCT trigger_type) as trigger_types
      FROM automod_logs
      WHERE guild_id = ? ${timeCondition}
      GROUP BY user_id
      ORDER BY total_actions DESC
      LIMIT ?
      `,
      [guildId, limit]
    );

    return rows;
  },

  /**
   * Nettoie les anciens logs (pour éviter que la table ne devienne trop grosse)
   */
  async cleanup(olderThanDays = 30) {
    const res = await dbRun(
      `
      DELETE FROM automod_logs
      WHERE datetime(created_at) < datetime('now', '-${olderThanDays} days')
      `
    );
    return res.changes;
  },

  /**
   * Compte le nombre total de logs pour une guild
   */
  async countByGuild(guildId) {
    const row = await dbGet(
      'SELECT COUNT(*) as count FROM automod_logs WHERE guild_id = ?',
      [guildId]
    );
    return row ? Number(row.count) : 0;
  }
};

module.exports = automodLogRepo;

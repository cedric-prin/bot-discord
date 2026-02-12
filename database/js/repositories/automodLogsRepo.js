// Repository pour les logs AutoMod optimisés

const { dbRun, dbGet, dbAll } = require('../index');

const automodLogsRepo = {
  /**
   * Ajouter un log AutoMod
   */
  async addLog(data) {
    const {
      guild_id,
      user_id,
      moderator_id = null,
      channel_id = null,
      message_id = null,
      trigger_type,
      trigger_content = null,
      action_taken,
      severity = 1,
      confidence_score = null,
      details = null
    } = data;

    const result = await dbRun(`
      INSERT INTO automod_logs (
        guild_id, user_id, moderator_id, channel_id, message_id,
        trigger_type, trigger_content, action_taken, severity, confidence_score, details
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      guild_id, user_id, moderator_id, channel_id, message_id,
      trigger_type, trigger_content, action_taken, severity, confidence_score, details
    ]);

    return result.lastID;
  },

  /**
   * Récupérer les logs récents d'un serveur
   */
  async getGuildLogs(guildId, limit = 50, offset = 0) {
    return await dbAll(`
      SELECT 
        al.*,
        u.username as user_name,
        m.username as moderator_name
      FROM automod_logs al
      LEFT JOIN users u ON al.user_id = u.discord_id AND al.guild_id = u.guild_id
      LEFT JOIN users m ON al.moderator_id = m.discord_id AND al.guild_id = m.guild_id
      WHERE al.guild_id = ?
      ORDER BY al.created_at DESC
      LIMIT ? OFFSET ?
    `, [guildId, limit, offset]);
  },

  /**
   * Récupérer les logs d'un utilisateur
   */
  async getUserLogs(guildId, userId, limit = 20) {
    return await dbAll(`
      SELECT * FROM automod_logs
      WHERE guild_id = ? AND user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `, [guildId, userId, limit]);
  },

  /**
   * Récupérer les logs par type de trigger
   */
  async getLogsByType(guildId, triggerType, limit = 50) {
    return await dbAll(`
      SELECT 
        al.*,
        u.username as user_name
      FROM automod_logs al
      LEFT JOIN users u ON al.user_id = u.discord_id AND al.guild_id = u.guild_id
      WHERE al.guild_id = ? AND al.trigger_type = ?
      ORDER BY al.created_at DESC
      LIMIT ?
    `, [guildId, triggerType, limit]);
  },

  /**
   * Récupérer les statistiques AutoMod
   */
  async getStats(guildId, timeRange = '24h') {
    let timeCondition = '';
    const params = [guildId];

    switch (timeRange) {
      case '1h':
        timeCondition = 'AND created_at >= datetime("now", "-1 hour")';
        break;
      case '24h':
        timeCondition = 'AND created_at >= datetime("now", "-1 day")';
        break;
      case '7d':
        timeCondition = 'AND created_at >= datetime("now", "-7 days")';
        break;
      case '30d':
        timeCondition = 'AND created_at >= datetime("now", "-30 days")';
        break;
    }

    const stats = await dbGet(`
      SELECT 
        COUNT(*) as total_actions,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(CASE WHEN trigger_type = 'bad_words' THEN 1 END) as badwords_count,
        COUNT(CASE WHEN trigger_type = 'spam' THEN 1 END) as spam_count,
        COUNT(CASE WHEN trigger_type = 'links' THEN 1 END) as links_count,
        COUNT(CASE WHEN trigger_type = 'invites' THEN 1 END) as invites_count,
        COUNT(CASE WHEN trigger_type = 'caps' THEN 1 END) as caps_count,
        COUNT(CASE WHEN trigger_type = 'mass_mentions' THEN 1 END) as mentions_count,
        AVG(confidence_score) as avg_confidence,
        MAX(created_at) as last_action
      FROM automod_logs
      WHERE guild_id = ? ${timeCondition}
    `, params);

    return stats || {
      total_actions: 0,
      unique_users: 0,
      badwords_count: 0,
      spam_count: 0,
      links_count: 0,
      invites_count: 0,
      caps_count: 0,
      mentions_count: 0,
      avg_confidence: 0,
      last_action: null
    };
  },

  /**
   * Compter les logs par type pour un serveur
   */
  async getCountsByType(guildId, timeRange = '24h') {
    let timeCondition = '';
    const params = [guildId];

    switch (timeRange) {
      case '1h':
        timeCondition = 'AND created_at >= datetime("now", "-1 hour")';
        break;
      case '24h':
        timeCondition = 'AND created_at >= datetime("now", "-1 day")';
        break;
      case '7d':
        timeCondition = 'AND created_at >= datetime("now", "-7 days")';
        break;
      case '30d':
        timeCondition = 'AND created_at >= datetime("now", "-30 days")';
        break;
    }

    return await dbAll(`
      SELECT 
        trigger_type,
        COUNT(*) as count,
        AVG(confidence_score) as avg_confidence
      FROM automod_logs
      WHERE guild_id = ? ${timeCondition}
      GROUP BY trigger_type
      ORDER BY count DESC
    `, params);
  },

  /**
   * Nettoyer les anciens logs
   */
  async cleanupOldLogs(daysToKeep = 30) {
    const result = await dbRun(`
      DELETE FROM automod_logs
      WHERE created_at < datetime("now", "-${daysToKeep} days")
    `);

    return result.changes;
  },

  /**
   * Compter tous les logs
   */
  async getTotalCount(guildId = null) {
    const sql = guildId
      ? 'SELECT COUNT(*) as count FROM automod_logs WHERE guild_id = ?'
      : 'SELECT COUNT(*) as count FROM automod_logs';

    const params = guildId ? [guildId] : [];
    const result = await dbGet(sql, params);
    return result?.count || 0;
  },

  /**
   * Compter les logs par serveur (alias pour compatibilité)
   */
  async countByGuild(guildId) {
    return await this.getTotalCount(guildId);
  },

  /**
   * Récupérer les statistiques (alias pour compatibilité)
   */
  async getStats(guildId, timeRange = '24h') {
    return await this.getCountsByType(guildId, timeRange);
  },

  /**
   * Récupérer les top utilisateurs
   */
  async getTopUsers(guildId, limit = 10, timeRange = '24h') {
    let timeCondition = '';
    const params = [guildId];

    switch (timeRange) {
      case '1h':
        timeCondition = 'AND created_at >= datetime("now", "-1 hour")';
        break;
      case '24h':
        timeCondition = 'AND created_at >= datetime("now", "-1 day")';
        break;
      case '7d':
        timeCondition = 'AND created_at >= datetime("now", "-7 days")';
        break;
      case '30d':
        timeCondition = 'AND created_at >= datetime("now", "-30 days")';
        break;
    }

    return await dbAll(`
      SELECT 
        user_id,
        COUNT(*) as count,
        COUNT(CASE WHEN trigger_type = 'bad_words' THEN 1 END) as badwords_count
      FROM automod_logs
      WHERE guild_id = ? ${timeCondition}
      GROUP BY user_id
      ORDER BY count DESC
      LIMIT ?
    `, [...params, limit]);
  }
};

module.exports = automodLogsRepo;

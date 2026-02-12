// Repository pour la configuration AutoMod

const db = require('../index');

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
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

const automodRepo = {
  /**
   * Récupérer la configuration AutoMod d'un serveur
   */
  async getGuildAutomod(guildId) {
    const row = await dbGet('SELECT * FROM automod WHERE guild_id = ?', [guildId]);

    if (!row) {
      // Retourner la configuration par défaut
      return {
        guild_id: guildId,
        enabled: false,
        exempt_roles: [],
        exempt_channels: [],
        spam_enabled: true,
        spam_max_messages: 5,
        spam_time_window: 5000,
        spam_max_duplicates: 3,
        spam_action: 'delete',
        invites_enabled: true,
        invites_allow_own_server: true,
        invites_action: 'delete',
        badwords_enabled: false,
        badwords_detect_leet: true,
        badwords_whole_word_only: false,
        badwords_action: 'delete',
        badwords_count: 0,
        links_enabled: false,
        links_block_all: false,
        links_action: 'delete',
        caps_enabled: true,
        caps_max_percentage: 70,
        caps_min_length: 10,
        caps_action: 'delete',
        mentions_enabled: true,
        mentions_max_user_mentions: 5,
        mentions_max_role_mentions: 3,
        mentions_block_everyone: false,
        mentions_action: 'delete',
        antiraid_enabled: true,
        antiraid_join_threshold: 10,
        antiraid_join_window: 10000,
        antiraid_account_age: 7,
        antiraid_action: 'lockdown'
      };
    }

    // Parser les champs JSON
    return {
      ...row,
      exempt_roles: JSON.parse(row.exempt_roles || '[]'),
      exempt_channels: JSON.parse(row.exempt_channels || '[]')
    };
  },

  /**
   * Mettre à jour la configuration AutoMod
   */
  async updateGuildAutomod(guildId, config) {
    const fields = [
      'enabled', 'exempt_roles', 'exempt_channels',
      'spam_enabled', 'spam_max_messages', 'spam_time_window', 'spam_max_duplicates', 'spam_action',
      'invites_enabled', 'invites_allow_own_server', 'invites_action',
      'badwords_enabled', 'badwords_detect_leet', 'badwords_whole_word_only', 'badwords_action',
      'links_enabled', 'links_block_all', 'links_action',
      'caps_enabled', 'caps_max_percentage', 'caps_min_length', 'caps_action',
      'mentions_enabled', 'mentions_max_user_mentions', 'mentions_max_role_mentions', 'mentions_block_everyone', 'mentions_action',
      'antiraid_enabled', 'antiraid_join_threshold', 'antiraid_join_window', 'antiraid_account_age', 'antiraid_action'
    ];

    const updates = [];
    const values = [];

    fields.forEach(field => {
      if (config[field] !== undefined) {
        updates.push(`${field} = ?`);

        // Convertir les arrays en JSON
        if (field === 'exempt_roles' || field === 'exempt_channels') {
          values.push(JSON.stringify(config[field]));
        } else {
          values.push(config[field]);
        }
      }
    });

    if (updates.length === 0) return;

    // Upsert (INSERT OR REPLACE)
    const sql = `
      INSERT OR REPLACE INTO automod (
        guild_id, ${updates.join(', ')}, updated_at
      ) VALUES (
        ?, ${updates.map(() => '?').join(', ')}, CURRENT_TIMESTAMP
      )
    `;

    await dbRun(sql, [guildId, ...values]);
  },

  /**
   * Activer/désactiver l'AutoMod
   */
  async toggleAutomod(guildId, enabled) {
    await this.updateGuildAutomod(guildId, { enabled });
  },

  /**
   * Mettre à jour un filtre spécifique
   */
  async updateFilter(guildId, filterName, settings) {
    const config = await this.getGuildAutomod(guildId);

    // Mettre à jour les settings du filtre
    Object.assign(config, settings);

    await this.updateGuildAutomod(guildId, config);
    return config;
  },

  /**
   * Mettre à jour le nombre de mots bannis
   */
  async updateBadwordsCount(guildId) {
    const count = await dbGet(
      'SELECT COUNT(*) as count FROM automod_words WHERE guild_id = ? AND type = "badword"',
      [guildId]
    );

    await dbRun(
      'UPDATE automod SET badwords_count = ?, updated_at = CURRENT_TIMESTAMP WHERE guild_id = ?',
      [count?.count || 0, guildId]
    );
  },

  /**
   * Ajouter une exemption
   */
  async addExemption(guildId, type, id) {
    const config = await this.getGuildAutomod(guildId);

    if (type === 'role' && !config.exempt_roles.includes(id)) {
      config.exempt_roles.push(id);
    } else if (type === 'channel' && !config.exempt_channels.includes(id)) {
      config.exempt_channels.push(id);
    }

    await this.updateGuildAutomod(guildId, config);
    return config;
  },

  /**
   * Retirer une exemption
   */
  async removeExemption(guildId, type, id) {
    const config = await this.getGuildAutomod(guildId);

    if (type === 'role') {
      config.exempt_roles = config.exempt_roles.filter(rid => rid !== id);
    } else if (type === 'channel') {
      config.exempt_channels = config.exempt_channels.filter(cid => cid !== id);
    }

    await this.updateGuildAutomod(guildId, config);
    return config;
  }
};

module.exports = automodRepo;

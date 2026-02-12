// Repository pour les mots interdits AutoMod

const { dbGet, dbRun, dbAll } = require('../index');

const badwordsRepo = {
  /**
   * Récupérer tous les mots interdits pour un serveur
   */
  async getGuildBadwords(guildId) {
    const rows = await dbAll(
      'SELECT word FROM automod_words WHERE guild_id = ? AND type = "badword"',
      [guildId]
    );
    return rows.map(row => row.word);
  },

  /**
   * Ajouter un mot interdit
   */
  async addBadword(guildId, word, addedBy) {
    try {
      // D'abord vérifier si le mot existe déjà
      const exists = await this.wordExists(guildId, word);

      if (exists) {
        return { success: false, exists: true };
      }

      // Si le mot n'existe pas, l'ajouter
      await dbRun(
        'INSERT INTO automod_words (guild_id, word, type, added_by) VALUES (?, ?, "badword", ?)',
        [guildId, word.toLowerCase().trim(), addedBy]
      );

      return { success: true, exists: false };
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT') {
        // Le mot existe déjà (erreur de contrainte UNIQUE)
        return { success: false, exists: true };
      }
      throw error;
    }
  },

  /**
   * Retirer un mot interdit
   */
  async removeBadword(guildId, word) {
    const result = await dbRun(
      'DELETE FROM automod_words WHERE guild_id = ? AND word = ? AND type = "badword"',
      [guildId, word.toLowerCase().trim()]
    );
    return result.changes > 0;
  },

  /**
   * Vérifier si un mot existe
   */
  async wordExists(guildId, word) {
    const row = await dbGet(
      'SELECT 1 FROM automod_words WHERE guild_id = ? AND LOWER(word) = LOWER(?) AND type = "badword"',
      [guildId, word.trim()]
    );
    return !!row;
  },

  /**
   * Compter le nombre de mots pour un serveur
   */
  async getBadwordsCount(guildId) {
    const row = await dbGet(
      'SELECT COUNT(*) as count FROM automod_words WHERE guild_id = ? AND type = "badword"',
      [guildId]
    );
    return row?.count || 0;
  },

  /**
   * Récupérer tous les mots avec pagination (pour admin)
   */
  async getAllBadwords(guildId, limit = 50, offset = 0) {
    return await dbAll(
      'SELECT word, added_by, created_at FROM automod_words WHERE guild_id = ? AND type = "badword" ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [guildId, limit, offset]
    );
  }
};

module.exports = badwordsRepo;

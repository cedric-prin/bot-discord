const { Collection } = require('discord.js');
const guildRepo = require('../../../database/js/repositories/guildRepo');
const modLogger = require('../modLogger');
const logger = require('../../utils/logger');

// Import des filtres
const spamFilter = require('./filters/spamFilter');
const inviteFilter = require('./filters/inviteFilter');
const capsFilter = require('./filters/capsFilter');
const linksFilter = require('./filters/linksFilter');
const badwordsFilter = require('./filters/badwordsFilter');
const mentionsFilter = require('./filters/mentionsFilter');

class AutoModManager {
  constructor() {
    // Cache des configurations (guildId -> config)
    this.configCache = new Collection();
    this.cacheTTL = 60 * 1000; // 1 minute

    // Filtres dans l'ordre de priorité
    this.filters = [
      { name: 'badwords', handler: badwordsFilter, priority: 1 },
      { name: 'invites', handler: inviteFilter, priority: 2 },
      { name: 'links', handler: linksFilter, priority: 3 },
      { name: 'caps', handler: capsFilter, priority: 4 },
      { name: 'mentions', handler: mentionsFilter, priority: 5 },
      { name: 'spam', handler: spamFilter, priority: 6 }
    ];

    // Statistiques
    this.stats = new Collection();
  }

  /**
   * Point d'entrée principal - Analyse un message
   */
  async processMessage(message) {
    // Ignorer les bots et webhooks
    if (message.author.bot || message.webhookId) return null;

    // Ignorer les DMs
    if (!message.guild) return null;

    logger.debug(`[AutoModManager] Traitement du message: ${message.content}`);

    try {
      // Récupérer la config
      const config = await this.getConfig(message.guild.id);

      logger.debug(`[AutoModManager] Config récupérée: enabled=${config?.enabled}, badwords_enabled=${config?.badwords_enabled}`);

      // AutoMod désactivé ?
      if (!config || !config.enabled) {
        logger.debug(`[AutoModManager] AutoMod désactivé`);
        return null;
      }

      // Vérifier les exemptions
      if (await this.isExempt(message, config)) {
        logger.debug(`[AutoModManager] Message exempté`);
        return null;
      }

      // Exécuter les filtres
      for (const filter of this.filters) {
        // Filtre activé ? (mapper le nom du filtre vers le champ de config)
        const configField = `${filter.name}_enabled`;
        if (!config[configField]) {
          logger.debug(`[AutoModManager] Filtre ${filter.name} désactivé (${configField}=${config[configField]})`);
          continue;
        }

        logger.debug(`[AutoModManager] Test du filtre ${filter.name}`);

        // Préparer la configuration spécifique pour le filtre
        const filterConfig = {
          useDefault: true,
          detectLeet: config[`${filter.name}_detect_leet`] !== false,
          wholeWordOnly: config[`${filter.name}_whole_word_only`] === true,
          action: config[`${filter.name}_action`] || 'delete',
          customRegex: []
        };

        const result = await filter.handler.check(message, filterConfig);

        if (result.triggered) {
          logger.info(`[AutoModManager] Filtre ${filter.name} déclenché: ${result.reason} (action: ${result.action})`);
          // Exécuter l'action
          await this.executeAction(message, result, filter.name, config);

          // Incrémenter stats
          this.incrementStats(message.guild.id, filter.name);

          // Si action = delete, arrêter (message supprimé)
          if (result.action === 'delete' || result.action === 'warn' || result.action === 'mute') {
            return result;
          }
        }
      }

      logger.debug(`[AutoModManager] Aucun filtre déclenché`);
      return null;

    } catch (error) {
      logger.error(`AutoMod error for guild ${message.guild.id}:`, error);
      return null;
    }
  }

  /**
   * Récupérer la configuration AutoMod d'un serveur
   */
  async getConfig(guildId) {
    // Forcer le rechargement depuis la base de données
    this.configCache.delete(guildId);

    const automodRepo = require('../../../database/js/repositories/automodRepo');
    const config = await automodRepo.getGuildAutomod(guildId);

    if (!config) {
      return null;
    }

    this.configCache.set(guildId, {
      config,
      timestamp: Date.now()
    });

    return config;
  }

  /**
   * Vérifier si le message/user est exempté
   */
  async isExempt(message, config) {
    const { member, channel } = message;

    // Admins toujours exemptés (temporairement désactivé pour test)
    // if (member.permissions.has('Administrator')) return true;

    // Rôles exemptés
    if (config.exemptRoles?.length > 0) {
      const hasExemptRole = member.roles.cache.some(
        role => config.exemptRoles.includes(role.id)
      );
      if (hasExemptRole) return true;
    }

    // Channels exemptés
    if (config.exemptChannels?.length > 0) {
      if (config.exemptChannels.includes(channel.id)) return true;
    }

    return false;
  }

  /**
   * Exécuter l'action appropriée
   */
  async executeAction(message, result, filterName, config) {
    const { action, reason, matchedContent } = result;
    const { guild, author, channel, member } = message;

    try {
      // Supprimer le message
      if (['delete', 'warn', 'mute', 'kick', 'ban'].includes(action)) {
        await message.delete().catch(() => { });
      }

      // Actions supplémentaires
      switch (action) {
        case 'warn':
          // Envoyer avertissement en MP
          const warnEmbed = require('../embedBuilder').warning(
            '⚠️ Avertissement AutoMod',
            `Votre message a été supprimé sur **${guild.name}**`
          ).addFields(
            { name: '📝 Raison', value: reason },
            { name: '🔍 Règle', value: filterName }
          );

          await author.send({ embeds: [warnEmbed] }).catch(() => { });
          break;

        case 'mute':
          // Mute temporaire
          const muteDuration = config[filterName]?.muteDuration || 5 * 60 * 1000; // 5 min default

          await member.timeout(muteDuration, `AutoMod: ${reason}`).catch(err => {
            logger.error(`AutoMod mute failed:`, err);
          });

          // MP
          const muteEmbed = require('../embedBuilder').error(
            '🔇 Mute AutoMod',
            `Vous avez été mute sur **${guild.name}**`
          ).addFields(
            { name: '📝 Raison', value: reason },
            { name: '⏱️ Durée', value: `${Math.floor(muteDuration / 60000)} minutes` }
          );

          await author.send({ embeds: [muteEmbed] }).catch(() => { });
          break;
      }

      // Log AutoMod (sans erreur si le logging échoue)
      try {
        // Mapper les noms de filtres vers les valeurs attendues par la contrainte SQL
        const triggerTypeMap = {
          'badwords': 'bad_words',
          'spam': 'spam',
          'invites': 'invites',
          'links': 'links',
          'caps': 'caps',
          'mentions': 'mass_mentions',
          'antiraid': 'blacklist'
        };

        const mappedTrigger = triggerTypeMap[filterName] || filterName;

        await modLogger.logAutoMod(guild, {
          trigger: mappedTrigger,
          user: author,
          channel: channel,
          action: action,
          matchedContent: matchedContent,
          rule: reason
        });
      } catch (logError) {
        logger.error('Erreur logAutoMod:', logError);
      }

    } catch (error) {
      logger.error(`AutoMod action error:`, error);
    }
  }

  /**
   * Incrémenter les statistiques
   */
  incrementStats(guildId, filterName) {
    if (!this.stats.has(guildId)) {
      this.stats.set(guildId, {});
    }

    const guildStats = this.stats.get(guildId);
    guildStats[filterName] = (guildStats[filterName] || 0) + 1;
    guildStats.total = (guildStats.total || 0) + 1;
  }

  /**
   * Obtenir les stats d'un guild
   */
  getStats(guildId) {
    return this.stats.get(guildId) || { total: 0 };
  }

  /**
   * Vider le cache pour un serveur
   */
  clearCache(guildId) {
    this.configCache.delete(guildId);
    logger.info(`[AutoModManager] Cache vidé pour ${guildId}`);
    // Vider aussi le cache des badwords
    const badwordsFilter = this.filters.find(f => f.name === 'badwords')?.handler;
    if (badwordsFilter && badwordsFilter.clearCache) {
      badwordsFilter.clearCache(guildId);
    }
  }

  /**
   * Réinitialiser tout le cache
   */
  clearAllCache() {
    this.configCache.clear();
  }
}

module.exports = new AutoModManager();

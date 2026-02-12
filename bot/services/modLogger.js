// Service centralisé pour les logs de modération

const { Collection } = require('discord.js');
const embed = require('./embedBuilder');
const guildRepo = require('../../database/js/repositories/guildRepo');
const automodLogsRepo = require('../../database/js/repositories/automodLogsRepo');
const logger = require('../utils/logger');

class ModLogger {
  constructor() {
    // File d'attente par guild/channel pour éviter les rate limits
    // key: `${guildId}-${channelId}` -> Array<EmbedBuilder>
    this.queues = new Collection();
    this.processing = new Collection();

    // Cache des channels de log
    // key: `${guildId}-${logType}` -> { channel, timestamp }
    this.channelCache = new Collection();
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes

    this.client = null;
  }

  /**
   * Log une action de modération
   */
  async logAction(guild, { action, moderator, target, reason, duration, caseId, extra }) {
    try {
      const logEmbed = embed.modLog({
        action,
        moderator,
        target,
        reason: reason || 'Aucune raison fournie',
        duration,
        caseId,
      });

      // Ajouter des champs supplémentaires si fournis
      if (extra && Array.isArray(extra) && extra.length > 0) {
        logEmbed.addFields(extra);
      }

      await this.send(guild, logEmbed, 'moderation');
    } catch (error) {
      logger.error(`Erreur logAction pour ${guild?.name || guild?.id}:`, error);
    }
  }

  /**
   * Log une action AutoMod
   */
  async logAutoMod(guild, data) {
    try {
      const logData = {
        guild_id: guild.id,
        user_id: data.user?.id,
        moderator_id: data.moderator?.id,
        channel_id: data.channel?.id,
        message_id: data.message?.id,
        trigger_type: data.trigger,
        trigger_content: data.matchedContent,
        action_taken: data.action,
        severity: data.severity || 1,
        confidence_score: data.confidence,
        details: data.rule
      };

      await automodLogsRepo.addLog(logData);
    } catch (error) {
      logger.error(`Erreur logAutoMod pour ${guild?.name || guild?.id}:`, error);
    }
  }

  /**
   * Log un événement système
   */
  async logSystem(guild, { title, description, type = 'info' }) {
    try {
      let systemEmbed;
      switch (type) {
        case 'error':
          systemEmbed = embed.error(title, description);
          break;
        case 'warning':
          systemEmbed = embed.warning(title, description);
          break;
        case 'success':
          systemEmbed = embed.success(title, description);
          break;
        default:
          systemEmbed = embed.info(title, description);
      }

      await this.send(guild, systemEmbed, 'system');
    } catch (error) {
      logger.error(`Erreur logSystem pour ${guild?.name || guild?.id}:`, error);
    }
  }

  /**
   * Log membre rejoint (pour anti-raid)
   */
  async logMemberJoin(guild, member, suspicious = false) {
    try {
      const accountAge = Date.now() - member.user.createdTimestamp;
      const accountAgeDays = Math.floor(accountAge / (1000 * 60 * 60 * 24));

      const title = suspicious ? '⚠️ Membre suspect' : '👋 Nouveau membre';
      const description = `${member.user.tag} a rejoint le serveur`;

      const joinEmbed = suspicious
        ? embed.warning(title, description)
        : embed.info(title, description);

      joinEmbed.addFields(
        { name: '👤 Utilisateur', value: `${member.user.tag}`, inline: true },
        { name: '🆔 ID', value: member.id, inline: true },
        {
          name: '📅 Compte créé',
          value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
          inline: true,
        },
        { name: '📊 Âge du compte', value: `${accountAgeDays} jours`, inline: true }
      );

      if (suspicious) {
        joinEmbed.addFields({
          name: '⚠️ Raison suspicion',
          value: accountAgeDays < 7 ? 'Compte récent (< 7 jours)' : 'Pattern suspect détecté',
        });
      }

      joinEmbed.setThumbnail(member.user.displayAvatarURL({ dynamic: true }));

      await this.send(guild, joinEmbed, 'joins');
    } catch (error) {
      logger.error(`Erreur logMemberJoin pour ${guild?.name || guild?.id}:`, error);
    }
  }

  /**
   * Envoi vers le channel de log approprié
   */
  async send(guild, embedToSend, logType = 'moderation') {
    try {
      const channel = await this.getLogChannel(guild, logType);

      if (!channel) {
        logger.debug?.(
          `Pas de channel de log ${logType} configuré pour ${guild?.name || guild?.id}`
        );
        return false;
      }

      // Ajouter à la file d'attente
      this.addToQueue(guild.id, channel.id, embedToSend);

      // Traiter la file
      await this.processQueue(guild.id);

      return true;
    } catch (error) {
      logger.error(`Erreur envoi log ${logType} pour ${guild?.name || guild?.id}:`, error);
      return false;
    }
  }

  /**
   * Récupère le channel de log (avec cache)
   */
  async getLogChannel(guild, logType) {
    const cacheKey = `${guild.id}-${logType}`;
    const cached = this.channelCache.get(cacheKey);

    // Vérifier cache
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.channel;
    }

    // Récupérer depuis BDD
    const settings = await guildRepo.getSettings(guild.id);
    if (!settings) return null;

    // Déterminer quel channel utiliser selon le type
    let channelId;
    switch (logType) {
      case 'moderation':
        channelId = settings.logChannelId;
        break;
      case 'automod':
        // Champs optionnels, fallback sur logChannelId
        channelId = settings.automodLogChannelId || settings.logChannelId;
        break;
      case 'joins':
        channelId = settings.joinLogChannelId || settings.logChannelId;
        break;
      case 'system':
        channelId = settings.logChannelId;
        break;
      default:
        channelId = settings.logChannelId;
    }

    if (!channelId) return null;

    const channel = guild.channels.cache.get(channelId);

    // Mettre en cache (même si null pour éviter requêtes répétées)
    this.channelCache.set(cacheKey, {
      channel,
      timestamp: Date.now(),
    });

    return channel;
  }

  /**
   * Ajoute un message à la file d'attente
   */
  addToQueue(guildId, channelId, embedToSend) {
    const key = `${guildId}-${channelId}`;
    if (!this.queues.has(key)) {
      this.queues.set(key, []);
    }

    this.queues.get(key).push(embedToSend);
  }

  /**
   * Traite la/les files d'attente pour une guild
   */
  async processQueue(guildId) {
    // Trouver toutes les files pour ce guild
    const keys = [...this.queues.keys()].filter((k) => k.startsWith(`${guildId}-`));

    for (const key of keys) {
      // Éviter traitement concurrent
      if (this.processing.get(key)) continue;
      this.processing.set(key, true);

      try {
        const queue = this.queues.get(key);
        if (!queue || queue.length === 0) continue;

        const [, channelId] = key.split('-');
        const guild = this.client?.guilds.cache.get(guildId);
        if (!guild) continue;

        const channel = guild.channels.cache.get(channelId);
        if (!channel) continue;

        // Envoyer par batch de 10 max
        while (queue.length > 0) {
          const batch = queue.splice(0, 10);

          for (const embedItem of batch) {
            await channel.send({ embeds: [embedItem] });

            // Petit délai pour éviter rate limit
            await this.sleep(100);
          }
        }
      } catch (error) {
        logger.error(`Erreur traitement queue ${key}:`, error);
      } finally {
        this.processing.set(key, false);
      }
    }
  }

  /**
   * Helper sleep
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Initialiser avec le client Discord
   */
  init(client) {
    this.client = client;
    logger.info('ModLogger initialisé');
  }

  /**
   * Vider le cache des channels
   */
  clearCache() {
    this.channelCache.clear();
  }
}

module.exports = new ModLogger();


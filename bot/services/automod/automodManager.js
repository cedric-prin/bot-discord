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
      { name: 'spam', handler: spamFilter, priority: 1 },
      { name: 'invites', handler: inviteFilter, priority: 2 },
      { name: 'badwords', handler: badwordsFilter, priority: 3 },
      { name: 'links', handler: linksFilter, priority: 4 },
      { name: 'caps', handler: capsFilter, priority: 5 },
      { name: 'mentions', handler: mentionsFilter, priority: 6 }
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
    
    try {
      // Récupérer la config
      const config = await this.getConfig(message.guild.id);
      
      // AutoMod désactivé ?
      if (!config || !config.enabled) return null;
      
      // Vérifier les exemptions
      if (await this.isExempt(message, config)) return null;
      
      // Exécuter les filtres
      for (const filter of this.filters) {
        // Filtre activé ?
        if (!config[filter.name]?.enabled) continue;
        
        const result = await filter.handler.check(message, config[filter.name]);
        
        if (result.triggered) {
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
      
      return null;
      
    } catch (error) {
      logger.error(`AutoMod error for guild ${message.guild.id}:`, error);
      return null;
    }
  }
  
  /**
   * Récupérer config avec cache
   */
  async getConfig(guildId) {
    const cached = this.configCache.get(guildId);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.config;
    }
    
    const settings = await guildRepo.getSettings(guildId);
    
    if (!settings?.automod) {
      return null;
    }
    
    const config = settings.automod;
    
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
    
    // Admins toujours exemptés
    if (member.permissions.has('Administrator')) return true;
    
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
      if (['delete', 'warn', 'mute'].includes(action)) {
        await message.delete().catch(() => {});
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
          
          await author.send({ embeds: [warnEmbed] }).catch(() => {});
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
          
          await author.send({ embeds: [muteEmbed] }).catch(() => {});
          break;
      }
      
      // Log AutoMod
      await modLogger.logAutoMod(guild, {
        trigger: filterName,
        user: author,
        channel: channel,
        action: action,
        matchedContent: matchedContent,
        rule: reason
      });
      
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
   * Réinitialiser le cache pour un guild
   */
  clearCache(guildId) {
    this.configCache.delete(guildId);
  }
  
  /**
   * Réinitialiser tout le cache
   */
  clearAllCache() {
    this.configCache.clear();
  }
}

module.exports = new AutoModManager();

/**
 * COMMANDE SLOWMODE - Définir le mode lent d'un channel
 * Permet de configurer l'intervalle entre messages dans un channel
 */

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const embed = require('../../services/embedBuilder');
const permissions = require('../../services/permissions');
const logger = require('../../utils/logger');

// Discord limite le slowmode à 6 heures
const MAX_SLOWMODE_SECONDS = 6 * 60 * 60;

module.exports = {
  // ========================================
  // DÉFINITION DE LA COMMANDE
  // ========================================
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Définir le mode lent d\'un channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false)
    .addStringOption(option => option
      .setName('durée')
      .setDescription('Intervalle entre messages (ex: 5s, 1m, 1h) - 0 ou off pour désactiver')
      .setRequired(true)
    )
    .addChannelOption(option => option
      .setName('channel')
      .setDescription('Channel cible (défaut: channel actuel)')
      .setRequired(false)
      .addChannelTypes(
        ChannelType.GuildText,
        ChannelType.GuildForum,
        ChannelType.GuildAnnouncement
      )
    ),

  // ========================================
  // MÉTADONNÉES
  // ========================================
  cooldown: 5, // Secondes
  category: 'moderation',

  // ========================================
  // EXÉCUTION
  // ========================================
  async execute(interaction) {
    // 1. RÉCUPÉRATION DES OPTIONS
    const durationInput = interaction.options.getString('durée').toLowerCase().trim();
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
    const { user: moderator, guild } = interaction;

    // 2. VÉRIFICATIONS PERMISSIONS
    const permCheck = await permissions.fullCheck(interaction, null, 'slowmode');
    if (!permCheck.allowed) {
      return interaction.reply({
        embeds: [embed.error('Permission refusée', permCheck.reason)],
        ephemeral: true
      });
    }

    // 3. VÉRIFICATION DU CHANNEL
    if (!targetChannel || !targetChannel.isTextBased()) {
      return interaction.reply({
        embeds: [embed.error('Erreur', 'Channel invalide ou non textuel.')],
        ephemeral: true
      });
    }

    // 4. PARSING DE LA DURÉE
    const parseResult = this.parseDuration(durationInput);
    if (!parseResult.success) {
      return interaction.reply({
        embeds: [embed.error('Format invalide', parseResult.error)],
        ephemeral: true
      });
    }

    const { seconds, formatted } = parseResult;

    // 5. EXÉCUTION DE L'ACTION
    try {
      await targetChannel.setRateLimitPerUser(seconds, `Slowmode défini par ${moderator.tag}`);
      
      // 6. RÉPONSE SUCCÈS
      const successEmbed = seconds > 0
        ? embed.success(
            '🐌 Slowmode activé',
            `Le mode lent de **${targetChannel.name}** a été défini à **${formatted}**.`
          )
        : embed.success(
            '✅ Slowmode désactivé',
            `Le mode lent de **${targetChannel.name}** a été désactivé.`
          );

      successEmbed.addFields(
        { name: '👮 Modérateur', value: moderator.tag, inline: true },
        { name: '📊 Channel', value: `#${targetChannel.name}`, inline: true },
        { name: '⏱️ Durée', value: formatted, inline: true }
      );

      await interaction.reply({ embeds: [successEmbed] });
      
      // 7. LOG DE MODÉRATION
      await this.logSlowmodeAction(guild, {
        moderator: moderator,
        channel: targetChannel,
        seconds: seconds,
        formatted: formatted,
        input: durationInput
      });
      
    } catch (error) {
      console.error('Erreur commande slowmode:', error);
      
      // 8. GESTION D'ERREUR
      const errorMessage = this.getSlowmodeErrorMessage(error);
      
      await interaction.reply({
        embeds: [embed.error('Erreur', errorMessage)],
        ephemeral: true
      });
    }
  },

  // ========================================
  // MÉTHODES UTILITAIRES
  // ========================================

  /**
   * Parse une durée en différentes formatations
   * @param {string} input 
   * @returns {Object}
   */
  parseDuration(input) {
    // Gérer les cas de désactivation
    if (input === '0' || input === 'off' || input === 'disable' || input === 'désactiver') {
      return {
        success: true,
        seconds: 0,
        formatted: 'Désactivé'
      };
    }

    // Patterns de temps
    const timePatterns = [
      { pattern: /^(\d+)s$/, multiplier: 1 },           // secondes: 30s
      { pattern: /^(\d+)sec$/, multiplier: 1 },         // secondes: 30sec
      { pattern: /^(\d+)secondes?$/, multiplier: 1 },   // secondes: 30seconde
      { pattern: /^(\d+)m$/, multiplier: 60 },          // minutes: 5m
      { pattern: /^(\d+)min$/, multiplier: 60 },        // minutes: 5min
      { pattern: /^(\d+)minutes?$/, multiplier: 60 },    // minutes: 5minute
      { pattern: /^(\d+)h$/, multiplier: 3600 },        // heures: 2h
      { pattern: /^(\d+)hr$/, multiplier: 3600 },       // heures: 2hr
      { pattern: /^(\d+)heures?$/, multiplier: 3600 },   // heures: 2heure
      { pattern: /^(\d+)$/, multiplier: 1 }              // défaut: secondes
    ];

    for (const { pattern, multiplier } of timePatterns) {
      const match = input.match(pattern);
      if (match) {
        const seconds = parseInt(match[1]) * multiplier;
        
        if (seconds < 0) {
          return {
            success: false,
            error: 'La durée ne peut pas être négative.'
          };
        }
        
        if (seconds > MAX_SLOWMODE_SECONDS) {
          return {
            success: false,
            error: `La durée maximum est de 6 heures (${MAX_SLOWMODE_SECONDS}s).`
          };
        }
        
        return {
          success: true,
          seconds: seconds,
          formatted: this.formatDuration(seconds)
        };
      }
    }

    return {
      success: false,
      error: 'Format invalide. Utilisez: 30s, 5m, 1h, 0, ou off'
    };
  },

  /**
   * Formate une durée en secondes en format lisible
   * @param {number} seconds 
   * @returns {string}
   */
  formatDuration(seconds) {
    if (seconds === 0) return 'Désactivé';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 && hours === 0) parts.push(`${secs}s`);
    
    return parts.join(' ') || '1s';
  },

  /**
   * Envoie un log pour l'action slowmode
   * @param {Guild} guild 
   * @param {Object} logData 
   */
  async logSlowmodeAction(guild, logData) {
    try {
      const { IDS } = require('../../config/constants');
      const logChannelId = IDS.LOGS_CHANNEL;
      
      if (!logChannelId) return; // Pas de channel de logs configuré
      
      const logChannel = await guild.channels.fetch(logChannelId).catch(() => null);
      if (!logChannel) return;

      const { moderator, channel, seconds, formatted, input } = logData;
      
      const logEmbed = embed.info('🐌 Slowmode Modifié', 
        `**${moderator.tag}** a modifié le slowmode de **#${channel.name}**\n` +
        `Nouvelle durée: **${formatted}**`
      );

      logEmbed.addFields(
        { name: '👮 Modérateur', value: moderator.tag, inline: true },
        { name: '📊 Channel', value: `#${channel.name}`, inline: true },
        { name: '⏱️ Durée', value: formatted, inline: true },
        { name: '🔤 Input', value: `"${input}"`, inline: true }
      );

      if (seconds > 0) {
        logEmbed.addFields({ 
          name: '⚡ Intervalle', 
          value: `1 message toutes les ${seconds} secondes`, 
          inline: false 
        });
      }

      logEmbed.setFooter({ text: `ID Modérateur: ${moderator.id}` });
      logEmbed.setTimestamp();

      await logChannel.send({ embeds: [logEmbed] });
    } catch (error) {
      console.error('Erreur lors de l\'envoi du log de slowmode:', error);
    }
  },

  /**
   * Traduit les erreurs spécifiques à slowmode
   * @param {Error} error 
   * @returns {string}
   */
  getSlowmodeErrorMessage(error) {
    // Erreurs Discord spécifiques
    if (error.code === 50013) {
      return 'Je n\'ai pas les permissions nécessaires pour modifier ce channel.';
    }
    if (error.code === 10003) {
      return 'Channel inaccessible ou inexistant.';
    }
    if (error.code === 50001) {
      return 'Accès au channel refusé.';
    }
    
    // Erreurs de permissions
    if (error.message?.includes('Missing Permissions')) {
      return 'Permissions insuffisantes pour modifier le slowmode de ce channel.';
    }
    
    // Erreur générique
    return 'Impossible de modifier le slowmode de ce channel. Vérifiez mes permissions.';
  }
};

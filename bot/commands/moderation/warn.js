/**
 * COMMANDE WARN - Avertir un membre
 * Crée un avertissement en BDD et vérifie les seuils automatiques
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embed = require('../../services/embedBuilder');
const permissions = require('../../services/permissions');
const warningRepo = require('../../../database/js/repositories/warningRepo');
const userRepo = require('../../../database/js/repositories/userRepo');
const guildRepo = require('../../../database/js/repositories/guildRepo');
const logger = require('../../utils/logger');

module.exports = {
  // ========================================
  // DÉFINITION DE LA COMMANDE
  // ========================================
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Avertir un membre')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addUserOption(option => option
      .setName('utilisateur')
      .setDescription('Le membre à avertir')
      .setRequired(true)
    )
    .addStringOption(option => option
      .setName('raison')
      .setDescription('Raison de l\'avertissement')
      .setRequired(true)
      .setMaxLength(500)
    ),

  // ========================================
  // MÉTADONNÉES
  // ========================================
  cooldown: 3, // Secondes
  category: 'moderation',

  // ========================================
  // EXÉCUTION
  // ========================================
  async execute(interaction) {
    // 1. RÉCUPÉRATION DES OPTIONS
    const target = interaction.options.getUser('utilisateur');
    const reason = interaction.options.getString('raison');
    const { guild, user: moderator } = interaction;

    // 2. VÉRIFICATIONS PERMISSIONS
    const permCheck = await permissions.fullCheck(interaction, target, 'warn');
    if (!permCheck.allowed) {
      return interaction.reply({
        embeds: [embed.error('Permission refusée', permCheck.reason)],
        ephemeral: true
      });
    }

    // 3. RÉCUPÉRATION DU MEMBRE CIBLE
    const targetMember = await guild.members.fetch(target.id).catch(() => null);
    if (!targetMember) {
      return interaction.reply({
        embeds: [embed.error('Erreur', 'Utilisateur non trouvé sur ce serveur.')],
        ephemeral: true
      });
    }

    // 4. EXÉCUTION DE L'ACTION
    try {
      // S'assurer que les entrées existent en BDD
      await this.ensureDatabaseEntries(guild, target, moderator);
      
      // 5. CRÉATION DU WARNING
      const warning = await warningRepo.create({
        guildId: guild.id,
        userId: target.id,
        moderatorId: moderator.id,
        reason: reason
      });
      
      // 6. COMPTAGE DES WARNINGS ACTIFS
      const activeWarnings = await warningRepo.countActiveByUser(target.id, guild.id);
      
      // 7. ENVOI MP À L'UTILISATEUR
      await this.sendWarningDM(target, guild, moderator, reason, activeWarnings);
      
      // 8. VÉRIFICATION SEUILS AUTOMATIQUES
      const autoAction = await this.checkThresholds(guild.id, activeWarnings);
      
      // 9. RÉPONSE SUCCÈS
      const successEmbed = this.buildSuccessEmbed(target, reason, warning.id, activeWarnings, autoAction);
      await interaction.reply({ embeds: [successEmbed] });
      
      // 10. LOG DE MODÉRATION
      await this.logWarnAction(guild, {
        moderator: moderator,
        target: target,
        reason: reason,
        caseId: warning.id,
        activeWarnings: activeWarnings,
        autoAction: autoAction
      });
      
    } catch (error) {
      console.error('Erreur commande warn:', error);
      
      // 11. GESTION D'ERREUR
      await interaction.reply({
        embeds: [embed.error('Erreur', 'Une erreur est survenue lors de la création du warning.')],
        ephemeral: true
      });
    }
  },

  // ========================================
  // MÉTHODES UTILITAIRES
  // ========================================

  /**
   * S'assure que les entrées existent en BDD
   */
  async ensureDatabaseEntries(guild, target, moderator) {
    try {
      await guildRepo.findOrCreate(guild.id, guild.name);
      await userRepo.findOrCreate(target.id, target.tag);
      await userRepo.findOrCreate(moderator.id, moderator.tag);
    } catch (error) {
      console.error('Erreur lors de la création des entrées BDD:', error);
      throw error;
    }
  },

  /**
   * Envoie un message privé à l'utilisateur averti
   */
  async sendWarningDM(target, guild, moderator, reason, activeWarnings) {
    try {
      const dmEmbed = embed.warning(
        '⚠️ Avertissement reçu',
        `Vous avez reçu un avertissement sur **${guild.name}**`
      );

      dmEmbed.addFields(
        { name: '📝 Raison', value: reason },
        { name: '👮 Modérateur', value: moderator.tag },
        { name: '📊 Total warnings', value: `${activeWarnings}`, inline: true },
        { name: '📅 Date', value: new Date().toLocaleDateString('fr-FR'), inline: true }
      );

      dmEmbed.setFooter({ 
        text: 'Trop de warnings peuvent entraîner des sanctions automatiques' 
      });

      await target.send({ embeds: [dmEmbed] });
    } catch (error) {
      logger.debug(`Impossible d'envoyer MP à ${target.tag}:`, error.message);
      // Ne pas faire échouer la commande si le MP ne peut être envoyé
    }
  },

  /**
   * Vérifie les seuils automatiques selon les paramètres du serveur
   */
  async checkThresholds(guildId, activeWarnings) {
    try {
      // Seuils par défaut (peuvent être configurés par serveur)
      const defaultThresholds = {
        mute: 3,
        kick: 5,
        ban: 7
      };

      // TODO: Récupérer les seuils personnalisés depuis la BDD
      // const guildSettings = await guildRepo.getSettings(guildId);
      // const thresholds = guildSettings?.warnThresholds || defaultThresholds;
      
      const thresholds = defaultThresholds;

      if (activeWarnings >= thresholds.ban) {
        return { type: 'ban', count: thresholds.ban, severity: 'high' };
      } else if (activeWarnings >= thresholds.kick) {
        return { type: 'kick', count: thresholds.kick, severity: 'medium' };
      } else if (activeWarnings >= thresholds.mute) {
        return { type: 'mute', count: thresholds.mute, severity: 'low' };
      }

      return null;
    } catch (error) {
      console.error('Erreur lors de la vérification des seuils:', error);
      return null;
    }
  },

  /**
   * Construit l'embed de succès
   */
  buildSuccessEmbed(target, reason, warningId, activeWarnings, autoAction) {
    const successEmbed = embed.success(
      '⚠️ Avertissement donné',
      `**${target.tag}** a reçu un avertissement avec succès.`
    );

    successEmbed.addFields(
      { name: '👤 Utilisateur', value: target.tag, inline: true },
      { name: '📝 Raison', value: reason, inline: false },
      { name: '🔢 Warning #', value: `#${warningId}`, inline: true },
      { name: '📊 Total actifs', value: `${activeWarnings}`, inline: true }
    );

    // Ajouter l'information sur le seuil atteint
    if (autoAction) {
      const severityEmoji = {
        low: '🟡',
        medium: '🟠', 
        high: '🔴'
      };

      successEmbed.addFields({
        name: `${severityEmoji[autoAction.severity]} Seuil atteint`,
        value: `${activeWarnings} warnings → Action suggérée: **${autoAction.type.toUpperCase()}**`
      });
    }

    return successEmbed;
  },

  /**
   * Envoie un log pour l'action warn
   */
  async logWarnAction(guild, logData) {
    try {
      const { IDS } = require('../../../config/constants');
      const logChannelId = IDS.LOGS_CHANNEL;
      
      if (!logChannelId) return; // Pas de channel de logs configuré
      
      const logChannel = await guild.channels.fetch(logChannelId).catch(() => null);
      if (!logChannel) return;

      const { moderator, target, reason, caseId, activeWarnings, autoAction } = logData;
      
      const logEmbed = embed.info('⚠️ Warning Donné', 
        `**${moderator.tag}** a averti **${target.tag}**`
      );

      logEmbed.addFields(
        { name: '👮 Modérateur', value: moderator.tag, inline: true },
        { name: '👤 Utilisateur', value: target.tag, inline: true },
        { name: '📝 Raison', value: reason, inline: false },
        { name: '🔢 Case ID', value: `#${caseId}`, inline: true },
        { name: '📊 Total warnings', value: `${activeWarnings}`, inline: true }
      );

      if (autoAction) {
        logEmbed.addFields({
          name: '⚠️ Seuil atteint',
          value: `Action suggérée: **${autoAction.type.toUpperCase()}** (${autoAction.count} warnings)`,
          inline: false
        });
      }

      logEmbed.setFooter({ text: `ID Modérateur: ${moderator.id} | ID Utilisateur: ${target.id}` });
      logEmbed.setTimestamp();

      await logChannel.send({ embeds: [logEmbed] });
    } catch (error) {
      console.error('Erreur lors de l\'envoi du log de warning:', error);
    }
  }
};

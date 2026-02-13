/**
 * COMMANDE DELWARN - Supprimer/révoquer un avertissement
 * Permet de révoquer un warning spécifique par son ID
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embed = require('../../services/embedBuilder');
const warningRepo = require('../../../database/js/repositories/warningRepo');
const logger = require('../../utils/logger');

module.exports = {
  // ========================================
  // DÉFINITION DE LA COMMANDE
  // ========================================
  data: new SlashCommandBuilder()
    .setName('delwarn')
    .setDescription('Supprimer/révoquer un avertissement')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addIntegerOption(option => option
      .setName('id')
      .setDescription('L\'ID du warning à supprimer')
      .setRequired(true)
      .setMinValue(1)
    )
    .addStringOption(option => option
      .setName('raison')
      .setDescription('Raison de la suppression')
      .setRequired(false)
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
    const warningId = interaction.options.getInteger('id');
    const reason = interaction.options.getString('raison') || 'Aucune raison fournie';
    const { guild, user: moderator } = interaction;

    // 2. EXÉCUTION DE L'ACTION
    try {
      // 3. RÉCUPÉRATION DU WARNING
      const warning = await warningRepo.findById(warningId);
      
      // 4. VÉRIFICATIONS
      if (!warning) {
        return interaction.reply({
          embeds: [embed.error('Non trouvé', `Aucun warning avec l'ID **#${warningId}** n'existe.`)],
          flags: [4096] // Ephemeral flag
        });
      }
      
      // Vérifier que le warning appartient à ce serveur
      if (warning.guildId !== guild.id) {
        return interaction.reply({
          embeds: [embed.error('Non trouvé', `Ce warning n'appartient pas à ce serveur.`)],
          flags: [4096] // Ephemeral flag
        });
      }
      
      // Vérifier si déjà révoqué
      if (!warning.isActive()) {
        return interaction.reply({
          embeds: [embed.warning('Déjà révoqué', `Le warning **#${warningId}** est déjà révoqué.`)],
          flags: [4096] // Ephemeral flag
        });
      }
      
      // 5. RÉVOCATION DU WARNING
      await warningRepo.deactivate(warningId);
      
      // 6. RÉCUPÉRATION DE L'UTILISATEUR CONCERNÉ
      const targetUser = await interaction.client.users.fetch(warning.userId).catch(() => null);
      const targetTag = targetUser?.tag || `ID: ${warning.userId}`;
      
      // 7. RÉPONSE SUCCÈS
      const successEmbed = this.buildSuccessEmbed(warning, targetTag, reason);
      await interaction.reply({ embeds: [successEmbed] });
      
      // 8. LOG DE MODÉRATION
      await this.logDelwarnAction(guild, {
        moderator: moderator,
        target: targetUser || { tag: targetTag, id: warning.userId },
        warning: warning,
        reason: reason
      });
      
    } catch (error) {
      console.error('Erreur commande delwarn:', error);
      
      // 9. GESTION D'ERREUR
      await interaction.reply({
        embeds: [embed.error('Erreur', 'Une erreur est survenue lors de la suppression du warning.')],
        flags: [4096] // Ephemeral flag
      });
    }
  },

  // ========================================
  // MÉTHODES UTILITAIRES
  // ========================================

  /**
   * Construit l'embed de succès pour la suppression
   */
  buildSuccessEmbed(warning, targetTag, reason) {
    const successEmbed = embed.success(
      '✅ Warning supprimé',
      `Le warning **#${warning.id}** de **${targetTag}** a été révoqué avec succès.`
    );

    successEmbed.addFields(
      { 
        name: '📝 Raison originale', 
        value: warning.reason,
        inline: false
      },
      { 
        name: '🗑️ Raison suppression', 
        value: reason,
        inline: false
      },
      { 
        name: '👤 Utilisateur concerné', 
        value: targetTag,
        inline: true
      },
      { 
        name: '🆔 ID Warning', 
        value: `#${warning.id}`,
        inline: true
      },
      { 
        name: '📅 Date création', 
        value: new Date(warning.createdAt).toLocaleDateString('fr-FR'),
        inline: true
      }
    );

    successEmbed.setFooter({ 
      text: `Le warning est maintenant inactif et n'apparaîtra plus dans les comptes actifs` 
    });
    successEmbed.setTimestamp();

    return successEmbed;
  },

  /**
   * Envoie un log pour l'action delwarn
   */
  async logDelwarnAction(guild, logData) {
    try {
      const { IDS } = require('../../../config/constants');
      const logChannelId = IDS.LOGS_CHANNEL;
      
      if (!logChannelId) return; // Pas de channel de logs configuré
      
      const logChannel = await guild.channels.fetch(logChannelId).catch(() => null);
      if (!logChannel) return;

      const { moderator, target, warning, reason } = logData;
      
      const logEmbed = embed.info('🗑️ Warning Supprimé', 
        `**${moderator.tag}** a révoqué le warning **#${warning.id}** de **${target.tag}**`
      );

      logEmbed.addFields(
        { name: '👮 Modérateur', value: moderator.tag, inline: true },
        { name: '👤 Utilisateur', value: target.tag, inline: true },
        { name: '🔢 Warning ID', value: `#${warning.id}`, inline: true },
        { name: '📝 Raison suppression', value: reason, inline: false },
        { name: '📋 Raison originale', value: warning.reason, inline: false }
      );

      // Informations supplémentaires
      const warningDate = new Date(warning.createdAt);
      logEmbed.addFields(
        { name: '📅 Date warning', value: warningDate.toLocaleDateString('fr-FR'), inline: true },
        { name: '👤 Modérateur original', value: `<@${warning.moderatorId}>`, inline: true }
      );

      logEmbed.setFooter({ 
        text: `ID Modérateur: ${moderator.id} | ID Utilisateur: ${target.id} | Warning ID: ${warning.id}` 
      });
      logEmbed.setTimestamp();

      await logChannel.send({ embeds: [logEmbed] });
    } catch (error) {
      console.error('Erreur lors de l\'envoi du log de delwarn:', error);
    }
  }
};

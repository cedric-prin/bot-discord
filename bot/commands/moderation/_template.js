/**
 * TEMPLATE COMMANDE MODÉRATION
 * À copier pour créer une nouvelle commande de modération
 * 
 * INSTRUCTIONS:
 * 1. Copier ce fichier vers: bot/commands/moderation/nouvellecommande.js
 * 2. Remplacer 'commandname' par le nom réel de la commande
 * 3. Adapter les options et la logique spécifique
 * 4. Ajouter la commande au handler si nécessaire
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embed = require('../../services/embedBuilder');
const permissions = require('../../services/permissions');
const sanctionRepo = require('../../../database/js/repositories/sanctionRepo');
const Sanction = require('../../../database/js/models/Sanction');

module.exports = {
  // ========================================
  // DÉFINITION DE LA COMMANDE
  // ========================================
  data: new SlashCommandBuilder()
    .setName('commandname')
    .setDescription('Description de la commande')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addUserOption(option => option
      .setName('utilisateur')
      .setDescription('L\'utilisateur ciblé')
      .setRequired(true)
    )
    .addStringOption(option => option
      .setName('raison')
      .setDescription('Raison de l\'action')
      .setRequired(false)
      .setMaxLength(500)
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
    const target = interaction.options.getUser('utilisateur');
    const reason = interaction.options.getString('raison') || 'Aucune raison fournie';
    const { guild, member: moderator } = interaction;

    // 2. VÉRIFICATIONS PERMISSIONS
    const permCheck = await permissions.fullCheck(interaction, target, 'commandname');
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
      // Action Discord spécifique (adapter selon la commande)
      // Exemples:
      // - await targetMember.kick({ reason });
      // - await targetMember.ban({ reason, days: 7 });
      // - await targetMember.timeout(duration, reason);
      
      // 5. ENREGISTREMENT EN BASE DE DONNÉES
      const sanctionData = {
        guildId: guild.id,
        userId: target.id,
        moderatorId: moderator.id,
        type: 'commandname', // Adapter au type: 'kick', 'ban', 'mute', 'warn'
        reason: reason,
        duration: null, // Pour actions temporaires, mettre en secondes
        // expiresAt: sera calculé automatiquement si duration fourni
      };

      const savedSanction = await sanctionRepo.create(sanctionData);

      // 6. RÉPONSE SUCCÈS
      await interaction.reply({
        embeds: [embed.success(
          'Action effectuée', 
          `L'utilisateur **${target.tag}** a été sanctionné avec succès.\n` +
          `Raison: ${reason}\n` +
          `ID de sanction: #${savedSanction.id}`
        )]
      });

      // 7. LOG DE MODÉRATION
      await this.logModAction(guild, {
        action: 'commandname',
        moderator: moderator.user,
        target: target,
        reason: reason,
        caseId: savedSanction.id
      });

    } catch (error) {
      console.error(`Erreur commande commandname:`, error);
      
      // 8. GESTION D'ERREUR
      const errorMessage = this.getErrorMessage(error);
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          embeds: [embed.error('Erreur', errorMessage)],
          ephemeral: true
        });
      } else {
        await interaction.reply({
          embeds: [embed.error('Erreur', errorMessage)],
          ephemeral: true
        });
      }
    }
  },

  // ========================================
  // MÉTHODES UTILITAIRES
  // ========================================

  /**
   * Envoie un log dans le channel de modération configuré
   * @param {Guild} guild 
   * @param {Object} logData 
   */
  async logModAction(guild, logData) {
    try {
      const { IDS } = require('../../../config/constants');
      const logChannelId = IDS.LOGS_CHANNEL;
      
      if (!logChannelId) return; // Pas de channel de logs configuré
      
      const logChannel = await guild.channels.fetch(logChannelId).catch(() => null);
      if (!logChannel) return;

      const logEmbed = embed.modLog(logData);
      await logChannel.send({ embeds: [logEmbed] });
    } catch (error) {
      console.error('Erreur lors de l\'envoi du log de modération:', error);
    }
  },

  /**
   * Traduit les erreurs Discord en messages compréhensibles
   * @param {Error} error 
   * @returns {string}
   */
  getErrorMessage(error) {
    // Erreurs Discord courantes
    if (error.code === 50013) {
      return 'Je n\'ai pas les permissions nécessaires pour effectuer cette action.';
    }
    if (error.code === 10007) {
      return 'Cet utilisateur n\'est pas sur le serveur.';
    }
    if (error.code === 50013) {
      return 'Je ne peux pas modérer cet utilisateur (rôle supérieur au mien).';
    }
    
    // Erreurs de base de données
    if (error.code === 'SANCTION_VALIDATION_ERROR') {
      return 'Erreur de validation des données de sanction.';
    }
    
    // Erreur générique
    return 'Une erreur est survenue lors de l\'exécution de la commande.';
  }
};
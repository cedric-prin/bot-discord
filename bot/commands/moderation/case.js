/**
 * COMMANDE CASE - Voir les détails d'une sanction
 * Affiche toutes les informations d'une sanction spécifique
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embed = require('../../services/embedBuilder');
const sanctionRepo = require('../../database/js/repositories/sanctionRepo');
const logger = require('../../utils/logger');

const ACTION_EMOJIS = { 
  warn: '⚠️', 
  mute: '🔇', 
  kick: '👢', 
  ban: '🔨', 
  unban: '🔓', 
  unmute: '🔊',
  timeout: '⏰'
};

module.exports = {
  // ========================================
  // DÉFINITION DE LA COMMANDE
  // ========================================
  data: new SlashCommandBuilder()
    .setName('case')
    .setDescription('Voir les détails d\'une sanction')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addIntegerOption(option => option
      .setName('id')
      .setDescription('L\'ID de la sanction')
      .setRequired(true)
      .setMinValue(1)
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
    const caseId = interaction.options.getInteger('id');
    const { guild, client } = interaction;

    // 2. EXÉCUTION DE L'ACTION
    try {
      // 3. RÉCUPÉRATION DE LA SANCTION
      const sanction = await sanctionRepo.findById(caseId);
      
      // 4. VÉRIFICATIONS
      if (!sanction) {
        return interaction.reply({
          embeds: [embed.error('Non trouvé', `Aucune sanction avec l'ID **#${caseId}** n'existe.`)],
          ephemeral: true
        });
      }
      
      // Vérifier appartenance au serveur
      if (sanction.guildId !== guild.id) {
        return interaction.reply({
          embeds: [embed.error('Non trouvé', `Cette sanction n'appartient pas à ce serveur.`)],
          ephemeral: true
        });
      }
      
      // 5. RÉCUPÉRATION DES UTILISATEURS
      const users = await this.fetchUsers(client, sanction);
      
      // 6. CONSTRUCTION DE L'EMBED
      const caseEmbed = await this.buildCaseEmbed(sanction, users, caseId);
      
      // 7. RÉPONSE
      await interaction.reply({ embeds: [caseEmbed] });
      
    } catch (error) {
      console.error('Erreur commande case:', error);
      
      // 8. GESTION D'ERREUR
      await interaction.reply({
        embeds: [embed.error('Erreur', 'Une erreur est survenue lors de la récupération de la sanction.')],
        ephemeral: true
      });
    }
  },

  // ========================================
  // MÉTHODES UTILITAIRES
  // ========================================

  /**
   * Récupère les informations des utilisateurs
   */
  async fetchUsers(client, sanction) {
    const [targetUser, modUser] = await Promise.all([
      client.users.fetch(sanction.userId).catch(() => null),
      client.users.fetch(sanction.moderatorId).catch(() => null)
    ]);

    return {
      target: {
        user: targetUser,
        tag: targetUser?.tag || `ID: ${sanction.userId}`,
        id: sanction.userId
      },
      moderator: {
        user: modUser,
        tag: modUser?.tag || `ID: ${sanction.moderatorId}`,
        id: sanction.moderatorId
      }
    };
  },

  /**
   * Construit l'embed détaillé de la sanction
   */
  async buildCaseEmbed(sanction, users, caseId) {
    const actionEmoji = ACTION_EMOJIS[sanction.type] || '📋';
    const status = this.getSanctionStatus(sanction);
    
    const caseEmbed = embed.info(
      `${actionEmoji} Case #${caseId}`,
      `Détails de la sanction - **${sanction.type.toUpperCase()}**`
    );

    // Informations principales
    caseEmbed.addFields(
      { name: '📋 Type', value: sanction.type.toUpperCase(), inline: true },
      { name: '📊 Statut', value: status.text, inline: true },
      { name: '👤 Utilisateur', value: `${users.target.tag}\n\`${users.target.id}\``, inline: true },
      { name: '👮 Modérateur', value: `${users.moderator.tag}\n\`${users.moderator.id}\``, inline: true },
      { name: '📝 Raison', value: sanction.reason || 'Aucune raison fournie' }
    );

    // Dates
    this.addDateFields(caseEmbed, sanction);
    
    // Durée si applicable
    this.addDurationField(caseEmbed, sanction);
    
    // Informations de révocation si applicable
    await this.addRevocationFields(caseEmbed, sanction, users.target.user);

    // Avatar de l'utilisateur cible
    if (users.target.user) {
      caseEmbed.setThumbnail(users.target.user.displayAvatarURL({ dynamic: true }));
    }

    // Footer avec couleur selon statut
    caseEmbed.setFooter({ 
      text: `Case ID: #${caseId} • ${status.footer}` 
    });
    caseEmbed.setTimestamp();

    return caseEmbed;
  },

  /**
   * Détermine le statut de la sanction
   */
  getSanctionStatus(sanction) {
    if (!sanction.isActive()) {
      return { text: '⚫ Expirée', footer: 'Expirée' };
    }
    
    if (!sanction.active) {
      return { text: '🔴 Révoquée', footer: 'Révoquée manuellement' };
    }
    
    if (sanction.isTemporary()) {
      const remaining = sanction.getRemainingTime();
      if (remaining > 0) {
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        const timeLeft = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
        return { text: `🟢 Active (${timeLeft})`, footer: `Expire dans ${timeLeft}` };
      }
    }
    
    return { text: '🟢 Active', footer: 'Active permanente' };
  },

  /**
   * Ajoute les champs de dates
   */
  addDateFields(embed, sanction) {
    const createdTimestamp = Math.floor(new Date(sanction.createdAt).getTime() / 1000);
    embed.addFields({
      name: '📅 Date de création',
      value: `<t:${createdTimestamp}:F> (<t:${createdTimestamp}:R>)`,
      inline: true
    });

    if (sanction.expiresAt) {
      const expiresTimestamp = Math.floor(new Date(sanction.expiresAt).getTime() / 1000);
      embed.addFields({
        name: '📆 Date d\'expiration',
        value: `<t:${expiresTimestamp}:F> (<t:${expiresTimestamp}:R>)`,
        inline: true
      });
    }
  },

  /**
   * Ajoute le champ de durée si applicable
   */
  addDurationField(embed, sanction) {
    if (sanction.duration) {
      const durationStr = sanction.formatDuration();
      embed.addFields({
        name: '⏱️ Durée',
        value: durationStr,
        inline: true
      });
    }
  },

  /**
   * Ajoute les champs de révocation si applicable
   */
  async addRevocationFields(embed, sanction, targetUser) {
    // Note: Le modèle Sanction n'a pas de champs de révocation dans la version actuelle
    // Cette méthode est préparée pour une future évolution
    if (sanction.active === false && sanction.isTemporary() && sanction.isExpired()) {
      embed.addFields({
        name: '⏰ Expiration automatique',
        value: 'La sanction a expiré automatiquement',
        inline: false
      });
    }
  }
};

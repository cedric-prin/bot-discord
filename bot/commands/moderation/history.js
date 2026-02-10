/**
 * COMMANDE HISTORY - Voir l'historique complet d'un utilisateur
 * Affiche le résumé des warnings, sanctions et score de risque
 */

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const embed = require('../../services/embedBuilder');
const warningRepo = require('../../../database/js/repositories/warningRepo');
const sanctionRepo = require('../../../database/js/repositories/sanctionRepo');
const logger = require('../../utils/logger');

module.exports = {
  // ========================================
  // DÉFINITION DE LA COMMANDE
  // ========================================
  data: new SlashCommandBuilder()
    .setName('history')
    .setDescription('Voir l\'historique complet d\'un utilisateur')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addUserOption(option => option
      .setName('utilisateur')
      .setDescription('L\'utilisateur à consulter')
      .setRequired(true)
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
    const { guild, client } = interaction;

    // Defer pour éviter timeout lors des requêtes BDD
    await interaction.deferReply();

    // 2. EXÉCUTION DE L'ACTION
    try {
      // 3. RÉCUPÉRATION DES DONNÉES
      const [warnings, sanctions] = await Promise.all([
        warningRepo.findByUser(target.id, guild.id),
        sanctionRepo.findByUser(target.id, guild.id)
      ]);
      
      const activeWarnings = warnings.filter(w => w.isActive());
      
      // 4. ANALYSE DES DONNÉES
      const sanctionCounts = this.countSanctionsByType(sanctions);
      const riskScore = this.calculateRiskScore(activeWarnings, sanctionCounts);
      const riskInfo = this.getRiskInfo(riskScore);
      
      // 5. CONSTRUCTION DE L'EMBED PRINCIPAL
      const historyEmbed = this.buildMainEmbed(target, activeWarnings, warnings, sanctionCounts, riskInfo);
      
      // 6. AJOUT DES DERNIÈRES ACTIONS
      await this.addRecentActions(historyEmbed, warnings, sanctions);
      
      // 7. INFORMATIONS SUR LE MEMBRE
      await this.addMemberInfo(historyEmbed, target, guild);
      
      // 8. RÉPONSE FINALE
      await interaction.editReply({ embeds: [historyEmbed] });
      
    } catch (error) {
      console.error('Erreur commande history:', error);
      
      // 9. GESTION D'ERREUR
      await interaction.editReply({
        embeds: [embed.error('Erreur', 'Une erreur est survenue lors de la récupération de l\'historique.')]
      });
    }
  },

  // ========================================
  // MÉTHODES UTILITAIRES
  // ========================================

  /**
   * Compte les sanctions par type
   */
  countSanctionsByType(sanctions) {
    const counts = {
      warn: 0,
      mute: 0,
      kick: 0,
      ban: 0,
      timeout: 0,
      total: sanctions.length
    };
    
    for (const sanction of sanctions) {
      if (counts[sanction.type] !== undefined) {
        counts[sanction.type]++;
      }
    }
    
    return counts;
  },

  /**
   * Calcule le score de risque (0-100)
   */
  calculateRiskScore(activeWarnings, sanctionCounts) {
    let riskScore = 0;
    
    // Points par type d'infraction
    riskScore += activeWarnings.length * 10;  // 10 points par warning actif
    riskScore += sanctionCounts.mute * 15;    // 15 points par mute
    riskScore += sanctionCounts.timeout * 15;  // 15 points par timeout
    riskScore += sanctionCounts.kick * 25;    // 25 points par kick
    riskScore += sanctionCounts.ban * 40;     // 40 points par ban
    
    return Math.min(riskScore, 100); // Maximum 100
  },

  /**
   * Détermine le niveau et la couleur de risque
   */
  getRiskInfo(riskScore) {
    if (riskScore >= 70) {
      return {
        level: '🔴 Élevé',
        color: 0xFF0000, // Rouge
        description: 'Utilisateur à haut risque'
      };
    } else if (riskScore >= 40) {
      return {
        level: '🟡 Modéré',
        color: 0xFFFF00, // Jaune
        description: 'Utilisateur à risque modéré'
      };
    } else if (riskScore > 0) {
      return {
        level: '🟢 Faible',
        color: 0x00FF00, // Vert
        description: 'Utilisateur à faible risque'
      };
    } else {
      return {
        level: '⚪ Aucun',
        color: 0x808080, // Gris
        description: 'Aucun antécédent'
      };
    }
  },

  /**
   * Construit l'embed principal avec le résumé
   */
  buildMainEmbed(target, activeWarnings, warnings, sanctionCounts, riskInfo) {
    const historyEmbed = new EmbedBuilder()
      .setColor(riskInfo.color)
      .setTitle(`📋 Historique de ${target.tag}`)
      .setThumbnail(target.displayAvatarURL({ dynamic: true }))
      .setDescription(`Résumé des actions de modération pour cet utilisateur.\n${riskInfo.description}`);

    // Score de risque
    historyEmbed.addFields({
      name: '🎯 Score de risque',
      value: `**${this.calculateRiskScore(activeWarnings, sanctionCounts)}/100** - ${riskInfo.level}`,
      inline: false
    });

    // Statistiques
    historyEmbed.addFields(
      { name: '⚠️ Warnings', value: `${activeWarnings.length} actifs / ${warnings.length} total`, inline: true },
      { name: '🔇 Mutes', value: `${sanctionCounts.mute}`, inline: true },
      { name: '⏰ Timeouts', value: `${sanctionCounts.timeout}`, inline: true },
      { name: '👢 Kicks', value: `${sanctionCounts.kick}`, inline: true },
      { name: '🔨 Bans', value: `${sanctionCounts.ban}`, inline: true },
      { name: '📊 Total sanctions', value: `${sanctionCounts.total}`, inline: true }
    );

    return historyEmbed;
  },

  /**
   * Ajoute les dernières actions à l'embed
   */
  async addRecentActions(embed, warnings, sanctions) {
    // Combiner et trier toutes les actions par date
    const allActions = [
      ...warnings.map(w => ({
        type: 'warn',
        date: new Date(w.createdAt),
        reason: w.reason,
        id: w.id,
        active: w.isActive()
      })),
      ...sanctions.map(s => ({
        type: s.type,
        date: new Date(s.createdAt),
        reason: s.reason,
        id: s.id,
        active: s.isActive()
      }))
    ].sort((a, b) => b.date - a.date).slice(0, 5); // 5 plus récentes

    if (allActions.length > 0) {
      const actionsText = allActions.map(action => {
        const timestamp = Math.floor(action.date.getTime() / 1000);
        const status = action.active ? '' : ' *(révoqué/expiré)*';
        const typeEmojis = {
          warn: '⚠️',
          mute: '🔇',
          kick: '👢',
          ban: '🔨',
          timeout: '⏰',
          unban: '🔓',
          unmute: '🔊'
        };
        
        const emoji = typeEmojis[action.type] || '📋';
        const reason = action.reason.length > 50 
          ? action.reason.substring(0, 50) + '...' 
          : action.reason;
        
        return `• ${emoji} **${action.type.toUpperCase()}** #${action.id} - <t:${timestamp}:R>${status}\n  └ ${reason}`;
      }).join('\n');
      
      embed.addFields({
        name: '📜 Dernières actions',
        value: actionsText
      });
    } else {
      embed.addFields({
        name: '📜 Dernières actions',
        value: 'Aucune action de modération enregistrée'
      });
    }
  },

  /**
   * Ajoute les informations sur le membre du serveur
   */
  async addMemberInfo(embed, target, guild) {
    try {
      // Vérifier si l'utilisateur est toujours membre
      const member = await guild.members.fetch(target.id).catch(() => null);
      
      if (member) {
        const joinedTimestamp = Math.floor(member.joinedTimestamp / 1000);
        embed.addFields({
          name: '📅 Membre depuis',
          value: `<t:${joinedTimestamp}:R>`,
          inline: true
        });
      } else {
        embed.addFields({
          name: '📅 Statut serveur',
          value: '❌ Non membre',
          inline: true
        });
      }
    } catch (error) {
      embed.addFields({
        name: '📅 Statut serveur',
        value: '❌ Erreur de vérification',
        inline: true
      });
    }

    // Date de création du compte Discord
    const createdTimestamp = Math.floor(target.createdTimestamp / 1000);
    embed.addFields({
      name: '🆕 Compte créé',
      value: `<t:${createdTimestamp}:R>`,
      inline: true
    });

    // Footer avec ID
    embed.setFooter({ text: `ID: ${target.id}` });
    embed.setTimestamp();
  }
};

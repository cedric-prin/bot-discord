/**
 * COMMANDE WARNINGS - Voir les avertissements d'un utilisateur
 * Affiche la liste des warnings avec pagination interactive
 */

const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const embed = require('../../services/embedBuilder');
const warningRepo = require('../../../database/js/repositories/warningRepo');
const logger = require('../../utils/logger');

const WARNINGS_PER_PAGE = 5;

module.exports = {
  // ========================================
  // DÉFINITION DE LA COMMANDE
  // ========================================
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('Voir les avertissements d\'un membre')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addUserOption(option => option
      .setName('utilisateur')
      .setDescription('Le membre à consulter')
      .setRequired(true)
    )
    .addIntegerOption(option => option
      .setName('page')
      .setDescription('Page de résultats')
      .setRequired(false)
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
    const target = interaction.options.getUser('utilisateur');
    let page = interaction.options.getInteger('page') || 1;
    const { guild } = interaction;

    // 2. EXÉCUTION DE L'ACTION
    try {
      // Récupérer tous les warnings de l'utilisateur
      const allWarnings = await warningRepo.findByUser(target.id, guild.id);
      const activeWarnings = allWarnings.filter(w => w.isActive());
      
      // 3. GESTION CAS SANS WARNINGS
      if (allWarnings.length === 0) {
        const noWarningsEmbed = embed.info(
          '📋 Aucun warning',
          `**${target.tag}** n'a aucun avertissement sur ce serveur.`
        );
        
        noWarningsEmbed.setThumbnail(target.displayAvatarURL({ dynamic: true }));
        noWarningsEmbed.addFields(
          { name: '👤 Utilisateur', value: target.tag, inline: true },
          { name: '🆔 ID', value: target.id, inline: true }
        );
        
        return interaction.reply({ embeds: [noWarningsEmbed] });
      }
      
      // 4. PAGINATION
      const totalPages = Math.ceil(allWarnings.length / WARNINGS_PER_PAGE);
      page = Math.min(page, totalPages);
      
      const start = (page - 1) * WARNINGS_PER_PAGE;
      const pageWarnings = allWarnings.slice(start, start + WARNINGS_PER_PAGE);
      
      // 5. CONSTRUCTION DE L'EMBED
      const warningsEmbed = this.buildWarningsEmbed(target, pageWarnings, activeWarnings, allWarnings, page, totalPages);
      
      // 6. BOUTONS DE PAGINATION
      const paginationRow = this.buildPaginationRow(target.id, page, totalPages);
      
      // 7. RÉPONSE AVEC BOUTONS
      const response = await interaction.reply({
        embeds: [warningsEmbed],
        components: totalPages > 1 ? [paginationRow] : [],
        withResponse: true
      });
      
      // 8. GESTION DES INTERACTIONS BOUTONS
      if (totalPages > 1) {
        await this.handlePagination(response, interaction, target, allWarnings, activeWarnings, page, totalPages);
      }
      
    } catch (error) {
      console.error('Erreur commande warnings:', error);
      
      // 9. GESTION D'ERREUR
      await interaction.followUp({
        embeds: [embed.error('Erreur', 'Une erreur est survenue lors de la récupération des warnings.')],
        flags: [4096] // Ephemeral flag
      });
    }
  },

  // ========================================
  // MÉTHODES UTILITAIRES
  // ========================================

  /**
   * Construit l'embed principal des warnings
   */
  buildWarningsEmbed(target, pageWarnings, activeWarnings, allWarnings, page, totalPages) {
    const warningsEmbed = embed.info(
      `📋 Avertissements de ${target.tag}`,
      `**${activeWarnings.length}** warning(s) actif(s) / **${allWarnings.length}** total`
    );

    warningsEmbed.setThumbnail(target.displayAvatarURL({ dynamic: true }));
    
    // Informations générales
    warningsEmbed.addFields(
      { name: '👤 Utilisateur', value: target.tag, inline: true },
      { name: '📊 Statistiques', value: `${activeWarnings.length}/${allWarnings.length} actifs`, inline: true },
      { name: '🆔 ID', value: target.id, inline: true }
    );

    // Détails des warnings de la page
    for (const warning of pageWarnings) {
      const status = warning.isActive() ? '🟢 Actif' : '🔴 Révoqué';
      const date = new Date(warning.createdAt);
      const timestamp = Math.floor(date.getTime() / 1000);
      
      const warningField = {
        name: `⚠️ Warning #${warning.id} - ${status}`,
        value: [
          `**Raison:** ${warning.reason}`,
          `**Modérateur:** <@${warning.moderatorId}>`,
          `**Date:** <t:${timestamp}:R>`
        ].join('\n')
      };

      warningsEmbed.addFields(warningField);
    }

    warningsEmbed.setFooter({ 
      text: `Page ${page}/${totalPages} • Utilisez les boutons pour naviguer` 
    });
    warningsEmbed.setTimestamp();

    return warningsEmbed;
  },

  /**
   * Construit la rangée de boutons de pagination
   */
  buildPaginationRow(userId, currentPage, totalPages) {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`warnings_prev_${userId}_${currentPage}`)
        .setLabel('◀ Précédent')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage <= 1),
      new ButtonBuilder()
        .setCustomId(`warnings_next_${userId}_${currentPage}`)
        .setLabel('Suivant ▶')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage >= totalPages)
    );
  },

  /**
   * Gère les interactions de pagination
   */
  async handlePagination(response, interaction, target, allWarnings, activeWarnings, currentPage, totalPages) {
    const collector = interaction.channel.createMessageComponentCollector({
      time: 60000 // 1 minute
    });
    
    collector.on('collect', async (i) => {
      // Vérifier que c'est l'utilisateur d'origine
      if (i.user.id !== interaction.user.id) {
        return i.reply({
          content: 'Ces boutons ne sont pas pour vous.',
          flags: [4096] // Ephemeral flag
        });
      }
      
      const [, action, userId, pageStr] = i.customId.split('_');
      let newPage = parseInt(pageStr);
      
      if (action === 'prev') newPage--;
      if (action === 'next') newPage++;
      
      // Reconstruire l'embed avec la nouvelle page
      const start = (newPage - 1) * WARNINGS_PER_PAGE;
      const newPageWarnings = allWarnings.slice(start, start + WARNINGS_PER_PAGE);
      
      const newEmbed = this.buildWarningsEmbed(target, newPageWarnings, activeWarnings, allWarnings, newPage, totalPages);
      const newRow = this.buildPaginationRow(userId, newPage, totalPages);
      
      await i.update({
        embeds: [newEmbed],
        components: [newRow]
      });
    });
    
    collector.on('end', () => {
      // Désactiver les boutons après expiration
      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('disabled_prev')
          .setLabel('◀ Précédent')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId('disabled_next')
          .setLabel('Suivant ▶')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
      );
      
      response.edit({ components: [disabledRow] }).catch(() => {});
    });
  }
};

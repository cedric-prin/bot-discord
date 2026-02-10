/**
 * COMMANDE CLEAR - Suppression de messages en masse
 * Permet de supprimer des messages avec filtres optionnels
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embed = require('../../services/embedBuilder');
const permissions = require('../../services/permissions');
const logger = require('../../utils/logger');

module.exports = {
  // ========================================
  // DÉFINITION DE LA COMMANDE
  // ========================================
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Supprimer des messages en masse')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false)
    .addIntegerOption(option => option
      .setName('nombre')
      .setDescription('Nombre de messages à supprimer (1-100)')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(100)
    )
    .addUserOption(option => option
      .setName('utilisateur')
      .setDescription('Supprimer uniquement les messages de cet utilisateur')
      .setRequired(false)
    )
    .addStringOption(option => option
      .setName('contient')
      .setDescription('Supprimer les messages contenant ce texte')
      .setRequired(false)
    ),

  // ========================================
  // MÉTADONNÉES
  // ========================================
  cooldown: 10, // Secondes
  category: 'moderation',

  // ========================================
  // EXÉCUTION
  // ========================================
  async execute(interaction) {
    // 1. RÉCUPÉRATION DES OPTIONS
    const amount = interaction.options.getInteger('nombre');
    const filterUser = interaction.options.getUser('utilisateur');
    const filterContent = interaction.options.getString('contient')?.toLowerCase();
    const { channel, user: moderator, guild } = interaction;

    // 2. VÉRIFICATIONS PERMISSIONS (spécifique à clear)
    const permCheck = await permissions.fullCheck(interaction, null, 'clear');
    if (!permCheck.allowed) {
      return interaction.reply({
        embeds: [embed.error('Permission refusée', permCheck.reason)],
        ephemeral: true
      });
    }

    // 3. VÉRIFICATION DU CHANNEL
    if (!channel.isTextBased() || channel.isDMBased()) {
      return interaction.reply({
        embeds: [embed.error('Erreur', 'Cette commande ne peut être utilisée que dans un channel textuel.')],
        ephemeral: true
      });
    }

    // Defer car peut prendre du temps
    await interaction.deferReply({ ephemeral: true });

    // 4. EXÉCUTION DE L'ACTION
    try {
      // Récupérer les messages
      let messages = await channel.messages.fetch({ limit: Math.min(amount + 10, 100) });
      
      // Filtrer les messages de plus de 14 jours (limite Discord)
      const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
      messages = messages.filter(msg => msg.createdTimestamp > twoWeeksAgo);
      
      // Filtrer par utilisateur si spécifié
      if (filterUser) {
        messages = messages.filter(msg => msg.author.id === filterUser.id);
      }
      
      // Filtrer par contenu si spécifié
      if (filterContent) {
        messages = messages.filter(msg => 
          msg.content.toLowerCase().includes(filterContent)
        );
      }
      
      // Exclure les messages système et bots si nécessaire
      messages = messages.filter(msg => !msg.system);
      
      // Limiter au nombre demandé
      const toDelete = messages.first(amount);
      
      if (toDelete.length === 0) {
        return interaction.editReply({
          embeds: [embed.warning('Aucun message', 'Aucun message ne correspond aux critères spécifiés.')]
        });
      }
      
      // 5. SUPPRESSION DES MESSAGES
      const deleted = await channel.bulkDelete(toDelete, true);
      
      // 6. RÉPONSE SUCCÈS
      let description = `**${deleted.size}** message${deleted.size > 1 ? 's' : ''} supprimé${deleted.size > 1 ? 's' : ''} avec succès.`;
      
      const fields = [];
      if (filterUser) {
        fields.push({ name: '👤 Filtre utilisateur', value: filterUser.tag, inline: true });
      }
      if (filterContent) {
        fields.push({ name: '🔍 Filtre contenu', value: `"${filterContent}"`, inline: true });
      }
      fields.push({ name: '📊 Channel', value: `#${channel.name}`, inline: true });
      
      const successEmbed = embed.success('Messages supprimés', description);
      if (fields.length > 0) {
        successEmbed.addFields(fields);
      }
      
      await interaction.editReply({ embeds: [successEmbed] });
      
      // 7. LOG DE MODÉRATION
      await this.logClearAction(guild, {
        moderator: moderator,
        channel: channel,
        deleted: deleted.size,
        filterUser: filterUser,
        filterContent: filterContent,
        requested: amount
      });
      
    } catch (error) {
      console.error('Erreur commande clear:', error);
      
      // 8. GESTION D'ERREUR SPÉCIFIQUE
      const errorMessage = this.getClearErrorMessage(error);
      
      await interaction.editReply({
        embeds: [embed.error('Erreur', errorMessage)],
        ephemeral: true
      });
    }
  },

  // ========================================
  // MÉTHODES UTILITAIRES
  // ========================================

  /**
   * Envoie un log pour l'action clear
   * @param {Guild} guild 
   * @param {Object} logData 
   */
  async logClearAction(guild, logData) {
    try {
      const { IDS } = require('../../config/constants');
      const logChannelId = IDS.LOGS_CHANNEL;
      
      if (!logChannelId) return; // Pas de channel de logs configuré
      
      const logChannel = await guild.channels.fetch(logChannelId).catch(() => null);
      if (!logChannel) return;

      const { moderator, channel, deleted, filterUser, filterContent, requested } = logData;
      
      const logEmbed = embed.info('🗑️ Clear Messages', 
        `**${moderator.tag}** a supprimé **${deleted}** messages dans **#${channel.name}**\n` +
        `Demandé: ${requested} message${requested > 1 ? 's' : ''}`
      );

      const fields = [];
      if (filterUser) {
        fields.push({ name: '👤 Filtre utilisateur', value: filterUser.tag, inline: true });
      }
      if (filterContent) {
        fields.push({ name: '🔍 Filtre contenu', value: `"${filterContent}"`, inline: true });
      }
      if (fields.length > 0) {
        logEmbed.addFields(fields);
      }

      logEmbed.setFooter({ text: `ID Modérateur: ${moderator.id}` });
      logEmbed.setTimestamp();

      await logChannel.send({ embeds: [logEmbed] });
    } catch (error) {
      console.error('Erreur lors de l\'envoi du log de clear:', error);
    }
  },

  /**
   * Traduit les erreurs spécifiques à clear en messages compréhensibles
   * @param {Error} error 
   * @returns {string}
   */
  getClearErrorMessage(error) {
    // Erreurs Discord spécifiques à bulkDelete
    if (error.code === 50034) {
      return 'Les messages de plus de 14 jours ne peuvent pas être supprimés en masse.';
    }
    if (error.code === 50013) {
      return 'Je n\'ai pas les permissions nécessaires pour supprimer des messages dans ce channel.';
    }
    if (error.code === 10003) {
      return 'Channel inaccessible ou inexistant.';
    }
    if (error.code === 10008) {
      return 'Certains messages sont introuvables (peut-être déjà supprimés).';
    }
    
    // Erreurs de permissions
    if (error.message?.includes('Missing Permissions')) {
      return 'Permissions insuffisantes pour supprimer des messages.';
    }
    
    // Erreur générique
    return 'Une erreur est survenue lors de la suppression des messages. Veuillez réessayer.';
  }
};

/**
 * COMMANDE UNLOCK - Déverrouiller un channel
 * Restaure la permission d'envoyer des messages au rôle @everyone
 */

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const embed = require('../../services/embedBuilder');
const permissions = require('../../services/permissions');
const logger = require('../../utils/logger');

module.exports = {
  // ========================================
  // DÉFINITION DE LA COMMANDE
  // ========================================
  data: new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Déverrouiller un channel (autorise les messages)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false)
    .addChannelOption(option => option
      .setName('channel')
      .setDescription('Channel à déverrouiller (défaut: channel actuel)')
      .setRequired(false)
      .addChannelTypes(
        ChannelType.GuildText,
        ChannelType.GuildForum,
        ChannelType.GuildAnnouncement
      )
    )
    .addStringOption(option => option
      .setName('raison')
      .setDescription('Raison du déverrouillage')
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
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
    const reason = interaction.options.getString('raison') || 'Aucune raison fournie';
    const { guild, user: moderator } = interaction;

    // 2. VÉRIFICATIONS PERMISSIONS
    const permCheck = await permissions.fullCheck(interaction, null, 'unlock');
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

    // 4. VÉRIFICATION ÉTAT ACTUEL
    const everyoneRole = guild.roles.everyone;
    const currentPerms = targetChannel.permissionOverwrites.cache.get(everyoneRole.id);
    const isLocked = currentPerms?.deny.has(PermissionFlagsBits.SendMessages);

    if (!isLocked) {
      return interaction.reply({
        embeds: [embed.warning('Non verrouillé', `Le channel **${targetChannel.name}** n'est pas verrouillé.`)],
        ephemeral: true
      });
    }

    // 5. EXÉCUTION DE L'ACTION
    try {
      await targetChannel.permissionOverwrites.edit(everyoneRole, {
        SendMessages: null // Reset à la valeur par défaut
      }, { 
        reason: `Unlock par ${moderator.tag}: ${reason}`,
        type: 0 // Role overwrite
      });
      
      // 6. MESSAGE DANS LE CHANNEL DÉVERROUILLÉ
      const unlockEmbed = embed.success(
        '🔓 Channel déverrouillé',
        `Ce channel a été déverrouillé par **${moderator.tag}**.\n\n**Raison:** ${reason}`
      );

      unlockEmbed.addFields(
        { name: '👮 Modérateur', value: moderator.tag, inline: true },
        { name: '⏰ Heure', value: new Date().toLocaleTimeString('fr-FR'), inline: true }
      );

      await targetChannel.send({ embeds: [unlockEmbed] });
      
      // 7. RÉPONSE SUCCÈS
      const successEmbed = embed.success(
        '🔓 Channel déverrouillé',
        `Le channel **${targetChannel.name}** a été déverrouillé avec succès.`
      );

      successEmbed.addFields(
        { name: '📊 Channel', value: `#${targetChannel.name}`, inline: true },
        { name: '👤 Modérateur', value: moderator.tag, inline: true },
        { name: '📝 Raison', value: reason, inline: false }
      );

      if (targetChannel.id !== interaction.channel.id) {
        await interaction.reply({ embeds: [successEmbed] });
      } else {
        await interaction.reply({
          embeds: [embed.success('Fait', 'Channel déverrouillé.')],
          ephemeral: true
        });
      }
      
      // 8. LOG DE MODÉRATION
      await this.logUnlockAction(guild, {
        moderator: moderator,
        channel: targetChannel,
        reason: reason,
        action: 'unlock'
      });
      
    } catch (error) {
      console.error('Erreur commande unlock:', error);
      
      // 9. GESTION D'ERREUR
      const errorMessage = this.getUnlockErrorMessage(error);
      
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
   * Envoie un log pour l'action unlock
   * @param {Guild} guild 
   * @param {Object} logData 
   */
  async logUnlockAction(guild, logData) {
    try {
      const { IDS } = require('../../config/constants');
      const logChannelId = IDS.LOGS_CHANNEL;
      
      if (!logChannelId) return; // Pas de channel de logs configuré
      
      const logChannel = await guild.channels.fetch(logChannelId).catch(() => null);
      if (!logChannel) return;

      const { moderator, channel, reason, action } = logData;
      
      const logEmbed = embed.info('🔓 Channel Déverrouillé', 
        `**${moderator.tag}** a déverrouillé le channel **#${channel.name}**`
      );

      logEmbed.addFields(
        { name: '👮 Modérateur', value: moderator.tag, inline: true },
        { name: '📊 Channel', value: `#${channel.name}`, inline: true },
        { name: '📝 Raison', value: reason, inline: false }
      );

      logEmbed.setFooter({ text: `ID Modérateur: ${moderator.id}` });
      logEmbed.setTimestamp();

      await logChannel.send({ embeds: [logEmbed] });
    } catch (error) {
      console.error('Erreur lors de l\'envoi du log de unlock:', error);
    }
  },

  /**
   * Traduit les erreurs spécifiques à unlock
   * @param {Error} error 
   * @returns {string}
   */
  getUnlockErrorMessage(error) {
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
      return 'Permissions insuffisantes pour déverrouiller ce channel.';
    }
    
    // Erreur générique
    return 'Impossible de déverrouiller ce channel. Vérifiez mes permissions.';
  }
};

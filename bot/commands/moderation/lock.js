/**
 * COMMANDE LOCK - Verrouiller un channel
 * Retire la permission d'envoyer des messages au rôle @everyone
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
    .setName('lock')
    .setDescription('Verrouiller un channel (empêche les messages)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false)
    .addChannelOption(option => option
      .setName('channel')
      .setDescription('Channel à verrouiller (défaut: channel actuel)')
      .setRequired(false)
      .addChannelTypes(
        ChannelType.GuildText,
        ChannelType.GuildForum,
        ChannelType.GuildAnnouncement
      )
    )
    .addStringOption(option => option
      .setName('raison')
      .setDescription('Raison du verrouillage')
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
    const permCheck = await permissions.fullCheck(interaction, null, 'lock');
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
    const alreadyLocked = currentPerms?.deny.has(PermissionFlagsBits.SendMessages);

    if (alreadyLocked) {
      return interaction.reply({
        embeds: [embed.warning('Déjà verrouillé', `Le channel **${targetChannel.name}** est déjà verrouillé.`)],
        ephemeral: true
      });
    }

    // 5. EXÉCUTION DE L'ACTION
    try {
      await targetChannel.permissionOverwrites.edit(everyoneRole, {
        SendMessages: false
      }, { 
        reason: `Lock par ${moderator.tag}: ${reason}`,
        type: 0 // Role overwrite
      });
      
      // 6. MESSAGE DANS LE CHANNEL VERROUILLÉ
      const lockEmbed = embed.warning(
        '🔒 Channel verrouillé',
        `Ce channel a été verrouillé par **${moderator.tag}**.\n\n**Raison:** ${reason}`
      );

      lockEmbed.addFields(
        { name: '👮 Modérateur', value: moderator.tag, inline: true },
        { name: '⏰ Heure', value: new Date().toLocaleTimeString('fr-FR'), inline: true }
      );

      await targetChannel.send({ embeds: [lockEmbed] });
      
      // 7. RÉPONSE SUCCÈS
      const successEmbed = embed.success(
        '🔒 Channel verrouillé',
        `Le channel **${targetChannel.name}** a été verrouillé avec succès.`
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
          embeds: [embed.success('Fait', 'Channel verrouillé.')],
          ephemeral: true
        });
      }
      
      // 8. LOG DE MODÉRATION
      await this.logLockAction(guild, {
        moderator: moderator,
        channel: targetChannel,
        reason: reason,
        action: 'lock'
      });
      
    } catch (error) {
      console.error('Erreur commande lock:', error);
      
      // 9. GESTION D'ERREUR
      const errorMessage = this.getLockErrorMessage(error);
      
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
   * Envoie un log pour l'action lock
   * @param {Guild} guild 
   * @param {Object} logData 
   */
  async logLockAction(guild, logData) {
    try {
      const { IDS } = require('../../config/constants');
      const logChannelId = IDS.LOGS_CHANNEL;
      
      if (!logChannelId) return; // Pas de channel de logs configuré
      
      const logChannel = await guild.channels.fetch(logChannelId).catch(() => null);
      if (!logChannel) return;

      const { moderator, channel, reason, action } = logData;
      
      const logEmbed = embed.info('🔒 Channel Verrouillé', 
        `**${moderator.tag}** a verrouillé le channel **#${channel.name}**`
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
      console.error('Erreur lors de l\'envoi du log de lock:', error);
    }
  },

  /**
   * Traduit les erreurs spécifiques à lock
   * @param {Error} error 
   * @returns {string}
   */
  getLockErrorMessage(error) {
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
      return 'Permissions insuffisantes pour verrouiller ce channel.';
    }
    
    // Erreur générique
    return 'Impossible de verrouiller ce channel. Vérifiez mes permissions.';
  }
};

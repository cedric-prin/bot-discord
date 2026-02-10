const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embed = require('../../services/embedBuilder');
const validators = require('../../utils/validators');
const sanctionRepo = require('../../../database/js/repositories/sanctionRepo');
const guildRepo = require('../../../database/js/repositories/guildRepo');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Débannir un utilisateur')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false)
    .addStringOption(option => option
      .setName('utilisateur_id')
      .setDescription('L\'ID de l\'utilisateur à débannir')
      .setRequired(true)
      .setAutocomplete(true)
    )
    .addStringOption(option => option
      .setName('raison')
      .setDescription('Raison du débannissement')
      .setRequired(false)
      .setMaxLength(500)
    ),

  cooldown: 5,
  category: 'moderation',

  // Autocomplete pour la liste des bannis
  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused().toLowerCase();

    try {
      const bans = await interaction.guild.bans.fetch();
      const filtered = bans
        .filter(ban => 
          ban.user.tag.toLowerCase().includes(focusedValue) ||
          ban.user.id.includes(focusedValue)
        )
        .first(25);
      
      await interaction.respond(
        filtered.map(ban => ({
          name: `${ban.user.tag} (${ban.user.id})`,
          value: ban.user.id
        }))
      );
    } catch (error) {
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    const userId = interaction.options.getString('utilisateur_id');
    const reason = interaction.options.getString('raison') || 'Aucune raison fournie';
    const { guild, user: moderator } = interaction;

    // Valider l'ID
    if (!validators.isValidSnowflake(userId)) {
      return interaction.reply({
        embeds: [embed.error('ID invalide', 'L\'ID fourni n\'est pas un ID Discord valide.')],
        ephemeral: true
      });
    }

    // Vérifier si l'utilisateur est banni
    const ban = await guild.bans.fetch(userId).catch(() => null);
    if (!ban) {
      return interaction.reply({
        embeds: [embed.error('Non banni', 'Cet utilisateur n\'est pas banni de ce serveur.')],
        ephemeral: true
      });
    }

    try {
      // Débannir
      await guild.members.unban(userId, `${reason} | Par: ${moderator.tag}`);
      
      // Mettre à jour la sanction en BDD (marquer comme révoquée)
      await sanctionRepo.revokeActiveBan(guild.id, userId, moderator.id, reason);
      
      // Réponse succès
      const successEmbed = embed.success(
        'Utilisateur débanni',
        `**${ban.user.tag}** a été débanni du serveur.` 
      ).addFields(
        { name: '📝 Raison', value: reason }
      );
      
      await interaction.reply({ embeds: [successEmbed] });
      
      // Log modération
      const logEmbed = embed.modLog({
        action: 'unban',
        moderator: moderator,
        target: ban.user,
        reason: reason,
        caseId: '-'
      });
      
      const guildSettings = await guildRepo.getSettings(guild.id);
      if (guildSettings?.logChannelId) {
        const logChannel = guild.channels.cache.get(guildSettings.logChannelId);
        if (logChannel) {
          await logChannel.send({ embeds: [logEmbed] });
        }
      }
      
      logger.info(`[UNBAN] ${moderator.tag} a débanni ${ban.user.tag} sur ${guild.name}`);
      
    } catch (error) {
      logger.error('Erreur commande unban:', error);
      
      await interaction.reply({
        embeds: [embed.error('Erreur', 'Une erreur est survenue lors du débannissement.')],
        ephemeral: true
      });
    }
  }
};

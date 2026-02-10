const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embed = require('../../services/embedBuilder');
const permissions = require('../../services/permissions');
const sanctionRepo = require('../../../database/js/repositories/sanctionRepo');
const modLogger = require('../../services/modLogger');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unmute')
    .setDescription("Retirer le mute d'un membre")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addUserOption((option) =>
      option
        .setName('utilisateur')
        .setDescription('Le membre à unmute')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('raison')
        .setDescription('Raison du unmute')
        .setRequired(false)
        .setMaxLength(500)
    ),

  cooldown: 3,
  category: 'moderation',

  async execute(interaction) {
    const target = interaction.options.getUser('utilisateur');
    const reason = interaction.options.getString('raison') || 'Aucune raison fournie';
    const { guild, member: moderatorMember, user: moderatorUser } = interaction;

    // Vérifications de permissions complètes (hiérarchie, perms bot, etc.)
    const permCheck = await permissions.fullCheck(interaction, target, 'unmute');
    if (!permCheck.allowed) {
      return interaction.reply({
        embeds: [embed.error('Permission refusée', permCheck.reason)],
        ephemeral: true,
      });
    }

    // Récupérer le membre cible
    const targetMember = await guild.members.fetch(target.id).catch(() => null);
    if (!targetMember) {
      return interaction.reply({
        embeds: [embed.error('Erreur', "Ce membre n'est pas sur le serveur.")],
        ephemeral: true,
      });
    }

    // Vérifier si le membre est actuellement mute (timeout actif)
    if (!targetMember.isCommunicationDisabled()) {
      return interaction.reply({
        embeds: [embed.warning('Non muet', "Ce membre n'est pas actuellement mute.")],
        ephemeral: true,
      });
    }

    try {
      // Retirer le timeout (unmute)
      await targetMember.timeout(null, `${reason} | Par: ${moderatorUser.tag}`);

      // Mettre à jour la/les sanctions de mute en BDD et enregistrer un "unmute"
      await sanctionRepo.revokeActiveMute(guild.id, target.id, moderatorMember.id, reason);

      // Réponse succès
      const successEmbed = embed
        .success('Mute retiré', `**${target.tag}** peut à nouveau parler.`)
        .addFields({ name: '📝 Raison', value: reason });

      await interaction.reply({ embeds: [successEmbed] });

      // Log modération centralisé
      await modLogger.logAction(guild, {
        action: 'unmute',
        moderator: moderatorUser,
        target: target,
        reason,
        caseId: '-', // l'unmute est lié aux mutes révoqués
      });

      logger.info(`[UNMUTE] ${moderatorUser.tag} a unmute ${target.tag} sur ${guild.name}`);
    } catch (error) {
      logger.error('Erreur commande unmute:', error);

      const errorEmbed = embed.error(
        'Erreur',
        "Une erreur est survenue lors du unmute. Veuillez réessayer plus tard."
      );

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }
    }
  },
};


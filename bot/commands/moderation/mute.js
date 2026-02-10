const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embed = require('../../services/embedBuilder');
const permissions = require('../../services/permissions');
const validators = require('../../utils/validators');
const sanctionRepo = require('../../database/js/repositories/sanctionRepo');
const userRepo = require('../../database/js/repositories/userRepo');
const guildRepo = require('../../database/js/repositories/guildRepo');
const modLogger = require('../../services/modLogger');
const logger = require('../../utils/logger');

// Discord limite le timeout à 28 jours
const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Rendre muet un membre (timeout)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addUserOption((option) =>
      option
        .setName('utilisateur')
        .setDescription('Le membre à rendre muet')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('durée')
        .setDescription('Durée du mute (ex: 1h, 30m, 1d) - max 28 jours')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('raison')
        .setDescription('Raison du mute')
        .setRequired(false)
        .setMaxLength(500)
    ),

  cooldown: 5,
  category: 'moderation',

  async execute(interaction) {
    const target = interaction.options.getUser('utilisateur');
    const durationInput = interaction.options.getString('durée');
    const reason = interaction.options.getString('raison') || 'Aucune raison fournie';
    const { guild, member: moderatorMember, user: moderatorUser } = interaction;

    // Vérification permissions complètes (command perms + hiérarchie + bot)
    const permCheck = await permissions.fullCheck(interaction, target, 'mute');
    if (!permCheck.allowed) {
      return interaction.reply({
        embeds: [embed.error('Permission refusée', permCheck.reason)],
        ephemeral: true,
      });
    }

    // Valider la durée (min 1 minute, max 28 jours)
    const durationCheck = validators.validateDuration(durationInput, 60_000, MAX_TIMEOUT_MS);

    if (!durationCheck.valid) {
      return interaction.reply({
        embeds: [embed.error('Durée invalide', durationCheck.error)],
        ephemeral: true,
      });
    }

    const durationMs = durationCheck.value;
    const expiresAt = durationCheck.expiresAt;
    const durationFormatted = durationCheck.formatted;

    // Récupérer le membre cible
    const targetMember = await guild.members.fetch(target.id).catch(() => null);
    if (!targetMember) {
      return interaction.reply({
        embeds: [embed.error('Erreur', "Ce membre n'est pas sur le serveur.")],
        ephemeral: true,
      });
    }

    // Vérifier si déjà mute
    if (targetMember.isCommunicationDisabled()) {
      const currentTimeout = targetMember.communicationDisabledUntil;
      return interaction.reply({
        embeds: [
          embed.warning(
            'Déjà muet',
            `Ce membre est déjà mute jusqu'au <t:${Math.floor(
              currentTimeout.getTime() / 1000
            )}:F>`
          ),
        ],
        ephemeral: true,
      });
    }

    try {
      // Envoyer MP avant mute
      const dmEmbed = embed.warning(
        'Vous avez été rendu muet',
        `**Serveur:** ${guild.name}\n**Raison:** ${reason}\n**Durée:** ${durationFormatted}\n**Modérateur:** ${moderatorUser.tag}`
      );

      await target.send({ embeds: [dmEmbed] }).catch(() => {
        logger.debug?.(`Impossible d'envoyer un MP à ${target.tag}`);
      });

      // Appliquer le timeout (Discord attend des millisecondes)
      await targetMember.timeout(durationMs, `${reason} | Par: ${moderatorUser.tag}`);

      // S'assurer que les entrées existent en BDD
      await guildRepo.findOrCreate(guild.id, guild.name);
      await userRepo.findOrCreate(target.id, guild.id, target.tag);
      await userRepo.findOrCreate(moderatorUser.id, guild.id, moderatorUser.tag);

      // Enregistrer la sanction (duration en secondes pour la BDD)
      const durationSeconds = Math.floor(durationMs / 1000);
      const sanction = await sanctionRepo.create({
        guildId: guild.id,
        userId: target.id,
        moderatorId: moderatorUser.id,
        type: 'mute',
        reason,
        duration: durationSeconds,
        expiresAt,
      });

      // Réponse succès
      const successEmbed = embed
        .success('Membre rendu muet', `**${target.tag}** a été mute.`)
        .addFields(
          { name: '📝 Raison', value: reason },
          { name: '⏱️ Durée', value: durationFormatted, inline: true },
          { name: '🔢 Case', value: `#${sanction.id}`, inline: true },
          {
            name: '📅 Expire le',
            value: `<t:${Math.floor(expiresAt.getTime() / 1000)}:F>`,
          }
        );

      await interaction.reply({ embeds: [successEmbed] });

      // Log modération via service centralisé
      await modLogger.logAction(guild, {
        action: 'mute',
        moderator: moderatorUser,
        target: target,
        reason,
        duration: durationFormatted,
        caseId: sanction.id,
      });

      logger.info(
        `[MUTE] ${moderatorUser.tag} a mute ${target.tag} pour ${durationFormatted} sur ${guild.name}`
      );
    } catch (error) {
      logger.error('Erreur commande mute:', error);

      if (error.code === 50013) {
        return interaction.reply({
          embeds: [
            embed.error(
              'Permission manquante',
              "Je n'ai pas la permission de mute ce membre."
            ),
          ],
          ephemeral: true,
        });
      }

      const errorEmbed = embed.error(
        'Erreur',
        'Une erreur est survenue lors du mute. Veuillez réessayer plus tard.'
      );

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }
    }
  },
};


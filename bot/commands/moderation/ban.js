const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embed = require('../../services/embedBuilder');
const permissions = require('../../services/permissions');
const validators = require('../../utils/validators');
const timeParser = require('../../utils/timeParser');
const sanctionRepo = require('../../../database/js/repositories/sanctionRepo');
const userRepo = require('../../../database/js/repositories/userRepo');
const guildRepo = require('../../../database/js/repositories/guildRepo');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bannir un membre du serveur')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false)
    .addUserOption(option => option
      .setName('utilisateur')
      .setDescription('Le membre à bannir')
      .setRequired(true)
    )
    .addStringOption(option => option
      .setName('durée')
      .setDescription('Durée du ban (ex: 7d, 1w) - permanent si vide')
      .setRequired(false)
    )
    .addStringOption(option => option
      .setName('raison')
      .setDescription('Raison du bannissement')
      .setRequired(false)
      .setMaxLength(500)
    )
    .addIntegerOption(option => option
      .setName('supprimer_messages')
      .setDescription('Nombre de jours de messages à supprimer')
      .setRequired(false)
      .setMinValue(0)
      .setMaxValue(7)
    ),

  cooldown: 5,
  category: 'moderation',

  async execute(interaction) {
    const target = interaction.options.getUser('utilisateur');
    const durationInput = interaction.options.getString('durée');
    const reason = interaction.options.getString('raison') || 'Aucune raison fournie';
    const deleteMessages = interaction.options.getInteger('supprimer_messages') || 0;
    const { guild, user: moderator } = interaction;

    // Vérification permissions
    const permCheck = await permissions.fullCheck(interaction, target, 'ban');
    if (!permCheck.allowed) {
      return interaction.reply({
        embeds: [embed.error('Permission refusée', permCheck.reason)],
        ephemeral: true
      });
    }

    // Valider la durée si fournie
    let duration = null;
    let expiresAt = null;
    let durationFormatted = 'Permanent';

    if (durationInput) {
      const durationCheck = validators.validateDuration(
        durationInput,
        60000,           // Min: 1 minute
        31536000000      // Max: 1 an
      );
      
      if (!durationCheck.valid) {
        return interaction.reply({
          embeds: [embed.error('Durée invalide', durationCheck.error)],
          ephemeral: true
        });
      }
      
      duration = durationCheck.value;
      expiresAt = durationCheck.expiresAt;
      durationFormatted = durationCheck.formatted;
    }

    // Vérifier si déjà banni
    const existingBan = await guild.bans.fetch(target.id).catch(() => null);
    if (existingBan) {
      return interaction.reply({
        embeds: [embed.error('Déjà banni', 'Cet utilisateur est déjà banni du serveur.')],
        ephemeral: true
      });
    }

    try {
      // Envoyer MP avant ban
      const dmEmbed = embed.error(
        'Vous avez été banni',
        `**Serveur:** ${guild.name}\n**Raison:** ${reason}\n**Durée:** ${durationFormatted}\n**Modérateur:** ${moderator.tag}` 
      );
      
      await target.send({ embeds: [dmEmbed] }).catch(() => {
        logger.debug(`Impossible d'envoyer un MP à ${target.tag}`);
      });
      
      // Exécuter le ban
      await guild.members.ban(target, {
        reason: `${reason} | Par: ${moderator.tag}`,
        deleteMessageSeconds: deleteMessages * 24 * 60 * 60
      });
      
      // S'assurer que les entrées existent en BDD
      await guildRepo.findOrCreate(guild.id, guild.name);
      await userRepo.findOrCreate(target.id, target.tag);
      await userRepo.findOrCreate(moderator.id, moderator.tag);
      
      // Enregistrer la sanction
      const sanction = await sanctionRepo.create({
        guildId: guild.id,
        userId: target.id,
        moderatorId: moderator.id,
        type: 'ban',
        reason: reason,
        duration: duration,
        expiresAt: expiresAt
      });
      
      // Log de la sanction pour débogage
      logger.info(`[BAN] Sanction créée: ID=${sanction.id}, User=${target.tag}, Mod=${moderator.tag}, Duration=${durationFormatted}`);
      
      // Réponse succès
      const successEmbed = embed.success(
        'Membre banni',
        `**${target.tag}** a été banni du serveur.` 
      ).addFields(
        { name: '📝 Raison', value: reason },
        { name: '⏱️ Durée', value: durationFormatted, inline: true },
        { name: '🔢 Case', value: `#${sanction.id}`, inline: true }
      );
      
      if (expiresAt) {
        successEmbed.addFields({
          name: '📅 Expire le',
          value: `<t:${Math.floor(expiresAt.getTime() / 1000)}:F>`,
          inline: true
        });
      }
      
      await interaction.reply({ embeds: [successEmbed] });
      
      // Log modération
      const logEmbed = embed.modLog({
        action: 'ban',
        moderator: moderator,
        target: target,
        reason: reason,
        duration: durationFormatted,
        caseId: sanction.id
      });
      
      const guildSettings = await guildRepo.getSettings(guild.id);
      if (guildSettings?.logChannelId) {
        const logChannel = guild.channels.cache.get(guildSettings.logChannelId);
        if (logChannel) {
          await logChannel.send({ embeds: [logEmbed] });
        }
      }
      
      logger.info(`[BAN] ${moderator.tag} a banni ${target.tag} sur ${guild.name} (${durationFormatted})`);
      
    } catch (error) {
      logger.error('Erreur commande ban:', error);
      
      await interaction.reply({
        embeds: [embed.error('Erreur', 'Une erreur est survenue lors du bannissement.')],
        ephemeral: true
      });
    }
  }
};

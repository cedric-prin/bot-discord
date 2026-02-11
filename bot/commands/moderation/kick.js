const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embed = require('../../services/embedBuilder');
const permissions = require('../../services/permissions');
const sanctionRepo = require('../../../database/js/repositories/sanctionRepo');
const userRepo = require('../../../database/js/repositories/userRepo');
const guildRepo = require('../../../database/js/repositories/guildRepo');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Expulser un membre du serveur')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .setDMPermission(false)
    .addUserOption(option => option
      .setName('utilisateur')
      .setDescription('Le membre à expulser')
      .setRequired(true)
    )
    .addStringOption(option => option
      .setName('raison')
      .setDescription('Raison de l\'expulsion')
      .setRequired(false)
      .setMaxLength(500)
    ),

  cooldown: 5,
  category: 'moderation',

  async execute(interaction) {
    const target = interaction.options.getUser('utilisateur');
    const reason = interaction.options.getString('raison') || 'Aucune raison fournie';
    const { guild, user: moderator } = interaction;

    // Vérification permissions
    const permCheck = await permissions.fullCheck(interaction, target, 'kick');
    if (!permCheck.allowed) {
      return interaction.reply({
        embeds: [embed.error('Permission refusée', permCheck.reason)],
        ephemeral: true
      });
    }

    // Récupérer le membre
    const targetMember = await guild.members.fetch(target.id).catch(() => null);
    if (!targetMember) {
      return interaction.reply({
        embeds: [embed.error('Erreur', 'Ce membre n\'est pas sur le serveur.')],
        ephemeral: true
      });
    }

    // Vérifier que le membre est kickable
    if (!targetMember.kickable) {
      return interaction.reply({
        embeds: [embed.error('Impossible', 'Je ne peux pas expulser ce membre.')],
        ephemeral: true
      });
    }

    try {
      // Envoyer MP avant kick
      const dmEmbed = embed.warning(
        'Vous avez été expulsé',
        `**Serveur:** ${guild.name}\n**Raison:** ${reason}\n**Modérateur:** ${moderator.tag}` 
      );
      
      await target.send({ embeds: [dmEmbed] }).catch(() => {
        logger.debug(`Impossible d'envoyer un MP à ${target.tag}`);
      });
      
      // Exécuter le kick
      await targetMember.kick(reason);
      
      // S'assurer que les entrées existent en BDD
      await guildRepo.findOrCreate(guild.id, guild.name);
      await userRepo.findOrCreate(target.id, target.tag);
      await userRepo.findOrCreate(moderator.id, moderator.tag);
      
      // Enregistrer la sanction
      const sanction = await sanctionRepo.create({
        guildId: guild.id,
        userId: target.id,
        moderatorId: moderator.id,
        type: 'kick',
        reason: reason,
        duration: null,
        expiresAt: null
      });
      
      // Log de la sanction pour débogage
      logger.info(`[KICK] Sanction créée: ID=${sanction.id}, User=${target.tag}, Mod=${moderator.tag}`);
      
      // Réponse succès
      const successEmbed = embed.success(
        'Membre expulsé',
        `**${target.tag}** a été expulsé du serveur.` 
      ).addFields(
        { name: '📝 Raison', value: reason },
        { name: '🔢 Case', value: `#${sanction.id}`, inline: true }
      );
      
      await interaction.reply({ embeds: [successEmbed] });
      
      // Log modération
      const logEmbed = embed.modLog({
        action: 'kick',
        moderator: moderator,
        target: target,
        reason: reason,
        caseId: sanction.id
      });
      
      const guildSettings = await guildRepo.getSettings(guild.id);
      if (guildSettings?.logChannelId) {
        const logChannel = guild.channels.cache.get(guildSettings.logChannelId);
        if (logChannel) {
          await logChannel.send({ embeds: [logEmbed] });
        }
      }
      
      logger.info(`[KICK] ${moderator.tag} a kick ${target.tag} sur ${guild.name}`);
      
    } catch (error) {
      logger.error('Erreur commande kick:', error);
      
      await interaction.reply({
        embeds: [embed.error('Erreur', 'Une erreur est survenue lors de l\'expulsion.')],
        ephemeral: true
      });
    }
  }
};

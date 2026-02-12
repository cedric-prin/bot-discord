const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const embed = require('../../services/embedBuilder');
const badwordsRepo = require('../../../database/js/repositories/badwordsRepo');
const automodRepo = require('../../../database/js/repositories/automodRepo');
const automodManager = require('../../services/automod/automodManager');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('automod')
    .setDescription('Configurer l\'AutoMod')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)

    // Sous-commande: enable
    .addSubcommand(sub =>
      sub.setName('enable')
        .setDescription('Activer l\'AutoMod')
    )

    // Sous-commande: disable
    .addSubcommand(sub =>
      sub.setName('disable')
        .setDescription('Désactiver l\'AutoMod')
    )

    // Sous-commande: status
    .addSubcommand(sub =>
      sub.setName('status')
        .setDescription('Voir le statut de l\'AutoMod')
    )

    // Sous-commande: badwords
    .addSubcommandGroup(group =>
      group.setName('badwords')
        .setDescription('Gérer les mots interdits')
        .addSubcommand(sub =>
          sub.setName('add')
            .setDescription('Ajouter un mot interdit')
            .addStringOption(opt =>
              opt.setName('word')
                .setDescription('Le mot à interdire')
                .setRequired(true)
            )
        )
        .addSubcommand(sub =>
          sub.setName('remove')
            .setDescription('Retirer un mot interdit')
            .addStringOption(opt =>
              opt.setName('word')
                .setDescription('Le mot à retirer')
                .setRequired(true)
            )
        )
        .addSubcommand(sub =>
          sub.setName('list')
            .setDescription('Voir les mots interdits')
        )
    ),

  cooldown: 5,
  category: 'admin',

  async execute(interaction) {
    const { guild } = interaction;
    const subcommand = interaction.options.getSubcommand();
    const subcommandGroup = interaction.options.getSubcommandGroup();

    try {
      // Récupérer config AutoMod depuis la nouvelle table
      const automod = await automodRepo.getGuildAutomod(guild.id);

      // Gérer les groupes de sous-commandes
      if (subcommandGroup === 'badwords') {
        return handleBadwords(interaction, subcommand, automod, guild);
      }

      // Sous-commandes simples
      switch (subcommand) {
        case 'enable':
          await automodRepo.toggleAutomod(guild.id, true);
          automodManager.clearCache(guild.id);

          return interaction.reply({
            embeds: [embed.success('AutoMod activé', 'L\'AutoMod est maintenant actif sur ce serveur.')]
          });

        case 'disable':
          await automodRepo.toggleAutomod(guild.id, false);
          automodManager.clearCache(guild.id);

          return interaction.reply({
            embeds: [embed.success('AutoMod désactivé', 'L\'AutoMod est maintenant inactif.')]
          });

        case 'status':
          return showStatus(interaction, automod, guild);

        default:
          return interaction.reply({
            embeds: [embed.error('Erreur', 'Sous-commande non reconnue.')],
            flags: [64]
          });
      }

    } catch (error) {
      logger.error('Erreur commande automod:', error);
      return interaction.reply({
        embeds: [embed.error('Erreur', 'Une erreur est survenue.')],
        flags: [64]
      });
    }
  }
};

async function showStatus(interaction, automod, guild) {
  // Utiliser la colonne badwords_count de la table automod avec fallback
  const badwordsCount = automod.badwords_count !== undefined ? automod.badwords_count : 0;

  // Calculer les filtres actifs
  const activeFilters = Object.keys(automod)
    .filter(key => key !== 'enabled' && key !== 'exemptRoles' && key !== 'exemptChannels' && key !== 'badwords_count' && automod[key]?.enabled)
    .length;

  const statusEmbed = embed.info('📊 Statut AutoMod', null)
    .addFields(
      { name: '🟢 Actif', value: automod.enabled ? 'Oui' : 'Non', inline: true },
      { name: '🛡️ Filtres actifs', value: activeFilters.toString(), inline: true },
      { name: '🚫 Mots bannis', value: badwordsCount.toString(), inline: true }
    );

  return interaction.reply({
    embeds: [statusEmbed],
    flags: [64] // Ephemeral pour éviter les spam
  });
}

async function handleBadwords(interaction, subcommand, automod, guild) {
  switch (subcommand) {
    case 'list':
      try {
        const words = await badwordsRepo.getGuildBadwords(guild.id);

        if (words.length === 0) {
          return interaction.reply({
            embeds: [embed.info('🚫 Mots interdits', 'Aucun mot configuré.')],
            flags: [64]
          });
        }

        // Masquer partiellement les mots
        const maskedWords = words.map(w => {
          if (w.length <= 2) return '**';
          return w[0] + '*'.repeat(w.length - 2) + w[w.length - 1];
        });

        return interaction.reply({
          embeds: [embed.info(
            '🚫 Mots interdits',
            `${words.length} mot(s) configuré(s)\n\`\`\`${maskedWords.join(', ')}\`\`\``
          )],
          flags: [64]
        });
      } catch (error) {
        logger.error('Erreur listing badwords:', error);
        return interaction.reply({
          embeds: [embed.error('Erreur', 'Impossible de récupérer la liste des mots interdits.')],
          flags: [64]
        });
      }

    case 'add':
      try {
        const word = interaction.options.getString('word').toLowerCase().trim();

        if (!word || word.length < 1) {
          return interaction.reply({
            embeds: [embed.error('Erreur', 'Le mot spécifié est invalide.')],
            flags: [64]
          });
        }

        const result = await badwordsRepo.addBadword(guild.id, word, interaction.user.id);

        if (result.exists) {
          return interaction.reply({
            embeds: [embed.warning('Déjà présent', 'Ce mot est déjà dans la liste.')],
            flags: [64]
          });
        }

        await automodRepo.updateBadwordsCount(guild.id);
        automodManager.clearCache(guild.id);

        const count = await badwordsRepo.getBadwordsCount(guild.id);
        return interaction.reply({
          embeds: [embed.success('Mot ajouté', `Le mot a été ajouté à la liste (${count} total).`)],
          flags: [64]
        });
      }
      catch (error) {
        logger.error('Erreur ajout badword:', error);
        return interaction.reply({
          embeds: [embed.error('Erreur', 'Impossible d\'ajouter le mot.')],
          flags: [64]
        });
      }

    case 'remove':
      try {
        const word = interaction.options.getString('word').toLowerCase().trim();

        const removed = await badwordsRepo.removeBadword(guild.id, word);

        if (!removed) {
          return interaction.reply({
            embeds: [embed.warning('Non trouvé', 'Ce mot n\'est pas dans la liste.')],
            flags: [64]
          });
        }

        // Désactiver le filtre badwords si plus de mots
        const count = await badwordsRepo.getBadwordsCount(guild.id);
        if (count === 0 && automod.badwords) {
          automod.badwords.enabled = false;
          await automodRepo.updateGuildAutomod(guild.id, automod);
        }

        await automodRepo.updateBadwordsCount(guild.id);
        automodManager.clearCache(guild.id);

        return interaction.reply({
          embeds: [embed.success('Mot retiré', 'Le mot a été retiré de la liste.')],
          flags: [64]
        });
      } catch (error) {
        logger.error('Erreur retrait badword:', error);
        return interaction.reply({
          embeds: [embed.error('Erreur', 'Impossible de retirer le mot.')],
          flags: [64]
        });
      }
  }
}
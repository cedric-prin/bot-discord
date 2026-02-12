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
        .setDescription('Activer AutoMod')
    )
    .addSubcommand(sub =>
      sub.setName('disable')
        .setDescription('Désactiver AutoMod')
    )
    .addSubcommand(sub =>
      sub.setName('status')
        .setDescription('Voir le statut AutoMod')
    )
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
    )
    .addSubcommand(sub =>
      sub.setName('config')
        .setDescription('Configurer les filtres AutoMod')
        .addStringOption(opt =>
          opt.setName('filter')
            .setDescription('Type de filtre à configurer')
            .setRequired(true)
            .addChoices(
              { name: '🚫 Mots interdits', value: 'badwords' },
              { name: '📢 Spam', value: 'spam' },
              { name: '🔗 Invitations', value: 'invites' },
              { name: '🔗 Liens', value: 'links' },
              { name: '🔤 Majuscules', value: 'caps' },
              { name: '👤 Mentions', value: 'mentions' },
              { name: '🛡️ Anti-raid', value: 'antiraid' }
            )
        )
        .addStringOption(opt =>
          opt.setName('action')
            .setDescription('Action à effectuer')
            .setRequired(true)
            .addChoices(
              { name: '❌ Supprimer', value: 'delete' },
              { name: '⚠️ Avertir', value: 'warn' },
              { name: '🔇 Muter 1h', value: 'mute' },
              { name: '👢 Expulser', value: 'kick' },
              { name: '🔨 Bannir', value: 'ban' },
              { name: '🔒 Verrouiller', value: 'lockdown' }
            )
        )
    ),

  cooldown: 5,
  category: 'admin',

  async execute(interaction) {
    const { guild } = interaction;
    const subcommand = interaction.options.getSubcommand();
    const subcommandGroup = interaction.options.getSubcommandGroup();

    logger.info(`Commande automod2 exécutée: subcommand=${subcommand}, subcommandGroup=${subcommandGroup}`);

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
          await automodRepo.updateGuildAutomod(guild.id, {
            enabled: true,
            badwords_enabled: true,
            spam_enabled: true,
            invites_enabled: true,
            links_enabled: false,
            caps_enabled: true,
            mentions_enabled: true,
            antiraid_enabled: true
          });
          automodManager.clearCache(guild.id);

          return interaction.reply({
            embeds: [embed.success('AutoMod activé', 'L\'AutoMod est maintenant actif sur ce serveur.')]
          });

        case 'disable':
          await automodRepo.updateGuildAutomod(guild.id, {
            enabled: false,
            badwords_enabled: false,
            spam_enabled: false,
            invites_enabled: false,
            links_enabled: false,
            caps_enabled: false,
            mentions_enabled: false,
            antiraid_enabled: false
          });
          automodManager.clearCache(guild.id);

          return interaction.reply({
            embeds: [embed.success('AutoMod désactivé', 'L\'AutoMod est maintenant inactif.')]
          });

        case 'status':
          return showStatus(interaction, automod, guild);

        case 'config':
          logger.info('Appel de handleConfig');
          return handleConfig(interaction, automod, guild);

        default:
          logger.error(`Sous-commande non reconnue: ${subcommand}`);
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
  try {
    // Récupérer le vrai nombre de mots bannis depuis la base de données
    const badwordsCount = await badwordsRepo.getBadwordsCount(guild.id);

    // Calculer les filtres actifs correctement
    const activeFilters = [
      { key: 'badwords_enabled', name: 'Mots interdits', value: automod.badwords_enabled },
      { key: 'spam_enabled', name: 'Anti-spam', value: automod.spam_enabled },
      { key: 'invites_enabled', name: 'Invitations', value: automod.invites_enabled },
      { key: 'links_enabled', name: 'Liens', value: automod.links_enabled },
      { key: 'caps_enabled', name: 'Majuscules', value: automod.caps_enabled },
      { key: 'mentions_enabled', name: 'Mentions', value: automod.mentions_enabled },
      { key: 'antiraid_enabled', name: 'Anti-raid', value: automod.antiraid_enabled }
    ].filter(filter => filter.value === true || filter.value === 1).length;

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
  } catch (error) {
    logger.error('Erreur showStatus:', error);
    return interaction.reply({
      embeds: [embed.error('Erreur', 'Impossible de récupérer le statut AutoMod.')],
      flags: [64]
    });
  }
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

async function handleConfig(interaction, automod, guild) {
  const filter = interaction.options.getString('filter');
  const action = interaction.options.getString('action');

  logger.info(`handleConfig appelé: filter=${filter}, action=${action}`);

  try {
    // Vérifier si le filtre existe
    const filterConfig = automod[`${filter}_enabled`] !== undefined;
    if (!filterConfig) {
      logger.error(`Filtre invalide: ${filter}`);
      return interaction.reply({
        embeds: [embed.error('Filtre invalide', `Le filtre \`${filter}\` n'existe pas.`)],
        flags: [64]
      });
    }

    // Activer le filtre si nécessaire
    if (!automod[`${filter}_enabled`]) {
      automod[`${filter}_enabled`] = true;
    }

    // Mettre à jour l'action
    automod[`${filter}_action`] = action;

    // Activer AutoMod globalement s'il est désactivé
    if (!automod.enabled) {
      automod.enabled = true;
    }

    logger.info(`Mise à jour de la configuration: ${filter}_action = ${action}`);

    // Sauvegarder la configuration
    await automodRepo.updateGuildAutomod(guild.id, automod);
    automodManager.clearCache(guild.id);

    // Afficher les détails de la configuration
    const actionNames = {
      'delete': '❌ Supprimer',
      'warn': '⚠️ Avertir',
      'mute': '🔇 Muter 1h',
      'kick': '👢 Expulser',
      'ban': '🔨 Bannir',
      'lockdown': '🔒 Verrouiller'
    };

    const filterNames = {
      'badwords': '🚫 Mots interdits',
      'spam': '📢 Spam',
      'invites': '🔗 Invitations',
      'links': '🔗 Liens',
      'caps': '🔤 Majuscules',
      'mentions': '👤 Mentions',
      'antiraid': '🛡️ Anti-raid'
    };

    logger.info(`Configuration mise à jour avec succès`);

    return interaction.reply({
      embeds: [embed.success(
        'Configuration mise à jour',
        `**${filterNames[filter]}**\nAction: ${actionNames[action]}\n\n⚠️ Les sanctions progressives (3 avertissements = mute 1h, 5 mutes = kick, 10 violations = ban) s\'appliqueront automatiquement.`
      )],
      flags: [64]
    });

  } catch (error) {
    logger.error('Erreur configuration AutoMod:', error);
    return interaction.reply({
      embeds: [embed.error('Erreur', 'Impossible de mettre à jour la configuration.')],
      flags: [64]
    });
  }
}

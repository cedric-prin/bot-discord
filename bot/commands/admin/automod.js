const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const embed = require('../../services/embedBuilder');
const guildRepo = require('../../../database/js/repositories/guildRepo');
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

    // Sous-commande: config
    .addSubcommand(sub =>
      sub.setName('config')
        .setDescription('Configurer un filtre')
        .addStringOption(opt =>
          opt.setName('filter')
            .setDescription('Le filtre à configurer')
            .setRequired(true)
            .addChoices(
              { name: 'Spam', value: 'spam' },
              { name: 'Invitations', value: 'invites' },
              { name: 'Mots interdits', value: 'badwords' },
              { name: 'Liens', value: 'links' },
              { name: 'Majuscules', value: 'caps' },
              { name: 'Mentions', value: 'mentions' },
              { name: 'Anti-Raid', value: 'antiraid' }
            )
        )
        .addStringOption(opt =>
          opt.setName('setting')
            .setDescription('Le paramètre à modifier')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('value')
            .setDescription('La nouvelle valeur')
            .setRequired(true)
        )
    )

    // Sous-commande: exempt
    .addSubcommandGroup(group =>
      group.setName('exempt')
        .setDescription('Gérer les exemptions')
        .addSubcommand(sub =>
          sub.setName('add')
            .setDescription('Ajouter une exemption')
            .addRoleOption(opt =>
              opt.setName('role')
                .setDescription('Rôle à exempter')
            )
            .addChannelOption(opt =>
              opt.setName('channel')
                .setDescription('Channel à exempter')
                .addChannelTypes(ChannelType.GuildText)
            )
        )
        .addSubcommand(sub =>
          sub.setName('remove')
            .setDescription('Retirer une exemption')
            .addRoleOption(opt =>
              opt.setName('role')
                .setDescription('Rôle à retirer')
            )
            .addChannelOption(opt =>
              opt.setName('channel')
                .setDescription('Channel à retirer')
                .addChannelTypes(ChannelType.GuildText)
            )
        )
        .addSubcommand(sub =>
          sub.setName('list')
            .setDescription('Voir les exemptions')
        )
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
      // Récupérer config actuelle
      let settings = await guildRepo.getSettings(guild.id);
      if (!settings) {
        settings = { automod: getDefaultConfig() };
      } else if (!settings.automod) {
        settings.automod = getDefaultConfig();
      }

      const automod = settings.automod;

      // Gérer les groupes de sous-commandes
      if (subcommandGroup === 'exempt') {
        return handleExempt(interaction, subcommand, automod, guild);
      }

      if (subcommandGroup === 'badwords') {
        return handleBadwords(interaction, subcommand, automod, guild);
      }

      // Sous-commandes simples
      switch (subcommand) {
        case 'enable':
          automod.enabled = true;
          await guildRepo.updateSettings(guild.id, { automod });
          automodManager.clearCache(guild.id);

          return interaction.reply({
            embeds: [embed.success('AutoMod activé', 'L\'AutoMod est maintenant actif sur ce serveur.')]
          });

        case 'disable':
          automod.enabled = false;
          await guildRepo.updateSettings(guild.id, { automod });
          automodManager.clearCache(guild.id);

          return interaction.reply({
            embeds: [embed.success('AutoMod désactivé', 'L\'AutoMod est maintenant inactif.')]
          });

        case 'status':
          return showStatus(interaction, automod, guild);

        case 'config':
          return handleConfig(interaction, automod, guild);
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

/**
 * Config par défaut
 */
function getDefaultConfig() {
  return {
    enabled: false,
    exemptRoles: [],
    exemptChannels: [],
    spam: {
      enabled: true,
      maxMessages: 5,
      timeWindow: 5000,
      maxDuplicates: 3,
      action: 'delete'
    },
    invites: {
      enabled: true,
      allowOwnServer: true,
      action: 'delete'
    },
    badwords: {
      enabled: false,
      words: [],
      action: 'delete'
    },
    links: {
      enabled: false,
      blockAll: false,
      action: 'delete'
    },
    caps: {
      enabled: true,
      maxPercentage: 70,
      minLength: 10,
      action: 'delete'
    },
    mentions: {
      enabled: true,
      maxUserMentions: 5,
      maxRoleMentions: 3,
      action: 'delete'
    },
    antiraid: {
      enabled: true,
      joinThreshold: 10,
      joinWindow: 10000,
      accountAge: 7,
      action: 'lockdown'
    }
  };
}

async function showStatus(interaction, automod, guild) {
  const stats = automodManager.getStats(guild.id);

  const statusEmbed = embed.info('📊 Statut AutoMod', '')
    .addFields(
      { name: '🟢 Actif', value: automod.enabled ? 'Oui' : 'Non', inline: true },
      { name: '🛡️ Filtres actifs', value: Object.keys(automod).filter(key => key !== 'enabled' && automod[key]?.enabled).length.toString(), inline: true },
      { name: '📈 Messages bloqués', value: stats.blocked || '0', inline: true }
    );

  return interaction.reply({ embeds: [statusEmbed] });
}

/**
 * Gérer la configuration d'un filtre
 */
async function handleConfig(interaction, automod, guild) {
  const filter = interaction.options.getString('filter');
  const setting = interaction.options.getString('setting');
  const value = interaction.options.getString('value');

  // Vérifier que le filtre existe
  if (!automod[filter]) {
    automod[filter] = {};
  }

  // Paramètres valides par filtre
  const validSettings = {
    spam: ['enabled', 'maxMessages', 'timeWindow', 'maxDuplicates', 'action'],
    invites: ['enabled', 'allowOwnServer', 'action'],
    badwords: ['enabled', 'detectLeet', 'wholeWordOnly', 'action'],
    links: ['enabled', 'blockAll', 'action'],
    caps: ['enabled', 'maxPercentage', 'minLength', 'action'],
    mentions: ['enabled', 'maxUserMentions', 'maxRoleMentions', 'blockEveryone', 'action'],
    antiraid: ['enabled', 'joinThreshold', 'joinWindow', 'accountAge', 'action']
  };

  if (!validSettings[filter]?.includes(setting)) {
    const available = validSettings[filter]?.join(', ') || 'aucun';
    return interaction.reply({
      embeds: [embed.error(
        'Paramètre invalide',
        `Paramètres disponibles pour **${filter}**: \`${available}\``
      )],
      flags: [64]
    });
  }

  // Convertir la valeur selon le type attendu
  let parsedValue;

  if (setting === 'enabled' || setting === 'allowOwnServer' ||
    setting === 'blockAll' || setting === 'detectLeet' ||
    setting === 'wholeWordOnly' || setting === 'blockEveryone') {
    // Boolean
    parsedValue = ['true', 'on', 'yes', '1', 'oui'].includes(value.toLowerCase());
  } else if (setting === 'action') {
    // Action valide
    const validActions = ['delete', 'warn', 'mute', 'log'];
    if (!validActions.includes(value.toLowerCase())) {
      return interaction.reply({
        embeds: [embed.error('Action invalide', `Actions valides: ${validActions.join(', ')}`)],
        flags: [64]
      });
    }
    parsedValue = value.toLowerCase();
  } else {
    // Nombre
    parsedValue = parseInt(value);
    if (isNaN(parsedValue) || parsedValue < 0) {
      return interaction.reply({
        embeds: [embed.error('Valeur invalide', 'Cette valeur doit être un nombre positif.')],
        flags: [64]
      });
    }
  }

  // Appliquer le changement
  automod[filter][setting] = parsedValue;

  // Sauvegarder
  const guildRepo = require('../../../database/js/repositories/guildRepo');
  await guildRepo.updateSettings(guild.id, { automod });

  // Vider le cache
  const automodManager = require('../../services/automod/automodManager');
  automodManager.clearCache(guild.id);

  return interaction.reply({
    embeds: [embed.success(
      'Configuration mise à jour',
      `**${filter}.${setting}** = \`${parsedValue}\``
    )]
  });
}

/**
 * Gérer les exemptions
 */
async function handleExempt(interaction, subcommand, automod, guild) {
  const guildRepo = require('../../../database/js/repositories/guildRepo');
  const automodManager = require('../../services/automod/automodManager');

  // Initialiser les arrays si nécessaire
  if (!automod.exemptRoles) automod.exemptRoles = [];
  if (!automod.exemptChannels) automod.exemptChannels = [];

  if (subcommand === 'list') {
    const roles = automod.exemptRoles.map(id => `<@&${id}>`).join('\n') || 'Aucun';
    const channels = automod.exemptChannels.map(id => `<#${id}>`).join('\n') || 'Aucun';

    const listEmbed = embed.info('🔓 Exemptions AutoMod', '')
      .addFields(
        { name: '👥 Rôles exemptés', value: roles, inline: true },
        { name: '📝 Channels exemptés', value: channels, inline: true }
      );

    return interaction.reply({ embeds: [listEmbed] });
  }

  const role = interaction.options.getRole('role');
  const channel = interaction.options.getChannel('channel');

  if (!role && !channel) {
    return interaction.reply({
      embeds: [embed.error('Erreur', 'Spécifiez un rôle ou un channel.')],
      flags: [64]
    });
  }

  if (subcommand === 'add') {
    if (role && !automod.exemptRoles.includes(role.id)) {
      automod.exemptRoles.push(role.id);
    }
    if (channel && !automod.exemptChannels.includes(channel.id)) {
      automod.exemptChannels.push(channel.id);
    }

    await guildRepo.updateSettings(guild.id, { automod });
    automodManager.clearCache(guild.id);

    const added = [];
    if (role) added.push(`Rôle: ${role}`);
    if (channel) added.push(`Channel: ${channel}`);

    return interaction.reply({
      embeds: [embed.success('Exemption ajoutée', added.join('\n'))]
    });
  }

  if (subcommand === 'remove') {
    if (role) {
      automod.exemptRoles = automod.exemptRoles.filter(id => id !== role.id);
    }
    if (channel) {
      automod.exemptChannels = automod.exemptChannels.filter(id => id !== channel.id);
    }

    await guildRepo.updateSettings(guild.id, { automod });
    automodManager.clearCache(guild.id);

    const removed = [];
    if (role) removed.push(`Rôle: ${role}`);
    if (channel) removed.push(`Channel: ${channel}`);

    return interaction.reply({
      embeds: [embed.success('Exemption retirée', removed.join('\n'))]
    });
  }
}

/**
 * Gérer les mots interdits
 */
async function handleBadwords(interaction, subcommand, automod, guild) {
  const guildRepo = require('../../../database/js/repositories/guildRepo');
  const automodManager = require('../../services/automod/automodManager');

  if (subcommand === 'list') {
    // Récupérer les mots depuis la base de données
    const sqlite3 = require('sqlite3').verbose();
    const dbPath = require('path').join(__dirname, '../../../database/cardinal.db');

    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(dbPath);

      db.get(`SELECT automod_config FROM guilds WHERE id = ?`, [guild.id], (err, row) => {
        if (err) {
          console.error('Erreur récupération config:', err);
          return interaction.reply({
            embeds: [embed.error('Erreur', 'Impossible de récupérer la configuration.')],
            flags: [64]
          });
        }

        let config = {};
        if (row && row.automod_config) {
          try {
            config = JSON.parse(row.automod_config);
          } catch (e) {
            config = {};
          }
        }

        const words = config.badwords?.words || [];

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

        interaction.reply({
          embeds: [embed.info(
            '🚫 Mots interdits',
            `${words.length} mot(s) configuré(s)\n\`\`\`${maskedWords.join(', ')}\`\`\``
          )],
          flags: [64]
        });

        db.close();
      });
    });
  }

  const word = interaction.options.getString('word').toLowerCase().trim();

  if (subcommand === 'add') {
    // Récupérer la configuration actuelle
    const sqlite3 = require('sqlite3').verbose();
    const dbPath = require('path').join(__dirname, '../../../database/cardinal.db');

    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('Erreur ouverture base de données:', err);
          return interaction.reply({
            embeds: [embed.error('Erreur', 'Impossible d\'ouvrir la base de données.')],
            flags: [64]
          });
        }
      });

      db.get(`SELECT automod_config FROM guilds WHERE id = ?`, [guild.id], (err, row) => {
        if (err) {
          console.error('Erreur récupération config:', err);
          db.close();
          return interaction.reply({
            embeds: [embed.error('Erreur', 'Impossible de récupérer la configuration.')],
            flags: [64]
          });
        }

        let config = {};
        if (row && row.automod_config) {
          try {
            config = JSON.parse(row.automod_config);
          } catch (e) {
            config = {};
          }
        }

        // Initialiser la configuration badwords si nécessaire
        if (!config.badwords) {
          config.badwords = { enabled: false, words: [] };
        }
        if (!config.badwords.words) {
          config.badwords.words = [];
        }

        // Vérifier si le mot est déjà présent
        if (config.badwords.words.includes(word)) {
          return interaction.reply({
            embeds: [embed.warning('Déjà présent', 'Ce mot est déjà dans la liste.')],
            flags: [64]
          });
        }

        // Ajouter le mot
        config.badwords.words.push(word);
        config.badwords.enabled = true;

        // Mettre à jour la configuration
        const updatedConfig = JSON.stringify(config);
        db.run(`UPDATE guilds SET automod_config = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [updatedConfig, guild.id], (err) => {
            if (err) {
              console.error('Erreur mise à jour config:', err);
              return interaction.reply({
                embeds: [embed.error('Erreur', 'Impossible d\'ajouter le mot.')],
                flags: [64]
              });
            }

            // Vider le cache
            automodManager.clearCache(guild.id);

            interaction.reply({
              embeds: [embed.success('Mot ajouté', `Le mot a été ajouté à la liste (${config.badwords.words.length} total).`)],
              flags: [64]
            });

            db.close();
          });
      });
    });
  }

  if (subcommand === 'remove') {
    // Récupérer la configuration actuelle
    const sqlite3 = require('sqlite3').verbose();
    const dbPath = require('path').join(__dirname, '../../../database/cardinal.db');

    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('Erreur ouverture base de données:', err);
          return interaction.reply({
            embeds: [embed.error('Erreur', 'Impossible d\'ouvrir la base de données.')],
            flags: [64]
          });
        }
      });

      db.get(`SELECT automod_config FROM guilds WHERE id = ?`, [guild.id], (err, row) => {
        if (err) {
          console.error('Erreur récupération config:', err);
          db.close();
          return interaction.reply({
            embeds: [embed.error('Erreur', 'Impossible de récupérer la configuration.')],
            flags: [64]
          });
        }

        let config = {};
        if (row && row.automod_config) {
          try {
            config = JSON.parse(row.automod_config);
          } catch (e) {
            config = {};
          }
        }

        // Initialiser la configuration badwords si nécessaire
        if (!config.badwords) {
          config.badwords = { enabled: false, words: [] };
        }
        if (!config.badwords.words) {
          config.badwords.words = [];
        }

        // Vérifier si le mot existe
        if (!config.badwords.words.includes(word)) {
          return interaction.reply({
            embeds: [embed.warning('Non trouvé', 'Ce mot n\'est pas dans la liste.')],
            flags: [64]
          });
        }

        // Retirer le mot
        config.badwords.words = config.badwords.words.filter(w => w !== word);

        // Mettre à jour la configuration
        const updatedConfig = JSON.stringify(config);
        db.run(`UPDATE guilds SET automod_config = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [updatedConfig, guild.id], (err) => {
            if (err) {
              console.error('Erreur mise à jour config:', err);
              return interaction.reply({
                embeds: [embed.error('Erreur', 'Impossible de retirer le mot.')],
                flags: [64]
              });
            }

            // Vider le cache
            automodManager.clearCache(guild.id);

            interaction.reply({
              embeds: [embed.success('Mot retiré', 'Le mot a été retiré de la liste.')],
              flags: [64]
            });

            db.close();
          });
      });
    });
  }
}

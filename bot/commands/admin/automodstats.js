/**
 * COMMANDE AUTOMODSTATS - Statistiques de l'AutoMod
 * Affiche les statistiques détaillées de l'AutoMod depuis la BDD
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embed = require('../../services/embedBuilder');
const automodLogRepo = require('../../../database/js/repositories/automodLogRepo');
const guildRepo = require('../../../database/js/repositories/guildRepo');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('automodstats')
    .setDescription('Voir les statistiques de l\'AutoMod')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addStringOption(option =>
      option.setName('période')
        .setDescription('Période des statistiques')
        .setRequired(false)
        .addChoices(
          { name: 'Dernière heure', value: '1h' },
          { name: 'Dernières 24h', value: '24h' },
          { name: 'Derniers 7 jours', value: '7d' },
          { name: 'Derniers 30 jours', value: '30d' }
        )
    )
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Type de statistiques')
        .setRequired(false)
        .addChoices(
          { name: 'Général', value: 'general' },
          { name: 'Top utilisateurs', value: 'users' },
          { name: 'Par trigger', value: 'triggers' }
        )
    ),

  cooldown: 10,
  category: 'admin',

  async execute(interaction) {
    const period = interaction.options.getString('période') || '24h';
    const type = interaction.options.getString('type') || 'general';
    const { guild } = interaction;

    try {
      // Récupérer les stats depuis la BDD
      const stats = await automodLogRepo.getStats(guild.id, period);
      const totalLogs = await automodLogRepo.countByGuild(guild.id);

      if (stats.length === 0) {
        return interaction.reply({
          embeds: [embed.info('📊 Statistiques AutoMod', 'Aucune action AutoMod enregistrée pour cette période.')],
          flags: [64]
        });
      }

      switch (type) {
        case 'general':
          await showGeneralStats(interaction, stats, period, totalLogs);
          break;
        case 'users':
          await showTopUsers(interaction, guild.id, period);
          break;
        case 'triggers':
          await showTriggerStats(interaction, stats, period);
          break;
      }

    } catch (error) {
      logger.error('Erreur commande automodstats:', error);
      return interaction.reply({
        embeds: [embed.error('Erreur', 'Une erreur est survenue lors de la récupération des statistiques.')],
        flags: [64]
      });
    }
  }
};

/**
 * Affiche les statistiques générales
 */
async function showGeneralStats(interaction, stats, period, totalLogs) {
  const periodLabels = {
    '1h': 'dernière heure',
    '24h': 'dernières 24h',
    '7d': 'derniers 7 jours',
    '30d': 'derniers 30 jours'
  };

  // Calculer les totaux
  const totalActions = stats.reduce((sum, stat) => sum + stat.count, 0);
  const uniqueUsers = [...new Set(stats.map(stat => stat.user_id))].length;

  const mainEmbed = embed.info(
    '📊 Statistiques AutoMod',
    `Statistiques pour la **${periodLabels[period]}**`
  );

  mainEmbed.addFields(
    { name: '🔢 Total actions', value: `${totalActions}`, inline: true },
    { name: '👥 Utilisateurs uniques', value: `${uniqueUsers}`, inline: true },
    { name: '📈 Total historique', value: `${totalLogs}`, inline: true }
  );

  // Détails par trigger/action
  const details = stats.slice(0, 10).map(stat => {
    const triggerEmoji = getTriggerEmoji(stat.trigger_type);
    const actionEmoji = getActionEmoji(stat.action_taken);
    return `${triggerEmoji} **${stat.trigger_type}** → ${actionEmoji} ${stat.action_taken}: \`${stat.count}\``;
  });

  if (details.length > 0) {
    mainEmbed.addFields({
      name: '📋 Détails',
      value: details.join('\n'),
      inline: false
    });
  }

  await interaction.reply({ embeds: [mainEmbed] });
}

/**
 * Affiche les top utilisateurs
 */
async function showTopUsers(interaction, guildId, period) {
  const topUsers = await automodLogRepo.getTopUsers(guildId, 10, period);

  if (topUsers.length === 0) {
    return interaction.reply({
      embeds: [embed.info('👥 Top Utilisateurs AutoMod', 'Aucun utilisateur sanctionné pour cette période.')],
      flags: [64]
    });
  }

  const usersEmbed = embed.info(
    '👥 Top Utilisateurs AutoMod',
    'Utilisateurs les plus sanctionnés par l\'AutoMod'
  );

  const userList = await Promise.all(topUsers.map(async (user, index) => {
    try {
      const guildUser = await interaction.guild.members.fetch(user.user_id).catch(() => null);
      const userName = guildUser ? guildUser.user.tag : `<@${user.user_id}>`;
      return `**${index + 1}.** ${userName} - \`${user.total_actions}\` actions (${user.trigger_types} triggers)`;
    } catch {
      return `**${index + 1}.** <@${user.user_id}> - \`${user.total_actions}\` actions (${user.trigger_types} triggers)`;
    }
  }));

  usersEmbed.addFields({
    name: '🏆 Classement',
    value: userList.join('\n'),
    inline: false
  });

  await interaction.reply({ embeds: [usersEmbed] });
}

/**
 * Affiche les statistiques par trigger
 */
async function showTriggerStats(interaction, stats, period) {
  // Grouper par trigger type
  const triggerStats = {};
  stats.forEach(stat => {
    if (!triggerStats[stat.trigger_type]) {
      triggerStats[stat.trigger_type] = {
        total: 0,
        actions: {}
      };
    }
    triggerStats[stat.trigger_type].total += stat.count;
    triggerStats[stat.trigger_type].actions[stat.action_taken] = stat.count;
  });

  const triggersEmbed = embed.info(
    '🔍 Statistiques par Trigger',
    'Répartition des actions par type de trigger'
  );

  const triggerList = Object.entries(triggerStats).map(([trigger, data]) => {
    const triggerEmoji = getTriggerEmoji(trigger);
    const actionList = Object.entries(data.actions)
      .map(([action, count]) => `${getActionEmoji(action)} ${action}: \`${count}\``)
      .join(', ');
    return `${triggerEmoji} **${trigger}**: \`${data.total}\` total\n   └ ${actionList}`;
  });

  triggersEmbed.addFields({
    name: '📊 Triggers',
    value: triggerList.join('\n\n'),
    inline: false
  });

  await interaction.reply({ embeds: [triggersEmbed] });
}

/**
 * Retourne l'emoji pour un type de trigger
 */
function getTriggerEmoji(trigger) {
  const emojis = {
    'spam': '🔄',
    'links': '🌐',
    'invites': '🔗',
    'caps': '🔠',
    'mass_mentions': '📢',
    'blacklist': '🚫',
    'bad_words': '🚫'
  };
  return emojis[trigger] || '❓';
}

/**
 * Retourne l'emoji pour une action
 */
function getActionEmoji(action) {
  const emojis = {
    'delete': '🗑️',
    'warn': '⚠️',
    'mute': '🔇',
    'log': '📝'
  };
  return emojis[action] || '❓';
}

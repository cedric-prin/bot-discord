const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType } = require('discord.js');
const embed = require('../../services/embedBuilder');
const logger = require('../../utils/logger');

// Emojis par catégorie
const categoryEmojis = {
  moderation: '⚔️',
  utility: '🔧',
  admin: '👑',
  automod: '🤖',
  ai: '🧠',
  fun: '🎮',
  info: 'ℹ️'
};

// Descriptions des catégories
const categoryDescriptions = {
  moderation: 'Commandes de modération (kick, ban, warn...)',
  utility: 'Commandes utilitaires (userinfo, serverinfo...)',
  admin: 'Commandes administration (config, automod...)',
  automod: 'Commandes AutoMod (antiraid...)',
  ai: 'Commandes IA (ask, translate...)',
  fun: 'Commandes fun',
  info: 'Commandes d\'information'
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Affiche l\'aide des commandes')
    .setDMPermission(false)
    .addStringOption(option => option
      .setName('command')
      .setDescription('Nom d\'une commande spécifique')
      .setRequired(false)
      .setAutocomplete(true)
    )
    .addStringOption(option => option
      .setName('category')
      .setDescription('Filtrer par catégorie')
      .setRequired(false)
      .addChoices(
        { name: '⚔️ Modération', value: 'moderation' },
        { name: '🔧 Utilitaires', value: 'utility' },
        { name: '👑 Administration', value: 'admin' },
        { name: '🤖 AutoMod', value: 'automod' }
      )
    ),

  cooldown: 5,
  category: 'utility',

  // Autocomplete pour les noms de commandes
  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    const commands = interaction.client.commands;

    const filtered = commands
      .filter(cmd => cmd.data.name.toLowerCase().includes(focusedValue))
      .map(cmd => ({ name: cmd.data.name, value: cmd.data.name }))
      .slice(0, 25);

    await interaction.respond(filtered);
  },

  async execute(interaction) {
    const { client } = interaction;
    const commandName = interaction.options.getString('command');
    const categoryFilter = interaction.options.getString('category');

    try {
      // Si commande spécifique demandée
      if (commandName) {
        return showCommandHelp(interaction, client, commandName);
      }
      
      // Si catégorie spécifique
      if (categoryFilter) {
        return showCategoryHelp(interaction, client, categoryFilter);
      }
      
      // Sinon, afficher le menu général
      return showGeneralHelp(interaction, client);
      
    } catch (error) {
      logger.error('Erreur commande help:', error);
      return interaction.reply({
        embeds: [embed.error('Erreur', 'Une erreur est survenue.')],
        ephemeral: true
      });
    }
  }
};

/**
 * Afficher l'aide générale avec menu
 */
async function showGeneralHelp(interaction, client) {
  // Grouper les commandes par catégorie
  const categories = new Map();
  client.commands.forEach(cmd => {
    const category = cmd.category || 'autre';
    if (!categories.has(category)) {
      categories.set(category, []);
    }
    categories.get(category).push(cmd);
  });

  // Créer l'embed principal
  const helpEmbed = embed.create({
    title: '📚 Centre d\'aide',
    description: 'Bienvenue dans l\'aide du bot !\n\n' +
      'Utilisez le menu déroulant ci-dessous pour voir les commandes par catégorie.\n' +
      'Ou utilisez /help <commande> pour l\'aide d\'une commande spécifique.',
    color: 0x5865F2
  });

  // Ajouter un aperçu des catégories
  const categoryList = [];
  categories.forEach((cmds, cat) => {
    const emoji = categoryEmojis[cat] || '📁';
    categoryList.push(`${emoji} **${cat.charAt(0).toUpperCase() + cat.slice(1)}** - ${cmds.length} commande(s)`);
  });

  helpEmbed.addFields({
    name: '📂 Catégories disponibles',
    value: categoryList.join('\n')
  });

  helpEmbed.addFields({
    name: '🔗 Liens utiles',
    value: [
      'Support',
      'Documentation',
      'Inviter le bot'
    ].join(' • ')
  });

  // Menu déroulant
  const selectOptions = [];
  categories.forEach((cmds, cat) => {
    selectOptions.push({
      label: cat.charAt(0).toUpperCase() + cat.slice(1),
      description: categoryDescriptions[cat] || `${cmds.length} commande(s)`,
      value: cat,
      emoji: categoryEmojis[cat] || '📁'
    });
  });

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('help_category_select')
      .setPlaceholder('📂 Choisir une catégorie...')
      .addOptions(selectOptions.slice(0, 25))
  );

  const response = await interaction.reply({ 
    embeds: [helpEmbed], 
    components: [row] 
  });

  // Collector pour le menu
  const collector = response.createMessageComponentCollector({
    componentType: ComponentType.StringSelect,
    time: 60000
  });

  collector.on('collect', async i => {
    if (i.user.id !== interaction.user.id) {
      return i.reply({ content: 'Ce menu ne vous appartient pas.', ephemeral: true });
    }

    const selectedCategory = i.values[0];
    const categoryEmbed = buildCategoryEmbed(client, selectedCategory);

    await i.update({
      embeds: [categoryEmbed],
      components: [row]
    });
  });

  collector.on('end', () => {
    const disabledRow = new ActionRowBuilder().addComponents(
      StringSelectMenuBuilder.from(row.components[0]).setDisabled(true)
    );
    interaction.editReply({ components: [disabledRow] }).catch(() => {});
  });
}

/**
 * Construire l'embed d'une catégorie
 */
function buildCategoryEmbed(client, category) {
  const commands = client.commands.filter(cmd => cmd.category === category);
  const emoji = categoryEmojis[category] || '📁';

  const categoryEmbed = embed.create({
    title: `${emoji} Commandes ${category}`,
    description: categoryDescriptions[category] || '',
    color: 0x5865F2
  });

  const commandList = commands.map(cmd => {
    const desc = cmd.data.description?.substring(0, 50) || 'Pas de description';
    return `/${cmd.data.name} - ${desc}`;
  });

  // Diviser en plusieurs fields si nécessaire
  const chunks = [];
  let current = [];
  let length = 0;

  commandList.forEach(line => {
    if (length + line.length > 1000) {
      chunks.push(current.join('\n'));
      current = [line];
      length = line.length;
    } else {
      current.push(line);
      length += line.length + 1;
    }
  });
  if (current.length > 0) chunks.push(current.join('\n'));

  chunks.forEach((chunk, i) => {
    categoryEmbed.addFields({
      name: i === 0 ? `📜 Commandes (${commands.size})` : '\u200b',
      value: chunk
    });
  });

  return categoryEmbed;
}

/**
 * Afficher l'aide d'une catégorie
 */
async function showCategoryHelp(interaction, client, category) {
  const categoryEmbed = buildCategoryEmbed(client, category);
  return interaction.reply({ embeds: [categoryEmbed] });
}

/**
 * Afficher l'aide d'une commande spécifique
 */
async function showCommandHelp(interaction, client, commandName) {
  const command = client.commands.get(commandName);

  if (!command) {
    return interaction.reply({
      embeds: [embed.error('Commande introuvable', `La commande \`${commandName}\` n'existe pas.`)],
      ephemeral: true
    });
  }

  const cmdEmbed = embed.create({
    title: `📖 /${command.data.name}`,
    description: command.data.description || 'Pas de description',
    color: 0x5865F2
  });

  // Catégorie
  if (command.category) {
    const emoji = categoryEmojis[command.category] || '📁';
    cmdEmbed.addFields({
      name: '📂 Catégorie',
      value: `${emoji} ${command.category}`,
      inline: true
    });
  }

  // Cooldown
  if (command.cooldown) {
    cmdEmbed.addFields({
      name: '⏱️ Cooldown',
      value: `${command.cooldown}s`,
      inline: true
    });
  }

  // Options/Subcommands
  const options = command.data.options || [];
  if (options.length > 0) {
    const optionsList = options.map(opt => {
      const required = opt.required ? '*' : '';
      const type = opt.type === 1 ? '📁' : opt.type === 2 ? '📂' : '📝';
      return `${type} **${opt.name}**${required} - ${opt.description || 'Pas de description'}`;
    }).join('\n');

    cmdEmbed.addFields({
      name: '⚙️ Options',
      value: optionsList
    });
  }

  // Permissions requises
  if (command.data.default_member_permissions) {
    cmdEmbed.addFields({
      name: '🔒 Permissions requises',
      value: 'Permissions spéciales nécessaires',
      inline: true
    });
  }

  // Exemple d'utilisation
  cmdEmbed.addFields({
    name: '💡 Exemple',
    value: `/${command.data.name}`
  });

  return interaction.reply({ embeds: [cmdEmbed] });
}

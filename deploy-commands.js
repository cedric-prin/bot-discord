// Script pour enregistrer les slash commands sur Discord
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const config = require('./config/config');
const logger = require('./bot/utils/logger');

function loadCommands(dir, commands, errors) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory()) {
      loadCommands(fullPath, commands, errors);
    } else if (file.isFile() && file.name.endsWith('.js')) {
      try {
        const command = require(fullPath);
        if (!command.data || typeof command.execute !== 'function') {
          errors.push(`Commande invalide : ${fullPath}`);
          continue;
        }
        commands.push(command.data.toJSON());
      } catch (err) {
        errors.push(`Erreur lors du chargement de ${fullPath} : ${err.message}`);
      }
    }
  }
}

async function deploy() {
  try {
    logger.info('Début du déploiement des commandes...');

    const commands = [];
    const errors = [];
    const commandsPath = path.join(__dirname, 'bot/commands');
    loadCommands(commandsPath, commands, errors);

    if (errors.length > 0) {
      errors.forEach(e => logger.error(e));
      throw new Error('Certaines commandes sont invalides ou n\'ont pas pu être chargées.');
    }

    const rest = new REST({ version: '10' }).setToken(config.bot.token);
    const isGlobal = process.argv.includes('--global');

    if (isGlobal) {
      logger.info('Déploiement global (production)...');
      await rest.put(
        Routes.applicationCommands(config.bot.clientId),
        { body: commands },
      );
      logger.info(`${commands.length} commandes déployées globalement.`);
    } else {
      if (!config.bot.guildId) {
        throw new Error('DISCORD_GUILD_ID requis pour le déploiement guild (test).');
      }
      logger.info(`Déploiement guild (test) sur ${config.bot.guildId}...`);
      await rest.put(
        Routes.applicationGuildCommands(config.bot.clientId, config.bot.guildId),
        { body: commands },
      );
      logger.info(`${commands.length} commandes déployées sur le serveur de test.`);
    }
  } catch (error) {
    logger.error('Erreur lors du déploiement des commandes', { error: error.message });
    process.exit(1);
  }
}

deploy();

// Point d'entrée du bot Discord
require('dotenv').config();

const config = require('../config/config');
const client = require('./bot');
const logger = require('./utils/logger');
const loadCommands = require('./handlers/commandHandler');
const loadEvents = require('./handlers/eventHandler');

async function start() {
  try {
    logger.info('Démarrage du bot...');

    // Charger les commandes et événements
    loadCommands(client);
    loadEvents(client);

    // Connexion
    await client.login(config.bot.token);
  } catch (err) {
    logger.error(`Erreur au démarrage : ${err.message}`);
    process.exit(1);
  }
}

// Gestion des erreurs non capturées
process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
});

process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err}`);
  process.exit(1);
});

start();

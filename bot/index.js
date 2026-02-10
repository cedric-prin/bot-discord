/**
 * Point d'entrée principal du bot Discord Cardinal
 * Gère l'initialisation, le chargement des modules et la connexion
 */

require('dotenv').config();

const config = require('../config/config');
const client = require('./bot');
const logger = require('./utils/logger');
const loadCommands = require('./handlers/commandHandler');
const loadEvents = require('./handlers/eventHandler');

/**
 * Fonction principale de démarrage du bot
 */
async function start() {
  try {
    logger.info('🚀 Démarrage du bot Cardinal...');
    logger.info(`Environnement: ${config.environment}`);
    logger.info(`Base de données: ${config.database.path}`);

    // Validation des configurations critiques
    validateConfiguration();

    // Charger les commandes et événements
    logger.info('📦 Chargement des modules...');
    loadCommands(client);
    loadEvents(client);

    // Connexion à Discord
    logger.info('🔌 Connexion à Discord...');
    await client.login(config.bot.token);
    
  } catch (err) {
    logger.error(`❌ Erreur critique au démarrage : ${err.message}`);
    if (config.debug) {
      logger.error(err.stack);
    }
    process.exit(1);
  }
}

/**
 * Validation des configurations requises
 */
function validateConfiguration() {
  if (!config.bot.token) {
    throw new Error('Token Discord manquant');
  }
  
  if (!config.bot.clientId) {
    throw new Error('Client ID Discord manquant');
  }
  
  logger.info('✅ Configuration validée');
}

// Gestion des erreurs non capturées avec logs détaillés
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection:', {
    promise: promise,
    reason: reason,
    stack: reason?.stack
  });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', {
    message: err.message,
    stack: err.stack
  });
  process.exit(1);
});

// Gestion de l'arrêt propre
process.on('SIGTERM', () => {
  logger.info('🛑 Signal SIGTERM reçu, arrêt du bot...');
  client.destroy();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('🛑 Signal SIGINT reçu, arrêt du bot...');
  client.destroy();
  process.exit(0);
});

// Démarrage du bot
start();

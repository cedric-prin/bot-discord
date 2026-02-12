const { REST, Routes } = require('discord.js');
require('dotenv').config();

const config = require('./config/config');
const logger = require('./bot/utils/logger');

async function clearAndRedeploy() {
  const rest = new REST({ version: '10' }).setToken(config.bot.token);

  try {
    logger.info('🗑️ Suppression de toutes les commandes globales...');
    
    // Supprimer toutes les commandes globales
    await rest.put(
      Routes.applicationCommands(config.bot.clientId),
      { body: [] }
    );

    logger.info('✅ Toutes les commandes supprimées avec succès');
    
    logger.info('🔄 Redéploiement des commandes...');
    
    // Redéployer automatiquement
    const { spawn } = require('child_process');
    spawn('node', ['deploy-commands.js', '--global'], { 
      stdio: 'inherit',
      cwd: __dirname
    });
    
  } catch (error) {
    logger.error('❌ Erreur lors de la suppression des commandes:', error);
    process.exit(1);
  }
}

clearAndRedeploy();

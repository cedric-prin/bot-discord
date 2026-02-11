const automod = require('../services/automod/automodManager');
const logger = require('../utils/logger');

module.exports = {
  name: 'messageCreate',
  
  async execute(message) {
    // Ignorer les bots
    if (message.author.bot) return;
    
    // Ignorer les DMs
    if (!message.guild) return;
    
    try {
      // 1. AutoMod check
      const automodResult = await automod.processMessage(message);
      
      if (automodResult) {
        // Message traité par AutoMod
        logger.debug(`[AutoMod] ${message.author.tag}: ${automodResult.reason}`);
        return; // Arrêter le traitement
      }
      
      // 2. Autres traitements (XP, commandes prefix, etc.)
      // À ajouter selon les besoins
      
    } catch (error) {
      logger.error('Erreur messageCreate:', error);
    }
  }
};

/**
 * Gestionnaire d'événements pour le bot Discord Cardinal
 * Charge dynamiquement tous les fichiers d'événements du dossier events/
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

/**
 * Charge et enregistre tous les événements du bot
 * @param {Client} client - Client Discord
 */
module.exports = (client) => {
    const eventsPath = path.join(__dirname, '../events');
    
    // Vérifier que le dossier d'événements existe
    if (!fs.existsSync(eventsPath)) {
        logger.warn(`Dossier d'événements introuvable: ${eventsPath}`);
        return;
    }

    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
    let loaded = 0;
    let failed = 0;

    logger.info(`📁 Chargement des événements depuis: ${eventsPath}`);

    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        
        try {
            // Supprimer le cache pour permettre le rechargement en développement
            delete require.cache[require.resolve(filePath)];
            
            const event = require(filePath);
            
            // Validation de la structure de l'événement
            if (!event.name || typeof event.execute !== 'function') {
                logger.error(`❌ Événement invalide: ${file} - manque name ou execute`);
                failed++;
                continue;
            }

            // Enregistrement de l'événement
            if (event.once) {
                client.once(event.name, (...args) => {
                    logger.debug(`🎯 Événement unique déclenché: ${event.name}`);
                    event.execute(...args, client);
                });
            } else {
                client.on(event.name, (...args) => {
                    logger.debug(`🎯 Événement déclenché: ${event.name}`);
                    event.execute(...args, client);
                });
            }

            loaded++;
            logger.info(`✅ Événement chargé: ${event.name} (${event.once ? 'once' : 'on'})`);
            
        } catch (err) {
            logger.error(`❌ Erreur lors du chargement de l'événement ${file}:`, {
                error: err.message,
                stack: err.stack
            });
            failed++;
        }
    }

    // Résumé du chargement
    logger.info(`📊 Chargement des événements terminé: ${loaded} réussis, ${failed} échoués`);
    
    if (failed > 0) {
        logger.warn(`⚠️ Certains événements n'ont pas pu être chargés. Vérifiez les logs d'erreur.`);
    }
};

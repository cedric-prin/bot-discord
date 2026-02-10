/**
 * Gestionnaire de commandes pour le bot Discord Cardinal
 * Charge dynamiquement toutes les commandes slash du dossier commands/
 */

const fs = require('fs');
const path = require('path');
const { Collection } = require('discord.js');
const logger = require('../utils/logger');

/**
 * Charge récursivement les commandes depuis un répertoire
 * @param {string} dir - Répertoire à scanner
 * @param {Collection} commands - Collection de commandes
 * @param {Array} errors - Tableau des erreurs
 * @param {string} basePath - Chemin de base pour les logs
 */
function loadCommands(dir, commands, errors, basePath) {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const file of files) {
        const fullPath = path.join(dir, file.name);
        const relativePath = path.relative(basePath, fullPath);
        
        if (file.isDirectory()) {
            // Récursion dans les sous-dossiers
            loadCommands(fullPath, commands, errors, basePath);
        } else if (file.isFile() && file.name.endsWith('.js')) {
            try {
                // Supprimer le cache pour permettre le rechargement en développement
                delete require.cache[require.resolve(fullPath)];
                
                const command = require(fullPath);
                
                // Validation de la structure de la commande
                if (!command.data || !command.data.name) {
                    errors.push(`❌ Commande invalide (pas de data.name): ${relativePath}`);
                    continue;
                }
                
                if (typeof command.execute !== 'function') {
                    errors.push(`❌ Commande invalide (pas de execute): ${relativePath}`);
                    continue;
                }
                
                // Vérifier si la commande existe déjà
                if (commands.has(command.data.name)) {
                    errors.push(`⚠️ Commande en double: ${command.data.name} (${relativePath})`);
                    continue;
                }
                
                // Ajouter des métadonnées utiles
                command.filePath = fullPath;
                command.category = command.category || path.basename(dir);
                
                commands.set(command.data.name, command);
                logger.debug(`✅ Commande chargée: ${command.data.name} (${command.category})`);
                
            } catch (err) {
                errors.push(`❌ Erreur lors du chargement de ${relativePath}: ${err.message}`);
                logger.error(`Détails de l'erreur pour ${relativePath}:`, {
                    error: err.message,
                    stack: err.stack
                });
            }
        }
    }
}

/**
 * Charge et enregistre toutes les commandes du bot
 * @param {Client} client - Client Discord
 */
module.exports = (client) => {
    client.commands = new Collection();
    const commandsPath = path.join(__dirname, '../commands');
    const errors = [];
    
    // Vérifier que le dossier de commandes existe
    if (!fs.existsSync(commandsPath)) {
        logger.error(`Dossier de commandes introuvable: ${commandsPath}`);
        throw new Error('Dossier de commandes introuvable');
    }
    
    logger.info(`📁 Chargement des commandes depuis: ${commandsPath}`);
    
    // Charger toutes les commandes
    loadCommands(commandsPath, client.commands, errors, commandsPath);
    
    // Statistiques du chargement
    const totalCommands = client.commands.size;
    const categories = [...new Set([...client.commands.values()].map(cmd => cmd.category))];
    
    logger.info(`📊 Chargement des commandes terminé:`);
    logger.info(`   • Total: ${totalCommands} commandes`);
    logger.info(`   • Catégories: ${categories.join(', ')}`);
    
    // Afficher les commandes par catégorie
    for (const category of categories) {
        const categoryCommands = [...client.commands.values()]
            .filter(cmd => cmd.category === category)
            .map(cmd => cmd.data.name);
        logger.debug(`   • ${category}: ${categoryCommands.join(', ')}`);
    }
    
    // Gestion des erreurs
    if (errors.length > 0) {
        logger.error(`❌ ${errors.length} erreurs lors du chargement des commandes:`);
        errors.forEach(error => logger.error(`   ${error}`));
        
        // En développement, on continue avec les commandes valides
        if (process.env.NODE_ENV === 'development') {
            logger.warn('⚠️ Mode développement: continuation avec les commandes valides');
        } else {
            throw new Error('Certaines commandes sont invalides ou n\'ont pas pu être chargées.');
        }
    } else {
        logger.info('✅ Toutes les commandes ont été chargées avec succès');
    }
};

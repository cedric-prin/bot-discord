/**
 * Script de déploiement des commandes slash pour le bot Discord Cardinal
 * Enregistre les commandes sur Discord (global ou par serveur de test)
 */

const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const config = require('./config/config');
const logger = require('./bot/utils/logger');

/**
 * Charge récursivement toutes les commandes depuis un répertoire
 * @param {string} dir - Répertoire à scanner
 * @param {Array} commands - Tableau des commandes
 * @param {Array} errors - Tableau des erreurs
 * @param {string} basePath - Chemin de base pour les logs
 */
function loadCommands(dir, commands, errors, basePath) {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const file of files) {
        const fullPath = path.join(dir, file.name);
        const relativePath = path.relative(basePath, fullPath);
        
        if (file.isDirectory()) {
            loadCommands(fullPath, commands, errors, basePath);
        } else if (file.isFile() && file.name.endsWith('.js')) {
            try {
                // Supprimer le cache pour éviter les problèmes en développement
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
                
                // Validation des données de la commande
                const commandData = command.data.toJSON();
                if (!commandData.name || !commandData.description) {
                    errors.push(`❌ Commande invalide (nom/description manquant): ${relativePath}`);
                    continue;
                }
                
                commands.push(commandData);
                logger.debug(`✅ Commande chargée: ${commandData.name}`);
                
            } catch (err) {
                errors.push(`❌ Erreur lors du chargement de ${relativePath}: ${err.message}`);
                logger.error(`Détails pour ${relativePath}:`, {
                    error: err.message,
                    stack: err.stack
                });
            }
        }
    }
}

/**
 * Déploie les commandes sur Discord
 */
async function deploy() {
    try {
        logger.info('🚀 Début du déploiement des commandes...');
        logger.info(`Environnement: ${config.environment}`);

        const commands = [];
        const errors = [];
        const commandsPath = path.join(__dirname, 'bot/commands');
        
        // Vérifier que le dossier de commandes existe
        if (!fs.existsSync(commandsPath)) {
            throw new Error(`Dossier de commandes introuvable: ${commandsPath}`);
        }
        
        // Charger toutes les commandes
        loadCommands(commandsPath, commands, errors, commandsPath);

        // Afficher les statistiques
        logger.info(`📊 Analyse des commandes:`);
        logger.info(`   • Total trouvées: ${commands.length}`);
        logger.info(`   • Erreurs: ${errors.length}`);
        
        if (errors.length > 0) {
            logger.error(`❌ Erreurs lors du chargement des commandes:`);
            errors.forEach(error => logger.error(`   ${error}`));
            
            // En développement, on continue avec les commandes valides
            if (config.environment === 'development') {
                logger.warn('⚠️ Mode développement: continuation avec les commandes valides');
            } else {
                throw new Error('Corrigez les erreurs de commandes avant le déploiement.');
            }
        }

        if (commands.length === 0) {
            throw new Error('Aucune commande valide à déployer.');
        }

        // Initialisation du client REST
        const rest = new REST({ version: '10' }).setToken(config.bot.token);
        const isGlobal = process.argv.includes('--global');

        logger.info(`📡 Déploiement ${isGlobal ? 'global' : 'serveur de test'}...`);
        logger.info(`Commandes à déployer: ${commands.map(cmd => cmd.name).join(', ')}`);

        try {
            if (isGlobal) {
                logger.info('🌍 Déploiement global (production)...');
                await rest.put(
                    Routes.applicationCommands(config.bot.clientId),
                    { body: commands },
                );
                logger.info(`✅ ${commands.length} commandes déployées globalement.`);
            } else {
                if (!config.bot.guildId) {
                    throw new Error('DISCORD_GUILD_ID requis pour le déploiement serveur (test).');
                }
                logger.info(`🏠 Déploiement serveur (test) sur ${config.bot.guildId}...`);
                await rest.put(
                    Routes.applicationGuildCommands(config.bot.clientId, config.bot.guildId),
                    { body: commands },
                );
                logger.info(`✅ ${commands.length} commandes déployées sur le serveur de test.`);
            }
            
            logger.info('🎉 Déploiement terminé avec succès!');
            
        } catch (discordError) {
            // Gestion des erreurs spécifiques à Discord
            if (discordError.code === 50001) {
                throw new Error('Permissions du bot insuffisantes. Vérifiez que le bot a les permissions "applications.commands".');
            } else if (discordError.code === 10013) {
                throw new Error('Utilisateur/bot invalide. Vérifiez DISCORD_TOKEN et DISCORD_CLIENT_ID.');
            } else if (discordError.code === 50035) {
                throw new Error('Données de commande invalides. Vérifiez la structure des commandes.');
            } else {
                throw new Error(`Erreur Discord (${discordError.code}): ${discordError.message}`);
            }
        }

    } catch (error) {
        logger.error('❌ Erreur critique lors du déploiement:', {
            error: error.message,
            stack: error.stack
        });
        
        // Message d'aide
        logger.error('💡 Dépannage:');
        logger.error('   • Vérifiez votre connexion internet');
        logger.error('   • Vérifiez DISCORD_TOKEN et DISCORD_CLIENT_ID dans .env');
        logger.error('   • Assurez-vous que le bot a les permissions nécessaires');
        logger.error('   • Pour le déploiement serveur: DISCORD_GUILD_ID requis');
        
        process.exit(1);
    }
}

// Gestion des signaux d'arrêt
process.on('SIGINT', () => {
    logger.info('🛑 Déploiement interrompu par l\'utilisateur');
    process.exit(0);
});

process.on('SIGTERM', () => {
    logger.info('🛑 Déploiement terminé par le système');
    process.exit(0);
});

// Démarrage du déploiement
deploy();

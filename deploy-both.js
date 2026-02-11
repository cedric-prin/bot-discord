/**
 * Script de déploiement double: Global + Serveur spécifique
 */

const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const config = require('./config/config');
const logger = require('./bot/utils/logger');

// Serveur spécifique
const TARGET_GUILD_ID = '1471062604918296642';

/**
 * Charge récursivement toutes les commandes
 */
function loadCommands(dir) {
    const commands = [];
    const errors = [];
    
    function scanDir(currentDir) {
        const files = fs.readdirSync(currentDir, { withFileTypes: true });
        
        for (const file of files) {
            const fullPath = path.join(currentDir, file.name);
            
            if (file.isDirectory()) {
                scanDir(fullPath);
            } else if (file.isFile() && file.name.endsWith('.js')) {
                try {
                    delete require.cache[require.resolve(fullPath)];
                    const command = require(fullPath);
                    
                    if (!command.data || !command.data.name) {
                        errors.push(`❌ Commande invalide: ${file.name}`);
                        continue;
                    }
                    
                    if (typeof command.execute !== 'function') {
                        errors.push(`❌ Pas de execute: ${file.name}`);
                        continue;
                    }
                    
                    commands.push(command.data.toJSON());
                    logger.info(`✅ Commande chargée: ${command.data.name}`);
                    
                } catch (err) {
                    errors.push(`❌ Erreur ${file.name}: ${err.message}`);
                }
            }
        }
    }
    
    scanDir(dir);
    return { commands, errors };
}

/**
 * Déploie sur une cible spécifique
 */
async function deployToTarget(commands, target, isGlobal = false) {
    const rest = new REST({ version: '10' }).setToken(config.bot.token);
    
    try {
        if (isGlobal) {
            logger.info('🌍 Déploiement GLOBAL...');
            await rest.put(
                Routes.applicationCommands(config.bot.clientId),
                { body: commands }
            );
            logger.info(`✅ ${commands.length} commandes déployées globalement!`);
        } else {
            logger.info(`🏠 Déploiement sur serveur ${target}...`);
            await rest.put(
                Routes.applicationGuildCommands(config.bot.clientId, target),
                { body: commands }
            );
            logger.info(`✅ ${commands.length} commandes déployées sur le serveur!`);
        }
        return true;
    } catch (error) {
        logger.error(`❌ Erreur déploiement ${isGlobal ? 'global' : 'serveur'}:`, error.message);
        return false;
    }
}

/**
 * Déploiement principal
 */
async function deploy() {
    try {
        logger.info('🚀 Déploiement DOUBLE: Global + Serveur spécifique');
        logger.info(`📍 Serveur cible: ${TARGET_GUILD_ID}`);
        
        // Charger les commandes
        const commandsPath = path.join(__dirname, 'bot/commands');
        const { commands, errors } = loadCommands(commandsPath);
        
        if (errors.length > 0) {
            logger.error('❌ Erreurs de chargement:');
            errors.forEach(err => logger.error(`   ${err}`));
        }
        
        if (commands.length === 0) {
            logger.error('❌ Aucune commande valide à déployer');
            return;
        }
        
        logger.info(`📊 ${commands.length} commandes à déployer`);
        logger.info(`📝 Commandes: ${commands.map(c => c.name).join(', ')}`);
        
        // Déploiement serveur spécifique
        logger.info('\n=== DÉPLOIEMENT SERVEUR SPÉCIFIQUE ===');
        const serverSuccess = await deployToTarget(commands, TARGET_GUILD_ID, false);
        
        // Déploiement global
        logger.info('\n=== DÉPLOIEMENT GLOBAL ===');
        const globalSuccess = await deployToTarget(commands, null, true);
        
        // Résultat final
        logger.info('\n🎉 RÉSULTAT FINAL:');
        logger.info(`   🏠 Serveur ${TARGET_GUILD_ID}: ${serverSuccess ? '✅ SUCCÈS' : '❌ ÉCHEC'}`);
        logger.info(`   🌍 Global: ${globalSuccess ? '✅ SUCCÈS' : '❌ ÉCHEC'}`);
        
        if (serverSuccess && globalSuccess) {
            logger.info('\n🎯 TOUS LES DÉPLOIEMENTS RÉUSSIS!');
        } else {
            logger.error('\n⚠️ Certains déploiements ont échoué');
        }
        
    } catch (error) {
        logger.error('❌ Erreur critique:', error);
    }
}

// Démarrage
deploy();

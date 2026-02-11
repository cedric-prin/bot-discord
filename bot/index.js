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

// Importer les utilitaires de synchronisation
const { findDiscordIds } = require('./utils/find_discord_ids');
const { syncDiscordUsers } = require('./utils/sync_discord_users');
const { updatePoeiUsers } = require('./utils/update_poei_users');

// === SYNCHRONISATION AUTOMATIQUE INTÉGRÉE ===
const { Client, GatewayIntentBits } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Ajouter les intents nécessaires pour les membres
client.intents = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMembers,
  GatewayIntentBits.GuildPresences
];

// Service de synchronisation intégré
class AutoSync {
  constructor() {
    this.dbPath = config.database.path;
  }

  async syncGuildMembers(guild) {
    logger.info(`🔄 Synchronisation de ${guild.name} (${guild.id})...`);

    try {
      const members = await guild.members.fetch();
      logger.info(`👥 ${members.size} membres trouvés`);

      const db = new sqlite3.Database(this.dbPath);

      // D'abord, s'assurer que le serveur existe dans la table guilds
      await new Promise((resolve, reject) => {
        db.run(`
            INSERT OR IGNORE INTO guilds (id, name, member_count, created_at, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [guild.id, guild.name, members.size], function (err) {
          if (err) {
            logger.error(`❌ Erreur insertion serveur ${guild.name}: ${err.message}`);
            reject(err);
          } else {
            resolve();
          }
        });
      });

      let syncedCount = 0;

      for (const [memberId, member] of members) {
        try {
          await new Promise((resolve, reject) => {
            db.run(`
                INSERT OR REPLACE INTO users (
                  discord_id, guild_id, username, server_username, 
                  avatar_url, joined_at, is_active, last_seen
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              member.id,
              guild.id,
              member.user.username,              // username global Discord
              member.displayName,               // server_username (nickname dans le serveur)
              member.user.avatarURL() || null,
              member.joinedAt ? member.joinedAt.toISOString() : null,
              1,
              new Date().toISOString()
            ], function (err) {
              if (err) {
                logger.error(`❌ Erreur avec ${member.user.username}: ${err.message}`);
                reject(err);
              } else {
                syncedCount++;
                resolve();
              }
            });
          });
        } catch (error) {
          logger.error(`⚠️ Erreur avec ${memberId}: ${error.message}`);
        }
      }

      // Mettre à jour le compteur de membres
      await new Promise((resolve, reject) => {
        db.run(`
            UPDATE guilds SET 
              name = ?, 
              member_count = ?, 
              owner_id = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [guild.name, members.size, guild.ownerId, guild.id], function (err) {
          if (err) reject(err);
          else resolve();
        });
      });

      db.close((err) => {
        if (err) {
          logger.error('❌ Erreur fermeture BDD:', err.message);
        } else {
          logger.info(`✅ ${syncedCount} utilisateurs synchronisés pour ${guild.name}`);
        }
      });

    } catch (error) {
      logger.error(`❌ Erreur synchronisation ${guild.name}: ${error.message}`);
    }
  }

  async syncAllGuilds() {
    logger.info('🚀 Synchronisation automatique de tous les serveurs...');

    for (const guild of client.guilds.cache.values()) {
      await this.syncGuildMembers(guild);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    logger.info('🎉 Synchronisation automatique terminée !');
  }
}

const autoSync = new AutoSync();

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

    // === SYNCHRONISATION AUTOMATIQUE AU DÉMARRAGE ===
    client.once('clientReady', async () => {
      logger.info(`🤖 Cardinal Bot connecté: ${client.user.tag}`);
      logger.info(`📊 Présent dans ${client.guilds.cache.size} serveurs`);

      // Lancer la synchronisation automatique après 3 secondes
      setTimeout(async () => {
        await autoSync.syncAllGuilds();
      }, 3000);
    });

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

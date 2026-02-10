/**
 * Connexion à la base de données SQLite pour le bot Cardinal
 * Gère la connexion et fournit une interface centralisée pour la BDD
 */

const sqlite3 = require('sqlite3').verbose();
const config = require('../../config/config');
const logger = require('../../bot/utils/logger');
const fs = require('fs');
const path = require('path');

// S'assurer que le répertoire de la base de données existe
const dbDir = path.dirname(config.database.path);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    logger.info(`Répertoire de base de données créé: ${dbDir}`);
}

// Configuration de la base de données avec options optimisées
const db = new sqlite3.Database(config.database.path, (err) => {
    if (err) {
        logger.error('Erreur de connexion à la base de données:', err.message);
        process.exit(1);
    } else {
        logger.info(`Connecté à la base SQLite: ${config.database.path}`);
        
        // Activer les contraintes de clés étrangères
        db.run('PRAGMA foreign_keys = ON');
        
        // Optimiser les performances
        db.run('PRAGMA journal_mode = WAL');
        db.run('PRAGMA synchronous = NORMAL');
    }
});

// Gestion des erreurs de base de données
db.on('error', (err) => {
    logger.error('Erreur de base de données:', err);
});

// Gestion de la fermeture propre
process.on('SIGINT', () => {
    logger.info('Fermeture de la base de données...');
    db.close((err) => {
        if (err) {
            logger.error('Erreur lors de la fermeture de la BDD:', err.message);
        } else {
            logger.info('Base de données fermée avec succès.');
        }
        process.exit(0);
    });
});

module.exports = db;
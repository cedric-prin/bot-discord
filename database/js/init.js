const db = require('./index');
const fs = require('fs');
const path = require('path');
const logger = require('../../bot/utils/logger');

// Chemin vers le schéma unifié
const schemaPath = path.join(__dirname, '../schema-unified.sql');

// Activer les clés étrangères
db.run('PRAGMA foreign_keys = ON');

// Fonction pour initialiser la base de données avec le schéma unifié
async function initializeDatabase() {
  try {
    logger.info('Initialisation de la base de données avec le schéma unifié...');
    
    // Lire et exécuter le schéma SQL
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Exécuter les commandes SQL en séparant les instructions
    const statements = schema.split(';').filter(stmt => stmt.trim().length > 0);
    
    for (const statement of statements) {
      await new Promise((resolve, reject) => {
        db.run(statement.trim(), (err) => {
          if (err && !err.message.includes('already exists')) {
            logger.error('Erreur lors de l\'exécution du schéma:', err.message);
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }
    
    logger.info('Base de données initialisée avec succès');
  } catch (error) {
    logger.error('Erreur lors de l\'initialisation de la base de données:', error);
    throw error;
  }
}

// Exporter la fonction d'initialisation
module.exports = { initializeDatabase };

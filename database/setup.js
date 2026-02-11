#!/usr/bin/env node

/**
 * Script d'initialisation de la base de données Cardinal
 * Usage: node setup.js [--migrate] [--force]
 * 
 * Options:
 *   --migrate : Migre les données existantes vers le nouveau schéma
 *   --force   : Force la recréation complète de la base de données
 */

const { initializeDatabase } = require('./js/init');
const DatabaseMigrator = require('./migrate-to-unified');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const config = require('../config/config');
const logger = require('../bot/utils/logger');

class DatabaseSetup {
    constructor() {
        this.dbPath = config.database.path;
        this.args = process.argv.slice(2);
        this.shouldMigrate = this.args.includes('--migrate');
        this.shouldForce = this.args.includes('--force');
    }

    async setup() {
        try {
            logger.info('=== Configuration de la base de données Cardinal ===');
            
            // 1. Vérifier l'état actuel
            await this.checkCurrentState();
            
            // 2. Préparer la base de données
            if (this.shouldForce) {
                await this.forceRecreate();
            } else if (this.shouldMigrate) {
                await this.migrate();
            } else {
                await this.initialize();
            }
            
            // 3. Vérifier l'intégrité
            await this.verifyIntegrity();
            
            logger.info('=== Configuration terminée avec succès! ===');
            
        } catch (error) {
            logger.error('Erreur lors de la configuration:', error);
            process.exit(1);
        }
    }

    async checkCurrentState() {
        logger.info(`Chemin de la base de données: ${this.dbPath}`);
        
        if (fs.existsSync(this.dbPath)) {
            const stats = fs.statSync(this.dbPath);
            const sizeKB = Math.round(stats.size / 1024);
            logger.info(`Base de données existante: ${sizeKB} KB`);
            
            // Vérifier la structure actuelle
            try {
                const db = new Database(this.dbPath, { readonly: true });
                const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
                const tableNames = tables.map(t => t.name).sort();
                logger.info(`Tables existantes: ${tableNames.join(', ')}`);
                db.close();
            } catch (error) {
                logger.warn('Impossible de lire la structure actuelle:', error.message);
            }
        } else {
            logger.info('Aucune base de données existante - création prévue');
        }
    }

    async forceRecreate() {
        logger.warn('=== Recréation forcée de la base de données ===');
        
        if (fs.existsSync(this.dbPath)) {
            const backupPath = this.dbPath.replace('.db', '.backup.' + Date.now() + '.db');
            logger.info(`Sauvegarde de l'ancienne base: ${backupPath}`);
            fs.copyFileSync(this.dbPath, backupPath);
            
            logger.info('Suppression de l\'ancienne base de données...');
            fs.unlinkSync(this.dbPath);
        }
        
        await this.initialize();
    }

    async migrate() {
        if (!fs.existsSync(this.dbPath)) {
            logger.info('Aucune base de données à migrer - création nouvelle...');
            await this.initialize();
            return;
        }
        
        logger.info('=== Migration de la base de données existante ===');
        const migrator = new DatabaseMigrator();
        await migrator.migrate();
    }

    async initialize() {
        logger.info('=== Initialisation de la base de données ===');
        await initializeDatabase();
    }

    async verifyIntegrity() {
        logger.info('Vérification de l\'intégrité de la base de données...');
        
        const db = new Database(this.dbPath);
        
        try {
            // Vérifier que toutes les tables requises existent
            const requiredTables = [
                'guilds', 'users', 'warnings', 'sanctions', 
                'mod_logs', 'automod_logs', 'ai_logs'
            ];
            
            const existingTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
            const existingTableNames = existingTables.map(t => t.name);
            
            for (const table of requiredTables) {
                if (!existingTableNames.includes(table)) {
                    throw new Error(`Table requise manquante: ${table}`);
                }
            }
            
            // Vérifier les contraintes étrangères
            db.pragma('foreign_keys = ON');
            const fkEnabled = db.pragma('foreign_keys', { simple: true });
            if (!fkEnabled) {
                throw new Error('Les contraintes de clés étrangères ne sont pas activées');
            }
            
            // Compter les enregistrements
            const stats = {};
            for (const table of requiredTables) {
                const count = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
                stats[table] = count.count;
            }
            
            logger.info('Statistiques de la base de données:');
            for (const [table, count] of Object.entries(stats)) {
                logger.info(`  ${table}: ${count} enregistrements`);
            }
            
            // Tester une requête simple
            db.prepare('SELECT 1').get();
            
            logger.info('✅ Intégrité vérifiée avec succès');
            
        } finally {
            db.close();
        }
    }

    printUsage() {
        console.log(`
Usage: node setup.js [options]

Options:
  --migrate  Migre les données existantes vers le nouveau schéma unifié
  --force    Recrée complètement la base de données (avec sauvegarde)
  --help     Affiche cette aide

Exemples:
  node setup.js              # Initialisation simple
  node setup.js --migrate    # Migration depuis une base existante
  node setup.js --force      # Recréation complète
        `);
    }
}

// Point d'entrée principal
if (require.main === module) {
    const setup = new DatabaseSetup();
    
    if (setup.args.includes('--help') || setup.args.includes('-h')) {
        setup.printUsage();
        process.exit(0);
    }
    
    setup.setup().catch(error => {
        logger.error('Erreur fatale:', error);
        process.exit(1);
    });
}

module.exports = DatabaseSetup;

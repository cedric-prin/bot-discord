#!/usr/bin/env node

/**
 * Script de migration vers le schéma unifié
 * Usage: node migrate-to-unified.js
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const config = require('../config/config');
const logger = require('../bot/utils/logger');

class DatabaseMigrator {
    constructor() {
        this.dbPath = config.database.path;
        this.backupPath = this.dbPath.replace('.db', '.backup.' + Date.now() + '.db');
        this.schemaPath = path.join(__dirname, 'schema-unified.sql');
    }

    async migrate() {
        try {
            logger.info('Début de la migration vers le schéma unifié...');
            
            // 1. Créer une sauvegarde
            await this.createBackup();
            
            // 2. Ouvrir la base de données
            const db = new Database(this.dbPath);
            
            // 3. Activer les contraintes étrangères
            db.pragma('foreign_keys = ON');
            
            // 4. Exécuter le nouveau schéma
            await this.applySchema(db);
            
            // 5. Migrer les données existantes
            await this.migrateData(db);
            
            // 6. Nettoyer les anciennes tables si elles existent
            await this.cleanupOldTables(db);
            
            db.close();
            logger.info('Migration terminée avec succès!');
            
        } catch (error) {
            logger.error('Erreur lors de la migration:', error);
            await this.restoreBackup();
            process.exit(1);
        }
    }

    async createBackup() {
        logger.info(`Création de la sauvegarde: ${this.backupPath}`);
        if (fs.existsSync(this.dbPath)) {
            fs.copyFileSync(this.dbPath, this.backupPath);
        }
    }

    async restoreBackup() {
        if (fs.existsSync(this.backupPath)) {
            logger.info(`Restauration de la sauvegarde: ${this.backupPath}`);
            fs.copyFileSync(this.backupPath, this.dbPath);
        }
    }

    async applySchema(db) {
        logger.info('Application du nouveau schéma...');
        const schema = fs.readFileSync(this.schemaPath, 'utf8');
        
        // Exécuter chaque instruction SQL séparément
        const statements = schema
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
        
        for (const statement of statements) {
            try {
                db.exec(statement);
            } catch (error) {
                // Ignorer les erreurs de "table exists" pour les CREATE TABLE IF NOT EXISTS
                if (!error.message.includes('already exists')) {
                    throw error;
                }
            }
        }
    }

    async migrateData(db) {
        logger.info('Migration des données existantes...');
        
        // Migration des guildes depuis l'ancien format si nécessaire
        await this.migrateGuilds(db);
        
        // Migration des utilisateurs
        await this.migrateUsers(db);
        
        // Migration des warnings
        await this.migrateWarnings(db);
        
        // Migration des sanctions
        await this.migrateSanctions(db);
    }

    async migrateGuilds(db) {
        // Vérifier si l'ancienne table guilds existe avec la structure différente
        const tableInfo = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='guilds'").get();
        
        if (tableInfo) {
            // Vérifier les colonnes existantes
            const columns = db.prepare("PRAGMA table_info(guilds)").all();
            const hasOldStructure = columns.some(col => col.name === 'id' && col.type === 'INTEGER');
            
            if (hasOldStructure) {
                logger.info('Migration des guildes depuis l\'ancienne structure...');
                
                // Créer une table temporaire avec la nouvelle structure
                db.exec(`
                    CREATE TABLE IF NOT EXISTS guilds_new (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        prefix TEXT DEFAULT '!',
                        log_channel_id TEXT,
                        mod_log_channel_id TEXT,
                        mute_role_id TEXT,
                        automod_enabled INTEGER DEFAULT 1,
                        automod_config TEXT DEFAULT '{}',
                        welcome_channel_id TEXT,
                        welcome_message TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `);
                
                // Migrer les données
                const migrateGuilds = db.prepare(`
                    INSERT OR IGNORE INTO guilds_new (
                        id, name, prefix, created_at
                    )
                    SELECT 
                        CAST(id AS TEXT), 
                        name, 
                        '!' as prefix,
                        created_at
                    FROM guilds
                `);
                
                const result = migrateGuilds.run();
                logger.info(`${result.changes} guildes migrées`);
                
                // Remplacer l'ancienne table
                db.exec('DROP TABLE guilds');
                db.exec('ALTER TABLE guilds_new RENAME TO guilds');
            }
        }
    }

    async migrateUsers(db) {
        // Similar logic for users if needed
        const tableInfo = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
        
        if (tableInfo) {
            const columns = db.prepare("PRAGMA table_info(users)").all();
            const hasOldStructure = columns.some(col => col.name === 'id' && col.type === 'INTEGER' && !columns.some(c => c.name === 'discord_id'));
            
            if (hasOldStructure) {
                logger.info('Migration des utilisateurs depuis l\'ancienne structure...');
                
                // Mettre à jour la structure si nécessaire
                try {
                    db.exec(`
                        ALTER TABLE users ADD COLUMN discord_id TEXT;
                        UPDATE users SET discord_id = CAST(id AS TEXT) WHERE discord_id IS NULL;
                    `);
                } catch (error) {
                    // Les colonnes existent peut-être déjà
                    logger.debug('Colonnes users déjà présentes');
                }
            }
        }
    }

    async migrateWarnings(db) {
        // S'assurer que les colonnes nécessaires existent
        try {
            db.exec(`
                ALTER TABLE warnings ADD COLUMN active INTEGER DEFAULT 1;
                ALTER TABLE warnings ADD COLUMN expires_at DATETIME;
            `);
        } catch (error) {
            // Les colonnes existent déjà
            logger.debug('Colonnes warnings déjà présentes');
        }
    }

    async migrateSanctions(db) {
        // S'assurer que les colonnes nécessaires existent
        try {
            db.exec(`
                ALTER TABLE sanctions ADD COLUMN duration INTEGER;
                ALTER TABLE sanctions ADD COLUMN expires_at DATETIME;
                ALTER TABLE sanctions ADD COLUMN active INTEGER DEFAULT 1;
            `);
        } catch (error) {
            // Les colonnes existent déjà
            logger.debug('Colonnes sanctions déjà présentes');
        }
        
        // Normaliser les types de sanctions
        db.exec(`
            UPDATE sanctions SET type = 'timeout' WHERE type = 'TEMPOUT' OR type = 'tempout';
            UPDATE sanctions SET type = 'unmute' WHERE type = 'UNMUTE';
            UPDATE sanctions SET type = 'unban' WHERE type = 'UNBAN';
        `);
    }

    async cleanupOldTables(db) {
        logger.info('Nettoyage des anciennes tables...');
        
        // Supprimer les tables obsolètes si elles existent
        const oldTables = ['config'];
        
        for (const tableName of oldTables) {
            const exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(tableName);
            if (exists) {
                logger.info(`Suppression de l'ancienne table: ${tableName}`);
                db.exec(`DROP TABLE ${tableName}`);
            }
        }
        
        // Nettoyer les données invalides
        db.exec(`
            DELETE FROM warnings WHERE user_id IS NULL OR guild_id IS NULL;
            DELETE FROM sanctions WHERE user_id IS NULL OR guild_id IS NULL OR moderator_id IS NULL;
        `);
        
        logger.info('Nettoyage terminé');
    }
}

// Exécuter la migration si ce script est appelé directement
if (require.main === module) {
    const migrator = new DatabaseMigrator();
    migrator.migrate().catch(console.error);
}

module.exports = DatabaseMigrator;

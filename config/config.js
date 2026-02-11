require('dotenv').config();

/**
 * Configuration centralisée du bot Discord Cardinal
 * Gère les variables d'environnement avec validation et valeurs par défaut
 */

function getEnvVar(name, required = false, defaultValue = undefined) {
    const value = process.env[name];
    if (value !== undefined && value !== '') return value;
    if (required) {
        throw new Error(`La variable d'environnement requise ${name} est manquante.`);
    }
    return defaultValue;
}

function validateDatabasePath(path) {
    if (!path.endsWith('.db') && !path.endsWith('.sqlite')) {
        return path + (path.endsWith('/') ? 'cardinal.db' : '/cardinal.db');
    }
    return path;
}

const config = {
    bot: {
        token: getEnvVar('DISCORD_TOKEN', true),
        clientId: getEnvVar('DISCORD_CLIENT_ID', true),
        guildId: getEnvVar('DISCORD_GUILD_ID', false, '1471062604918296642'),
        // Intents requis pour la modération complète
        intents: [
            'Guilds',
            'GuildMembers', 
            'GuildBans',
            'GuildEmojisAndStickers',
            'GuildIntegrations',
            'GuildWebhooks',
            'GuildInvites',
            'GuildVoiceStates',
            'GuildPresences',
            'GuildMessages',
            'GuildMessageReactions',
            'DirectMessages',
            'MessageContent'
        ]
    },
    database: {
        path: './database/cardinal.db',
    },
    channels: {
        logs: getEnvVar('CHANNEL_LOGS', false),
        modLogs: getEnvVar('CHANNEL_MODLOGS', false),
    },
    panel: {
        secretKey: getEnvVar('PANEL_SECRET_KEY', false),
        port: parseInt(getEnvVar('PANEL_PORT', false, '8501')),
    },
    ai: {
        provider: getEnvVar('AI_PROVIDER', false, 'openai'),
        openaiKey: getEnvVar('OPENAI_API_KEY', false),
        model: getEnvVar('AI_MODEL', false, 'gpt-4o-mini'),
    },
    // Configuration des seuils de warnings
    moderation: {
        thresholds: {
            mute: parseInt(getEnvVar('WARN_MUTE_THRESHOLD', false, '3')),
            kick: parseInt(getEnvVar('WARN_KICK_THRESHOLD', false, '5')),
            ban: parseInt(getEnvVar('WARN_BAN_THRESHOLD', false, '7'))
        },
        defaultCooldown: parseInt(getEnvVar('DEFAULT_COOLDOWN', false, '3'))
    },
    // Environnement
    environment: getEnvVar('NODE_ENV', false, 'development'),
    debug: getEnvVar('DEBUG', false, 'false') === 'true'
};

// Validation de sécurité
if (!config.panel.secretKey || config.panel.secretKey === 'default_secret_key') {
    console.warn('⚠️ ATTENTION: Utilisation d\'une clé secrète par défaut. Définissez PANEL_SECRET_KEY dans votre .env');
}

module.exports = config;
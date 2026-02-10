require('dotenv').config();

function getEnvVar(name, required = false, defaultValue = undefined) {
    const value = process.env[name];
    if (value !== undefined && value !== '') return value;
    if (required) {
        throw new Error(`La variable d'environnement requise ${name} est manquante.`);
    }
    return defaultValue;
}

const config = {
    bot: {
        token: getEnvVar('DISCORD_TOKEN', true),
        clientId: getEnvVar('DISCORD_CLIENT_ID', true),
        guildId: getEnvVar('DISCORD_GUILD_ID', false),
    },
    database: {
        path: getEnvVar('DATABASE_PATH', false, './database/cardinal.db'),
    },
    channels: {
        logs: getEnvVar('CHANNEL_LOGS', false),
        modLogs: getEnvVar('CHANNEL_MODLOGS', false),
    },
    panel: {
        secretKey: getEnvVar('PANEL_SECRET_KEY', true),
    },
    ai: {
        openaiKey: getEnvVar('OPENAI_KEY', false),
    },
};

module.exports = config;
const { ActivityType } = require('discord.js');

module.exports = {
    name: 'ready',
    once: true,
    execute(client) {
        console.log(`✅ Connecté en tant que ${client.user.tag}`);
        console.log(`📊 ${client.guilds.cache.size} serveurs`);

        client.user.setActivity('les modérateurs', {
            type: ActivityType.Watching
        });

        // Initialisation du cache si besoin
        // Exemple : client.myCache = new Map();
    }
};

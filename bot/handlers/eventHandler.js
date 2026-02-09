const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

module.exports = (client) => {
    const eventsPath = path.join(__dirname, '../events');
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
    let loaded = 0;
    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        try {
            const event = require(filePath);
            if (!event.name || typeof event.execute !== 'function') {
                logger.error(`Événement invalide : ${file}`);
                continue;
            }
            if (event.once) {
                client.once(event.name, (...args) => event.execute(...args));
            } else {
                client.on(event.name, (...args) => event.execute(...args));
            }
            loaded++;
        } catch (err) {
            logger.error(`Erreur lors du chargement de l'événement ${file} : ${err.message}`);
        }
    }
    logger.info(`${loaded} événements chargés`);
};

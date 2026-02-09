const fs = require('fs');
const path = require('path');
const { Collection } = require('discord.js');
const logger = require('../utils/logger');

function loadCommands(dir, commands, errors) {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory()) {
            loadCommands(fullPath, commands, errors);
        } else if (file.isFile() && file.name.endsWith('.js')) {
            try {
                const command = require(fullPath);
                if (!command.data || typeof command.execute !== 'function') {
                    errors.push(`Commande invalide : ${fullPath}`);
                    continue;
                }
                commands.set(command.data.name, command);
            } catch (err) {
                errors.push(`Erreur lors du chargement de ${fullPath} : ${err.message}`);
            }
        }
    }
}

module.exports = (client) => {
    client.commands = new Collection();
    const commandsPath = path.join(__dirname, '../commands');
    const errors = [];
    loadCommands(commandsPath, client.commands, errors);
    logger.info(`${client.commands.size} commandes chargées`);
    if (errors.length > 0) {
        errors.forEach(e => logger.error(e));
        throw new Error('Certaines commandes sont invalides ou n\'ont pas pu être chargées.');
    }
};

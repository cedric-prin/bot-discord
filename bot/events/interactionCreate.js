const cooldowns = new Map();

module.exports = {
    name: 'interactionCreate',
    once: false,
    async execute(interaction) {
        if (!interaction.isChatInputCommand()) return;

        const command = interaction.client.commands.get(interaction.commandName);
        if (!command) return;

        // Vérification des permissions utilisateur
        if (command.permissions && command.permissions.length > 0) {
            const member = interaction.member;
            if (!member.permissions || !member.permissions.has(command.permissions)) {
                return interaction.reply({ content: '⛔ Vous n\'avez pas la permission d\'utiliser cette commande.', ephemeral: true });
            }
        }

        // Vérification du cooldown
        if (command.cooldown) {
            if (!cooldowns.has(command.data.name)) {
                cooldowns.set(command.data.name, new Map());
            }
            const now = Date.now();
            const timestamps = cooldowns.get(command.data.name);
            const cooldownAmount = (command.cooldown || 5) * 1000;
            const userId = interaction.user.id;
            if (timestamps.has(userId)) {
                const expiration = timestamps.get(userId) + cooldownAmount;
                if (now < expiration) {
                    const timeLeft = ((expiration - now) / 1000).toFixed(1);
                    return interaction.reply({ content: `⏳ Merci d\'attendre encore ${timeLeft}s avant de réutiliser cette commande.`, ephemeral: true });
                }
            }
            timestamps.set(userId, now);
            setTimeout(() => timestamps.delete(userId), cooldownAmount);
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: '❌ Une erreur est survenue lors de l\'exécution de la commande.', ephemeral: true });
            } else {
                await interaction.reply({ content: '❌ Une erreur est survenue lors de l\'exécution de la commande.', ephemeral: true });
            }
        }
    }
};

/**
 * Événement interactionCreate - Gère toutes les interactions du bot
 * Principalement les commandes slash avec cooldowns et permissions
 */

const logger = require('../utils/logger');
const config = require('../../config/config');

module.exports = {
    name: 'interactionCreate',
    once: false,
    
    /**
     * Exécute le traitement de l'interaction
     * @param {Interaction} interaction - Interaction Discord
     * @param {Client} client - Client Discord
     */
    async execute(interaction, client) {
        // Filtrer uniquement les commandes slash
        if (!interaction.isChatInputCommand()) {
            return;
        }

        const command = client.commands.get(interaction.commandName);
        if (!command) {
            logger.warn(`⚠️ Commande non trouvée: ${interaction.commandName}`);
            return;
        }

        // Log de la commande exécutée
        logger.info(`🎯 Commande exécutée: ${interaction.commandName} par ${interaction.user.tag} dans ${interaction.guild?.name || 'DM'}`);

        try {
            // 1. Vérification des permissions utilisateur
            const permissionCheck = await this.checkPermissions(interaction, command);
            if (!permissionCheck.allowed) {
                return await this.sendPermissionError(interaction, permissionCheck.reason);
            }

            // 2. Vérification du cooldown
            const cooldownCheck = await this.checkCooldown(interaction, command);
            if (!cooldownCheck.allowed) {
                return await this.sendCooldownError(interaction, cooldownCheck.remaining);
            }

            // 3. Exécution de la commande
            await command.execute(interaction);
            
            // Log de succès
            logger.debug(`✅ Commande ${interaction.commandName} exécutée avec succès`);

        } catch (error) {
            await this.handleCommandError(interaction, error, command);
        }
    },

    /**
     * Vérifie les permissions de l'utilisateur pour la commande
     * @param {Interaction} interaction - Interaction Discord
     * @param {Object} command - Commande à vérifier
     * @returns {Object} - { allowed: boolean, reason?: string }
     */
    async checkPermissions(interaction, command) {
        // Permissions par défaut du bot
        if (command.data.defaultMemberPermissions) {
            const member = interaction.member;
            if (!member.permissions.has(command.data.defaultMemberPermissions)) {
                return {
                    allowed: false,
                    reason: 'Vous n\'avez pas les permissions nécessaires pour cette commande.'
                };
            }
        }

        // Permissions personnalisées (si définies)
        if (command.permissions && command.permissions.length > 0) {
            const member = interaction.member;
            if (!member.permissions || !member.permissions.has(command.permissions)) {
                return {
                    allowed: false,
                    reason: 'Permissions personnalisées manquantes pour cette commande.'
                };
            }
        }

        return { allowed: true };
    },

    /**
     * Vérifie et gère les cooldowns de commande
     * @param {Interaction} interaction - Interaction Discord
     * @param {Object} command - Commande à vérifier
     * @returns {Object} - { allowed: boolean, remaining?: number }
     */
    async checkCooldown(interaction, command) {
        const cooldownTime = command.cooldown || config.moderation.defaultCooldown;
        
        if (cooldownTime <= 0) {
            return { allowed: true };
        }

        // Utiliser la collection globale de cooldowns du client
        const { cooldowns } = interaction.client;
        
        if (!cooldowns.has(command.data.name)) {
            cooldowns.set(command.data.name, new Map());
        }

        const now = Date.now();
        const timestamps = cooldowns.get(command.data.name);
        const cooldownAmount = cooldownTime * 1000;
        const userId = interaction.user.id;

        if (timestamps.has(userId)) {
            const expiration = timestamps.get(userId) + cooldownAmount;
            
            if (now < expiration) {
                const remaining = ((expiration - now) / 1000).toFixed(1);
                return {
                    allowed: false,
                    remaining: parseFloat(remaining)
                };
            }
        }

        // Mettre à jour le cooldown
        timestamps.set(userId, now);
        setTimeout(() => timestamps.delete(userId), cooldownAmount);

        return { allowed: true };
    },

    /**
     * Envoie une erreur de permission formatée
     * @param {Interaction} interaction - Interaction Discord
     * @param {string} reason - Raison du refus
     */
    async sendPermissionError(interaction, reason) {
        const embed = {
            color: 0xFF0000,
            title: '⛔ Permission refusée',
            description: reason,
            timestamp: new Date().toISOString()
        };

        await interaction.reply({ embeds: [embed], ephemeral: true });
        logger.debug(`Permission refusée pour ${interaction.user.tag}: ${reason}`);
    },

    /**
     * Envoie une erreur de cooldown formatée
     * @param {Interaction} interaction - Interaction Discord
     * @param {number} remaining - Temps restant en secondes
     */
    async sendCooldownError(interaction, remaining) {
        const embed = {
            color: 0xFFA500,
            title: '⏳ Cooldown actif',
            description: `Merci d'attendre encore **${remaining}s** avant de réutiliser cette commande.`,
            timestamp: new Date().toISOString()
        };

        await interaction.reply({ embeds: [embed], ephemeral: true });
        logger.debug(`Cooldown pour ${interaction.user.tag}: ${remaining}s restantes`);
    },

    /**
     * Gère les erreurs lors de l'exécution des commandes
     * @param {Interaction} interaction - Interaction Discord
     * @param {Error} error - Erreur survenue
     * @param {Object} command - Commande concernée
     */
    async handleCommandError(interaction, error, command) {
        const errorId = Date.now().toString(36);
        
        logger.error(`❌ Erreur dans la commande ${command.data.name}:`, {
            errorId: errorId,
            command: command.data.name,
            user: interaction.user.tag,
            guild: interaction.guild?.name,
            error: error.message,
            stack: error.stack
        });

        const embed = {
            color: 0xFF0000,
            title: '❌ Erreur de commande',
            description: 'Une erreur est survenue lors de l\'exécution de cette commande.',
            fields: [
                {
                    name: '🔍 ID d\'erreur',
                    value: `\`${errorId}\``,
                    inline: true
                },
                {
                    name: '📞 Support',
                    value: 'Contactez un administrateur avec cet ID d\'erreur.',
                    inline: true
                }
            ],
            timestamp: new Date().toISOString()
        };

        try {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ embeds: [embed], ephemeral: true });
            } else {
                await interaction.reply({ embeds: [embed], ephemeral: true });
            }
        } catch (replyError) {
            logger.error('❌ Impossible d\'envoyer le message d\'erreur:', replyError);
        }
    }
};

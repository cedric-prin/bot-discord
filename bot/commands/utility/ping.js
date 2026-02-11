const { SlashCommandBuilder } = require('discord.js');
const embed = require('../../services/embedBuilder');
const db = require('../../database');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Affiche la latence du bot')
        .setDMPermission(false),

    cooldown: 5,
    category: 'utility',

    async execute(interaction) {
        try {
            const sent = await interaction.reply({
                embeds: [embed.info('🏓 Pong!', 'Calcul de la latence...')],
                fetchReply: true
            });

            // Latence API (heartbeat)
            const apiLatency = interaction.client.ws.ping;

            // Latence aller-retour
            const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;

            // Latence BDD
            const dbStart = Date.now();
            await db.execute('SELECT 1');
            const dbLatency = Date.now() - dbStart;

            // Couleur selon la latence
            let color;
            if (roundtrip < 200 && apiLatency < 100) {
                color = 0x57F287; // Vert
            } else if (roundtrip < 500 && apiLatency < 200) {
                color = 0xFEE75C; // Jaune
            } else {
                color = 0xED4245; // Rouge
            }

            // Emoji selon la latence
            const getEmoji = (ms, thresholds) => {
                if (ms < thresholds[0]) return '🟢';
                if (ms < thresholds[1]) return '🟡';
                return '🔴';
            };

            const pingEmbed = embed.create({
                title: '🏓 Pong!',
                color: color,
                fields: [
                    {
                        name: '📡 API Discord',
                        value: `${getEmoji(apiLatency, [100, 200])} ${apiLatency}ms`,
                        inline: true
                    },
                    {
                        name: '⏱️ Aller-retour',
                        value: `${getEmoji(roundtrip, [200, 500])} ${roundtrip}ms`,
                        inline: true
                    },
                    {
                        name: '💾 Base de données',
                        value: `${getEmoji(dbLatency, [50, 100])} ${dbLatency}ms`,
                        inline: true
                    }
                ],
                footer: `Uptime: ${formatUptime(interaction.client.uptime)}`
            });

            return interaction.editReply({ embeds: [pingEmbed] });

        } catch (error) {
            logger.error('Erreur commande ping:', error);
            return interaction.editReply({
                embeds: [embed.error('Erreur', 'Impossible de calculer la latence.')]
            });
        }
    }
};

/**
 * Formater l'uptime
 */
function formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    const parts = [];
    if (days > 0) parts.push(`${days}j`);
    if (hours % 24 > 0) parts.push(`${hours % 24}h`);
    if (minutes % 60 > 0) parts.push(`${minutes % 60}m`);
    if (seconds % 60 > 0 && days === 0) parts.push(`${seconds % 60}s`);

    return parts.join(' ') || '< 1s';
}

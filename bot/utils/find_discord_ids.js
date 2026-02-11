/**
 * Script pour trouver les vrais IDs Discord depuis le bot
 * À utiliser temporairement pour récupérer les vraies informations
 */

require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

/**
 * Trouver les vrais IDs Discord depuis le bot
 */
async function findDiscordIds() {
    const bot = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMembers
        ]
    });

    return new Promise((resolve, reject) => {
        bot.once('ready', async () => {
            console.log('🔍 Recherche des vrais IDs Discord...');

            const results = [];

            for (const guild of bot.guilds.cache.values()) {
                console.log(`\n📊 Serveur: ${guild.name} (ID: ${guild.id})`);
                console.log('👥 Membres avec leurs vrais IDs:');

                const members = await guild.members.fetch();
                let count = 0;
                const guildMembers = [];

                for (const [memberId, member] of members) {
                    if (count < 10) { // Limiter à 10 pour la lisibilité
                        console.log(`  • ${member.user.username} - ID: ${member.id} - Nick: ${member.displayName}`);
                        guildMembers.push({
                            username: member.user.username,
                            discordId: member.id,
                            displayName: member.displayName
                        });
                        count++;
                    }
                }

                if (members.size > 10) {
                    console.log(`  ... et ${members.size - 10} autres membres`);
                }

                console.log(`📈 Total: ${members.size} membres`);

                results.push({
                    guildName: guild.name,
                    guildId: guild.id,
                    memberCount: members.size,
                    members: guildMembers
                });
            }

            console.log('\n✅ IDs Discord récupérés !');
            console.log('🛑 Arrêt du bot...');
            bot.destroy();

            resolve(results);
        });

        bot.login(process.env.DISCORD_TOKEN).catch(reject);
    });
}

module.exports = { findDiscordIds };

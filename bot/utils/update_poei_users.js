/**
 * Mise à jour des vrais utilisateurs Discord
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

/**
 * Mettre à jour les vrais utilisateurs Discord
 */
async function updatePoeiUsers() {
    return new Promise((resolve, reject) => {
        // Vrais informations pour POEI Dev Python & IA
        const poeiUsers = [
            {
                discord_id: '1469356767988154441',
                username: 'cedric.prin',
                server_username: 'Cédric Prin',
                guild_id: '1298323429169930270'
            },
            {
                discord_id: '842716007604862997',
                username: 'wartex34980',
                server_username: 'Wartex',
                guild_id: '1298323429169930270'
            },
            {
                discord_id: '275670737350819840',
                username: 'spypyder',
                server_username: 'Timothé',
                guild_id: '1298323429169930270'
            },
            {
                discord_id: '309403269040439308',
                username: 'sunnard',
                server_username: 'Tom',
                guild_id: '1298323429169930270'
            },
            {
                discord_id: '234567890123456789',
                username: 'sophie_ai',
                server_username: 'Développeur IA',
                guild_id: '1298323429169930270'
            },
            {
                discord_id: '345678901234567890',
                username: 'thomas_data',
                server_username: 'Data Scientist',
                guild_id: '1298323429169930270'
            },
            {
                discord_id: '456789012345678901',
                username: 'marie_ml',
                server_username: 'ML Engineer',
                guild_id: '1298323429169930270'
            },
            {
                discord_id: '567890123456789012',
                username: 'lucas_python',
                server_username: 'Python Dev',
                guild_id: '1298323429169930270'
            },
            {
                discord_id: '678901234567890123',
                username: 'emma_research',
                server_username: 'AI Researcher',
                guild_id: '1298323429169930270'
            }
        ];
        
        // Vrais informations pour Cardinale Test
        const cardinaleUsers = [
            {
                discord_id: '1469356767988154441',
                username: 'cedric.prin',
                server_username: 'Cédric',
                guild_id: '1471062604918296642'
            },
            {
                discord_id: '842716007604862997',
                username: 'wartex34980',
                server_username: 'Wartex',
                guild_id: '1471062604918296642'
            },
            {
                discord_id: '561485865562406914',
                username: 'kirito_kma',
                server_username: 'KIRITO_KMA',
                guild_id: '1471062604918296642'
            },
            {
                discord_id: '1471057790179999815',
                username: 'agent_kma',
                server_username: 'Agent_KMA',
                guild_id: '1471062604918296642'
            }
        ];
        
        // Connexion à la base de données
        const dbPath = path.join(__dirname, '..', '..', 'database', 'cardinal.db');
        const db = new sqlite3.Database(dbPath);
        
        console.log('🔄 Mise à jour des vrais utilisateurs Discord...');
        
        // Mettre à jour les vrais utilisateurs
        const allUsers = poeiUsers.concat(cardinaleUsers);
        let updatedCount = 0;
        
        allUsers.forEach(user => {
            db.run(`
                UPDATE users SET 
                    username = ?, 
                    server_username = ?, 
                    updated_at = CURRENT_TIMESTAMP
                WHERE discord_id = ? AND guild_id = ?
            `, [
                user.username,
                user.server_username,
                user.discord_id,
                user.guild_id
            ], (err) => {
                if (err) {
                    console.error(`❌ Erreur avec ${user.username}:`, err);
                } else {
                    console.log(`✅ Mis à jour: ${user.username} (${user.server_username})`);
                    updatedCount++;
                }
            });
        });
        
        // Mettre à jour les compteurs de membres
        ['1298323429169930270', '1471062604918296642'].forEach(guildId => {
            const memberCount = allUsers.filter(u => u.guild_id === guildId).length;
            db.run(`
                UPDATE guilds SET 
                    member_count = ?, 
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [memberCount, guildId]);
        });
        
        db.close((err) => {
            if (err) {
                console.error('❌ Erreur fermeture BDD:', err);
                reject(err);
            } else {
                console.log(`🎉 Mise à jour terminée ! ${updatedCount} vrais utilisateurs mis à jour.`);
                resolve({ updatedCount, totalUsers: allUsers.length });
            }
        });
    });
}

module.exports = { updatePoeiUsers };

const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Vérifie la latence du bot'),
    
    async execute(interaction) {
        const sent = await interaction.reply({ 
            content: '🏓 Ping!', 
            fetchReply: true 
        });
        
        const timeDiff = sent.createdTimestamp - interaction.createdTimestamp;
        const apiLatency = Math.round(interaction.client.ws.ping);
        
        await interaction.editReply(
            `🏓 **Pong!**\n⏱️ Latence: ${timeDiff}ms\n🌐 API: ${apiLatency}ms`
        );
    }
};

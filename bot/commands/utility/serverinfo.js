const { SlashCommandBuilder, ChannelType } = require('discord.js');
const embed = require('../../services/embedBuilder');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Affiche les informations du serveur')
    .setDMPermission(false),
  
  cooldown: 10,
  category: 'utility',
  
  async execute(interaction) {
    const { guild } = interaction;
    
    try {
      // Fetch owner
      const owner = await guild.fetchOwner();
      
      // Comptages membres
      const members = guild.members.cache;
      const humans = members.filter(m => !m.user.bot).size;
      const bots = members.filter(m => m.user.bot).size;
      const online = members.filter(m => 
        m.presence?.status && m.presence.status !== 'offline'
      ).size;
      
      // Comptages channels
      const channels = guild.channels.cache;
      const textChannels = channels.filter(c => c.type === ChannelType.GuildText).size;
      const voiceChannels = channels.filter(c => c.type === ChannelType.GuildVoice).size;
      const categories = channels.filter(c => c.type === ChannelType.GuildCategory).size;
      const threads = channels.filter(c => 
        c.type === ChannelType.PublicThread || 
        c.type === ChannelType.PrivateThread
      ).size;
      const forums = channels.filter(c => c.type === ChannelType.GuildForum).size;
      const stages = channels.filter(c => c.type === ChannelType.GuildStageVoice).size;
      
      // Niveau de vérification
      const verificationLevels = {
        0: 'Aucun',
        1: 'Faible (email vérifié)',
        2: 'Moyen (compte > 5 min)',
        3: 'Élevé (membre > 10 min)',
        4: 'Très élevé (téléphone vérifié)'
      };
      
      // Niveau de boost
      const boostLevels = {
        0: 'Niveau 0',
        1: 'Niveau 1 ✨',
        2: 'Niveau 2 ✨✨',
        3: 'Niveau 3 ✨✨✨'
      };
      
      // Fonctionnalités
      const features = guild.features.length > 0 
        ? guild.features.slice(0, 10).map(f => `\`${f.toLowerCase().replace(/_/g, ' ')}\``).join(', ')
        : 'Aucune';
      
      // Créer l'embed
      const serverEmbed = embed.create({
        title: `📊 ${guild.name}`,
        thumbnail: guild.iconURL({ dynamic: true, size: 512 }),
        color: 0x5865F2,
        fields: [
          {
            name: '📋 Général',
            value: [
              `**ID:** \`${guild.id}\``,
              `**Propriétaire:** ${owner.user.tag}`,
              `**Créé le:** <t:${Math.floor(guild.createdTimestamp / 1000)}:D>`,
              `**Âge:** <t:${Math.floor(guild.createdTimestamp / 1000)}:R>` 
            ].join('\n'),
            inline: true
          },
          {
            name: '🛡️ Sécurité',
            value: [
              `**Vérification:** ${verificationLevels[guild.verificationLevel]}`,
              `**2FA Modération:** ${guild.mfaLevel ? '✅ Requis' : '❌ Non requis'}`,
              `**Filtre contenu:** ${guild.explicitContentFilter === 2 ? '✅ Tous' : guild.explicitContentFilter === 1 ? '⚠️ Sans rôle' : '❌ Désactivé'}` 
            ].join('\n'),
            inline: true
          },
          {
            name: '\u200b',
            value: '\u200b',
            inline: true
          },
          {
            name: `👥 Membres (${guild.memberCount})`,
            value: [
              `**Humains:** ${humans}`,
              `**Bots:** ${bots}`,
              `**En ligne:** ${online}` 
            ].join('\n'),
            inline: true
          },
          {
            name: `📝 Channels (${channels.size})`,
            value: [
              `**Texte:** ${textChannels}`,
              `**Vocal:** ${voiceChannels}`,
              `**Catégories:** ${categories}`,
              threads > 0 ? `**Threads:** ${threads}` : null,
              forums > 0 ? `**Forums:** ${forums}` : null,
              stages > 0 ? `**Stages:** ${stages}` : null
            ].filter(Boolean).join('\n'),
            inline: true
          },
          {
            name: `🎭 Rôles (${guild.roles.cache.size})`,
            value: [
              `**Emojis:** ${guild.emojis.cache.size}`,
              `**Stickers:** ${guild.stickers.cache.size}` 
            ].join('\n'),
            inline: true
          },
          {
            name: '✨ Boost',
            value: [
              `**Niveau:** ${boostLevels[guild.premiumTier]}`,
              `**Boosts:** ${guild.premiumSubscriptionCount || 0}`,
              guild.premiumProgressBarEnabled ? '**Barre:** Activée' : null
            ].filter(Boolean).join('\n'),
            inline: true
          },
          {
            name: '🌟 Fonctionnalités',
            value: features
          }
        ],
        footer: `Demandé par ${interaction.user.tag}` 
      });
      
      // Ajouter bannière si disponible
      if (guild.bannerURL()) {
        serverEmbed.setImage(guild.bannerURL({ size: 1024 }));
      }
      
      return interaction.reply({ embeds: [serverEmbed] });
      
    } catch (error) {
      logger.error('Erreur commande serverinfo:', error);
      return interaction.reply({
        embeds: [embed.error('Erreur', 'Une erreur est survenue.')],
        ephemeral: true
      });
    }
  }
};

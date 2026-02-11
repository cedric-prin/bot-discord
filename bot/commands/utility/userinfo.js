const { SlashCommandBuilder, UserFlags } = require('discord.js');
const embed = require('../../services/embedBuilder');
const logger = require('../../utils/logger');

// Mapping des badges
const badgeEmojis = {
  Staff: '<:staff:1234567890> Discord Staff',
  Partner: '<:partner:1234567890> Partenaire',
  Hypesquad: '🏠 HypeSquad Events',
  BugHunterLevel1: '🐛 Bug Hunter',
  BugHunterLevel2: '🐛 Bug Hunter Gold',
  HypeSquadOnlineHouse1: '🏠 Bravery',
  HypeSquadOnlineHouse2: '🏠 Brilliance',
  HypeSquadOnlineHouse3: '🏠 Balance',
  PremiumEarlySupporter: '👑 Early Supporter',
  VerifiedDeveloper: '✅ Verified Bot Developer',
  CertifiedModerator: '🛡️ Certified Moderator',
  ActiveDeveloper: '👨‍💻 Active Developer'
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Affiche les informations d\'un utilisateur')
    .setDMPermission(false)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Utilisateur à afficher (par défaut: vous)')
        .setRequired(false)
    ),
  
  cooldown: 5,
  category: 'utility',
  
  async execute(interaction) {
    const user = interaction.options.getUser('user') || interaction.user;
    const member = interaction.guild.members.cache.get(user.id);
    
    try {
      // Fetch user pour avoir toutes les infos
      const fetchedUser = await user.fetch();
      
      // Badges
      const flags = fetchedUser.flags?.toArray() || [];
      const badges = flags.map(flag => badgeEmojis[flag] || flag).join('\n') || 'Aucun';
      
      // Couleur de l'embed (couleur accent de l'user ou rôle)
      const color = member?.displayHexColor !== '#000000' 
        ? member.displayHexColor 
        : fetchedUser.accentColor || 0x5865F2;
      
      // Créer l'embed
      const userEmbed = embed.create({
        title: `👤 ${user.tag}`,
        thumbnail: user.displayAvatarURL({ dynamic: true, size: 512 }),
        color: color,
        fields: [
          {
            name: '📋 Compte',
            value: [
              `**ID:** \`${user.id}\``,
              `**Créé le:** <t:${Math.floor(user.createdTimestamp / 1000)}:D>`,
              `**Âge:** <t:${Math.floor(user.createdTimestamp / 1000)}:R>`,
              `**Bot:** ${user.bot ? '✅ Oui' : '❌ Non'}` 
            ].join('\n'),
            inline: true
          }
        ]
      });
      
      // Infos membre si présent sur le serveur
      if (member) {
        userEmbed.addFields({
          name: '🏠 Serveur',
          value: [
            `**Rejoint le:** <t:${Math.floor(member.joinedTimestamp / 1000)}:D>`,
            `**Depuis:** <t:${Math.floor(member.joinedTimestamp / 1000)}:R>`,
            `**Surnom:** ${member.nickname || 'Aucun'}`,
            `**Booster:** ${member.premiumSince ? `<t:${Math.floor(member.premiumSinceTimestamp / 1000)}:R>` : '❌ Non'}` 
          ].join('\n'),
          inline: true
        });
        
        // Rôles
        const roles = member.roles.cache
          .filter(r => r.id !== interaction.guild.id)
          .sort((a, b) => b.position - a.position)
          .map(r => r.toString());
        
        const rolesDisplay = roles.length > 15 
          ? [...roles.slice(0, 15), `+${roles.length - 15} autres...`].join(', ')
          : roles.join(', ') || 'Aucun';
        
        userEmbed.addFields({
          name: `🎭 Rôles (${roles.length})`,
          value: rolesDisplay
        });
        
        // Rôle le plus élevé
        if (member.roles.highest.id !== interaction.guild.id) {
          userEmbed.addFields({
            name: '👑 Rôle principal',
            value: member.roles.highest.toString(),
            inline: true
          });
        }
        
        // Permissions clés
        const keyPerms = [];
        if (member.permissions.has('Administrator')) keyPerms.push('👑 Administrateur');
        else {
          if (member.permissions.has('ManageGuild')) keyPerms.push('⚙️ Gérer serveur');
          if (member.permissions.has('ManageChannels')) keyPerms.push('📝 Gérer channels');
          if (member.permissions.has('ManageRoles')) keyPerms.push('🎭 Gérer rôles');
          if (member.permissions.has('BanMembers')) keyPerms.push('🔨 Bannir');
          if (member.permissions.has('KickMembers')) keyPerms.push('👢 Expulser');
          if (member.permissions.has('ModerateMembers')) keyPerms.push('⏱️ Timeout');
          if (member.permissions.has('ManageMessages')) keyPerms.push('💬 Gérer messages');
        }
        
        if (keyPerms.length > 0) {
          userEmbed.addFields({
            name: '🔑 Permissions clés',
            value: keyPerms.join('\n'),
            inline: true
          });
        }
        
        // Statut/Activité
        if (member.presence) {
          const statusEmojis = {
            online: '🟢 En ligne',
            idle: '🟡 Absent',
            dnd: '🔴 Ne pas déranger',
            offline: '⚫ Hors ligne'
          };
          
          const activity = member.presence.activities[0];
          let activityText = statusEmojis[member.presence.status] || '⚫ Inconnu';
          
          if (activity) {
            const activityTypes = {
              0: 'Joue à',
              1: 'Streame',
              2: 'Écoute',
              3: 'Regarde',
              4: 'Statut:',
              5: 'En compétition sur'
            };
            activityText += `\n${activityTypes[activity.type] || 'Fait'} **${activity.name}**`;
            if (activity.details) activityText += `\n${activity.details}`;
          }
          
          userEmbed.addFields({
            name: '📡 Statut',
            value: activityText,
            inline: true
          });
        }
      } else {
        userEmbed.addFields({
          name: '🏠 Serveur',
          value: '❌ Non membre de ce serveur',
          inline: true
        });
      }
      
      // Badges
      userEmbed.addFields({
        name: '🏅 Badges',
        value: badges
      });
      
      // Bannière si disponible
      if (fetchedUser.bannerURL()) {
        userEmbed.setImage(fetchedUser.bannerURL({ size: 512 }));
      }
      
      userEmbed.setFooter({ text: `Demandé par ${interaction.user.tag}` });
      
      return interaction.reply({ embeds: [userEmbed] });
      
    } catch (error) {
      logger.error('Erreur commande userinfo:', error);
      return interaction.reply({
        embeds: [embed.error('Erreur', 'Une erreur est survenue.')],
        ephemeral: true
      });
    }
  }
};

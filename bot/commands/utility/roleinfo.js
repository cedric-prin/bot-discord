const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embed = require('../../services/embedBuilder');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roleinfo')
    .setDescription('Affiche les informations d\'un rôle')
    .setDMPermission(false)
    .addRoleOption(option =>
      option.setName('role')
        .setDescription('Rôle à afficher')
        .setRequired(true)
    ),
  
  cooldown: 5,
  category: 'utility',
  
  async execute(interaction) {
    const role = interaction.options.getRole('role');
    
    try {
      // Compter les membres avec ce rôle
      const memberCount = role.members.size;
      
      // Permissions importantes
      const permissions = role.permissions.toArray();
      const keyPerms = {
        Administrator: '👑 Administrateur',
        ManageGuild: '⚙️ Gérer le serveur',
        ManageChannels: '📝 Gérer les channels',
        ManageRoles: '🎭 Gérer les rôles',
        ManageMessages: '💬 Gérer les messages',
        BanMembers: '🔨 Bannir des membres',
        KickMembers: '👢 Expulser des membres',
        ModerateMembers: '⏱️ Timeout membres',
        ManageWebhooks: '🔗 Gérer les webhooks',
        ManageEmojisAndStickers: '😀 Gérer emojis',
        MentionEveryone: '📢 Mentionner @everyone',
        ManageNicknames: '📛 Gérer les pseudos',
        ViewAuditLog: '📋 Voir les logs',
        ManageEvents: '📅 Gérer les événements'
      };
      
      const importantPerms = permissions
        .filter(p => keyPerms[p])
        .map(p => keyPerms[p]);
      
      // Déterminer le texte des permissions
      let permsText;
      if (permissions.includes('Administrator')) {
        permsText = '👑 **Administrateur** (toutes les permissions)';
      } else if (importantPerms.length > 0) {
        permsText = importantPerms.join('\n');
      } else {
        permsText = 'Aucune permission notable';
      }
      
      // Propriétés du rôle
      const properties = [
        role.hoist ? '✅ Affiché séparément' : '❌ Non affiché séparément',
        role.mentionable ? '✅ Mentionnable' : '❌ Non mentionnable',
        role.managed ? '🤖 Géré par intégration' : '👤 Géré manuellement'
      ].join('\n');
      
      // Créer l'embed
      const roleEmbed = embed.create({
        title: `🎭 ${role.name}`,
        color: role.color || 0x99AAB5,
        fields: [
          {
            name: '📋 Général',
            value: [
              `**ID:** \`${role.id}\``,
              `**Couleur:** ${role.hexColor}`,
              `**Position:** ${role.position}/${interaction.guild.roles.cache.size}`,
              `**Créé le:** <t:${Math.floor(role.createdTimestamp / 1000)}:D>` 
            ].join('\n'),
            inline: true
          },
          {
            name: '⚙️ Propriétés',
            value: properties,
            inline: true
          },
          {
            name: `👥 Membres (${memberCount})`,
            value: memberCount > 0 
              ? memberCount <= 10 
                ? role.members.map(m => m.user.tag).join('\n')
                : `${role.members.first(5).map(m => m.user.tag).join('\n')}\n... et ${memberCount - 5} autres` 
              : 'Aucun membre',
            inline: true
          },
          {
            name: '🔑 Permissions notables',
            value: permsText
          }
        ],
        footer: `Demandé par ${interaction.user.tag}` 
      });
      
      // Ajouter icône du rôle si disponible
      if (role.iconURL()) {
        roleEmbed.setThumbnail(role.iconURL({ size: 256 }));
      }
      
      return interaction.reply({ embeds: [roleEmbed] });
      
    } catch (error) {
      logger.error('Erreur commande roleinfo:', error);
      return interaction.reply({
        embeds: [embed.error('Erreur', 'Une erreur est survenue.')],
        ephemeral: true
      });
    }
  }
};

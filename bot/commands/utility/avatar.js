const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const embed = require('../../services/embedBuilder');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('Affiche l\'avatar d\'un utilisateur')
    .setDMPermission(false)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Utilisateur (par défaut: vous)')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option.setName('server')
        .setDescription('Afficher l\'avatar serveur au lieu du global')
        .setRequired(false)
    ),
  
  cooldown: 5,
  category: 'utility',
  
  async execute(interaction) {
    const user = interaction.options.getUser('user') || interaction.user;
    const showServer = interaction.options.getBoolean('server') || false;
    const member = interaction.guild.members.cache.get(user.id);
    
    try {
      let avatarURL;
      let title;
      
      if (showServer && member && member.avatar) {
        // Avatar serveur
        avatarURL = member.displayAvatarURL({ dynamic: true, size: 4096 });
        title = `🖼️ Avatar serveur de ${user.tag}`;
      } else {
        // Avatar global
        avatarURL = user.displayAvatarURL({ dynamic: true, size: 4096 });
        title = `🖼️ Avatar de ${user.tag}`;
      }
      
      // Créer l'embed
      const avatarEmbed = embed.create({
        title: title,
        color: member?.displayHexColor !== '#000000' ? member.displayHexColor : 0x5865F2
      });
      
      // Ajouter l'image séparément
      avatarEmbed.setImage(avatarURL);
      
      // Boutons pour différents formats
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('PNG')
          .setStyle(ButtonStyle.Link)
          .setURL(user.displayAvatarURL({ extension: 'png', size: 4096 })),
        new ButtonBuilder()
          .setLabel('JPG')
          .setStyle(ButtonStyle.Link)
          .setURL(user.displayAvatarURL({ extension: 'jpg', size: 4096 })),
        new ButtonBuilder()
          .setLabel('WEBP')
          .setStyle(ButtonStyle.Link)
          .setURL(user.displayAvatarURL({ extension: 'webp', size: 4096 }))
      );
      
      // Ajouter bouton GIF si avatar animé
      if (user.avatar?.startsWith('a_')) {
        row.addComponents(
          new ButtonBuilder()
            .setLabel('GIF')
            .setStyle(ButtonStyle.Link)
            .setURL(user.displayAvatarURL({ extension: 'gif', size: 4096 }))
        );
      }
      
      // Ajouter bouton pour avatar serveur si différent
      if (member && member.avatar && !showServer) {
        row.addComponents(
          new ButtonBuilder()
            .setLabel('Avatar Serveur')
            .setStyle(ButtonStyle.Link)
            .setURL(member.displayAvatarURL({ dynamic: true, size: 4096 }))
        );
      }
      
      return interaction.reply({ 
        embeds: [avatarEmbed],
        components: [row]
      });
      
    } catch (error) {
      logger.error('Erreur commande avatar:', error);
      return interaction.reply({
        embeds: [embed.error('Erreur', 'Une erreur est survenue.')],
        flags: [4096] // Ephemeral flag
      });
    }
  }
};

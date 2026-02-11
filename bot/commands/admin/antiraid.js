const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embed = require('../../services/embedBuilder');
const modLogger = require('../../services/modLogger');
const logger = require('../../utils/logger');

// Importer les states depuis l'event
const { lockdownGuilds, recentJoins } = require('../../events/guildMemberAdd');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('antiraid')
    .setDescription('Contrôler l\'anti-raid')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addSubcommand(sub =>
      sub.setName('on')
        .setDescription('Activer le lockdown (kick auto nouveaux membres)')
    )
    .addSubcommand(sub =>
      sub.setName('off')
        .setDescription('Désactiver le lockdown')
    )
    .addSubcommand(sub =>
      sub.setName('status')
        .setDescription('Voir le statut de l\'anti-raid')
    ),
  
  cooldown: 5,
  category: 'admin',
  
  async execute(interaction) {
    const { guild, user } = interaction;
    const subcommand = interaction.options.getSubcommand();
    
    try {
      switch (subcommand) {
        case 'on': {
          // Vérifier si déjà actif
          if (lockdownGuilds.has(guild.id)) {
            return interaction.reply({
              embeds: [embed.warning('Déjà actif', 'Le lockdown est déjà activé.')],
              ephemeral: true
            });
          }
          
          // Activer
          lockdownGuilds.set(guild.id, {
            activatedAt: Date.now(),
            activatedBy: user.id,
            manual: true
          });
          
          // Log
          await modLogger.logSystem(guild, {
            title: '🔒 Lockdown activé manuellement',
            description: `Activé par ${user.tag}\nLes nouveaux membres seront automatiquement kickés.`,
            type: 'warning'
          });
          
          logger.info(`[ANTIRAID] Lockdown manuel activé par ${user.tag} sur ${guild.name}`);
          
          return interaction.reply({
            embeds: [embed.success(
              '🔒 Lockdown activé',
              'Les nouveaux membres seront automatiquement kickés.\n\n' +
              '⚠️ N\'oubliez pas de désactiver avec `/antiraid off` !'
            )]
          });
        }
        
        case 'off': {
          // Vérifier si actif
          if (!lockdownGuilds.has(guild.id)) {
            return interaction.reply({
              embeds: [embed.warning('Pas actif', 'Le lockdown n\'est pas activé.')],
              ephemeral: true
            });
          }
          
          const lockdownInfo = lockdownGuilds.get(guild.id);
          const duration = Date.now() - lockdownInfo.activatedAt;
          
          // Désactiver
          lockdownGuilds.delete(guild.id);
          
          // Log
          await modLogger.logSystem(guild, {
            title: '🔓 Lockdown désactivé',
            description: `Désactivé par ${user.tag}\nDurée: ${Math.floor(duration / 1000)}s`,
            type: 'success'
          });
          
          logger.info(`[ANTIRAID] Lockdown désactivé par ${user.tag} sur ${guild.name}`);
          
          return interaction.reply({
            embeds: [embed.success(
              '🔓 Lockdown désactivé',
              'Les nouveaux membres peuvent à nouveau rejoindre normalement.'
            )]
          });
        }
        
        case 'status': {
          const isActive = lockdownGuilds.has(guild.id);
          const recentJoinsList = recentJoins.get(guild.id) || [];
          
          const statusEmbed = embed.info(
            '🛡️ Statut Anti-Raid',
            isActive ? '🔴 **LOCKDOWN ACTIF**' : '🟢 **Normal**'
          );
          
          if (isActive) {
            const info = lockdownGuilds.get(guild.id);
            const since = Math.floor(info.activatedAt / 1000);
            
            statusEmbed.addFields(
              { 
                name: '⏱️ Actif depuis', 
                value: `<t:${since}:R>`, 
                inline: true 
              },
              { 
                name: '👤 Activé par', 
                value: info.manual ? `<@${info.activatedBy}>` : 'Automatique', 
                inline: true 
              }
            );
          }
          
          // Joins récents
          const now = Date.now();
          const last10Sec = recentJoinsList.filter(j => now - j.timestamp < 10000);
          const last60Sec = recentJoinsList.filter(j => now - j.timestamp < 60000);
          
          statusEmbed.addFields({
            name: '📊 Joins récents',
            value: `10 dernières sec: **${last10Sec.length}**\n60 dernières sec: **${last60Sec.length}**` 
          });
          
          return interaction.reply({ embeds: [statusEmbed] });
        }
      }
      
    } catch (error) {
      logger.error('Erreur commande antiraid:', error);
      return interaction.reply({
        embeds: [embed.error('Erreur', 'Une erreur est survenue.')],
        ephemeral: true
      });
    }
  }
};

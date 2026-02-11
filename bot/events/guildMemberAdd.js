const { Collection } = require('discord.js');
const guildRepo = require('../../database/js/repositories/guildRepo');
const modLogger = require('../services/modLogger');
const embed = require('../services/embedBuilder');
const logger = require('../utils/logger');

// Suivi des joins récents par guild
const recentJoins = new Collection();

// Guilds en lockdown
const lockdownGuilds = new Collection();

// Export pour accès externe (commande /antiraid)
module.exports = {
  name: 'guildMemberAdd',
  lockdownGuilds,
  recentJoins,
  
  async execute(member) {
    const { guild, user } = member;
    
    try {
      // Récupérer config
      const settings = await guildRepo.getSettings(guild.id);
      const antiraid = settings?.automod?.antiraid;
      
      if (!antiraid?.enabled) {
        // Juste log le join
        await modLogger.logMemberJoin(guild, member, false);
        return;
      }
      
      const {
        joinThreshold = 10,     // Nombre de joins
        joinWindow = 10000,     // Fenêtre en ms (10 sec)
        accountAge = 7,         // Jours minimum
        action = 'lockdown'     // lockdown, kick, ou log
      } = antiraid;
      
      // Vérifier si déjà en lockdown
      if (lockdownGuilds.has(guild.id)) {
        // Kick automatique pendant lockdown
        if (action === 'lockdown') {
          await member.kick('Anti-Raid: Lockdown actif').catch(() => {});
          await modLogger.logMemberJoin(guild, member, true);
          return;
        }
      }
      
      // Enregistrer le join
      if (!recentJoins.has(guild.id)) {
        recentJoins.set(guild.id, []);
      }
      
      const joins = recentJoins.get(guild.id);
      const now = Date.now();
      
      joins.push({
        id: user.id,
        timestamp: now,
        accountCreated: user.createdTimestamp
      });
      
      // Nettoyer les vieux joins
      const recentWindow = joins.filter(j => now - j.timestamp < joinWindow);
      recentJoins.set(guild.id, recentWindow);
      
      // CHECK 1: Compte trop récent
      const accountAgeDays = Math.floor((now - user.createdTimestamp) / (1000 * 60 * 60 * 24));
      const isSuspiciousAge = accountAgeDays < accountAge;
      
      // CHECK 2: Trop de joins
      const isRaid = recentWindow.length >= joinThreshold;
      
      // Log membre suspect
      if (isSuspiciousAge) {
        await modLogger.logMemberJoin(guild, member, true);
      } else {
        await modLogger.logMemberJoin(guild, member, false);
      }
      
      // Déclencher anti-raid
      if (isRaid) {
        await triggerAntiRaid(guild, action, joinThreshold, settings);
      }
      
    } catch (error) {
      logger.error('Erreur guildMemberAdd:', error);
    }
  }
};

/**
 * Déclencher les mesures anti-raid
 */
async function triggerAntiRaid(guild, action, threshold, settings) {
  // Éviter double trigger
  if (lockdownGuilds.has(guild.id)) return;
  
  logger.warn(`[ANTI-RAID] Raid détecté sur ${guild.name}! (${threshold}+ joins)`);
  
  switch (action) {
    case 'lockdown':
      // Activer le lockdown
      lockdownGuilds.set(guild.id, {
        activatedAt: Date.now(),
        threshold: threshold
      });
      
      // Envoyer alerte
      const alertChannel = settings?.logChannelId 
        ? guild.channels.cache.get(settings.logChannelId)
        : null;
      
      if (alertChannel) {
        const alertEmbed = embed.error(
          '🚨 RAID DÉTECTÉ - LOCKDOWN ACTIVÉ',
          `**${threshold}+** membres ont rejoint en moins de 10 secondes.\n\n` +
          `**Actions en cours:**\n` +
          `• Nouveaux membres kickés automatiquement\n` +
          `• Alerte envoyée aux modérateurs\n\n` +
          `Utilisez \`/antiraid off\` pour désactiver le lockdown.` 
        );
        
        await alertChannel.send({ 
          content: settings?.modRoleId ? `<@&${settings.modRoleId}>` : '@here',
          embeds: [alertEmbed]
        });
      }
      
      // Log système
      await modLogger.logSystem(guild, {
        title: '🚨 Anti-Raid activé',
        description: `Lockdown déclenché suite à ${threshold}+ joins simultanés`,
        type: 'error'
      });
      
      // Auto-désactivation après 5 minutes
      setTimeout(() => {
        if (lockdownGuilds.has(guild.id)) {
          lockdownGuilds.delete(guild.id);
          modLogger.logSystem(guild, {
            title: '🔓 Lockdown terminé',
            description: 'Le lockdown automatique a expiré (5 minutes)',
            type: 'success'
          });
        }
      }, 5 * 60 * 1000);
      break;
      
    case 'kick':
      // Kicker les derniers joins
      const recentMembers = recentJoins.get(guild.id) || [];
      
      for (const join of recentMembers) {
        const memberToKick = await guild.members.fetch(join.id).catch(() => null);
        if (memberToKick) {
          await memberToKick.kick('Anti-Raid: Join massif détecté').catch(() => {});
        }
      }
      
      await modLogger.logSystem(guild, {
        title: '⚡ Anti-Raid',
        description: `${recentMembers.length} membres kickés suite à un raid détecté`,
        type: 'warning'
      });
      break;
      
    case 'log':
      // Juste alerter
      await modLogger.logSystem(guild, {
        title: '⚠️ Raid potentiel détecté',
        description: `${threshold}+ membres ont rejoint en moins de 10 secondes`,
        type: 'warning'
      });
      break;
  }
}

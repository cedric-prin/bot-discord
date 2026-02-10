// Service permissions
const { PermissionFlagsBits } = require('discord.js');
const { PERMISSIONS } = require('../../config/constants');

class PermissionService {
  
  // Vérifie si le membre a la permission requise
  hasPermission(member, permission) {
    return member.permissions.has(permission);
  }
  
  // Vérifie si user peut modérer la cible
  canModerate(moderator, target, guild) {
    // Impossible de se modérer soi-même
    if (moderator.id === target.id) {
      return { allowed: false, reason: 'Vous ne pouvez pas vous modérer vous-même.' };
    }
    
    // Impossible de modérer le bot
    if (target.id === guild.members.me.id) {
      return { allowed: false, reason: 'Vous ne pouvez pas modérer le bot.' };
    }
    
    // Impossible de modérer le propriétaire
    if (target.id === guild.ownerId) {
      return { allowed: false, reason: 'Vous ne pouvez pas modérer le propriétaire du serveur.' };
    }
    
    // Vérifier hiérarchie des rôles
    const moderatorHighest = moderator.roles.highest.position;
    const targetHighest = target.roles.highest.position;
    
    if (targetHighest >= moderatorHighest) {
      return { 
        allowed: false, 
        reason: 'Vous ne pouvez pas modérer un membre avec un rôle égal ou supérieur.' 
      };
    }
    
    // Vérifier que le bot peut agir sur la cible
    const botHighest = guild.members.me.roles.highest.position;
    if (targetHighest >= botHighest) {
      return { 
        allowed: false, 
        reason: 'Je ne peux pas modérer ce membre (son rôle est trop élevé).' 
      };
    }
    
    return { allowed: true };
  }
  
  // Vérifie permission pour une commande spécifique
  checkCommandPermission(member, command) {
    const requiredPerms = PERMISSIONS[command.toUpperCase()];
    
    if (!requiredPerms) return { allowed: true };
    
    const missing = [];
    for (const perm of requiredPerms) {
      if (!member.permissions.has(perm)) {
        missing.push(perm);
      }
    }
    
    if (missing.length > 0) {
      return {
        allowed: false,
        reason: `Permissions manquantes: ${missing.join(', ')}` 
      };
    }
    
    return { allowed: true };
  }
  
  // Vérifie si le bot a les permissions nécessaires
  botCanExecute(guild, action) {
    const botMember = guild.members.me;
    
    const requiredPerms = {
      kick: [PermissionFlagsBits.KickMembers],
      ban: [PermissionFlagsBits.BanMembers],
      mute: [PermissionFlagsBits.ModerateMembers],
      delete: [PermissionFlagsBits.ManageMessages],
      manage_roles: [PermissionFlagsBits.ManageRoles]
    };
    
    const perms = requiredPerms[action];
    if (!perms) return { allowed: true };
    
    for (const perm of perms) {
      if (!botMember.permissions.has(perm)) {
        return {
          allowed: false,
          reason: `Je n'ai pas la permission: ${perm}` 
        };
      }
    }
    
    return { allowed: true };
  }
  
  // Vérification complète avant action de modération
  async fullCheck(interaction, target, action) {
    const { member, guild } = interaction;
    
    // 1. Permission du modérateur
    const cmdCheck = this.checkCommandPermission(member, action);
    if (!cmdCheck.allowed) return cmdCheck;
    
    // 2. Le bot peut exécuter
    const botCheck = this.botCanExecute(guild, action);
    if (!botCheck.allowed) return botCheck;
    
    // 3. Hiérarchie et restrictions
    const targetMember = await guild.members.fetch(target.id).catch(() => null);
    if (targetMember) {
      const modCheck = this.canModerate(member, targetMember, guild);
      if (!modCheck.allowed) return modCheck;
    }
    
    return { allowed: true };
  }
}

module.exports = new PermissionService();
/**
 * Service de validation des permissions pour le bot Discord Cardinal
 * Fournit des vérifications complètes des permissions utilisateur et des hiérarchies
 */

const { PermissionFlagsBits } = require('discord.js');
const logger = require('../utils/logger');

class PermissionService {
    
    /**
     * Vérifie si le membre a la permission requise
     * @param {GuildMember} member - Membre à vérifier
     * @param {BigInt|Array} permission - Permission(s) à vérifier
     * @returns {boolean} - True si la permission est accordée
     */
    hasPermission(member, permission) {
        if (Array.isArray(permission)) {
            return permission.every(perm => member.permissions.has(perm));
        }
        return member.permissions.has(permission);
    }
    
    /**
     * Vérifie si un utilisateur peut modérer une cible
     * @param {GuildMember} moderator - Modérateur
     * @param {GuildMember} target - Cible
     * @param {Guild} guild - Serveur
     * @returns {Object} - { allowed: boolean, reason?: string }
     */
    canModerate(moderator, target, guild) {
        // Impossible de se modérer soi-même
        if (moderator.id === target.id) {
            return { allowed: false, reason: 'Vous ne pouvez pas vous modérer vous-même.' };
        }
        
        // Impossible de modérer le bot
        if (target.id === guild.members.me.id) {
            return { allowed: false, reason: 'Vous ne pouvez pas modérer le bot.' };
        }
        
        // Impossible de modérer le propriétaire (sauf si c'est le propriétaire lui-même)
        if (target.id === guild.ownerId && moderator.id !== guild.ownerId) {
            return { allowed: false, reason: 'Vous ne pouvez pas modérer le propriétaire du serveur.' };
        }
        
        // Le propriétaire peut modérer tout le monde
        if (moderator.id === guild.ownerId) {
            return { allowed: true };
        }
        
        // Vérifier la hiérarchie des rôles
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
    
    /**
     * Vérifie les permissions pour une commande spécifique
     * @param {GuildMember} member - Membre exécutant la commande
     * @param {string} command - Nom de la commande
     * @returns {Object} - { allowed: boolean, reason?: string }
     */
    checkCommandPermission(member, command) {
        const requiredPerms = this.getRequiredPermissions(command);
        
        if (!requiredPerms || requiredPerms.length === 0) {
            return { allowed: true };
        }
        
        const missing = requiredPerms.filter(perm => !member.permissions.has(perm));
        
        if (missing.length > 0) {
            return {
                allowed: false,
                reason: `Permissions manquantes: ${this.formatPermissions(missing)}` 
            };
        }
        
        return { allowed: true };
    }
    
    /**
     * Vérifie si le bot a les permissions nécessaires pour une action
     * @param {Guild} guild - Serveur
     * @param {string} action - Action à vérifier
     * @returns {Object} - { allowed: boolean, reason?: string }
     */
    botCanExecute(guild, action) {
        const botMember = guild.members.me;
        const requiredPerms = this.getRequiredPermissions(action);
        
        if (!requiredPerms || requiredPerms.length === 0) {
            return { allowed: true };
        }
        
        const missing = requiredPerms.filter(perm => !botMember.permissions.has(perm));
        
        if (missing.length > 0) {
            return {
                allowed: false,
                reason: `Je n'ai pas les permissions nécessaires: ${this.formatPermissions(missing)}` 
            };
        }
        
        return { allowed: true };
    }
    
    /**
     * Vérification complète avant action de modération
     * @param {CommandInteraction} interaction - Interaction Discord
     * @param {User} target - Utilisateur cible
     * @param {string} action - Action de modération
     * @returns {Object} - { allowed: boolean, reason?: string }
     */
    async fullCheck(interaction, target, action) {
        const { member, guild } = interaction;
        
        try {
            // 1. Permission du modérateur pour la commande
            const cmdCheck = this.checkCommandPermission(member, action);
            if (!cmdCheck.allowed) {
                logger.debug(`Permission refusée pour ${member.user.tag}: ${cmdCheck.reason}`);
                return cmdCheck;
            }
            
            // 2. Le bot peut exécuter l'action
            const botCheck = this.botCanExecute(guild, action);
            if (!botCheck.allowed) {
                logger.debug(`Bot ne peut pas exécuter ${action}: ${botCheck.reason}`);
                return botCheck;
            }
            
            // 3. Récupérer le membre cible
            const targetMember = await guild.members.fetch(target.id).catch(() => null);
            if (!targetMember) {
                return {
                    allowed: false,
                    reason: 'Utilisateur non trouvé sur ce serveur.'
                };
            }
            
            // 4. Vérifier la hiérarchie et les restrictions
            const modCheck = this.canModerate(member, targetMember, guild);
            if (!modCheck.allowed) {
                logger.debug(`Modération refusée: ${modCheck.reason}`);
                return modCheck;
            }
            
            // 5. Vérifications spécifiques selon l'action
            const specificCheck = this.checkSpecificConstraints(targetMember, action);
            if (!specificCheck.allowed) {
                return specificCheck;
            }
            
            logger.debug(`Vérification permissions réussie pour ${action} sur ${target.tag}`);
            return { allowed: true };
            
        } catch (error) {
            logger.error('Erreur lors de la vérification des permissions:', error);
            return {
                allowed: false,
                reason: 'Une erreur est survenue lors de la vérification des permissions.'
            };
        }
    }
    
    /**
     * Vérifie les contraintes spécifiques selon l'action
     * @param {GuildMember} targetMember - Membre ciblé
     * @param {string} action - Action à vérifier
     * @returns {Object} - { allowed: boolean, reason?: string }
     */
    checkSpecificConstraints(targetMember, action) {
        switch (action) {
            case 'kick':
                if (!targetMember.kickable) {
                    return {
                        allowed: false,
                        reason: 'Impossible d\'expulser cet utilisateur (permissions insuffisantes du bot).'
                    };
                }
                break;
                
            case 'ban':
                if (!targetMember.bannable) {
                    return {
                        allowed: false,
                        reason: 'Impossible de bannir cet utilisateur (permissions insuffisantes du bot).'
                    };
                }
                break;
                
            case 'mute':
                if (!targetMember.manageable) {
                    return {
                        allowed: false,
                        reason: 'Impossible de rendre muet cet utilisateur (permissions insuffisantes du bot).'
                    };
                }
                break;
        }
        
        return { allowed: true };
    }
    
    /**
     * Retourne les permissions requises pour une action
     * @param {string} action - Action ou commande
     * @returns {Array} - Tableau des permissions requises
     */
    getRequiredPermissions(action) {
        const permissions = {
            warn: [PermissionFlagsBits.ModerateMembers],
            kick: [PermissionFlagsBits.KickMembers],
            ban: [PermissionFlagsBits.BanMembers],
            mute: [PermissionFlagsBits.ModerateMembers],
            unmute: [PermissionFlagsBits.ModerateMembers],
            clear: [PermissionFlagsBits.ManageMessages],
            slowmode: [PermissionFlagsBits.ManageChannels],
            lock: [PermissionFlagsBits.ManageChannels],
            unlock: [PermissionFlagsBits.ManageChannels],
            delete: [PermissionFlagsBits.ManageMessages]
        };
        
        return permissions[action.toLowerCase()] || [];
    }
    
    /**
     * Formate un tableau de permissions en texte lisible
     * @param {Array} permissions - Tableau de permissions
     * @returns {string} - Texte formaté
     */
    formatPermissions(permissions) {
        const permissionNames = {
            [PermissionFlagsBits.ModerateMembers]: 'Modérer les membres',
            [PermissionFlagsBits.KickMembers]: 'Expulser des membres',
            [PermissionFlagsBits.BanMembers]: 'Bannir des membres',
            [PermissionFlagsBits.ManageMessages]: 'Gérer les messages',
            [PermissionFlagsBits.ManageChannels]: 'Gérer les salons',
            [PermissionFlagsBits.Administrator]: 'Administrateur'
        };

        return permissions
            .map(perm => permissionNames[perm] || `Permission inconnue (${perm})`)
            .join(', ');
    }
    
    /**
     * Vérifie si un utilisateur est un administrateur
     * @param {GuildMember} member - Membre à vérifier
     * @returns {boolean} - True si administrateur
     */
    isAdmin(member) {
        return member.permissions.has(PermissionFlagsBits.Administrator) || member.id === member.guild.ownerId;
    }
}

module.exports = new PermissionService();
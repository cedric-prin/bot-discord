class InviteFilter {
  constructor() {
    // Regex pour les invites Discord
    this.inviteRegex = /(?:https?:\/\/)?(?:www\.)?(?:discord\.(?:gg|io|me|li|com\/invite)|discordapp\.com\/invite)\/[a-zA-Z0-9]+/gi;
    
    // Regex pour variantes obfusquées
    this.obfuscatedRegex = /(?:d[1i!]sc[o0]rd\.gg|d[1i!]sc[o0]rd\.com\/invite)\/[a-zA-Z0-9]+/gi;
  }
  
  /**
   * Vérifier si un message contient une invitation
   */
  async check(message, config) {
    const {
      allowOwnServer = true,  // Autoriser invites du serveur actuel
      allowedServers = [],    // IDs de serveurs autorisés
      action = 'delete'
    } = config;
    
    const content = message.content;
    
    // Chercher les invites
    const invites = content.match(this.inviteRegex) || [];
    const obfuscated = content.match(this.obfuscatedRegex) || [];
    
    const allInvites = [...invites, ...obfuscated];
    
    if (allInvites.length === 0) {
      return { triggered: false };
    }
    
    // Vérifier chaque invite
    for (const inviteUrl of allInvites) {
      // Extraire le code d'invite
      const code = inviteUrl.split('/').pop();
      
      try {
        // Récupérer les infos de l'invite
        const invite = await message.client.fetchInvite(code).catch(() => null);
        
        if (!invite) {
          // Invite invalide ou expirée - on supprime quand même par sécurité
          return {
            triggered: true,
            action: action,
            reason: 'Invitation Discord détectée (invalide)',
            matchedContent: inviteUrl
          };
        }
        
        // Autoriser si c'est le serveur actuel
        if (allowOwnServer && invite.guild?.id === message.guild.id) {
          continue;
        }
        
        // Autoriser si serveur dans la whitelist
        if (allowedServers.includes(invite.guild?.id)) {
          continue;
        }
        
        // Sinon, bloquer
        return {
          triggered: true,
          action: action,
          reason: `Invitation vers ${invite.guild?.name || 'serveur inconnu'}`,
          matchedContent: inviteUrl
        };
        
      } catch (error) {
        // En cas d'erreur, bloquer par sécurité
        return {
          triggered: true,
          action: action,
          reason: 'Invitation Discord détectée',
          matchedContent: inviteUrl
        };
      }
    }
    
    return { triggered: false };
  }
}

module.exports = new InviteFilter();

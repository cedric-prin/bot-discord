class LinksFilter {
  constructor() {
    // Regex pour les URLs
    this.urlRegex = /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;
    
    // Domaines sûrs par défaut
    this.defaultWhitelist = [
      'discord.com',
      'discordapp.com',
      'discord.gg',
      'tenor.com',
      'giphy.com',
      'imgur.com',
      'youtube.com',
      'youtu.be',
      'twitch.tv',
      'twitter.com',
      'x.com',
      'github.com',
      'reddit.com'
    ];
    
    // Domaines suspects (phishing courants)
    this.suspiciousDomains = [
      'discord-gift',
      'discordnitro',
      'steamcommunity-',
      'free-nitro',
      'dlscord',
      'discorcl'
    ];
  }
  
  /**
   * Vérifier si un message contient des liens non autorisés
   */
  async check(message, config) {
    const {
      whitelist = [],         // Domaines autorisés supplémentaires
      useDefaultWhitelist = true,
      blockSuspicious = true, // Bloquer domaines suspects
      blockAll = false,       // Bloquer tous les liens
      action = 'delete'
    } = config;
    
    const content = message.content;
    const urls = content.match(this.urlRegex) || [];
    
    if (urls.length === 0) {
      return { triggered: false };
    }
    
    // Construire la whitelist complète
    const fullWhitelist = useDefaultWhitelist
      ? [...this.defaultWhitelist, ...whitelist]
      : whitelist;
    
    for (const url of urls) {
      try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname.toLowerCase().replace('www.', '');
        
        // Vérifier domaines suspects d'abord
        if (blockSuspicious) {
          const isSuspicious = this.suspiciousDomains.some(
            sus => domain.includes(sus)
          );
          
          if (isSuspicious) {
            return {
              triggered: true,
              action: 'warn', // Toujours warn pour les suspects
              reason: `Lien suspect détecté (possible phishing)`,
              matchedContent: url
            };
          }
        }
        
        // Si blockAll, bloquer tout ce qui n'est pas whitelist
        if (blockAll) {
          const isWhitelisted = fullWhitelist.some(
            wl => domain === wl || domain.endsWith('.' + wl)
          );
          
          if (!isWhitelisted) {
            return {
              triggered: true,
              action: action,
              reason: `Lien non autorisé`,
              matchedContent: url
            };
          }
        }
        
      } catch (e) {
        // URL invalide, ignorer
      }
    }
    
    return { triggered: false };
  }
}

module.exports = new LinksFilter();

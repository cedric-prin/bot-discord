class MentionsFilter {
  /**
   * Vérifier si un message abuse des mentions
   */
  async check(message, config) {
    const {
      maxUserMentions = 5,   // Max mentions d'utilisateurs
      maxRoleMentions = 3,   // Max mentions de rôles
      blockEveryone = true,  // Bloquer @everyone/@here
      action = 'delete'
    } = config;
    
    const { mentions, content } = message;
    
    // Check @everyone/@here
    if (blockEveryone && (mentions.everyone || content.includes('@everyone') || content.includes('@here'))) {
      // Vérifier si l'utilisateur a la permission
      if (!message.member.permissions.has('MentionEveryone')) {
        return {
          triggered: true,
          action: action,
          reason: `Tentative de @everyone/@here sans permission`,
          matchedContent: null
        };
      }
    }
    
    // Check mentions utilisateurs
    const userMentions = mentions.users.size;
    if (userMentions > maxUserMentions) {
      return {
        triggered: true,
        action: action,
        reason: `Trop de mentions (${userMentions} utilisateurs)`,
        matchedContent: null
      };
    }
    
    // Check mentions rôles
    const roleMentions = mentions.roles.size;
    if (roleMentions > maxRoleMentions) {
      return {
        triggered: true,
        action: action,
        reason: `Trop de mentions (${roleMentions} rôles)`,
        matchedContent: null
      };
    }
    
    return { triggered: false };
  }
}

module.exports = new MentionsFilter();

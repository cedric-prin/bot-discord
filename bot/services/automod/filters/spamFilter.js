const { Collection } = require('discord.js');

class SpamFilter {
  constructor() {
    // Historique des messages par utilisateur
    this.messageHistory = new Collection();
    
    // Nettoyage périodique
    setInterval(() => this.cleanup(), 60000);
  }
  
  /**
   * Vérifier si un message est du spam
   */
  async check(message, config) {
    const defaultConfig = {
      maxMessages: 5,
      timeWindow: 5000,
      maxDuplicates: 3,
      similarityThreshold: 0.85,
      action: 'delete'
    };
    
    const finalConfig = { ...config, ...defaultConfig };
    
    config = finalConfig;
    
    const key = `${message.guild.id}-${message.author.id}`;
    const now = Date.now();
    
    // Récupérer l'historique
    if (!this.messageHistory.has(key)) {
      this.messageHistory.set(key, []);
    }
    
    const history = this.messageHistory.get(key);
    
    // Ajouter le message actuel
    history.push({
      content: message.content.toLowerCase(),
      timestamp: now
    });
    
    // Filtrer les messages dans la fenêtre
    const recentMessages = history.filter(
      msg => now - msg.timestamp < timeWindow
    );
    
    // CHECK 1: Flood (trop de messages)
    if (recentMessages.length > maxMessages) {
      return {
        triggered: true,
        action: action,
        reason: `Flood détecté (${recentMessages.length} messages en ${timeWindow/1000}s)`,
        matchedContent: null
      };
    }
    
    // CHECK 2: Messages identiques
    const duplicates = recentMessages.filter(
      msg => msg.content === message.content.toLowerCase()
    );
    
    if (duplicates.length > maxDuplicates) {
      return {
        triggered: true,
        action: action,
        reason: `Messages identiques répétés (${duplicates.length}x)`,
        matchedContent: message.content.substring(0, 100)
      };
    }
    
    // CHECK 3: Messages similaires
    if (recentMessages.length >= 3) {
      let similarCount = 0;
      
      for (const msg of recentMessages.slice(0, -1)) {
        const similarity = this.calculateSimilarity(
          msg.content,
          message.content.toLowerCase()
        );
        
        if (similarity >= similarityThreshold) {
          similarCount++;
        }
      }
      
      if (similarCount >= maxDuplicates) {
        return {
          triggered: true,
          action: action,
          reason: `Messages similaires répétés`,
          matchedContent: message.content.substring(0, 100)
        };
      }
    }
    
    return { triggered: false };
  }
  
  /**
   * Calcul de similarité (Levenshtein simplifié)
   */
  calculateSimilarity(str1, str2) {
    if (str1 === str2) return 1;
    if (!str1 || !str2) return 0;
    
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }
  
  /**
   * Distance de Levenshtein
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }
  
  /**
   * Nettoyage des vieux messages
   */
  cleanup() {
    const now = Date.now();
    const maxAge = 30000; // 30 secondes
    
    for (const [key, messages] of this.messageHistory) {
      const recent = messages.filter(msg => now - msg.timestamp < maxAge);
      
      if (recent.length === 0) {
        this.messageHistory.delete(key);
      } else {
        this.messageHistory.set(key, recent);
      }
    }
  }
  
  /**
   * Reset l'historique d'un user
   */
  resetUser(guildId, userId) {
    this.messageHistory.delete(`${guildId}-${userId}`);
  }
}

module.exports = new SpamFilter();

class CapsFilter {
  /**
   * Vérifier si un message abuse des majuscules
   */
  async check(message, config) {
    const {
      maxPercentage = 70,   // Max % de majuscules
      minLength = 10,       // Minimum de caractères pour vérifier
      action = 'delete'
    } = config;
    
    const content = message.content;
    
    // Extraire seulement les lettres
    const letters = content.replace(/[^a-zA-ZÀ-ÿ]/g, '');
    
    // Vérifier longueur minimale
    if (letters.length < minLength) {
      return { triggered: false };
    }
    
    // Compter les majuscules
    const uppercase = letters.replace(/[^A-ZÀ-Ÿ]/g, '');
    const percentage = (uppercase.length / letters.length) * 100;
    
    if (percentage > maxPercentage) {
      return {
        triggered: true,
        action: action,
        reason: `Abus de majuscules (${Math.round(percentage)}%)`,
        matchedContent: content.substring(0, 50) + (content.length > 50 ? '...' : '')
      };
    }
    
    return { triggered: false };
  }
}

module.exports = new CapsFilter();

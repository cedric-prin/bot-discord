class BadwordsFilter {
  constructor() {
    // Mapping caractères l33t speak
    this.leetMap = {
      '4': 'a', '@': 'a', '8': 'b', '(': 'c', '3': 'e',
      '6': 'g', '#': 'h', '1': 'i', '!': 'i', '|': 'i',
      '0': 'o', '5': 's', '$': 's', '7': 't', '+': 't',
      'µ': 'u', '2': 'z'
    };

    // Liste par défaut (peut être étendue par config)
    this.defaultBadwords = [
      // Ajouter des mots français/anglais courants
      'test', 'insulte', 'merde', 'pute', 'connard',
      'salope', 'enculé', 'fdp', 'ntm',
      'spam', 'abuser', 'toxic', 'cancer', 'nazi',
      'kill', 'mort', 'suicide', 'drogue', 'toxic'
    ];

    // Cache pour les mots par serveur (5 minutes)
    this.wordsCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000;
  }

  /**
   * Récupérer les mots interdits pour un serveur (avec cache)
   */
  async getGuildBadwords(guildId) {
    const cached = this.wordsCache.get(guildId);

    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.words;
    }

    try {
      const badwordsRepo = require('../../../../../database/js/repositories/badwordsRepo');
      const words = await badwordsRepo.getGuildBadwords(guildId);

      this.wordsCache.set(guildId, {
        words,
        timestamp: Date.now()
      });

      return words;
    } catch (error) {
      console.error('Erreur récupération badwords:', error);
      return [];
    }
  }

  /**
   * Vider le cache pour un serveur
   */
  clearCache(guildId) {
    this.wordsCache.delete(guildId);
  }

  /**
   * Vérifier si un message contient des mots interdits
   */
  async check(message, config) {
    const {
      useDefault = true,    // Utiliser la liste par défaut
      detectLeet = true,    // Détecter le l33t speak
      wholeWordOnly = false, // Mot entier seulement
      action = 'delete',
      customRegex = []      // Regex personnalisées
    } = config;

    const content = message.content.toLowerCase();

    // Récupérer les mots depuis la base de données
    const dbWords = await this.getGuildBadwords(message.guild.id);

    // Construire la liste complète
    const allBadwords = useDefault
      ? [...this.defaultBadwords, ...dbWords]
      : dbWords;

    if (allBadwords.length === 0 && customRegex.length === 0) {
      return { triggered: false };
    }

    // Version normalisée (anti-leet)
    const normalizedContent = detectLeet
      ? this.normalizeLeet(content)
      : content;

    // Vérifier chaque mot interdit
    for (const badword of allBadwords) {
      const normalizedBadword = badword.toLowerCase();

      let detected = false;
      let matchedIn = '';

      if (wholeWordOnly) {
        // Mot entier seulement
        const regex = new RegExp(`\\b${this.escapeRegex(normalizedBadword)}\\b`, 'i');
        detected = regex.test(content) || regex.test(normalizedContent);
        matchedIn = badword;
      } else {
        // Contenu dans le message
        detected = content.includes(normalizedBadword) ||
          normalizedContent.includes(normalizedBadword);
        matchedIn = badword;
      }

      if (detected) {
        return {
          triggered: true,
          action: action,
          reason: `Mot interdit détecté`,
          matchedContent: `||${matchedIn}||` // Spoiler pour cacher
        };
      }
    }

    // Vérifier les regex personnalisées
    for (const pattern of customRegex) {
      try {
        const regex = new RegExp(pattern, 'gi');
        const match = content.match(regex);

        if (match) {
          return {
            triggered: true,
            action: action,
            reason: `Pattern interdit détecté`,
            matchedContent: `||${match[0]}||`
          };
        }
      } catch (e) {
        // Regex invalide, ignorer
      }
    }

    return { triggered: false };
  }

  /**
   * Normaliser le l33t speak
   */
  normalizeLeet(text) {
    let normalized = text;

    // Remplacer les caractères l33t
    for (const [leet, normal] of Object.entries(this.leetMap)) {
      normalized = normalized.split(leet).join(normal);
    }

    // Supprimer les caractères répétés (heeello -> helo)
    normalized = normalized.replace(/(.)\1{2,}/g, '$1$1');

    // Supprimer les espaces/tirets au milieu des mots
    normalized = normalized.replace(/[_\-.\s]+/g, '');

    return normalized;
  }

  /**
   * Échapper les caractères spéciaux regex
   */
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

module.exports = new BadwordsFilter();

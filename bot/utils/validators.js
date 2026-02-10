// Utilitaire validators - validation et sanitization des entrées utilisateur

const timeParser = require('./timeParser');

class Validators {
  // Regex pour snowflake Discord
  static SNOWFLAKE_REGEX = /^\d{17,19}$/;

  // Valide un ID Discord (snowflake)
  isValidSnowflake(id) {
    if (id === null || id === undefined) return false;
    return Validators.SNOWFLAKE_REGEX.test(id.toString());
  }

  // Valide et sanitize une raison
  // Retourne { valid: boolean, value?: string|null, error?: string }
  validateReason(reason, maxLength = 500) {
    if (!reason) {
      return { valid: true, value: null };
    }

    // Trim, tronquer à maxLength
    let sanitized = reason.toString().trim().substring(0, maxLength);

    // Supprimer caractères de contrôle (non imprimables)
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');

    if (sanitized.length === 0) {
      return { valid: true, value: null };
    }

    return { valid: true, value: sanitized };
  }

  // Valide un nombre (pour /clear, etc.)
  // Retourne { valid, value? / error? }
  validateNumber(value, min = 1, max = 100) {
    const num = Number.parseInt(value, 10);

    if (Number.isNaN(num)) {
      return {
        valid: false,
        error: 'La valeur doit être un nombre.',
      };
    }

    if (num < min) {
      return {
        valid: false,
        error: `La valeur minimum est ${min}.`,
      };
    }

    if (num > max) {
      return {
        valid: false,
        error: `La valeur maximum est ${max}.`,
      };
    }

    return { valid: true, value: num };
  }

  // Valide une durée (string) avec min/max en ms
  // Retourne { valid, value(ms)?, formatted?, expiresAt?, error? }
  validateDuration(input, minMs = 0, maxMs = null) {
    if (!input) {
      return { valid: true, value: null, formatted: 'permanent', expiresAt: null };
    }

    const ms = timeParser.parse(input);

    if (ms === null) {
      return {
        valid: false,
        error: 'Format de durée invalide. Utilisez: 1h, 30m, 7d, etc.',
      };
    }

    if (ms < minMs) {
      return {
        valid: false,
        error: `Durée trop courte. Minimum: ${timeParser.format(minMs)}.`,
      };
    }

    if (maxMs && ms > maxMs) {
      return {
        valid: false,
        error: `Durée trop longue. Maximum: ${timeParser.format(maxMs)}.`,
      };
    }

    return {
      valid: true,
      value: ms,
      formatted: timeParser.format(ms),
      expiresAt: timeParser.getExpirationDate(ms),
    };
  }

  // Valide un channel ID dans une guild
  validateChannelId(id, guild) {
    if (!this.isValidSnowflake(id)) {
      return { valid: false, error: 'ID de channel invalide.' };
    }

    if (!guild || !guild.channels || !guild.channels.cache) {
      return { valid: false, error: 'Guild invalide.' };
    }

    const channel = guild.channels.cache.get(id);
    if (!channel) {
      return { valid: false, error: 'Channel non trouvé sur ce serveur.' };
    }

    return { valid: true, value: channel };
  }

  // Valide un rôle ID dans une guild
  validateRoleId(id, guild) {
    if (!this.isValidSnowflake(id)) {
      return { valid: false, error: 'ID de rôle invalide.' };
    }

    if (!guild || !guild.roles || !guild.roles.cache) {
      return { valid: false, error: 'Guild invalide.' };
    }

    const role = guild.roles.cache.get(id);
    if (!role) {
      return { valid: false, error: 'Rôle non trouvé sur ce serveur.' };
    }

    return { valid: true, value: role };
  }

  // Sanitize string pour BDD (éviter injection – en plus des requêtes préparées)
  sanitizeForDb(input) {
    if (input === null || input === undefined) return null;
    return input.toString().trim();
  }

  // Vérifie si une URL est valide
  isValidUrl(string) {
    if (!string) return false;
    try {
      // eslint-disable-next-line no-new
      new URL(string);
      return true;
    } catch {
      return false;
    }
  }

  // Vérifie si c'est une invite Discord
  isDiscordInvite(string) {
    if (!string) return false;
    const inviteRegex =
      /(discord\.(gg|io|me|li)|discordapp\.com\/invite)\/[a-zA-Z0-9]+/gi;
    return inviteRegex.test(string);
  }
}

module.exports = new Validators();

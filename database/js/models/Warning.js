// Modèle Warning (avertissement)

class Warning {
  constructor(data = {}) {
    if (!data || typeof data !== 'object') {
      throw new TypeError('Warning constructor expects an object.');
    }

    this.id = data.id ?? null;
    this.guildId = data.guildId ?? data.guild_id ?? null;
    this.userId = data.userId ?? data.user_id ?? null;
    this.moderatorId = data.moderatorId ?? data.moderator_id ?? null;

    this.reason = data.reason ?? 'Aucune raison spécifiée';

    this.createdAt = this.parseDateLike(data.createdAt ?? data.created_at) ?? new Date();

    // active peut venir en bool, 0/1, "0"/"1"
    const rawActive = data.active;
    this.active =
      rawActive === undefined || rawActive === null ? true : this.parseBooleanLike(rawActive);

    this.expiresAt = this.parseDateLike(data.expiresAt ?? data.expires_at);

    this.validateOrThrow();
  }

  parseBooleanLike(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
      const v = value.trim().toLowerCase();
      if (v === '1' || v === 'true' || v === 'yes' || v === 'y' || v === 'on') return true;
      if (v === '0' || v === 'false' || v === 'no' || v === 'n' || v === 'off') return false;
    }
    return Boolean(value);
  }

  parseDateLike(value) {
    if (!value) return null;
    if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
    if (typeof value === 'number') {
      const d = new Date(value);
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof value === 'string') {
      const d = new Date(value);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  }

  validateOrThrow() {
    const errors = [];

    if (!(this.id === null || typeof this.id === 'string' || typeof this.id === 'number')) {
      errors.push('id must be a string/number or null');
    }
    if (!(this.guildId === null || typeof this.guildId === 'string' || typeof this.guildId === 'number')) {
      errors.push('guildId must be a string/number or null');
    }
    if (!(this.userId === null || typeof this.userId === 'string' || typeof this.userId === 'number')) {
      errors.push('userId must be a string/number or null');
    }
    if (!(this.moderatorId === null || typeof this.moderatorId === 'string' || typeof this.moderatorId === 'number')) {
      errors.push('moderatorId must be a string/number or null');
    }
    if (typeof this.reason !== 'string' || this.reason.length === 0) {
      errors.push('reason must be a non-empty string');
    }

    if (typeof this.active !== 'boolean') errors.push('active must be a boolean');
    if (!(this.createdAt instanceof Date) || isNaN(this.createdAt.getTime())) errors.push('createdAt must be a valid Date');
    if (!(this.expiresAt === null || (this.expiresAt instanceof Date && !isNaN(this.expiresAt.getTime())))) {
      errors.push('expiresAt must be a valid Date or null');
    }

    if (errors.length) {
      const err = new Error(`Invalid Warning data: ${errors.join(', ')}`);
      err.code = 'WARNING_VALIDATION_ERROR';
      err.details = errors;
      throw err;
    }
  }

  isExpired() {
    if (!this.expiresAt) return false;
    return this.expiresAt.getTime() < Date.now();
  }

  isActive() {
    return this.active && !this.isExpired();
  }

  deactivate() {
    this.active = false;
  }

  toDatabase() {
    return {
      guild_id: this.guildId,
      user_id: this.userId,
      moderator_id: this.moderatorId,
      reason: this.reason,
      // On garde un Date (ou ISO) selon ce que ton driver SQL accepte ; ici Date
      created_at: this.createdAt,
      active: this.active ? 1 : 0,
      expires_at: this.expiresAt,
    };
  }

  toEmbed() {
    return {
      id: this.id,
      reason: this.reason,
      moderatorId: this.moderatorId,
      createdAt: this.createdAt,
      active: this.isActive(),
    };
  }
}

module.exports = Warning;

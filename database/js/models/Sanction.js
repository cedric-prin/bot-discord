// Modèle Sanction (ban, mute, kick, etc.)

const SANCTION_TYPES = {
  KICK: 'kick',
  BAN: 'ban',
  MUTE: 'mute',
  UNMUTE: 'unmute',
  UNBAN: 'unban',
  TIMEOUT: 'timeout',
};

class Sanction {
  constructor(data = {}) {
    if (!data || typeof data !== 'object') {
      throw new TypeError('Sanction constructor expects an object.');
    }

    this.id = data.id ?? null;
    this.guildId = data.guildId ?? data.guild_id ?? null;
    this.userId = data.userId ?? data.user_id ?? null;
    this.moderatorId = data.moderatorId ?? data.moderator_id ?? null;

    this.type = data.type ?? SANCTION_TYPES.KICK;
    this.reason = data.reason ?? 'Aucune raison spécifiée';

    // duration en secondes (null = permanent)
    this.duration = this.parseNullableInt(data.duration, null);
    this.expiresAt = this.parseDateLike(data.expiresAt ?? data.expires_at);

    // active peut venir en bool, 0/1, "0"/"1"
    const rawActive = data.active;
    this.active =
      rawActive === undefined || rawActive === null ? true : this.parseBooleanLike(rawActive);

    this.createdAt = this.parseDateLike(data.createdAt ?? data.created_at) ?? new Date();

    this.validateOrThrow();
  }

  static get TYPES() {
    return SANCTION_TYPES;
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

  parseNullableInt(value, fallbackNull = null) {
    if (value === undefined || value === null || value === '') return fallbackNull;
    const n = typeof value === 'string' ? Number.parseInt(value, 10) : Number(value);
    return Number.isFinite(n) ? n : fallbackNull;
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

    const allowedTypes = new Set(Object.values(SANCTION_TYPES));
    if (typeof this.type !== 'string' || !allowedTypes.has(this.type)) {
      errors.push(`type must be one of: ${Array.from(allowedTypes).join(', ')}`);
    }

    if (typeof this.reason !== 'string' || this.reason.length === 0) {
      errors.push('reason must be a non-empty string');
    }

    if (!(this.duration === null || (Number.isFinite(this.duration) && this.duration >= 0))) {
      errors.push('duration must be a non-negative number (seconds) or null');
    }

    if (!(this.expiresAt === null || (this.expiresAt instanceof Date && !isNaN(this.expiresAt.getTime())))) {
      errors.push('expiresAt must be a valid Date or null');
    }

    if (typeof this.active !== 'boolean') errors.push('active must be a boolean');
    if (!(this.createdAt instanceof Date) || isNaN(this.createdAt.getTime())) errors.push('createdAt must be a valid Date');

    if (errors.length) {
      const err = new Error(`Invalid Sanction data: ${errors.join(', ')}`);
      err.code = 'SANCTION_VALIDATION_ERROR';
      err.details = errors;
      throw err;
    }
  }

  isTemporary() {
    return this.duration !== null;
  }

  isExpired() {
    if (!this.expiresAt) return false;
    return this.expiresAt.getTime() < Date.now();
  }

  isActive() {
    return this.active && !this.isExpired();
  }

  getRemainingTime() {
    if (!this.expiresAt) return null;
    const remaining = this.expiresAt.getTime() - Date.now();
    return remaining > 0 ? remaining : 0;
  }

  formatDuration() {
    if (!this.duration) return 'Permanent';

    const hours = Math.floor(this.duration / 3600);
    const minutes = Math.floor((this.duration % 3600) / 60);

    if (hours > 24) return `${Math.floor(hours / 24)}j`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  deactivate() {
    this.active = false;
  }

  toDatabase() {
    return {
      guild_id: this.guildId,
      user_id: this.userId,
      moderator_id: this.moderatorId,
      type: this.type,
      reason: this.reason,
      duration: this.duration,
      expires_at: this.expiresAt,
      active: this.active ? 1 : 0,
      created_at: this.createdAt,
    };
  }
}

module.exports = Sanction;

// Modèle User (utilisateur Discord dans une guild)

class User {
  constructor(data = {}) {
    if (!data || typeof data !== 'object') {
      throw new TypeError('User constructor expects an object.');
    }

    this.id = data.id ?? null;
    this.discordId = data.discordId ?? data.discord_id ?? null;
    this.guildId = data.guildId ?? data.guild_id ?? null;
    this.username = data.username ?? '';

    this.totalWarnings = this.toInt(data.totalWarnings ?? data.total_warnings, 0);
    this.totalSanctions = this.toInt(data.totalSanctions ?? data.total_sanctions, 0);

    // Calcul automatique (ignore les valeurs incohérentes en DB)
    this.riskScore = 0;
    this.updateRiskScore();

    this.notes = data.notes ?? '';

    this.createdAt = this.parseDateLike(data.createdAt ?? data.created_at) ?? new Date();
    this.updatedAt = this.parseDateLike(data.updatedAt ?? data.updated_at) ?? new Date();

    this.validateOrThrow();
  }

  toInt(value, fallback) {
    if (value === undefined || value === null || value === '') return fallback;
    const n = typeof value === 'string' ? Number.parseInt(value, 10) : Number(value);
    return Number.isFinite(n) ? n : fallback;
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

  incrementWarnings() {
    this.totalWarnings += 1;
    this.updateRiskScore();
  }

  incrementSanctions() {
    this.totalSanctions += 1;
    this.updateRiskScore();
  }

  updateRiskScore() {
    // Simple calcul : warnings * 10 + sanctions * 25
    this.riskScore = this.totalWarnings * 10 + this.totalSanctions * 25;
  }

  validateOrThrow() {
    const errors = [];

    if (!(this.id === null || typeof this.id === 'string' || typeof this.id === 'number')) {
      errors.push('id must be a string/number or null');
    }
    if (!(this.discordId === null || typeof this.discordId === 'string' || typeof this.discordId === 'number')) {
      errors.push('discordId must be a string/number or null');
    }
    if (!(this.guildId === null || typeof this.guildId === 'string' || typeof this.guildId === 'number')) {
      errors.push('guildId must be a string/number or null');
    }
    if (typeof this.username !== 'string') errors.push('username must be a string');

    if (!Number.isFinite(this.totalWarnings) || this.totalWarnings < 0) errors.push('totalWarnings must be a non-negative number');
    if (!Number.isFinite(this.totalSanctions) || this.totalSanctions < 0) errors.push('totalSanctions must be a non-negative number');
    if (!Number.isFinite(this.riskScore) || this.riskScore < 0) errors.push('riskScore must be a non-negative number');

    if (typeof this.notes !== 'string') errors.push('notes must be a string');

    if (!(this.createdAt instanceof Date) || isNaN(this.createdAt.getTime())) errors.push('createdAt must be a valid Date');
    if (!(this.updatedAt instanceof Date) || isNaN(this.updatedAt.getTime())) errors.push('updatedAt must be a valid Date');

    if (errors.length) {
      const err = new Error(`Invalid User data: ${errors.join(', ')}`);
      err.code = 'USER_VALIDATION_ERROR';
      err.details = errors;
      throw err;
    }
  }

  toDatabase() {
    return {
      discord_id: this.discordId,
      guild_id: this.guildId,
      username: this.username,
      total_warnings: this.totalWarnings,
      total_sanctions: this.totalSanctions,
      risk_score: this.riskScore,
      notes: this.notes,
      updated_at: new Date().toISOString(),
    };
  }
}

module.exports = User;

// Modèle Guild (serveur Discord)

class Guild {
  constructor(data = {}) {
    if (!data || typeof data !== 'object') {
      throw new TypeError('Guild constructor expects an object.');
    }

    this.id = data.id ?? null;
    this.name = data.name ?? '';
    this.prefix = data.prefix ?? '!';

    // Champs DB snake_case acceptés en entrée
    this.logChannelId = data.logChannelId ?? data.log_channel_id ?? null;
    this.modLogChannelId = data.modLogChannelId ?? data.mod_log_channel_id ?? null;
    this.muteRoleId = data.muteRoleId ?? data.mute_role_id ?? null;

    // automod_enabled peut venir en bool, 0/1, "0"/"1"
    const rawAutomodEnabled = data.automodEnabled ?? data.automod_enabled;
    this.automodEnabled =
      rawAutomodEnabled === undefined || rawAutomodEnabled === null
        ? true
        : this.parseBooleanLike(rawAutomodEnabled);

    this.automodConfig = this.parseAutomodConfig(
      data.automodConfig ?? data.automod_config
    );

    this.welcomeChannelId = data.welcomeChannelId ?? data.welcome_channel_id ?? null;
    this.welcomeMessage = data.welcomeMessage ?? data.welcome_message ?? null;

    this.createdAt = this.parseDateLike(data.createdAt ?? data.created_at) ?? new Date();
    this.updatedAt = this.parseDateLike(data.updatedAt ?? data.updated_at) ?? new Date();

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
    // Fallback JS truthy/falsy
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

  parseAutomodConfig(config) {
    if (!config) return this.defaultAutomodConfig();

    // String JSON en DB
    if (typeof config === 'string') {
      try {
        const parsed = JSON.parse(config);
        return this.normalizeAutomodConfig(parsed);
      } catch (e) {
        // Si JSON invalide, on retombe sur défaut plutôt que casser le bot
        return this.defaultAutomodConfig();
      }
    }

    if (typeof config === 'object') {
      return this.normalizeAutomodConfig(config);
    }

    return this.defaultAutomodConfig();
  }

  defaultAutomodConfig() {
    return {
      antiSpam: { enabled: true, maxMessages: 5, interval: 5000 },
      antiLinks: { enabled: true, whitelist: [] },
      antiInvites: { enabled: true },
      badWords: { enabled: true, words: [] },
      maxMentions: { enabled: true, max: 5 },
      maxWarnsBeforeMute: 3,
      maxWarnsBeforeBan: 5,
    };
  }

  normalizeAutomodConfig(config) {
    const base = this.defaultAutomodConfig();
    const c = config && typeof config === 'object' ? config : {};

    // Merge simple + normalisation types
    const merged = {
      ...base,
      ...c,
      antiSpam: { ...base.antiSpam, ...(c.antiSpam || {}) },
      antiLinks: { ...base.antiLinks, ...(c.antiLinks || {}) },
      antiInvites: { ...base.antiInvites, ...(c.antiInvites || {}) },
      badWords: { ...base.badWords, ...(c.badWords || {}) },
      maxMentions: { ...base.maxMentions, ...(c.maxMentions || {}) },
    };

    // Coercions minimales
    merged.antiSpam.enabled = this.parseBooleanLike(merged.antiSpam.enabled);
    merged.antiSpam.maxMessages = this.toInt(merged.antiSpam.maxMessages, base.antiSpam.maxMessages);
    merged.antiSpam.interval = this.toInt(merged.antiSpam.interval, base.antiSpam.interval);

    merged.antiLinks.enabled = this.parseBooleanLike(merged.antiLinks.enabled);
    merged.antiLinks.whitelist = Array.isArray(merged.antiLinks.whitelist) ? merged.antiLinks.whitelist : [];

    merged.antiInvites.enabled = this.parseBooleanLike(merged.antiInvites.enabled);

    merged.badWords.enabled = this.parseBooleanLike(merged.badWords.enabled);
    merged.badWords.words = Array.isArray(merged.badWords.words) ? merged.badWords.words : [];

    merged.maxMentions.enabled = this.parseBooleanLike(merged.maxMentions.enabled);
    merged.maxMentions.max = this.toInt(merged.maxMentions.max, base.maxMentions.max);

    merged.maxWarnsBeforeMute = this.toInt(merged.maxWarnsBeforeMute, base.maxWarnsBeforeMute);
    merged.maxWarnsBeforeBan = this.toInt(merged.maxWarnsBeforeBan, base.maxWarnsBeforeBan);

    return merged;
  }

  toInt(value, fallback) {
    const n = typeof value === 'string' ? Number.parseInt(value, 10) : Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  validateOrThrow() {
    const errors = [];

    // id Discord: string (souvent snowflake) ou null
    if (!(this.id === null || typeof this.id === 'string' || typeof this.id === 'number')) {
      errors.push('id must be a string/number or null');
    }

    if (typeof this.name !== 'string') errors.push('name must be a string');
    if (typeof this.prefix !== 'string' || this.prefix.length === 0) errors.push('prefix must be a non-empty string');

    const idFields = [
      ['logChannelId', this.logChannelId],
      ['modLogChannelId', this.modLogChannelId],
      ['muteRoleId', this.muteRoleId],
      ['welcomeChannelId', this.welcomeChannelId],
    ];
    for (const [k, v] of idFields) {
      if (!(v === null || typeof v === 'string' || typeof v === 'number')) {
        errors.push(`${k} must be a string/number or null`);
      }
    }

    if (typeof this.automodEnabled !== 'boolean') errors.push('automodEnabled must be a boolean');

    if (!this.automodConfig || typeof this.automodConfig !== 'object') {
      errors.push('automodConfig must be an object');
    }

    if (!(this.welcomeMessage === null || typeof this.welcomeMessage === 'string')) {
      errors.push('welcomeMessage must be a string or null');
    }

    if (!(this.createdAt instanceof Date) || isNaN(this.createdAt.getTime())) errors.push('createdAt must be a valid Date');
    if (!(this.updatedAt instanceof Date) || isNaN(this.updatedAt.getTime())) errors.push('updatedAt must be a valid Date');

    if (errors.length) {
      const err = new Error(`Invalid Guild data: ${errors.join(', ')}`);
      err.code = 'GUILD_VALIDATION_ERROR';
      err.details = errors;
      throw err;
    }
  }

  toDatabase() {
    return {
      id: this.id,
      name: this.name,
      prefix: this.prefix,
      log_channel_id: this.logChannelId,
      mod_log_channel_id: this.modLogChannelId,
      mute_role_id: this.muteRoleId,
      automod_enabled: this.automodEnabled ? 1 : 0,
      automod_config: JSON.stringify(this.automodConfig),
      welcome_channel_id: this.welcomeChannelId,
      welcome_message: this.welcomeMessage,
      // created_at souvent géré à l'insert côté DB; on garde updated_at ici
      updated_at: new Date().toISOString(),
    };
  }
}

module.exports = Guild;

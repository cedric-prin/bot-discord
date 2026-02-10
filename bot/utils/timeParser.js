// Utilitaire timeParser - parsing et formatage de durées

const TIME_UNITS = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
};

const TIME_NAMES = {
  s: 'seconde',
  m: 'minute',
  h: 'heure',
  d: 'jour',
  w: 'semaine',
};

class TimeParser {
  // Parse une durée string en millisecondes (ex: "1d12h30m")
  parse(input) {
    if (!input || typeof input !== 'string') {
      return null;
    }

    const trimmed = input.trim();
    if (!trimmed) return null;

    const regex = /(\d+)\s*(s|m|h|d|w)/gi;
    let totalMs = 0;
    let match;

    while ((match = regex.exec(trimmed)) !== null) {
      const value = parseInt(match[1], 10);
      const unit = match[2].toLowerCase();

      if (!Number.isFinite(value) || value <= 0) continue;
      if (TIME_UNITS[unit]) {
        totalMs += value * TIME_UNITS[unit];
      }
    }

    return totalMs > 0 ? totalMs : null;
  }

  // Retourne la date d'expiration à partir d'une durée (ms ou string)
  getExpirationDate(duration) {
    const ms = typeof duration === 'string' ? this.parse(duration) : duration;
    if (!ms || !Number.isFinite(ms) || ms <= 0) return null;

    return new Date(Date.now() + ms);
  }

  // Formate des millisecondes en string lisible en français
  // ex: 3661000 -> "1 heure 1 minute 1 seconde"
  format(ms) {
    if (!ms || ms <= 0) return 'permanent';

    const units = [
      { key: 'w', name: 'semaine', value: TIME_UNITS.w },
      { key: 'd', name: 'jour', value: TIME_UNITS.d },
      { key: 'h', name: 'heure', value: TIME_UNITS.h },
      { key: 'm', name: 'minute', value: TIME_UNITS.m },
      { key: 's', name: 'seconde', value: TIME_UNITS.s },
    ];

    const parts = [];
    let remaining = ms;

    for (const unit of units) {
      const count = Math.floor(remaining / unit.value);
      if (count > 0) {
        parts.push(`${count} ${unit.name}${count > 1 ? 's' : ''}`);
        remaining %= unit.value;
      }
    }

    return parts.length > 0 ? parts.join(' ') : '0 seconde';
  }

  // Format court (ex: 3661000 -> "1h 1m 1s")
  formatShort(ms) {
    if (!ms || ms <= 0) return 'perm';

    const units = [
      { suffix: 'w', value: TIME_UNITS.w },
      { suffix: 'd', value: TIME_UNITS.d },
      { suffix: 'h', value: TIME_UNITS.h },
      { suffix: 'm', value: TIME_UNITS.m },
      { suffix: 's', value: TIME_UNITS.s },
    ];

    const parts = [];
    let remaining = ms;

    for (const unit of units) {
      const count = Math.floor(remaining / unit.value);
      if (count > 0) {
        parts.push(`${count}${unit.suffix}`);
        remaining %= unit.value;
      }
    }

    return parts.join(' ') || '0s';
  }

  // Temps relatif (il y a X, dans X)
  relative(date) {
    if (!date) return 'inconnu';

    const now = Date.now();
    const target = date instanceof Date ? date.getTime() : new Date(date).getTime();
    if (!Number.isFinite(target)) return 'inconnu';

    const diff = target - now;

    if (diff > 0) {
      return `dans ${this.format(diff)}`;
    }
    return `il y a ${this.format(Math.abs(diff))}`;
  }

  // Vérifie si le format est valide
  isValid(input) {
    return this.parse(input) !== null;
  }

  // Vérifie si une date est expirée
  isExpired(expirationDate) {
    if (!expirationDate) return false;
    const expDate =
      expirationDate instanceof Date ? expirationDate : new Date(expirationDate);
    return expDate.getTime() < Date.now();
  }
}

module.exports = new TimeParser();

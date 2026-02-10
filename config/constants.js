// Constantes JS
module.exports = {
  COLORS: {
    SUCCESS: 0x00FF00,
    ERROR: 0xFF0000,
    WARNING: 0xFFA500,
    INFO: 0x0099FF,
    MODERATION: 0xFF6B6B,
    NEUTRAL: 0x99AAB5,
    ONLINE: 0x43B581,
    IDLE: 0xFAA61A,
    DND: 0xF04747,
    OFFLINE: 0x747F8D,
  },

  // Couleurs spécifiques pour les actions de modération
  MODERATION: {
    ban: 0xFF0000,
    kick: 0xFF6600,
    mute: 0xFFA500,
    warn: 0xFFFF00,
    unban: 0x00FF00,
    unmute: 0x00FF00
  },

  EMOJIS: {
    SUCCESS: '✅',
    ERROR: '❌',
    WARNING: '⚠️',
    INFO: 'ℹ️',
    MODERATION: {
      ban: '🔨',
      kick: '👢',
      mute: '🔇',
      warn: '⚠️',
      unban: '🔓',
      unmute: '🔊'
    }
  },

  MESSAGES: {
    NO_PERMISSION: 'Tu n\'as pas la permission d\'utiliser cette commande.',
    BOT_NO_PERMISSION: 'Je n\'ai pas la permission nécessaire pour faire ça.',
    USER_NOT_FOUND: 'Utilisateur introuvable.',
    INVALID_ARGS: 'Arguments invalides. Utilise la commande d\'aide pour plus d\'informations.',
    COMMAND_COOLDOWN: 'Tu dois attendre %time% secondes avant de réutiliser cette commande.',
    ERROR_GENERIC: 'Une erreur est survenue. Veuillez réessayer plus tard.',
  },

  COOLDOWNS: {
    DEFAULT: 3, // secondes
    MODERATION: 5,
    UTILITY: 2,
  },

  PERMISSIONS: {
    BAN_MEMBERS: 'BanMembers',
    KICK_MEMBERS: 'KickMembers',
    MANAGE_MESSAGES: 'ManageMessages',
    MANAGE_CHANNELS: 'ManageChannels',
    ADMINISTRATOR: 'Administrator',
    // Permissions par commande pour le service de permissions
    BAN: ['BanMembers'],
    KICK: ['KickMembers'],
    MUTE: ['ModerateMembers'],
    WARN: ['ManageMessages'],
    CLEAR: ['ManageMessages'],
    LOCK: ['ManageChannels'],
    UNLOCK: ['ManageChannels'],
    SLOWMODE: ['ManageChannels']
  },

  IDS: {
    // À adapter selon ton serveur si besoin
    LOGS_CHANNEL: null, // Remplacer par l'ID du channel de logs
    MOD_LOGS_CHANNEL: null, // Remplacer par l'ID du channel de logs de modération
    MOD_ROLE: null, // Remplacer par l'ID du rôle modérateur
    ADMIN_ROLE: null, // Remplacer par l'ID du rôle administrateur
  },

  LIMITS: {
    CLEAR_MESSAGES_MAX: 100,
    WARNINGS_MAX: 5,
    MUTE_DURATION_MAX: 7 * 24 * 60 * 60 * 1000, // 7 jours en ms
  },
};
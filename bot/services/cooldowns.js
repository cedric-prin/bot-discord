// Service cooldowns
const { Collection } = require('discord.js');

class CooldownService {
  constructor() {
    // Map: commandName -> Collection<userId, timestamp>
    this.cooldowns = new Map();
  }
  
  // Vérifie et applique le cooldown
  check(userId, commandName, cooldownSeconds, bypassRoles = []) {
    // Initialiser la collection pour cette commande si nécessaire
    if (!this.cooldowns.has(commandName)) {
      this.cooldowns.set(commandName, new Collection());
    }
    
    const now = Date.now();
    const timestamps = this.cooldowns.get(commandName);
    const cooldownAmount = cooldownSeconds * 1000;
    
    // Vérifier si l'utilisateur est en cooldown
    if (timestamps.has(userId)) {
      const expirationTime = timestamps.get(userId) + cooldownAmount;
      
      if (now < expirationTime) {
        const timeLeft = (expirationTime - now) / 1000;
        return {
          onCooldown: true,
          timeLeft: timeLeft.toFixed(1)
        };
      }
    }
    
    // Appliquer le nouveau cooldown
    timestamps.set(userId, now);
    
    // Nettoyer après expiration
    setTimeout(() => timestamps.delete(userId), cooldownAmount);
    
    return { onCooldown: false };
  }
  
  // Vérifie sans appliquer (pour preview)
  peek(userId, commandName, cooldownSeconds) {
    if (!this.cooldowns.has(commandName)) {
      return { onCooldown: false };
    }
    
    const now = Date.now();
    const timestamps = this.cooldowns.get(commandName);
    const cooldownAmount = cooldownSeconds * 1000;
    
    if (timestamps.has(userId)) {
      const expirationTime = timestamps.get(userId) + cooldownAmount;
      
      if (now < expirationTime) {
        const timeLeft = (expirationTime - now) / 1000;
        return { onCooldown: true, timeLeft: timeLeft.toFixed(1) };
      }
    }
    
    return { onCooldown: false };
  }
  
  // Reset le cooldown d'un utilisateur
  reset(userId, commandName) {
    if (this.cooldowns.has(commandName)) {
      this.cooldowns.get(commandName).delete(userId);
    }
  }
  
  // Reset tous les cooldowns d'un utilisateur
  resetAll(userId) {
    for (const [, timestamps] of this.cooldowns) {
      timestamps.delete(userId);
    }
  }
  
  // Nettoyage manuel (optionnel)
  cleanup() {
    const now = Date.now();
    for (const [cmdName, timestamps] of this.cooldowns) {
      for (const [userId, timestamp] of timestamps) {
        // Supprimer les cooldowns de plus de 1 heure (au cas où)
        if (now - timestamp > 3600000) {
          timestamps.delete(userId);
        }
      }
    }
  }
}

module.exports = new CooldownService();
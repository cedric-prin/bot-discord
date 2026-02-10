// Service embedBuilder
const { EmbedBuilder } = require('discord.js');
const { COLORS, EMOJIS } = require('../../config/constants');

class EmbedService {
  
  // Embed succès (vert)
  success(title, description) {
    return new EmbedBuilder()
      .setColor(COLORS.SUCCESS)
      .setTitle(`${EMOJIS.SUCCESS} ${title}`)
      .setDescription(description)
      .setTimestamp();
  }
  
  // Embed erreur (rouge)
  error(title, description) {
    return new EmbedBuilder()
      .setColor(COLORS.ERROR)
      .setTitle(`${EMOJIS.ERROR} ${title}`)
      .setDescription(description)
      .setTimestamp();
  }
  
  // Embed warning (orange)
  warning(title, description) {
    return new EmbedBuilder()
      .setColor(COLORS.WARNING)
      .setTitle(`${EMOJIS.WARNING} ${title}`)
      .setDescription(description)
      .setTimestamp();
  }
  
  // Embed info (bleu)
  info(title, description) {
    return new EmbedBuilder()
      .setColor(COLORS.INFO)
      .setTitle(`${EMOJIS.INFO} ${title}`)
      .setDescription(description)
      .setTimestamp();
  }
  
  // Embed log de modération
  modLog({ action, moderator, target, reason, duration, caseId }) {
    const embed = new EmbedBuilder()
      .setColor(COLORS.MODERATION[action] || COLORS.WARNING)
      .setTitle(`${EMOJIS.MODERATION[action]} ${action.toUpperCase()}`)
      .addFields(
        { name: '👤 Utilisateur', value: `${target.tag} (${target.id})`, inline: true },
        { name: '👮 Modérateur', value: `${moderator.tag}`, inline: true },
        { name: '📝 Raison', value: reason || 'Aucune raison fournie' }
      )
      .setFooter({ text: `Case #${caseId}` })
      .setTimestamp();
    
    if (duration) {
      embed.addFields({ name: '⏱️ Durée', value: duration, inline: true });
    }
    
    return embed;
  }
  
  // Embed profil utilisateur
  userProfile({ user, warnings, sanctions, riskScore }) {
    return new EmbedBuilder()
      .setColor(this._getRiskColor(riskScore))
      .setTitle(`Profil de ${user.tag}`)
      .setThumbnail(user.displayAvatarURL())
      .addFields(
        { name: '⚠️ Warnings', value: `${warnings}`, inline: true },
        { name: '🔨 Sanctions', value: `${sanctions}`, inline: true },
        { name: '📊 Score risque', value: `${riskScore}/100`, inline: true }
      )
      .setTimestamp();
  }
  
  // Couleur selon score de risque
  _getRiskColor(score) {
    if (score >= 70) return COLORS.ERROR;
    if (score >= 40) return COLORS.WARNING;
    return COLORS.SUCCESS;
  }
}

module.exports = new EmbedService();
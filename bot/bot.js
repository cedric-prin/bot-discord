/**
 * Client Discord principal - Bot Cardinal
 * Configure le client avec tous les intents nécessaires pour la modération complète
 */

const { Client, Collection, GatewayIntentBits, Partials } = require('discord.js');
const config = require('../config/config');

// Conversion des intents configurés en GatewayIntentBits
const intentFlags = config.bot.intents.map(intent => GatewayIntentBits[intent]);

const client = new Client({
  intents: intentFlags,
  partials: [Partials.User, Partials.Channel, Partials.GuildMember, Partials.Message]
});

// Collections pour stocker les commandes et cooldowns
client.commands = new Collection();
client.cooldowns = new Collection();

// Propriétés supplémentaires pour le bot
client.config = config;
client.startTime = Date.now();

module.exports = client;

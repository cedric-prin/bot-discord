# Base de données Cardinal

Ce dossier contient tout le système de base de données pour le bot Discord Cardinal.

## 📁 Structure des fichiers

```
database/
├── README.md                    # Ce fichier
├── schema-unified.sql          # Schéma SQL unifié et complet
├── setup.js                    # Script d'initialisation principal
├── migrate-to-unified.js       # Script de migration des données existantes
├── cardinal.db                 # Base de données principale (créée automatiquement)
├── js/                         # Interface JavaScript
│   ├── index.js               # Connexion à la base de données
│   ├── init.js                # Initialisation du schéma
│   ├── models/                # Modèles de données
│   │   ├── Guild.js
│   │   ├── User.js
│   │   ├── Warning.js
│   │   └── Sanction.js
│   └── repositories/           # Accès aux données
│       ├── guildRepo.js
│       ├── userRepo.js
│       ├── warningRepo.js
│       └── sanctionRepo.js
└── python/                     # Interface Python (panel admin)
    ├── connection.py
    └── repositories/
```

## 🚀 Démarrage rapide

### 1. Initialisation de la base de données

```bash
# Depuis la racine du projet
cd database

# Initialisation simple (recommandé pour une nouvelle installation)
node setup.js

# Migration depuis une base existante
node setup.js --migrate

# Recréation complète (avec sauvegarde automatique)
node setup.js --force
```

### 2. Utilisation dans le bot

```javascript
// Importer la connexion à la base de données
const db = require('./database/js/index');

// Importer les modèles
const Guild = require('./database/js/models/Guild');
const User = require('./database/js/models/User');

// Importer les repositories
const guildRepo = require('./database/js/repositories/guildRepo');
```

## 📊 Schéma de la base de données

### Tables principales

#### `guilds`
Configuration des serveurs Discord
- `id` (TEXT PRIMARY KEY) - ID du serveur
- `name` (TEXT) - Nom du serveur
- `prefix` (TEXT) - Préfixe des commandes
- `log_channel_id` (TEXT) - Salon de logs
- `mod_log_channel_id` (TEXT) - Salon de logs de modération
- `mute_role_id` (TEXT) - Rôle mute
- `automod_enabled` (INTEGER) - Automod activé/désactivé
- `automod_config` (TEXT) - Configuration JSON de l'automod
- `welcome_channel_id` (TEXT) - Salon de bienvenue
- `welcome_message` (TEXT) - Message de bienvenue

#### `users`
Utilisateurs trackés par serveur
- `id` (INTEGER PRIMARY KEY) - ID interne
- `discord_id` (TEXT) - ID Discord de l'utilisateur
- `guild_id` (TEXT) - ID du serveur
- `username` (TEXT) - Pseudo Discord
- `total_warnings` (INTEGER) - Nombre total d'avertissements
- `total_sanctions` (INTEGER) - Nombre total de sanctions
- `risk_score` (INTEGER) - Score de risque calculé automatiquement
- `notes` (TEXT) - Notes sur l'utilisateur

#### `warnings`
Avertissements de modération
- `id` (INTEGER PRIMARY KEY) - ID interne
- `guild_id` (TEXT) - ID du serveur
- `user_id` (TEXT) - ID Discord de l'utilisateur
- `moderator_id` (TEXT) - ID Discord du modérateur
- `reason` (TEXT) - Raison de l'avertissement
- `active` (INTEGER) - Avertissement actif ou non
- `expires_at` (DATETIME) - Date d'expiration

#### `sanctions`
Sanctions (bans, mutes, kicks, timeouts)
- `id` (INTEGER PRIMARY KEY) - ID interne
- `guild_id` (TEXT) - ID du serveur
- `user_id` (TEXT) - ID Discord de l'utilisateur
- `moderator_id` (TEXT) - ID Discord du modérateur
- `type` (TEXT) - Type de sanction (kick, ban, mute, timeout, etc.)
- `reason` (TEXT) - Raison de la sanction
- `duration` (INTEGER) - Durée en secondes (null = permanent)
- `expires_at` (DATETIME) - Date d'expiration
- `active` (INTEGER) - Sanction active ou non

#### `mod_logs`
Historique complet des actions de modération
- `id` (INTEGER PRIMARY KEY) - ID interne
- `guild_id` (TEXT) - ID du serveur
- `action_type` (TEXT) - Type d'action
- `target_id` (TEXT) - ID de la cible
- `moderator_id` (TEXT) - ID du modérateur
- `reason` (TEXT) - Raison
- `details` (TEXT) - Détails supplémentaires (JSON)
- `created_at` (DATETIME) - Date de création

#### `automod_logs`
Actions automatiques de modération
- `id` (INTEGER PRIMARY KEY) - ID interne
- `guild_id` (TEXT) - ID du serveur
- `user_id` (TEXT) - ID Discord de l'utilisateur
- `trigger_type` (TEXT) - Type de déclencheur
- `message_content` (TEXT) - Contenu du message
- `action_taken` (TEXT) - Action effectuée
- `created_at` (DATETIME) - Date de création

#### `ai_logs`
Logs des fonctionnalités d'IA
- `id` (INTEGER PRIMARY KEY) - ID interne
- `guild_id` (TEXT) - ID du serveur
- `user_id` (TEXT) - ID Discord de l'utilisateur
- `action_type` (TEXT) - Type d'action IA
- `input_text` (TEXT) - Texte d'entrée
- `output_text` (TEXT) - Texte de sortie
- `tokens_used` (INTEGER) - Nombre de tokens utilisés
- `cost` (REAL) - Coût de l'opération
- `model` (TEXT) - Modèle IA utilisé
- `created_at` (DATETIME) - Date de création

## 🔄 Triggers automatiques

La base de données inclut des triggers qui maintiennent automatiquement :

1. **Mise à jour des timestamps** : `updated_at` est automatiquement mis à jour
2. **Compteurs de warnings** : `total_warnings` et `risk_score` sont mis à jour automatiquement
3. **Compteurs de sanctions** : `total_sanctions` et `risk_score` sont mis à jour automatiquement

## 📈 Vues et statistiques

### `guild_stats`
Vue fournissant des statistiques par serveur :
- Nombre total d'utilisateurs
- Avertissements actifs
- Sanctions actives
- Actions automod
- Derniers avertissements/sanctions

## 🔧 Maintenance

### Sauvegarde automatique
Le script de configuration crée automatiquement des sauvegardes avant toute modification :
- `cardinal.backup.TIMESTAMP.db` lors des migrations
- `cardinal.backup.TIMESTAMP.db` lors des recréations forcées

### Vérification d'intégrité
```bash
# Vérifier l'intégrité de la base de données
node setup.js
```

### Migration depuis une ancienne version
```bash
# Migre automatiquement les données existantes
node setup.js --migrate
```

## 🐛 Dépannage

### Erreurs communes

1. **"Database is locked"**
   - Arrêtez le bot avant d'exécuter les scripts
   - Vérifiez qu'aucun autre processus n'utilise la base de données

2. **"Table already exists"**
   - Normal lors des migrations, les erreurs sont ignorées automatiquement

3. **"Foreign key constraint failed"**
   - Vérifiez que les données référencées existent
   - Utilisez `--force` pour recréer la base de données si nécessaire

### Logs détaillés
Les scripts utilisent le système de logs du bot. Vérifiez les logs pour des informations détaillées sur les opérations.

## 📝 Notes de développement

- Le schéma utilise des IDs Discord en format TEXT pour éviter les problèmes de conversion
- Les timestamps sont stockés au format ISO8601
- Les configurations JSON sont stockées en TEXT pour une flexibilité maximale
- Les contraintes de clés étrangères sont activées pour garantir l'intégrité
- Le mode WAL est activé pour de meilleures performances en concurrence

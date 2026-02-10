# 🤖 Cardinal - Bot Discord de Modération

Bot Discord de modération complet avec panel d'administration web Streamlit et base de données SQLite partagée.

## 🚀 Installation Rapide

### Prérequis
- Node.js 16+ et npm 8+
- Python 3.8+ et pip
- Git

### 1. Cloner le projet
```bash
git clone https://github.com/cedric-prin/bot-discord.git
cd bot-discord
```

### 2. Installation automatique
```bash
npm run setup
```

### 3. Configuration
```bash
cp .env.example .env
# Éditer .env avec tes clés Discord et API
```

### 4. Démarrer
```bash
# Bot Discord
npm start

# Panel d'administration
npm run panel
```

## 📋 Scripts disponibles

| Commande | Description |
|---------|-------------|
| `npm start` | Démarrer le bot Discord |
| `npm run dev` | Démarrer en mode développement |
| `npm run deploy` | Déployer les commandes sur serveur test |
| `npm run deploy:global` | Déployer globalement |
| `npm run panel` | Démarrer le panel Streamlit |
| `npm run install:all` | Installer toutes les dépendances |
| `npm run setup` | Installation complète + déploiement |

## 🗂️ Structure du projet

```
cardinal/
├── bot/                    # Bot Discord
│   ├── commands/          # Commandes slash
│   ├── events/            # Événements Discord
│   ├── handlers/          # Handlers
│   ├── utils/             # Utilitaires
│   └── index.js           # Point d'entrée
├── panel/                 # Panel Streamlit
│   ├── pages/             # Pages du panel
│   ├── components/        # Composants réutilisables
│   └── app.py            # Application principale
├── database/              # Base de données
│   ├── js/               # Models et repositories JS
│   ├── python/            # Repositories Python
│   └── schema.sql        # Schéma SQL
├── config/               # Configuration
└── docs/                 # Documentation
```

## 🛠️ Technologies

### Bot Discord
- **Discord.js v14** - API Discord
- **SQLite3** - Base de données
- **Winston** - Logging
- **dotenv** - Variables d'environnement

### Panel d'administration
- **Streamlit** - Interface web
- **Plotly** - Graphiques
- **Pandas** - Manipulation de données
- **SQLite3** - Base de données partagée

## ⚙️ Configuration

### Variables d'environnement (.env)
```bash
# Discord
DISCORD_TOKEN=ton_token_discord
DISCORD_CLIENT_ID=ton_client_id
DISCORD_GUILD_ID=ton_id_serveur_test

# Base de données
DATABASE_PATH=./database/cardinal.db

# Panel
PANEL_SECRET_KEY=ta_clé_secrète

# IA (optionnel)
OPENAI_API_KEY=ta_clé_openai
AI_PROVIDER=openai
AI_MODEL=gpt-4o-mini

# Channels (optionnel)
CHANNEL_LOGS=id_channel_logs
CHANNEL_MODLOGS=id_channel_mod_logs
```

## 📊 Fonctionnalités

### Bot Discord
- ✅ Commandes slash (/ping, /warn, /ban, /kick, /mute...)
- ✅ Système de warnings et sanctions
- ✅ Logs de modération
- ✅ Automodération configurable
- ✅ Support multi-serveurs

### Panel d'administration
- ✅ Dashboard avec statistiques
- ✅ Gestion des warnings
- ✅ Gestion des sanctions
- ✅ Configuration des serveurs
- ✅ Graphiques et export de données

## 🔧 Développement

### Ajouter une commande
1. Créer un fichier dans `bot/commands/category/`
2. Exporter `data` et `execute`
3. Déployer avec `npm run deploy`

### Ajouter une page au panel
1. Créer un fichier dans `panel/pages/`
2. Importer les composants nécessaires
3. Ajouter au menu dans `panel/app.py`

## 📝 Logs

Les logs sont disponibles dans :
- Console (Winston)
- Fichiers `logs/` (bot)
- Console Streamlit (panel)

## 🤝 Contribuer

1. Fork le projet
2. Créer une branche feature
3. Commit et push
4. Pull request

## 📄 Licence

MIT License - voir fichier LICENSE

## 🆘 Support

Pour toute question :
- Issues GitHub
- Discord du support
- Documentation dans `/docs`
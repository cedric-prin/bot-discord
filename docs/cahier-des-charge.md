# 📋 Cahier des charges — Cardinal Bot

## Sommaire

- [1. Contexte et objectifs](#1-contexte-et-objectifs)
- [2. Périmètre du projet](#2-périmètre-du-projet)
- [3. Contraintes](#3-contraintes)
- [4. Description des utilisateurs](#4-description-des-utilisateurs)
- [5. Livrables attendus](#5-livrables-attendus)
- [6. Critères de réussite](#6-critères-de-réussite)
- [📎 Annexes](#-annexes)

## 1. Contexte et objectifs

### 1.1 Description du projet
Cardinal Bot est une solution complète de modération pour serveurs Discord, composée de deux éléments :

- Bot Discord (Node.js/discord.js) : Agent de modération automatique et manuel fonctionnant 24/7 sur les serveurs Discord
- Panel d'administration (Python/Streamlit) : Interface web de gestion, statistiques et configuration

Le projet répond au besoin croissant des communautés Discord de grande taille (gaming, éducation, entreprises) de disposer d'outils de modération professionnels, traçables et intelligents.

### 1.2 Objectifs principaux

| ID | Objectif | Description |
|---|---|---|
| O1 | Automatiser la modération | Réduire de 70% le travail manuel des modérateurs grâce à l'AutoMod |
| O2 | Centraliser les données | Une base de données unique pour toutes les actions, warnings, sanctions |
| O3 | Traçabilité complète | Historique complet de chaque action avec logs consultables |
| O4 | Interface d'administration | Panel web pour gérer sans connaissances techniques |
| O5 | Intelligence artificielle | Détection avancée des comportements toxiques via IA (Phase 2) |
| O6 | Multi-serveurs | Support de plusieurs serveurs Discord simultanément |

### 1.3 Problèmes résolus

| Problème actuel | Solution Cardinal |
|---|---|
| Modération manuelle chronophage | AutoMod automatique (spam, liens, insultes) |
| Pas d'historique des sanctions | BDD complète avec historique par utilisateur |
| Configuration via commandes complexes | Panel web intuitif |
| Pas de vision globale | Dashboard avec statistiques temps réel |
| Sanctions incohérentes | Système de warns progressif automatisé |
| Difficile de détecter les récidivistes | Score de risque par utilisateur |

## 2. Périmètre du projet

### 2.1 Fonctionnalités principales

#### 🤖 Bot Discord (Core)

| ID | Fonctionnalité | Priorité | Description |
|---|---|---|---|
| F01 | Commandes de modération | Critique | /warn, /kick, /ban, /mute, /unmute, /unban |
| F02 | Système de warnings | Critique | Avertissements avec seuils automatiques |
| F03 | Sanctions temporaires | Critique | Mute/Ban avec durée et expiration auto |
| F04 | Logs de modération | Critique | Channel dédié pour toutes les actions |
| F05 | Historique utilisateur | Haute | /history @user - voir tout l'historique |
| F06 | AutoMod anti-spam | Haute | Détection flood de messages |
| F07 | AutoMod anti-liens | Haute | Blocage liens non autorisés |
| F08 | AutoMod anti-invites | Haute | Blocage invitations Discord |
| F09 | AutoMod bad words | Haute | Filtre de mots interdits |
| F10 | AutoMod mentions | Moyenne | Limite de mentions par message |
| F11 | Commandes utilitaires | Moyenne | /ping, /serverinfo, /userinfo, /avatar |
| F12 | Clear messages | Moyenne | /clear [nombre] - suppression en masse |

#### 🖥️ Panel Streamlit (Administration)

| ID | Fonctionnalité | Priorité | Description |
|---|---|---|---|
| P01 | Dashboard principal | Critique | Vue d'ensemble : stats, graphiques, activité |
| P02 | Gestion warnings | Critique | Liste, filtre, détail des warnings |
| P03 | Gestion sanctions | Critique | Liste bans/mutes actifs et historique |
| P04 | Profil utilisateur | Haute | Fiche complète par utilisateur |
| P05 | Configuration serveur | Haute | Settings AutoMod, channels, rôles |
| P06 | Graphiques statistiques | Haute | Évolution temporelle, répartition types |
| P07 | Export données | Moyenne | Export CSV/JSON des données |
| P08 | Multi-serveurs | Moyenne | Sélecteur de serveur dans le panel |

#### 🤖 Fonctionnalités IA (Phase 2 - v2.0)

| ID | Fonctionnalité | Priorité | Description |
|---|---|---|---|
| A01 | Analyse toxicité messages | Haute | Classification auto des messages |
| A02 | Suggestion de sanctions | Haute | IA suggère, humain valide |
| A03 | Score de risque IA | Haute | Analyse comportementale utilisateur |
| A04 | Commandes IA | Moyenne | /ask, /translate, /summarize |
| A05 | Détection anti-raid | Moyenne | Analyse patterns de joins suspects |
| A06 | Dashboard IA | Moyenne | Stats coûts API, historique décisions |

### 2.2 Exclusions (hors périmètre)

| Exclu | Raison |
|---|---|
| ❌ Système de tickets | Fonctionnalité séparée, autre bot |
| ❌ Musique/Audio | Hors scope modération |
| ❌ Niveaux/XP | Fonctionnalité engagement, pas modération |
| ❌ Application mobile native | Panel web responsive suffit |
| ❌ API REST publique | Usage interne uniquement |
| ❌ Multi-langue interface | Français uniquement v1 |
| ❌ Intégration autres plateformes | Discord uniquement |

## 3. Contraintes

### 3.1 Contraintes techniques

| Contrainte | Détail |
|---|---|
| Langage Bot | JavaScript (Node.js 18+) - Imposé par discord.js |
| Langage Panel | Python 3.10+ - Imposé par Streamlit |
| Framework Discord | discord.js v14 (dernière stable) |
| Framework Panel | Streamlit 1.28+ |
| Base de données | SQLite (fichier unique partagé JS/Python) |
| Hébergement | VPS Linux ou service cloud (Railway, Render) |
| API Discord | Respect rate limits Discord |
| API IA | Claude API (Anthropic) pour fonctionnalités IA |

### 3.2 Contraintes organisationnelles

| Contrainte | Détail |
|---|---|
| Équipe | 2 développeurs |
| Disponibilité | Sprint intensif 5 jours (Dim-Jeu) |
| Communication | Sync toutes les 2h minimum |
| Versionning | Git + GitHub, branches par feature |
| Tests | Serveur Discord de test dédié |

### 3.3 Budget

| Poste | Coût estimé |
|---|---|
| Développement | 0€ (équipe interne) |
| Hébergement VPS | 5-15€/mois |
| API Claude (IA) | ~20-50€/mois selon usage |
| Domaine (optionnel) | 10€/an |
| Total v1 (sans IA) | ~5-15€/mois |
| Total v2 (avec IA) | ~25-65€/mois |

### 3.4 Délais

| Milestone | Date | Contenu |
|---|---|---|
| Kick-off | Dimanche 01/12 | Début développement |
| v0.5 - Bot fonctionnel | Mardi 03/12 | Commandes modération de base |
| v1.0 - Release | Vendredi 06/12 | Bot + Panel complets |
| v2.0 - IA | Semaine suivante | Fonctionnalités intelligence artificielle |

Planning condensé :

- DIM 01/12 : Phase 1 + 2 (Fondations + BDD)
- LUN 02/12 : Phase 3 + 4 (Services + Modération)
- MAR 03/12 : Phase 5 + 6 (AutoMod + Utilitaires)
- MER 04/12 : Phase 7 + 8 (Panel + Finitions)
- JEU 05/12 : Phase 9 (IA)
- VEN 06/12 : 🎉 LIVRAISON v1.0

## 4. Description des utilisateurs

### 4.1 Personas cibles

#### 👮 Modérateur Discord

| Attribut | Description |
|---|---|
| Profil | Bénévole ou staff d'un serveur |
| Compétences tech | Basiques à moyennes |
| Besoins | Outils rapides, commandes simples |
| Frustrations | Tâches répétitives, manque d'historique |
| Usage Cardinal | Commandes slash quotidiennes |

#### 👑 Administrateur serveur

| Attribut | Description |
|---|---|
| Profil | Owner ou admin principal |
| Compétences tech | Moyennes à avancées |
| Besoins | Vue globale, configuration, stats |
| Frustrations | Pas de visibilité sur l'activité modération |
| Usage Cardinal | Panel web + commandes avancées |

#### 🏢 Gestionnaire communauté (pro)

| Attribut | Description |
|---|---|
| Profil | Community manager entreprise/esport |
| Compétences tech | Variables |
| Besoins | Rapports, compliance, traçabilité |
| Frustrations | Justifier les décisions, audits |
| Usage Cardinal | Panel + exports + rapports |

## 4.2 Cas d'usage principaux

CU1 : Avertir un utilisateur
ACTEUR : Modérateur
PRÉCONDITION : Utilisateur enfreint les règles
SCÉNARIO :
1. Mod tape /warn @user raison
2. Bot enregistre le warning en BDD
3. Bot envoie un DM à l'utilisateur
4. Bot log dans le channel mod-logs
5. Si seuil atteint → sanction auto (mute/ban)
POSTCONDITION : Warning enregistré, user notifié

CU2 : Consulter l'historique
ACTEUR : Modérateur/Admin
PRÉCONDITION : Besoin de vérifier un utilisateur
SCÉNARIO :
1. Mod tape /history @user
2. Bot affiche embed avec :
   - Nombre total warnings/sanctions
   - Score de risque
   - Liste des 10 derniers incidents
3. Option de voir plus via bouton
POSTCONDITION : Décision éclairée possible

CU3 : Configurer l'AutoMod (Panel)
ACTEUR : Administrateur
PRÉCONDITION : Accès au panel web
SCÉNARIO :
1. Admin ouvre panel → Settings
2. Sélectionne le serveur
3. Active/désactive modules AutoMod
4. Configure seuils (ex: 5 msgs/5sec = spam)
5. Sauvegarde
6. Bot applique immédiatement
POSTCONDITION : AutoMod configuré selon besoins

CU4 : Gérer un raid
ACTEUR : Système AutoMod
PRÉCONDITION : Afflux massif de nouveaux membres
SCÉNARIO :
1. AutoMod détecte pattern suspect (10+ joins/min)
2. Alerte dans mod-logs
3. [v2 IA] Analyse automatique des profils
4. Suggestion d'action (lockdown, mass ban)
5. Mod confirme ou ignore
POSTCONDITION : Raid contenu rapidement

CU5 : Analyser les statistiques
ACTEUR : Administrateur
PRÉCONDITION : Réunion staff ou audit
SCÉNARIO :
1. Admin ouvre panel → Dashboard
2. Visualise :
   - Graphique warnings/jour (30j)
   - Répartition sanctions par type
   - Top 10 users à risque
   - Activité par modérateur
3. Exporte en CSV si besoin
 POSTCONDITION : Rapport prêt pour présentation

## 5. Livrables attendus

### 5.1 Livrables techniques

| # | Livrable | Format | Description |
|---|---|---|---|
| L1 | Code source Bot | Repo GitHub | Code JS complet, structuré, commenté |
| L2 | Code source Panel | Repo GitHub | Code Python Streamlit |
| L3 | Base de données | Fichier SQLite | Schéma + données test |
| L4 | Scripts déploiement | Shell/npm | Scripts pour lancer bot + panel |
| L5 | Fichiers configuration | .env.example | Templates configuration |

### 5.2 Livrables documentation

| # | Livrable | Format | Contenu |
|---|---|---|---|
| D1 | README.md | Markdown | Installation, configuration, démarrage |
| D2 | Guide commandes | Markdown | Liste complète des commandes avec exemples |
| D3 | Guide Panel | Markdown | Utilisation de l'interface web |
| D4 | Architecture technique | Markdown + schémas | Structure du projet, flux de données |
| D5 | Changelog | Markdown | Historique des versions |

### 5.3 Livrables fonctionnels

| # | Livrable | Critère d'acceptation |
|---|---|---|
| F1 | Bot opérationnel | Connecté, répond aux commandes |
| F2 | 13 commandes modération | Toutes fonctionnelles et testées |
| F3 | AutoMod 5 modules | Spam, liens, invites, mots, mentions |
| F4 | Panel 6 pages | Dashboard, Warnings, Sanctions, Users, Settings, Logs |
| F5 | BDD initialisée | 7 tables, données persistées |


## 6. Critères de réussite

### 6.1 Critères quantitatifs

| Critère | Cible | Mesure |
|---|---|---|
| Délai | Vendredi 06/12 | si livré à temps |
| Tâches complétées | 112/112 | Tracker Leantime |
| Commandes fonctionnelles | 100% | Tests manuels |
| Uptime bot | > 99% | Pas de crash sur 24h test |
| Temps réponse commandes | < 500ms | Mesure moyenne |
| Pages panel fonctionnelles | 6/6 | Navigation complète |

### 6.2 Critères qualitatifs

| Critère | Validation |
|---|---|
| Code maintenable | Structure claire, commentaires, nommage cohérent |
| UX commandes | Messages clairs, embeds lisibles, feedback utilisateur |
| UX panel | Navigation intuitive, pas de formation nécessaire |
| Robustesse | Gestion des erreurs, pas de crash sur input invalide |
| Sécurité | Vérification permissions, pas d'injection SQL |
| Documentation | Suffisante pour reprendre le projet |

### 6.3 Définition du "Done"
Une fonctionnalité est considérée terminée quand :
 Code écrit et fonctionnel
 Testé manuellement (happy path + erreurs)
 Pas de console.error en fonctionnement normal
 Intégré à la branche main
 Documenté si nécessaire

### 6.4 Critères de succès global
Le projet est un succès si :

| # | Critère | Poids |
|---|---|---|
| 1 | Bot fonctionne 24/7 sans intervention | 25% |
| 2 | Toutes commandes modération opérationnelles | 25% |
| 3 | Panel affiche données correctes | 20% |
| 4 | AutoMod détecte et agit automatiquement | 15% |
| 5 | Documentation permet installation autonome | 10% |
| 6 | Code prêt pour ajout fonctionnalités futures | 5% |


## 📎 Annexes

### A. Arborescence projet

```text
cardinal-bot/
├── bot/
│   ├── bot.js
│   └── index.js
├── commands/
│   ├── moderation/
│   │   ├── warn.js
│   │   ├── kick.js
│   │   ├── ban.js
│   │   ├── mute.js
│   │   └── ...
│   └── utils/
│       ├── ping.js
│       └── ...
├── config/
│   ├── config.js
│   └── constants.js
├── database/
│   ├── js/
│   │   └── index.js
│   ├── python/
│   │   └── connection.py
│   ├── schema.sql
│   └── cardinal.db
├── events/
│   ├── ready.js
│   ├── interactionCreate.js
│   └── messageCreate.js
├── handlers/
│   ├── commandHandler.js
│   └── eventHandler.js
├── models/
│   ├── Guild.js
│   ├── User.js
│   ├── Warning.js
│   └── Sanction.js
├── repositories/
│   ├── guildRepo.js
│   ├── userRepo.js
│   ├── warningRepo.js
│   ├── sanctionRepo.js
│   └── python/
│       ├── guild_repo.py
│       ├── warning_repo.py
│       └── sanction_repo.py
├── services/
│   ├── embedBuilder.js
│   ├── permissions.js
│   ├── cooldowns.js
│   └── automod/
│       ├── index.js
│       ├── antiSpam.js
│       └── ...
├── utils/
│   ├── logger.js
│   ├── timeParser.js
│   └── validators.js
├── panel/
│   ├── app.py
│   ├── pages/
│   │   ├── 1_📊_Dashboard.py
│   │   ├── 2_⚠️_Warnings.py
│   │   └── ...
│   └── components/
├── .env.example
├── .gitignore
├── package.json
├── deploy-commands.js
├── README.md
└── requirements.txt
```

### B. Stack technologique

| Composant | Technologie | Version |
|---|---|---|
| Runtime Bot | Node.js | 18+ LTS |
| Framework Discord | discord.js | 14.x |
| Runtime Panel | Python | 3.10+ |
| Framework Panel | Streamlit | 1.28+ |
| Base de données | SQLite | 3.x |
| Driver SQLite JS | better-sqlite3 | 9.x |
| Logging | Winston | 3.x |
| Charts | Plotly | 5.x |
| IA (v2) | Claude API | claude-3-haiku |

### C. Glossaire

| Terme | Définition |
|---|---|
| Warning | Avertissement donné à un utilisateur |
| Sanction | Action punitive (kick, ban, mute) |
| AutoMod | Modération automatique basée sur règles |
| Guild | Serveur Discord |
| Slash command | Commande Discord commençant par / |
| Embed | Message formaté riche sur Discord |
| Rate limit | Limite de requêtes API Discord |
| Risk score | Score de dangerosité d'un utilisateur |

## ✅ Validation cahier des charges

| Rôle | Nom | Date | Signature |
|---|---|---|---|
| Chef de projet | Aboubacar & Cédric | 09/02/2026 | _________ |
| Développeur 1 | Aboubacar | 09/02/2026 | _________ |
| Développeur 2 | Cédric | 09/02/2026 | _________ |

Version du document : 1.0
Date de création : 09/02/2026
Dernière mise à jour : 09/02/2026
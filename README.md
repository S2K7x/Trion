# mini-soc

Dashboard SOC (Security Operations Center) en temps réel. Centralise les alertes de sécurité générées par **Wazuh**, visualise les tendances, identifie les IOCs malveillants et surveille les workflows d'automatisation n8n.

![Stack](https://img.shields.io/badge/Next.js-14-black) ![Stack](https://img.shields.io/badge/Supabase-PostgreSQL-green) ![Stack](https://img.shields.io/badge/Wazuh-4.9-blue) ![Stack](https://img.shields.io/badge/Docker-ready-blue)

---

## Table des matières

1. [Présentation](#présentation)
2. [Architecture globale](#architecture-globale)
3. [Modes de lancement](#modes-de-lancement)
4. [Configuration Supabase](#configuration-supabase)
5. [Variables d'environnement](#variables-denvironnement)
6. [Mode 1 — Dev local (npm)](#mode-1--dev-local-npm)
7. [Mode 2 — Prod local (npm start)](#mode-2--prod-local-npm-start)
8. [Mode 3 — App en Docker](#mode-3--app-en-docker)
9. [Mode 4 — Full Docker (docker-compose)](#mode-4--full-docker-docker-compose)
10. [Mode 5 — Full local sans cloud (Supabase local)](#mode-5--full-local-sans-cloud-supabase-local)
11. [Déployer sur Vercel](#déployer-sur-vercel)
12. [Configurer Wazuh](#configurer-wazuh)
13. [Configurer n8n](#configurer-n8n)
14. [Architecture technique](#architecture-technique)

---

## Présentation

mini-soc est un dashboard de surveillance sécurité connecté à Supabase (PostgreSQL), alimenté par Wazuh via des workflows n8n. Il affiche :

- **KPIs temps réel** — alertes du jour, queue en attente, alertes critiques, taux d'erreur
- **Graphique de tendance** — évolution horaire sur 24h
- **Top règles** — règles Wazuh les plus déclenchées sur 7 jours
- **IOCs malveillants** — IPs, URLs et hashes détectés
- **Statut des workflows** — état en direct des automatisations n8n

Le dashboard se rafraîchit automatiquement toutes les 30 secondes.

---

## Architecture globale

```
Endpoints surveillés
        │  Wazuh Agent (installé sur chaque machine)
        │  → chiffré TCP/1514
        ▼
  Wazuh Manager
        │  custom-n8n (script d'intégration)
        │  → HTTP POST /webhook/wazuh-ingest
        ▼
  n8n : soc-ingest
        │  transform + INSERT
        ▼
  Supabase — table alert_queue
        │
        ├──► n8n : soc-triage      → enrichissement IOCs, mise à jour statut
        ├──► n8n : soc-error-handler → retraitement des erreurs
        │
        └──► mini-soc Dashboard    → polling /api/stats toutes les 30s
                    │
                    ├── KPIs + trend chart
                    ├── Top règles Wazuh
                    ├── Table d'alertes + modal JSON brut
                    ├── Top IOCs malveillants
                    └── Statut workflows n8n
```

---

## Modes de lancement

| Mode | Dashboard | n8n | Base de données | Usage |
|------|-----------|-----|-----------------|-------|
| [Mode 1](#mode-1--dev-local-npm) | `npm run dev` | Docker | Supabase cloud | Développement |
| [Mode 2](#mode-2--prod-local-npm-start) | `npm start` | Docker | Supabase cloud | Prod en local |
| [Mode 3](#mode-3--app-en-docker) | Docker seul | Docker | Supabase cloud | App isolée |
| [Mode 4](#mode-4--full-docker-docker-compose) | Docker Compose | Docker Compose | Supabase cloud | Tout en Docker |
| [Mode 5](#mode-5--full-local-sans-cloud-supabase-local) | Docker Compose | Docker Compose | Supabase local | Zéro cloud |
| [Vercel](#déployer-sur-vercel) | Vercel | Docker | Supabase cloud | Déploiement public |

---

## Configuration Supabase

> Commun à tous les modes sauf le [Mode 5](#mode-5--full-local-sans-cloud-supabase-local).

### 1. Créer un projet Supabase

1. Aller sur [supabase.com](https://supabase.com) > **New project**
2. Choisir un nom, un mot de passe et une région
3. Attendre que le projet soit prêt (~2 min)

### 2. Créer la table `alert_queue`

Dans **SQL Editor**, exécuter :

```sql
CREATE TABLE alert_queue (
  id           bigserial PRIMARY KEY,
  dedup_key    text UNIQUE,
  raw_alert    jsonb NOT NULL,
  rule_id      text,
  rule_level   integer,
  rule_desc    text,
  agent_name   text,
  agent_ip     text,
  username     text,
  command      text,
  iocs         jsonb DEFAULT '[]'::jsonb,
  status       text DEFAULT 'pending'
                 CHECK (status IN ('pending','processing','done','error')),
  retry_count  integer DEFAULT 0,
  created_at   timestamptz DEFAULT now(),
  processed_at timestamptz
);
```

### 3. Créer les fonctions RPC

```sql
-- Taux d'erreur sur 24h
CREATE OR REPLACE FUNCTION get_error_rate()
RETURNS TABLE(error_rate numeric) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT CASE WHEN COUNT(*) = 0 THEN 0
    ELSE ROUND(COUNT(*) FILTER (WHERE status = 'error') * 100.0 / COUNT(*), 1)
  END FROM alert_queue WHERE created_at >= NOW() - INTERVAL '24 hours';
$$;

-- Tendance horaire sur 24h
CREATE OR REPLACE FUNCTION get_dashboard_trend()
RETURNS TABLE(hour timestamptz, count bigint, critical bigint) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT date_trunc('hour', created_at),
    COUNT(*), COUNT(*) FILTER (WHERE rule_level >= 12)
  FROM alert_queue WHERE created_at >= NOW() - INTERVAL '24 hours'
  GROUP BY 1 ORDER BY 1 ASC;
$$;

-- Top 10 règles sur 7 jours
CREATE OR REPLACE FUNCTION get_top_rules()
RETURNS TABLE(rule_id text, rule_desc text, count bigint) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT rule_id, rule_desc, COUNT(*)
  FROM alert_queue
  WHERE created_at >= NOW() - INTERVAL '7 days' AND rule_id IS NOT NULL
  GROUP BY rule_id, rule_desc ORDER BY 3 DESC LIMIT 10;
$$;

-- Top 20 IOCs malveillants sur 7 jours
CREATE OR REPLACE FUNCTION get_top_iocs()
RETURNS TABLE(ioc_value text, ioc_type text, verdict text, occurrences bigint, last_seen timestamptz)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT ioc->>'value', ioc->>'type', ioc->>'verdict', COUNT(*), MAX(created_at)
  FROM alert_queue, jsonb_array_elements(iocs) AS ioc
  WHERE created_at >= NOW() - INTERVAL '7 days' AND ioc->>'verdict' = 'MALICIOUS'
  GROUP BY 1,2,3 ORDER BY 4 DESC LIMIT 20;
$$;
```

### 4. Récupérer les clés API

Dans Supabase > **Project Settings** > **API** :

- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon / public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role** (secret) → `SUPABASE_SERVICE_KEY`

> `SUPABASE_SERVICE_KEY` donne un accès total à la base. Ne jamais l'exposer côté client.

---

## Variables d'environnement

```bash
cp .env.example .env.local
```

| Variable | Description | Comment l'obtenir |
|----------|-------------|-------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase | Supabase > Settings > API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé publique anon | Supabase > Settings > API |
| `SUPABASE_SERVICE_KEY` | Clé service_role (serveur uniquement) | Supabase > Settings > API |
| `DASHBOARD_PASSWORD` | Mot de passe d'accès au dashboard | Choisir librement |
| `DASHBOARD_SECRET` | Clé de signature JWT (min. 32 caractères) | `openssl rand -hex 32` |
| `N8N_API_URL` | URL de l'instance n8n | Ex: `http://localhost:5678` |
| `N8N_API_KEY` | API key n8n | n8n > Settings > n8n API |

---

## Mode 1 — Dev local (npm)

**Prérequis :** Node.js 18+, Docker

```bash
npm install
cp .env.example .env.local   # → éditer .env.local
docker compose up -d          # lancer n8n
npm run dev                   # http://localhost:3000
```

---

## Mode 2 — Prod local (npm start)

**Prérequis :** Node.js 18+, Docker

```bash
npm install
cp .env.example .env.local
npm run build
docker compose up -d
npm start                     # http://localhost:3000
```

---

## Mode 3 — App en Docker

**Prérequis :** Docker

```bash
cp .env.example .env.local

docker build -t mini-soc .
docker run -d \
  --name mini-soc-dashboard \
  --env-file .env.local \
  -p 3000:3000 \
  mini-soc

docker compose up -d          # lancer n8n séparément
```

---

## Mode 4 — Full Docker (docker-compose)

Dashboard + n8n en un seul `docker compose up`.

**Prérequis :** Docker

```bash
cp .env.example .env.local    # → éditer .env.local
docker compose -f docker-compose.full.yaml up -d --build
```

| Service | URL |
|---------|-----|
| Dashboard | http://localhost:3000 |
| n8n | http://localhost:5678 |

```bash
# Arrêter
docker compose -f docker-compose.full.yaml down

# Logs
docker compose -f docker-compose.full.yaml logs -f dashboard

# Rebuild après modification du code
docker compose -f docker-compose.full.yaml up -d --build dashboard
```

---

## Mode 5 — Full local sans cloud (Supabase local)

Aucune dépendance cloud. Supabase tourne entièrement via la CLI officielle.

**Prérequis :** Docker, [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started)

```bash
# Installer la CLI Supabase
brew install supabase/tap/supabase        # macOS
# ou : npm install -g supabase            # Linux/Windows

# Initialiser + lancer Supabase en local
supabase init
supabase start
```

La CLI affiche les URLs et clés locales au démarrage :

```
API URL: http://127.0.0.1:54321
anon key: eyJhbGc...
service_role key: eyJhbGc...
Studio URL: http://127.0.0.1:54323
```

Créer le schéma dans **Supabase Studio** (http://127.0.0.1:54323) > SQL Editor (même SQL que la section Supabase cloud), puis configurer `.env.local` :

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_KEY=<service_role key>
```

Lancer ensuite le projet avec le Mode 1, 2, ou 4.

```bash
supabase stop    # pour arrêter Supabase local
```

---

## Déployer sur Vercel

1. Aller sur [vercel.com](https://vercel.com) > **Add New… > Project**
2. Importer le repo GitHub `S2K7x/mini-soc`
3. Vercel détecte Next.js automatiquement
4. Dans **Environment Variables**, ajouter les 7 variables
5. Cliquer **Deploy**

> Si n8n n'est pas exposé sur internet, les workflow cards affichent "n8n unreachable" — le reste du dashboard fonctionne normalement.

---

## Configurer Wazuh

Wazuh est la source d'alertes principale de mini-soc. Il collecte les événements des endpoints (Linux, Windows, macOS) et les envoie à n8n via un script d'intégration.

### Qu'est-ce que Wazuh ?

Wazuh est une plateforme XDR/SIEM open source composée de 4 éléments :

| Composant | Rôle | Port |
|-----------|------|------|
| **Wazuh Agent** | Collecte les logs, surveille l'intégrité des fichiers, détecte les vulnérabilités sur l'endpoint | — |
| **Wazuh Manager** | Reçoit les événements des agents, les décode, applique les règles, génère les alertes | 1514, 1515, 55000 |
| **Wazuh Indexer** | Stocke et indexe toutes les alertes (OpenSearch) | 9200 |
| **Wazuh Dashboard** | Interface web de visualisation et de gestion | 443 |

### Niveaux de sévérité Wazuh

| Niveau | Catégorie | Description |
|--------|-----------|-------------|
| 0–2 | Ignoré | Bruit système, aucune action |
| 3–6 | Bas | Erreurs utilisateur, événements informatifs |
| 7–9 | Moyen | Patterns suspects, première apparition d'un événement |
| 10–11 | Élevé | Brute-force, modification de binaires |
| 12–14 | Critique | Attaques confirmées, corrélations importantes |
| 15 | Critique maximal | Attaque sévère, zéro faux positif |

**Recommandation** : envoyer à mini-soc les alertes de **niveau ≥ 7** (medium+). Pour un déploiement initial silencieux, commencer à **niveau ≥ 10**.

### Étape 1 — Installer Wazuh Manager

#### Option A : Docker (recommandé pour un lab)

```bash
# Cloner le repo officiel et se positionner sur la version stable 4.9
git clone https://github.com/wazuh/wazuh-docker.git
cd wazuh-docker
git checkout v4.9.0
cd single-node

# Générer les certificats TLS (obligatoire avant le premier démarrage)
docker compose -f generate-indexer-certs.yml run --rm generator

# Lancer les 3 services (Manager + Indexer + Dashboard)
docker compose up -d
```

| Service | URL | Identifiants par défaut |
|---------|-----|--------------------------|
| Dashboard Wazuh | https://localhost | admin / SecretPassword |
| Manager API | https://localhost:55000 | wazuh / wazuh |
| Indexer | https://localhost:9200 | admin / SecretPassword |

> Le fichier `docker-compose.wazuh.yaml` à la racine du repo est fourni comme référence de configuration. Le déploiement officiel s'effectue depuis le repo `wazuh/wazuh-docker` (les certificats et configs générés y sont requis).

#### Option B : Installation native (Ubuntu/Debian)

```bash
# Script d'installation automatique Wazuh 4.9
curl -sO https://packages.wazuh.com/4.9/wazuh-install.sh
sudo bash wazuh-install.sh -a
```

Ce script installe Manager + Indexer + Dashboard en une seule commande.

### Étape 2 — Installer les agents Wazuh

L'agent doit être installé sur **chaque machine** que tu veux surveiller.

#### Linux (Debian/Ubuntu)

```bash
# Remplacer WAZUH_MANAGER_IP par l'IP de ton Wazuh Manager
curl -s https://packages.wazuh.com/key/GPG-KEY-WAZUH | gpg --dearmor -o /usr/share/keyrings/wazuh.gpg
echo "deb [signed-by=/usr/share/keyrings/wazuh.gpg] https://packages.wazuh.com/4.x/apt/ stable main" \
  | tee /etc/apt/sources.list.d/wazuh.list
apt-get update
WAZUH_MANAGER="WAZUH_MANAGER_IP" apt-get install wazuh-agent
systemctl enable --now wazuh-agent
```

#### Windows (PowerShell, en admin)

```powershell
# Remplacer WAZUH_MANAGER_IP par l'IP de ton Wazuh Manager
$env:WAZUH_MANAGER = "WAZUH_MANAGER_IP"
Invoke-WebRequest -Uri "https://packages.wazuh.com/4.x/windows/wazuh-agent-4.9.0-1.msi" `
  -OutFile wazuh-agent.msi
Start-Process msiexec.exe -Wait -ArgumentList `
  "/i wazuh-agent.msi WAZUH_MANAGER=$env:WAZUH_MANAGER /quiet"
net start WazuhSvc
```

#### macOS

```bash
# Remplacer WAZUH_MANAGER_IP
curl -s https://packages.wazuh.com/4.x/macos/wazuh-agent-4.9.0-1.pkg \
  -o wazuh-agent.pkg
sudo launchctl setenv WAZUH_MANAGER "WAZUH_MANAGER_IP"
sudo installer -pkg wazuh-agent.pkg -target /
sudo /Library/Ossec/bin/wazuh-control start
```

Vérifier que l'agent est actif dans le **Dashboard Wazuh** > Agents.

### Étape 3 — Installer le script d'intégration

Le script `wazuh/custom-n8n` reçoit chaque alerte Wazuh et la transmet au webhook n8n.

```bash
# Copier le script sur le Wazuh Manager
cp wazuh/custom-n8n /var/ossec/integrations/custom-n8n

# Permissions obligatoires
chmod 750 /var/ossec/integrations/custom-n8n
chown root:wazuh /var/ossec/integrations/custom-n8n

# Installer la dépendance Python
pip3 install requests
```

### Étape 4 — Configurer ossec.conf

Ajouter le bloc d'intégration dans `/var/ossec/etc/ossec.conf`.

Le fichier `wazuh/ossec-integration.conf` contient le bloc à copier-coller.

```xml
<integration>
  <name>custom-n8n</name>
  <hook_url>http://N8N_HOST:5678/webhook/wazuh-ingest</hook_url>
  <level>7</level>
  <alert_format>json</alert_format>
</integration>
```

Remplacer `N8N_HOST` par l'IP ou le hostname de ta machine n8n.

Redémarrer le Manager :

```bash
systemctl restart wazuh-manager
# ou
/var/ossec/bin/wazuh-control restart
```

Vérifier les logs d'intégration :

```bash
tail -f /var/ossec/logs/integrations.log
```

### Étape 5 — Configurer le workflow n8n soc-ingest

Le workflow `soc-ingest` dans n8n reçoit les alertes Wazuh et les insère dans Supabase.

**Structure du workflow :**

```
[Webhook]  ←  POST /webhook/wazuh-ingest
    │
    ▼
[Code node]  ←  wazuh/n8n-transform.js (copier-coller ce code)
    │
    ▼
[Supabase : Insert Row]
    table : alert_queue
    conflict : dedup_key → ignore (évite les doublons)
```

Le fichier `wazuh/n8n-transform.js` contient le code du noeud de transformation. Il extrait et mappe tous les champs Wazuh vers le schéma `alert_queue`.

### Correspondance champs Wazuh → alert_queue

| Champ Wazuh | Champ alert_queue | Exemple |
|-------------|-------------------|---------|
| `rule.id` | `rule_id` | `"5710"` |
| `rule.level` | `rule_level` | `10` |
| `rule.description` | `rule_desc` | `"SSH brute force"` |
| `agent.name` | `agent_name` | `"web-server-01"` |
| `agent.ip` | `agent_ip` | `"192.168.1.100"` |
| `data.srcuser` / `data.dstuser` | `username` | `"admin"` |
| `full_log` | `command` | Log brut complet |
| Alert complet | `raw_alert` | JSON Wazuh original |
| `data.srcip`, `data.url`, `syscheck.sha256_after` | `iocs` | Array d'IOCs extraits |

### IOCs extraits automatiquement

| Source Wazuh | Champ | Type IOC |
|---|---|---|
| SSH, auth logs | `data.srcip` | IP source |
| Réseau | `data.dstip` | IP destination |
| Web/proxy | `data.url` | URL/domaine |
| FIM (fichier modifié) | `syscheck.sha256_after` | Hash SHA256 |
| FIM (fichier modifié) | `syscheck.md5_after` | Hash MD5 |
| VirusTotal (intégration) | `data.virustotal.source.md5` | Hash MALICIOUS |

### Vérification de l'intégration

```bash
# Tester manuellement avec un faux événement
/var/ossec/bin/ossec-logtest

# Surveiller les alertes en temps réel
tail -f /var/ossec/logs/alerts/alerts.json | python3 -m json.tool

# Vérifier que les alertes arrivent dans Supabase
# → Dashboard mini-soc > table d'alertes
```

---

## Configurer n8n

### Lancer n8n seul

```bash
docker compose up -d
# → http://localhost:5678
```

### Workflows attendus

Le dashboard surveille 3 workflows par nom exact :

| Nom | Rôle |
|-----|------|
| `soc-ingest` | Reçoit les alertes Wazuh et insère dans `alert_queue` |
| `soc-triage` | Enrichit les alertes (analyse IOCs, mise à jour statut) |
| `soc-error-handler` | Retraite les alertes en erreur |

### Générer une API key n8n

n8n > **Settings** > **n8n API** > **Create an API key** → copier dans `N8N_API_KEY`.

---

## Architecture technique

### Fichiers du repo

```
app/              → Pages et API routes Next.js
components/       → Composants UI (dashboard, charts, tables)
lib/              → Client Supabase, requêtes, types TypeScript
middleware.ts     → Protection JWT de toutes les routes
wazuh/
  custom-n8n          → Script Python d'intégration Wazuh→n8n
  ossec-integration.conf → Bloc ossec.conf à copier sur le Manager
  n8n-transform.js    → Code node n8n pour transformer les alertes
docker-compose.yaml          → n8n seul
docker-compose.full.yaml     → Dashboard + n8n
docker-compose.wazuh.yaml    → Wazuh Manager + Indexer + Dashboard (référence)
Dockerfile                   → Build image dashboard (multi-stage, Node 20)
```

### Fichiers Docker

| Fichier | Usage |
|---------|-------|
| `Dockerfile` | Build de l'image du dashboard |
| `.dockerignore` | Exclut node_modules, .next, .env.local |
| `docker-compose.yaml` | n8n seul |
| `docker-compose.full.yaml` | Dashboard + n8n ensemble |
| `docker-compose.wazuh.yaml` | Stack Wazuh complète (référence) |

### Sécurité

- Toutes les routes sont protégées par un middleware JWT
- Cookie `dashboard_session` : httpOnly, sameSite: lax, 24h
- `SUPABASE_SERVICE_KEY` uniquement côté serveur, jamais dans le bundle client
- Wazuh Manager → n8n : chiffrement TLS recommandé en production

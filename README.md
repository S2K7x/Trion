# mini-soc

Dashboard SOC (Security Operations Center) en temps réel. Centralise les alertes de sécurité, visualise les tendances, identifie les IOCs malveillants et surveille les workflows d'automatisation n8n.

![Stack](https://img.shields.io/badge/Next.js-14-black) ![Stack](https://img.shields.io/badge/Supabase-PostgreSQL-green) ![Stack](https://img.shields.io/badge/Docker-ready-blue)

---

## Table des matières

1. [Présentation](#présentation)
2. [Modes de lancement](#modes-de-lancement)
3. [Configuration Supabase](#configuration-supabase)
4. [Variables d'environnement](#variables-denvironnement)
5. [Mode 1 — Dev local (npm)](#mode-1--dev-local-npm)
6. [Mode 2 — Prod local (npm start)](#mode-2--prod-local-npm-start)
7. [Mode 3 — App en Docker](#mode-3--app-en-docker)
8. [Mode 4 — Full Docker (docker-compose)](#mode-4--full-docker-docker-compose)
9. [Mode 5 — Full local sans cloud (Supabase local)](#mode-5--full-local-sans-cloud-supabase-local)
10. [Déployer sur Vercel](#déployer-sur-vercel)
11. [Configurer n8n](#configurer-n8n)
12. [Architecture](#architecture)

---

## Présentation

mini-soc se connecte à Supabase (PostgreSQL) alimenté par des workflows n8n. Il affiche :

- **KPIs temps réel** — alertes du jour, queue en attente, alertes critiques, taux d'erreur
- **Graphique de tendance** — évolution horaire sur 24h
- **Top règles** — règles les plus déclenchées sur 7 jours
- **IOCs malveillants** — indicateurs de compromission détectés
- **Statut des workflows** — état en direct des automatisations n8n

Le dashboard se rafraîchit automatiquement toutes les 30 secondes.

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

> Cette étape est commune à tous les modes sauf le [Mode 5](#mode-5--full-local-sans-cloud-supabase-local).

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

Toujours dans le **SQL Editor** :

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

- **Project URL** → valeur de `NEXT_PUBLIC_SUPABASE_URL`
- **anon / public** → valeur de `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role** → valeur de `SUPABASE_SERVICE_KEY` *(ne jamais exposer cette clé côté client)*

---

## Variables d'environnement

Créer `.env.local` à la racine :

```bash
cp .env.example .env.local
```

| Variable | Description | Comment l'obtenir |
|----------|-------------|-------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase | Supabase > Settings > API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé publique anon | Supabase > Settings > API |
| `SUPABASE_SERVICE_KEY` | Clé service_role (serveur uniquement) | Supabase > Settings > API |
| `DASHBOARD_PASSWORD` | Mot de passe pour accéder au dashboard | Choisir librement |
| `DASHBOARD_SECRET` | Clé de signature JWT (min. 32 caractères) | Générer ci-dessous |
| `N8N_API_URL` | URL de l'instance n8n | Ex: `http://localhost:5678` |
| `N8N_API_KEY` | API key n8n | n8n > Settings > n8n API |

**Générer `DASHBOARD_SECRET` :**
```bash
openssl rand -hex 32
```

---

## Mode 1 — Dev local (npm)

Le mode classique pour développer. Le code se recharge à chaud.

**Prérequis :** Node.js 18+, Docker

```bash
# 1. Installer les dépendances
npm install

# 2. Configurer les variables
cp .env.example .env.local
# → éditer .env.local

# 3. Lancer n8n
docker compose up -d

# 4. Lancer le dashboard
npm run dev
```

Dashboard disponible sur [http://localhost:3000](http://localhost:3000).

---

## Mode 2 — Prod local (npm start)

Build de production exécuté directement sur la machine, sans Docker pour le dashboard.

**Prérequis :** Node.js 18+, Docker

```bash
# 1. Installer les dépendances
npm install

# 2. Configurer les variables
cp .env.example .env.local
# → éditer .env.local

# 3. Builder le projet
npm run build

# 4. Lancer n8n
docker compose up -d

# 5. Lancer le dashboard en production
npm start
```

Dashboard disponible sur [http://localhost:3000](http://localhost:3000).

---

## Mode 3 — App en Docker

Le dashboard tourne dans un container Docker, n8n dans un autre. Idéal pour tester l'image de production en local.

**Prérequis :** Docker

```bash
# 1. Configurer les variables
cp .env.example .env.local
# → éditer .env.local

# 2. Builder l'image du dashboard
docker build -t mini-soc .

# 3. Lancer le dashboard
docker run -d \
  --name mini-soc-dashboard \
  --env-file .env.local \
  -p 3000:3000 \
  mini-soc

# 4. Lancer n8n (dans un terminal séparé)
docker compose up -d
```

Dashboard disponible sur [http://localhost:3000](http://localhost:3000).

---

## Mode 4 — Full Docker (docker-compose)

Dashboard + n8n dans un seul `docker-compose.full.yaml`. La commande la plus simple pour tout lancer d'un coup.

**Prérequis :** Docker

```bash
# 1. Configurer les variables
cp .env.example .env.local
# → éditer .env.local

# 2. Tout lancer
docker compose -f docker-compose.full.yaml up -d --build
```

| Service | URL |
|---------|-----|
| Dashboard | [http://localhost:3000](http://localhost:3000) |
| n8n | [http://localhost:5678](http://localhost:5678) |

**Arrêter :**
```bash
docker compose -f docker-compose.full.yaml down
```

**Voir les logs :**
```bash
docker compose -f docker-compose.full.yaml logs -f dashboard
docker compose -f docker-compose.full.yaml logs -f n8n
```

**Rebuilder après modification du code :**
```bash
docker compose -f docker-compose.full.yaml up -d --build dashboard
```

---

## Mode 5 — Full local sans cloud (Supabase local)

Aucune dépendance cloud. Supabase tourne entièrement en local via la CLI officielle.

**Prérequis :** Docker, [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started)

### 1. Installer la CLI Supabase

```bash
# macOS
brew install supabase/tap/supabase

# Linux / Windows (via npm)
npm install -g supabase
```

### 2. Initialiser et lancer Supabase en local

```bash
# Initialiser le projet Supabase local (une seule fois)
supabase init

# Lancer tous les services Supabase en Docker
supabase start
```

Au démarrage, la CLI affiche les URLs et clés locales :

```
API URL: http://127.0.0.1:54321
anon key: eyJhbGc...
service_role key: eyJhbGc...
Studio URL: http://127.0.0.1:54323
```

### 3. Appliquer le schéma

```bash
# Créer le fichier de migration
mkdir -p supabase/migrations
# → copier le SQL de la section "Configuration Supabase" dans
#   supabase/migrations/20240101000000_init.sql

# Appliquer la migration
supabase db push
```

Ou l'exécuter directement dans **Supabase Studio** ([http://127.0.0.1:54323](http://127.0.0.1:54323)) > SQL Editor.

### 4. Configurer `.env.local` avec les valeurs locales

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key affiché par supabase start>
SUPABASE_SERVICE_KEY=<service_role key affiché par supabase start>
DASHBOARD_PASSWORD=admin
DASHBOARD_SECRET=<openssl rand -hex 32>
N8N_API_URL=http://localhost:5678
N8N_API_KEY=<api key n8n>
```

### 5. Lancer le projet

```bash
# Tout en Docker
docker compose -f docker-compose.full.yaml up -d --build

# ou en dev node
npm run dev
```

**Arrêter Supabase local :**
```bash
supabase stop
```

---

## Déployer sur Vercel

Déploiement via l'interface web Vercel, sans CLI.

1. Aller sur [vercel.com](https://vercel.com) > **Add New… > Project**
2. Importer le repo GitHub `S2K7x/mini-soc`
3. Vercel détecte Next.js automatiquement — ne rien changer dans les options de build
4. Dans **Environment Variables**, ajouter les 7 variables
5. Cliquer **Deploy**

> Si n8n tourne en local (non exposé sur internet), les workflow cards afficheront "n8n unreachable". Le reste du dashboard fonctionne normalement.

Chaque push sur `main` déclenche automatiquement un redéploiement.

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
| `soc-ingest` | Reçoit les alertes et les insère dans `alert_queue` |
| `soc-triage` | Enrichit les alertes (analyse IOCs, mise à jour statut) |
| `soc-error-handler` | Retraite les alertes en erreur |

### Générer une API key n8n

n8n > **Settings** > **n8n API** > **Create an API key** → copier dans `N8N_API_KEY`.

---

## Architecture

```
Alertes entrantes
       │
       ▼
  n8n (soc-ingest)
       │  INSERT dans alert_queue
       ▼
  Supabase (PostgreSQL)
       │
       ├──► n8n (soc-triage)    → enrichissement IOCs, mise à jour status
       │
       └──► Dashboard (Next.js) → polling /api/stats toutes les 30s
                  │
                  ├── StatCounters    (KPIs)
                  ├── TrendChart      (tendance 24h)
                  ├── TopRulesChart   (top règles 7j)
                  ├── AlertsTable     (alertes + modal détail)
                  ├── TopIocsTable    (IOCs malveillants)
                  └── WorkflowCards   (statut n8n)
```

### Fichiers Docker

| Fichier | Usage |
|---------|-------|
| `Dockerfile` | Build de l'image du dashboard (multi-stage, Node 20 Alpine) |
| `.dockerignore` | Exclut node_modules, .next, .env.local du contexte de build |
| `docker-compose.yaml` | n8n seul |
| `docker-compose.full.yaml` | Dashboard + n8n ensemble |

### Sécurité

- Toutes les routes sont protégées par un middleware JWT
- Cookie de session `dashboard_session` : httpOnly, sameSite: lax, 24h
- `SUPABASE_SERVICE_KEY` uniquement côté serveur, jamais dans le bundle client

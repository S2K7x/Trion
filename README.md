# mini-soc

Dashboard SOC (Security Operations Center) en temps réel. Centralise les alertes de sécurité, visualise les tendances, identifie les IOCs malveillants et surveille les workflows d'automatisation n8n.

![Stack](https://img.shields.io/badge/Next.js-14-black) ![Stack](https://img.shields.io/badge/Supabase-PostgreSQL-green) ![Stack](https://img.shields.io/badge/Vercel-Deploy-blue)

---

## Table des matières

1. [Présentation](#présentation)
2. [Prérequis](#prérequis)
3. [Configuration Supabase](#configuration-supabase)
4. [Variables d'environnement](#variables-denvironnement)
5. [Lancer en local](#lancer-en-local)
6. [Déployer sur Vercel](#déployer-sur-vercel)
7. [Configurer n8n](#configurer-n8n)
8. [Architecture](#architecture)

---

## Présentation

mini-soc est un dashboard de surveillance sécurité qui se connecte à une base Supabase alimentée par des workflows n8n. Il affiche :

- **KPIs temps réel** — alertes du jour, queue en attente, alertes critiques, taux d'erreur
- **Graphique de tendance** — évolution horaire sur 24h
- **Top règles** — règles les plus déclenchées sur 7 jours
- **IOCs malveillants** — indicateurs de compromission détectés
- **Statut des workflows** — état en direct des automatisations n8n

Le dashboard se rafraîchit automatiquement toutes les 30 secondes.

---

## Prérequis

- Node.js 18+
- Un compte [Supabase](https://supabase.com) (gratuit)
- Un compte [Vercel](https://vercel.com) (gratuit) pour le déploiement
- Docker (optionnel, uniquement pour n8n en local)

---

## Configuration Supabase

### 1. Créer un projet Supabase

1. Aller sur [supabase.com](https://supabase.com) > **New project**
2. Choisir un nom, un mot de passe de base de données et une région
3. Attendre que le projet soit prêt (~2 min)

### 2. Créer la table `alert_queue`

Dans Supabase, aller dans **SQL Editor** et exécuter :

```sql
CREATE TABLE alert_queue (
  id          bigserial PRIMARY KEY,
  dedup_key   text UNIQUE,
  raw_alert   jsonb NOT NULL,
  rule_id     text,
  rule_level  integer,
  rule_desc   text,
  agent_name  text,
  agent_ip    text,
  username    text,
  command     text,
  iocs        jsonb DEFAULT '[]'::jsonb,
  status      text DEFAULT 'pending'
                CHECK (status IN ('pending','processing','done','error')),
  retry_count integer DEFAULT 0,
  created_at  timestamptz DEFAULT now(),
  processed_at timestamptz
);
```

### 3. Créer les fonctions RPC

Ces 4 fonctions sont appelées par le dashboard. Toujours dans le **SQL Editor** :

```sql
-- Taux d'erreur sur les 24 dernières heures
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

> La clé `service_role` donne un accès total à la base. Elle ne doit jamais être exposée côté client ou dans le code source.

---

## Variables d'environnement

Créer un fichier `.env.local` à la racine du projet (copier depuis `.env.example`) :

```bash
cp .env.example .env.local
```

Remplir les valeurs :

| Variable | Description | Comment l'obtenir |
|----------|-------------|-------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase | Supabase > Settings > API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé publique anon | Supabase > Settings > API |
| `SUPABASE_SERVICE_KEY` | Clé service_role (privée) | Supabase > Settings > API |
| `DASHBOARD_PASSWORD` | Mot de passe pour accéder au dashboard | Choisir librement |
| `DASHBOARD_SECRET` | Clé de signature JWT (min. 32 caractères) | Générer aléatoirement |
| `N8N_API_URL` | URL de l'instance n8n | Ex: `http://localhost:5678` |
| `N8N_API_KEY` | API key n8n | n8n > Settings > n8n API |

**Générer un `DASHBOARD_SECRET` sécurisé :**

```bash
openssl rand -hex 32
```

---

## Lancer en local

```bash
# Installer les dépendances
npm install

# Configurer les variables d'environnement
cp .env.example .env.local
# → éditer .env.local avec les valeurs

# Lancer le serveur de développement
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000) — le login demande le `DASHBOARD_PASSWORD` configuré.

---

## Déployer sur Vercel

Le déploiement se fait entièrement via l'interface web Vercel, sans CLI.

### Étapes

1. Aller sur [vercel.com](https://vercel.com) et se connecter
2. Cliquer **Add New… > Project**
3. Importer le repo GitHub `S2K7x/mini-soc`
4. Vercel détecte automatiquement Next.js — ne rien changer dans les options de build
5. Ouvrir la section **Environment Variables** et ajouter les 7 variables :

| Variable | Valeur |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé anon Supabase |
| `SUPABASE_SERVICE_KEY` | Clé service_role Supabase |
| `DASHBOARD_PASSWORD` | Mot de passe choisi |
| `DASHBOARD_SECRET` | Clé aléatoire 32+ chars |
| `N8N_API_URL` | URL n8n (accessible depuis Vercel) |
| `N8N_API_KEY` | API key n8n |

6. Cliquer **Deploy**

> Si n8n tourne en local (non exposé sur internet), les workflow cards afficheront "n8n unreachable" — c'est normal et non bloquant. Le reste du dashboard fonctionnera.

### Mises à jour

Chaque push sur la branche `main` déclenche automatiquement un nouveau déploiement Vercel.

---

## Configurer n8n

n8n est l'outil d'automatisation qui alimente la table `alert_queue`. Il tourne en local via Docker.

### Lancer n8n

```bash
docker compose up -d
```

n8n est disponible sur [http://localhost:5678](http://localhost:5678).

### Workflows attendus

Le dashboard surveille 3 workflows par nom :

| Nom du workflow | Rôle |
|-----------------|------|
| `soc-ingest` | Reçoit les alertes entrantes et les insère dans Supabase |
| `soc-triage` | Enrichit les alertes (analyse IOCs, mise à jour du statut) |
| `soc-error-handler` | Traite les alertes en erreur |

Les noms doivent correspondre exactement pour que le statut s'affiche correctement.

### Générer une API key n8n

Dans n8n : **Settings** > **n8n API** > **Create an API key**

Copier la clé dans la variable `N8N_API_KEY`.

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
       ├──► n8n (soc-triage)     → enrichissement IOCs, mise à jour status
       │
       └──► Dashboard (Next.js)  → polling /api/stats toutes les 30s
                  │
                  ├── StatCounters    (KPIs temps réel)
                  ├── TrendChart      (tendance 24h)
                  ├── TopRulesChart   (top règles 7j)
                  ├── AlertsTable     (dernières alertes + modal détail)
                  ├── TopIocsTable    (IOCs malveillants)
                  └── WorkflowCards   (statut n8n)
```

### Sécurité

- Toutes les routes sont protégées par un middleware JWT
- Le cookie de session (`dashboard_session`) est httpOnly, sameSite: lax, durée 24h
- La clé `SUPABASE_SERVICE_KEY` n'est utilisée que côté serveur (jamais dans le bundle client)

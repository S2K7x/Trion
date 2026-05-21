# mini-soc — CLAUDE.md

## Présentation du projet

Dashboard SOC (Security Operations Center) en Next.js 14. Affiche en temps réel les alertes de sécurité stockées dans Supabase, visualise les tendances, liste les IOCs malveillants et surveille les workflows d'automatisation n8n.

**Stack :** Next.js 14 · React 18 · TypeScript · Tailwind CSS · Supabase (PostgreSQL) · Recharts · n8n · Wazuh 4.9 · Jose (JWT)

---

## Architecture

```
Trion/
├── trion-soc/                  # Dashboard Next.js (ce projet)
├── trion-agent/                # Agent Python SOC
├── demo/                       # Démo standalone (mock data)
├── docker-compose.yaml         # n8n local dev
├── docker-compose.soc.yaml     # Dashboard + n8n (full Docker)
├── docker-compose.n8n-prod.yaml
├── docker-compose.wazuh.yaml
├── install.sh                  # Installeur unifié
├── wazuh/                      # Intégration Wazuh
└── docs/

trion-soc/
├── app/
│   ├── api/
│   │   ├── auth/route.ts       # Login → génère un JWT cookie 24h
│   │   ├── logout/route.ts     # Supprime le cookie de session
│   │   └── stats/route.ts      # GET /api/stats → données dashboard (no-cache)
│   ├── login/page.tsx          # Page de connexion (mot de passe unique)
│   ├── page.tsx                # Dashboard SSR (force-dynamic)
│   ├── layout.tsx              # Layout racine, font JetBrains Mono, thème sombre
│   └── globals.css             # Tailwind + scrollbar custom
├── components/
│   ├── DashboardShell.tsx      # Conteneur client, polling 30s, gestion état
│   ├── Header.tsx              # Barre haute + bouton logout
│   ├── StatCounters.tsx        # 4 KPIs : aujourd'hui / queue / critiques / erreurs
│   ├── TrendChart.tsx          # Graphique tendance 24h (area chart)
│   ├── TopRulesChart.tsx       # Graphique top règles 7j (bar chart)
│   ├── AlertsTable.tsx         # Table paginée (10/page) + modal détail
│   ├── TopIocsTable.tsx        # Top IOCs malveillants
│   ├── WorkflowCards.tsx       # Statut des workflows n8n
│   └── charts/
│       ├── TrendChartInner.tsx       # Recharts area chart (client-only)
│       └── TopRulesChartInner.tsx    # Recharts bar chart (client-only)
├── lib/
│   ├── supabase-server.ts      # Factory client Supabase (service key, no session)
│   ├── queries.ts              # getDashboardStats() — 9 requêtes parallèles
│   └── types.ts                # Interfaces TypeScript
├── middleware.ts               # Protection JWT sur toutes les routes sauf /login
├── supabase/migrations/        # Migrations SQL Supabase
├── Dockerfile                  # Image Docker standalone
└── vercel.json                 # { "framework": "nextjs" }
```

---

## Variables d'environnement

À configurer dans Vercel > Project Settings > Environment Variables (ou `.env.local` en local).

| Variable | Description | Exemple |
|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase | `https://sxlrinzqcolmmmmocoul.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé anon (publique) | Supabase > Settings > API |
| `SUPABASE_SERVICE_KEY` | Clé service_role (privée, serveur uniquement) | Supabase > Settings > API |
| `DASHBOARD_PASSWORD` | Mot de passe d'accès au dashboard | Choisir librement |
| `DASHBOARD_SECRET` | Clé de signature JWT (min. 32 chars) | Chaîne aléatoire |
| `N8N_API_URL` | URL de l'instance n8n | `http://10.100.102.12:5678` |
| `N8N_API_KEY` | API key n8n | n8n > Settings > API |

> **Sécurité :** `SUPABASE_SERVICE_KEY` ne doit jamais être exposé côté client. Il n'est utilisé que dans `lib/supabase-server.ts` (server-side uniquement).

---

## Base de données Supabase

**Projet ID :** `sxlrinzqcolmmmmocoul`

### Table `alert_queue`

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | bigint (PK, auto) | Identifiant unique |
| `dedup_key` | text (unique) | Clé de déduplication |
| `raw_alert` | jsonb | Alerte brute originale |
| `rule_id` | text | Identifiant de la règle |
| `rule_level` | integer | Sévérité (0–20, critique ≥ 12) |
| `rule_desc` | text | Description de la règle |
| `agent_name` | text | Hostname de la source |
| `agent_ip` | text | IP de la source |
| `username` | text | Utilisateur associé |
| `command` | text | Commande déclenchante |
| `iocs` | jsonb | Array d'IOCs `[{value, type, verdict}]` |
| `status` | text | `pending` \| `processing` \| `done` \| `error` |
| `retry_count` | integer | Nombre de tentatives |
| `created_at` | timestamptz | Date de création |
| `processed_at` | timestamptz | Date de traitement |

### Fonctions RPC (créées via migration)

| Fonction | Retourne | Description |
|----------|---------|-------------|
| `get_error_rate()` | `{error_rate: numeric}` | % alertes en erreur sur 24h |
| `get_dashboard_trend()` | `{hour, count, critical}[]` | Counts horaires sur 24h |
| `get_top_rules()` | `{rule_id, rule_desc, count}[]` | Top 10 règles sur 7 jours |
| `get_top_iocs()` | `{ioc_value, ioc_type, verdict, occurrences, last_seen}[]` | Top 20 IOCs MALICIOUS sur 7j |

---

## Authentification

- Mot de passe unique stocké dans `DASHBOARD_PASSWORD`
- Le middleware (`middleware.ts`) protège toutes les routes sauf `/login` et `/api/auth`
- Cookie `dashboard_session` (httpOnly, sameSite: lax, 24h)
- JWT signé HS256 avec `DASHBOARD_SECRET`

---

## Déploiement Vercel (sans CLI)

1. Aller sur [vercel.com](https://vercel.com) > **Add New Project**
2. Importer le repo GitHub `S2K7x/mini-soc`
3. Framework détecté automatiquement : **Next.js**
4. Dans **Environment Variables**, ajouter les 7 variables listées ci-dessus
5. Cliquer **Deploy**

Le `vercel.json` est déjà configuré. Aucune commande de build personnalisée requise.

---

## Développement local

```bash
cp .env.example .env.local
# remplir les valeurs dans .env.local
npm install
npm run dev
# → http://localhost:3000
```

Pour lancer n8n en local :
```bash
docker compose up -d
# → http://localhost:5678
```

---

## Flows de données

```
Wazuh Agent (endpoint) → Manager:1514
    → wazuh-integratord → custom-n8n (wazuh/custom-n8n)
    → POST /webhook/wazuh-ingest
    → n8n (soc-ingest) → transform (wazuh/n8n-transform.js)
    → Supabase alert_queue
         ↓
    n8n (soc-triage) → enrichissement IOCs, update statut
         ↓
    Dashboard (polling 30s) ← /api/stats
```

Les 3 workflows n8n surveillés : `soc-ingest`, `soc-triage`, `soc-error-handler`.

---

## Intégration Wazuh

Fichiers dans `wazuh/` :

| Fichier | Rôle |
|---------|------|
| `custom-n8n` | Script Python à copier dans `/var/ossec/integrations/` sur le Manager |
| `ossec-integration.conf` | Bloc XML à ajouter dans `/var/ossec/etc/ossec.conf` |
| `n8n-transform.js` | Code node n8n (workflow soc-ingest) |

**Ports Wazuh :**
- `1514` — agents → manager (events)
- `1515` — agents → manager (enrollment)
- `55000` — REST API manager
- `9200` — Indexer (OpenSearch)
- `443` — Dashboard

**Niveau minimum recommandé** : `7` dans `<level>` (ossec.conf) pour capturer medium+.

**Champs importants de l'alerte Wazuh :**
- `rule.id`, `rule.level`, `rule.description` → règle déclenchée
- `agent.name`, `agent.ip` → machine source
- `data.srcip`, `data.dstip`, `data.url` → IOCs réseau
- `syscheck.sha256_after`, `syscheck.md5_after` → IOCs fichiers (FIM)
- `full_log` → log brut original

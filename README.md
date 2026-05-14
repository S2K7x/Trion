# mini-soc

Dashboard SOC (Security Operations Center) en temps réel. Affiche et analyse les alertes de sécurité, visualise les tendances, suit les IOCs malveillants et surveille les workflows d'automatisation n8n.

## Stack

- **Frontend** : Next.js 14, React 18, TypeScript, Tailwind CSS, Recharts
- **Backend** : Supabase (PostgreSQL)
- **Automatisation** : n8n
- **Auth** : JWT cookie (mot de passe unique)
- **Déploiement** : Vercel

## Structure du repo

```
app/          → Pages et API routes Next.js
components/   → Composants UI (dashboard, charts, tables)
lib/          → Client Supabase, requêtes, types TypeScript
middleware.ts → Protection JWT de toutes les routes
docker-compose.yaml → n8n en local
```

## Variables d'environnement

Copier `.env.example` en `.env.local` et remplir :

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé anon Supabase |
| `SUPABASE_SERVICE_KEY` | Clé service_role (serveur uniquement) |
| `DASHBOARD_PASSWORD` | Mot de passe d'accès |
| `DASHBOARD_SECRET` | Clé de signature JWT (32+ chars) |
| `N8N_API_URL` | URL de l'instance n8n |
| `N8N_API_KEY` | API key n8n |

## Développement local

```bash
npm install
cp .env.example .env.local
# remplir .env.local
npm run dev
```

Pour lancer n8n :
```bash
docker compose up -d
```

## Déploiement Vercel

1. Importer le repo sur [vercel.com](https://vercel.com)
2. Ajouter les 7 variables d'environnement dans **Project Settings > Environment Variables**
3. Déployer — aucune config supplémentaire requise

## Base de données

La table `alert_queue` et les 4 fonctions RPC (`get_error_rate`, `get_dashboard_trend`, `get_top_rules`, `get_top_iocs`) doivent exister dans Supabase. Voir `CLAUDE.md` pour le schéma complet.

## Flow de données

```
Alerte → n8n (soc-ingest) → Supabase → n8n (soc-triage) → Dashboard
```

# trion-soc demo

Standalone version of the [trion-soc](../trion-soc/README.md) dashboard running entirely on mock data.

No Supabase, no n8n, no Wazuh required. Open it in a browser and explore the UI instantly.

The live version is deployed at [trion-snowy.vercel.app](https://trion-snowy.vercel.app) · login: `demo`

---

## Run locally

```bash
cd demo
npm install
npm run dev
```

Dashboard available at `http://localhost:3001`.

No `.env` file needed — all data is generated from [`lib/mock-data.ts`](lib/mock-data.ts).

---

## What it is

The demo is a copy of `trion-soc` where all Supabase queries in `lib/queries.ts` are replaced with static mock responses. Everything else — routing, components, charts, auth flow — is identical to the real dashboard.

Use it to:
- Preview the UI before setting up a backend
- Develop and test UI changes without a live database
- Share a working demo publicly without exposing real alert data

---

## Difference from trion-soc

| | trion-soc | demo |
|-|-----------|------|
| Data source | Supabase (live) | `lib/mock-data.ts` (static) |
| Auth | `DASHBOARD_PASSWORD` env var | Password: `demo` |
| Env file | Required | Not needed |
| Deployment | Vercel with env vars | Vercel as-is |

To switch back to real data, see [trion-soc/README.md](../trion-soc/README.md).

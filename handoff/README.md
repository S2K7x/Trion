# Trion — Claude Code handoff bundle

Drop-in design system + 6 screens for **`S2K7x/mini-soc`** (Next.js 14 + Tailwind).
Generated 2026-05-15.

> **Brand:** Trion · **Tagline:** Triage at the speed of threat.
> **Theme:** dark premium · Syne (UI) + DM Mono (data) · semantic-monochromatic.

---

## What's in here

```
handoff/
├── README.md                     ← you are here
├── globals.css                   ← extends app/globals.css (tokens, animations)
├── tailwind.config.ts            ← extended palette + font stack
├── lib/
│   └── design.ts                 ← severity/status helpers (typed)
└── components/
    ├── primitives/
    │   ├── StatCard.tsx
    │   ├── StatusBadge.tsx
    │   ├── SevDot.tsx
    │   ├── SeverityChip.tsx
    │   ├── IocPill.tsx
    │   ├── Panel.tsx
    │   ├── Button.tsx
    │   └── PageHeader.tsx
    ├── shell/
    │   ├── Sidebar.tsx
    │   └── Topbar.tsx
    └── screens/                  ← new pages (route under app/)
        ├── AlertQueueScreen.tsx
        ├── TimelineScreen.tsx
        ├── IocsScreen.tsx
        ├── ReputationScreen.tsx
        └── AuditLogScreen.tsx
```

The **Overview** screen, `AlertsTable`, `StatCounters`, `TopIocsTable`, `WorkflowCards`
already exist in your repo and stay as-is. This bundle:

1. **Replaces** `app/globals.css` (tokens superset — your existing rules remain).
2. **Extends** `tailwind.config.ts` (adds `orange-dim`, `dim`, `font-display`, etc.).
3. **Adds** `lib/design.ts` for severity/status helpers (centralizes logic
   currently duplicated in `AlertsTable.tsx`).
4. **Adds** new screen routes under `app/`.

---

## Routes to add

| Route               | File                                | Existing repo equivalent              |
| ------------------- | ----------------------------------- | ------------------------------------- |
| `/` (Overview)      | already in `app/page.tsx`           | keep as-is                            |
| `/alerts`           | new — `AlertQueueScreen.tsx`        | extends `AlertsTable.tsx`             |
| `/timeline`         | new — `TimelineScreen.tsx`          | new feature                           |
| `/iocs`             | new — `IocsScreen.tsx`              | extends `TopIocsTable.tsx`            |
| `/reputation`       | new — `ReputationScreen.tsx`        | new feature                           |
| `/audit`            | new — `AuditLogScreen.tsx`          | new feature                           |

For each new route, create `app/<route>/page.tsx` that imports the screen:

```tsx
// app/alerts/page.tsx
import { AlertQueueScreen } from '@/components/screens/AlertQueueScreen'
export default function Page() { return <AlertQueueScreen /> }
```

---

## Data contracts

**No new types** for Alert Queue, Timeline, IOCs (Overview)
— `lib/types.ts` already covers them.

**New types needed** for full IOC reputation + audit:

```ts
// lib/types.ts additions
export interface IocReputation {
  indicator: string
  type: 'IP' | 'MD5' | 'SHA256' | 'URL' | 'DOMAIN'
  verdict: 'MALICIOUS' | 'SUSPICIOUS' | 'BENIGN'
  confidence: number       // 0–100
  first_seen: string       // iso
  last_seen: string
  country?: string
  asn?: string
  sources: {
    name: 'VirusTotal' | 'AbuseIPDB' | 'MalwareBazaar' | 'OTX'
    score: number
    total: number
    verdict: 'malicious' | 'suspicious' | 'benign'
    categories: string[]
    updated: string
  }[]
  related: { value: string; type: string; occurrences: number }[]
}

export interface AuditEvent {
  id: number               // sequential
  ts: string               // iso
  actor: string            // 'system' | 'soc-*' | username
  action: string           // e.g. 'alert.triaged'
  target: string
  meta: string
  hash: string             // sha256 prefix, e.g. '0x8a3f…d1c2'
}
```

**RPCs needed** (Supabase migrations):

| Function                          | Returns                |
| --------------------------------- | ---------------------- |
| `get_audit_log(limit int)`        | `AuditEvent[]`         |
| `get_ioc_reputation(value text)`  | `IocReputation`        |
| `get_iocs_paginated(...)`         | `TopIoc[]` (extended)  |

Reputation source fetching should live in a separate worker
(VT, AbuseIPDB, MalwareBazaar API calls), writing into a
`ioc_reputation` table. The dashboard reads cached rows only.

---

## Interactions checklist

- [x] Sidebar nav: click navigates between screens (`useRouter().push`)
- [x] Active nav item: left 2px indicator bar + accent-dim background
- [x] Table row hover: `surface-2` background, cursor:pointer
- [x] Stat card hover: border brightens to `border-2`
- [x] Status badge `processing`: 1.8s pulse animation
- [x] Severity dot `critical`: 1px box-shadow glow
- [x] Page-load: staggered fade-up (0.05s increments per section)
- [ ] Auto-refresh: keep existing 30s polling pattern in `DashboardShell`
- [ ] Reputation lookup: debounced search (300ms), `/api/reputation?q=`
- [ ] Audit log: SHA-256 hash chain verification on `verify chain` click

---

## Aesthetic guardrails

- **NO gradients** anywhere (the only "fill" is the stat-card ::after orb at 6–14% opacity)
- **NO glassmorphism** — no blurred backgrounds
- **NO neon glow** except the single 1px box-shadow on critical severity dots
- Borders are nearly invisible: `rgba(255,255,255,0.06)` — `border-2` for hover
- Spacing: 4px base unit, prefer multiples of 4 (4/8/12/16/20/24/28/32/40/48)
- Type: **Syne** for everything UI-facing, **DM Mono** for any value the user
  may copy/paste (IPs, hashes, timestamps, IDs, hashes, rule numbers)

---

## Build order suggested

1. Apply `globals.css` + `tailwind.config.ts` → commit (no visual regression on existing pages)
2. Drop in `lib/design.ts` and refactor `AlertsTable.tsx` to import from it
3. Add primitives to `components/primitives/` (none collide with existing names)
4. Promote existing `DashboardShell` `Sidebar`/`Topbar` inline JSX into
   `components/shell/Sidebar.tsx` + `Topbar.tsx`, use them in a `<RootLayout>` wrapper
5. Convert `app/page.tsx` to use the shared shell
6. Add new routes one at a time (alerts → timeline → iocs → reputation → audit)
7. Wire RPCs in `lib/queries.ts`

See the HTML prototype (`Trion.html` in the parent folder) for the full
clickable reference — every screen, every state, every component.

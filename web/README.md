# q-advantage/web

The full Q-Advantage site. Next.js 14 App Router + TypeScript + Tailwind +
Recharts + shadcn/ui primitives. Hosts both the marketing landing (`/`)
and the Q-Shield dashboard (`/q-shield`).

Reads benchmark results from `../benchmark/results/` at build time.

## Local development

```bash
cd web
npm install
npm run dev
```

`npm run dev` runs `predev` first, which copies `../benchmark/results/*.json`
into `data/results/`. The Next.js loader reads from `data/results/` only —
it never reaches outside `web/`.

## Smoke test the loader

```bash
npm run smoke
```

Prints a digest of every run, the audit-strip values, normalized algorithm
metadata, and the unit-shifter on the wide-range edge cases. Verify before
shipping any UI change to `lib/data/`.

## Environment variables

Required in Vercel project settings (and `.env.local` for local dev with
real subscribe flow):

```
BEEHIIV_API_KEY=<your-beehiiv-api-key>
BEEHIIV_PUB_ID=pub_<your-publication-id>
```

Without these, `/api/subscribe` returns 503 and the form shows a graceful
error message. The dashboard pages work regardless.

## Vercel deploy

- **Root Directory**: `web`
- **Framework Preset**: Next.js (auto-detected)
- **Build Command**: default (`npm run build`) — `prebuild` runs automatically
- **Node version**: 20.x
- **Env vars**: `BEEHIIV_API_KEY`, `BEEHIIV_PUB_ID`

## Architecture

```
web/
├── app/
│   ├── layout.tsx              # Root layout: Inter Tight + Instrument Serif + Geist Mono, dark mode
│   ├── globals.css             # Tailwind base, marketing-only bg utilities, reveal animations
│   ├── page.tsx                # Marketing landing — hero, products, methodology, subscribe
│   ├── api/subscribe/route.ts  # Beehiiv subscribe forwarder (edge runtime)
│   └── q-shield/
│       ├── page.tsx                       # Dashboard landing — audit strip, presets, tables
│       ├── opengraph-image.tsx            # OG image for /q-shield (1200×630, edge runtime)
│       ├── compare/page.tsx               # Compare view (server) + CompareView (client)
│       └── [algorithm]/
│           ├── page.tsx                   # Per-algo detail with sparklines
│           └── opengraph-image.tsx        # OG image per algorithm (1200×630, node runtime)
├── components/
│   ├── chrome/                 # Header (sticky blur backdrop), Footer, SubscribeForm
│   ├── ui/                     # shadcn primitives: Button, Tooltip, Select
│   └── data/                   # AuditStrip, AlgorithmTable, Sparkline, CompareView, PresetComparisons
├── lib/
│   ├── data/
│   │   ├── types.ts            # JSON schema types (discriminated union on KEM vs sig)
│   │   ├── normalize.ts        # liboqs key → canonical name (single source of truth)
│   │   ├── load.ts             # Build-time filesystem loader
│   │   └── presets.ts          # Quick comparison recipes — real ratios from real data
│   ├── format.ts               # Unit shifters, byte formatters, CPU model cleanup, GitHub URLs
│   └── cn.ts                   # Tailwind class merge utility
└── scripts/
    ├── copy-data.mjs           # prebuild: copies ../benchmark/results/ → data/results/
    └── smoke-loader.ts         # Verify loader output against real JSON
```

## Design tokens

See `tailwind.config.ts`. Two registers share the color/typography tokens:

- **Marketing landing** (`/`) — Instrument Serif italic headings, animated
  radial gradient bg, reveal animations, editorial voice.
- **Dashboard** (`/q-shield/*`) — Geist Mono numbers, dense Bloomberg-style
  layout, no italics in chrome.

Both use:
- Green accent (`#4ade80`) for live signals, latest-run pills, primary CTAs
- Inter Tight body, Geist Mono numbers, Instrument Serif display headings
- Same surface and foreground ramps

## Smoke checklist before deploy

- `npm run type-check` — clean
- `npm run build` — clean (Vercel will fail at this point if anything is broken)
- `/q-shield/ml-dsa-65` — sparkline draws, dots open distinct commits
- `/q-shield/compare?a=ml-dsa-65&b=slh-dsa-shake-128s&op=sign` — chart renders, picker works
- `/` — marketing landing animates in, Subscribe button visible top-right
- Subscribe form — submit, check Beehiiv dashboard for the new subscriber

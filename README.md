<div align="center">
<img src="https://raw.githubusercontent.com/ByteWorthyLLC/coverage-changelog/main/.github/assets/coverage-changelog-hero.svg" alt="Coverage Changelog: free CMS coverage policy updates ranked for Monday" width="100%">

<br />

[![License](https://img.shields.io/badge/license-MIT-2563EB?style=for-the-badge&labelColor=0F172A)](./LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/ByteWorthyLLC/coverage-changelog/ci.yml?branch=main&style=for-the-badge&labelColor=0F172A&label=CI)](https://github.com/ByteWorthyLLC/coverage-changelog/actions/workflows/ci.yml)
[![Deploy](https://img.shields.io/github/actions/workflow/status/ByteWorthyLLC/coverage-changelog/deploy.yml?branch=main&style=for-the-badge&labelColor=0F172A&label=Pages)](https://github.com/ByteWorthyLLC/coverage-changelog/actions/workflows/deploy.yml)
[![Live demo](https://img.shields.io/badge/try_it-live_demo-2563EB?style=for-the-badge&labelColor=0F172A)](https://byteworthyllc.github.io/coverage-changelog/)

**CMS coverage changes, ranked for Monday morning.**

[**Try the live demo**](https://byteworthyllc.github.io/coverage-changelog/) · No login. No PHI. No paid API.

</div>

---

> Coverage Changelog turns the public CMS Coverage API into a free policy workbench. Ranked LCD/NCD updates, Monday briefs, operator review lanes, per-contractor feeds. Static files, GitHub Pages, MIT.

## What it does

Coverage policy changes are scattered across CMS reports, document pages, and revision endpoints. This repo collapses them into one obvious question:

> What changed, who might care, and what should be checked next?

The output is a static workbench with five views, a forwardable Monday brief, and per-contractor JSON / RSS / CSV feeds you can drop into a script, scheduler, or feed reader.

| Surface | Use it for |
|---|---|
| **Radar** | Scan signal mix and the highest-impact updates before opening filters. |
| **Changes** | Search and filter every revision. Deep-link any view via the URL. |
| **Queue** | Operator review lanes (coding, criteria, effective date, national, retirement). |
| **Contractor** | Slice the workbench by MAC footprint with direct subscribe URLs. |
| **Brief** | Forwardable Monday brief, copy-to-email button, RSS, mailto fallback. |
| **Feed** | Every static artifact, including per-contractor feeds. |

## For analysts and RCM teams

- Ranked CMS coverage updates with impact heuristics and source citations.
- Operator review lanes for the recurring real-world questions.
- Per-contractor subscribe URLs for monitoring just the MACs you bill.
- Forwardable Monday brief in markdown, HTML, and Gmail-friendly inline layout.
- Static feeds in JSON, NDJSON, CSV, and RSS so anything can integrate.
- Direct links to the official CMS document for every entry.

## Privacy and data sources

No patient data. No payer credentials. No private claims. No paid API keys.

The current build consumes only public CMS surfaces:

- `https://api.coverage.cms.gov/docs/`
- `/v1/reports/whats-new/local/`
- `/v1/reports/whats-new/national/`
- `/v1/metadata/update-period/`
- `/v1/data/lcd/revision-history`
- `/v1/data/lcd/reason-change`
- `/v1/data/lcd/synopsis-changes`
- `/v1/data/article/revision-history`

See [`SECURITY.md`](./SECURITY.md) for the full security and Business Associate boundaries.

## Outputs

Every build writes public artifacts:

| File | Purpose |
|---|---|
| `public/data/latest.json` | Full dataset with stats, highlights, brief sections, and entries |
| `public/data/feed.json` | Smaller flat feed for scripts and integrations |
| `public/data/high-impact.json` | High-impact updates only |
| `public/data/contractors.json` | All updates grouped by contractor |
| `public/data/contractors/<slug>.json` | Per-contractor full slice |
| `public/data/contractors/index.json` | Manifest of all contractor slugs |
| `public/data/queues.json` | Operator review lanes |
| `public/data/manifest.json` | Current release metadata and artifact map |
| `public/data/feed.csv` | Spreadsheet-friendly export |
| `public/data/feed.ndjson` | Line-delimited export for data pipelines |
| `public/feeds/<slug>.rss.xml` | Per-contractor RSS feed |
| `public/feeds/<slug>.csv` | Per-contractor CSV |
| `public/briefs/latest.md` | Forwardable markdown brief |
| `public/briefs/latest.html` | Gmail-friendly HTML brief |
| `public/briefs/<slug>.html` | Per-contractor email brief |
| `public/rss.xml` | Global RSS feed |
| `public/og-image.svg` | Social card with current dataset stats |
| `public/sitemap.xml` | Search indexing hint |

## Local development

```bash
npm install
npm run dev
```

Build the live dataset and production app:

```bash
npm run build
```

Run the full verification loop (test + lint + build):

```bash
npm run check
```

## Architecture

```text
CMS Coverage API
  -> build-time TypeScript ingestion
  -> version-scoped enrichment
  -> impact heuristics
  -> static artifacts (JSON / RSS / CSV / briefs)
  -> per-contractor slicing
  -> React workbench (URL-deep-linkable)
  -> GitHub Pages
```

Optional detail endpoint failures are skipped gracefully via `safeData()`. If the required CMS report fetch fails, the previous generated dataset is reused so the deploy never ships an empty wall.

UI system notes live in [`docs/UI_SYSTEM.md`](./docs/UI_SYSTEM.md). Architecture detail in [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

## Stack

| Layer | Technology |
|---|---|
| **Build pipeline** | TypeScript + `tsx` (CMS ingestion → static artifacts) |
| **App** | React 19 + Vite 8 |
| **Styling** | CSS custom properties (no framework) |
| **Icons** | Lucide |
| **Tests** | Vitest |
| **Hosting** | GitHub Pages (free) — fork-friendly to Cloudflare Pages, Netlify, Vercel |

## Verification

```bash
npm run check          # test + lint + build
npm run test           # vitest
npm run lint           # eslint
npm run build:data     # CMS ingestion only
```

## URL state

Every filter and selection lives in the URL. Examples:

- High-impact coding updates for Palmetto: `?view=changes&contractor=palmetto-gba&q=coding&impact=high`
- Open the contractor slice: `?view=contractor&contractor=cgs-administrators`
- Deep-link a specific entry: `?view=changes&entry=L12345`

Press `?` in the app for the full keyboard shortcut list.

## Deploy your own fork

[![Deploy to GitHub Pages](https://img.shields.io/badge/Deploy-GitHub%20Pages-181717?style=for-the-badge&logo=github)](https://docs.github.com/en/pages)
[![Deploy to Cloudflare Pages](https://img.shields.io/badge/Deploy-Cloudflare%20Pages-F38020?style=for-the-badge&logo=cloudflare)](https://deploy.workers.cloudflare.com/?url=https://github.com/ByteWorthyLLC/coverage-changelog)
[![Deploy to Netlify](https://img.shields.io/badge/Deploy-Netlify-00C7B7?style=for-the-badge&logo=netlify)](https://app.netlify.com/start/deploy?repository=https://github.com/ByteWorthyLLC/coverage-changelog)
[![Deploy to Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?style=for-the-badge&logo=vercel)](https://vercel.com/new/clone?repository-url=https://github.com/ByteWorthyLLC/coverage-changelog)

GitHub Pages deploys should set the base path:

```bash
PUBLIC_BASE_PATH=/coverage-changelog/
```

## Product principles

- Free for maintainers.
- Free for users.
- Public sources only.
- Source links over black-box summaries.
- Static hosting before infrastructure.
- Practical outputs before platform features.

## Roadmap

- specialty slices for common billing and RCM workflows
- change history across build windows
- stronger coverage-criteria detection
- additional free public policy sources after CMS surfaces are stable

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) and [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md). Security: [`SECURITY.md`](./SECURITY.md).

## License

MIT — see [`LICENSE`](./LICENSE).

---

Built by [ByteWorthy](https://byteworthy.io). Custom AI you own. Not SaaS you rent.

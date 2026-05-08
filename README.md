# Coverage Changelog

Coverage Changelog turns the CMS Coverage API into a public policy feed:

- a diff-first wall of local and national coverage updates
- a Monday morning brief you can forward
- a static JSON feed for builders

This project is intentionally narrow. It is not a full policy database and it is not a prior auth workflow product. It is a readable changelog for coverage rules.

## Why this exists

Official CMS coverage data is real, free, and current, but the default experience is still closer to report retrieval than change awareness. Coverage Changelog packages the signal that matters first:

- what changed
- where it changed
- why it might matter on Monday morning

## What it ships

- `wall`: a browsable UI ranked by likely operational impact
- `brief`: generated markdown and HTML summaries
- `feed`: static JSON outputs for downstream tools
- `engine`: CMS ingestion and impact heuristics based on revision-history and reason-change records

## Data sources

The current build uses only free CMS surfaces:

- CMS Coverage API docs: `https://api.coverage.cms.gov/docs/`
- local updates: `/v1/reports/whats-new/local/`
- national updates: `/v1/reports/whats-new/national/`
- update period metadata: `/v1/metadata/update-period/`
- LCD revision history and reason change endpoints
- article revision history endpoints

No patient data, payer credentials, or PHI are used.

## Local development

```bash
npm install
npm run dev
```

Build the live dataset and production app:

```bash
npm run build
```

Run the full verification loop:

```bash
npm run check
```

## Deployment

GitHub Pages builds must set:

```bash
PUBLIC_BASE_PATH=/coverage-changelog/
```

Local development and local previews default to `/`.

## Generated artifacts

Each build writes:

- `public/data/latest.json`
- `public/data/feed.json`
- `public/briefs/latest.md`
- `public/briefs/latest.html`

## Tech

- React 19
- TypeScript
- Vite
- Vitest
- CMS Coverage API

## Roadmap

- better impact heuristics for true coverage-criteria changes
- per-contractor views and export slices
- RSS and email-ready output
- additional public policy sources beyond CMS once the core wall is stable

# Coverage Changelog

Free CMS coverage policy monitoring for people who do not want another closed dashboard.

Coverage Changelog turns the CMS Coverage API into a public policy workbench:

- ranked CMS coverage updates
- Monday morning briefs
- JSON, CSV, NDJSON, and RSS feeds
- direct links back to official CMS source documents
- no login, no PHI, no paid API dependency

Live site: https://byteworthyllc.github.io/coverage-changelog/

## Why it matters

Coverage changes are easy to miss because the official data is spread across reports, document pages, and revision history endpoints. This repo makes one thing obvious:

> What changed, who might care, and what should be checked next?

This is not a payer portal, prior auth workflow, or policy database. It is a changelog layer over public CMS coverage updates.

## Current build

The current generated dataset tracks:

- CMS Coverage API version `1.6`
- local coverage updates
- national coverage updates
- LCD revision history
- LCD reason change data
- article revision history
- update period metadata

The app is static and can be hosted for free on GitHub Pages.

## Outputs

Every build writes public artifacts:

| File | Purpose |
|---|---|
| `public/data/latest.json` | Full dataset with stats, highlights, brief sections, and entries |
| `public/data/feed.json` | Smaller flat feed for scripts and integrations |
| `public/data/feed.csv` | Spreadsheet-friendly export |
| `public/data/feed.ndjson` | Line-delimited export for data pipelines |
| `public/briefs/latest.md` | Forwardable markdown brief |
| `public/briefs/latest.html` | Standalone HTML brief |
| `public/rss.xml` | RSS feed for subscribers |
| `public/sitemap.xml` | Search indexing hint |

## Data sources

The current version uses only free CMS surfaces:

- `https://api.coverage.cms.gov/docs/`
- `/v1/reports/whats-new/local/`
- `/v1/reports/whats-new/national/`
- `/v1/metadata/update-period/`
- `/v1/data/lcd/revision-history`
- `/v1/data/lcd/reason-change`
- `/v1/data/lcd/synopsis-changes`
- `/v1/data/article/revision-history`

No patient data, payer credentials, private claims, or protected health information are used.

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

## GitHub Pages

GitHub Pages deploys should set the base path:

```bash
PUBLIC_BASE_PATH=/coverage-changelog/
```

Local development and local previews default to `/`.

## Architecture

```text
CMS Coverage API
  -> build-time TypeScript ingestion
  -> version-scoped enrichment
  -> impact heuristics
  -> static artifacts
  -> React workbench
  -> GitHub Pages
```

The build is resilient to optional detail endpoint failures. If a single document enrichment fails, that enrichment is skipped and the rest of the dataset still ships. If the required CMS report fetch fails, the previous generated dataset is reused.

## Product principles

- Free for maintainers.
- Free for users.
- Public sources only.
- Source links over black-box summaries.
- Static hosting before infrastructure.
- Practical outputs before platform features.

## Roadmap

- contractor-specific pages and feeds
- specialty slices for common billing and RCM workflows
- change history across build windows
- stronger coverage-criteria detection
- email-ready brief templates
- additional free public policy sources after CMS is stable

## License

MIT

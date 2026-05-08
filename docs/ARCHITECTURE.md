# Architecture

Coverage Changelog is a static public workbench built from free CMS data.

## Pipeline

1. Fetch a short-lived CMS Coverage API license token.
2. Fetch update-period metadata, local updates, and national updates.
3. Enrich local LCD and article records with official revision-history and reason-change endpoints.
4. Normalize entries into a stable dataset.
5. Score likely operational impact using transparent heuristics.
6. Write static artifacts into `public/`.
7. Render the React workbench from `public/data/latest.json`.

## Failure behavior

CMS detail endpoints can occasionally timeout. Optional enrichment calls are allowed to fail per document. Required report calls still fail the live refresh, at which point the previous generated dataset is reused.

This keeps the public site available while avoiding silent fabrication.

## Cost model

The project is designed to remain free:

- free CMS source data
- static generated files
- GitHub Actions scheduled refresh
- GitHub Pages hosting
- no database
- no server
- no user accounts

## Boundaries

This repo does not handle PHI, patient records, payer credentials, prior auth submissions, or claims workflow automation. It only republishes and annotates public CMS coverage updates.

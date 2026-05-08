# Contributing

Coverage Changelog is intentionally small. Contributions should preserve the static, public-data, no-backend, no-PHI model.

## Local Setup

```bash
npm install
npm run dev
```

Before opening a pull request:

```bash
npm run check
```

## Hard Rules

- Do not add telemetry, analytics, Sentry, Plausible, PostHog, Segment, Mixpanel, or similar tooling.
- Do not add accounts, login, hosted identity, or a backend dependency.
- Do not add paid API keys, payer credentials, or private claims data.
- Do not add clinical interpretation, severity bands, diagnosis hints, or treatment guidance.
- Only consume documented public CMS surfaces (or, with discussion, other documented free public sources).

## Adding a New Public Source

1. Open a feature request first.
2. Describe the source, its license / terms, and the rate limits.
3. Land the ingestion behind a `safeData()` guard so a failure does not break the build.
4. Update `docs/ARCHITECTURE.md` and the README data-sources table.

## UI Changes

- Follow `docs/UI_SYSTEM.md` (semantic CSS custom properties, `--space-*`, `--radius-*`, `--accent`, etc.).
- Do not introduce new font families or color palettes outside the existing tokens.
- Keep every major action keyboard-reachable and respect `prefers-reduced-motion`.

## Commit Style

`type(scope): message` where type is one of `feat`, `fix`, `chore`, `refactor`, `test`, `docs`, `perf`.

Examples:

- `feat(contractor): add Novitas slice`
- `fix(brief): preserve table layout in Outlook`
- `chore(deps): bump vite to 8.0.12`

# Coverage Changelog UI System

Coverage Changelog uses the ByteWorthy public-product style: light mode, restrained surfaces, source-first copy, and no decorative dashboard effects.

## Tokens

The source of truth is `src/index.css`.

- Color: use semantic custom properties such as `--surface`, `--ink`, `--muted`, `--accent`, `--error`, `--warning`, and `--success`.
- Spacing: use the 4/8px rhythm tokens `--space-1` through `--space-6`.
- Radius: use `--radius-sm`, `--radius-md`, and `--radius-pill`.
- Motion: use `--duration-fast`, `--duration-base`, and `--ease-standard`.
- Touch: interactive controls should meet `--tap-target` minimum height.

## Rules

- Keep controls visible only where they affect the current view.
- Prefer solid surfaces and borders over translucent panels or decorative effects.
- Do not use emoji or novelty icons. Use the existing Lucide stroke icon language.
- Do not use gradients for product UI, except the existing page dot-grid background.
- Do not rely on color alone. Pair status colors with labels or document IDs.
- Respect `prefers-reduced-motion`.
- Keep every major action keyboard-reachable with visible focus states.

## Component Pattern

- Primary navigation is the tab list.
- Filters belong only to the Changes workbench.
- Queue lanes are grouped decision aids, not filtered table rows.
- Feed cards are artifact links and should remain direct, static, and script-friendly.

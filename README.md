# Mirror Engine

Mirror Engine is a premium Next.js workbench for permission-based website capture, preview generation, asset inspection, and export packaging.

## Current bootstrap scope

- Monorepo scaffold for the Mirror Engine app
- Premium landing page and workbench entry flow
- Deterministic API surface for capture, run, export, content, and cloned assets
- Shared security and contract packages
- Local filesystem clone storage under `apps/web/.generated/webgl-clones`

## Planned implementation order

1. Complete the app shell and product site
2. Finish deterministic capture and replay engine
3. Add queueing, progress streaming, and storage hardening
4. Add AI-assisted editing workflows

## Recommended hosting

This project is designed for a real Next.js server with server routes, Playwright, and persistent disk. GitHub Pages is not suitable for the full application because it is a static hosting platform.

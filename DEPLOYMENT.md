# Mirror Engine Deployment

## GitHub Pages

The repository includes a static GitHub Pages front door under `docs/`.

Expected project Pages URL:

`https://mohamedparvezmaharoof.github.io/HEY-HORIZON-WEB-BUILDER/`

To make that URL live:

1. Open the repository settings on GitHub.
2. Go to `Settings` -> `Pages`.
3. Set `Source` to `GitHub Actions`.
4. Save and allow the `Deploy GitHub Pages` workflow to run.

## Full Mirror Engine App

The full product is not compatible with GitHub Pages because it depends on:

- Next.js route handlers
- server-side request processing
- Playwright-based capture
- filesystem-backed clone output

Use the included `Dockerfile` to deploy the real app on a platform that can run a Node container.

Recommended target:

- a container-hosted Next.js server with persistent storage mounted for `apps/web/.generated/webgl-clones`

Typical container workflow:

1. Build the image:
   `docker build -t mirror-engine .`
2. Run the app:
   `docker run -p 3000:3000 mirror-engine`
3. Put a reverse proxy in front of it.
4. Mount persistent storage before enabling real capture output in production.

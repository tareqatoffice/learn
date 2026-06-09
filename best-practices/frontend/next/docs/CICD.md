# CI/CD & Git Workflow — Frontend (Next.js)

> Tooling: GitHub Actions · Docker · GitHub Container Registry (GHCR)

---

## Branch Strategy

```
main        production-ready. Protected — require PR + passing CI to merge.
develop     integration branch. All features merge here first.
feature/*   short-lived branches off develop.
fix/*       bug fixes off develop (hotfixes off main).
```

- Never commit directly to `main` or `develop`
- Delete feature branches after merge
- Hotfixes: branch off `main`, merge back to both `main` and `develop`

---

## Commit Convention

Follow **Conventional Commits**:

```
<type>(<scope>): <short description>
```

| Type | When |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Not a fix or feature |
| `test` | Tests only |
| `chore` | Dependencies, tooling |
| `ci` | CI/CD config |
| `docs` | Documentation |
| `perf` | Performance |

Examples:
```
feat(auth): add Auth.js v5 session provider
fix(notifications): reconnect EventSource on token refresh
chore(deps): upgrade next to 16.2.7
```

---

## PR Rules

- 1 approval required before merge
- All CI checks must pass
- PR title must follow Conventional Commits format
- Use **Squash and merge** for feature branches

**PR title linter (`.github/workflows/pr-title.yml`):**

```yaml
name: PR Title
on:
  pull_request:
    types: [opened, edited, synchronize]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: amannn/action-semantic-pull-request@v5
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## CI Pipeline

**`.github/workflows/ci.yml`**

```yaml
name: CI

on:
  pull_request:
    branches: [main, develop]

jobs:
  ci:
    name: Lint · Type-check · Test · Build
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type-check
        run: npm run typecheck

      - name: Unit & component tests
        run: npm run test -- --run
        env:
          NEXT_PUBLIC_TURNSTILE_SITE_KEY: 1x00000000000000000000AA

      - name: Build
        run: npm run build
        env:
          NEXT_PUBLIC_API_URL: http://localhost:3001
          NEXT_PUBLIC_POSTHOG_KEY: phc_placeholder
          NEXT_PUBLIC_POSTHOG_HOST: https://app.posthog.com
          NEXT_PUBLIC_TURNSTILE_SITE_KEY: 1x00000000000000000000AA
          AUTH_SECRET: ci-placeholder
          AUTH_URL: http://localhost:3000

  e2e:
    name: E2E (Playwright)
    runs-on: ubuntu-latest
    needs: ci

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Run E2E tests
        run: npm run test:e2e
        env:
          NEXT_PUBLIC_API_URL: ${{ secrets.STAGING_API_URL }}
          AUTH_SECRET: ci-placeholder
          AUTH_URL: http://localhost:3000

      - name: Upload report on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

**Required `package.json` scripts:**

```json
{
  "scripts": {
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest",
    "test:e2e": "playwright test",
    "build": "next build"
  }
}
```

---

## CD Pipeline

**`.github/workflows/deploy.yml`**

Runs on push to `main` only. `NEXT_PUBLIC_*` variables are baked into the image at build time — they are public values, safe to pass as build args.

```yaml
name: Deploy

on:
  push:
    branches: [main]

concurrency:
  group: deploy-frontend
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            ghcr.io/${{ github.repository }}:latest
            ghcr.io/${{ github.repository }}:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          build-args: |
            NEXT_PUBLIC_API_URL=${{ secrets.NEXT_PUBLIC_API_URL }}
            NEXT_PUBLIC_POSTHOG_KEY=${{ secrets.NEXT_PUBLIC_POSTHOG_KEY }}
            NEXT_PUBLIC_POSTHOG_HOST=${{ secrets.NEXT_PUBLIC_POSTHOG_HOST }}
            NEXT_PUBLIC_TURNSTILE_SITE_KEY=${{ secrets.NEXT_PUBLIC_TURNSTILE_SITE_KEY }}

      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.DEPLOY_HOST }}
          username: ${{ secrets.DEPLOY_USER }}
          key: ${{ secrets.DEPLOY_SSH_KEY }}
          script: |
            docker pull ghcr.io/${{ github.repository }}:latest
            docker stop app-frontend || true
            docker rm app-frontend || true
            docker run -d \
              --name app-frontend \
              --restart unless-stopped \
              --env-file /opt/app/.env \
              -p 3000:3000 \
              ghcr.io/${{ github.repository }}:latest
            docker image prune -f
```

---

## Dockerfile

Uses Next.js standalone output — smallest possible image.

```dockerfile
FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package*.json ./
RUN npm ci

FROM deps AS build
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_POSTHOG_KEY
ARG NEXT_PUBLIC_POSTHOG_HOST
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY

COPY . .
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup -S app && adduser -S app -G app
USER app
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
```

Enable standalone output in `next.config.ts`:

```ts
const nextConfig = { output: "standalone" };
```

```
# .dockerignore
node_modules
.next
.env*
*.md
.git
coverage
playwright-report
```

---

## Secrets

| Secret | Purpose |
|---|---|
| `DEPLOY_HOST` | Server IP / hostname |
| `DEPLOY_USER` | SSH username |
| `DEPLOY_SSH_KEY` | SSH private key |
| `NEXT_PUBLIC_API_URL` | Baked into image at build time |
| `NEXT_PUBLIC_POSTHOG_KEY` | Baked into image at build time |
| `NEXT_PUBLIC_POSTHOG_HOST` | Baked into image at build time |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Baked into image at build time |
| `STAGING_API_URL` | Used by E2E tests in CI |

Runtime secrets (`AUTH_SECRET`, `API_URL`) live in `/opt/app/.env` on the server — never in the image.

> `NEXT_PUBLIC_*` variables are embedded into the JavaScript bundle at build time. They are visible to anyone who views the page source. Never put secrets there.

---

## Dependabot

**`.github/dependabot.yml`:**

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
      day: monday
    open-pull-requests-limit: 5
    groups:
      next:
        patterns: ["next", "react", "react-dom", "@types/react*"]
      tanstack:
        patterns: ["@tanstack/*"]
      testing:
        patterns: ["vitest*", "@vitest/*", "playwright*", "@playwright/*", "msw*"]

  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: monthly
    open-pull-requests-limit: 3
```

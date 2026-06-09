# CI/CD & Git Workflow — Backend (NestJS)

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
feat(auth): add refresh token rotation
fix(mail): retry failed jobs with exponential backoff
chore(deps): upgrade @nestjs/core to v11.1.26
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

## Developer Experience — Formatting, Linting & Git Hooks

One shared toolchain so every developer's diffs are identically formatted, and broken code is blocked locally before it reaches CI.

### Runtime version pinning

Pin Node so local, CI, and production all run the same version. Commit a `.nvmrc` and declare `engines`; CI reads the file via `node-version-file: .nvmrc`.

```
# .nvmrc
20.18.0
```

```json
// package.json
{ "engines": { "node": ">=20" } }
```

### Prettier (formatting) + ESLint (correctness)

Prettier owns formatting; ESLint owns code-quality rules. Run `eslint-config-prettier` so the two never fight over style.

```bash
npm install -D prettier eslint-config-prettier
```

```json
// .prettierrc
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100
}
```

```
# .prettierignore
dist
coverage
node_modules
```

- Add `eslint-config-prettier` **last** in the ESLint config so it disables every stylistic rule Prettier already handles. Without it, ESLint and Prettier produce conflicting fixes.

### Husky + lint-staged (pre-commit)

Format and lint only the **staged** files — fast, and auto-fixes before the commit lands.

```bash
npm install -D husky lint-staged
npx husky init
```

```json
// package.json
{
  "lint-staged": {
    "*.ts": ["eslint --fix", "prettier --write"],
    "*.{json,md,yml,yaml}": ["prettier --write"]
  }
}
```

```bash
# .husky/pre-commit
npx lint-staged
```

> `prepare: "husky"` in `package.json` installs the hooks automatically on `npm install`, so every clone is set up with no manual step.

### commitlint (commit-msg)

Enforce Conventional Commits locally — the same rule the PR-title linter checks, but caught before the commit exists.

```bash
npm install -D @commitlint/cli @commitlint/config-conventional
```

```js
// commitlint.config.js
module.exports = { extends: ["@commitlint/config-conventional"] };
```

```bash
# .husky/commit-msg
npx --no -- commitlint --edit "$1"
```

### Pre-push — typecheck, test, build

The heavy gate. Nothing reaches the remote (and CI) unless it type-checks, all tests pass, and the project builds.

```bash
# .husky/pre-push
npm run typecheck
npm run test -- --coverage --passWithNoTests
npm run test:e2e -- --passWithNoTests
npm run build
```

### Enforcing "every change has a test"

A hook cannot prove a change is *meaningfully* tested, but coverage thresholds make undertested code fail any test run **that collects coverage**:

```js
// jest.config.js
module.exports = {
  coverageThreshold: {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 },
  },
};
```

The threshold only fires when coverage is collected, so the pre-push test step (and the CI unit-test step) must pass `--coverage` — `jest` without it ignores `coverageThreshold` entirely. Pair this with code review: a PR that adds logic without adding tests should not be approved.

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

    services:
      mongodb:
        image: mongo:7
        ports: ["27017:27017"]
      redis:
        image: redis:7-alpine
        ports: ["6379:6379"]

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm

      - run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type-check
        run: npm run typecheck

      - name: Unit tests
        run: npm run test -- --coverage --passWithNoTests
        env:
          NODE_ENV: test

      - name: E2E tests
        run: npm run test:e2e -- --passWithNoTests
        env:
          NODE_ENV: test
          MONGODB_URI: mongodb://localhost:27017/test
          REDIS_URL: redis://localhost:6379
          JWT_SECRET: ci-test-secret
          TURNSTILE_SECRET_KEY: 1x0000000000000000000000000000000AA
          POSTHOG_KEY: placeholder

      - name: Build
        run: npm run build
```

**Required `package.json` scripts:**

```json
{
  "scripts": {
    "lint": "eslint \"{src,test}/**/*.ts\"",
    "typecheck": "tsc --noEmit",
    "test": "jest",
    "test:e2e": "jest --config test/jest-e2e.json",
    "build": "nest build",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "prepare": "husky"
  }
}
```

---

## CD Pipeline

**`.github/workflows/deploy.yml`**

Runs on push to `main` only.

```yaml
name: Deploy

on:
  push:
    branches: [main]

concurrency:
  group: deploy-backend
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

      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.DEPLOY_HOST }}
          username: ${{ secrets.DEPLOY_USER }}
          key: ${{ secrets.DEPLOY_SSH_KEY }}
          script: |
            docker pull ghcr.io/${{ github.repository }}:latest
            docker stop app-backend || true
            docker rm app-backend || true
            docker run -d \
              --name app-backend \
              --restart unless-stopped \
              --env-file /opt/app/.env \
              -p 3001:3000 \
              ghcr.io/${{ github.repository }}:latest
            docker image prune -f
```

---

## Dockerfile

```dockerfile
FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package*.json ./
RUN npm ci --omit=dev && cp -r node_modules /prod_modules
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
USER app
COPY --from=build /app/dist ./dist
COPY --from=build /prod_modules ./node_modules
COPY package*.json ./
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

```
# .dockerignore
node_modules
dist
.env*
*.md
.git
coverage
```

---

## Secrets

| Secret | Purpose |
|---|---|
| `DEPLOY_HOST` | Server IP / hostname |
| `DEPLOY_USER` | SSH username |
| `DEPLOY_SSH_KEY` | SSH private key |

Runtime secrets (`MONGODB_URI`, `JWT_SECRET`, `REDIS_URL`, `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`, `R2_*`, `POSTHOG_KEY`) live in `/opt/app/.env` on the server — never baked into the Docker image.

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
      nestjs:
        patterns: ["@nestjs/*"]
      testing:
        patterns: ["jest*", "@types/jest", "supertest*"]

  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: monthly
    open-pull-requests-limit: 3
```

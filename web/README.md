# Learn

Next.js + MongoDB learning app (App Router, Tailwind, shadcn/ui, Auth.js, Vitest).

## Local dev

Requires Node 22+ and Docker.

```bash
docker compose up -d          # MongoDB 7 as a single-node replica set on :27017
cp .env.example .env.local    # then fill in AUTH_SECRET, Google OAuth keys, ADMIN_EMAILS
npm install
npm run dev                   # http://localhost:3000
```

## Tests

```bash
npx vitest run
```

Tests start their own in-memory MongoDB replica set (`mongodb-memory-server`),
so Docker is not needed. The first run downloads a `mongod` binary.

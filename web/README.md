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

## Adding content with Claude Code

Content lives in MongoDB and is edited in the app (Admin). For bulk work, the
`content` command line talks to the app's token API:

1. In the app, open **Admin → API tokens** and create a token (it is shown once).
2. Put it in `web/.env.local` (never commit it):
   ```bash
   LEARN_API_URL=http://localhost:3000   # or the deployed URL
   LEARN_API_TOKEN=learn_…
   ```
3. Use it:
   ```bash
   npm run content -- list
   npm run content -- pull book react-questions-ebook --out tmp       # canonical markdown with ids
   npm run content -- push tmp/react-questions-ebook.md --book react-questions-ebook            # preview only
   npm run content -- push tmp/react-questions-ebook.md --book react-questions-ebook --commit   # apply
   ```

- `push` previews by default and prints what would be created or changed; add
  `--commit` to apply. An import never deletes or archives anything.
- New items start as drafts; add `--publish` to publish them on commit.
- To create a new book, series or graph, add `--title "<title>"`.
- Note chapters: one `.md` file per chapter, first line an H1 title:
  `npm run content -- push 01-intro.md 02-net.md --series docker --commit`.
- Graphs: JSON in the same shape `pull graph` writes.
- Pulled files carry `<!-- learn:… id=… -->` markers, so edits update the same
  items instead of creating new ones. Keep the markers when editing.

The same import is available in the browser at **Admin → Import markdown**.

## Backup & restore

MongoDB Atlas free clusters have no automated backups, so take your own:

```bash
npm run backup -- backups/learn-2026-10-19.json   # everything: content, users, progress, history
npm run restore -- backups/learn-2026-10-19.json  # into an EMPTY database only; keeps original ids
```

`backups/` is gitignored because backups contain user data. **Admin → Export**
downloads content only (no users or progress); `restore` accepts that file too.

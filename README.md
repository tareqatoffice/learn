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

## AI quiz coach (OpenRouter)

Add an OpenRouter key (from <https://openrouter.ai/keys>; a free account works with
free models) in **Admin → AI coach**, or set `OPENROUTER_API_KEY`, to make the AI coach
available in quizzes. Learners can then type their
answer and **Check with AI** (Ctrl/Cmd+Enter) to get a verdict, a score, what they got
right and missed, and a suggested Got it / Review mark. After the answer is shown,
they can carry on a short **follow-up** chat with the coach about the card. Marking
stays with the learner, and the keyboard shortcuts work as before.

Manage it in **Admin → AI coach**:

- save, replace or remove the **OpenRouter key**. It is checked with OpenRouter first
  (a rejected key is not saved), stored encrypted with a key derived from
  `AUTH_SECRET`, never shown again (only its last 4 characters), and overrides
  `OPENROUTER_API_KEY`. Changing `AUTH_SECRET` makes a saved key unreadable; the page
  then asks for it again;
- turn the coach on or off;
- pick the **primary** and **backup** models from OpenRouter's live catalogue (free
  models are listed by default, paid ones on request, and any model id can be
  typed). The backup is tried whenever the primary fails, is rate-limited or gives
  an unreadable reply, which is common with free models;
- set the AI calls per learner per UTC day (checks and follow-ups both count, and
  failed calls are refunded; `0` means no limit);
- **Test models** sends a one-word prompt to each model and shows which ones answer.

Until an admin saves settings, `OPENROUTER_MODEL` (default `openai/gpt-4o-mini`) and
`OPENROUTER_DAILY_LIMIT` (default 100) apply. The full backup (`npm run backup`)
includes the settings with the key still encrypted.

Only the card's question, context and reference answer plus the learner's own text
are sent, and only for a visible question in the learner's own session. Follow-up
history is kept on the server (`aiconversations`, removed a week after the last
message), so the model only sees replies it actually wrote.

## Speaking practice (Cloudflare R2 + Workers AI)

Speaking practice records audio or video in the browser, stores it in a private
Cloudflare R2 bucket and transcribes it with Workers AI. Recording is off until the
R2 keys are set.

1. Create an R2 bucket (keep it private) and set `R2_BUCKET` and `R2_ACCOUNT_ID`.
2. Create an R2 API token with **Object Read & Write** on that bucket and set
   `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`.
3. Set the bucket **CORS** policy to allow the app origins (production and
   `http://localhost:3000`) with methods `PUT, GET, HEAD` and the header
   `Content-Type`. Uploads use `PUT`; playback and grabbing video frames in the
   browser need `GET`.
4. Create a Cloudflare API token with Workers AI access and set `CF_AI_TOKEN`
   (speech-to-text).
5. Optional: `STT_DAILY_LIMIT` caps transcriptions per learner per UTC day (default
   200, `0` means no limit).
6. Optional: for body-language feedback on video takes, pick an image-capable
   **vision model** in **Admin → AI coach**.

Storage cost: audio is about 360 KB per minute and video about 4-6 MB per minute.
The R2 free tier is 10 GB, then about $0.015 per GB-month. A heavy video user can fill
10 GB in about 3 months. There is no automatic retention in v1.

## IELTS Prep

IELTS Prep lives under `/ielts` and needs no new env: it reuses the Speaking Practice
R2 and Workers AI setup above and the shared AI coach settings.

Learner pages:

- `/ielts` shows the home page, or setup if there is no profile yet.
- `/ielts/profile` holds the target band and exam date.
- `/ielts/plan` shows the study plan.
- `/ielts/calculator` is the band calculator.
- `/ielts/history` shows past attempts and band charts.
- `/ielts/speaking` is the Speaking hub.
- `/ielts/speaking/[id]` runs an attempt.
- `/ielts/speaking/[id]/review` reviews it.

Admin sections: **Content → IELTS Speaking** (`/admin/ielts/speaking`: Part 1 topics,
Part 2 cue cards, Part 3 discussions) and **Settings → IELTS settings**
(`/admin/ielts/settings`).

Shared limits: there is one daily transcription cap across Speaking Practice and IELTS
(`STT_DAILY_LIMIT`, counted in `SpeakingUsage`) and one shared AI limit.

Storage: IELTS recordings go to R2 under `ielts/<userId>/<attemptId>/<part>.<ext>`
(and `<part>.audio.<ext>` for the audio track of a video take). The bucket CORS must
allow the app origins, exactly as Speaking Practice already needs.

Deleting: **Delete my IELTS data** on `/ielts/profile` removes the learner's IELTS
profile, plans, band entries, study logs and attempts, and deletes the attempts' R2
objects under `ielts/<userId>/`. Speaking Practice takes are not touched. If R2 can't
delete the objects, nothing is removed and the page asks the learner to try again.

Notes:

- The examiner voice uses the browser `speechSynthesis`. Without it the app falls back
  to on-screen text only. Use headphones (or read the on-screen questions) so the
  examiner's words stay out of your transcript.
- Pronunciation is estimated from the transcript only.

**Before deploying this branch:** production has real Speaking Practice data. Run
`npm run backup -- <file>.json` against production first. The `SpeakingTake` stored
shape is unchanged.

Known gaps: the phone test (iPhone Safari / Android Chrome) has not been run; the
throwaway spike page lives in commit `009daca` if needed; in-app navigation during a
mock test does not warn (`beforeunload` only covers reload and close).

## Deploy (Vercel + MongoDB Atlas)

1. **Database.** Create a MongoDB Atlas cluster (the free tier works), a database
   user, and allow Vercel's egress (or `0.0.0.0/0`) in Network Access. Copy the
   `mongodb+srv://…/learn` connection string.
2. **Google sign-in.** In Google Cloud Console create an OAuth client (Web
   application) with these authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://<your-vercel-domain>/api/auth/callback/google`
3. **Vercel.** Import the repo with **Root Directory** `web`, and set these
   environment variables: `MONGODB_URI`, `AUTH_SECRET` (`npx auth secret`),
   `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ADMIN_EMAILS` (your Google email),
   and optionally `OPENROUTER_API_KEY` for the AI quiz coach (or add the key later
   in Admin → AI coach).
   Leave `AUTH_DEV_LOGIN` unset. Outside Vercel, also set `AUTH_TRUST_HOST=true`
   or `AUTH_URL`.
4. **Content.** The legacy files were imported into the local database and removed.
   With the local app running, download **Admin → Export** (content only: no users,
   progress or history), point `MONGODB_URI` in `web/.env.local` at the empty Atlas
   database and run `npm run restore -- <export-file>.json`. Don't restore a full
   backup such as `backups/after-import.json` here: it also carries local dev-login
   users and test progress. If the local database is gone, rebuild it from the commit
   before `chore: remove legacy content files` (`npm run import:legacy`).
5. `vercel deploy` (or push to the connected branch).

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

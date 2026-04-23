# Deploy ALF CRM

End-to-end guide to deploy this app to a public URL your team can use. Time: ~15 minutes. Cost: $0 on free tiers.

Stack: **Neon** (Postgres) + **Vercel** (Next.js hosting) + **GitHub** (repo).

## 1. Create a Neon Postgres database

1. Sign up at <https://neon.tech> (free tier is fine).
2. Create a new project, e.g. `alf-crm`. Accept the default region.
3. On the project dashboard, copy the **connection string** — it looks like:
   ```
   postgresql://username:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
4. Keep this tab open. You'll paste this value into Vercel and into your local `.env`.

## 2. Initialize the schema and load data (run once, from your laptop)

```bash
cd /Users/jimlucas/Downloads/alf-crm

# Point the local app at your Neon database.
# Edit .env and replace DATABASE_URL with the Neon connection string from step 1.
# Also set TEAM_PASSWORD and SESSION_SECRET to real values:
#   openssl rand -hex 32   # use output as SESSION_SECRET
#   (pick a strong shared team password)

npx prisma db push       # creates tables in Neon
npm run import           # loads /Users/jimlucas/Downloads/alfcontacts/*.csv into Neon
```

You should see `created XYZ contacts`. Your Neon DB is now populated.

## 3. Put the code on GitHub

```bash
cd /Users/jimlucas/Downloads/alf-crm
git init
git add .
git commit -m "Initial ALF CRM"
```

Then on GitHub:
1. Create a new **private** repo (name it `alf-crm`).
2. Follow the "push an existing repo" instructions GitHub shows you — roughly:
   ```bash
   git remote add origin https://github.com/<you>/alf-crm.git
   git branch -M main
   git push -u origin main
   ```

> ⚠️ `.gitignore` excludes `.env` so your secrets are safe. Double-check with `git status` before pushing.

## 4. Deploy on Vercel

1. Sign up at <https://vercel.com> using your GitHub account.
2. Click **Add New… → Project**, pick your `alf-crm` repo, click **Import**.
3. On the configuration screen, open **Environment Variables** and add three:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | (the Neon connection string from step 1) |
   | `TEAM_PASSWORD` | (your chosen shared password) |
   | `SESSION_SECRET` | (32+ random chars, e.g., output of `openssl rand -hex 32`) |

4. Click **Deploy**. First deploy takes ~2 minutes.
5. When it finishes, Vercel gives you a URL like `https://alf-crm-<you>.vercel.app`. That's what you share with the team.

## 5. Share with your team

Send teammates:
- The Vercel URL
- The `TEAM_PASSWORD` (via a secure channel — 1Password, not Slack plaintext)
- Instructions: "Sign in with your work email + the team password."

Each teammate's email is stored on any call they log, so you can filter/report by rep later.

## 6. Future updates

Any time you want to push a change:

```bash
# from /Users/jimlucas/Downloads/alf-crm
git add .
git commit -m "Describe the change"
git push
```

Vercel auto-deploys every push to `main`. If you change `prisma/schema.prisma`, also run `npx prisma db push` from your laptop against the Neon URL once before (or right after) deploying, so the DB schema matches.

## 7. Loading more contacts later

Your local machine stays connected to the same Neon DB via `.env`. So anytime:

```bash
# drop new CSVs into /Users/jimlucas/Downloads/alfcontacts/
npm run import
```

…loads them into production directly. Duplicates are skipped by (company, city, state).

Alternatively, upload one CSV at a time via `/import` on the live site.

## Troubleshooting

- **"Environment variable not found: DATABASE_URL"** during `prisma db push` — your `.env` is missing or the file isn't in the project root. Check `cat .env | grep DATABASE_URL`.
- **"SSL connection required"** — Neon requires `?sslmode=require` at the end of the URL. The connection string Neon gives you has this by default.
- **Vercel build fails with "Prisma generate failed"** — ensure `DATABASE_URL` is set in Vercel env vars before the first deploy; click **Redeploy** after adding it.
- **Login works locally but not on Vercel** — make sure `SESSION_SECRET` and `TEAM_PASSWORD` are set in Vercel's env vars for the **Production** environment (not just Preview).

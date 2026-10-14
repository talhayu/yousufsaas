# YusrFlow console

Working recreation of the SaaS compliance app from the product demo (not the marketing site). Gemini is replaced by Groq. Data lives in **Supabase (Postgres)**. Frontend + API deploy together on **Vercel**.

## 1. Create a free Supabase project

1. Go to [supabase.com](https://supabase.com) and create a project.
2. Open **Project Settings → Database → Connection string → URI**.
3. Prefer the **Transaction pooler** URI (port `6543`) for Vercel.
4. Copy it into `.env` as `DATABASE_URL`.

Tables are created automatically on first API start (`ensureSchema`). You can also paste `server/src/schema.sql` into the Supabase SQL editor if you want.

## 2. Local setup

```bash
npm install
cp .env.example .env
# Set DATABASE_URL, JWT_SECRET, and optionally GROQ_API_KEY
npm run dev
```

- App: http://localhost:5173  
- API: http://localhost:4000  

On first boot the server seeds the same demo estate (76 apps, scores, issues, 3 users).

Pilot login:

- Email: `admin@yusrflow.com`
- Password: `Yusrflow2026!`

Also: `compliance@yusrflow.com` and `security@yusrflow.com` (same password).

Reset / re-seed Supabase:

```bash
npm run reset
```

## 3. Deploy both frontend and backend on Vercel

1. Push this repo to GitHub.
2. Import the project in Vercel.
3. Add environment variables:
   - `DATABASE_URL` — Supabase pooler URI
   - `JWT_SECRET` — any long random string
   - `GROQ_API_KEY` — optional; AI features need it
   - `GROQ_MODEL` — optional, default `openai/gpt-oss-20b`
4. Deploy.

Vercel serves the React app and routes `/api/*` to the Express handler in `api/index.ts`. The first request creates tables and seeds demo data if the database is empty.

## What is real vs demo

- **Real:** login, dashboard, apps, compliance, reports, settings, Groq AI (with key), Supabase persistence
- **Demo / simulated:** Microsoft 365 Connect/Discover (no Graph API), forgot-password email, sample seed estate

## Layout

```
client/     React + TypeScript + Vite + Tailwind
server/     Express + TypeScript + Supabase Postgres
api/        Vercel serverless entry for the Express app
server/src/schema.sql   optional manual SQL for Supabase
```

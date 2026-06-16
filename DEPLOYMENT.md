# Deployment Guide — ECE Copilot

The stack is a **FastAPI** backend + **React/Vite** frontend, with **Supabase**
(auth + Postgres) and **Google Gemini** for the AI copilot.

---

## 1. Prerequisites

- A **Supabase** project (URL, anon key, service-role key).
- A **Google Gemini** API key. The free tier is ~20 requests/day per model; for
  production, enable **billing** on the Google Cloud project to remove the cap.
- Docker (for the container path) **or** a static host + a container host.

## 2. Database schema

Run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) in
the Supabase **SQL editor** (or `supabase db push`). It creates the `designs` and
`sessions` tables with **row-level security** (each user sees only their own rows).
The app degrades gracefully if the tables are missing, but persistence won't work.

## 3. Environment variables

**Backend** (`backend/.env`, see `backend/.env.example`):

| Var | Production value |
|-----|------------------|
| `APP_ENV` | `production` — **disables the demo auth bypass** and drops localhost CORS |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | from your Supabase project |
| `FRONTEND_URL` | the public site URL (used for CORS) |
| `ALLOWED_ORIGINS` | optional extra CORS origins, comma-separated |
| `GOOGLE_API_KEY` | Gemini key |
| `GEMINI_MODELS` | optional model fallback order |

**Frontend** (build-time, see `frontend/.env.example`): `VITE_BACKEND_URL`,
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Vite **inlines** these at build
time, so they must be set when you build (not at runtime).

> ⚠️ Real `.env` files are gitignored — never commit secrets. Only `.env.example`
> files are tracked.

## 4. Deploy

### Option A — Docker Compose (single host)

```bash
cp .env.example .env                 # fill VITE_* (frontend build args)
cp backend/.env.example backend/.env # fill backend secrets, set APP_ENV=production
docker compose up --build -d
```

Frontend → `http://<host>:5173`, backend → `http://<host>:8000`. Put a TLS
reverse proxy (Caddy/Nginx/Traefik) in front for HTTPS.

### Option B — Managed platforms (recommended)

- **Frontend** → Vercel / Netlify / Cloudflare Pages.
  Build: `npm run build`, output dir: `dist`. Set the `VITE_*` env vars in the
  dashboard. The repo also ships `frontend/Dockerfile` (nginx) if you prefer a
  container.
- **Backend** → Render / Railway / Fly.io using `backend/Dockerfile`. Platforms
  inject `$PORT`, which the Dockerfile honors. Set all backend env vars.

## 5. Production checklist

- [ ] `APP_ENV=production` on the backend (verified: `demo-token` is then rejected).
- [ ] `ALLOW_DEMO_AUTH` unset/false in production.
- [ ] `FRONTEND_URL` / `ALLOWED_ORIGINS` set to the real site (CORS).
- [ ] DB migration applied; RLS enabled.
- [ ] Real Supabase + Gemini keys set; **secrets not committed**.
- [ ] HTTPS terminated by a proxy/platform in front of both services.
- [ ] Frontend built with the production `VITE_BACKEND_URL` (the public API URL).

## 6. Operational notes

- **Single backend worker.** Session/SSE state is in-process, so a run and its
  SSE stream must hit the same process. Horizontal scaling needs a shared store
  (e.g. Redis) first — the Dockerfile runs one worker by design.
- **Gemini quota.** If chat answers stop, the daily free quota is likely spent;
  the chat falls back to deterministic circuit facts. Enable billing or wait for
  the daily reset. The model-fallback chain spreads load across models.
- **Bundle size.** Plotly is large (~1.4 MB gzipped) but lazy-loaded — it only
  downloads when an output plot is first shown.

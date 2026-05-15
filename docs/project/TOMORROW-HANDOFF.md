# Tomorrow — Alert Dashboard Deployment

**Start here**: `econofi-agents-core/docs/project/NOW-NEXT-LATER.md` → NOW section → Alert Dashboard Full Stack Deployment

## What's done

- Frontend Sprint Items 1–3 complete — 42/42 tests GREEN
- UI polish complete (fonts, screen real estate, alert count pill)
- NNL updated

## First task tomorrow

Deploy the full stack. Already spec'd in NNL. Three services:

1. **Frontend** — `econofi-agents-ui` → Vercel (preferred for Next.js)
   - Needs env var: `API_URL=<deployed backend URL>`

2. **Backend** — `econofi-agents-core` → Railway or Render
   - All env vars from `.env`
   - Cloud Supabase URL replaces local

3. **Database** — cloud Supabase project already exists: `ljhqickbsxxwmpsrvnpl`
   - Run migrations 001–005 (005 requires `docker cp` + `psql` pattern — see NNL)
   - Enable RLS on `public.bank_customer_mapping`
   - Seed 4 demo alerts

## Known issue to resolve first

Backend must be restarted locally before demoing audit trail.
`GET /v1/alerts/:id/events` returns 404 on the running server — the route exists in code but
the server process predates it. `PORT=3001 npm run dev` in `econofi-agents-core`.

## One open question

`econofi-agents-ui` is not yet in a GitHub repo. That needs to happen before Vercel deployment.

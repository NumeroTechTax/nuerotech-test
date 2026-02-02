# Deploy Tax Reports Portal on Render

## URLs (after deploy)

- **Frontend:** https://tax-reports-web.onrender.com  
- **Backend:** https://tax-reports-api.onrender.com  

---

## Get the site live on Render (quick steps)

1. **Push this repo to GitHub**  
   If it’s not there yet: create a repo on GitHub, then push your local code (e.g. `git remote add origin ...`, `git push -u origin main`).

2. **Create a PostgreSQL database on Render**  
   - [Render Dashboard](https://dashboard.render.com) → **New** → **PostgreSQL**.  
   - Create the DB, then copy the **Internal Database URL** (or External if you prefer).

3. **Deploy with the Blueprint**  
   - **New** → **Blueprint**.  
   - Connect GitHub and select this repo.  
   - Render will create **tax-reports-web** and **tax-reports-api** from `render.yaml`.

4. **Set required env vars for the API**  
   - Open **tax-reports-api** → **Environment**.  
   - Set **DATABASE_URL** = the PostgreSQL URL from step 2.  
   - Set **JWT_SECRET** = any long random string (e.g. generate one at https://generate-secret.vercel.app/32).  
   - Save; Render will redeploy the API.

5. **Run the database migration (if needed)**  
   The Blueprint has `preDeployCommand: npx prisma migrate deploy` for the API, so migrations run on deploy.  
   If the API fails on first deploy, check the API logs; you may need to run **Manual Deploy** again after DATABASE_URL is set.

6. **Seed the questionnaire (optional)**  
   - In Render, open **tax-reports-api** → **Shell** (or run locally with `DATABASE_URL` set):  
     `npx prisma db seed`  
   - This creates a published 2024 questionnaire so users can start a report.

7. **Open the site**  
   - Frontend: https://tax-reports-web.onrender.com (and /login).  
   - Backend health: https://tax-reports-api.onrender.com/health.

---

## Option A: Use the Blueprint (recommended)

The repo includes a **render.yaml** Blueprint so both services use the correct Root Directory, build/start commands, and env vars.

### First-time setup

1. Push the repo to GitHub (e.g. `NumeroTechTax/tax-reports-portal`).
2. In [Render Dashboard](https://dashboard.render.com): **New** → **Blueprint**.
3. Select your GitHub account and the repo **tax-reports-portal**.
4. Render will read `render.yaml` and show:
   - **tax-reports-web** (frontend, rootDir: `client`)
   - **tax-reports-api** (backend, rootDir: `backend`)
5. If you already have services with these names, Render will **apply** the Blueprint config to them (rootDir, buildCommand, startCommand, envVars).
6. Click **Apply** and wait for both deploys.

### Updating existing services to match the Blueprint

If you created **tax-reports-web** and **tax-reports-api** manually before:

1. In Render: **Blueprint** → connect this repo (or open the existing Blueprint).
2. **Sync** or **Apply** so Render updates:
   - **Root Directory:** `client` for web, `backend` for api
   - **Build Command:** `npm install && npm run build` (web), `npm install && npm run build` (api)
   - **Start Command:** `npm start` (both)
   - **Environment variables** from `render.yaml` (NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_API_URL, FRONTEND_URL)
3. Save; Render will redeploy with the new config.

## Option B: Manual service setup

If you prefer not to use the Blueprint:

### Frontend (tax-reports-web)

- **Root Directory:** `client`
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start`
- **Environment:**
  - `NEXT_PUBLIC_APP_URL` = `https://tax-reports-web.onrender.com`
  - `NEXT_PUBLIC_API_URL` = `https://tax-reports-api.onrender.com`

### Backend (tax-reports-api)

- **Root Directory:** `backend`
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start`
- **Environment:**
  - `FRONTEND_URL` = `https://tax-reports-web.onrender.com`

## Backend env vars (tax-reports-api)

- `DATABASE_URL` – PostgreSQL connection string (required).
- `JWT_SECRET` – secret for JWT signing (required).
- `FRONTEND_URL` – frontend origin for CORS.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` – for Google OAuth (optional).
- `UPLOAD_DIR` – directory for uploaded files (default: `./uploads`).
- `REMINDER_SECRET` – secret for cron reminder endpoint; set and pass as `x-reminder-secret` when calling.
- `REMINDER_STALE_HOURS` – hours after which to consider a case "stale" for reminders (default: 24).
- `SENTRY_DSN` – optional; if set, add `@sentry/node` and init Sentry in `backend/src/index.ts` for error tracking.

## Reminder cron (תזכורת "לא סיים")

Call the internal reminder endpoint on a schedule (e.g. Render Cron Job or external cron):

- **URL:** `POST https://tax-reports-api.onrender.com/internal/reminder-check`
- **Header:** `x-reminder-secret: <REMINDER_SECRET>`
- **Body (optional):** `{ "secret": "<REMINDER_SECRET>" }`

This finds cases not yet submitted and updated more than `REMINDER_STALE_HOURS` ago; in MVP it logs them (later: send email via Resend/SendGrid). For production you can add Redis + BullMQ and run a worker that calls this or implements the same logic.

## After deploy

- Frontend: open https://tax-reports-web.onrender.com (and /login).
- Backend health: https://tax-reports-api.onrender.com/health  
- The client is already configured (in `client/lib/config.ts`) to use these URLs by default.

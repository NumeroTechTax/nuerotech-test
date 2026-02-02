# Implementation Summary – What Was Built

Use this as a map to see what was added or changed.

---

## Backend (`backend/`)

| File | Purpose |
|------|--------|
| `src/index.ts` | Mounts all routes (auth, cases, admin/questionnaire, admin/cases, employee/cases, internal/reminders). |
| `src/routes/cases.ts` | Client case API: list/create case, questionnaire next/answer, **payment/complete**, **requirements**, **upload**, **download**, **signatures**, **spouse**, **advance-step**, **finish**. |
| `src/routes/admin/questionnaire.ts` | Admin questionnaire: versions CRUD, clone, publish, questions CRUD, **options PUT**, **rules POST/DELETE**, **preview**. |
| `src/routes/admin/cases.ts` | Admin case control: list cases, get case, **events (audit)**, **PATCH** (workflow/status/price), **reset** (questionnaire/documents/all). |
| `src/routes/employee/cases.ts` | Employee: list cases (filters), get case detail, **PATCH** (status, assignedTo). |
| `src/routes/internal/reminders.ts` | **Reminder cron:** POST `/internal/reminder-check` (x-reminder-secret). |
| `src/upload.ts` | Helpers for upload dir and saving files (local storage). |
| `src/middleware/requireRole.ts` | **requireEmployeeOrAdmin** added. |
| `prisma/schema.prisma` | Full schema (User, Case, QuestionnaireVersion, Question, Option, DisplayRule, Answer, Requirement, Upload, Signature, Event). |
| `.env.example` | **UPLOAD_DIR**, **REMINDER_SECRET**, **REMINDER_STALE_HOURS**, **SENTRY_DSN**. |
| `.gitignore` | **uploads/** added. |

---

## Client (`client/`)

| File | Purpose |
|------|--------|
| `app/dashboard/page.tsx` | **userRole** from `/auth/me`, links to **עובדים** (employee/admin), **ניהול** (admin). |
| `app/cases/[id]/page.tsx` | **Full workflow UI:** Payment, Personal details + uploads, POA, Spouse, Documents, Review/Finish, Submitted. |
| `app/cases/[id]/questionnaire/page.tsx` | One-question-at-a-time questionnaire (unchanged logic). |
| `app/admin/layout.tsx` | Admin route guard (role === admin), nav. |
| `app/admin/page.tsx` | Links to questionnaire builder and **דוחות** (case control). |
| `app/admin/questionnaire/page.tsx` | List versions, create version. |
| `app/admin/questionnaire/[versionId]/page.tsx` | Questions list, add/edit question (options + display rules), **Preview** modal, Publish, Clone. |
| `app/admin/cases/page.tsx` | List all cases (filters: tax year, status). |
| `app/admin/cases/[id]/page.tsx` | **Case control:** workflow/status/price form, **reset** buttons, **Audit** (events list). |
| `app/employee/layout.tsx` | Employee route guard (employee or admin), nav. |
| `app/employee/page.tsx` | **Kanban** – columns by status (New, InReview, …). |
| `app/employee/cases/[id]/page.tsx` | **Case view:** status/assignedTo edit, tabs **Answers**, **Documents**, **Signatures**, **Activity**. |
| `lib/config.ts` | API URL helpers. |
| `lib/auth.ts` | Token get/set/clear, authHeaders. |

---

## Root

| File | Purpose |
|------|--------|
| `render.yaml` | Blueprint for tax-reports-web and tax-reports-api. |
| `DEPLOY.md` | Deploy instructions + **env vars**, **reminder cron**, **Sentry** note. |

---

## Quick navigation in Cursor

- **Backend routes:** `backend/src/routes/` (cases, admin/, employee/, internal/).
- **Client pages:** `client/app/` (dashboard, cases, admin/, employee/).
- **Plan (unchanged):** `.cursor/plans/` – reference only; the plan file was not edited.

To see **diffs** for a file: right-click → **Open Changes** or use the Source Control view.

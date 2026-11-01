# Taskline

Taskline is a small task tracker for product teams: projects, a kanban board,
assignees, due dates, comments, and an activity feed. It has a Hono API on SQLite
and a React web app.

## Features

- **Board** — projects with To do / In progress / Done columns, drag and drop,
  priorities, assignees, and due dates.
- **Comments and activity** — every change shows up in the activity feed.
- **Billing** — Stripe Checkout and the customer portal for Taskline Pro, with signed
  webhooks that keep each project's plan in sync.
- **Assistant** — OpenAI summaries of a task and its comments, and subtask
  suggestions.
- **Email** — Resend sends assignment emails, invites, and a weekly digest.
- **Invites** — signed, single-use invite links.
- **OpenAPI** — the API describes itself at `/api/v1/openapi.json`.

## Quick start

```bash
cp .env.example .env
bun install
bun run dev
```

| App | URL |
|---|---|
| Web | http://localhost:4100 |
| API | http://localhost:4101 |

The database seeds itself with two demo projects the first time the API starts.
Billing, the assistant, and email are optional: without their keys, those endpoints
return `503` (email is skipped) and everything else works.

## Commands

| Command | What it does |
|---|---|
| `bun run dev` | API + web together |
| `bun run dev:api` | API only, on `:4101` |
| `bun run dev:web` | Web only, on `:4100` |
| `bun run db:reset` | Reset and reseed the SQLite database |
| `bun run validate:schema` | Parse `schema/taskline.dbml` |
| `bun run test` | API tests (`bun:test`) |
| `bun run typecheck` | Typecheck both workspaces |
| `bun run smoke` | Exercise the running API end to end |
| `bun run check` | Schema + tests + typecheck |
| `bun run build` | Production build of the web app |

## Layout

```
.
├── apps/
│   ├── api/                  Hono + bun:sqlite
│   │   ├── src/app.ts        projects, tasks, comments, activity
│   │   ├── src/vendors.ts    Stripe, OpenAI, and Resend clients
│   │   ├── src/billing.ts    Checkout + customer portal
│   │   ├── src/webhooks.ts   Stripe webhook handling
│   │   ├── src/assistant.ts  task summaries + subtask suggestions
│   │   ├── src/mailer.ts     assignment, invite, and digest emails
│   │   ├── src/invites.ts    signed invite links
│   │   └── tests/            API tests
│   └── web/                  React + Vite
├── schema/taskline.dbml      the data model
├── scripts/                  schema validation + API smoke test
├── Dockerfile                API image
└── .github/workflows/        CI
```

## Data model

`schema/taskline.dbml` describes seven tables: `projects`, `members`, `tasks`,
`comments`, `activity`, `subscriptions`, and `invites`. The SQLite schema in
`apps/api/src/schema.sql` mirrors it.

## Environment

Everything has a local default; `.env` is optional.

| Variable | Default | Used by |
|---|---|---|
| `PORT` | `4101` | API |
| `HOST` | `127.0.0.1` | API |
| `DATABASE_PATH` | `data/taskline.db` | API |
| `CORS_ORIGIN` | `http://localhost:4100` | API |
| `APP_URL` | `http://localhost:4100` | Links in emails and Stripe redirects |
| `INVITE_SECRET` | dev-only value | Signing invite links; set it in production |
| `STRIPE_SECRET_KEY` / `STRIPE_PRICE_ID` | — | Billing |
| `STRIPE_WEBHOOK_SECRET` | — | `POST /api/v1/webhooks/stripe` |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | — / `gpt-4o-mini` | Assistant |
| `RESEND_API_KEY` / `EMAIL_FROM` | — | Email |
| `VITE_API_URL` | `http://localhost:4101` | Web |

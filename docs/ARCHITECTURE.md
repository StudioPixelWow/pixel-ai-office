# Architecture
```
Browser (Next.js 16 / React 19, RTL)  ──►  Next.js route handlers (Vercel)  ──►  Supabase Postgres (schema `office`)
       ▲  SSE /api/stream (Last-Event-ID resume)          │                         ▲
       │                                                   ├── /api/worker/tick  (Vercel Cron, every minute) ──► Claude / OpenAI Images / Kling / WhatsApp Cloud / WordPress
       │                                                   └── /api/webhooks/*   (WhatsApp signed, Kling hint)
Local Runner (Tal's Mac, outbound only) ── office_runner_* RPC ──► FFmpeg render, chunked upload
```
**Source of truth:** Postgres. All business tables live in schema `office`, which is **not exposed** through PostgREST. The browser and the server
reach it only via `SECURITY DEFINER` functions in `public` (`office_*`) that derive scope from `auth.uid()`, check the permission matrix
(`office.action_permissions`), enforce allowed state transitions and write `office.audit_events`. The server never trusts an org/client id from the browser.

**Queue/engine (one mechanism, chosen instead of Redis/BullMQ):** `office.task_runs` is the queue. `office_worker_claim` leases tasks with
`FOR UPDATE SKIP LOCKED`, `lease_token`, `lease_until`, attempts and backoff; expired leases are recovered; a stale lease can never complete a task.
Dependencies, readiness checks (capability ↔ verified connection ↔ client scope), budget reservations and kill switches are evaluated at claim time.
Reason: the deployment target is Vercel (no long-lived processes); a DB-native queue keeps decisions durable — losing a cron tick never loses an
approval, a decision or a quota charge. Long provider work (Kling) is *deferred* (re-queued without consuming an attempt) and polled by saved task id.

**Workers:** `/api/worker/tick` (cron, ≤240s per run) — automations → outbox → claim/execute loop. Workers authenticate with a secret whose
SHA-256 lives in `office.system_secrets`; they hold **no** DB service key. Worker functions can prepare drafts but have **no approval path**.

**Workflows:** `office.workflow_templates` (sales_proposal, monthly_plan_client, content_item, video_production, campaign_review, bakoma_article,
rtm_scan, free_request, agent_trial, single_agent). Every request (manual/event/schedule) goes through `office.route_request` — same rules for all three.

**Storage:** binary outputs in `office.blobs` (bytea, chunked for video) linked to artifact versions, served through `/api/files/[id]` with a per-request
scope check. Avatars are the only public blobs. (Migration path to S3/Supabase Storage documented in DECISIONS.)

**AI:** Claude Messages API (Opus 5.5 for complex work, model ids verified via GET /v1/models — never silently substituted); structured outputs
validated with zod before saving; OpenAI Images API as an explicit separate connection; graphics composed as SVG with live Hebrew text + original logo layer.

**Code layout:** `src/app` (UI + routes) · `src/engine` (executor, tick, adapters, schemas, compose) · `src/agents/roster.ts` (40 specs) ·
`supabase/migrations` (exact applied SQL) · `local-runner/` · `docs/`.

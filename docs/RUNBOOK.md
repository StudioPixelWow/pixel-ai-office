# Runbook
## Local dev
```
npm ci
cp .env.example .env.local   # fill NEXT_PUBLIC_*; server secrets only if needed
npm run dev
```
## Deploy (Vercel project `pixel-ai-office`, team office-7152's projects)
- Env (Production, **Sensitive**): WORKER_SECRET, CRON_SECRET, ANTHROPIC_API_KEY, OPENAI_API_KEY, KLING_*, WHATSAPP_*.
- Public env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SITE_URL.
- Cron: vercel.json → `/api/worker/tick` every minute (Authorization: Bearer CRON_SECRET).
- Rotate WORKER_SECRET: set new env, then `update office.system_secrets set sha256 = encode(digest('<new>','sha256'),'hex') where name='worker'`.
## DNS (uPress, zone s-pixel.co.il)
- `manage` → CNAME `cname.vercel-dns.com` (replace the A 88.218.117.132). Do not touch MX or other records.
- Rollback: delete CNAME, restore A 88.218.117.132 (the empty WP install is still on uPress).
## Migrations
`supabase/migrations/*` are the exact applied statements. Apply new ones via Supabase SQL/MCP; workers tolerate additive changes.
## Acceptance
`select office.run_acceptance_tests();` → read JSON in the error message. Always rolls back.
## Local Runner (FFmpeg)
1. /connections → "צור קוד pairing" (15 min).  2. `npm run runner -- --pair CODE`  3. `npm run runner`. Revoke from /connections.
## Stuck work
/tasks?f=stuck → "נסה שוב (מבוקר)" is refused while a provider job is unresolved — check provider status first. Kill switch: /usage.
## Backup / restore
Supabase daily backups (frame-ai project). Restore test: restore to a branch/new project, run acceptance suite, verify counts. After any restore,
do **not** re-dispatch outbox rows: `outbox_dispatches` in `claimed/uncertain` must be checked against the provider first.
## Quick guide
- לקוח: /clients → הוספת לקוח → תיק → שירותים/אנשי קשר/נכסים.
- ליד: /leads → ליד חדש → פתיחת הצעה → קביעת מחיר → ״הפעל תהליך הצעה״ → אישור גרסה → תיעוד התקשרות.
- סוכן: /agents/new. קריאייטיב: /studio → בקשת קריאייטיב. אישור הודעה: /approvals → פתח לבדיקה → ״אשר ושלח״.

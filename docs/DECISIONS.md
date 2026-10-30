# Decisions
1. **Standalone app on Vercel + Supabase, not WordPress.** manage.s-pixel.co.il held a fresh, empty WordPress install (uPress, "Hello world" only, 30.10.2026). It is left untouched on uPress; only the `manage` DNS record points to Vercel. Rollback = restore A record 88.218.117.132.
2. **Reuse the existing frame-ai Supabase project** in an isolated, non-exposed schema `office` — no new paid project. Note: frame-ai has 24 legacy tables with RLS disabled in `public` (pre-existing exposure via its anon key) — flagged to Tal, not changed.
3. **DB-native queue instead of Redis/BullMQ** (see ARCHITECTURE). One orchestration mechanism only.
4. **Workers hold no DB service key**; they authenticate with a hashed secret and can only call narrow state-transition functions.
5. **Blob storage in Postgres (bytea, chunked)** because the worker has no storage service key. Fine for images/short videos; move to Supabase Storage/S3 when a scoped key is provided.
6. **Agent names are Greek deities/muses** to match the marble-statue brand series; portraits generated in ChatGPT (browser) as 5 sheets of 8, cropped per agent.
7. **Approvals:** Owner = tal.pixeld@gmail.com only. office@s-pixel.co.il = admin (no message approval). Delegation only if Tal asks explicitly.
8. **VAT/terms are never guessed** — proposals show "לא הוגדר" until Tal saves an approved terms template.
9. **Rollover / partial-month policy** undefined → flagged for decision on every new period, no invented policy.
10. **PDF:** the protected print view renders the exact approved version; browser "Save as PDF" produces the Hebrew RTL PDF (no server PDF engine yet).

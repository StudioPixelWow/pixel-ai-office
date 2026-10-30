# Acceptance evidence
Run: `select office.run_acceptance_tests();` on project frame-ai (uaruggdabeyiuppcvbbi), 30.10.2026 — **21/21 pass**, fully rolled back (verified: real worker secret hash intact, 0 rows left).

| # | Requirement (ch. 28/40) | Test | Result |
|---|---|---|---|
| 1 | Server rejects WhatsApp send without valid approval | T1 (no verified sender), T2 (sandbox only to approved test numbers) | ✅ |
| 2 | Popup close/timeout/scheduler ≠ send | T9 scheduled reminder only becomes pending | ✅ |
| 3 | Double click / duplicate worker → no double action | T5 (one dispatch), T13 (stale lease) | ✅ |
| 4 | Changing text/recipient/attachment voids old approval | T4 (hash), T5 (edit creates new version), T8 (expired/requeued) | ✅ |
| 5 | New client reply stops stale follow-up | T6 | ✅ |
| 6 | Provider maybe-received → uncertain, no blind retry | T7 | ✅ |
| 7 | Locked price kept; media separate | T10 | ✅ |
| 8 | Client A data not visible to client B user | T11 | ✅ |
| 9 | Restart/recovery without paid duplicates | T13 + lease recovery + provider_jobs idempotency (code) | ✅ DB / ⏳ live provider |
| 17 | One office-wide command → per-client work, relevant only | T17 | ✅ |
| 18 | Event/schedule = same rules; double fire ≠ double work | T12b, T16 | ✅ |
| 40.1 | Opening period twice ≠ double gantt/quota | T12a, T12c, T12d | ✅ |
| 40.2 | Copy fix marks dependents | T14 | ✅ |
| 40.4 | Cancel stops new steps, keeps outputs | T15 | ✅ |
| 40.8 | Non-owner / agent cannot create WhatsApp approval | T3, T18 | ✅ |
| 13 | Asia/Jerusalem incl. DST | T16 (next run 01.11 08:30 local = 06:30Z after DST end) | ✅ |
| 11,12,14,16,19 | Files open, live states, RTL/mobile, HTTPS+login, closed dashboard | Need the live deployment + keys — see RUNBOOK checklist | ⏳ |

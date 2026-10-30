# Acceptance tests
The full suite lives in the DB as `office.run_acceptance_tests()` (migration 0009). It runs inside one transaction and always ends with
`RAISE EXCEPTION 'ACCEPTANCE_RESULTS …'`, so every row it creates is rolled back.

Run (Supabase SQL editor / MCP): `select office.run_acceptance_tests();` → the error message contains a JSON array of `{t, pass}`.
Last run: 30.10.2026 — 21/21 pass (see docs/ACCEPTANCE.md).

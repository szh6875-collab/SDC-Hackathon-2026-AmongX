# Orbyte Hub Integration & Verification Status

## What was integrated in this working build

- The new React/TypeScript app and Express server remain the only application/backend baseline.
- Main navigation is organized into collapsible groups: Overview; Work (Invoices, Approvals); Compliance (Eligibility & Checks, Policies, Policy Monitor); Insights (Reports, Audit Trail); Manage (Access & Roles, Company Settings). Resources/About and Pitch Deck remain secondary destinations.
- Added Reports and Audit views backed by existing company-scoped API methods, CSV/Excel activity exports, and audit-chain verification.
- Added an Access & Roles information page without fake employee invitation/deletion controls, because the current API does not expose user CRUD.
- Kept the old pitch deck as presentation-only content at `public/legacy/slides.html`; it is not a source of invoice or compliance business data.
- Reused the old frontend's warm cream/graph-paper canvas, forest-green primary actions, gold accents, Plus Jakarta Sans, Space Mono, and Young Serif as the visual design influence. The redesigned navigation/page hierarchy is not copied from the legacy frontend.
- The WhatsApp-like invoice text intake remains a simulator using the existing app's invoice text upload API. It is not a live Meta WhatsApp Business API integration.

## Supabase and n8n pieces

- Database setup: `database/policy-monitor-schema.sql` and `database/policy-monitor-rpc.sql`.
- Server-only persistence/monitoring: `src/services/policyStore.ts` reads/writes the source registry and rule packages, downloads official guideline PDFs from the official listing page, extracts text, hashes content with SHA-256, archives live snapshots via `record_policy_monitor_snapshot`, and stages candidate packages when a previously saved live baseline changes.
- Status and review endpoints: `GET /api/policy-monitoring/supabase-status` and `GET /api/policy-monitoring/supabase-snapshot`.
- Scheduled entry point: `POST /api/automation/policy-monitor/run`. It requires `ORBYTE_AUTOMATION_SECRET`, a Supabase key, both official LHDN sources in the Supabase registry, and real live source retrieval. It rejects local/demo registry fallback and cannot activate policy rules.
- Importable n8n flow: `automation/n8n/policy-monitor.json`. It contains a 12-hour Schedule Trigger and a manual test trigger. The workflow is inactive and uses a placeholder app URL by design; it is not deployed to any user's n8n account.

## Required setup before calling the integrations operational

1. Create/verify the Supabase project and inspect the SQL seed rows before applying to a live database.
2. Run the schema SQL and RPC SQL in the order listed in the docs.
3. Set server-side `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and a random `ORBYTE_AUTOMATION_SECRET` of at least 32 characters in the hosting secret manager or ignored `.env.local`.
4. Import the n8n JSON; replace `YOUR_ORBYTE_HOST`; create an HTTP Header Auth credential with header `x-orbyte-automation-secret` and the same automation secret; select the credential.
5. Run the n8n Manual Test Run. Confirm both source fetches succeed and rows appear in `policy_monitor_documents` and `policy_monitor_history`. Then activate n8n and verify a scheduled execution. Only then set `N8N_POLICY_MONITOR_SCHEDULE_ENABLED=true` in the app's environment.
6. Do not expose the Supabase secret key to frontend JavaScript. For the new `sb_secret_*` key format, the code sends the key in `apikey` only (not as a JWT Bearer token); legacy `service_role` JWT keys remain supported.

## Honest verification record for this delivery

- Passed: JSON parsing for `package.json` and `automation/n8n/policy-monitor.json`.
- Passed: TypeScript/TSX transpile-level syntax scan for all 41 `src/**/*.ts(x)` files plus `server.ts` and `extract.ts` (0 syntax diagnostics). This is not a full type check.
- Not verified here: `npm run lint`, `npm run build`, and runtime API tests. Dependency installation timed out and offline install returned `ENOTCACHED` because packages were not available in the npm cache. Consequently there is no claim that a production build or end-to-end tests passed in this environment.
- Not verifiable without user credentials/access: live Supabase SQL execution, n8n import/activation, external source fetch from the deployed server, and scheduled execution in the user's n8n workspace.

## Known capability boundaries

- `POST /api/blueprint/activate` is intentionally retired with HTTP 410; do not show its button as a working action.
- The current API does not expose employee invitation/account CRUD; Access & Roles is informational and role-aware, not a team administration CRUD tool.
- This project does not perform authoritative SSM validation or production MyInvois e-Invoice submission based solely on this integration. The WhatsApp intake is simulated.
- SHA-256 changes indicate content changed, not that the law changed. Demo fixture crawls never update a live hash baseline or create candidate packages. Supabase-configured rule calculations fail closed if no active package with a passed safety report can be loaded.

# Orbyte Hub — Combined Project

This combined build uses the richer React/TypeScript Orbyte Hub UI and e-Invoice processing flow, while incorporating compatible features from the lightweight Orbyte Hub prototype. The lightweight prototype is not shipped as a second separate UI; its useful logic and test data are integrated into this main app to avoid maintaining two disconnected data stores and navigation systems.

## What has been combined and refined

- **Owner-facing React UI:** a collapsible navigation built around `Overview`, `Work` (Invoices, Approvals), `Compliance` (Eligibility & Checks, Policies, Policy Monitor), `Insights` (Reports, Audit Trail), and `Manage` (Access & Roles, Company Settings). Resources/About and Pitch Deck remain secondary links outside the main operational navigation.
- **Multi-company scope:** invoice lists, invoice exports, source-file downloads, audit history, and audit exports require the selected company and enforce the invoice's company ownership on the server.
- **Richer document intake:** PDF/XML/JSON/text/image and QR-related invoice intake, deterministic parsing, configured Gemini support, and optional RunPod OpenAI-compatible endpoint support.
- **Human review safety:** AI extraction results are cross-checked against deterministic text extraction; material discrepancies lower confidence and require review rather than silently accepting a confident result.
- **Versioned policy fixtures:** the `policies/LHDN-v4.8.json` and `policies/LHDN-v4.9.json` files from the companion prototype are read by the local policy-diff preview. The preview is explicitly a **local demo fixture comparison**, not proof of a current official LHDN policy change.
- **Reader benchmark:** a 50-case synthetic text benchmark is included at `benchmark/messages.json`, runnable with `npm run benchmark:reader` (deterministic mode) or `BENCHMARK_USE_AI=true npm run benchmark:reader` (configured AI provider).
- **Activity history durability:** the demo audit ledger is saved locally to `data/audit-ledger.json` between server restarts and includes company scope in its hash-chained content. This is local persistence, not an external immutable/WORM audit store.
- **Export repair:** activity CSV and XLSM exports use authenticated API downloads, strict company filtering, response-type checks, and file validation before the UI reports success.

## Run locally

Prerequisites: Node.js compatible with this project's Vite/TypeScript versions. The repository retains `bun.lock` for Bun users; it is not an npm lockfile. If deploying with npm, run `npm install` with registry access to generate a fresh `package-lock.json` before reproducible deployment.

```bash
npm install
cp .env.example .env.local
# Edit .env.local and add provider keys only if you use those integrations.
npm run dev
```

For a production build, install dependencies first, then run `npm run lint` and `npm run build`. The `vite/client` types come from the declared `vite` dependency, and the TypeScript config also loads Node types for the backend. If `npm run lint` reports `TS2688` for `vite/client`, the dependency installation is missing or incomplete; restore registry access and rerun `npm install` rather than removing the Vite type reference. The test commands are listed below; all integration tests require installed dependencies and start a local server.

Optional RunPod configuration is available via `AI_PROVIDER=runpod`, `RUNPOD_API_KEY`, `RUNPOD_ENDPOINT_ID`, and optionally `RUNPOD_MODEL`. Keep actual API keys in `.env.local` or your hosting secret manager; never commit them.

## Optional live policy-monitoring status (n8n + Supabase)

This build can display the last successfully saved General and Specific e-Invoice Guideline snapshots from Supabase in **Policy Source Monitoring & Local Rule Reference**. The site reads status metadata through an authenticated server endpoint; the Supabase Secret Key stays server-side and is never exposed to the browser. The FAQ crawler downloads the actual official FAQ PDFs linked from the index so the Q&A can retrieve the underlying question-and-answer text, not just link labels.

1. In Supabase SQL Editor, run `database/policy-monitor-schema.sql` first, then `database/policy-monitor-rpc.sql`. The schema seeds the source registry and an inactive, clearly marked demo draft—not a live-verified active rules package. A first successful live PDF retrieval establishes the SHA-256 baseline and stages a candidate for human review; it never automatically activates rules. Review existing table state before applying to a non-demo/production project because `ON CONFLICT DO NOTHING` does not overwrite existing records.
2. Set `SUPABASE_URL` and a server-only `SUPABASE_SECRET_KEY` in the server environment. Never prefix this key with `VITE_` or expose it to browser code.
3. Set a random secret of at least 32 characters as `ORBYTE_AUTOMATION_SECRET` on the Orbyte server.
4. Import `automation/n8n/policy-monitor.json` into your n8n workspace, replace `YOUR_ORBYTE_HOST` in the HTTP node, and create an **HTTP Header Auth** credential with header name `x-orbyte-automation-secret` and a value matching `ORBYTE_AUTOMATION_SECRET`. Assign it to the HTTP Request node.
5. After deploying this version, run **Manual Test Run** once so the FAQ source is rebuilt from all linked official FAQ PDFs. Confirm the two LHDN guideline PDFs and the official FAQ index-linked PDFs return live retrieval success and snapshots appear in Supabase. Then activate the workflow. Only after a successful scheduled execution, set `N8N_POLICY_MONITOR_SCHEDULE_ENABLED=true` on the app server. This flag is informational; it does not enable n8n.
6. See `docs/SUPABASE_POLICY_MONITORING.md`, `docs/SUPABASE_POLICY_MONITORING_zh-CN.md`, `automation/n8n/README.md`, and `INTEGRATION_STATUS.md` for full setup, troubleshooting, and exact verification boundaries.

For the FAQ source, the monitor fetches the official index and downloads its linked HASiL FAQ PDFs; each retrieved FAQ passage keeps the individual PDF URL for citation. The Policy Source Monitoring cards now link directly to LHDN’s current e-Invoice Guidelines list, the official e-Invoice FAQ index, and the Ministry of Finance’s 2027 Budget speech. The MyInvois SDK is treated as a technical reference, not a primary policy source. Page changes and PDF hash changes are review signals only; they do not establish legal effect or activate rules.

## Validation and tests

```bash
npm run lint
npm run build
npm test
npm run test:auth
npm run test:stabilization
npm run test:compliance
npm run benchmark:reader
```

The export integration test checks authenticated downloads, company separation, CSV UTF-8/escaping, XLSM OpenXML structure, and source/export API responses. Install dependencies before running project tests.

## Important demo / regulatory boundaries

- Included demo accounts are for local development only. Replace demo authentication and credentials before public or production deployment.
- Local policy JSON files are prototype fixtures. They are not a live source feed and must not be treated as legal/tax advice or the current official law. The existing monitoring UI distinguishes local/demo data from verified official-source activity.
- The workbook exporters produce Excel OpenXML workbooks with the macro-enabled `.xlsm` package content type and seven e-Invoice sheets / two activity sheets. No VBA macros are embedded because the workbook does not require macro behavior.
- The local audit chain detects record changes and survives ordinary process restarts, but is not protected against an administrator rewriting both the ledger and hash chain. Use external immutable storage/checkpoints for production audit evidence.
- Company profile data and bundled test profiles are local demo data; this build does not connect to SSM or MyInvois for authoritative validation/submission.


### Supabase policy text review

After the n8n workflow has saved snapshots, authorized SME owners/tax advisors can use **Load saved source text** on the General/Specific LHDN document cards to inspect the latest text stored in Supabase and compare the saved previous hash/version. This is a human-review interface. The text is not automatically treated as legal rules or applied to compliance calculations; only separately verified and implemented rule changes may do that.
## Evidence-grounded Policy Q&A

The General Policy Q&A endpoint is `POST /api/policy-qa/ask`. It retrieves only saved text from official HTTPS `.gov.my` sources in Supabase (`policy_monitor_history` linked to `policy_sources` / `policy_monitor_documents`; the scheduled n8n job stores the two LHDN guideline PDFs and extracts the official FAQ index-linked PDFs into a searchable FAQ corpus) and rule content from policy packages that are `approved`, have `approved_at`, have a source SHA-256, and have `safety_verification.passed = true`. Draft, rejected, inactive demo fixtures, and arbitrary non-government URLs are not treated as approved evidence.

The answer is generated server-side by the configured Gemini/OpenAI provider chain from the top retrieved excerpts only. Each factual answer line must cite one or more retrieved evidence IDs; citation validation fails closed when citations are missing or refer to unknown IDs. If Supabase evidence is missing, relevance is too low, or all configured AI providers fail, the assistant explicitly reports that it cannot verify the answer and never falls back to the old keyword-based hardcoded answers.

Configure server-side `GEMINI_API_KEYS` and/or `OPENAI_API_KEYS` as comma- or newline-separated lists; legacy singular `GEMINI_API_KEY` and `OPENAI_API_KEY` remain supported. `AI_PROVIDER_ORDER=gemini,openai` defines the default order, while `POLICY_QA_PROVIDER_ORDER` can override the policy Q&A order. The chain applies to Policy Q&A, policy summarization/draft extraction, and invoice text/image/PDF AI parsing. Key rotation is triggered for quota/rate-limit/auth/network/transient server errors. Never set API keys in frontend variables or commit real keys. Gemini quotas are typically project-level, so multiple keys from the same Google API project do not guarantee extra quota; cross-provider OpenAI fallback is the important backup when Gemini project quota is exhausted.

Each displayed citation includes the official source link, version (when recorded), excerpt number, saved excerpt, snapshot capture time, latest successful retrieval / last check, monitoring state, and SHA-256 when available. A changed hash, first baseline, old snapshot, pending review, or inactive approved package is labelled for review and cannot be presented as fully current evidence. The Q&A does not make a snapshot hash change equivalent to a legal change.

Required server configuration: `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (or the existing server-side `SUPABASE_KEY` alias), plus at least one Gemini or OpenAI API key. On existing Supabase projects, run `database/policy-qa-read-access.sql` once to grant server-side read access to saved snapshots without exposing extracted text to public roles. Model and provider order settings are documented in `.env.example`. Never expose Supabase or AI secret keys to browser code or `VITE_*` variables.

Run retrieval/citation checks with `npm run test:policy-qa` and provider/key-rotation checks with `npm run test:ai-fallback`. See `docs/AI_PROVIDER_FALLBACK_zh-CN.md` for server environment variables, fallback behavior, provider quota caveats, and secret-handling rules.


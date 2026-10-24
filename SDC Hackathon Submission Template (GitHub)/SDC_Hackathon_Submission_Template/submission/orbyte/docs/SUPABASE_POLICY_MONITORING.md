# Orbyte Hub: Supabase Dynamic Policy Registry & Rule Safety Verification

## Architecture & Design Overview

This system replaces static, hardcoded policy URLs with a **dynamic policy source registry** managed in Supabase, paired with an automated crawler, structured rule parser, and a **7-point automated safety verification suite**.

### Core Safety Principle
**Raw PDF and web text are NEVER directly applied to tax calculations without parsing and verification.**
Automated crawlers stage parsed updates into candidate rule packages (`status: 'pending_validation'`). Candidate packages are staged for review and never become active automatically. Structural safety verification and human approval do not, by themselves, establish that a tax-rate announcement has legal effect.

---

## 1. Database Schema (`database/policy-monitor-schema.sql`)

1. **`public.policy_sources`**: Dynamic registry of all monitored sources (URLs, category, format: PDF/HTML/JSON, check interval, current and previous SHA-256 digests).
2. **`public.policy_approved_packages`**: Stores verified and approved rule packages with their corporate tax tiers, e-invoice exemption thresholds (RM 3,000,000 baseline), and minimum wage baselines.
3. **`public.policy_monitor_history`**: Audit archive of extracted text and hashes.

---

## 2. Automated 7-Point Rule Safety Verification Suite

Every crawled document that produces candidate rules must pass the automated safety verification engine before it can be authorized:

1. **`CHK-BRACKET-MONOTONIC`**: Tax bracket ceilings must be strictly monotonic (`b[i].upTo > b[i-1].upTo`) and properly open-ended.
2. **`CHK-RATE-BOUNDS`**: Marginal tax rates must be within statutory limits (0.00 to 0.45). Negative rates and percentages above 45% are rejected.
3. **`CHK-EXEMPTION-SANITY`**: e-Invoice exemption threshold is verified against statutory bounds (RM 500,000 to RM 50,000,000; benchmark: RM 3,000,000).
4. **`CHK-WAGE-BOUNDS`**: Minimum wage scale verified against National Minimum Wage Order standards (RM 1,200 to RM 5,000; benchmark: RM 1,700).
5. **`CHK-SST-RATE`**: Sales and Service Tax rates checked against Royal Customs standards (0% to 25%; benchmark: 8%).
6. **`CHK-SOURCE-PROVENANCE`**: Checksum non-empty (64-char hex) and verified against authorized government domains (`hasil.gov.my`, `mof.gov.my`, `customs.gov.my`).
7. **`CHK-RULE-CONSISTENCY`**: Ensures rules contain unique, non-conflicting preconditions and discrete identifiers.

---

## 3. Server Endpoints

### Dynamic Policy Sources
- `GET /api/policy-sources`: Lists all registered sources from Supabase (or local fallback).
- `POST /api/policy-sources`: Adds a new source to the registry.
- `PUT /api/policy-sources/:id`: Updates an existing source.
- `DELETE /api/policy-sources/:id`: Removes a source from the registry.
- `POST /api/policy-sources/:id/crawl`: Triggers crawl, PDF text extraction, SHA-256 calculation, and candidate staging if changed.
- `POST /api/policy-sources/crawl-all`: Batch crawls all active sources.

### Approved Rule Packages & Safety
- `GET /api/policy-packages`: Lists candidate, validated, and approved rule packages.
- `GET /api/policy-packages/active`: Returns the approved policy package that passes the active-schedule guard; tax comparison rates remain centrally configured.
- `POST /api/policy-packages/:id/verify`: Re-runs the 7-point safety verification suite.
- `POST /api/policy-packages/:id/approve`: Authorizes a candidate package for verified policy evaluation, provided its tax schedule matches the centrally configured reference schedule.
- `POST /api/policy-packages/:id/reject`: Rejects a candidate package.
- `GET /api/policy-packages/:id/diff`: Returns side-by-side comparison of candidate brackets vs active brackets.

---

## 4. Corporate Tax Calculation Guardrail

Corporate-tax estimates use the central schedules in `src/constants/policyConstants.ts`:

- **Reference schedule:** 15% / 17% / 24%, based on the published LHDN reference for YA 2023–2025. Always confirm the relevant assessment year and eligibility.
- **Budget 2027 announcement scenario:** 14% / 16% / 24%. Displayed only for comparison; not treated as active law by default.

The financial impact endpoint calculates baseline tax, announcement-scenario tax, and their difference from these same schedules. It does not pull tax rates from an arbitrary active package. Candidate tax brackets that differ from the central reference schedule are blocked from activation by the application. A future legal rate change requires verifying the formal legal instrument, year of assessment and effective date, then updating the central schedule through a reviewed release. This intentionally prevents a scraped Budget speech from silently changing tax results.


## 5. Scheduled n8n workflow

An importable workflow is now provided at `automation/n8n/policy-monitor.json`. It calls `POST /api/automation/policy-monitor/run` every 12 hours and includes a manual test trigger. Import it, replace `YOUR_ORBYTE_HOST`, create an HTTP Header Auth credential (`x-orbyte-automation-secret` = the exact server-side `ORBYTE_AUTOMATION_SECRET`), then select that credential in the HTTP Request node. Run a manual execution first and verify both LHDN guideline PDFs plus the official FAQ HTML source and the Supabase snapshot tables before activating the workflow.

The endpoint requires `SUPABASE_URL`, a server-only `SUPABASE_SECRET_KEY`, and an `ORBYTE_AUTOMATION_SECRET` of at least 32 characters. It prohibits fixture fallback, reports failures as non-2xx responses, and never activates candidate packages. Only set `N8N_POLICY_MONITOR_SCHEDULE_ENABLED=true` after a successful scheduled n8n run; that variable changes the app's displayed configuration indicator and does not operate n8n itself.

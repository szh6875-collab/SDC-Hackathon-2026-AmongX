# Orbyte Hub — Modification Notes

## Changes made

- Corrected the e-Invoice exemption screening reference from RM1,000,000 to RM3,000,000, based on LHDN's published implementation timeline. The UI still treats this as a screening reference and requires business-specific conditions to be checked; it does not automatically certify exemption.
- Updated Home, Policies & Benefits, Business Profile guidance, translations, and bundled policy fixtures to use consistent RM3M wording.
- Added durable local persistence for official-source monitoring metadata, content hashes, normalized source-page snapshots, and pending human review state. Manual document import does not overwrite live-retrieval timestamps.
- Kept demo simulations separate from live monitoring and real pending policy reviews; a simulated update cannot activate operating rules.
- Added readable old/new excerpt context when a monitored source page changes, while explicitly stating that a page change is not proof of a statutory change. Failed/unverifiable/unresolved source states now keep the compliance status marked stale; API responses explicitly distinguish a simulated check from a live sync.
- Changed the stale-policy banner action to “View Source Status” because it navigates to policy status rather than initiating a sync itself.
- Removed quick profile presets from the business-profile editor so a user cannot accidentally overwrite a real business name/owner with a demo profile. The policy screening UI no longer labels missing turnover as below the threshold, and the Gemini extraction test fixture is explicitly labelled synthetic rather than a real gazetted notice.
- Clarified that profile changes are logged, rather than making a broad “cryptographic integrity” claim in the profile editor.
- Added an explicit note that business profiles in this preview may contain sample data.
- Retired the ineffective Blueprint activation endpoint from its former success behaviour (it returns 410) and updated the associated role-flow test accordingly.
- Corrected the test command so it no longer references a missing lifecycle test file.
- Added a regression assertion for the RM3M threshold reference.

## Validation performed

- Parsed 35 TypeScript/TSX files (src, server.ts, extract.ts, vite.config.ts) with the installed TypeScript parser: no syntax errors detected.
- Ran `node --check` over the `.mjs` test scripts: passed.
- Validated `package.json` and both bundled policy JSON files: passed.
- Type-checked `src/constants/policyConstants.ts` independently: passed.

## Not verified in this environment

- `npm install` timed out, and the project dependencies are not installed in this environment. Therefore a full Vite build, full TypeScript application type-check, and HTTP integration tests could not be run here.
- Live access to LHDN/MOF may still be restricted by the deployment environment. The application now reports that limitation rather than claiming a successful update. Source-page comparison is a change signal only; legal changes still require review of the actual official document and authorised approval.
- No active compliance rules were changed automatically from a webpage hash or an imported document fingerprint.


## Follow-up update — current official policy sources (23 Oct 2026)

- Policy Source Monitoring now points to three specific source pages for policy/clarification content rather than treating a developer SDK home or a generic budget homepage as policy publications:
  1. LHDN e-Invoice Guidelines index, whose current official listing shows General v4.8 (30 Aug 2026) and Specific v4.9 (7 Sep 2026).
  2. LHDN e-Invoice official FAQ index (general and industry-specific clarifications).
  3. MOF's official Budget 2027 speech page dated 9 Oct 2026. The UI and source descriptions explicitly say that a budget announcement does not prove a measure is enacted or in force.
- MyInvois SDK remains a technical reference only; it is no longer presented as a primary policy source card.
- Added a visible policy-source caveat in the source-monitoring section: a page-hash change signals review; it does not establish a legal change. The PDF snapshot pipeline still tracks General/Specific e-Invoice PDF text hashes through Supabase.
- Updated `docs/OFFICIAL_SOURCE_LINKS.md` and the Chinese/English integration notes with the verified source pages and monitoring limits.
- Supabase URL is prefilled in `.env.example`; no Secret Key is included.

## Validation for this source-links revision

- Official links were checked against current LHDN and MOF pages on 23 Oct 2026.
- TypeScript/TSX syntax transpilation for `server.ts`, `src/components/ComplianceOpportunitiesView.tsx`, and `src/services/api.ts`: no syntax errors.
- ZIP integrity test: passed.
- Full `npm run build` / project type-check was not verified because dependencies are not installed here; `tsc` stops at the missing `vite/client` type definition. Run `npm install`, `npm run lint`, and `npm run build` in a network-enabled environment before deployment.
- Scope limitation: the current Supabase RPC saves extracted-text SHA-256 histories for the two LHDN guideline PDFs. FAQ and MOF pages are live source-page hash monitors in the website but do not yet each have their own downloaded-PDF history table/function. Any change still requires human review before activating an operational rule.


## Supabase extracted-text review connection (23 Oct 2026)

- Added authenticated server endpoint `/api/policy-monitoring/supabase-snapshot` for the two LHDN guideline IDs. It reads the current and previous exact SHA-256 snapshots from the private `policy_monitor_history` table through the server-side Supabase key.
- Added `Load saved PDF text` buttons to the two LHDN document cards and a preview panel with capture time, page/character counts, hashes, previous text, and official source link.
- The full stored text can be placed into the existing review form. It remains a candidate for human verification only. Raw extracted text does **not** become operational rules and does not automatically alter tax, invoice, or compliance calculations.
- This patch does not include a live n8n workflow export; it does not prove that the external n8n schedule is enabled.

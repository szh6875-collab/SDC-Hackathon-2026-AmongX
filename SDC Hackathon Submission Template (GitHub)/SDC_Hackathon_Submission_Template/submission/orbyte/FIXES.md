# Merge and export fix log

## Combined project

- Restored the actual React `src/App.tsx` entry from the nested source archive; the outer source tree had an empty placeholder component.
- Removed the redundant nested source ZIP from public assets.
- Adopted the fuller React/API project as the primary app, while merging compatible features from the other contributor's project: versioned policy fixture files, 50 synthetic reader benchmark cases, optional RunPod AI extraction, deterministic-vs-AI field cross-checking, and documented run commands.
- Policy fixture versions are mapped from runtime labels such as `Budget2027-LHDNv4.8` to the actual files `LHDN-v4.8.json` and `LHDN-v4.9.json`. The sync preview remains explicitly demo/local; it does not claim to fetch official policies.
- Audit history is written to `data/audit-ledger.json` with an atomic temp-file rename and is not re-seeded on every restart. Company scope is included in each entry's hash where known.

## CSV and XLSM

- Replaced direct unauthenticated audit download URLs with authenticated Blob downloads using the server-issued token and selected company ID.
- Added server-side authentication, explicit company validation, strict activity filtering, `Content-Disposition`, content type and content-length headers to audit exports.
- CSV fields are consistently quoted and escaped, use UTF-8 with BOM and CRLF line endings, and neutralize spreadsheet formula injection. JSON/HTML/JavaScript error bodies are never treated as a CSV download by the frontend.
- XLSM exports are validated as OpenXML ZIP packages and checked for the expected workbook content type and required sheet names before response/download.
- Original invoice-file downloads now require the selected `company_id`; cross-company source-file access and XLSM export requests are rejected.
- Export success notifications occur only after a successful authenticated response and client-side content validation.

## Validation status in this workspace

- TypeScript/TSX syntax-transpilation check: 44 files, zero syntax diagnostics.
- JSON syntax checks: `package.json` and both policy pack files passed.
- Node syntax check for the export-isolation test passed.
- Full `npm run build`, type-check, and API integration tests have not been run in this workspace because this working directory has no installed `node_modules` and dependency installation is not available here. Run the commands in README after `npm install` before production use.

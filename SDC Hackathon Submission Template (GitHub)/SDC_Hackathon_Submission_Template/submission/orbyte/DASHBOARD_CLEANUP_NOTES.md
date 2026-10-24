# Dashboard cleanup — 2026-10-24

## Changes
- Renamed the page-level heading from `Today's Priorities` to `Business Overview` so it no longer duplicates the action-queue section title.
- Kept one `Today's Priorities` section for invoice and business-profile tasks only.
- Moved the policy-source verification reminder out of the task queue and into the dedicated `Policy Watch` section.
- Moved the turnover reference-band alert into `Policy Watch` to avoid displaying the same alert in both sections.
- Replaced the generic `Policies & Benefits for Your Business` teaser with a concise policy-watch panel showing the current source reference, current verification status, any applicable turnover-screening alert, and a next action.
- Left detailed eligibility rules and supporting documents in the existing Policies & Benefits page; no backend or tax rules were changed.

## Verification notes
- Component syntax was checked with the installed TypeScript transpiler.
- Full application lint/build depends on installing project dependencies; this workspace does not contain `node_modules`.

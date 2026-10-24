# Orbyte Hub — Legacy UI + Current Backend Merge

## Source of truth
- **Functionality / API / rules / RBAC / Supabase / n8n:** this current `orbyte-hub-supabase-n8n-integrated` project.
- **Visual design language:** `Orbyte-InvoisReady (final)` legacy frontend.

## What was changed
1. Kept the current Hub backend/server/routes/data/policy-monitoring implementation intact.
2. Applied the legacy Orbyte visual system (warm linen graph-paper background, forest green, ochre gold, Young Serif / Plus Jakarta Sans / Space Mono, hard-offset borders/shadows, compact neo-brutalist cards and controls) to the current React shell.
3. Merged **Policy + Policy Monitoring** into one top-level navigation destination: `Policy & Monitoring`.
4. Added a dedicated **General Policy Q&A Assistant** inside Policy & Monitoring. It reads the active backend policy rule pack and shows the policy version/source context; it does not invent legal conclusions.
5. Upgraded the existing WhatsApp text intake into a visible **WhatsApp-style chat UI** while keeping the current `/api/upload_invoice_text` backend workflow.
6. Restored/kept a dedicated **About & Resources** page with:
   - About Orbyte
   - How Orbyte works
   - official government resources
   - detailed PDPA & Privacy explanation
   - statutory / legal disclaimer
   - hackathon resources
7. Kept the existing **Pitch Deck + Pitch Timer** through `/legacy/slides.html`, accessible from About & Resources.
8. Kept the existing current Hub functionality including invoices, approvals, eligibility, policy source monitoring, policy packages, audit ledger, company isolation, RBAC, reports, Supabase/n8n assets, replay/testing, and related backend routes.

## Validation
- Modified TS/TSX files passed TypeScript syntax transpilation checks.
- Local relative-import existence checks passed.
- Policy/n8n JSON files passed JSON parsing checks.
- Full `npm install` / Vite build was not completed in this environment because dependency installation timed out. Therefore a full browser/runtime build should still be run after extraction.

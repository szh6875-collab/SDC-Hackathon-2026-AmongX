# Orbyte Hub — Tax Consistency Fix

## What changed

- Centralized the corporate-tax reference and Budget 2027 announcement schedules in `src/constants/policyConstants.ts`.
- The reference comparison schedule is 15% / 17% / 24% (LHDN published reference for YA 2023–2025; the applicable assessment year and eligibility still need checking).
- The Budget 2027 announcement schedule is 14% / 16% / 24% and is presented as a scenario only, not as confirmed tax payable or confirmed savings.
- Updated the financial-impact calculation and reporting UI to calculate both figures using the central schedules, with an explicit unconfirmed scenario difference.
- Changed the local demo fallback tax package to 15% / 17% / 24%, `draft`, `isActive: false`, and explicitly unverified.
- Added activation guardrails: a package must be approved, pass safety verification, and match the centrally configured reference tax schedule before it can be treated as active. A package cannot change the tax calculation schedule by itself.
- If Supabase is configured but no verified active package is available, the app no longer silently promotes a local package as the authoritative live package.
- Updated policy-source labels and English/Chinese documentation so a Budget speech is not mislabeled as gazetted legislation.
- Added `scripts/test_tax_schedule_consistency.ts` and the `test:tax-consistency` npm script.

## Checks performed

- Tax schedule regression test passed using Node's built-in TypeScript stripping:
  `node --experimental-strip-types scripts/test_tax_schedule_consistency.ts`
- TypeScript/TSX syntax transpilation passed for the changed application and test files.
- Updated JSON data files parsed successfully; the fallback and Budget 2027 candidate package states/rates were checked.

## Validation limitation

Full `tsc --noEmit` could not complete because this project copy has no installed dependencies and TypeScript reports `TS2688: Cannot find type definition file for 'vite/client'`. This is an environment/dependency limitation; a full dependency install, build and end-to-end test still need to be run in the project's normal development environment.

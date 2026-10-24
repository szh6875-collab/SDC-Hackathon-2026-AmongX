# TypeScript Check Repair Notes

## Changes made

- `tsconfig.json` now loads both `vite/client` and `node` ambient types. The project compiles browser code and server-side Node code from the same TypeScript program, so excluding Node types left `process`, `Buffer`, and Node's `ImportMeta` augmentation unavailable when dependencies are installed.
- The audit-chain test branches in `server.ts` compare the discriminant explicitly (`verification.valid === true/false`). This keeps TypeScript's union narrowing reliable even with the current non-strict-null-checking configuration.
- `README.md` now explains that `vite/client` is provided by the declared Vite dependency and that `TS2688` normally indicates an incomplete dependency installation.

## Checks performed in this environment

- `scripts/test_tax_schedule_consistency.ts`: passed using Node's TypeScript type stripping.
- TypeScript/TSX syntax transpilation scan: 48 files parsed, no syntax/transpile errors.
- Standalone TypeScript check of `src/constants/policyConstants.ts`: passed.
- JSON parsing checks for `package.json`, `tsconfig.json`, and policy data files: passed.
- Targeted compile check for the audit-verification discriminated-union narrowing: passed.

## Remaining environment limitation

A full `npm run lint` / `npm run build` could not be completed in this environment because `node_modules` is not present and the environment cannot resolve `registry.npmjs.org`, so dependencies cannot be installed here. This is not evidence that the website fails to build; it means the full dependency-backed check must run after `npm install` in an environment with registry access.

After installation, run:

```bash
npm run lint
npm run build
npm run test:tax-consistency
```

# Orbyte Policy Monitor — n8n workflow

`policy-monitor.json` is an importable workflow with both a **12-hour scheduled trigger** and a **manual test trigger**. It calls the protected Orbyte backend endpoint, which downloads/extracts the current official General and Specific LHDN guideline PDFs plus the official FAQ index-linked PDFs, extracts their full text, calculates a combined corpus SHA-256, and stores searchable snapshots through the Supabase RPC, and stages changed statutory content for human review. FAQ text is archived for Q&A but does not automatically generate operational rule packages. It does **not** publish or activate tax rules.

## Import and configure

1. Deploy the Orbyte backend and use its public HTTPS origin, e.g. `https://your-app.example.com` (no trailing slash).
2. In n8n, import this file from **Workflows → Import from File**.
3. Open **Run Official LHDN PDFs + FAQ Snapshot Check** and replace `https://YOUR_ORBYTE_HOST` with the real deployed backend origin.
4. Create an **HTTP Header Auth** credential:
   - Header Name: `x-orbyte-automation-secret`
   - Header Value: exactly the same strong random value configured as `ORBYTE_AUTOMATION_SECRET` in the backend's secret manager.
   Select that credential on the HTTP Request node. The workflow intentionally contains no real secret.
5. In Supabase SQL Editor, run `database/policy-monitor-schema.sql` if the tables are not already installed, then run `database/policy-monitor-rpc.sql`. The RPC file updates both `policy_sources`/`policy_monitor_history` and the metadata table queried by the application. Re-run the RPC file after upgrades.
6. After deploying this crawler update, execute **Manual Test Run** once so the FAQ index is expanded into its linked PDF corpus. All three source results (two PDFs and the FAQ page) must be successful, the Supabase snapshot status must populate, and a second run with unchanged sources should report unchanged hashes. Review n8n execution output and the app's Policy Monitor page.
7. Only after successful manual execution, activate the workflow in n8n and set `N8N_POLICY_MONITOR_SCHEDULE_ENABLED=true` in the backend environment. Restart/redeploy the backend after changing environment variables.

## Required backend secrets

- `SUPABASE_URL`: HTTPS project URL.
- `SUPABASE_SECRET_KEY`: server-side Supabase Secret/service role key. Never expose it to the browser or place it in workflow JSON.
- `ORBYTE_AUTOMATION_SECRET`: random secret, at least 32 characters.
- `N8N_POLICY_MONITOR_SCHEDULE_ENABLED`: `false` until the active schedule has been verified; `true` only changes the app's reported schedule indicator and does not activate n8n itself.

## What the workflow does / does not guarantee

- It monitors the General and Specific e-Invoice PDF sources and downloads and extracts official FAQ PDFs linked from the e-Invoice FAQ index, then saves a searchable combined FAQ corpus for retrieval-grounded Q&A. The FAQ is not turned into a tax-rule package.
- It retrieves PDF links dynamically from the official LHDN guideline listing page; it does not rely on the HTML listing page's hash or a bundled fixture as a live baseline.
- Download or extraction errors return a failing HTTP response so n8n records a failed run instead of a false success.
- Snapshot changes are review signals only. Candidate packages remain unapproved; authorised human approval is required to change operational rules.
- This file does not include credentials, a Supabase key, a deployment URL, or proof that your external n8n/Supabase services are already configured. Verify the manual and scheduled runs after deployment.

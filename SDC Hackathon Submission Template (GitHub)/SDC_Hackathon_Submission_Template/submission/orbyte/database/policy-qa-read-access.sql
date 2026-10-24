-- Run once in Supabase SQL Editor when enabling evidence-grounded Policy Q&A.
-- The backend reads these rows with its server-side service key. Do not expose the
-- extracted text in anon/authenticated grants or browser-side API keys.
grant select on table public.policy_sources to service_role;
grant select on table public.policy_monitor_documents to service_role;
grant select on table public.policy_monitor_history to service_role;
grant select on table public.policy_approved_packages to service_role;

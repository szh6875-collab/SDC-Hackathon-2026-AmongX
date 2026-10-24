-- Orbyte Hub policy monitoring & rule safety storage (Supabase)
-- Run this in Supabase Dashboard -> SQL Editor -> New query.
-- Supports:
-- 1. Dynamic policy source registry (not hardcoded in code)
-- 2. Snapshot history & extracted text SHA-256 tracking
-- 3. Staged candidate rule packages with safety verification results
-- 4. Active approved rule packages for runtime tax calculations

-- 1. Dynamic Policy Sources Registry
create table if not exists public.policy_sources (
  id text primary key,
  name text not null,
  url text not null,
  document_type text not null,
  category text not null default 'guideline'
    check (category in ('guideline', 'faq', 'budget_speech', 'gazette', 'sst', 'custom')),
  source_format text not null default 'pdf'
    check (source_format in ('pdf', 'html', 'json')),
  check_interval_hours integer not null default 12,
  is_active boolean not null default true,
  last_checked_at timestamptz,
  last_successful_retrieval_at timestamptz,
  current_sha256 text,
  previous_sha256 text,
  detected_version text,
  status text not null default 'idle'
    check (status in ('idle', 'checking', 'unchanged', 'changed', 'failed', 'baseline_saved')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Seed default official sources if not already present
insert into public.policy_sources (id, name, url, document_type, category, source_format, check_interval_hours, is_active, detected_version)
values
  (
    'lhdn-general-guideline',
    'LHDN e-Invoice General Guideline',
    'https://www.hasil.gov.my/e-invois/rujukan-pelaksanaan-e-invois/garis-panduan/',
    'Official General e-Invoice Guideline PDF published by Inland Revenue Board of Malaysia (HASiL).',
    'guideline',
    'pdf',
    12,
    true,
    null
  ),
  (
    'lhdn-specific-guideline',
    'LHDN e-Invoice Specific Guideline',
    'https://www.hasil.gov.my/e-invois/rujukan-pelaksanaan-e-invois/garis-panduan/',
    'Official Specific e-Invoice Guideline PDF covering transaction types, cross-border, and consolidation rules.',
    'guideline',
    'pdf',
    12,
    true,
    null
  ),
  (
    'lhdn-faq',
    'LHDN e-Invoice FAQs & Administrative Clarifications',
    'https://www.hasil.gov.my/e-invois/rujukan-pelaksanaan-e-invois/soalan-lazim/',
    'Official tax administration guidance and Q&As on e-invoice rollout timelines, threshold rules, and exemptions.',
    'faq',
    'html',
    12,
    true,
    null
  ),
  (
    'mof-budget',
    'MOF Budget 2027 Policy Speech & Gazetted Tax Measures',
    'https://www.mof.gov.my/portal/en/news/speech/speech-the-fifth-madani-budget-2027',
    'Ministry of Finance Budget speech announcements, proposed tax bracket adjustments, and SME wage subsidies.',
    'budget_speech',
    'html',
    24,
    true,
    null
  ),
  (
    'lhdn-sst-reference',
    'Royal Malaysian Customs MySST Portal — SST Reference',
    'https://mysst.customs.gov.my/',
    'General MySST portal for SST information. Not a versioned e-Invoice guideline; archive for monitoring only until source-specific SST rules are implemented.',
    'sst',
    'html',
    24,
    true,
    null
  )
on conflict (id) do nothing;

-- Clear known placeholder/fixture hashes from previous starter versions. They were not a verified live baseline.
update public.policy_sources
set current_sha256 = null,
    previous_sha256 = null,
    detected_version = null,
    last_checked_at = null,
    last_successful_retrieval_at = null,
    status = 'idle',
    error_message = null,
    updated_at = now()
where
  (id = 'lhdn-general-guideline' and previous_sha256 = '9f83a48e89f1d2b7a956d3389012e847cba8912d890e71829038475891234abc')
  or (id = 'lhdn-specific-guideline' and previous_sha256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  or (id = 'lhdn-faq' and current_sha256 = 'a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0')
  or (id = 'mof-budget' and current_sha256 = '456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123')
  or (id = 'lhdn-sst-reference' and current_sha256 = '789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456');

-- 2. Snapshot Document Metadata (Compatibility & Rollout Status)
create table if not exists public.policy_monitor_documents (
  document_key text primary key references public.policy_sources(id) on delete cascade,
  title text not null,
  source_name text not null default 'LHDN',
  source_index_url text not null,
  document_url text,
  status text not null default 'pending'
    check (status in (
      'pending', 'baseline_saved', 'checked_unchanged', 'change_detected',
      'unavailable', 'document_not_found', 'unverifiable', 'manual_review'
    )),
  detected_version text,
  current_sha256 text,
  previous_sha256 text,
  last_checked_at timestamptz,
  last_successful_retrieval_at timestamptz,
  page_count integer,
  text_length integer,
  has_pending_review boolean not null default false,
  change_summary text,
  error_message text,
  active_rule_version text not null default 'NO_ACTIVE_APPROVED_PACKAGE',
  updated_at timestamptz not null default now()
);

-- 3. Extracted PDF Text History (Audit Archive)
create table if not exists public.policy_monitor_history (
  id bigint generated by default as identity primary key,
  document_key text not null,
  content_sha256 text not null,
  detected_version text,
  source_url text not null,
  extracted_text text not null,
  page_count integer,
  captured_at timestamptz not null default now(),
  unique (document_key, content_sha256)
);

create index if not exists policy_monitor_history_document_time_idx
  on public.policy_monitor_history (document_key, captured_at desc);

-- 4. Approved Rule Packages & Candidate Staging
-- CRITICAL SAFETY REQUIREMENT: Raw PDF text is NEVER directly used for tax calculations.
-- The tax engine only reads packages where status = 'approved' and is_active = true.
create table if not exists public.policy_approved_packages (
  id text primary key,
  package_name text not null,
  version text not null,
  source_id text references public.policy_sources(id) on delete set null,
  source_name text not null,
  source_url text not null,
  source_sha256 text not null,
  status text not null default 'draft'
    check (status in ('draft', 'pending_validation', 'validated', 'approved', 'rejected', 'archived')),
  is_active boolean not null default false,
  tax_brackets jsonb not null,
  exemption_threshold numeric not null default 3000000,
  min_wage_standard numeric not null default 1700,
  sst_rate numeric not null default 0.08,
  rules jsonb not null default '[]'::jsonb,
  safety_verification jsonb not null default '{}'::jsonb,
  extracted_at timestamptz not null default now(),
  validated_at timestamptz,
  approved_at timestamptz,
  approved_by text,
  approval_notes text,
  change_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5. Seed an inactive demo-only package; live calculations must wait for an approved, live-verified package.
insert into public.policy_approved_packages (
  id, package_name, version, source_id, source_name, source_url, source_sha256,
  status, is_active, tax_brackets, exemption_threshold, min_wage_standard, sst_rate,
  rules, safety_verification, approved_at, approved_by, approval_notes, change_summary
)
values (
  'PKG-LOCAL-DEMO-DRAFT',
  'DEMO ONLY — Local fallback rules (not live-verified)',
  'demo-baseline',
  'lhdn-specific-guideline',
  'Local demo fixture — official source not verified',
  'https://www.hasil.gov.my/e-invois/rujukan-pelaksanaan-e-invois/garis-panduan/',
  'eea36dfc579b85810f2582934d6fb898e1f65dc2587fdd78af9eae117b5a3265',
  'draft',
  false,
  '[{"upTo": 150000, "rate": 0.15}, {"upTo": 600000, "rate": 0.17}, {"upTo": null, "rate": 0.24}]'::jsonb,
  3000000,
  1700,
  0.08,
  '[
    {"id": "EINV-001", "rule_id": "R-INVOICE-THRESHOLD", "title": "RM10k Review Prompt", "category": "e-invoicing", "status": "in_force", "enabled": true},
    {"id": "EINV-002", "rule_id": "R-BUYER-TIN", "title": "Buyer TIN Requirement Check", "category": "e-invoicing", "status": "in_force", "enabled": true},
    {"id": "EXEMP-001", "rule_id": "R-EXEMPTION-RADAR", "title": "MSME RM3M Exemption Radar", "category": "e-invoicing", "status": "in_force", "enabled": true}
  ]'::jsonb,
  '{"passed": false, "score": 0, "totalChecks": 7, "passedChecks": 0, "verifiedAt": null, "engineVersion": "NOT VERIFIED - demo fallback only", "checks": [], "issues": ["Demo seed only; no live official document or human approval has been verified."]}'::jsonb,
  null,
  'Local demo seed (not a human approval)',
  'Demo-only rules. Fetch an official source, validate a candidate package, and obtain human approval before production tax/compliance use.',
  'Local demo baseline only; not live official policy content.'
)
on conflict (id) do nothing;


-- Migration guard: deactivate the previous synthetic seed that was labelled as an official verified baseline.
update public.policy_approved_packages
set package_name = 'DEMO ONLY — Local fallback rules (not live-verified)',
    version = 'demo-baseline',
    source_name = 'Local demo fixture — official source not verified',
    source_sha256 = 'eea36dfc579b85810f2582934d6fb898e1f65dc2587fdd78af9eae117b5a3265',
    status = 'draft',
    is_active = false,
    safety_verification = '{"passed": false, "score": 0, "totalChecks": 7, "passedChecks": 0, "verifiedAt": null, "engineVersion": "NOT VERIFIED - demo fallback only", "checks": [], "issues": ["Demo seed only; no live official document or human approval has been verified."]}'::jsonb,
    approved_at = null,
    approved_by = 'Local demo seed (not a human approval)',
    approval_notes = 'Demo-only rules. Fetch an official source, validate a candidate package, and obtain human approval before production tax/compliance use.',
    change_summary = 'Local demo baseline only; not live official policy content.'
where id = 'PKG-LHDN-v4.9-ACTIVE'
  and approved_by = 'Chief Tax Compliance Officer'
  and approval_notes like 'Certified compliant with official LHDN v4.9%';

-- Reject the known starter candidates created from bundled local fixture text, not a live official PDF.
update public.policy_approved_packages
set status = 'rejected',
    is_active = false,
    safety_verification = '{"passed": false, "score": 0, "totalChecks": 7, "passedChecks": 0, "verifiedAt": null, "engineVersion": "NOT VERIFIED - fixture candidate rejected", "checks": [], "issues": ["This starter candidate was generated from local fixture text, not verified live official content."]}'::jsonb,
    approved_at = null,
    approved_by = null,
    approval_notes = 'Rejected during integration: bundled local fixture content was not a verified live official source.',
    updated_at = now()
where id in ('PKG-LHDN-SPECIFIC-GUIDELINE-1455', 'PKG-LHDN-GENERAL-GUIDELINE-0077')
  and approved_at is null
  and source_sha256 in (
    '2f07da70f37c0f3ad27887415f53bbad8ee83bf1ec99b3993668d9fa226b31d7',
    '175db2bf8d18482e8e04f870b6376fd04ba5e7f833427eab01d09fa60c73f5d1'
  );

-- 6. Row Level Security
alter table public.policy_sources enable row level security;
alter table public.policy_monitor_documents enable row level security;
alter table public.policy_monitor_history enable row level security;
alter table public.policy_approved_packages enable row level security;

-- Public can read source registry and approved packages; only service_role can modify
grant select on table public.policy_sources to anon, authenticated;
grant select, insert, update, delete on table public.policy_sources to service_role;

-- Server-side evidence-grounded Q&A and policy-monitor status read these tables.
-- Do not grant public/anon access to stored extracted policy text.
grant select on table public.policy_monitor_documents to service_role;
grant select on table public.policy_monitor_history to service_role;

grant select on table public.policy_approved_packages to anon, authenticated;
grant select, insert, update, delete on table public.policy_approved_packages to service_role;

drop policy if exists "Public can read policy sources" on public.policy_sources;
create policy "Public can read policy sources" on public.policy_sources for select to anon, authenticated using (true);

drop policy if exists "Public can read approved packages" on public.policy_approved_packages;
create policy "Public can read approved packages" on public.policy_approved_packages for select to anon, authenticated using (true);

-- Server-only table reads used by evidence-grounded Policy Q&A.
grant select on table public.policy_sources to service_role;
grant select on table public.policy_approved_packages to service_role;

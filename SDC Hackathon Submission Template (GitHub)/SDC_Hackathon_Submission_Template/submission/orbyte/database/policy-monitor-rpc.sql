-- Orbyte Hub policy-monitor RPC functions (Supabase)
-- Run in Supabase Dashboard -> SQL Editor -> New query.
-- Handles:
-- 1. Dynamic snapshot recording from any active source in policy_sources
-- 2. Staging candidate packages with safety verification
-- 3. Approving verified rule packages for operational runtime tax calculations

-- Function 1: Record Snapshot for dynamic source
create or replace function public.record_policy_monitor_snapshot(p_doc jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_document_key text := nullif(p_doc ->> 'id', '');
  v_title text := coalesce(nullif(p_doc ->> 'title', ''), 'Official policy document');
  v_document_url text := coalesce(nullif(p_doc ->> 'document_url', ''), nullif(p_doc ->> 'url', ''));
  v_sha256 text := lower(nullif(p_doc ->> 'sha256', ''));
  v_extracted_text text := nullif(p_doc ->> 'text', '');
  v_detected_version text;
  v_page_count integer;
  v_source_record public.policy_sources%rowtype;
  v_status text;
  v_previous_sha256 text;
  v_has_pending_review boolean;
begin
  if v_document_key is null then
    raise exception 'Missing document source id';
  end if;

  if v_document_url is null or v_sha256 is null or length(v_sha256) <> 64 then
    raise exception 'Document URL or valid SHA-256 is missing';
  end if;

  if v_extracted_text is null or length(v_extracted_text) < 100 then
    raise exception 'Extracted document text is missing or too short';
  end if;

  -- Verify source exists in policy_sources
  select * into v_source_record
    from public.policy_sources
   where id = v_document_key;

  if not found then
    -- Auto-register custom source
    insert into public.policy_sources (
      id, name, url, document_type, category, check_interval_hours, is_active, status
    ) values (
      v_document_key, v_title, v_document_url, 'Monitored Policy Document', 'guideline', 12, true, 'checking'
    )
    returning * into v_source_record;
  end if;

  v_detected_version := nullif(p_doc ->> 'detected_version', '');
  if v_detected_version is null then
    v_detected_version := (regexp_match(v_extracted_text, '(?i)(?:VERSI|VERSION)\s+([0-9]+(?:\.[0-9]+)+)'))[1];
  end if;

  if coalesce(p_doc ->> 'numpages', '') ~ '^[0-9]+$' then
    v_page_count := (p_doc ->> 'numpages')::integer;
  end if;

  perform pg_advisory_xact_lock(hashtext(v_document_key));

  if v_source_record.current_sha256 is null then
    v_status := 'baseline_saved';
    v_previous_sha256 := null;
    v_has_pending_review := false;
  elsif v_source_record.current_sha256 = v_sha256 then
    v_status := 'unchanged';
    v_previous_sha256 := v_source_record.previous_sha256;
    v_has_pending_review := false;
  else
    v_status := 'changed';
    v_previous_sha256 := v_source_record.current_sha256;
    v_has_pending_review := true;
  end if;

  -- Update policy_sources
  update public.policy_sources
     set current_sha256 = v_sha256,
         previous_sha256 = v_previous_sha256,
         detected_version = coalesce(v_detected_version, v_source_record.detected_version),
         last_checked_at = now(),
         last_successful_retrieval_at = now(),
         status = v_status,
         error_message = null,
         updated_at = now()
   where id = v_document_key;

  -- Archive into policy_monitor_history
  insert into public.policy_monitor_history (
    document_key, content_sha256, detected_version, source_url,
    extracted_text, page_count, captured_at
  ) values (
    v_document_key, v_sha256, v_detected_version, v_document_url,
    v_extracted_text, v_page_count, now()
  )
  on conflict (document_key, content_sha256) do nothing;

  -- Keep the metadata endpoint's table in sync with the same authoritative snapshot.
  -- This fixes the previous gap where the RPC stored history but the UI queried
  -- policy_monitor_documents, leaving status cards empty after successful runs.
  insert into public.policy_monitor_documents (
    document_key, title, source_name, source_index_url, document_url, status,
    detected_version, current_sha256, previous_sha256, last_checked_at,
    last_successful_retrieval_at, page_count, text_length, has_pending_review,
    change_summary, error_message, updated_at
  ) values (
    v_document_key,
    v_title,
    coalesce(nullif(p_doc ->> 'source_name', ''), 'LHDN / HASiL'),
    coalesce(nullif(p_doc ->> 'index_url', ''), v_source_record.url),
    v_document_url,
    case v_status
      when 'changed' then 'change_detected'
      when 'unchanged' then 'checked_unchanged'
      else 'baseline_saved'
    end,
    v_detected_version,
    v_sha256,
    v_previous_sha256,
    now(),
    now(),
    v_page_count,
    length(v_extracted_text),
    v_has_pending_review,
    case
      when v_status = 'changed' then 'SHA-256 changed from ' || left(coalesce(v_previous_sha256, ''), 12) || ' to ' || left(v_sha256, 12) || '; human review required.'
      when v_status = 'baseline_saved' then 'First successful official-source snapshot recorded. No previous live snapshot exists yet, so change detection is not established.'
      else 'Retrieved official-source text matches the stored SHA-256 baseline.'
    end,
    null,
    now()
  )
  on conflict (document_key) do update set
    title = excluded.title,
    source_name = excluded.source_name,
    source_index_url = excluded.source_index_url,
    document_url = excluded.document_url,
    status = excluded.status,
    detected_version = excluded.detected_version,
    current_sha256 = excluded.current_sha256,
    previous_sha256 = excluded.previous_sha256,
    last_checked_at = excluded.last_checked_at,
    last_successful_retrieval_at = excluded.last_successful_retrieval_at,
    page_count = excluded.page_count,
    text_length = excluded.text_length,
    has_pending_review = excluded.has_pending_review,
    change_summary = excluded.change_summary,
    error_message = null,
    updated_at = excluded.updated_at;

  return jsonb_build_object(
    'document_key', v_document_key,
    'title', v_title,
    'status', v_status,
    'current_sha256', v_sha256,
    'previous_sha256', v_previous_sha256,
    'has_pending_review', v_has_pending_review,
    'detected_version', v_detected_version,
    'page_count', v_page_count,
    'text_length', length(v_extracted_text),
    'rules_activated', false,
    'safety_verification_required', true
  );
end;
$$;

-- Function 2: Get Currently Active Approved Rule Package (Used by Runtime Tax Engine)
create or replace function public.get_active_approved_rule_package()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_pkg public.policy_approved_packages%rowtype;
begin
  select * into v_pkg
    from public.policy_approved_packages
   where is_active = true
     and status = 'approved'
     and safety_verification ->> 'passed' = 'true'
   order by approved_at desc nulls last
   limit 1;

  if not found then
    return null;
  end if;

  return to_jsonb(v_pkg);
end;
$$;

-- Function 3: Approve and Activate a Rule Package
create or replace function public.approve_rule_package(
  p_package_id text,
  p_approved_by text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target public.policy_approved_packages%rowtype;
begin
  select * into v_target
    from public.policy_approved_packages
   where id = p_package_id;

  if not found then
    raise exception 'Rule package % not found', p_package_id;
  end if;

  if (v_target.safety_verification ->> 'passed')::boolean is distinct from true then
    raise exception 'Cannot activate rule package %: Automated safety verification checks have not passed.', p_package_id;
  end if;

  -- Deactivate other packages
  update public.policy_approved_packages
     set is_active = false,
         updated_at = now()
   where id <> p_package_id and is_active = true;

  -- Activate target package
  update public.policy_approved_packages
     set is_active = true,
         status = 'approved',
         approved_at = now(),
         approved_by = coalesce(p_approved_by, 'Authorized Compliance Officer'),
         approval_notes = p_notes,
         updated_at = now()
   where id = p_package_id
   returning * into v_target;

  return to_jsonb(v_target);
end;
$$;

revoke all on function public.record_policy_monitor_snapshot(jsonb) from public;
revoke all on function public.approve_rule_package(text, text, text) from public;

grant execute on function public.record_policy_monitor_snapshot(jsonb) to service_role;
grant execute on function public.get_active_approved_rule_package() to anon, authenticated, service_role;
grant execute on function public.approve_rule_package(text, text, text) to service_role;

-- Server-only read access for evidence-grounded Policy Q&A.
-- Extracted policy text is not granted to anon/authenticated browser roles.
grant select on table public.policy_sources to service_role;
grant select on table public.policy_monitor_documents to service_role;
grant select on table public.policy_monitor_history to service_role;
grant select on table public.policy_approved_packages to service_role;

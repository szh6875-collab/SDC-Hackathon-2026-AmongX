/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Orbyte Hub — Policy Store & Supabase Source Registry
 * 
 * Manages:
 * 1. Dynamic policy source registry (Supabase + local fallback)
 * 2. Automated PDF & Web text extraction with SHA-256 fingerprinting
 * 3. Candidate rule package staging with 7-point safety verification
 * 4. Active approved rule package query for verified compliance rules and policy display
 *    (tax reference/scenario schedules are deliberately centralized separately)
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { PDFParse } from 'pdf-parse';
import { extractOfficialFaqPdfLinks } from './policyFaqSources';
import {
  PolicySourceRecord,
  ApprovedRulePackage,
  MonitoredSource,
  TaxBracketConfig,
  PolicyRule,
} from '../types';
import {
  verifyRulePackageSafety,
  parsePolicyTextToCandidatePackage,
} from './policySafetyVerifier';
import { getReferenceTaxBracketsForPolicyPackage, matchesReferenceTaxSchedule } from '../constants/policyConstants';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const SOURCES_FILE = path.join(DATA_DIR, 'policy-sources-registry.json');
const PACKAGES_FILE = path.join(DATA_DIR, 'policy-approved-packages.json');

function ensureDataDir(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err) {
    console.error('[policyStore] Failed to create data dir:', err);
  }
}

// Initial Default Sources (seeded if registry is empty)
const SEED_SOURCES: PolicySourceRecord[] = [
  {
    id: 'lhdn-general-guideline',
    name: 'LHDN e-Invoice General Guideline',
    url: 'https://www.hasil.gov.my/e-invois/rujukan-pelaksanaan-e-invois/garis-panduan/',
    documentType: 'Official General e-Invoice Guideline PDF published by Inland Revenue Board of Malaysia (HASiL).',
    category: 'guideline',
    sourceFormat: 'pdf',
    checkIntervalHours: 12,
    isActive: true,
    lastChecked: null,
    lastSuccessfulRetrieval: null,
    currentSha256: null,
    previousSha256: null,
    detectedVersion: null,
    status: 'idle',
    createdAt: new Date('2026-08-30T00:00:00Z').toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'lhdn-specific-guideline',
    name: 'LHDN e-Invoice Specific Guideline',
    url: 'https://www.hasil.gov.my/e-invois/rujukan-pelaksanaan-e-invois/garis-panduan/',
    documentType: 'Official Specific e-Invoice Guideline PDF covering transaction types, cross-border, and consolidation rules.',
    category: 'guideline',
    sourceFormat: 'pdf',
    checkIntervalHours: 12,
    isActive: true,
    lastChecked: null,
    lastSuccessfulRetrieval: null,
    currentSha256: null,
    previousSha256: null,
    detectedVersion: null,
    status: 'idle',
    createdAt: new Date('2026-09-07T00:00:00Z').toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'lhdn-faq',
    name: 'LHDN e-Invoice FAQs & Official Clarifications',
    url: 'https://www.hasil.gov.my/e-invois/rujukan-pelaksanaan-e-invois/soalan-lazim/',
    documentType: 'Official tax administration clarifications: General FAQ, industry-specific FAQs, and MyInvois portal guidance.',
    category: 'faq',
    sourceFormat: 'html',
    checkIntervalHours: 12,
    isActive: true,
    lastChecked: null,
    lastSuccessfulRetrieval: null,
    currentSha256: null,
    previousSha256: null,
    detectedVersion: null,
    status: 'idle',
    createdAt: new Date('2026-06-22T00:00:00Z').toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'mof-budget',
    name: 'MOF Budget 2027 Policy Speech & Announced Measures',
    url: 'https://www.mof.gov.my/portal/en/news/speech/speech-the-fifth-madani-budget-2027',
    documentType: 'Ministry of Finance Budget speech policy announcements, proposed tax bracket adjustments, and SME wage subsidies.',
    category: 'budget_speech',
    sourceFormat: 'html',
    checkIntervalHours: 24,
    isActive: true,
    lastChecked: null,
    lastSuccessfulRetrieval: null,
    currentSha256: null,
    previousSha256: null,
    detectedVersion: null,
    status: 'idle',
    createdAt: new Date('2026-10-09T00:00:00Z').toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'lhdn-sst-reference',
    name: 'Royal Malaysian Customs MySST Portal — SST Reference',
    url: 'https://mysst.customs.gov.my/',
    documentType: 'General MySST portal for Sales and Service Tax information. This homepage is not a versioned e-Invoice guideline; archive it for source monitoring only until source-specific SST rules are implemented.',
    category: 'sst',
    sourceFormat: 'html',
    checkIntervalHours: 24,
    isActive: true,
    lastChecked: null,
    lastSuccessfulRetrieval: null,
    currentSha256: null,
    previousSha256: null,
    detectedVersion: null,
    status: 'idle',
    createdAt: new Date('2026-07-01T00:00:00Z').toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Local fallback package for UI/demo continuity only; never treat as a live verified policy.
const SEED_LOCAL_DEMO_PACKAGE: ApprovedRulePackage = {
  id: 'PKG-LOCAL-DEMO-BASELINE',
  packageName: 'DEMO ONLY — Reference schedule (not a verified active tax package)',
  version: 'demo-baseline',
  sourceId: 'lhdn-specific-guideline',
  sourceName: 'Local demo fixture — official source not verified',
  sourceUrl: 'https://www.hasil.gov.my/e-invois/rujukan-pelaksanaan-e-invois/garis-panduan/',
  sourceSha256: '',
  status: 'draft',
  isActive: false,
  taxBrackets: getReferenceTaxBracketsForPolicyPackage(),
  exemptionThreshold: 3000000, // RM3,000,000 gazetted SME exemption threshold
  minWageStandard: 1700,
  sstRate: 0.08,
  rules: [
    {
      id: 'EINV-001',
      rule_id: 'R-INVOICE-THRESHOLD',
      version: '1.0',
      category: 'e-invoicing',
      title: 'Configured RM10,000 Transaction Review Prompt',
      description: 'Configured product threshold that prompts a check of applicable transaction and consolidation rules.',
      condition: { review_threshold: 10000, universal_mandate: false },
      explanation: 'Flags transactions crossing RM10,000 for mandatory completeness and consolidation review.',
      reference: 'LHDN Specific Guideline v4.9',
      enabled: true,
      source: 'Local demo rule seed — not verified',
      status: 'in_force',
      approved_by: 'Chief Tax Compliance Officer',
      source_sentence: 'Transactions crossing the configured review threshold should be checked against official requirements.',
      confidence: 0.95,
      benefit: 'Prompt users to verify transaction-specific e-Invoice treatment',
    },
    {
      id: 'EINV-002',
      rule_id: 'R-BUYER-TIN',
      version: '1.0',
      category: 'e-invoicing',
      title: 'Buyer TIN Field Completeness Check',
      description: 'Buyer TIN or BRN is required for all non-consolidated B2B e-Invoices.',
      condition: { require_tin_on_individual: true },
      explanation: 'Buyer Tax Identification Number presence checked prior to submission.',
      reference: 'LHDN General Guideline v4.8 & Specific Guideline v4.9',
      enabled: true,
      source: 'Local demo rule seed — not verified',
      status: 'in_force',
      approved_by: 'Chief Tax Compliance Officer',
      source_sentence: 'Check whether buyer TIN is required for the particular transaction under official guidelines.',
      confidence: 0.98,
      benefit: 'Help users find missing tax-identification fields before submission',
    },
    {
      id: 'EXEMP-001',
      rule_id: 'R-EXEMPTION-RADAR',
      version: '1.0',
      category: 'e-invoicing',
      title: 'MSME Annual Turnover Exemption Screening',
      description: 'Taxpayers with annual turnover or revenue below RM3,000,000 are screened for statutory timeline relaxation.',
      condition: { annual_turnover_max: 3000000 },
      explanation: 'Illustrative MSME revenue screening only; confirm the current official implementation schedule before relying on this result.',
      reference: 'Demo fixture — confirm the current official implementation timeline',
      enabled: true,
      source: 'Local demo rule seed — not verified',
      status: 'in_force',
      approved_by: 'Chief Tax Compliance Officer',
      source_sentence: 'Demo-only screening assumption; eligibility and effective dates require live source review.',
      confidence: 0.99,
      benefit: 'Identify MSME phase exemption eligibility and avoid premature compliance expenditure',
    },
  ],
  safetyVerification: {
    passed: false,
    score: 0,
    totalChecks: 7,
    passedChecks: 0,
    checks: [],
    issues: ['Local demo baseline only. No live official-source snapshot or authorised human approval has been verified.'],
    verifiedAt: '',
    engineVersion: 'NOT VERIFIED — demo fallback only',
  },
  extractedAt: '',
  validatedAt: null,
  approvedAt: null,
  approvedBy: 'Local demo seed (not a human approval)',
  approvalNotes: 'Synthetic local fallback data to keep the demo navigable. This is a reference schedule only; it is not a live official snapshot, legal verification, human approval, or production tax basis.',
  changeSummary: 'Local reference baseline only. The Budget 2027 rates remain an announcement scenario until legal status and the applicable year of assessment are verified.',
};

// In-Memory Cache
let memorySources: PolicySourceRecord[] = [];
let memoryPackages: ApprovedRulePackage[] = [];
// When Supabase is configured, synchronous tax/impact endpoints must use only the
// authoritative active package loaded from Supabase, never silently use demo rules.
let supabaseActivePackageCache: ApprovedRulePackage | null | undefined = undefined;

// Initialize local stores
export function initPolicyStores(): void {
  ensureDataDir();

  // Load or seed Sources
  try {
    if (fs.existsSync(SOURCES_FILE)) {
      const data = JSON.parse(fs.readFileSync(SOURCES_FILE, 'utf-8'));
      if (Array.isArray(data) && data.length > 0) {
        memorySources = data;
      } else {
        memorySources = [...SEED_SOURCES];
        fs.writeFileSync(SOURCES_FILE, JSON.stringify(memorySources, null, 2), 'utf-8');
      }
    } else {
      memorySources = [...SEED_SOURCES];
      fs.writeFileSync(SOURCES_FILE, JSON.stringify(memorySources, null, 2), 'utf-8');
    }
  } catch (err) {
    console.warn('[policyStore] Error reading sources file, using seed:', err);
    memorySources = [...SEED_SOURCES];
  }

  // Load or seed Packages
  try {
    if (fs.existsSync(PACKAGES_FILE)) {
      const data = JSON.parse(fs.readFileSync(PACKAGES_FILE, 'utf-8'));
      if (Array.isArray(data) && data.length > 0) {
        memoryPackages = data;
      } else {
        memoryPackages = [SEED_LOCAL_DEMO_PACKAGE];
        fs.writeFileSync(PACKAGES_FILE, JSON.stringify(memoryPackages, null, 2), 'utf-8');
      }
    } else {
      memoryPackages = [SEED_LOCAL_DEMO_PACKAGE];
      fs.writeFileSync(PACKAGES_FILE, JSON.stringify(memoryPackages, null, 2), 'utf-8');
    }
  } catch (err) {
    console.warn('[policyStore] Error reading packages file, using seed:', err);
    memoryPackages = [SEED_LOCAL_DEMO_PACKAGE];
  }
}

// Persist local store
function persistStores(): void {
  ensureDataDir();
  try {
    fs.writeFileSync(SOURCES_FILE, JSON.stringify(memorySources, null, 2), 'utf-8');
    fs.writeFileSync(PACKAGES_FILE, JSON.stringify(memoryPackages, null, 2), 'utf-8');
  } catch (err) {
    console.error('[policyStore] Failed to write store files:', err);
  }
}

/**
 * Checks if Supabase REST API is configured.
 */
function getSupabaseConfig(): { url: string; key: string } | null {
  const rawUrl = (process.env.SUPABASE_URL || '').trim();
  const key = (process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_KEY || '').trim();
  if (!rawUrl || !key) return null;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === 'https:') {
      return { url: parsed.origin, key };
    }
  } catch {}
  return null;
}

/**
 * Supabase's new sb_secret_* API keys are opaque API keys, not JWTs; send them only
 * through apikey. Legacy service_role keys are JWTs and remain compatible with both
 * apikey and Authorization headers.
 */
function supabaseAuthHeaders(key: string, extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { apikey: key, ...extra };
  if (!key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;
  return headers;
}

/**
 * Retrieves all registered policy sources from Supabase or local fallback.
 */
export async function getPolicySources(): Promise<{ sources: PolicySourceRecord[]; provider: 'supabase' | 'local_fallback' }> {
  if (memorySources.length === 0) initPolicyStores();

  const sb = getSupabaseConfig();
  if (sb) {
    try {
      const res = await fetch(`${sb.url}/rest/v1/policy_sources?select=*&order=created_at.asc`, {
        method: 'GET',
        headers: supabaseAuthHeaders(sb.key, { Accept: 'application/json' }),
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows.length > 0) {
          const mapped: PolicySourceRecord[] = rows.map((r: any) => ({
            id: r.id,
            name: r.name,
            url: r.url,
            documentType: r.document_type || r.documentType || 'Official Policy Source',
            category: r.category || 'guideline',
            sourceFormat: r.source_format || r.sourceFormat || 'pdf',
            checkIntervalHours: r.check_interval_hours || 12,
            isActive: r.is_active ?? true,
            lastChecked: r.last_checked_at || null,
            lastSuccessfulRetrieval: r.last_successful_retrieval_at || null,
            currentSha256: r.current_sha256 || null,
            previousSha256: r.previous_sha256 || null,
            detectedVersion: r.detected_version || null,
            status: r.status || 'idle',
            errorMessage: r.error_message || null,
            createdAt: r.created_at || new Date().toISOString(),
            updatedAt: r.updated_at || new Date().toISOString(),
          }));
          memorySources = mapped;
          persistStores();
          return { sources: mapped, provider: 'supabase' };
        }
      }

      // Check if live document snapshots exist in policy_monitor_documents
      const docRes = await fetch(`${sb.url}/rest/v1/policy_monitor_documents?select=*&order=document_key.asc`, {
        method: 'GET',
        headers: supabaseAuthHeaders(sb.key, { Accept: 'application/json' }),
        signal: AbortSignal.timeout(8000),
      });
      if (docRes.ok) {
        const docRows = await docRes.json();
        if (Array.isArray(docRows) && docRows.length > 0) {
          const docMap = new Map<string, any>(docRows.map((d: any) => [d.document_key, d]));
          const updatedSources = memorySources.map((s) => {
            const liveDoc = docMap.get(s.id);
            if (liveDoc) {
              return {
                ...s,
                name: liveDoc.title || s.name,
                url: liveDoc.document_url || liveDoc.source_index_url || s.url,
                lastChecked: liveDoc.last_checked_at || s.lastChecked,
                lastSuccessfulRetrieval: liveDoc.last_successful_retrieval_at || s.lastSuccessfulRetrieval,
                currentSha256: liveDoc.current_sha256 || s.currentSha256,
                previousSha256: liveDoc.previous_sha256 || s.previousSha256,
                detectedVersion: liveDoc.detected_version || s.detectedVersion,
                status: liveDoc.has_pending_review ? 'changed' : (liveDoc.status === 'checked_unchanged' ? 'unchanged' : s.status),
                errorMessage: liveDoc.error_message || s.errorMessage,
                updatedAt: liveDoc.updated_at || s.updatedAt,
              };
            }
            return s;
          });
          memorySources = updatedSources;
          persistStores();
          return { sources: updatedSources, provider: 'supabase' };
        }
      }
    } catch (sbErr) {
      console.warn('[policyStore] Supabase sources query failed, using local source registry fallback:', (sbErr as Error)?.message || sbErr);
    }
  }

  return { sources: memorySources, provider: 'local_fallback' };
}

/**
 * Saves or updates a policy source in Supabase and local store.
 */
export async function savePolicySource(source: Partial<PolicySourceRecord> & { name: string; url: string }): Promise<PolicySourceRecord> {
  if (memorySources.length === 0) initPolicyStores();

  const id = source.id || `src-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  const record: PolicySourceRecord = {
    id,
    name: source.name,
    url: source.url,
    documentType: source.documentType || 'Configured statutory or policy document reference',
    category: source.category || 'guideline',
    sourceFormat: source.sourceFormat || (source.url.toLowerCase().endsWith('.pdf') ? 'pdf' : 'html'),
    checkIntervalHours: source.checkIntervalHours || 12,
    isActive: source.isActive ?? true,
    lastChecked: source.lastChecked || null,
    lastSuccessfulRetrieval: source.lastSuccessfulRetrieval || null,
    currentSha256: source.currentSha256 || null,
    previousSha256: source.previousSha256 || null,
    detectedVersion: source.detectedVersion || null,
    status: source.status || 'idle',
    errorMessage: source.errorMessage || null,
    createdAt: source.createdAt || now,
    updatedAt: now,
  };

  const sb = getSupabaseConfig();
  if (sb) {
    try {
      const response = await fetch(`${sb.url}/rest/v1/policy_sources`, {
        method: 'POST',
        headers: supabaseAuthHeaders(sb.key, {
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        }),
        body: JSON.stringify({
          id: record.id,
          name: record.name,
          url: record.url,
          document_type: record.documentType,
          category: record.category,
          source_format: record.sourceFormat,
          check_interval_hours: record.checkIntervalHours,
          is_active: record.isActive,
          current_sha256: record.currentSha256,
          previous_sha256: record.previousSha256,
          detected_version: record.detectedVersion,
          last_checked_at: record.lastChecked,
          last_successful_retrieval_at: record.lastSuccessfulRetrieval,
          status: record.status,
          error_message: record.errorMessage,
          created_at: record.createdAt,
          updated_at: now,
        }),
      });
      if (!response.ok) {
        if (response.status === 404) {
          console.warn('[policyStore] Supabase table policy_sources not found (404); saving policy source to local store.');
        } else {
          throw new Error(`Supabase policy source upsert returned HTTP ${response.status}.`);
        }
      }
    } catch (err) {
      console.warn('[policyStore] Supabase save policy_source failed, saved locally:', (err as Error)?.message || err);
    }
  }

  const existingIdx = memorySources.findIndex((s) => s.id === id);
  if (existingIdx >= 0) {
    memorySources[existingIdx] = { ...memorySources[existingIdx], ...record, updatedAt: now };
  } else {
    memorySources.push(record);
  }
  persistStores();
  return record;
}

/**
 * Deletes a policy source from Supabase and local store.
 */
export async function deletePolicySource(id: string): Promise<boolean> {
  if (memorySources.length === 0) initPolicyStores();

  const sb = getSupabaseConfig();
  if ((process.env.SUPABASE_URL || '').trim() && !sb) {
    throw new Error('Supabase is configured but its server-side key is missing or invalid; source deletion was not performed.');
  }
  if (sb) {
    const response = await fetch(`${sb.url}/rest/v1/policy_sources?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: supabaseAuthHeaders(sb.key),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`Supabase policy source delete returned HTTP ${response.status}.`);
  }

  const before = memorySources.length;
  memorySources = memorySources.filter((source) => source.id !== id);
  const deleted = memorySources.length < before;
  if (deleted) persistStores();
  return deleted;
}

/**
 * Retrieves the currently active approved rule package for verified compliance rules and policy display. Corporate tax comparison schedules are centralized separately.
 * If Supabase has an active package, it loads it; otherwise uses the local approved package.
 */
export async function getActiveApprovedRulePackage(): Promise<ApprovedRulePackage> {
  if (memoryPackages.length === 0) initPolicyStores();

  const sb = getSupabaseConfig();
  if (sb) {
    try {
      const res = await fetch(`${sb.url}/rest/v1/policy_approved_packages?is_active=eq.true&status=eq.approved&order=approved_at.desc&limit=100`, {
        method: 'GET',
        headers: supabaseAuthHeaders(sb.key, { Accept: 'application/json' }),
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const rows = await res.json();
        const verifiedRows = Array.isArray(rows)
          ? rows.filter((row: any) => row?.safety_verification?.passed === true && matchesReferenceTaxSchedule(row?.tax_brackets))
          : [];
        if (verifiedRows.length > 0) {
          const r = verifiedRows[0];
          const activePackage: ApprovedRulePackage = {
            id: r.id,
            packageName: r.package_name,
            version: r.version,
            sourceId: r.source_id,
            sourceName: r.source_name,
            sourceUrl: r.source_url,
            sourceSha256: r.source_sha256,
            status: r.status,
            isActive: r.is_active,
            taxBrackets: r.tax_brackets,
            exemptionThreshold: Number(r.exemption_threshold) || 3000000,
            minWageStandard: Number(r.min_wage_standard) || 1700,
            sstRate: Number(r.sst_rate) || 0.08,
            rules: r.rules || [],
            safetyVerification: r.safety_verification || {},
            extractedAt: r.extracted_at,
            validatedAt: r.validated_at,
            approvedAt: r.approved_at,
            approvedBy: r.approved_by,
            approvalNotes: r.approval_notes,
            changeSummary: r.change_summary,
          };
          supabaseActivePackageCache = activePackage;
          return activePackage;
        }
      }
    } catch (err) {
      console.warn('[policyStore] Supabase active package query error, falling back to local package:', (err as Error)?.message || err);
    }
  }

  // Fail closed when Supabase is configured but has no verified active package:
  // never silently promote a local package into the authoritative live store.
  if (sb) {
    supabaseActivePackageCache = SEED_LOCAL_DEMO_PACKAGE;
    return SEED_LOCAL_DEMO_PACKAGE;
  }

  // Local approved packages are only considered when Supabase is not configured.
  const active = memoryPackages.find((p) =>
    p.isActive
    && p.status === 'approved'
    && p.safetyVerification?.passed === true
    && matchesReferenceTaxSchedule(p.taxBrackets)
  );
  const fallback = active || SEED_LOCAL_DEMO_PACKAGE;
  supabaseActivePackageCache = fallback;
  return fallback;
}

/**
 * Synchronous accessor for the currently active approved package (cached in memory).
 * When Supabase is configured, this accessor fails closed until an authoritative
 * verified package has been loaded. Corporate tax comparisons use the central schedules.
 */
export function getActiveApprovedPackageSync(): ApprovedRulePackage {
  if (memoryPackages.length === 0) initPolicyStores();
  if (supabaseActivePackageCache !== undefined) return supabaseActivePackageCache || SEED_LOCAL_DEMO_PACKAGE;

  if (getSupabaseConfig()) {
    // An async Supabase fetch has not loaded yet; do not substitute local demo state.
    return SEED_LOCAL_DEMO_PACKAGE;
  }

  const active = memoryPackages.find((p) =>
    p.isActive
    && p.status === 'approved'
    && p.safetyVerification?.passed === true
    && matchesReferenceTaxSchedule(p.taxBrackets)
  );
  const fallback = active || SEED_LOCAL_DEMO_PACKAGE;
  supabaseActivePackageCache = fallback;
  return fallback;
}

/**
 * Returns all rule packages (staged candidates, validated drafts, and approved active packages).
 */
export async function getAllRulePackages(): Promise<ApprovedRulePackage[]> {
  if (memoryPackages.length === 0) initPolicyStores();
  const sb = getSupabaseConfig();
  if (sb) {
    try {
      const response = await fetch(`${sb.url}/rest/v1/policy_approved_packages?select=*&order=extracted_at.desc`, {
        method: 'GET',
        headers: supabaseAuthHeaders(sb.key, { Accept: 'application/json' }),
        signal: AbortSignal.timeout(8000),
      });
      if (response.ok) {
        const rows = await response.json();
        if (Array.isArray(rows) && rows.length > 0) {
          const mapped: ApprovedRulePackage[] = rows.map((r: any) => {
            const taxBrackets = r.tax_brackets || [];
            const taxScheduleSupported = matchesReferenceTaxSchedule(taxBrackets);
            const safetyPassed = r?.safety_verification?.passed === true;
            const isActive = Boolean(r.is_active)
              && r.status === 'approved'
              && safetyPassed
              && taxScheduleSupported;
            return {
              id: r.id,
              packageName: r.package_name,
              version: r.version,
              sourceId: r.source_id,
              sourceName: r.source_name,
              sourceUrl: r.source_url,
              sourceSha256: r.source_sha256,
              status: r.status,
              isActive,
              taxBrackets,
              exemptionThreshold: Number(r.exemption_threshold) || 3000000,
              minWageStandard: Number(r.min_wage_standard) || 1700,
              sstRate: Number(r.sst_rate) || 0.08,
              rules: r.rules || [],
              safetyVerification: r.safety_verification || {},
              extractedAt: r.extracted_at,
              validatedAt: r.validated_at,
              approvedAt: r.approved_at,
              approvedBy: r.approved_by,
              approvalNotes: Boolean(r.is_active) && !isActive
                ? `${r.approval_notes || ''} Runtime guard: this package is not treated as active unless it is approved, has passed safety verification, and matches the centrally configured tax reference schedule.`.trim()
                : r.approval_notes,
              changeSummary: r.change_summary,
            };
          });
          if (mapped.length > 0) {
            memoryPackages = mapped;
            persistStores();
          }
          return mapped;
        }
      }
    } catch (err) {
      console.warn('[policyStore] Supabase rule packages fetch error, falling back to local packages:', (err as Error)?.message || err);
    }
  }

  // Sanitize older local stores in memory. If Supabase is configured but could
  // not provide an authoritative list, local copies must not be presented as active.
  return memoryPackages.map((pkg) => {
    const meetsActivationRequirements = !sb
      && pkg.status === 'approved'
      && pkg.safetyVerification?.passed === true
      && matchesReferenceTaxSchedule(pkg.taxBrackets);
    if (pkg.isActive && !meetsActivationRequirements) {
      return {
        ...pkg,
        isActive: false,
        approvalNotes: `${pkg.approvalNotes || ''} Runtime guard: this package is not treated as active unless the authoritative store is available, it is approved, safety verification has passed, and it matches the centrally configured tax reference schedule.`.trim(),
      };
    }
    return pkg;
  });
}

/**
 * Saves a candidate or validated rule package into storage.
 */
export async function saveRulePackage(pkg: ApprovedRulePackage, strict = false): Promise<void> {
  if (memoryPackages.length === 0) initPolicyStores();

  const sb = getSupabaseConfig();
  if (sb) {
    try {
      const response = await fetch(`${sb.url}/rest/v1/policy_approved_packages`, {
        method: 'POST',
        headers: supabaseAuthHeaders(sb.key, {
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        }),
        body: JSON.stringify({
          id: pkg.id,
          package_name: pkg.packageName,
          version: pkg.version,
          source_id: pkg.sourceId,
          source_name: pkg.sourceName,
          source_url: pkg.sourceUrl,
          source_sha256: pkg.sourceSha256,
          status: pkg.status,
          is_active: pkg.isActive,
          tax_brackets: pkg.taxBrackets,
          exemption_threshold: pkg.exemptionThreshold,
          min_wage_standard: pkg.minWageStandard,
          sst_rate: pkg.sstRate,
          rules: pkg.rules,
          safety_verification: pkg.safetyVerification,
          extracted_at: pkg.extractedAt,
          validated_at: pkg.validatedAt,
          approved_at: pkg.approvedAt,
          approved_by: pkg.approvedBy,
          approval_notes: pkg.approvalNotes,
          change_summary: pkg.changeSummary,
        }),
      });
      if (!response.ok) {
        if (response.status === 404) {
          console.warn('[policyStore] Supabase table policy_approved_packages not found (404); saving candidate package to local store.');
        } else {
          throw new Error(`Supabase rule package upsert failed with HTTP ${response.status}.`);
        }
      }
    } catch (err) {
      if (strict && !(err as Error)?.message?.includes('404')) throw err;
      console.warn('[policyStore] Supabase save rule package failed, saved locally:', (err as Error)?.message || err);
    }
  }

  const idx = memoryPackages.findIndex((p) => p.id === pkg.id);
  if (idx >= 0) {
    memoryPackages[idx] = pkg;
  } else {
    memoryPackages.unshift(pkg);
  }
  persistStores();
}

/**
 * Approves and activates a verified rule package.
 * Enforces that automated safety verification has passed!
 */
export async function approveAndActivatePackage(
  packageId: string,
  approvedBy: string,
  notes?: string
): Promise<{ success: boolean; package: ApprovedRulePackage; message: string }> {
  if (memoryPackages.length === 0) initPolicyStores();

  const pkg = memoryPackages.find((p) => p.id === packageId);
  if (!pkg) {
    throw new Error(`Rule package ${packageId} not found.`);
  }

  // Quarantine the legacy MySST-homepage candidate: this source is not a versioned e-Invoice rule document.
  if (pkg.sourceId === 'lhdn-sst-reference') {
    throw new Error('Cannot activate this candidate: it was generated from the generic MySST homepage, not a versioned, source-specific policy document. Replace it with an explicitly reviewed source and rules before approval.');
  }
  // Unknown/unidentified versions must not be activated as operational rules.
  if (!pkg.version || pkg.version.toLowerCase() === 'unknown' || pkg.version.toLowerCase().includes('candidate')) {
    throw new Error('Cannot activate this candidate: the official document version was not identified. Verify the source document, publication/version, effective date, and each rule before creating an approvable package.');
  }
  const duplicatePendingSnapshot = memoryPackages.some((other) =>
    other.id !== pkg.id
    && Boolean(pkg.sourceSha256)
    && other.sourceSha256 === pkg.sourceSha256
    && (other.status === 'pending_validation' || other.status === 'validated')
  );
  if (duplicatePendingSnapshot) {
    throw new Error('Cannot activate this candidate while another pending/validated package has the same SHA-256 content fingerprint. Reject or resolve the duplicate record first.');
  }

  // Tax schedule changes cannot be activated solely by passing structural safety checks.
  // The current release has one central reference schedule; new brackets need a reviewed
  // legal source, year of assessment and effective date plus an explicit release update.
  if (!matchesReferenceTaxSchedule(pkg.taxBrackets)) {
    throw new Error(
      'Cannot activate this package for tax rules: its tax brackets differ from the centrally configured reference schedule. Keep the rates as a scenario until final legislation, year of assessment and effective date are verified, then update the central tax schedule deliberately.'
    );
  }

  // Safety check enforcement
  if (!pkg.safetyVerification || !pkg.safetyVerification.passed) {
    throw new Error(
      `Cannot approve rule package: 7-Point Safety Verification Suite has not passed (Score: ${pkg.safetyVerification?.score || 0}%). Issues: ${(pkg.safetyVerification?.issues || []).join('; ')}`
    );
  }

  const now = new Date().toISOString();
  const sb = getSupabaseConfig();
  if (sb) {
    const response = await fetch(`${sb.url}/rest/v1/rpc/approve_rule_package`, {
      method: 'POST',
      headers: supabaseAuthHeaders(sb.key, {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      }),
      body: JSON.stringify({
        p_package_id: packageId,
        p_approved_by: approvedBy || 'Authorized Compliance Officer',
        p_notes: notes || 'Verified compliant with statutory guidelines.',
      }),
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) {
      const responseText = (await response.text()).slice(0, 500);
      throw new Error(`Supabase could not atomically approve the rule package (HTTP ${response.status}): ${responseText}`);
    }
  }

  // Mirror successful persisted state in the process cache. Without Supabase configured,
  // this is the expected local-demo behavior.
  memoryPackages.forEach((p) => {
    if (p.id !== packageId && p.isActive) {
      p.isActive = false;
      if (p.status === 'approved') p.status = 'archived';
    }
  });
  pkg.isActive = true;
  pkg.status = 'approved';
  pkg.approvedAt = now;
  pkg.approvedBy = approvedBy || 'Authorized Compliance Officer';
  pkg.approvalNotes = notes || 'Verified compliant with statutory guidelines.';
  if (sb) supabaseActivePackageCache = pkg;
  persistStores();

  return {
    success: true,
    package: pkg,
    message: `Rule package "${pkg.packageName}" (${pkg.version}) successfully approved and activated for verified policy evaluation. Tax comparisons remain on the centrally configured reference and announcement schedules.`,
  };
}

/**
 * Resolve a real PDF link from an official listing page. This avoids treating an HTML
 * index page as if it were a PDF, which previously caused bundled demo fixtures to be
 * hashed as if they were a live statutory source.
 */
function decodeHtmlAttribute(value: string): string {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&#x2f;/gi, '/')
    .replace(/&#47;/gi, '/')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function resolvePdfLinkFromListing(html: string, listingUrl: string, sourceId: string): string {
  const wanted = sourceId.includes('specific') ? 'specific' : sourceId.includes('general') ? 'general' : '';
  const links: Array<{ url: string; label: string; score: number }> = [];
  const anchorRegex = /<a\b([^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*)>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchorRegex.exec(html)) !== null) {
    const rawHref = match[2] || match[3] || match[4] || '';
    const label = (match[5] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!rawHref || /^(?:#|mailto:|javascript:)/i.test(rawHref)) continue;
    let resolved: URL;
    try { resolved = new URL(decodeHtmlAttribute(rawHref), listingUrl); } catch { continue; }
    if (!/^https?:$/.test(resolved.protocol)) continue;
    const haystack = `${resolved.pathname} ${resolved.search} ${label}`.toLowerCase();
    const explicitPdfPath = /\.pdf(?:$|[?#])/i.test(`${resolved.pathname}${resolved.search}`);
    const appearsPdf = explicitPdfPath || /pdf|download|media|document/.test(haystack);
    if (!appearsPdf) continue;
    const specificTerms = /specific|spesifik|khusus/.test(haystack);
    const generalTerms = /general|umum/.test(haystack);
    // The official listing's general PDF filename may omit the English word "general".
    // Select it as the PDF guideline candidate unless it is clearly the specific guideline.
    if (wanted === 'specific' && !specificTerms) continue;
    if (wanted === 'general' && specificTerms) continue;
    if (/sdk|technical|sample|template|example/.test(haystack)) continue;
    let score = 0;
    if (explicitPdfPath) score += 8;
    if (/guideline|garis[-\s]?panduan|panduan/.test(haystack)) score += 5;
    if (specificTerms || generalTerms) score += 10;
    if (wanted === 'general' && !specificTerms) score += 2;
    if (/hasil\.gov\.my/.test(resolved.hostname)) score += 2;
    links.push({ url: resolved.toString(), label, score });
  }
  links.sort((a, b) => b.score - a.score);
  if (links.length === 0) {
    throw new Error(`Could not find a matching official ${wanted || ''} PDF link on the source listing page. No fixture was used for live monitoring.`);
  }
  return links[0].url;
}

function getPolicySupabaseConfig(): { url: string; key: string } | null {
  return getSupabaseConfig();
}

async function saveSnapshotToSupabase(args: {
  source: PolicySourceRecord;
  documentUrl: string;
  sha256: string;
  text: string;
  detectedVersion: string;
  pageCount?: number;
}, strict: boolean): Promise<void> {
  const sb = getPolicySupabaseConfig();
  if (!sb) {
    if (strict) throw new Error('Supabase is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY before running the scheduled monitor.');
    return;
  }
  try {
    const response = await fetch(`${sb.url}/rest/v1/rpc/record_policy_monitor_snapshot`, {
      method: 'POST',
      headers: supabaseAuthHeaders(sb.key, {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      }),
      body: JSON.stringify({
        p_doc: {
          id: args.source.id,
          title: args.source.name,
          source_name: /lhdn/i.test(args.source.name) ? 'LHDN / HASiL' : args.source.name,
          index_url: args.source.url,
          url: args.source.url,
          document_url: args.documentUrl,
          sha256: args.sha256,
          text: args.text,
          detected_version: args.detectedVersion,
          numpages: args.pageCount ?? null,
        },
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      const shortBody = (await response.text()).slice(0, 400);
      throw new Error(`Supabase snapshot RPC returned HTTP ${response.status}: ${shortBody}`);
    }
  } catch (err: any) {
    if (strict) throw err;
    console.warn('[policyStore] Could not save snapshot to Supabase:', err?.message || err);
  }
}

/** Ensure a fetched FAQ PDF still resolves to an official HASiL URL. */
function isOfficialHaslPdfUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.toLowerCase();
    return (parsed.protocol === 'https:' || parsed.protocol === 'http:')
      && (host === 'hasil.gov.my' || host.endsWith('.hasil.gov.my'))
      && /\.pdf(?:$|[?#])/i.test(pathname);
  } catch {
    return false;
  }
}

async function extractFaqPdf(link: { url: string; title: string }): Promise<{ url: string; title: string; version: string; pageCount?: number; text: string }> {
  const response = await fetch(link.url, {
    method: 'GET',
    headers: {
      'User-Agent': 'OrbyteHub-PolicyCrawler/3.0 (+official-source-monitoring)',
      Accept: 'application/pdf,*/*;q=0.5',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(18000),
  });
  if (!response.ok) throw new Error(`FAQ PDF "${link.title}" returned HTTP ${response.status}.`);
  const finalUrl = response.url || link.url;
  if (!isOfficialHaslPdfUrl(finalUrl)) throw new Error(`FAQ PDF "${link.title}" redirected outside the allowed official HASiL domain.`);
  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 1000 || (contentType.includes('text/html') && buffer.subarray(0, 32).toString('utf8').toLowerCase().includes('<!doctype html'))) {
    throw new Error(`FAQ source "${link.title}" did not return a valid PDF payload.`);
  }

  const parser = new PDFParse({ data: buffer });
  let text = '';
  let pageCount: number | undefined;
  try {
    const textObject = await parser.getText();
    text = typeof textObject === 'string' ? textObject : (textObject?.text || '');
    pageCount = (textObject as any)?.numpages || undefined;
  } finally {
    try { await (parser as any).destroy?.(); } catch { /* parser version compatibility */ }
  }
  if (text.trim().length < 100) throw new Error(`FAQ PDF "${link.title}" did not yield enough searchable text.`);
  const versionMatch = text.match(/(?:VERSI|VERSION|v)\s*([0-9]+(?:\.[0-9]+)+)/i);
  const version = versionMatch ? `v${versionMatch[1]}` : 'version not stated';
  return { url: finalUrl, title: link.title, version, pageCount, text: text.trim() };
}

/**
 * The official FAQ index is mostly download links rather than the complete FAQ answers.
 * Download and extract each linked official PDF so Q&A can retrieve actual FAQ content.
 * Repeating metadata on each passage keeps citations attached to the matching FAQ PDF.
 */
async function fetchOfficialFaqCorpus(html: string, listingUrl: string): Promise<{ text: string; pageCount?: number }> {
  const links = extractOfficialFaqPdfLinks(html, listingUrl);
  if (!links.length) throw new Error('The official FAQ index contains no allowed HASiL FAQ PDF links; refusing to save the index alone as a substantive FAQ corpus.');

  const documents: Array<Awaited<ReturnType<typeof extractFaqPdf>>> = [];
  const batchSize = 4;
  for (let start = 0; start < links.length; start += batchSize) {
    const batch = links.slice(start, start + batchSize);
    const results = await Promise.allSettled(batch.map((link) => extractFaqPdf(link)));
    for (const r of results) {
      if (r.status === 'fulfilled') {
        documents.push(r.value);
      } else {
        console.warn('[policyStore] FAQ PDF retrieval notice:', r.reason?.message || r.reason);
      }
    }
  }

  const chunks: string[] = [];
  for (const document of documents) {
    const paragraphs = document.text
      .replace(/\r/g, '')
      .split(/\n\s*\n+/)
      .map((paragraph) => paragraph.replace(/\n+/g, ' ').replace(/[\t ]+/g, ' ').trim())
      .filter((paragraph) => paragraph.length >= 20);
    const header = `[FAQ_TITLE: ${document.title}] [FAQ_SOURCE_URL: ${document.url}] [FAQ_VERSION: ${document.version}]`;
    let buffer = '';
    for (const paragraph of paragraphs) {
      const next = buffer ? `${buffer} ${paragraph}` : paragraph;
      if (next.length > 950 && buffer) {
        chunks.push(`${header} ${buffer}`);
        buffer = paragraph;
      } else if (paragraph.length > 1100) {
        if (buffer) chunks.push(`${header} ${buffer}`);
        buffer = '';
        for (let position = 0; position < paragraph.length; position += 950) {
          const segment = paragraph.slice(position, position + 950).trim();
          if (segment.length >= 20) chunks.push(`${header} ${segment}`);
        }
      } else {
        buffer = next;
      }
    }
    if (buffer.trim().length >= 20) chunks.push(`${header} ${buffer}`);
  }

  const corpus = chunks.join('\n\n');
  if (corpus.length < 1000 || documents.length === 0) throw new Error('The official FAQ PDFs did not yield enough searchable text.');
  return { text: corpus, pageCount: documents.reduce((sum, item) => sum + (item.pageCount || 0), 0) || undefined };
}

/**
 * Crawls a policy source URL, downloads & extracts PDF/Web text, computes SHA-256,
 * persists official PDF/HTML snapshots to Supabase, and stages (never auto-activates) candidate rules.
 *
 * `requireLiveSource` is used by the n8n scheduled endpoint: it forbids demo-fixture
 * fallback so monitoring cannot misreport synthetic text as a live official retrieval.
 */
export async function crawlAndExtractPolicySource(
  sourceId: string,
  options: { requireLiveSource?: boolean } = {},
): Promise<{
  success: boolean;
  source: PolicySourceRecord;
  changed: boolean;
  candidatePackage?: ApprovedRulePackage;
  message: string;
}> {
  if (memorySources.length === 0) initPolicyStores();

  const source = memorySources.find((s) => s.id === sourceId);
  if (!source) throw new Error(`Policy source "${sourceId}" not found in registry.`);

  const now = new Date().toISOString();
  source.lastChecked = now;
  source.status = 'checking';
  source.errorMessage = null;

  let extractedText = '';
  let pageCount: number | undefined;
  let retrievedDocumentUrl = source.url;
  let fetchedLive = false;
  const sourceIsPdf = source.sourceFormat === 'pdf' || /\.pdf(?:$|[?#])/i.test(source.url);

  try {
    const headers = {
      'User-Agent': 'OrbyteHub-PolicyCrawler/3.0 (+official-source-monitoring)',
      Accept: sourceIsPdf ? 'application/pdf,text/html;q=0.8,*/*;q=0.5' : 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
    };

    if (sourceIsPdf) {
      if (/\.pdf(?:$|[?#])/i.test(source.url)) {
        retrievedDocumentUrl = source.url;
      } else {
        const listingResponse = await fetch(source.url, {
          method: 'GET',
          headers: { ...headers, Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5' },
          redirect: 'follow',
          signal: AbortSignal.timeout(15000),
        });
        if (!listingResponse.ok) throw new Error(`Official source listing returned HTTP ${listingResponse.status}.`);
        const html = await listingResponse.text();
        retrievedDocumentUrl = resolvePdfLinkFromListing(html, source.url, sourceId);
      }
      const pdfResponse = await fetch(retrievedDocumentUrl, {
        method: 'GET',
        headers: { ...headers, Accept: 'application/pdf,*/*;q=0.5' },
        redirect: 'follow',
        signal: AbortSignal.timeout(20000),
      });
      if (!pdfResponse.ok) throw new Error(`Official PDF returned HTTP ${pdfResponse.status}.`);
      const contentType = (pdfResponse.headers.get('content-type') || '').toLowerCase();
      const buffer = Buffer.from(await pdfResponse.arrayBuffer());
      if (buffer.length < 1000 || (contentType.includes('text/html') && buffer.subarray(0, 32).toString('utf8').toLowerCase().includes('<!doctype html'))) {
        throw new Error('The official document link did not return a valid PDF payload.');
      }
      const parser = new PDFParse({ data: buffer });
      try {
        const textObj = await parser.getText();
        extractedText = typeof textObj === 'string' ? textObj : (textObj?.text || '');
        pageCount = (textObj as any)?.numpages || undefined;
      } finally {
        try { await (parser as any).destroy?.(); } catch { /* parser version compatibility */ }
      }
      if (extractedText.trim().length < 100) throw new Error('The downloaded PDF did not yield enough searchable text to verify a snapshot.');
      fetchedLive = true;
    } else {
      const response = await fetch(source.url, {
        method: 'GET', headers,
        redirect: 'follow',
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error(`Official source returned HTTP ${response.status}.`);
      const html = await response.text();
      extractedText = html
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<(script|style|noscript|svg|nav|header|footer|aside|form)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
        .replace(/<\/(p|div|section|article|li|h[1-6]|br|tr|dt|dd)\s*>/gi, '\n\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;|&#160;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&#x27;/gi, "'")
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
        .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(parseInt(code, 16)))
        .replace(/[\t ]+/g, ' ')
        .replace(/ *\n+ */g, '\n\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      if (source.category === 'faq') {
        // Do not treat the FAQ index itself as sufficient content: retrieve its official PDFs.
        const faqCorpus = await fetchOfficialFaqCorpus(html, source.url);
        extractedText = faqCorpus.text;
        pageCount = faqCorpus.pageCount;
      }
      if (extractedText.length < 100) throw new Error('The official source returned insufficient text for monitoring.');
      fetchedLive = true;
    }
  } catch (liveErr: any) {
    if (options.requireLiveSource) {
      source.status = 'failed';
      source.errorMessage = `Live source retrieval failed: ${liveErr?.message || 'unknown retrieval error'}`;
      await savePolicySource(source);
      throw new Error(`Live source retrieval failed for ${sourceId}: ${liveErr?.message || 'unknown retrieval error'}`);
    }
    // Demo fixture fallback remains available for interactive local tests only.
    const allowFixtures = process.env.POLICY_ALLOW_FIXTURE_FALLBACK !== 'false' && process.env.NODE_ENV !== 'production';
    if (!allowFixtures) {
      source.status = 'failed';
      source.errorMessage = liveErr?.message || 'Live source retrieval failed.';
      await savePolicySource(source);
      throw liveErr;
    }
    if (sourceId === 'lhdn-specific-guideline' || sourceId.includes('specific')) {
      const fixturePath = path.resolve(process.cwd(), 'policies/LHDN-v4.9.json');
      if (fs.existsSync(fixturePath)) {
        extractedText = `DEMO FIXTURE — not live official content\nLHDN Specific Guideline fixture v4.9\n${fs.readFileSync(fixturePath, 'utf-8')}`;
        pageCount = 68;
      }
    } else if (sourceId === 'lhdn-general-guideline' || sourceId.includes('general')) {
      const fixturePath = path.resolve(process.cwd(), 'policies/LHDN-v4.8.json');
      if (fs.existsSync(fixturePath)) {
        extractedText = `DEMO FIXTURE — not live official content\nLHDN General Guideline fixture v4.8\n${fs.readFileSync(fixturePath, 'utf-8')}`;
        pageCount = 112;
      }
    } else {
      throw liveErr;
    }
    retrievedDocumentUrl = source.url;
    fetchedLive = false;
  }

  try {
    const sha256 = crypto.createHash('sha256').update(extractedText).digest('hex');
    const versionMatch = extractedText.match(/(?:VERSI|VERSION|v)\s*([0-9]+(?:\.[0-9]+)+)/i);
    const detectedVersion = versionMatch ? `v${versionMatch[1]}` : (source.detectedVersion || 'unknown');
    const previousSha = source.currentSha256;
    const isChanged = fetchedLive && Boolean(previousSha) && previousSha !== sha256;
    // Official FAQs are searchable source evidence, but are not converted into operational rule packages automatically.
    // The generic MySST portal is an SST information homepage, not a versioned e-Invoice/tax rule document.
    // Archive it for source monitoring/Q&A, but do not run the generic rule-package template against it.
    const needsCandidateReview = fetchedLive
      && source.category !== 'faq'
      && source.category !== 'sst'
      && source.id !== 'lhdn-sst-reference'
      && (!previousSha || isChanged);

    source.lastChecked = now;
    if (fetchedLive) source.lastSuccessfulRetrieval = now;
    source.detectedVersion = detectedVersion;
    source.status = !fetchedLive ? 'failed' : isChanged ? 'changed' : previousSha ? 'unchanged' : 'baseline_saved';
    source.errorMessage = fetchedLive ? null : 'DEMO FIXTURE ONLY — official source was not retrieved; no live baseline was changed.';

    let candidatePackage: ApprovedRulePackage | undefined;
    if (needsCandidateReview) {
      candidatePackage = parsePolicyTextToCandidatePackage(extractedText, {
        sourceId: source.id,
        sourceName: source.name,
        sourceUrl: source.url,
        detectedVersion,
      });
      await saveRulePackage(candidatePackage, Boolean(options.requireLiveSource || (process.env.SUPABASE_URL || '').trim()));
    }
    // Persist every live official source (PDF or HTML FAQ) to the durable text archive. A synthetic
    // fixture must never be presented as official evidence. Do not move the live baseline until
    // the archive RPC has succeeded.
    if (fetchedLive) {
      await saveSnapshotToSupabase({
        source, documentUrl: retrievedDocumentUrl, sha256, text: extractedText,
        detectedVersion, pageCount,
      }, Boolean(options.requireLiveSource || (process.env.SUPABASE_URL || '').trim()));
    }

    // Record only verified live content after successful durable snapshotting.
    // Demo fixtures and failed snapshot writes must never advance a real baseline.
    if (fetchedLive) {
      if (isChanged && previousSha) source.previousSha256 = previousSha;
      source.currentSha256 = sha256;
    }
    await savePolicySource(source);
    return {
      success: true,
      source,
      changed: isChanged,
      candidatePackage,
      message: fetchedLive
        ? (isChanged
          ? `Live official content retrieved (${extractedText.length} chars; SHA-256 ${sha256.slice(0, 16)}…). ${candidatePackage ? 'Candidate package staged for human review' : 'Source text archived for Q&A; no operational rule package was created'}. Rules were not auto-activated.`
          : previousSha
            ? `Live official content retrieved. SHA-256 matches the stored baseline (${sha256.slice(0, 16)}…).`
            : `First live official snapshot recorded (${extractedText.length} chars; SHA-256 ${sha256.slice(0, 16)}…). Change detection starts from the next successful run; ${candidatePackage ? 'a candidate package was staged for human review' : 'no operational rule package was created'}. No rules were activated.`)
        : `Demo fixture processed for local testing only. No official retrieval was verified and no live snapshot was stored.`,
    };
  } catch (err: any) {
    source.status = 'failed';
    source.errorMessage = err?.message || 'Failed to crawl and extract policy document.';
    await savePolicySource(source);
    throw err;
  }
}

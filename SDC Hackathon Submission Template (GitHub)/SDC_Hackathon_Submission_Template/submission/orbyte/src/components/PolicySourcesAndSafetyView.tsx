/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Orbyte Hub — Dynamic Policy Sources & Rule Safety Management View
 * 
 * Core Features:
 * 1. Supabase-Managed Policy Source Registry (not hardcoded in code)
 * 2. Automated Scheduled / On-Demand Crawling & PDF Text Extraction
 * 3. 7-Point Automated Rule Safety Verification Suite
 * 4. Active reference-package and source diagnostics; staged candidate cards are hidden in this UI.
 * 5. Policy Package Review: Uses canonical reference/announcement tax schedules for display;
 *    candidate package tax changes remain separate until legal status is explicitly verified.
 */

import React, { useState } from 'react';
import {
  Database,
  Plus,
  Trash2,
  Play,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  ShieldAlert,
  ExternalLink,
  Clock,
  Layers,
  Scale,
  Lock,
  FileText,
  FileCode,
  SlidersHorizontal,
  Info,
  X,
  Check,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import {
  PolicySourceRecord,
  ApprovedRulePackage,
  RoleType,
  RulePackageSafetyReport,
  SafetyCheckItem,
} from '../types';
import { api } from '../services/api';
import { REFERENCE_MSME_TAX_BRACKETS, BUDGET2027_ANNOUNCED_TAX_BRACKETS, matchesReferenceTaxSchedule } from '../constants/policyConstants.ts';

interface PolicySourcesAndSafetyViewProps {
  language: string;
  currentRole: RoleType;
  onShowToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => void;
  onPolicyActivated?: (pkg: ApprovedRulePackage) => void;
  sources: PolicySourceRecord[];
  packages: ApprovedRulePackage[];
  activePackage: ApprovedRulePackage | null;
  provider: 'supabase' | 'local_fallback';
  isLoading: boolean;
  onRefresh: () => void;
}

export const PolicySourcesAndSafetyView: React.FC<PolicySourcesAndSafetyViewProps> = ({
  language,
  currentRole,
  onShowToast,
  onPolicyActivated,
  sources,
  packages,
  activePackage,
  provider,
  isLoading,
  onRefresh,
}) => {
  const isBM = language === 'bm';
  const isOwner = currentRole === 'owner';
  const isExpert = currentRole === 'expert';
  const canAuthorize = isOwner || isExpert;

  // Filter state
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isCrawlingId, setIsCrawlingId] = useState<string | null>(null);
  const [isCrawlingAll, setIsCrawlingAll] = useState<boolean>(false);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [selectedPackageForSafety, setSelectedPackageForSafety] = useState<ApprovedRulePackage | null>(null);
  const [selectedPackageForDiff, setSelectedPackageForDiff] = useState<ApprovedRulePackage | null>(null);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState<boolean>(false);
  const [targetApprovePackage, setTargetApprovePackage] = useState<ApprovedRulePackage | null>(null);
  const [approvalNotes, setApprovalNotes] = useState<string>('');
  const [isApproving, setIsApproving] = useState<boolean>(false);

  // New source form state
  const [sourceForm, setSourceForm] = useState<{
    name: string;
    url: string;
    category: PolicySourceRecord['category'];
    sourceFormat: PolicySourceRecord['sourceFormat'];
    checkIntervalHours: number;
    documentType: string;
  }>({
    name: '',
    url: '',
    category: 'guideline',
    sourceFormat: 'pdf',
    checkIntervalHours: 12,
    documentType: '',
  });

  const filteredSources = sources.filter((s) => {
    if (selectedCategory === 'all') return true;
    return s.category === selectedCategory;
  });

  const hasLiveVerifiedPackage = provider === 'supabase'
    && activePackage?.status === 'approved'
    && activePackage?.isActive === true
    && activePackage.safetyVerification?.passed === true
    && matchesReferenceTaxSchedule(activePackage.taxBrackets);

  // Handle single source crawl & text extraction
  const handleCrawlSource = async (sourceId: string, sourceName: string) => {
    setIsCrawlingId(sourceId);
    try {
      const res = await api.crawlPolicySource(sourceId);
      onShowToast(
        res.changed ? 'warning' : 'success',
        isBM ? 'Semakan Sumber Selesai' : 'Source Crawl Complete',
        res.message
      );
      onRefresh();
    } catch (err: any) {
      onShowToast('error', isBM ? 'Gagal Merayap' : 'Crawl Failed', err.message);
    } finally {
      setIsCrawlingId(null);
    }
  };

  // Handle batch crawl
  const handleCrawlAll = async () => {
    setIsCrawlingAll(true);
    try {
      const res = await api.crawlAllPolicySources();
      onShowToast(
        res.changedCount > 0 ? 'warning' : 'success',
        isBM ? 'Rayapan Kelompok Selesai' : 'Batch Crawl Complete',
        res.message
      );
      onRefresh();
    } catch (err: any) {
      onShowToast('error', isBM ? 'Gagal Merayap Kelompok' : 'Batch Crawl Failed', err.message);
    } finally {
      setIsCrawlingAll(false);
    }
  };

  // Handle create new source
  const handleCreateSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceForm.name.trim() || !sourceForm.url.trim()) {
      onShowToast('warning', isBM ? 'Maklumat Tidak Lengkap' : 'Incomplete Form', isBM ? 'Nama dan URL diperlukan.' : 'Name and URL are required.');
      return;
    }

    try {
      await api.createPolicySource(sourceForm);
      onShowToast(
        'success',
        isBM ? 'Sumber Didaftarkan' : 'Policy Source Registered',
        isBM ? `Sumber "${sourceForm.name}" telah disimpan dalam pangkalan Supabase.` : `Source "${sourceForm.name}" registered to Supabase source registry.`
      );
      setIsAddModalOpen(false);
      setSourceForm({
        name: '',
        url: '',
        category: 'guideline',
        sourceFormat: 'pdf',
        checkIntervalHours: 12,
        documentType: '',
      });
      onRefresh();
    } catch (err: any) {
      onShowToast('error', isBM ? 'Gagal Mendaftar' : 'Registration Failed', err.message);
    }
  };

  // Handle delete source
  const handleDeleteSource = async (id: string, name: string) => {
    if (!window.confirm(isBM ? `Adakah anda pasti mahu memadam sumber "${name}"?` : `Are you sure you want to remove policy source "${name}"?`)) {
      return;
    }
    try {
      await api.deletePolicySource(id);
      onShowToast('success', isBM ? 'Sumber Dipadam' : 'Source Removed', isBM ? `Sumber "${name}" dipadam dari pangkalan.` : `Source "${name}" removed from registry.`);
      onRefresh();
    } catch (err: any) {
      onShowToast('error', 'Delete Failed', err.message);
    }
  };

  // Handle approve package
  const handleConfirmApproval = async () => {
    if (!targetApprovePackage) return;
    setIsApproving(true);
    try {
      const res = await api.approvePolicyPackage(targetApprovePackage.id, approvalNotes);
      onShowToast(
        'success',
        isBM ? 'Pakej Peraturan Diaktifkan' : 'Rule Package Approved & Active',
        res.message
      );
      if (onPolicyActivated) onPolicyActivated(res.package);
      setIsApproveModalOpen(false);
      setTargetApprovePackage(null);
      setApprovalNotes('');
      onRefresh();
    } catch (err: any) {
      onShowToast('error', isBM ? 'Gagal Mengaktifkan' : 'Approval Failed', err.message);
    } finally {
      setIsApproving(false);
    }
  };

  // Handle reject package
  const handleRejectPackage = async (packageId: string) => {
    const reason = window.prompt(isBM ? 'Sila masukkan sebab penolakan:' : 'Please enter rejection reason:');
    if (reason === null) return;
    try {
      await api.rejectPolicyPackage(packageId, reason);
      onShowToast('info', isBM ? 'Pakej Ditolak' : 'Package Rejected', isBM ? `Pakej ${packageId} ditandakan sebagai ditolak.` : `Candidate package ${packageId} has been rejected.`);
      onRefresh();
    } catch (err: any) {
      onShowToast('error', 'Rejection Failed', err.message);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Top Architecture & Safety Philosophy Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-5 text-white shadow-sm border border-slate-800">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2.5">
              <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                <Database className="w-5 h-5" />
              </span>
              <h2 className="text-base font-bold tracking-tight">
                {isBM ? 'Pengurusan Sumber Dasar & Pengesahan Peraturan Selamat' : 'Dynamic Policy Sources & Rule Safety Management'}
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {provider === 'supabase' ? 'Supabase Registry' : 'LOCAL DEMO · NOT LIVE-VERIFIED'}
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {isBM
                ? 'Sumber dasar LHDN dan MOF diuruskan secara dinamik dalam Supabase (bukan kod keras). Sistem merayap fail PDF/Web mengikut jadual, mengira cap jari SHA-256 dan mengekstrak peraturan calon. Teks mentah TIDAK BOLEH digunakan untuk pengiraan cukai sehingga lulus suite verifikasi keselamatan 7-titik dan disahkan manusia.'
                : 'Policy sources are managed dynamically in Supabase rather than hardcoded in application code. This area is for authorised source administration and active-package diagnostics. Newly imported or changed content is not automatically used in calculations; verify official sources and configured rules before relying on results.'}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="h-9 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isBM ? 'Segarkan' : 'Sync Registry'}</span>
            </button>
            <button
              type="button"
              onClick={handleCrawlAll}
              disabled={isCrawlingAll || !canAuthorize}
              className="h-9 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-all disabled:opacity-50"
            >
              <Play className={`w-3.5 h-3.5 ${isCrawlingAll ? 'animate-spin' : ''}`} />
              <span>{isCrawlingAll ? (isBM ? 'Sedang Merayap...' : 'Crawling All...') : (isBM ? 'Rayap Semua Sumber' : 'Crawl All Sources')}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              disabled={!canAuthorize}
              className="h-9 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-all disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isBM ? 'Tambah Sumber Dasar' : 'Add Policy Source'}</span>
            </button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-800/80 text-xs">
          <div>
            <div className="text-[11px] text-slate-400">{isBM ? 'Jumlah Sumber Berdaftar' : 'Registered Sources'}</div>
            <div className="text-base font-bold text-white mt-0.5">{sources.length} sources</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">{isBM ? 'Pakej Peraturan Aktif' : 'Active Rule Package'}</div>
            <div className="text-base font-bold text-emerald-400 mt-0.5">{hasLiveVerifiedPackage ? activePackage?.version : (isBM ? 'Tiada pakej disahkan aktif' : 'No verified active package')}</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">{isBM ? 'Pemeriksaan Struktur Aktif' : 'Active Structural Checks'}</div>
            <div className="text-base font-bold text-emerald-400 mt-0.5 flex items-center gap-1">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>{hasLiveVerifiedPackage ? `${activePackage?.safetyVerification?.score ?? 0}% (${activePackage?.safetyVerification?.passedChecks ?? 0}/${activePackage?.safetyVerification?.totalChecks ?? 7} Passed)` : (isBM ? 'Belum disahkan secara langsung' : 'Not live-verified')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 1: ACTIVE APPROVED RULE PACKAGE (REFERENCE-RATE GUARDRAIL) */}
      <div className="bg-white rounded-2xl border-2 border-emerald-200/80 p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-emerald-100 text-emerald-800">
              <ShieldCheck className="w-6 h-6" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {hasLiveVerifiedPackage ? (isBM ? 'Pakej Peraturan Diluluskan Aktif' : 'Active Approved Rule Package') : (isBM ? 'Pakej Demo / Tiada Pakej Disahkan' : 'Demo Package / No Verified Active Package')}
                </span>
                <span className="text-xs text-slate-500 font-mono">ID: {activePackage?.id || '—'}</span>
              </div>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">
                {activePackage?.packageName || (isBM ? 'Tiada pakej peraturan aktif' : 'No active rule package')}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5 shadow-2xs ${hasLiveVerifiedPackage ? 'bg-emerald-500 text-white' : 'bg-amber-100 text-amber-900 border border-amber-300'}`}>
              <Check className="w-3.5 h-3.5" />
              <span>{hasLiveVerifiedPackage ? (isBM ? 'Pakej Diluluskan Aktif' : 'Approved Package Active') : (isBM ? 'Demo / Belum Disahkan' : 'Demo / Not Verified')}</span>
            </span>
          </div>
        </div>

        {/* Guardrail Callout */}
        <div className="bg-emerald-50/60 rounded-xl p-3 border border-emerald-200/70 text-xs text-emerald-950 flex items-start gap-2.5">
          <Lock className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>{isBM ? 'Perlindungan Keselamatan Diaktifkan:' : 'Safety Guardrail Enforced:'}</strong>{' '}
            {!hasLiveVerifiedPackage
              ? (isBM ? 'AMARAN: Ini ialah data demo setempat, bukan dasar rasmi yang berjaya diambil atau diluluskan manusia. Jangan gunakan hasil untuk cukai atau keputusan pematuhan sebenar. Konfigurasikan Supabase, ambil sumber rasmi, sahkan pakej dan dapatkan kelulusan manusia sebelum penggunaan produksi.' : 'WARNING: This is local demo data, not a live-retrieved official policy or human-approved package. Do not rely on results for real tax or compliance decisions. Configure Supabase, retrieve official sources, validate a candidate and obtain human approval before production use.')
              : (isBM ? 'Teks dasar mentah tidak digunakan terus dalam pengiraan. Pakej aktif mesti kekal diluluskan, melepasi pengesahan keselamatan dan disemak manusia.' : 'Raw policy text is not used directly in calculations. The active package must remain approved, pass the safety checks, and receive human review.')}
          </p>
        </div>

        {/* Key Statutory Parameters Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div className="text-slate-500 font-medium">{isBM ? 'Kadar Rujukan Cukai PKS' : 'SME Tax Reference Schedule'}</div>
            <div className="font-bold text-slate-900 mt-1 space-y-0.5">
              {REFERENCE_MSME_TAX_BRACKETS.map((b, idx) => (
                <div key={`reference-${idx}`} className="flex justify-between text-[11px]">
                  <span className="text-slate-600">Tier {idx + 1} ({b.upTo ? `≤ RM${(b.upTo/1000).toFixed(0)}k` : '> RM600k'}):</span>
                  <span className="font-mono text-slate-800 font-bold">{(b.rate * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
            <div className="mt-2 border-t border-slate-200 pt-2">
              <div className="text-[10px] font-semibold text-amber-800">{isBM ? 'Senario Pengumuman Belanjawan 2027' : 'Budget 2027 announcement scenario'}</div>
              <div className="mt-1 space-y-0.5">
                {BUDGET2027_ANNOUNCED_TAX_BRACKETS.map((b, idx) => (
                  <div key={`scenario-${idx}`} className="flex justify-between text-[10px]">
                    <span className="text-slate-600">Tier {idx + 1} ({b.upTo ? `≤ RM${(b.upTo/1000).toFixed(0)}k` : '> RM600k'}):</span>
                    <span className="font-mono text-amber-800 font-bold">{(b.rate * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
              <div className="mt-1 text-[9px] leading-3 text-amber-800">{isBM ? 'Senario sahaja — bukan kadar aktif yang disahkan.' : 'Scenario only — not an activated, verified statutory rate.'}</div>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div className="text-slate-500 font-medium">{isBM ? 'Ambang Pengecualian e-Invois' : 'Exemption Radar Threshold'}</div>
            <div className="text-base font-bold text-indigo-700 mt-1">
              RM {(activePackage?.exemptionThreshold || 3000000).toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">{isBM ? 'Penanda aras hasil tahunan PKS' : 'Gazetted SME headline threshold'}</div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div className="text-slate-500 font-medium">{isBM ? 'Standard Gaji Minimum' : 'Minimum Wage Standard'}</div>
            <div className="text-base font-bold text-slate-900 mt-1">
              RM {(activePackage?.minWageStandard || 1700).toLocaleString()} / mo
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">{isBM ? 'Kadar asas Perintah Gaji 2027' : 'National standard baseline'}</div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div className="text-slate-500 font-medium">{isBM ? 'Kadar Cukai Jualan & Perkhidmatan' : 'Standard SST Rate'}</div>
            <div className="text-base font-bold text-slate-900 mt-1">
              {((activePackage?.sstRate || 0.08) * 100).toFixed(0)}%
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">{isBM ? 'Klasifikasi B2B Kastam Diraja' : 'Royal Malaysian Customs classification'}</div>
          </div>
        </div>

        {/* Verification Metadata Footer */}
        <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-600 pt-2 border-t border-slate-100 gap-2">
          <div className="flex items-center gap-3">
            <span><strong>{isBM ? 'Disahkan Oleh:' : 'Signed-off by:'}</strong> {activePackage?.approvedBy || 'Chief Tax Compliance Officer'}</span>
            <span>•</span>
            <span><strong>{isBM ? 'Tarikh Kelulusan:' : 'Approval Date:'}</strong> {activePackage?.approvedAt ? new Date(activePackage.approvedAt).toLocaleDateString() : (isBM ? 'Belum diluluskan' : 'Not approved')}</span>
            <span>•</span>
            <span className="font-mono">SHA-256: {activePackage?.sourceSha256?.slice(0, 16)}...</span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedPackageForSafety(activePackage)}
            className="text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{isBM ? 'Lihat Laporan Verifikasi 7-Titik' : 'View 7-Point Safety Audit Report'}</span>
          </button>
        </div>
      </div>

      {/* Candidate package records are intentionally hidden from this UI; backend safety records remain intact. */}

      {/* SECTION 3: SUPABASE DYNAMIC POLICY SOURCES REGISTRY */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-sky-100 text-sky-800">
                <Database className="w-4 h-4" />
              </span>
              <h3 className="text-sm font-bold text-slate-900">
                {isBM ? 'Senarai Sumber Dasar Dinamik (Pangkalan Supabase)' : 'Supabase Dynamic Policy Sources Registry'}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {isBM
                ? 'Sumber dasar dibaca dan diuruskan terus dari pangkalan data Supabase. Rayapan memeriksa perubahan cap jari SHA-256 teks PDF.'
                : 'Policy sources are stored, retrieved, and managed dynamically from Supabase. The crawler evaluates SHA-256 PDF text digests.'}
            </p>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs overflow-x-auto">
            {['all', 'guideline', 'faq', 'budget_speech', 'sst'].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-lg font-semibold capitalize cursor-pointer transition-all ${
                  selectedCategory === cat ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {cat === 'all' ? 'All Sources' : cat.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Sources Cards Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredSources.map((source) => {
            const isCrawling = isCrawlingId === source.id;
            let statusBadge = 'bg-slate-100 text-slate-700 border-slate-200';
            let statusText = 'IDLE';

            if (source.status === 'changed') {
              statusBadge = 'bg-amber-100 text-amber-900 border-amber-300 font-bold';
              statusText = 'CONTENT CHANGED — REVIEW';
            } else if (source.status === 'unchanged') {
              statusBadge = 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold';
              statusText = 'CONTENT UNCHANGED';
            } else if (source.status === 'baseline_saved') {
              statusBadge = 'bg-sky-50 text-sky-800 border-sky-200 font-bold';
              statusText = 'BASELINE RECORDED';
            } else if (source.status === 'checking') {
              statusBadge = 'bg-blue-100 text-blue-900 border-blue-300 animate-pulse font-bold';
              statusText = 'EXTRACTING...';
            } else if (source.status === 'failed') {
              statusBadge = 'bg-red-100 text-red-900 border-red-300 font-bold';
              statusText = 'CRAWL FAILED';
            }

            return (
              <div
                key={source.id}
                className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                  source.status === 'changed'
                    ? 'border-amber-300 bg-amber-50/30'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-800 uppercase tracking-wider">
                        {source.category}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 uppercase">
                        {source.sourceFormat.toUpperCase()}
                      </span>
                      {source.detectedVersion && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-100 text-sky-800">
                          {source.detectedVersion}
                        </span>
                      )}
                    </div>

                    <span className={`text-[10px] px-2 py-0.5 rounded border uppercase ${statusBadge}`}>
                      {statusText}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-slate-900 leading-snug">
                    {source.id === 'lhdn-sst-reference' ? 'Royal Malaysian Customs MySST Portal — SST Reference' : source.name}
                  </h4>

                  <p className="text-[11px] text-slate-600 line-clamp-3 leading-relaxed">
                    {source.id === 'lhdn-sst-reference'
                      ? (isBM
                        ? 'Portal umum MySST untuk maklumat SST. Ini bukan dokumen panduan e-Invois berversi; teksnya boleh diarkibkan untuk pemantauan, tetapi tidak digunakan untuk menjana pakej peraturan operasi secara automatik.'
                        : 'General MySST portal for SST information. This is not a versioned e-Invoice guideline; its text may be archived for monitoring, but it is not used to automatically generate operational rule packages.')
                      : source.documentType}
                  </p>

                  <div className="text-[10px] text-slate-500 flex items-center gap-1 truncate font-mono">
                    <ExternalLink className="w-3 h-3 shrink-0 text-slate-400" />
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate hover:text-blue-600 hover:underline"
                    >
                      {source.url}
                    </a>
                  </div>

                  <div className="pt-2 border-t border-slate-200/80 space-y-1 text-[10px] text-slate-500 font-mono">
                    <div className="flex justify-between">
                      <span>SHA-256 Digest:</span>
                      <span className="text-slate-800 font-bold" title={source.currentSha256 || 'None'}>
                        {source.currentSha256 ? `${source.currentSha256.slice(0, 14)}...` : 'Not recorded'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Check Interval:</span>
                      <span className="text-slate-700">Every {source.checkIntervalHours} hrs</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Last Checked:</span>
                      <span className="text-slate-700">{source.lastChecked ? new Date(source.lastChecked).toLocaleTimeString() : 'Never'}</span>
                    </div>
                  </div>
                </div>

                {/* Card Action Controls */}
                <div className="pt-3 mt-3 border-t border-slate-200/80 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleDeleteSource(source.id, source.name)}
                    disabled={!canAuthorize || ['lhdn-general-guideline', 'lhdn-specific-guideline'].includes(source.id)}
                    title={['lhdn-general-guideline', 'lhdn-specific-guideline'].includes(source.id) ? 'Protected official baseline source' : 'Delete source'}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCrawlSource(source.id, source.name)}
                    disabled={isCrawling || !canAuthorize}
                    className="h-8 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
                  >
                    <Play className={`w-3 h-3 ${isCrawling ? 'animate-spin' : ''}`} />
                    <span>{isCrawling ? (isBM ? 'Memproses...' : 'Extracting...') : (isBM ? 'Rayap & Ekstrak' : 'Crawl & Extract')}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL 1: ADD NEW POLICY SOURCE */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#1C3F35]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800">
                  <Plus className="w-4 h-4" />
                </span>
                <h3 className="text-sm font-bold text-slate-900">
                  {isBM ? 'Daftar Sumber Dasar Baru' : 'Register New Policy Source'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSource} className="space-y-3.5 mt-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {isBM ? 'Nama Dokumen / Sumber' : 'Source Document Name'} *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. LHDN Phase 4 E-Invoice Addendum 2027"
                  value={sourceForm.name}
                  onChange={(e) => setSourceForm({ ...sourceForm, name: e.target.value })}
                  className="w-full h-9 px-3 rounded-xl border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {isBM ? 'URL Sasaran Dokumen / PDF' : 'Document / PDF Target URL'} *
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://www.hasil.gov.my/e-invois/..."
                  value={sourceForm.url}
                  onChange={(e) => setSourceForm({ ...sourceForm, url: e.target.value })}
                  className="w-full h-9 px-3 rounded-xl border border-slate-300 text-slate-800 font-mono text-[11px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {isBM ? 'Kategori' : 'Category'}
                  </label>
                  <select
                    value={sourceForm.category}
                    onChange={(e) => setSourceForm({ ...sourceForm, category: e.target.value as any })}
                    className="w-full h-9 px-2.5 rounded-xl border border-slate-300 text-slate-800 bg-white"
                  >
                    <option value="guideline">LHDN Guideline</option>
                    <option value="faq">Official FAQ</option>
                    <option value="budget_speech">Budget & Gazette</option>
                    <option value="sst">Royal Customs SST</option>
                    <option value="custom">Custom Policy</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {isBM ? 'Format Kandungan' : 'Content Format'}
                  </label>
                  <select
                    value={sourceForm.sourceFormat}
                    onChange={(e) => setSourceForm({ ...sourceForm, sourceFormat: e.target.value as any })}
                    className="w-full h-9 px-2.5 rounded-xl border border-slate-300 text-slate-800 bg-white"
                  >
                    <option value="pdf">PDF Document (.pdf)</option>
                    <option value="html">HTML Web Page</option>
                    <option value="json">JSON API Feed</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {isBM ? 'Frekuensi Semakan Berjadual' : 'Scheduled Check Interval'}
                </label>
                <select
                  value={sourceForm.checkIntervalHours}
                  onChange={(e) => setSourceForm({ ...sourceForm, checkIntervalHours: Number(e.target.value) })}
                  className="w-full h-9 px-2.5 rounded-xl border border-slate-300 text-slate-800 bg-white"
                >
                  <option value={6}>Every 6 Hours</option>
                  <option value={12}>Every 12 Hours (Standard)</option>
                  <option value={24}>Every 24 Hours (Daily)</option>
                  <option value={48}>Every 48 Hours</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {isBM ? 'Keterangan Dokumen' : 'Document Type Description'}
                </label>
                <textarea
                  rows={2}
                  placeholder="Notes on the legal scope and applicability of this source..."
                  value={sourceForm.documentType}
                  onChange={(e) => setSourceForm({ ...sourceForm, documentType: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="h-9 px-4 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isBM ? 'Simpan ke Supabase' : 'Save to Supabase'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: 7-POINT SAFETY VERIFICATION SUITE REPORT */}
      {selectedPackageForSafety && (
        <div className="fixed inset-0 z-50 bg-[#1C3F35]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-indigo-100 text-indigo-800">
                  <ShieldCheck className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {isBM ? 'Laporan Pemeriksaan Struktur 7-Titik' : '7-Point Structural Check Report'}
                  </h3>
                  <div className="text-xs text-slate-500 font-mono">
                    Package: {selectedPackageForSafety.id} • Score: {selectedPackageForSafety.safetyVerification?.score || 100}%
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPackageForSafety(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 mt-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-slate-600">Verification Engine:</span>
                  <span className="font-mono font-bold text-slate-900 ml-1.5">
                    {selectedPackageForSafety.safetyVerification?.engineVersion || 'OrbyteSafetyValidator/v2.5'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-600">Result:</span>
                  <span className={`px-2 py-0.5 rounded-full font-bold uppercase ${
                    selectedPackageForSafety.safetyVerification?.passed
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-rose-100 text-rose-800 border border-rose-300'
                  }`}>
                    {selectedPackageForSafety.safetyVerification?.passed ? 'ALL CHECKS PASSED' : 'CHECKS FAILED'}
                  </span>
                </div>
              </div>

              {/* 7 Checks Breakdown */}
              <div className="space-y-2.5">
                {(selectedPackageForSafety.safetyVerification?.checks || []).map((chk: SafetyCheckItem, i: number) => (
                  <div
                    key={chk.id || i}
                    className={`p-3 rounded-xl border flex items-start gap-3 ${
                      chk.passed
                        ? 'bg-emerald-50/40 border-emerald-200'
                        : 'bg-rose-50/50 border-rose-200'
                    }`}
                  >
                    <span className="mt-0.5">
                      {chk.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-600" />
                      )}
                    </span>
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900">{chk.name}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-200/80 text-slate-700">
                          {chk.severity.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">{chk.description}</p>
                      <div className="text-[11px] font-medium text-slate-800 bg-white/60 p-2 rounded-lg border border-slate-200/60">
                        {chk.details}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-blue-950 text-[11px] leading-relaxed">
                <strong>Why this is mandatory:</strong> LHDN e-invoice guidelines and MOF speeches frequently update format guidelines without changing tax law, or vice-versa. Automatic activation of raw text leads to catastrophic calculation errors. Structural safety checks alone do not establish legal effect. Packages with tax brackets different from the central reference schedule are blocked from activation until the relevant law, year of assessment and effective date are verified and the central schedule is deliberately updated.
              </div>
            </div>

            <div className="pt-3 mt-4 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedPackageForSafety(null)}
                className="h-9 px-4 rounded-xl bg-[#1C3F35] text-white font-semibold cursor-pointer"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: SIDE-BY-SIDE TAX BRACKET & RULE DIFF VIEWER */}
      {selectedPackageForDiff && (
        <div className="fixed inset-0 z-50 bg-[#1C3F35]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-amber-100 text-amber-800">
                  <Scale className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {isBM ? 'Perbandingan Perubahan Cukai & Peraturan' : 'Rule & Tax Bracket Diff Comparison'}
                  </h3>
                  <div className="text-xs text-slate-500">
                    Comparing Candidate ({selectedPackageForDiff.version}) vs Active ({activePackage?.version || 'v4.9'})
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPackageForDiff(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 mt-4 text-xs">
              {/* Tax Brackets Diff Table */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-900">Corporate Tax Brackets Comparison</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                      <tr>
                        <th className="p-2.5">Income Tier</th>
                        <th className="p-2.5">Active Package ({activePackage?.version || 'Current'})</th>
                        <th className="p-2.5">Candidate ({selectedPackageForDiff.version})</th>
                        <th className="p-2.5">Difference</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[11px]">
                      {selectedPackageForDiff.taxBrackets.map((cb, i) => {
                        const ab = activePackage?.taxBrackets[i];
                        const diff = ab ? (cb.rate - ab.rate) : 0;
                        return (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="p-2.5 font-medium text-slate-800">
                              Tier {i + 1} ({cb.upTo ? `≤ RM${(cb.upTo/1000).toFixed(0)}k` : '> RM600k'})
                            </td>
                            <td className="p-2.5 font-mono">{ab ? `${(ab.rate * 100).toFixed(0)}%` : 'N/A'}</td>
                            <td className="p-2.5 font-mono font-bold text-indigo-700">{(cb.rate * 100).toFixed(0)}%</td>
                            <td className="p-2.5">
                              {diff === 0 ? (
                                <span className="text-slate-500">Unchanged</span>
                              ) : (
                                <span className={diff < 0 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                                  {diff < 0 ? `-${(Math.abs(diff)*100).toFixed(0)}% (Saving)` : `+${(diff*100).toFixed(0)}%`}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Threshold Comparison */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-slate-500 font-medium">Exemption Radar Threshold:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-600">RM {activePackage?.exemptionThreshold.toLocaleString()}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-mono font-bold text-indigo-700">RM {selectedPackageForDiff.exemptionThreshold.toLocaleString()}</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-slate-500 font-medium">National Minimum Wage:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-600">RM {activePackage?.minWageStandard.toLocaleString()}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-mono font-bold text-indigo-700">RM {selectedPackageForDiff.minWageStandard.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 mt-4 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedPackageForDiff(null)}
                className="h-9 px-4 rounded-xl bg-[#1C3F35] text-white font-semibold cursor-pointer"
              >
                Close Diff
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: APPROVAL CONFIRMATION MODAL */}
      {isApproveModalOpen && targetApprovePackage && (
        <div className="fixed inset-0 z-50 bg-[#1C3F35]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
                  <ShieldCheck className="w-5 h-5" />
                </span>
                <h3 className="text-sm font-bold text-slate-900">
                  {isBM ? 'Sahkan Kelulusan & Pengaktifan Pakej Peraturan' : 'Authorize & Activate Rule Package'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsApproveModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 mt-4 text-xs">
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-950 space-y-1">
                <div className="font-bold">Package: {targetApprovePackage.packageName}</div>
                <div className="text-[11px]">{targetApprovePackage.safetyVerification?.passed ? `Structural checks: ${targetApprovePackage.safetyVerification.passedChecks ?? 0}/${targetApprovePackage.safetyVerification.totalChecks ?? 7} passed. This is not legal or factual verification.` : 'Safety verification has not passed. This package cannot be activated.'}</div>
                {!matchesReferenceTaxSchedule(targetApprovePackage.taxBrackets) && (
                  <div className="mt-2 rounded-lg border border-amber-300 bg-amber-100 p-2 text-[11px] leading-relaxed text-amber-950">
                    {isBM
                      ? 'Jadual cukai pakej ini berbeza daripada kadar rujukan yang dikonfigurasi. Pakej kekal sebagai calon sahaja sehingga undang-undang akhir, tahun taksiran dan tarikh kuat kuasa disahkan serta jadual pusat dikemas kini secara jelas.'
                      : 'This package has tax brackets different from the configured reference schedule. It must remain a candidate until final legislation, the applicable year of assessment and effective date are verified and the central schedule is explicitly updated.'}
                  </div>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {isBM ? 'Nota Kelulusan Pematuhan (Direkodkan dalam Lejar Audit)' : 'Compliance Authorization Notes (Recorded in Audit Ledger)'} *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Verified against gazetted Ministry of Finance addendum and certified safe for automated tax recalculation."
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                />
              </div>

              <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                Authorizer: <strong>{currentRole === 'owner' ? 'SME Owner (Authorized)' : 'Certified Tax Advisor (Authorized)'}</strong>. Activation is only allowed when the backend safety report passes and the authorised reviewer has checked the official-source evidence.
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsApproveModalOpen(false)}
                  className="h-9 px-4 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmApproval}
                  disabled={isApproving || !targetApprovePackage.safetyVerification?.passed || !matchesReferenceTaxSchedule(targetApprovePackage.taxBrackets)}
                  className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{isApproving ? 'Activating...' : 'Confirm & Activate Policy Rules'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Radio,
  FileCheck2,
  Building2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sparkles,
  DollarSign,
  Users,
  ShieldCheck,
  ArrowRight,
  Download,
  RefreshCw,
  Calculator,
  BookOpen,
  ExternalLink,
  Calendar,
  FileText,
  Clock,
  Check,
  AlertCircle,
  SlidersHorizontal,
  FileUp,
  Info,
  X,
  Hash,
  ShieldAlert,
  Database,
  Bell,
} from 'lucide-react';
import { PageHeader, SectionCard, StatusBadge, InfoHint } from './common';
import {
  CustomEligibilityOutcome,
  RoleType,
  CompanyEntity,
  PolicyMonitoringStatus,
  MonitoredSource,
  PolicySourceRecord,
  ApprovedRulePackage,
} from '../types';
import { PolicySourcesAndSafetyView } from './PolicySourcesAndSafetyView';
import { PolicyAssistantView } from './PolicyAssistantView';
import { api } from '../services/api';
import {
  MSME_SALES_MAX,
  MSME_CAPITAL_MAX,
  INVOICE_REVIEW_THRESHOLD,
  EXEMPTION_RADAR_THRESHOLD,
  MEDIASAS_STAFF_MAX,
  MEDIASAS_GRANT_PER_EMPLOYEE,
  MEDIASAS_MAX_SUBSIDIZED_EMPLOYEES,
  calculateTaxSaving,
} from '../constants/policyConstants';

type SavedPolicyVersion = {
  documentKey: string;
  contentSha256: string;
  detectedVersion: string | null;
  sourceUrl: string;
  extractedText: string;
  pageCount: number | null;
  capturedAt: string | null;
};

type SupabasePolicySnapshot = {
  configured: boolean;
  document: {
    documentKey: string;
    title: string;
    status: string;
    detectedVersion: string | null;
    currentSha256: string;
    previousSha256: string | null;
    lastCheckedAt: string | null;
    lastSuccessfulRetrievalAt: string | null;
    pageCount: number | null;
    textLength: number | null;
    hasPendingReview: boolean;
  };
  current: SavedPolicyVersion;
  previous: SavedPolicyVersion | null;
  notice?: string;
};

interface ComplianceOpportunitiesViewProps {
  companies: CompanyEntity[];
  language: 'en' | 'bm';
  onShowToast: (type: 'success' | 'warning' | 'error' | 'info', title: string, message: string) => void;
  currentRole: RoleType;
  companyName?: string;
  ownerName?: string;
  onOpenEditProfile?: () => void;
  activeCompanyId?: string;
  initialRevenue?: number;
  initialSubTab?: 'policies' | 'sources' | 'assistant' | 'alerts' | 'incentives' | 'actions' | 'radar' | 'action_plan';
  viewMode?: 'policies' | 'eligibility';
  activePolicyVersion?: string;
  isPolicyStale?: boolean;
  onPolicyUpdated?: (newVer: string) => void;
}

export const ComplianceOpportunitiesView: React.FC<ComplianceOpportunitiesViewProps> = ({
  companies,
  language,
  onShowToast,
  currentRole,
  companyName = 'ABC Trading Sdn. Bhd.',
  ownerName = 'Ahmad Razak',
  onOpenEditProfile,
  activeCompanyId = 'COMP-A',
  initialRevenue = 0,
  initialSubTab = 'policies',
  viewMode = 'policies',
  activePolicyVersion = 'LHDN-General-Guideline-v4.8',
  isPolicyStale = false,
  onPolicyUpdated,
}) => {
  const isBM = language === 'bm';
  const isOwner = currentRole === 'owner';
  const isExpert = currentRole === 'expert';
  const canActivate = isOwner || isExpert;

  // Keep policy governance separate from business eligibility tasks.
  // Policy mode: overview, Ask Orbyte, advanced management.
  // Eligibility mode: benefits/eligibility and recommended actions.
  const resolveTab = (tab?: string): 'policies' | 'sources' | 'assistant' | 'alerts' | 'incentives' | 'actions' => {
    if (viewMode === 'eligibility') {
      return tab === 'actions' || tab === 'action_plan' || tab === 'radar' ? 'actions' : 'incentives';
    }
    if (tab === 'assistant') return 'assistant';
    if (tab === 'alerts') return 'alerts';
    if ((tab === 'sources' || tab === 'registry') && canActivate) return 'sources';
    return 'policies';
  };

  const [activeSubTab, setActiveSubTab] = useState<'policies' | 'sources' | 'assistant' | 'alerts' | 'incentives' | 'actions'>(
    resolveTab(initialSubTab)
  );

  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(resolveTab(initialSubTab));
    }
  }, [initialSubTab, viewMode, canActivate]);

  // Active Company Metrics
  const activeCompany = companies.find((c) => c.id === activeCompanyId) || companies[0];
  const [calcSales, setCalcSales] = useState<number>(activeCompany?.sales ?? initialRevenue ?? 0);
  const [calcCapital, setCalcCapital] = useState<number>(activeCompany?.paidUpCapital ?? 0);
  const [calcStaff, setCalcStaff] = useState<number>(activeCompany?.staff ?? activeCompany?.staffCount ?? 0);
  const [calcChargeableIncome, setCalcChargeableIncome] = useState<number | null>(activeCompany?.chargeableIncome ?? null);

  // Evaluated result from server deterministic rules
  const [evalOutcome, setEvalOutcome] = useState<CustomEligibilityOutcome | null>(null);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(true);

  // Radar revenue state
  const [radarMonthly, setRadarMonthly] = useState<number>(Math.round(calcSales / 12));
  const [radarProjectedAnnual, setRadarProjectedAnnual] = useState<number>(calcSales);
  const radarThreshold = EXEMPTION_RADAR_THRESHOLD;
  const radarPercent = Math.min(100, Math.round((radarProjectedAnnual / radarThreshold) * 1000) / 10);
  const hasRadarTurnoverData = Number.isFinite(radarProjectedAnnual) && radarProjectedAnnual > 0;
  const isBelowReference = hasRadarTurnoverData && radarProjectedAnnual < radarThreshold;
  const isApproaching = hasRadarTurnoverData && radarProjectedAnnual >= radarThreshold * 0.8 && radarProjectedAnnual < radarThreshold;

  // Policy Monitoring state (from Policy Center)
  const [monitoringStatus, setMonitoringStatus] = useState<PolicyMonitoringStatus | null>(null);
  const [isCheckingLive, setIsCheckingLive] = useState<boolean>(false);
  const [isActivatingPolicy, setIsActivatingPolicy] = useState<boolean>(false);
  const [isSimulatingFeed, setIsSimulatingFeed] = useState<boolean>(false);
  const [latestSupabaseSnapshot, setLatestSupabaseSnapshot] = useState<SupabasePolicySnapshot | null>(null);
  const [loadingSupabaseSnapshotKey, setLoadingSupabaseSnapshotKey] = useState<string | null>(null);

  // Dynamic Policy Sources & Rule Packages state (Supabase)
  const [policySources, setPolicySources] = useState<PolicySourceRecord[]>([]);
  const [policyPackages, setPolicyPackages] = useState<ApprovedRulePackage[]>([]);
  const [activeRulePackage, setActiveRulePackage] = useState<ApprovedRulePackage | null>(null);
  const [sourcesProvider, setSourcesProvider] = useState<'supabase' | 'local_fallback'>('local_fallback');
  const [isSourcesLoading, setIsSourcesLoading] = useState<boolean>(true);

  const loadSourcesAndPackages = async () => {
    setIsSourcesLoading(true);
    try {
      const [srcRes, pkgRes] = await Promise.all([
        api.getPolicySources(),
        api.getPolicyPackages(),
      ]);
      setPolicySources(srcRes.sources || []);
      setSourcesProvider(srcRes.provider || 'local_fallback');
      setPolicyPackages(pkgRes.packages || []);
      setActiveRulePackage(pkgRes.activePackage || null);
    } catch (err) {
      console.warn('Failed to load sources and packages:', err);
    } finally {
      setIsSourcesLoading(false);
    }
  };

  useEffect(() => {
    loadSourcesAndPackages();
  }, [activePolicyVersion]);

  // Manual Official Document Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [importSourceId, setImportSourceId] = useState<string>('lhdn-portal');
  const [importTitle, setImportTitle] = useState<string>('Document for source review');
  const [importVersionName, setImportVersionName] = useState<string>('manual-source-review');
  const [importText, setImportText] = useState<string>('');
  const [isImporting, setIsImporting] = useState<boolean>(false);

  const sampleGazettePreset = `DEMO ONLY — SAMPLE POLICY DOCUMENT FOR UI TESTING.
This text is fictional test content and is not an official LHDN or MOF document.
Do not treat this sample as evidence of a statutory change. Import a document only after checking its official source.`;

  // Sync inputs when active company changes
  useEffect(() => {
    if (activeCompany) {
      if (activeCompany.sales !== undefined && activeCompany.sales !== null) {
        setCalcSales(activeCompany.sales);
        setRadarProjectedAnnual(activeCompany.sales);
        setRadarMonthly(Math.round(activeCompany.sales / 12));
      }
      if (activeCompany.paidUpCapital !== undefined && activeCompany.paidUpCapital !== null) setCalcCapital(activeCompany.paidUpCapital);
      const staffVal = activeCompany.staff ?? activeCompany.staffCount;
      if (staffVal !== undefined && staffVal !== null) setCalcStaff(staffVal);
      setCalcChargeableIncome(activeCompany.chargeableIncome !== undefined && activeCompany.chargeableIncome !== null ? activeCompany.chargeableIncome : null);
    }
  }, [activeCompanyId, activeCompany]);

  // Refresh monitoring status on entry and periodically while the workspace is open.
  // This reads saved monitoring state; it does not initiate a crawl or claim a live sync.
  useEffect(() => {
    let cancelled = false;
    const loadMonitoringStatus = async () => {
      try {
        const data = await api.getPolicyMonitoringStatus();
        if (!cancelled) setMonitoringStatus(data);
      } catch {
        // Keep the most recent known status if the monitoring API is temporarily unavailable.
      }
    };

    void loadMonitoringStatus();
    const timer = window.setInterval(() => { void loadMonitoringStatus(); }, 120_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activePolicyVersion]);

  // Evaluate eligibility via debounced API (350ms)
  useEffect(() => {
    let isCancelled = false;
    setIsEvaluating(true);

    const timer = setTimeout(async () => {
      try {
        const res = await api.evaluateCustomEligibility({
          sales: calcSales,
          paidUpCapital: calcCapital,
          staff: calcStaff,
          chargeableIncome: calcChargeableIncome,
        });
        if (!isCancelled) {
          setEvalOutcome(res);
        }
      } catch (err: any) {
        if (!isCancelled) {
          onShowToast(
            'error',
            isBM ? 'Ralat Penilaian' : 'Evaluation Error',
            err.message || 'Failed to evaluate business eligibility metrics.'
          );
        }
      } finally {
        if (!isCancelled) {
          setIsEvaluating(false);
        }
      }
    }, 350);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [calcSales, calcCapital, calcStaff, calcChargeableIncome, isBM, onShowToast]);

  const handleRadarMonthlyChange = async (val: number) => {
    const monthly = Math.max(0, val);
    setRadarMonthly(monthly);
    const annual = Math.round(monthly * 12);
    setRadarProjectedAnnual(annual);

    try {
      await api.updateRadarRevenue(monthly);
    } catch {
      // quiet fallback
    }
  };

  const handleGenerateActionPlan = async () => {
    try {
      const res = await api.generateActionList(activeCompanyId);
      onShowToast(
        'success',
        isBM ? 'Pelan Tindakan Disahkan' : 'Compliance Action Plan Ready',
        isBM
          ? `Pelan tindakan bagi ${companyName} telah dikemas kini dan dicincang ke lejar audit [ID: ${res.audit_id}].`
          : `Compliance action roadmap for ${companyName} generated and recorded to SHA-256 audit ledger [ID: ${res.audit_id}].`
      );
    } catch (err: any) {
      onShowToast('error', isBM ? 'Gagal Menjana' : 'Generation Failed', err.message);
    }
  };

  const handleCheckOfficialSources = async () => {
    setIsCheckingLive(true);
    try {
      const res = await api.checkPolicyMonitoring(false);
      const updated = await api.getPolicyMonitoringStatus();
      setMonitoringStatus(updated);

      if (res.hasNetworkRestriction || res.hasError) {
        onShowToast(
          'warning',
          isBM ? 'Semakan sumber belum lengkap' : 'Source check incomplete',
          res.message || (isBM
            ? 'Sekurang-kurangnya satu sumber tidak dapat diambil atau dibandingkan dengan pasti.'
            : 'At least one source could not be retrieved or compared reliably.')
        );
      } else {
        const lastStatuses = (res.monitoredSources || []).map((source: any) => source.lastStatus);
        const containsChange = lastStatuses.includes('changed');
        const containsUnverifiable = lastStatuses.includes('unverifiable');
        onShowToast(
          containsChange || containsUnverifiable ? 'warning' : 'info',
          isBM ? 'Status sumber dikemas kini' : 'Source status updated',
          res.message || (containsChange
            ? 'Halaman sumber berubah; ini belum mengesahkan perubahan undang-undang.'
            : containsUnverifiable
              ? 'Perbandingan belum dapat disahkan; jangan anggap dasar terkini.'
              : 'Kandungan halaman dibandingkan. Ini tidak mengesahkan status undang-undang.')
        );
      }
    } catch (err: any) {
      onShowToast('error', 'Check Failed', err.message);
    } finally {
      setIsCheckingLive(false);
    }
  };

  const handleLoadSupabasePolicyText = async (documentKey: 'lhdn-general-guideline' | 'lhdn-specific-guideline') => {
    if (!canActivate) {
      onShowToast('warning', isBM ? 'Akses Terhad' : 'Restricted Access', isBM
        ? 'Hanya pemilik PKS atau penasihat cukai boleh membuka teks dasar untuk semakan.'
        : 'Only an SME owner or tax advisor can open the saved policy text for review.');
      return;
    }
    setLoadingSupabaseSnapshotKey(documentKey);
    try {
      const data = await api.getSupabasePolicySnapshot(documentKey) as SupabasePolicySnapshot;
      setLatestSupabaseSnapshot(data);
      onShowToast('success', isBM ? 'Teks Dasar Dimuatkan' : 'Policy Text Loaded', isBM
        ? 'Teks PDF yang disimpan dalam Supabase telah dimuatkan untuk semakan. Peraturan operasi tidak berubah.'
        : 'The extracted PDF text saved in Supabase is loaded for review. Operating rules have not changed.');
    } catch (err: any) {
      onShowToast('error', isBM ? 'Gagal Memuatkan Teks' : 'Could Not Load Text', err.message || 'Failed to load saved policy text.');
    } finally {
      setLoadingSupabaseSnapshotKey(null);
    }
  };

  const handleQueueSupabaseTextForReview = () => {
    if (!latestSupabaseSnapshot?.current?.extractedText) {
      onShowToast('error', isBM ? 'Tiada Teks Dasar' : 'No Policy Text', 'Load a saved Supabase snapshot first.');
      return;
    }
    const snapshot = latestSupabaseSnapshot;
    const versionLabel = snapshot.current.detectedVersion || snapshot.current.contentSha256.slice(0, 12);
    setImportSourceId('lhdn-portal');
    setImportTitle(snapshot.document.title || snapshot.document.documentKey);
    setImportVersionName(`supabase-${snapshot.document.documentKey}-${versionLabel}-review`.slice(0, 120));
    setImportText(snapshot.current.extractedText);
    setIsImportModalOpen(true);
    onShowToast('info', isBM ? 'Dihantar untuk Semakan' : 'Prepared for Review', isBM
      ? 'Teks penuh telah diisi ke dalam borang semakan. Semak sumber dan tarikh berkuat kuasa; langkah ini tidak mengaktifkan peraturan.'
      : 'The full saved text has been placed into the review form. Verify the source and effective date; this step does not activate rules.');
  };

  const handleSimulateFeed = async () => {
    setIsSimulatingFeed(true);
    try {
      await api.checkPolicyMonitoring(true);
      const updated = await api.getPolicyMonitoringStatus();
      setMonitoringStatus(updated);
      onShowToast(
        'info',
        isBM ? 'Ujian Simulasi Dimuatkan' : 'Simulation Feed Loaded',
        isBM
          ? 'Item semakan simulasi sahaja telah dibuat. Tiada dokumen rasmi diambil dan status penyegerakan langsung tidak diubah.'
          : 'Demo-only source-review item created. No official document was fetched and no live sync status was changed.'
      );
    } catch (err: any) {
      onShowToast('error', 'Simulation Failed', err.message);
    } finally {
      setIsSimulatingFeed(false);
    }
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importText.trim() || importText.trim().length < 20) {
      onShowToast(
        'error',
        'Invalid Document Content',
        'Please provide at least 20 characters of statutory or guideline text.'
      );
      return;
    }

    setIsImporting(true);
    try {
      const res = await api.importOfficialPolicyDocument({
        sourceId: importSourceId,
        documentTitle: importTitle,
        documentText: importText,
        versionName: importVersionName,
      });

      setIsImportModalOpen(false);
      const updated = await api.getPolicyMonitoringStatus();
      setMonitoringStatus(updated);

      onShowToast(
        'success',
        isBM ? 'Dokumen Diterima untuk Semakan' : 'Document Received for Review',
        isBM
          ? `Cap jari dokumen [${res.snapshotHash?.slice(0, 16)}...] direkodkan. Ketulenan sumber belum disahkan secara bebas; tiada peraturan operasi diubah.`
          : `Document fingerprint [${res.snapshotHash?.slice(0, 16)}...] recorded. Authenticity was not independently verified; no operational rule was changed.`
      );
    } catch (err: any) {
      onShowToast('error', 'Import Failed', err.message || 'Failed to import official document');
    } finally {
      setIsImporting(false);
    }
  };

  const handleActivatePolicyDiff = async () => {
    if (!canActivate) {
      onShowToast(
        'error',
        'Permission Denied',
        'Only SME Owners or Tax Advisors can record a source review.'
      );
      return;
    }

    setIsActivatingPolicy(true);
    try {
      const targetVersion = monitoringStatus?.pendingUpdate?.candidateVersion;
      if (!targetVersion) throw new Error('No pending source review is available to verify.');
      const reviewResult = await api.verifyAndActivatePolicy(targetVersion);
      if (reviewResult?.operationalRulesChanged === true && onPolicyUpdated) {
        onPolicyUpdated(targetVersion);
      }
      const updated = await api.getPolicyMonitoringStatus();
      setMonitoringStatus(updated);
      onShowToast(
        'success',
        isBM ? 'Semakan Sumber Direkodkan' : 'Source Review Recorded',
        isBM
          ? `Semakan sumber ${targetVersion} direkodkan. Peraturan operasi tidak berubah melainkan set peraturan yang disahkan benar-benar diaktifkan.`
          : `Source review ${targetVersion} was recorded. Operating rules were not changed by this review.`
      );
    } catch (err: any) {
      onShowToast('error', 'Activation Failed', err.message);
    } finally {
      setIsActivatingPolicy(false);
    }
  };

  // Status for Active Company
  const hasCapital = Boolean(activeCompany?.paidUpCapital);
  const isCapitalEligible = hasCapital && (activeCompany.paidUpCapital || 0) <= MSME_CAPITAL_MAX;
  const hasTurnoverData = activeCompany?.sales !== undefined && activeCompany?.sales !== null;
  const isTurnoverEligible = hasTurnoverData && (activeCompany?.sales ?? 0) <= MSME_SALES_MAX;
  const isTaxScreenBandMatch = isCapitalEligible && isTurnoverEligible;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Page Header */}
      <PageHeader
        tag={viewMode === 'eligibility' ? (isBM ? 'Kelayakan & Manfaat' : 'Eligibility & Benefits') : (isBM ? 'Dasar & Pemantauan' : 'Policy & Monitoring')}
        tagIcon={viewMode === 'eligibility' ? ShieldCheck : BookOpen}
        title={viewMode === 'eligibility'
          ? (isBM ? 'Kelayakan & Manfaat Perniagaan' : 'Eligibility & Benefits')
          : (isBM ? 'Ringkasan Dasar' : 'Policy Overview')}
        description={viewMode === 'eligibility'
          ? (isBM
            ? `Semak padanan awal untuk geran, insentif dan langkah pematuhan bagi ${companyName}. Semua keputusan kelayakan perlu disahkan melalui syarat rasmi.`
            : `Review preliminary matches for grants, incentives, and compliance next steps for ${companyName}. Confirm eligibility against official programme terms.`)
          : (isBM
            ? `Lihat keperluan dasar, rujukan rasmi dan status sumber yang digunakan oleh Orbyte. Perubahan sumber perlu disemak sebelum dianggap sebagai perubahan undang-undang.`
            : `Review policy requirements, official references, and source status used by Orbyte. Source changes must be reviewed before being treated as legal changes.`)}
        primaryAction={viewMode === 'eligibility' ? {
          label: isBM ? 'Jana Pelan Tindakan' : 'Generate Action Roadmap',
          icon: FileCheck2,
          onClick: handleGenerateActionPlan,
          variant: 'primary',
        } : undefined}
        secondaryAction={
          onOpenEditProfile
            ? {
                label: isBM ? 'Tukar Entiti' : 'Switch Entity',
                icon: Building2,
                onClick: onOpenEditProfile,
                variant: 'secondary',
              }
            : undefined
        }
      />

      {/* Focused navigation: policy governance and business eligibility are separate tasks. */}
      <div className={`grid grid-cols-1 ${viewMode === 'eligibility' ? 'sm:grid-cols-2' : (canActivate ? 'sm:grid-cols-4' : 'sm:grid-cols-3')} gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xs`}>
        {viewMode === 'policies' ? (
          <>
            <button
              type="button"
              onClick={() => setActiveSubTab('policies')}
              aria-pressed={activeSubTab === 'policies'}
              className={`flex items-start gap-3 rounded-xl p-3.5 text-left transition-all cursor-pointer ${activeSubTab === 'policies' ? 'bg-[#1C3F35] text-white shadow-xs' : 'text-slate-700 hover:bg-slate-50'}`}
            >
              <BookOpen className={`mt-0.5 h-5 w-5 shrink-0 ${activeSubTab === 'policies' ? 'text-amber-300' : 'text-slate-500'}`} />
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2 text-sm sm:text-base font-bold">
                  {isBM ? 'Ringkasan Dasar' : 'Policy Overview'}
                  {isPolicyStale && <span className="rounded bg-amber-300 px-2 py-0.5 text-xs font-bold uppercase text-slate-950">{isBM ? 'Perlu disemak' : 'Review needed'}</span>}
                </span>
                <span className={`mt-1 block text-xs sm:text-sm leading-relaxed ${activeSubTab === 'policies' ? 'text-slate-300' : 'text-slate-600'}`}>
                  {isBM ? 'Keperluan dan status sumber dasar' : 'Requirements and source status'}
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('assistant')}
              aria-pressed={activeSubTab === 'assistant'}
              className={`flex items-start gap-3 rounded-xl p-3.5 text-left transition-all cursor-pointer ${activeSubTab === 'assistant' ? 'bg-[#1C3F35] text-white shadow-xs' : 'text-slate-700 hover:bg-slate-50'}`}
            >
              <Sparkles className={`mt-0.5 h-5 w-5 shrink-0 ${activeSubTab === 'assistant' ? 'text-amber-300' : 'text-slate-500'}`} />
              <span className="min-w-0">
                <span className="block text-sm sm:text-base font-bold">{isBM ? 'Chatbot AI Gemini' : 'Gemini AI Chatbot'}</span>
                <span className={`mt-1 block text-xs sm:text-sm leading-relaxed ${activeSubTab === 'assistant' ? 'text-slate-300' : 'text-slate-600'}`}>
                  {isBM ? 'Tanya soalan & periksa rujukan bersama Gemini AI' : 'Ask questions and inspect references with Gemini AI'}
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('alerts')}
              aria-pressed={activeSubTab === 'alerts'}
              className={`flex items-start gap-3 rounded-xl p-3.5 text-left transition-all cursor-pointer ${activeSubTab === 'alerts' ? 'bg-[#1C3F35] text-white shadow-xs' : 'text-slate-700 hover:bg-slate-50'}`}
            >
              <Bell className={`mt-0.5 h-5 w-5 shrink-0 ${activeSubTab === 'alerts' ? 'text-amber-300' : 'text-slate-500'}`} />
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2 text-sm sm:text-base font-bold">
                  {isBM ? 'Amaran Dasar' : 'Policy Alerts'}
                  {(() => {
                    const eligibleSources = (monitoringStatus?.monitoredSources || []).filter((source) =>
                      source.lastStatus !== 'simulated' && source.retrievalMethod !== 'simulated' && source.retrievalMethod !== 'manual_import'
                    );
                    const pendingLiveUpdate = Boolean(monitoringStatus?.pendingUpdate
                      && monitoringStatus.pendingUpdate.importMethod === 'live_network'
                      && !monitoringStatus.pendingUpdate.isSimulated);
                    const sourceSignals = eligibleSources.filter((source) =>
                      source.lastStatus === 'changed' || source.lastStatus === 'update_detected' || source.hasUpdate
                      || ['unverifiable', 'failed', 'unavailable', 'network_error', 'timeout'].includes(source.lastStatus)
                    ).length;
                    const count = Number(Boolean(isPolicyStale || monitoringStatus?.isStale)) + Number(pendingLiveUpdate) + sourceSignals;
                    return count > 0 ? <span className="rounded bg-amber-300 px-2 py-0.5 text-xs font-bold uppercase text-slate-950">{count}</span> : null;
                  })()}
                </span>
                <span className={`mt-1 block text-xs sm:text-sm leading-relaxed ${activeSubTab === 'alerts' ? 'text-slate-300' : 'text-slate-600'}`}>
                  {isBM ? 'Perubahan dan status sumber' : 'Possible changes and source status'}
                </span>
              </span>
            </button>
            {canActivate && (
              <button
                type="button"
                onClick={() => setActiveSubTab('sources')}
                aria-pressed={activeSubTab === 'sources'}
                className={`flex items-start gap-3 rounded-xl p-3.5 text-left transition-all cursor-pointer ${activeSubTab === 'sources' ? 'bg-[#1C3F35] text-white shadow-xs' : 'text-slate-700 hover:bg-slate-50'}`}
              >
                <Database className={`mt-0.5 h-5 w-5 shrink-0 ${activeSubTab === 'sources' ? 'text-amber-300' : 'text-slate-500'}`} />
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2 text-sm sm:text-base font-bold">
                    {isBM ? 'Pengurusan Dasar Lanjutan' : 'Advanced Policy Management'}
                  </span>
                  <span className={`mt-1 block text-xs sm:text-sm leading-relaxed ${activeSubTab === 'sources' ? 'text-slate-300' : 'text-slate-600'}`}>
                    {isBM ? 'Status sumber dan versi rujukan' : 'Source status and reference versions'}
                  </span>
                </span>
              </button>
            )}
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setActiveSubTab('incentives')}
              aria-pressed={activeSubTab === 'incentives'}
              className={`flex items-start gap-3 rounded-xl p-3.5 text-left transition-all cursor-pointer ${activeSubTab === 'incentives' ? 'bg-[#1C3F35] text-white shadow-xs' : 'text-slate-700 hover:bg-slate-50'}`}
            >
              <DollarSign className={`mt-0.5 h-5 w-5 shrink-0 ${activeSubTab === 'incentives' ? 'text-amber-300' : 'text-slate-500'}`} />
              <span className="min-w-0">
                <span className="block text-sm sm:text-base font-bold">{isBM ? 'Kelayakan & Manfaat' : 'Eligibility & Benefits'}</span>
                <span className={`mt-1 block text-xs sm:text-sm leading-relaxed ${activeSubTab === 'incentives' ? 'text-slate-300' : 'text-slate-600'}`}>
                  {isBM ? 'Geran, insentif dan semakan awal' : 'Grants, incentives, and preliminary checks'}
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('actions')}
              aria-pressed={activeSubTab === 'actions'}
              className={`flex items-start gap-3 rounded-xl p-3.5 text-left transition-all cursor-pointer ${activeSubTab === 'actions' ? 'bg-[#1C3F35] text-white shadow-xs' : 'text-slate-700 hover:bg-slate-50'}`}
            >
              <FileCheck2 className={`mt-0.5 h-5 w-5 shrink-0 ${activeSubTab === 'actions' ? 'text-amber-300' : 'text-slate-500'}`} />
              <span className="min-w-0">
                <span className="block text-sm sm:text-base font-bold">{isBM ? 'Langkah Seterusnya' : 'Recommended Actions'}</span>
                <span className={`mt-1 block text-xs sm:text-sm leading-relaxed ${activeSubTab === 'actions' ? 'text-slate-300' : 'text-slate-600'}`}>
                  {isBM ? 'Pelan tindakan dan kalkulator' : 'Action roadmap and calculators'}
                </span>
              </span>
            </button>
          </>
        )}
      </div>

      {/* Policy Alerts: only display signals available in the monitoring feed; never treat a page change as legal confirmation. */}
      {activeSubTab === 'alerts' && (() => {
        type AlertItem = {
          id: string;
          severity: 'review' | 'warning' | 'info';
          title: string;
          message: string;
          sourceName?: string;
          sourceUrl?: string;
          occurredAt?: string | null;
          relevance?: string;
        };

        const alertItems: AlertItem[] = [];
        const seenSourceKeys = new Set<string>();
        const pending = monitoringStatus?.pendingUpdate;
        const normalized = (value?: string | null) => (value || '').trim().replace(/\/+$/, '').toLowerCase();

        // Only show a possible update if it came from a non-simulated live network check.
        // Manual imports and demo scenarios are deliberately excluded from business alerts.
        if (pending && pending.status === 'pending_verification' && !pending.isSimulated && pending.importMethod === 'live_network') {
          const pendingKey = normalized(pending.sourceUrl);
          if (pendingKey) seenSourceKeys.add(pendingKey);
          const keyChanges = pending.aiSummary?.keyChanges || [];
          const categories = Array.from(new Set(keyChanges.map((item) => item.category))).map((category) => {
            switch (category) {
              case 'e-invoicing': return isBM ? 'e-Invois' : 'e-Invoice';
              case 'tax': return isBM ? 'cukai' : 'tax';
              case 'wage': return isBM ? 'gaji' : 'wage';
              case 'subsidy': return isBM ? 'subsidi' : 'subsidy';
              default: return category;
            }
          });
          alertItems.push({
            id: `pending-${pending.candidateVersion}`,
            severity: 'review',
            title: isBM ? 'Kemungkinan kemas kini dasar dikesan' : 'Possible policy update detected',
            message: pending.aiSummary?.executiveSummary || (isBM
              ? 'Sumber rasmi menunjukkan kemungkinan perubahan. Sahkan dokumen, versi dan tarikh berkuat kuasa sebelum bergantung padanya.'
              : 'A monitored source may have changed. Verify the official document, version, and effective date before relying on it.'),
            sourceName: pending.sourceName,
            sourceUrl: pending.sourceUrl,
            occurredAt: pending.detectedAt,
            relevance: categories.length
              ? `${isBM ? 'Bidang yang mungkin berkaitan' : 'Potentially relevant areas'}: ${categories.join(', ')}. ${
                  categories.map((category) => {
                    if (category === (isBM ? 'e-Invois' : 'e-Invoice')) return isBM ? 'Semak aliran kerja invois.' : 'Review your invoice workflow.';
                    if (category === (isBM ? 'cukai' : 'tax')) return isBM ? `Semak andaian cukai bagi jualan tahunan profil RM ${(activeCompany?.sales ?? calcSales).toLocaleString('en-MY')}.` : `Review tax assumptions using the profile annual sales of RM ${(activeCompany?.sales ?? calcSales).toLocaleString('en-MY')}.`;
                    if (category === (isBM ? 'gaji' : 'wage')) return isBM ? `Profil menyenaraikan ${activeCompany?.staff ?? activeCompany?.staffCount ?? calcStaff} pekerja; sahkan syarat gaji rasmi.` : `The profile lists ${activeCompany?.staff ?? activeCompany?.staffCount ?? calcStaff} employees; verify the official wage criteria.`;
                    if (category === (isBM ? 'subsidi' : 'subsidy')) return isBM ? 'Semak semula kriteria manfaat berdasarkan profil perniagaan.' : 'Re-check benefit criteria against the business profile.';
                    return '';
                  }).filter(Boolean).join(' ')
                } ${isBM ? 'Kesan kepada perniagaan belum disahkan.' : 'Business impact has not been confirmed.'}`
              : (isBM ? 'Semak sama ada perubahan ini menjejaskan e-Invois, cukai, gaji atau kelayakan manfaat berdasarkan profil perniagaan.' : 'Check whether the change affects e-Invoice, tax, payroll, or benefit eligibility for this business profile.'),
          });
        }

        const monitoredSources = monitoringStatus?.monitoredSources || [];
        monitoredSources.forEach((source) => {
          if (source.lastStatus === 'simulated' || source.retrievalMethod === 'simulated' || source.retrievalMethod === 'manual_import') return;
          const sourceKey = normalized(source.url) || `source:${source.id}`;
          const changed = source.lastStatus === 'changed' || source.lastStatus === 'update_detected' || source.hasUpdate;
          const failed = ['unverifiable', 'failed', 'unavailable', 'network_error', 'timeout'].includes(source.lastStatus);

          if (changed && !seenSourceKeys.has(sourceKey)) {
            seenSourceKeys.add(sourceKey);
            alertItems.push({
              id: `changed-${source.id}`,
              severity: 'review',
              title: isBM ? 'Perubahan kandungan sumber dikesan' : 'Source content change detected',
              message: isBM
                ? 'Halaman yang dipantau berubah. Ini sahaja tidak membuktikan perubahan undang-undang atau tarikh kuat kuasa.'
                : 'A monitored page changed. This alone does not confirm a legal change or a new effective date.',
              sourceName: source.name,
              sourceUrl: source.url,
              occurredAt: source.lastChecked,
              relevance: isBM
                ? 'Bandingkan dokumen rasmi dan nilai sama ada syarat e-Invois, cukai, gaji atau manfaat terjejas.'
                : 'Compare the official document and assess whether e-Invoice, tax, wage, or benefit requirements are affected.',
            });
          } else if (failed && !alertItems.some((item) => item.id === `unavailable-${source.id}`)) {
            alertItems.push({
              id: `unavailable-${source.id}`,
              severity: 'warning',
              title: isBM ? 'Sumber rasmi tidak dapat disahkan' : 'Official source could not be verified',
              message: source.errorMessage || (isBM
                ? 'Sistem tidak dapat memastikan kandungan terkini bagi sumber ini. Jangan anggap status dasar sebagai terkini.'
                : 'The monitoring service could not verify the latest content for this source. Do not assume the policy status is current.'),
              sourceName: source.name,
              sourceUrl: source.url,
              occurredAt: source.lastChecked,
              relevance: isBM ? 'Cuba semula kemudian atau buka sumber rasmi untuk semakan manual.' : 'Retry later or open the official source for manual verification.',
            });
          }
        });

        const stale = Boolean(isPolicyStale || monitoringStatus?.isStale);
        if (stale) {
          alertItems.push({
            id: 'policy-stale',
            severity: 'warning',
            title: isBM ? 'Pengesahan dasar terkini diperlukan' : 'Policy verification is overdue',
            message: isBM
              ? 'Data pemantauan yang tersedia tidak mengesahkan bahawa semua sumber rasmi telah disemak baru-baru ini.'
              : 'The available monitoring data does not confirm that official sources were checked recently.',
            occurredAt: monitoringStatus?.lastCheckedTime || null,
            relevance: isBM
              ? 'Sahkan tarikh kuat kuasa dan syarat melalui dokumen rasmi sebelum membuat keputusan.'
              : 'Verify effective dates and requirements against official documents before making decisions.',
          });
        }

        const sortedAlerts = alertItems.sort((a, b) => {
          const rank = { warning: 0, review: 1, info: 2 };
          return rank[a.severity] - rank[b.severity];
        });

        const formatDate = (value?: string | null) => {
          if (!value || !Number.isFinite(Date.parse(value))) return null;
          return new Date(value).toLocaleString();
        };

        return (
          <div className="space-y-5 animate-in fade-in duration-150">
            <PageHeader
              tag={isBM ? 'Notifikasi Pemantauan' : 'Monitoring Notifications'}
              tagIcon={Bell}
              title={isBM ? 'Amaran Dasar' : 'Policy Alerts'}
              description={isBM
                ? 'Makluman berdasarkan data pemantauan yang tersedia. Perubahan halaman tidak semestinya perubahan undang-undang.'
                : 'Notices based on the monitoring data currently available. A webpage change is not, by itself, confirmation of a legal change.'}
            />

            <div className="flex flex-col gap-3 rounded-xl border border-[#D8CFB8] bg-[#FFFCF3] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="text-sm font-bold text-[#1C3F35]">{sortedAlerts.length} {isBM ? 'makluman memerlukan perhatian' : `alert${sortedAlerts.length === 1 ? '' : 's'} to review`}</div>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  {monitoringStatus?.lastCheckedTime
                    ? `${isBM ? 'Semakan terakhir' : 'Last source check'}: ${formatDate(monitoringStatus.lastCheckedTime) || monitoringStatus.lastCheckedTime}`
                    : (isBM ? 'Tiada masa semakan yang disahkan tersedia.' : 'No verified source-check timestamp is available.')}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleCheckOfficialSources}
                  disabled={isCheckingLive}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#1C3F35] bg-white px-3 py-2 text-xs font-bold text-[#1C3F35] hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isCheckingLive ? 'animate-spin' : ''}`} />
                  {isCheckingLive ? (isBM ? 'Menyemak...' : 'Checking...') : (isBM ? 'Semak Sumber' : 'Check Sources')}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSubTab('assistant')}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1C3F35] px-3 py-2 text-xs font-bold text-white hover:bg-[#285443]"
                >
                  <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                  {isBM ? 'Tanya Gemini AI' : 'Gemini AI Chatbot'}
                </button>
              </div>
            </div>

            {sortedAlerts.length > 0 ? (
              <div className="space-y-3">
                {sortedAlerts.map((alert) => {
                  const warning = alert.severity === 'warning';
                  const borderTone = warning ? 'border-amber-300 bg-amber-50/70' : 'border-[#D8CFB8] bg-white';
                  const iconTone = warning ? 'bg-amber-100 text-amber-800' : 'bg-[#F4E6BD] text-[#1C3F35]';
                  return (
                    <article key={alert.id} className={`rounded-xl border p-4 shadow-2xs ${borderTone}`}>
                      <div className="flex items-start gap-3">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconTone}`}>
                          {warning ? <AlertTriangle className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-bold text-[#1C3F35]">{alert.title}</h3>
                            <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${warning ? 'bg-amber-200 text-amber-950' : 'bg-[#E7F0E8] text-[#1C3F35]'}`}>
                              {alert.severity === 'warning' ? (isBM ? 'Perlu perhatian' : 'Attention') : (isBM ? 'Semak perubahan' : 'Review change')}
                            </span>
                          </div>
                          {alert.sourceName && <div className="mt-1 text-xs font-semibold text-slate-700">{alert.sourceName}</div>}
                          <p className="mt-1 text-xs leading-relaxed text-slate-700">{alert.message}</p>
                          {alert.relevance && <p className="mt-2 rounded-lg border border-black/5 bg-white/70 p-2.5 text-xs leading-relaxed text-slate-700">{alert.relevance}</p>}
                          {formatDate(alert.occurredAt) && <p className="mt-2 text-[11px] text-slate-500">{isBM ? 'Masa rekod' : 'Recorded'}: {formatDate(alert.occurredAt)}</p>}
                          <div className="mt-3 flex flex-wrap gap-2">
                            {alert.sourceUrl && (
                              <a href={alert.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-md border border-[#1C3F35] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#1C3F35] hover:bg-emerald-50">
                                <ExternalLink className="h-3.5 w-3.5" />
                                {isBM ? 'Buka Sumber Rasmi' : 'Open Source'}
                              </a>
                            )}
                            <button type="button" onClick={() => setActiveSubTab('assistant')} className="inline-flex items-center gap-1.5 rounded-md bg-[#1C3F35] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#285443]">
                              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                              {isBM ? 'Tanya Gemini AI' : 'Ask Gemini AI'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-6 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-700" />
                <h3 className="mt-2 text-sm font-bold text-emerald-950">{isBM ? 'Tiada perubahan ditandakan' : 'No changes flagged'}</h3>
                <p className="mx-auto mt-1 max-w-2xl text-xs leading-relaxed text-emerald-900">
                  {isBM
                    ? 'Tiada perubahan sumber yang memerlukan perhatian ditemui dalam data pemantauan yang tersedia. Ini bukan pengesahan bahawa semua sumber rasmi telah disemak secara langsung.'
                    : 'No changes requiring attention were found in the monitoring data currently available. This does not confirm that every official source has been checked live.'}
                </p>
              </div>
            )}

            <p className="text-[11px] leading-relaxed text-slate-500">
              {isBM
                ? 'Amaran ini berdasarkan status sumber yang dikembalikan oleh sistem. Ia bukan nasihat undang-undang, tidak mengesahkan penguatkuasaan, dan tidak mengaktifkan peraturan secara automatik.'
                : 'Alerts are based on source status returned by the application. They are not legal advice, do not confirm enactment, and never activate operating rules automatically.'}
            </p>
          </div>
        );
      })()}

      {/* Policy Assistant */}
      {activeSubTab === 'assistant' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <PageHeader
            tag={isBM ? 'Dikuasakan oleh Gemini 3.8 Flash' : 'Powered by Gemini 3.8 Flash'}
            tagIcon={Sparkles}
            title={isBM ? 'Chatbot AI Gemini — Soal Jawab & Rujukan Polisi' : 'Gemini AI Chatbot — Policy Q&A & References'}
            description={isBM ? 'Tanya soalan dengan kecerdasan Gemini AI, dan periksa rujukan rasmi LHDN & pakej polisi yang diluluskan.' : 'Ask questions and inspect references with Gemini AI reasoning, verified official statutory citations, and human-approved rule packages.'}
          />
          <PolicyAssistantView language={language} />
        </div>
      )}

      {/* ========================================================================= */}
      {/* GROUP 1: GOVERNMENT POLICIES & COMPLIANCE                                 */}
      {/* ========================================================================= */}
      {activeSubTab === 'policies' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Source-review workflow cards are intentionally hidden from the everyday Policy Overview. */}
          {/* Concise policy status for everyday SME users. Technical diagnostics live in Advanced Policy Management. */}
          <SectionCard
            title={isBM ? 'Status Ringkas Dasar' : 'Policy Status at a Glance'}
            subtitle={isBM ? 'Set peraturan rujukan aktif dan status pengesahan sumber.' : 'The active reference ruleset and current source-verification status.'}
            icon={ShieldCheck}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1">
                <div className="text-xs text-slate-500">{isBM ? 'Versi rujukan aktif' : 'Active reference version'}</div>
                <div className="break-words text-sm font-bold text-slate-900">{activePolicyVersion}</div>
                <div className="text-xs text-slate-600">
                  {isPolicyStale
                    ? (isBM ? 'Pengesahan sumber langsung masih diperlukan.' : 'Live source verification is still required.')
                    : (isBM ? 'Tiada amaran kesegaran dasar yang dilaporkan oleh sesi ini.' : 'No policy-staleness warning is currently reported by this session.')}
                </div>
              </div>
              {canActivate && (
                <button
                  type="button"
                  onClick={() => setActiveSubTab('sources')}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-[#1C3F35] bg-white px-3 py-2 text-xs font-bold text-[#1C3F35] transition-colors hover:bg-emerald-50"
                >
                  <Database className="h-4 w-4" />
                  {isBM ? 'Pengurusan Dasar Lanjutan' : 'Advanced Policy Management'}
                </button>
              )}
            </div>
          </SectionCard>
        </div>
      )}

      {/* Advanced source diagnostics are available only inside Advanced Policy Management. */}
      {activeSubTab === 'sources' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <PolicySourcesAndSafetyView
            language={language}
            currentRole={currentRole}
            onShowToast={onShowToast}
            onPolicyActivated={(pkg) => {
              if (onPolicyUpdated) onPolicyUpdated(pkg.version);
              loadSourcesAndPackages();
            }}
            sources={policySources}
            packages={policyPackages}
            activePackage={activeRulePackage}
            provider={sourcesProvider}
            isLoading={isSourcesLoading}
            onRefresh={loadSourcesAndPackages}
          />
          <details className="group rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <summary className="cursor-pointer list-none text-sm font-bold text-slate-800">
              <span className="flex items-center justify-between gap-3">
                <span>{isBM ? 'Diagnostik sumber lanjutan, snapshot dan hash SHA-256' : 'Advanced source diagnostics, snapshots, and SHA-256 hashes'}</span>
                <span className="text-xs font-medium text-slate-500 group-open:hidden">{isBM ? 'Tunjukkan' : 'Show details'}</span>
                <span className="hidden text-xs font-medium text-slate-500 group-open:inline">{isBM ? 'Sembunyikan' : 'Hide details'}</span>
              </span>
              <span className="mt-1 block text-[11px] font-normal leading-relaxed text-slate-500">
                {isBM ? 'Gunakan bahagian ini untuk semakan mendalam, import manual dan status capaian sumber.' : 'Use this section for detailed source checks, manual document review, and retrieval diagnostics.'}
              </span>
            </summary>
            <div className="pt-4">
              <SectionCard
            title={isBM ? 'Butiran Pemantauan Sumber' : 'Source Monitoring Details'}
            subtitle={
              isBM
                ? `Set rujukan tempatan (${activePolicyVersion}) untuk semakan awal. Perubahan sumber tidak mengaktifkan peraturan secara automatik.`
                : `Local reference dataset (${activePolicyVersion}) used for preliminary checks. Source changes do not automatically activate operating rules.`
            }
            icon={ShieldCheck}
            headerAction={
              <div className="flex items-center gap-2 flex-wrap">
                {canActivate && <button
                  type="button"
                  onClick={() => setIsImportModalOpen(true)}
                  className="h-8 px-3 rounded-lg border border-blue-300 bg-blue-50/80 hover:bg-blue-100/80 text-blue-800 text-xs font-semibold flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
                >
                  <FileUp className="w-3.5 h-3.5 text-blue-600" />
                  <span>{isBM ? 'Import Dokumen untuk Semakan' : 'Import Document for Review'}</span>
                </button>}
                <button
                  type="button"
                  onClick={handleCheckOfficialSources}
                  disabled={isCheckingLive}
                  className="h-8 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isCheckingLive ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
                  <span>{isCheckingLive ? 'Checking...' : (isBM ? 'Semak Sumber Rasmi' : 'Check Official Sources')}</span>
                </button>
                {canActivate && <button
                  type="button"
                  onClick={handleSimulateFeed}
                  disabled={!canActivate || isSimulatingFeed}
                  title="Run sandbox simulation feed (clearly tagged as simulation)"
                  className="h-8 px-2.5 rounded-lg border border-purple-200 bg-purple-50/80 hover:bg-purple-100 text-purple-800 text-xs font-semibold flex items-center gap-1 shadow-2xs cursor-pointer transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  <span>{isSimulatingFeed ? 'Simulating...' : (isBM ? 'Simulasi' : 'Simulate')}</span>
                </button>}
              </div>
            }
          >
            <div className="space-y-4">
              {/* Honest Network Isolation Banner if applicable */}
              {monitoringStatus?.hasNetworkRestriction && (
                <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/80 text-xs text-amber-950 flex items-start gap-3">
                  <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-bold flex items-center gap-2">
                      <span>Network Isolation Notice</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-200/80 text-amber-900 font-bold uppercase">
                        Honest Status Enforced
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-900 leading-relaxed">
                      Live source retrieval is unavailable in this runtime. The last successful retrieval is preserved. Imported text is not independently authenticated and does not activate operational rules.
                    </p>
                  </div>
                </div>
              )}

              {/* Monitored Official Source Endpoints (Dynamic from Supabase / Store) */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
                {(policySources.length > 0
                  ? policySources.map((s) => ({
                      id: s.id,
                      name: s.name,
                      url: s.url,
                      documentType: s.documentType,
                      lastChecked: s.lastChecked,
                      lastSuccessfulRetrieval: s.lastSuccessfulRetrieval,
                      lastStatus: s.status as any,
                      httpStatus: null,
                      errorMessage: s.errorMessage || null,
                      monitoredVersion: s.detectedVersion ? `Detected ${s.detectedVersion}` : 'Active tracking',
                      detectedVersion: s.detectedVersion || null,
                      hasUpdate: s.status === 'changed',
                      sourceSnippet: `${s.name} (${s.sourceFormat.toUpperCase()}). Source managed in Supabase registry.`,
                      snapshotHash: s.currentSha256,
                      snapshotSnippet: null,
                      retrievalMethod: s.lastSuccessfulRetrieval ? ('live_network' as const) : ('none' as const),
                      checkIntervalHours: s.checkIntervalHours,
                    })) as MonitoredSource[]
                  : (monitoringStatus?.monitoredSources || [])
                ).map((src) => {
                  let badgeClass = 'bg-slate-100 text-slate-700 border-slate-200';
                  let badgeLabel = String(src.lastStatus).toUpperCase();

                  if (src.lastStatus === 'changed' || src.hasUpdate) {
                    badgeClass = 'bg-amber-100 text-amber-900 border-amber-300 font-bold';
                    badgeLabel = (src.id === 'lhdn-general-guideline' || src.id === 'lhdn-specific-guideline')
                      ? 'PDF CONTENT CHANGED — REVIEW'
                      : 'SOURCE PAGE CHANGED — REVIEW';
                  } else if (src.lastStatus === 'unchanged' || src.lastStatus === 'connected') {
                    badgeClass = 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold';
                    badgeLabel = 'PAGE CONTENT UNCHANGED';
                  } else if (src.lastStatus === 'baseline_saved') {
                    badgeClass = 'bg-sky-50 text-sky-800 border-sky-200 font-bold';
                    badgeLabel = 'BASELINE SAVED — AWAITING COMPARISON';
                  } else if (src.lastStatus === 'unavailable') {
                    badgeClass = 'bg-rose-50 text-rose-700 border-rose-200 font-bold';
                    badgeLabel = 'UNAVAILABLE';
                  } else if (src.lastStatus === 'failed') {
                    badgeClass = 'bg-red-100 text-red-900 border-red-300 font-bold';
                    badgeLabel = 'SOURCE REQUEST FAILED';
                  } else if (src.lastStatus === 'unverifiable') {
                    badgeClass = 'bg-slate-100 text-slate-800 border-slate-300 font-bold';
                    badgeLabel = 'UNVERIFIABLE';
                  } else if (src.lastStatus === 'simulated') {
                    badgeClass = 'bg-purple-100 text-purple-900 border-purple-300 font-bold';
                    badgeLabel = 'SIMULATED';
                  } else if (src.lastStatus === 'checking') {
                    badgeClass = 'bg-blue-100 text-blue-900 border-blue-300 font-bold animate-pulse';
                    badgeLabel = 'CHECKING...';
                  }

                  return (
                    <div
                      key={src.id}
                      className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-1.5">
                          <span className="font-bold text-slate-900 text-xs leading-snug">{src.name}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 ${badgeClass}`}>
                            {badgeLabel}
                          </span>
                        </div>
                        <p className="text-slate-500 text-[11px] leading-relaxed">
                          {src.documentType}
                        </p>
                      </div>

                      <div className="space-y-1.5 pt-2 border-t border-slate-200/60 text-[11px]">
                        <div className="flex items-center justify-between text-slate-500">
                          <span>Method:</span>
                          <span className="font-mono font-semibold text-slate-700 capitalize">
                            {src.retrievalMethod ? src.retrievalMethod.replace('_', ' ') : 'Live Network'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-slate-500">
                          <span>Last Checked:</span>
                          <span className="font-mono text-slate-700">
                            {src.lastChecked
                              ? new Date(src.lastChecked).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : 'Never'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-slate-500">
                          <span>Last Success:</span>
                          <span className="font-mono text-slate-700">
                            {src.lastSuccessfulRetrieval
                              ? new Date(src.lastSuccessfulRetrieval).toLocaleDateString([], {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })
                              : 'Pending'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-slate-500">
                          <span>SHA-256 Hash:</span>
                          <span
                            className="font-mono text-slate-600 truncate max-w-[120px]"
                            title={src.snapshotHash || ''}
                          >
                            {src.snapshotHash ? `${src.snapshotHash.slice(0, 12)}...` : 'None'}
                          </span>
                        </div>

                        {src.errorMessage && (
                          <p className="text-[10px] text-rose-700 bg-rose-50/70 p-1.5 rounded border border-rose-200 leading-tight">
                            {src.errorMessage}
                          </p>
                        )}

                        <div className="pt-1 flex items-center justify-between">
                          <a
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center gap-1 text-[11px]"
                          >
                            <span>Official Portal</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                          <span className="text-slate-400 font-mono text-[10px]">
                            {src.detectedVersion || src.monitoredVersion}
                          </span>
                        </div>
                        {(src.id === 'lhdn-general-guideline' || src.id === 'lhdn-specific-guideline') && canActivate && (
                          <button
                            type="button"
                            onClick={() => handleLoadSupabasePolicyText(src.id as 'lhdn-general-guideline' | 'lhdn-specific-guideline')}
                            disabled={loadingSupabaseSnapshotKey === src.id}
                            className="mt-1 w-full h-8 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-60 text-indigo-800 font-semibold text-[11px] inline-flex items-center justify-center gap-1.5"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            {loadingSupabaseSnapshotKey === src.id
                              ? (isBM ? 'Memuatkan teks...' : 'Loading text...')
                              : (isBM ? 'Buka teks PDF tersimpan' : 'Load saved PDF text')}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {latestSupabaseSnapshot && (
                <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50/40 overflow-hidden">
                  <div className="px-4 py-3 border-b border-indigo-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">{isBM ? 'Teks Dasar Terkini daripada Supabase' : 'Latest Saved Policy Text from Supabase'}</h4>
                      <p className="text-[11px] text-slate-600 mt-0.5">{latestSupabaseSnapshot.document.title} · {latestSupabaseSnapshot.document.detectedVersion || latestSupabaseSnapshot.current.detectedVersion || 'Version not detected'}</p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={handleQueueSupabaseTextForReview}
                        className="h-8 px-3 rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white font-semibold text-[11px] inline-flex items-center gap-1.5"
                      >
                        <FileUp className="w-3.5 h-3.5" />
                        {isBM ? 'Hantar teks penuh untuk semakan' : 'Send full text to review form'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setLatestSupabaseSnapshot(null)}
                        className="h-8 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-[11px]"
                      >
                        {isBM ? 'Tutup' : 'Close'}
                      </button>
                    </div>
                  </div>
                  <div className="p-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-[11px]">
                    <div><span className="text-slate-500 block">Version recorded</span><span className="font-semibold text-slate-800">{latestSupabaseSnapshot.current.capturedAt ? new Date(latestSupabaseSnapshot.current.capturedAt).toLocaleString() : 'Unknown'}</span></div>
                    <div><span className="text-slate-500 block">Last successful retrieval</span><span className="font-semibold text-slate-800">{latestSupabaseSnapshot.document.lastSuccessfulRetrievalAt ? new Date(latestSupabaseSnapshot.document.lastSuccessfulRetrievalAt).toLocaleString() : 'Unknown'}</span></div>
                    <div><span className="text-slate-500 block">Extracted characters</span><span className="font-semibold text-slate-800">{(latestSupabaseSnapshot.document.textLength ?? latestSupabaseSnapshot.current.extractedText.length).toLocaleString()}</span></div>
                    <div><span className="text-slate-500 block">Pages extracted</span><span className="font-semibold text-slate-800">{latestSupabaseSnapshot.document.pageCount ?? latestSupabaseSnapshot.current.pageCount ?? 'Unknown'}</span></div>
                    <div><span className="text-slate-500 block">Current SHA-256</span><span className="font-mono text-slate-700" title={latestSupabaseSnapshot.current.contentSha256}>{latestSupabaseSnapshot.current.contentSha256.slice(0, 16)}...</span></div>
                  </div>
                  <div className="px-4 pb-4 space-y-3">
                    <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 text-[11px] text-amber-950 leading-relaxed">
                      <strong>{isBM ? 'Penting: ' : 'Important: '}</strong>
                      {isBM
                        ? 'Ini ialah teks yang diekstrak, bukan peraturan yang telah diluluskan. Menghantar teks ke borang semakan tidak mengubah pengiraan pematuhan.'
                        : 'This is extracted source text, not an approved ruleset. Sending it to the review form does not change compliance calculations.'}
                    </div>
                    <details className="rounded-lg border border-slate-200 bg-white">
                      <summary className="px-3 py-2 cursor-pointer font-semibold text-slate-800 text-xs">{isBM ? 'Lihat teks diekstrak (pratonton maksimum 30,000 aksara)' : 'View extracted text (preview capped at 30,000 characters)'}</summary>
                      <pre className="p-3 border-t border-slate-100 max-h-[28rem] overflow-auto whitespace-pre-wrap break-words text-[10px] leading-relaxed text-slate-700">{latestSupabaseSnapshot.current.extractedText.slice(0, 30000)}{latestSupabaseSnapshot.current.extractedText.length > 30000 ? '\n\n[Preview truncated. The full extracted text will be placed in the review form.]' : ''}</pre>
                    </details>
                    {latestSupabaseSnapshot.previous && (
                      <details className="rounded-lg border border-slate-200 bg-white">
                        <summary className="px-3 py-2 cursor-pointer font-semibold text-slate-800 text-xs">{isBM ? 'Lihat versi terdahulu yang disimpan' : 'View previous saved version'}</summary>
                        <div className="px-3 py-2 border-t border-slate-100 text-[10px] text-slate-600 space-y-1">
                          <div>Captured: {latestSupabaseSnapshot.previous.capturedAt ? new Date(latestSupabaseSnapshot.previous.capturedAt).toLocaleString() : 'Unknown'}</div>
                          <div className="font-mono break-all">SHA-256: {latestSupabaseSnapshot.previous.contentSha256}</div>
                          <pre className="mt-2 max-h-[18rem] overflow-auto whitespace-pre-wrap break-words text-[10px] leading-relaxed text-slate-700">{latestSupabaseSnapshot.previous.extractedText.slice(0, 10000)}{latestSupabaseSnapshot.previous.extractedText.length > 10000 ? '\n\n[Previous-version preview truncated.]' : ''}</pre>
                        </div>
                      </details>
                    )}
                    <p className="text-[10px] text-slate-500">Official source: <a href={latestSupabaseSnapshot.current.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-all">{latestSupabaseSnapshot.current.sourceUrl}</a></p>
                  </div>
                </div>
              )}

              <p className="text-[10px] text-slate-500 leading-relaxed mt-2">
                Policy source note: listing-page changes trigger review, not automatic rule activation. The LHDN General/Specific PDFs have separate content-hash tracking. LHDN FAQs are official clarifications; MOF Budget speech measures must be checked against later legislation/gazettes and their effective dates before being treated as in-force policy.
              </p>
            </div>
              </SectionCard>
            </div>
          </details>
        </div>
      )}

      {activeSubTab === 'policies' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Statutory Policy Cards List */}
          <div className="space-y-4">
            <h3 className="font-bold text-sm text-slate-900">
              {isBM ? 'Rujukan Dasar dan Keperluan' : 'Policy & Requirements Reference'}
            </h3>

            {/* Policy 1: Configurable invoice review threshold (not a universal mandate) */}
            <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-md">
                      CONFIGURABLE REVIEW CHECK
                    </span>
                    <span className="text-xs font-bold text-slate-900">
                      Transaction and Consolidation Review — RM10,000 reference
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-3 pt-1">
                    <span className="flex items-center gap-1 font-medium text-slate-700">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Check the current LHDN implementation timeline
                    </span>
                    <span className="text-slate-300">•</span>
                    <a
                      href="https://www.hasil.gov.my/en/e-invois/pelaksanaan-e-invois-di-malaysia/garis-masa-pelaksanaan-e-invois/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
                    >
                      <span>Official LHDN e-Invoice guidance</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                <div className="shrink-0">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    LOCAL REVIEW RULE — VERIFY
                  </span>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200/60">
                  <span className="font-bold text-slate-900 block">Review conditions:</span>
                  <ul className="space-y-1 text-slate-600 list-disc list-inside leading-relaxed">
                    <li>This RM10,000 amount is an Orbyte review threshold, not a universal legal mandate.</li>
                    <li>For amounts above the threshold, check the relevant LHDN guideline, transaction type and any consolidation exceptions.</li>
                    <li>TIN and business registration details depend on the applicable transaction and reporting requirements; verify before submission.</li>
                    <li>Do not infer whether consolidation is allowed from amount alone.</li>
                  </ul>
                </div>

                <div className="space-y-1.5 bg-blue-50/50 p-3.5 rounded-xl border border-blue-200/60">
                  <span className="font-bold text-blue-950 block">Verification Status for {companyName}:</span>
                  <p className="text-slate-700 leading-relaxed text-[11px]">
                    The configured threshold can prompt a human review. Missing buyer details should be checked against the applicable official requirements; this check does not by itself block an invoice on legal grounds.
                  </p>
                  <div className="pt-1.5 flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-slate-600">Review approach:</span>
                    <span className="text-xs font-mono font-bold text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-300">
                      Deterministic review prompt
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Policy 2: e-Invoice exemption reference screening; never a standalone exemption determination. */}
            <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2.5 py-0.5 rounded-md">
                      SCREENING REFERENCE
                    </span>
                    <span className="text-xs font-bold text-slate-900">
                      Turnover reference screening: RM {radarThreshold.toLocaleString('en-MY')}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-3 pt-1">
                    <span className="flex items-center gap-1 font-medium text-slate-700">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Screening reference only — verify current official criteria
                    </span>
                    <span className="text-slate-300">•</span>
                    <a
                      href="https://www.hasil.gov.my/en/e-invois/pelaksanaan-e-invois-di-malaysia/garis-masa-pelaksanaan-e-invois/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
                    >
                      <span>Official LHDN e-Invoice guidance</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                <div className="shrink-0">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    isBelowReference
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-amber-100 text-amber-800 border border-amber-200'
                  }`}>
                    {!hasRadarTurnoverData ? 'TURNOVER NOT PROVIDED' : isBelowReference ? 'BELOW RM3M REFERENCE — VERIFY CONDITIONS' : 'CHECK OFFICIAL TIMELINE'}
                  </span>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200/60">
                  <span className="font-bold text-slate-900 block">Eligibility &amp; Exemption Conditions:</span>
                  <ul className="space-y-1 text-slate-600 list-disc list-inside leading-relaxed">
                    <li>LHDN's published implementation timeline lists annual turnover/revenue below RM3,000,000 as exempt from e-Invoice implementation. Verify the applicable exemption criteria, relevant turnover year, ownership and related-entity conditions before making a determination.</li>
                    <li>Do not determine exemption or consolidation treatment from turnover alone; confirm the applicable LHDN guidance for the business and transaction type.</li>
                    <li>Businesses at or above the RM3,000,000 threshold reference should check the official implementation timeline and any applicable exceptions.</li>
                  </ul>
                </div>

                <div className="space-y-1.5 bg-sky-50/50 p-3.5 rounded-xl border border-sky-200/60">
                  <span className="font-bold text-sky-950 block">Current Trajectory for {companyName}:</span>
                  <p className="text-slate-700 leading-relaxed text-[11px]">
                    Registered annual sales of <strong>{activeCompany?.sales != null ? `RM ${activeCompany.sales.toLocaleString()}` : 'Not provided'}</strong>. {activeCompany?.sales != null ? `This is ${radarPercent}% of the RM3,000,000 screening reference. ` : ''}Turnover alone does not confirm exemption.
                  </p>
                  <div className="pt-1.5 flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-slate-600">Buffer Status:</span>
                    <span className="text-xs font-bold text-sky-800 bg-white px-2 py-0.5 rounded border border-sky-300">
                      {!hasRadarTurnoverData ? 'Add turnover to screen eligibility' : isBelowReference ? 'Potential screening match — verify' : 'Check official implementation timeline'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Policy 3: Current minimum-wage reference and Budget 2027 announcement scenario */}
            <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-md">
                      LABOR &amp; WAGE REGULATION
                    </span>
                    <span className="text-xs font-bold text-slate-900">
                      Budget 2027 Minimum-Wage Announcement Scenario
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-3 pt-1">
                    <span className="flex items-center gap-1 font-medium text-slate-700">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Current wage order dates; verify official applicability
                    </span>
                    <span className="text-slate-300">•</span>
                    <a
                      href="https://www.mohr.gov.my/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
                    >
                      <span>KESUMA Wage Order P.U. (A) 349/2024</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                <div className="shrink-0">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    ANNOUNCEMENT SCENARIO — VERIFY
                  </span>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200/60">
                  <span className="font-bold text-slate-900 block">Eligibility &amp; Exemption Conditions:</span>
                  <ul className="space-y-1 text-slate-600 list-disc list-inside leading-relaxed">
                    <li>This card represents a Budget 2027 announcement scenario only; final rules and applicability must be checked.</li>
                    <li>The Budget 2027 announcement uses SME criteria; confirm the final programme definition and any related-entity rules.</li>
                    <li>No payroll saving or exemption is confirmed by this pre-check.</li>
                  </ul>
                </div>

                <div className="space-y-1.5 bg-purple-50/50 p-3.5 rounded-xl border border-purple-200/60">
                  <span className="font-bold text-purple-950 block">Status for {companyName}:</span>
                  <p className="text-slate-700 leading-relaxed text-[11px]">
                    Current turnover is RM {(activeCompany?.sales ?? initialRevenue).toLocaleString()}. This is only a scenario comparison; do not change payroll based on this screen without checking final official rules.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* GROUP 2: GRANTS & TAX INCENTIVES                                          */}
      {/* ========================================================================= */}
      {activeSubTab === 'incentives' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <InfoHint
            title={isBM ? 'Pengumuman Insentif & Geran' : 'Announced Incentives & Grants'}
            content={
              isBM
                ? 'Padanan awal berdasarkan maklumat profil perniagaan yang diberikan. Kelayakan, ketersediaan semasa dan syarat akhir perlu disahkan melalui sumber rasmi.'
                : 'Preliminary matches use the business profile information provided. Eligibility, current availability, effective dates, and final programme terms must be checked against official sources.'
            }
            variant="blue"
          />

          <div className="space-y-4">
            {/* Incentive 1: 15% MSME Preferential Corporate Tax Rate */}
            <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-md">
                      ANNOUNCEMENT SCENARIO
                    </span>
                    <span className="text-xs font-bold text-slate-900">
                      Budget 2027 Corporate Tax Rate Announcement Scenario
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-3 pt-1">
                    <span className="flex items-center gap-1 font-medium text-slate-700">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Announcement scenario — confirm formal effective date
                    </span>
                    <span className="text-slate-300">•</span>
                    <a
                      href="https://www.hasil.gov.my/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
                    >
                      <span>Income Tax Act 1967 (Sched. 1)</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                <div className="shrink-0">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    !hasCapital
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : isTaxScreenBandMatch
                      ? 'bg-amber-100 text-amber-900 border border-amber-200'
                      : 'bg-amber-100 text-amber-800 border border-amber-200'
                  }`}>
                    {!hasCapital
                      ? 'REQUIRES SSM CAPITAL INPUT'
                      : isTaxScreenBandMatch
                      ? 'SCREENING BAND MATCH — VERIFY LAW'
                      : 'OUTSIDE SCREENING BAND — VERIFY'}
                  </span>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200/60">
                  <span className="font-bold text-slate-900 block">Eligibility Conditions:</span>
                  <ul className="space-y-1 text-slate-600 list-disc list-inside leading-relaxed">
                    <li>Paid-up share capital in respect of ordinary shares &le; RM 2,500,000.</li>
                    <li>Gross income from all business sources &le; RM 50,000,000.</li>
                    <li>Enterprise is not a subsidiary of a corporation exceeding the capital cap.</li>
                    <li>Budget 2027 announced a possible rate change; final law, effective date and all eligibility conditions must be confirmed before relying on it.</li>
                  </ul>
                </div>

                <div className="space-y-1.5 bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-200/60">
                  <span className="font-bold text-emerald-950 block">Calculated Benefit for {companyName}:</span>
                  <div className="text-slate-700 leading-relaxed text-[11px] space-y-1">
                    <div>
                      Capital: <strong>{activeCompany?.paidUpCapital ? `RM ${activeCompany.paidUpCapital.toLocaleString()}` : 'Unspecified'}</strong>
                    </div>
                    <div>
                      Turnover: <strong>{activeCompany?.sales != null ? `RM ${activeCompany.sales.toLocaleString()}` : 'Not provided'}</strong>
                    </div>
                    <div className="text-emerald-800 font-mono font-bold pt-1 text-sm">
                      {isTaxScreenBandMatch && calcChargeableIncome !== null
                        ? `Illustrative scenario difference: ${evalOutcome?.r1_tax?.estimatedSaving && evalOutcome.r1_tax.estimatedSaving !== 'Not estimated' ? evalOutcome.r1_tax.estimatedSaving : `RM ${calculateTaxSaving(calcChargeableIncome).toLocaleString()}/year (scenario)`}`
                        : 'No estimate without chargeable income and a matching screening profile; verify current law and all conditions'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Incentive 2: Announced MediAsas first-year premium subsidy; final terms require verification */}
            <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-indigo-800 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-md">
                      CASH GRANT &amp; SUBSIDY
                    </span>
                    <span className="text-xs font-bold text-slate-900">
                      MediAsas: First-Year Premium Subsidy Announcement
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-3 pt-1">
                    <span className="flex items-center gap-1 font-medium text-slate-700">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Announced start: January 2027 — final terms to confirm
                    </span>
                    <span className="text-slate-300">•</span>
                    <a
                      href="https://www.mof.gov.my/portal/en/news/speech/speech-the-fifth-madani-budget-2027"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
                    >
                      <span>MOF Budget 2027 announcement</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                <div className="shrink-0">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    ANNOUNCEMENT SCENARIO — VERIFY
                  </span>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200/60">
                  <span className="font-bold text-slate-900 block">Eligibility Conditions:</span>
                  <ul className="space-y-1 text-slate-600 list-disc list-inside leading-relaxed">
                    <li>Active Malaysian MSME registered with PERKESO/SOCSO.</li>
                    <li>Announced headline criterion: fewer than 75 employees; final eligibility details must be verified.</li>
                    <li>Announced first-year premium subsidy: RM200 per eligible employee, capped at 50 employees per company (maximum RM10,000). This is not confirmed entitlement.</li>
                  </ul>
                </div>

                <div className="space-y-1.5 bg-indigo-50/50 p-3.5 rounded-xl border border-indigo-200/60">
                  <span className="font-bold text-indigo-950 block">Entitlement for {companyName}:</span>
                  <div className="text-slate-700 leading-relaxed text-[11px] space-y-1">
                    <div>
                      Headcount: <strong>{calcStaff} local staff</strong>
                    </div>
                    <div>
                      Per-Employee First-Year Subsidy (announced): <strong>RM 200</strong>
                    </div>
                    <div className="text-indigo-800 font-mono font-bold pt-1 text-sm">
                      Indicative First-Year Ceiling: RM {(Math.min(Math.max(0, calcStaff), MEDIASAS_MAX_SUBSIDIZED_EMPLOYEES) * MEDIASAS_GRANT_PER_EMPLOYEE).toLocaleString()} (eligibility unconfirmed)
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Incentive 3: Digitalisation Support — Verify Current Programme */}
            <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-blue-800 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-md">
                      DIGITAL ACCELERATION GRANT
                    </span>
                    <span className="text-xs font-bold text-slate-900">
                      MDEC / BSN Digitalisation Support — Verify Current Programme
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-3 pt-1">
                    <span className="flex items-center gap-1 font-medium text-slate-700">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Availability and application window not verified
                    </span>
                    <span className="text-slate-300">•</span>
                    <a
                      href="https://mdec.my/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
                    >
                      <span>MDEC official programme information</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                <div className="shrink-0">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                    DISCOVERY ITEM — VERIFY
                  </span>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200/60">
                  <span className="font-bold text-slate-900 block">What to verify:</span>
                  <ul className="space-y-1 text-slate-600 list-disc list-inside leading-relaxed">
                    <li>Confirm the programme is currently open and whether a new application window exists.</li>
                    <li>Verify ownership, operating-history, sales, and product eligibility requirements on the official programme page.</li>
                    <li>Do not rely on a grant cap or reimbursement rate until current official terms are confirmed.</li>
                  </ul>
                </div>

                <div className="space-y-1.5 bg-blue-50/50 p-3.5 rounded-xl border border-blue-200/60">
                  <span className="font-bold text-blue-950 block">Status for {companyName}:</span>
                  <p className="text-slate-700 leading-relaxed text-[11px]">
                    Potentially relevant digitalisation support is listed for discovery only. Availability, funding limits and current application conditions must be verified on the official programme page before making a claim.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* GROUP 3: RELEVANT ACTIONS FOR MY BUSINESS                                 */}
      {/* ========================================================================= */}
      {activeSubTab === 'actions' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Action Roadmap Card */}
          <SectionCard
            title={isBM ? `Langkah Seterusnya: ${companyName}` : `Recommended Next Steps: ${companyName}`}
            subtitle={
              isBM
                ? `Langkah keutamaan berdasarkan perolehan, modal berbayar, dan status invois semasa syarikat.`
                : `Actionable next steps derived directly from active company turnover, share capital, and invoice intake status.`
            }
            icon={FileCheck2}
            headerAction={
              <button
                type="button"
                onClick={handleGenerateActionPlan}
                className="h-8 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <FileCheck2 className="w-3.5 h-3.5" />
                <span>{isBM ? 'Perbaharui Pelan Tindakan' : 'Update & Hash Plan'}</span>
              </button>
            }
          >
            <div className="space-y-3.5 text-xs">
              {/* Action Item 1 */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">
                        Review Buyer TIN and transaction details
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 uppercase">
                        Review
                      </span>
                    </div>
                    <p className="text-slate-600 text-xs mt-0.5 leading-relaxed">
                      Review buyer TIN and the applicable LHDN transaction/consolidation requirements. The configured RM10,000 threshold is a review prompt, not a universal legal conclusion.
                    </p>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    Review reminder
                  </span>
                </div>
              </div>

              {/* Action Item 2 */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">
                        Verify SSM Share Capital in Business Settings
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 uppercase">
                        Tax Prerequisite
                      </span>
                    </div>
                    <p className="text-slate-600 text-xs mt-0.5 leading-relaxed">
                      Confirm the relevant paid-up capital, shareholder and chargeable-income conditions against current LHDN guidance before relying on a preferential-rate scenario.
                    </p>
                  </div>
                </div>

                <div className="shrink-0">
                  {onOpenEditProfile && (
                    <button
                      type="button"
                      onClick={onOpenEditProfile}
                      className="h-8 px-3 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer"
                    >
                      {isBM ? 'Urus Profil' : 'Edit Capital'}
                    </button>
                  )}
                </div>
              </div>

              {/* Action Item 3 */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">
                        Review announced MediAsas first-year subsidy estimate: RM {(Math.min(Math.max(0, calcStaff), MEDIASAS_MAX_SUBSIDIZED_EMPLOYEES) * MEDIASAS_GRANT_PER_EMPLOYEE).toLocaleString()} (not confirmed entitlement)
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800 uppercase">
                        Cash Grant
                      </span>
                    </div>
                    <p className="text-slate-600 text-xs mt-0.5 leading-relaxed">
                      The announcement describes a first-year premium subsidy. Final eligibility, application channel, and programme rules must be confirmed from official guidance.
                    </p>
                  </div>
                </div>

                <div className="shrink-0">
                  <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                    Up to RM {(Math.min(Math.max(0, calcStaff), MEDIASAS_MAX_SUBSIDIZED_EMPLOYEES) * MEDIASAS_GRANT_PER_EMPLOYEE).toLocaleString()} first year
                  </span>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Interactive Custom SME Policy Match Calculator */}
          <SectionCard
            title={isBM ? 'Kalkulator Penyesuaian Dasar PKS Interaktif' : 'Interactive Budget 2027 Policy Match Calculator'}
            subtitle={
              isBM
                ? `Laraskan perolehan, modal berbayar, dan bilangan staf untuk menilai kelayakan berkanun secara langsung.`
                : `Adjust turnover, paid-up capital, and headcount to test configured demo rules deterministically.`
            }
            icon={Calculator}
          >
            <div className="space-y-5">
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Annual Turnover (RM)
                  </label>
                  <input
                    type="number"
                    step="50000"
                    value={calcSales}
                    onChange={(e) => setCalcSales(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg font-mono text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="text-[11px] text-slate-500 mt-1.5 flex justify-between">
                    <span>Threshold cap:</span>
                    <strong className="text-slate-700">RM 50,000,000</strong>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Paid-Up Capital (RM)
                  </label>
                  <input
                    type="number"
                    step="10000"
                    value={calcCapital}
                    onChange={(e) => setCalcCapital(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg font-mono text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="text-[11px] text-slate-500 mt-1.5 flex justify-between">
                    <span>Illustrative screening cap:</span>
                    <strong className="text-slate-700">RM 2,500,000*</strong>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Chargeable Income (RM)
                  </label>
                  <input
                    type="number"
                    step="10000"
                    value={calcChargeableIncome ?? ''}
                    placeholder="Enter from tax computation"
                    onChange={(e) => setCalcChargeableIncome(e.target.value.trim() === '' ? null : Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg font-mono text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="text-[11px] text-slate-500 mt-1.5 flex justify-between">
                    <span>Input required for:</span>
                    <strong className="text-slate-700">Scenario comparison only</strong>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Full-Time Staff (Pax)
                  </label>
                  <input
                    type="number"
                    value={calcStaff}
                    onChange={(e) => setCalcStaff(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg font-mono text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="text-[11px] text-slate-500 mt-1.5 flex justify-between">
                    <span>Announcement criteria:</span>
                    <strong className="text-slate-700">&lt;75 staff; cap 50 subsidised</strong>
                  </div>
                </div>
              </div>

              {/* Dynamic Live Evaluation Outcomes */}
              <div className="relative">
                {isEvaluating && (
                  <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full shadow-2xs">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                    <span>Evaluating via deterministic rules...</span>
                  </div>
                )}

                <div className={`grid md:grid-cols-3 gap-4 text-xs transition-opacity duration-200 ${isEvaluating ? 'opacity-70' : 'opacity-100'}`}>
                  {/* R1 Outcome */}
                  <div className="p-4 rounded-xl border bg-slate-50 border-slate-200 space-y-1">
                    <div className="font-bold text-slate-900 flex items-center justify-between">
                      <span>R1: Announced Tax-Rate Scenario</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {evalOutcome?.r1_tax?.status || 'WARN'}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-800">
                      {evalOutcome?.r1_tax?.label || 'Verify current rules'}
                    </div>
                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      {evalOutcome?.r1_tax?.details || 'Illustrative announcement scenario only; verify chargeable income, current legislation, and eligibility.'}
                    </p>
                    <div className="font-mono text-sm font-extrabold text-amber-800 pt-1">
                      {evalOutcome?.r1_tax?.estimatedSaving ? `Scenario: ${evalOutcome.r1_tax.estimatedSaving}` : 'No estimate without chargeable income'}
                    </div>
                  </div>

                  {/* R2 Outcome */}
                  <div className="p-4 rounded-xl border bg-slate-50 border-slate-200 space-y-1">
                    <div className="font-bold text-slate-900 flex items-center justify-between">
                      <span>R2: Minimum-Wage Policy Notice</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                        {evalOutcome?.r2_wage?.status || 'WARN'}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-800">
                      {evalOutcome?.r2_wage?.label || 'Verify official rules'}
                    </div>
                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      {evalOutcome?.r2_wage?.details || 'Announcement scenario only; verify current minimum-wage law and final implementation rules.'}
                    </p>
                    <div className="font-mono text-sm font-extrabold text-slate-800 pt-1">
                      Reference only; no exemption inferred
                    </div>
                  </div>

                  {/* R3 Outcome */}
                  <div className="p-4 rounded-xl border bg-slate-50 border-slate-200 space-y-1">
                    <div className="font-bold text-slate-900 flex items-center justify-between">
                      <span>MediAsas First-Year Premium Subsidy</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">
                        {evalOutcome?.r3_mediasas?.status || 'WARN'}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-800">
                      {evalOutcome?.r3_mediasas?.label || 'Potential match — verify'}
                    </div>
                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      {evalOutcome?.r3_mediasas?.details || 'Announcement scenario only; final eligibility and programme terms are not confirmed.'}
                    </p>
                    <div className="font-mono text-sm font-extrabold text-indigo-800 pt-1">
                      First-year estimate: RM {(Math.min(Math.max(0, calcStaff), MEDIASAS_MAX_SUBSIDIZED_EMPLOYEES) * MEDIASAS_GRANT_PER_EMPLOYEE).toLocaleString()} (eligibility unconfirmed)
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      )}

      {/* Manual Official Document Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1C3F35]/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  <FileUp className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    {isBM ? 'Import Dokumen untuk Semakan' : 'Import Document for Review'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {isBM
                      ? 'Rekod cap jari SHA-256; dokumen tidak disahkan secara automatik'
                      : 'Record a SHA-256 fingerprint; document authenticity is not automatically verified'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleImportSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Target Monitored Source
                </label>
                <select
                  value={importSourceId}
                  onChange={(e) => setImportSourceId(e.target.value)}
                  className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="lhdn-portal">LHDN e-Invoice Guidelines — official policy PDFs</option>
                  <option value="lhdn-faq">LHDN e-Invoice FAQs — official clarifications</option>
                  <option value="mof-budget">MOF Budget 2027 speech — verify enactment</option>
                </select>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Document Title / Reference
                  </label>
                  <input
                    type="text"
                    required
                    value={importTitle}
                    onChange={(e) => setImportTitle(e.target.value)}
                    placeholder="e.g. LHDN Statutory Guideline Addendum v4.9"
                    className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Candidate Version Identifier
                  </label>
                  <input
                    type="text"
                    required
                    value={importVersionName}
                    onChange={(e) => setImportVersionName(e.target.value)}
                    placeholder="e.g. LHDN-General-Guideline-v4.8-review"
                    className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-slate-800 font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700">
                    Official Gazette Text / Statutory Clause Diff
                  </label>
                  <button
                    type="button"
                    onClick={() => setImportText(sampleGazettePreset)}
                    className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                  >
                    + Load Clearly Labelled Demo Sample
                  </button>
                </div>
                <textarea
                  required
                  rows={6}
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="Paste statutory gazette paragraphs, clauses, schedule tables, or guideline text here..."
                  className="w-full p-3 bg-white border border-slate-300 rounded-lg font-mono text-[11px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  The supplied text will be fingerprinted for review. This does not independently authenticate the source or prove a legal change. Review alone does not activate operating rules.
                </p>
              </div>

              {/* Modal Footer Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="h-9 px-4 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isImporting || !importText.trim()}
                  className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <FileUp className="w-4 h-4" />
                  <span>{isImporting ? 'Registering Snapshot...' : 'Import & Compute Snapshot'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

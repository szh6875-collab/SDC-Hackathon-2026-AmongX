import React from 'react';
import {
  Sparkles,
  TrendingUp,
  Building2,
  HelpCircle,
  Receipt,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  X,
  ShieldCheck,
  FileText,
  Radio,
  Users,
  DollarSign,
  AlertCircle,
  BookOpen,
} from 'lucide-react';
import { PageHeader, SectionCard, StatusBadge, InfoHint } from './common';
import { FinancialImpactRecalculation, OwnerNotification, InvoiceDraft } from '../types';
import { EXEMPTION_RADAR_THRESHOLD } from '../constants/policyConstants';

interface OverviewViewProps {
  onNavigateTab: (tabId: string) => void;
  language: 'en' | 'bm';
  companyName?: string;
  ownerName?: string;
  onOpenEditProfile?: () => void;
  pendingApprovalsCount?: number;
  isPolicyStale?: boolean;
  onOpenWelcomeGuide?: () => void;
  financialImpact?: FinancialImpactRecalculation | null;
  ownerNotifications?: OwnerNotification[];
  onDismissNotification?: (id: string) => void;
  onRecalculateFinancials?: () => void;
  activePolicyVersion?: string;
  drafts?: InvoiceDraft[];
  activeCompanyId?: string;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  onNavigateTab,
  language,
  companyName = 'ABC Trading Sdn. Bhd.',
  ownerName = 'Ahmad Razak',
  onOpenEditProfile,
  pendingApprovalsCount = 0,
  isPolicyStale = true,
  onOpenWelcomeGuide,
  financialImpact,
  ownerNotifications = [],
  onDismissNotification,
  onRecalculateFinancials,
  activePolicyVersion = 'LHDN-General-Guideline-v4.8',
  drafts = [],
  activeCompanyId = 'COMP-A',
}) => {
  const isBM = language === 'bm';

  const activeNotification = ownerNotifications.find((n) => !n.dismissed);

  // Actual Application Data Computations
  const pendingInvoices = drafts.filter((d) => d.status !== 'approved');
  const approvedInvoices = drafts.filter((d) => d.status === 'approved');
  const totalPendingAmount = pendingInvoices.reduce(
    (sum, d) => sum + (d.parsedAmount || d.amount || 0),
    0
  );
  const highValuePending = pendingInvoices.filter(
    (d) => (d.parsedAmount || d.amount || 0) > 10000
  );
  const missingTinInvoices = pendingInvoices.filter(
    (d) => !d.buyer_tin && !d.fields?.buyerTIN
  );

  const annualTurnover = financialImpact?.metrics?.annualTurnover || 0;
  const staffCount = financialImpact?.metrics?.staffCount || 0;
  const hasTurnoverData = Number.isFinite(annualTurnover) && annualTurnover > 0;
  const isBelowThresholdReference = hasTurnoverData && annualTurnover < EXEMPTION_RADAR_THRESHOLD;
  const isApproachingThreshold = hasTurnoverData && annualTurnover >= EXEMPTION_RADAR_THRESHOLD * 0.8 && annualTurnover < EXEMPTION_RADAR_THRESHOLD;

  // Build Unified "Today's Priorities" List from actual data
  interface PriorityItem {
    id: string;
    category: 'invoice' | 'data';
    priority: 'urgent' | 'warning' | 'info';
    title: string;
    description: string;
    actionLabel: string;
    targetTab: string;
  }

  const priorities: PriorityItem[] = [];

  // Priority 1: invoices crossing a configured review threshold with missing buyer TIN
  highValuePending
    .filter((d) => !d.buyer_tin && !d.fields?.buyerTIN)
    .forEach((d) => {
      const invNum = d.invoiceNumber || d.draft_id;
      const amountStr = (d.parsedAmount || d.amount || 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      priorities.push({
        id: `inv-tin-${d.draft_id}`,
        category: 'invoice',
        priority: 'urgent',
        title: isBM
          ? `Invois #${invNum} (RM ${amountStr}): Tiada No. TIN Pembeli`
          : `Invoice #${invNum} (RM ${amountStr}): Missing Buyer TIN`,
        description: isBM
          ? `Invois ini melepasi ambang semakan RM10,000 (${d.company || 'Pembeli'}) dan tiada TIN pembeli. Sahkan peraturan LHDN serta jenis transaksi sebelum mengeluarkan invois.`
          : `This invoice crosses the configured RM10,000 review threshold (${d.company || 'Buyer'}) and has no buyer TIN. Confirm the applicable LHDN rule and transaction type before issuing it.`,
        actionLabel: isBM ? 'Lengkapkan Invois' : 'Review & Add TIN',
        targetTab: 'invoices',
      });
    });

  // Priority 3: Other pending invoice sign-offs
  const readyForSignOff = pendingInvoices.filter(
    (d) => d.status === 'Ready' || d.status === 'pending_approval'
  );
  if (readyForSignOff.length > 0) {
    priorities.push({
      id: 'invoices-ready-signoff',
      category: 'invoice',
      priority: 'warning',
      title: isBM
        ? `${readyForSignOff.length} Invois Sedia untuk Tandatangan Pengarah`
        : `${readyForSignOff.length} Ready Invoice(s) Awaiting Owner Sign-Off`,
      description: isBM
        ? `Semua medan statutori telah disahkan. Menunggu kuasa kelulusan daripada ${ownerName} sebelum pengeluaran.`
        : `Structured validations passed. Authorization by ${ownerName} is pending before final export.`,
      actionLabel: isBM ? 'Buka Senarai Kelulusan' : 'Go to Sign-Off Queue',
      targetTab: 'invoices',
    });
  } else if (pendingInvoices.length > 0 && highValuePending.length === 0) {
    priorities.push({
      id: 'invoices-pending-review',
      category: 'invoice',
      priority: 'warning',
      title: isBM
        ? `${pendingInvoices.length} Draf Invois Memerlukan Semakan`
        : `${pendingInvoices.length} Draft Invoice(s) in Intake Queue`,
      description: isBM
        ? `Terdapat draf invois baharu yang dimuat naik dan menunggu pengesahan medan cukai.`
        : `New invoice intakes require field confirmation and tax rate checks.`,
      actionLabel: isBM ? 'Semak Draf Invois' : 'Review Invoices',
      targetTab: 'invoices',
    });
  }

  // Priority 4: Missing SSM Profile Data for accurate tax computation
  if (financialImpact?.missingData && financialImpact.missingData.length > 0) {
    financialImpact.missingData.forEach((m) => {
      priorities.push({
        id: `missing-${m.id}`,
        category: 'data',
        priority: m.severity === 'high' ? 'urgent' : 'warning',
        title: isBM ? `Maklumat Diperlukan: ${m.label}` : `Profile Data Required: ${m.label}`,
        description: isBM
          ? `${m.impact}. Nilai tidak diada-adakan untuk memelihara ketepatan statutori.`
          : `${m.impact}. Value is left unpopulated to protect compliance fidelity.`,
        actionLabel: isBM ? 'Kemas Kini Tetapan' : 'Update Settings',
        targetTab: m.actionTab || 'business',
      });
    });
  }


  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Page Header */}
      <PageHeader
        tag={isBM ? 'Ruang Kerja PKS' : 'SME Workspace'}
        tagIcon={Sparkles}
        title={isBM ? 'Ringkasan Perniagaan' : 'Business Overview'}
        description={
          isBM
            ? `Gambaran ringkas ${companyName}: status invois, maklumat profil yang perlu dilengkapkan dan isu dasar yang memerlukan perhatian.`
            : `A quick view of ${companyName}: invoice status, missing business details, and policy items that may need attention.`
        }
        primaryAction={{
          label: isBM ? 'Panduan 60 Saat' : '60-Sec Quick Guide',
          icon: HelpCircle,
          onClick: () => onOpenWelcomeGuide?.(),
          variant: 'secondary',
        }}
        secondaryAction={{
          label: isBM ? 'Tetapan Syarikat' : 'Business Settings',
          icon: Building2,
          onClick: () => onNavigateTab('business'),
          variant: 'ghost',
        }}
      />

      {/* Active business and source verification status */}
      <div className="bg-[#1C3F35] text-white rounded-xl p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-500/20 text-sky-400 border border-blue-400/30 flex items-center justify-center font-bold">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs sm:text-sm uppercase tracking-wider text-slate-300 font-bold font-mono">
              {isBM ? 'Perniagaan Semasa' : 'Active Business'}
            </div>
            <div className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <span>{companyName}</span>
              <span className="text-slate-400">•</span>
              <span className="text-sm sm:text-base font-medium text-slate-200">
                {isBM ? 'Pemilik Perniagaan:' : 'Business Owner:'}{' '}
                <strong className="text-white text-base sm:text-lg font-bold">{ownerName}</strong>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="text-sm sm:text-base bg-slate-800 text-slate-200 px-3.5 py-1.5 rounded-lg border border-slate-700 font-mono flex items-center gap-2">
            <span>Policy:</span>
            <strong className="text-white">{activePolicyVersion}</strong>
            {isPolicyStale && (
              <span className="text-xs sm:text-sm px-2.5 py-0.5 rounded font-bold bg-amber-400 text-slate-950 uppercase">
                Verify source
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Owner Notification Alert Banner if present */}
      {activeNotification && (
        <div className="p-3 sm:p-4 rounded-xl border border-blue-300 bg-gradient-to-r from-blue-50 via-indigo-50/40 to-white shadow-xs flex flex-col xl:flex-row items-start xl:items-center justify-between gap-3 animate-in fade-in max-w-full overflow-hidden">
          <div className="flex items-center gap-3 min-w-0 flex-1 w-full xl:w-auto overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden whitespace-nowrap">
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-blue-700 bg-blue-100 px-2.5 py-1 rounded shrink-0">
                  Owner Directive
                </span>
                <span className="text-xs sm:text-sm text-slate-500 font-mono shrink-0 hidden sm:inline">
                  {new Date(activeNotification.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 shrink-0 inline m-0">
                {activeNotification.title}:
              </h3>
              <p
                className="text-xs sm:text-sm text-slate-700 font-medium truncate inline m-0"
                title={`${activeNotification.title}: ${activeNotification.message}`}
              >
                {activeNotification.message}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full xl:w-auto justify-start xl:justify-end flex-wrap sm:flex-nowrap">
            {activeNotification.recommendedActions?.map((act, idx) => {
              // Compact labels so all 4 buttons fit cleanly inside the div frame
              let displayLabel = act.label;
              if (act.label.toLowerCase().includes('ssm') || act.label.toLowerCase().includes('resolve') || act.label.toLowerCase().includes('profile')) {
                displayLabel = isBM ? 'Profil Syarikat' : 'Company Profile';
              } else if (act.label.toLowerCase().includes('invoice') || act.label.toLowerCase().includes('threshold')) {
                displayLabel = isBM ? 'Semak Invois' : 'Review Invoices';
              } else if (act.label.toLowerCase().includes('screening') || act.label.toLowerCase().includes('sme') || act.label.toLowerCase().includes('policy')) {
                displayLabel = isBM ? 'Pusat Dasar' : 'Policy Center';
              } else if (act.label.toLowerCase().includes('radar') || act.label.toLowerCase().includes('reference')) {
                displayLabel = isBM ? 'Radar Pelepasan' : 'Threshold Radar';
              }

              return (
                <button
                  key={idx}
                  onClick={() => onNavigateTab(act.tab)}
                  title={act.label}
                  className="px-3 sm:px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white transition-all cursor-pointer whitespace-nowrap shadow-xs hover:shadow-sm"
                >
                  {displayLabel}
                </button>
              );
            })}
            {onDismissNotification && (
              <button
                onClick={() => onDismissNotification(activeNotification.id)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors shrink-0"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Three concise status cards based on current business data */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* KPI 1: e-Invoice Review Queue */}
        <div
          onClick={() => onNavigateTab('invoices')}
          className="p-4 sm:p-5 rounded-xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm font-bold font-mono uppercase tracking-wider text-slate-700">
                {isBM ? 'Invois Menunggu Kelulusan' : 'Pending e-Invoices'}
              </span>
              <Receipt className="w-5 h-5 text-blue-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold font-mono text-slate-900">
              {pendingInvoices.length}
              <span className="text-sm font-medium text-slate-500 ml-2">
                {pendingInvoices.length === 1 ? 'draft' : 'drafts'}
              </span>
            </div>
            <div className="text-sm sm:text-base font-mono font-bold text-slate-800 mt-1.5">
              RM{' '}
              {totalPendingAmount.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </div>
          <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs sm:text-sm">
            <span
              className={
                highValuePending.length > 0 ? 'text-amber-700 font-bold' : 'text-slate-600 font-medium'
              }
            >
              {highValuePending.length > 0
                ? `${highValuePending.length} configured-threshold reviews`
                : 'No configured-threshold reviews'}
            </span>
            <ArrowRight className="w-4 h-4 text-slate-400" />
          </div>
        </div>

        {/* KPI 2: Turnover Reference Check */}
        <div
          onClick={() => onNavigateTab('compliance')}
          className="p-4 sm:p-5 rounded-xl border border-slate-200 bg-white hover:border-sky-300 hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm font-bold font-mono uppercase tracking-wider text-slate-700">
                {isBM ? 'Unjuran Perolehan Tahunan' : 'Annual Sales Turnover'}
              </span>
              <Radio className="w-5 h-5 text-sky-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold font-mono text-slate-900">
              {hasTurnoverData
                ? (financialImpact?.metrics?.annualTurnoverDisplay || `RM ${annualTurnover.toLocaleString()}`)
                : (isBM ? 'Belum diisi' : 'Not provided')}
            </div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-full text-center inline-flex items-center justify-center leading-tight ${
                  !hasTurnoverData
                    ? 'bg-slate-100 text-slate-700'
                    : isBelowThresholdReference
                    ? 'bg-amber-100 text-amber-800'
                    : isApproachingThreshold
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-blue-100 text-blue-800'
                }`}
              >
                {!hasTurnoverData
                  ? (isBM ? 'LENGKAPKAN PROFIL' : 'COMPLETE PROFILE')
                  : isBelowThresholdReference
                    ? (isBM ? 'BAWAH RUJUKAN RM3J — SEMAK SYARAT' : 'BELOW RM3M REFERENCE — VERIFY CONDITIONS')
                    : isApproachingThreshold
                      ? (isBM ? 'SEMAK HAMPIR AMBANG' : 'REVIEW NEAR REFERENCE')
                      : (isBM ? 'SEMAK KEHENDAK RASMI' : 'CHECK OFFICIAL TIMELINE')}
              </span>
            </div>
          </div>
          <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs sm:text-sm text-slate-600">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-tight">
              RM3M reference only; verify official exemption criteria
            </span>
            <ArrowRight className="w-4 h-4 text-slate-400" />
          </div>
        </div>

        {/* KPI 3: Business profile completeness */}
        <div
          onClick={() => onNavigateTab('business')}
          className="p-4 sm:p-5 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm font-bold font-mono uppercase tracking-wider text-slate-700">
                {isBM ? 'Maklumat Profil Belum Lengkap' : 'Profile Details to Confirm'}
              </span>
              <Building2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold font-mono text-slate-900">
              {financialImpact?.missingData?.length ?? 0}
              <span className="text-sm font-medium text-slate-500 ml-2">{isBM ? 'item' : 'items'}</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 mt-1.5 leading-relaxed">
              {isBM ? 'Lengkapkan data yang diperlukan untuk semakan yang lebih tepat.' : 'Complete missing details to improve eligibility and compliance screening.'}
            </p>
          </div>
          <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs sm:text-sm">
            <span className="text-xs sm:text-sm font-bold text-slate-700 uppercase tracking-tight">
              {isBM ? 'Buka Tetapan Perniagaan' : 'Open Business Settings'}
            </span>
            <ArrowRight className="w-4 h-4 text-slate-400" />
          </div>
        </div>
      </div>

      {/* UNIFIED TODAY'S PRIORITIES LIST */}
      <SectionCard
        title={isBM ? 'Keutamaan Hari Ini' : "Today's Priorities"}
        subtitle={
          isBM
            ? `Senarai tindakan berpusat bagi invois aktif, jurang data SSM, dan kemas kini statutori.`
            : `One action queue for invoice reviews, profile gaps, and relevant policy updates.`
        }
        icon={Clock}
        headerBadge={
          <span className="text-xs sm:text-sm font-mono font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-800">
            {priorities.length} {priorities.length === 1 ? 'Action' : 'Actions'}
          </span>
        }
      >
        {priorities.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <h4 className="text-base font-bold text-slate-900">
              {isBM ? 'Semua Keutamaan Selesai' : 'All Priorities Clear'}
            </h4>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              {isBM
                ? 'Tiada semakan invois atau maklumat perniagaan yang memerlukan tindakan buat masa ini.'
                : 'No invoice reviews or missing business details currently need action.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {priorities.map((item) => (
              <div
                key={item.id}
                className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 hover:bg-slate-50/70 p-2.5 rounded-lg transition-colors"
              >
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  <div
                    className={`mt-0.5 w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
                      item.priority === 'urgent'
                        ? 'bg-rose-100 text-rose-700'
                        : item.priority === 'warning'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {item.priority === 'urgent' ? (
                      <AlertTriangle className="w-4 h-4" />
                    ) : item.priority === 'warning' ? (
                      <AlertCircle className="w-4 h-4" />
                    ) : (
                      <InfoHint variant="blue" title="" content="" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm sm:text-base text-slate-900">{item.title}</span>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded uppercase ${
                          item.priority === 'urgent'
                            ? 'bg-rose-100 text-rose-800'
                            : item.priority === 'warning'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {item.priority}
                      </span>
                      <span className="text-xs text-slate-500 font-mono uppercase">
                        [{item.category}]
                      </span>
                    </div>
                    <p className="text-sm sm:text-base text-slate-700 mt-1 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => onNavigateTab(item.targetTab)}
                  className={`h-9 px-4 rounded-lg text-xs sm:text-sm font-semibold shrink-0 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                    item.priority === 'urgent'
                      ? 'bg-rose-600 hover:bg-rose-700 text-white'
                      : 'bg-[#1C3F35] hover:bg-[#285443] text-white'
                  }`}
                >
                  <span>{item.actionLabel}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Concise policy watch. Detailed eligibility analysis stays on the Policies page. */}
      <SectionCard
        title={isBM ? 'Pantauan Dasar' : 'Policy Watch'}
        subtitle={isBM
          ? 'Perkara dasar yang memerlukan perhatian dan tindakan seterusnya. Syarat kelayakan terperinci kekal di halaman Dasar & Faedah.'
          : 'Policy items that may need attention and their next steps. Detailed eligibility checks remain on Policies & Benefits.'}
        icon={BookOpen}
        headerBadge={
          <span className={`text-xs sm:text-sm font-semibold px-3 py-1 rounded-full ${isPolicyStale ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
            {isPolicyStale ? (isBM ? 'Perlu disemak' : 'Review needed') : (isBM ? 'Status sumber' : 'Source status')}
          </span>
        }
      >
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 rounded-lg border border-slate-200 p-3.5">
            <div className="flex items-start gap-3 min-w-0">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isPolicyStale ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}`}>
                {isPolicyStale ? <AlertTriangle className="w-4.5 h-4.5" /> : <ShieldCheck className="w-4.5 h-4.5" />}
              </div>
              <div className="min-w-0">
                <h4 className="text-base sm:text-lg font-bold text-slate-900">
                  {isPolicyStale
                    ? (isBM ? 'Sumber dasar rasmi perlu disahkan' : 'Official policy source needs verification')
                    : (isBM ? 'Tiada amaran semakan sumber pada papan pemuka' : 'No source-review alert is currently flagged')}
                </h4>
                <p className="text-sm sm:text-base text-slate-700 leading-relaxed mt-1.5">
                  {isPolicyStale
                    ? (isBM
                      ? `Rujukan semasa: ${activePolicyVersion}. Semakan langsung terkini belum disahkan; ini bukan bukti bahawa dasar telah berubah. Sahkan sumber rasmi sebelum bergantung pada kadar, tarikh atau manfaat.`
                      : `Current reference: ${activePolicyVersion}. A recent live source check is not verified; this is not proof that a policy has changed. Verify the official source before relying on a rate, date, or benefit.`)
                    : (isBM
                      ? `Rujukan semasa: ${activePolicyVersion}. Tiada amaran semakan sumber dipaparkan sekarang; ini tidak menjamin kelayakan atau membuktikan semua peraturan tidak berubah.`
                      : `Current reference: ${activePolicyVersion}. No source-review alert is shown right now; this does not guarantee eligibility or prove that every rule is unchanged.`)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('compliance')}
              className="h-9 px-4 rounded-lg bg-[#1C3F35] hover:bg-[#285443] text-white text-xs sm:text-sm font-semibold shrink-0 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>{isBM ? 'Semak sumber' : 'Review source'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {isApproachingThreshold && (
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3.5">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-4.5 h-4.5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-base sm:text-lg font-bold text-slate-900">
                    {isBM ? 'Perolehan menghampiri rujukan RM3 juta' : 'Turnover nearing the RM3M reference band'}
                  </h4>
                  <p className="text-sm sm:text-base text-slate-700 leading-relaxed mt-1.5">
                    {isBM
                      ? `Perolehan tahunan yang direkodkan ialah ${financialImpact?.metrics?.annualTurnoverDisplay || `RM ${annualTurnover.toLocaleString()}`}. Ini hanya saringan awal; syarat pengecualian rasmi dan entiti berkaitan masih perlu disahkan.`
                      : `Recorded annual turnover is ${financialImpact?.metrics?.annualTurnoverDisplay || `RM ${annualTurnover.toLocaleString()}`}. This is an initial screening reference only; official exemption criteria and related-entity conditions still need verification.`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('compliance')}
                className="h-9 px-4 rounded-lg border border-amber-300 bg-white hover:bg-amber-100 text-amber-900 text-xs sm:text-sm font-semibold shrink-0 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>{isBM ? 'Semak kelayakan' : 'Check eligibility'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
};

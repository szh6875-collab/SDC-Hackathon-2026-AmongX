import React, { useCallback, useEffect, useState } from 'react';
import { Activity, BadgeCheck, Download, FileBarChart, Fingerprint, RefreshCw, ShieldAlert, ShieldCheck, Cloud } from 'lucide-react';
import { AuditEntry, FinancialImpactRecalculation, InvoiceDraft } from '../types';
import { api, triggerBrowserDownload } from '../services/api';
import { PageHeader, SectionCard, StatusBadge } from './common';
import {
  googleSignIn,
  getAccessToken,
  findOrCreateDriveFolder,
  uploadFileToDrive,
  DEFAULT_FOLDER_NAME,
} from '../services/googleDriveAuth';

interface InsightsViewProps {
  mode: 'reports' | 'audit';
  activeCompanyId: string;
  companyName: string;
  drafts: InvoiceDraft[];
  language: 'en' | 'bm';
  onShowToast: (type: 'success' | 'warning' | 'error' | 'info', title: string, message: string) => void;
}

const money = (value: unknown) => new Intl.NumberFormat('en-MY', {
  style: 'currency', currency: 'MYR', maximumFractionDigits: 2,
}).format(typeof value === 'number' && Number.isFinite(value) ? value : 0);
const dateTime = (value?: string) => {
  if (!value) return '—';
  const time = new Date(value);
  return Number.isNaN(time.getTime()) ? value : time.toLocaleString();
};

export const InsightsView: React.FC<InsightsViewProps> = ({ mode, activeCompanyId, companyName, drafts, language, onShowToast }) => {
  const isBM = language === 'bm';
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [impact, setImpact] = useState<FinancialImpactRecalculation | null>(null);
  const [verification, setVerification] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ledger, financial] = await Promise.all([
        api.getAuditLedger(activeCompanyId),
        api.getFinancialImpact(activeCompanyId).catch(() => null),
      ]);
      setEntries(Array.isArray(ledger.entries) ? ledger.entries.slice().reverse() : []);
      setImpact(financial);
      if (mode === 'audit') {
        const check = await api.verifyAuditChain();
        setVerification(check);
      }
    } catch (error: any) {
      onShowToast('error', isBM ? 'Gagal memuatkan data' : 'Could not load insights', error?.message || 'Backend request failed.');
    } finally {
      setLoading(false);
    }
  }, [activeCompanyId, isBM, mode, onShowToast]);

  useEffect(() => { void load(); }, [load]);

  const handleExport = async (format: 'csv' | 'xlsm') => {
    setExporting(format);
    try {
      const result = await api.exportAuditLedger(format, activeCompanyId);
      triggerBrowserDownload(result.blob, result.filename);
      onShowToast('success', isBM ? 'Eksport sedia' : 'Export ready', `${result.filename} downloaded.`);
    } catch (error: any) {
      onShowToast('error', isBM ? 'Eksport gagal' : 'Export failed', error?.message || 'Could not export activity records.');
    } finally {
      setExporting(null);
    }
  };

  const [isExportingToDrive, setIsExportingToDrive] = useState(false);
  const handleExportToDrive = async () => {
    setIsExportingToDrive(true);
    try {
      let token = await getAccessToken();
      if (!token) {
        const authRes = await googleSignIn();
        if (!authRes) throw new Error('Authentication required for Google Drive');
      }

      const folderId = await findOrCreateDriveFolder();
      const exportData = {
        companyId: activeCompanyId,
        companyName,
        exportDate: new Date().toISOString(),
        totalAuditEntries: entries.length,
        entries: entries.slice(0, 500),
      };

      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `${activeCompanyId}_Audit_Ledger_${dateStr}.json`;

      await uploadFileToDrive({
        name: filename,
        mimeType: 'application/json',
        content: JSON.stringify(exportData, null, 2),
        folderId,
        description: `Cryptographic SHA-256 audit ledger trail for ${companyName} (${activeCompanyId}).`,
      });

      onShowToast(
        'success',
        isBM ? 'Lejar Disimpan ke Google Drive' : 'Audit Ledger Saved to Drive',
        isBM
          ? `Fail lejar audit (${filename}) berjaya disandarkan ke folder Google Drive "${DEFAULT_FOLDER_NAME}".`
          : `Audit trail (${filename}) successfully backed up to your Google Drive.`
      );
    } catch (err: any) {
      onShowToast('error', 'Google Drive Export Error', err.message);
    } finally {
      setIsExportingToDrive(false);
    }
  };

  const approvedCount = drafts.filter((draft) => draft.status === 'approved').length;
  const pendingCount = drafts.filter((draft) => ['pending_approval', 'Ready'].includes(draft.status)).length;
  const needsReviewCount = drafts.filter((draft) => ['pending_review', 'Review Required', 'Missing Information', 'rejected'].includes(draft.status)).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        tag={mode === 'audit' ? (isBM ? 'Integriti & Rekod' : 'Integrity & Records') : (isBM ? 'Ringkasan Perniagaan' : 'Business Summary')}
        tagIcon={mode === 'audit' ? Fingerprint : FileBarChart}
        title={mode === 'audit' ? (isBM ? 'Jejak Audit' : 'Audit Trail') : (isBM ? 'Laporan & Impak' : 'Reports & Impact')}
        description={mode === 'audit'
          ? (isBM ? 'Semak aktiviti syarikat dan sahkan rantaian hash SHA-256 yang disimpan oleh backend.' : 'Review company activity and verify the SHA-256 hash chain maintained by the backend.')
          : (isBM ? `Ringkasan operasi dan kesan kewangan bagi ${companyName}, berdasarkan data yang tersedia daripada backend.` : `Operational and financial summary for ${companyName}, using the data available from the backend.`)}
        primaryAction={{ label: isBM ? 'Muat Semula' : 'Refresh', icon: RefreshCw, onClick: () => void load(), variant: 'secondary', disabled: loading }}
      />

      {mode === 'reports' ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: isBM ? 'Jumlah Invois' : 'Invoices in workspace', value: String(drafts.length), note: isBM ? 'Mengikut syarikat aktif' : 'Active company only' },
              { label: isBM ? 'Diluluskan' : 'Approved', value: String(approvedCount), note: isBM ? 'Rekod berstatus diluluskan' : 'Records with approved status' },
              { label: isBM ? 'Menunggu Kelulusan' : 'Pending approval', value: String(pendingCount), note: isBM ? 'Perlu tindakan pemilik' : 'Requires authorised review' },
              { label: isBM ? 'Perlu Semakan' : 'Needs review', value: String(needsReviewCount), note: isBM ? 'Isu atau maklumat kurang' : 'Issues or missing information' },
            ].map((metric) => (
              <div key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-xs font-semibold text-slate-500">{metric.label}</div>
                <div className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{loading ? '—' : metric.value}</div>
                <div className="mt-1 text-[11px] text-slate-400">{metric.note}</div>
              </div>
            ))}
          </div>

          <SectionCard title={isBM ? 'Anggaran Impak Kewangan' : 'Financial Impact Estimate'} subtitle={impact ? `${impact.policyVersion} · ${dateTime(impact.calculatedAt)}` : (isBM ? 'Tiada data impak tersedia' : 'No impact calculation available')} icon={Activity}>
            {impact ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl bg-slate-50 p-4"><div className="text-xs text-slate-500">{isBM ? 'Perolehan Tahunan' : 'Annual turnover'}</div><div className="mt-1 text-xl font-bold text-slate-900">{impact.metrics.annualTurnoverDisplay || money(impact.metrics.annualTurnover)}</div></div>
                <div className="rounded-xl bg-slate-50 p-4"><div className="text-xs text-slate-500">{isBM ? 'Cukai Jadual Rujukan (15%/17%/24%)' : 'Reference schedule tax (15%/17%/24%)'}</div><div className="mt-1 text-xl font-bold text-slate-900">{money(impact.taxImpact.baselineTaxMYR)}</div></div>
                <div className="rounded-xl bg-amber-50 p-4"><div className="text-xs text-amber-800">{isBM ? 'Senario Belanjawan 2027 (14%/16%/24%)' : 'Budget 2027 scenario tax (14%/16%/24%)'}</div><div className="mt-1 text-xl font-bold text-amber-900">{money(impact.taxImpact.budget2027ScenarioTaxMYR ?? impact.taxImpact.policyTaxMYR)}</div></div>
                <div className="rounded-xl bg-slate-50 p-4"><div className="text-xs text-slate-500">{isBM ? 'Perbezaan Senario — Belum Disahkan' : 'Scenario difference — unconfirmed'}</div><div className="mt-1 text-xl font-bold text-slate-900">{impact.taxImpact.displaySavings || money(impact.taxImpact.annualTaxSavingsMYR)}</div></div>
                <div className="md:col-span-2 xl:col-span-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">{isBM ? 'Kadar 15%/17%/24% dipaparkan sebagai jadual rujukan yang diterbitkan (YA 2023–2025). Kadar 14%/16%/24% ialah senario pengumuman Belanjawan 2027 sahaja. Semak tahun taksiran, undang-undang muktamad dan tarikh kuat kuasa sebelum membuat keputusan.' : 'The 15%/17%/24% schedule is shown as the published reference (YA 2023–2025). The 14%/16%/24% rates are a Budget 2027 announcement scenario only. Verify the relevant year of assessment, final law and effective date before relying on either figure.'}</div>
              </div>
            ) : (
              <div className="py-5 text-sm text-slate-500">{loading ? (isBM ? 'Memuatkan data...' : 'Loading data…') : (isBM ? 'Backend tidak memulangkan pengiraan impak kewangan untuk syarikat aktif.' : 'The backend did not return a financial impact calculation for the active company.')}</div>
            )}
          </SectionCard>
        </>
      ) : (
        <>
          <SectionCard title={isBM ? 'Pengesahan Integriti Rantaian' : 'Hash-Chain Integrity Check'} subtitle={isBM ? 'Pemeriksaan ini mengesahkan rantaian tempatan yang dimuatkan oleh backend.' : 'This verifies the local ledger chain loaded by the backend.'} icon={verification?.verified ? ShieldCheck : ShieldAlert} headerAction={<StatusBadge status={verification?.verified ? 'PASS' : verification ? 'FAIL' : 'PENDING'} /> }>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-900">{loading ? (isBM ? 'Mengesahkan...' : 'Verifying…') : verification?.message || verification?.status || (isBM ? 'Belum disahkan' : 'Not verified yet')}</div>
                <div className="mt-1 text-xs leading-5 text-slate-500">{verification?.total_entries_checked !== undefined ? `${verification.total_entries_checked} entries checked.` : ''} {isBM ? 'Pengesahan tempatan bukan bukti simpanan luaran yang tidak boleh diubah.' : 'Local verification is not proof of an externally immutable checkpoint.'}</div>
              </div>
              <button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw className="h-4 w-4" />{isBM ? 'Sahkan semula' : 'Verify again'}</button>
            </div>
          </SectionCard>
          <SectionCard title={isBM ? 'Aktiviti Terkini' : 'Recent Activity'} subtitle={`${entries.length} ${isBM ? 'rekod untuk syarikat aktif' : 'records for the active company'}`} icon={Fingerprint} headerAction={<div className="flex gap-2"><button disabled={Boolean(exporting)} onClick={() => void handleExport('csv')} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50">CSV</button><button disabled={Boolean(exporting)} onClick={() => void handleExport('xlsm')} className="rounded-lg bg-[#1C3F35] px-3 py-2 text-xs font-semibold text-white hover:bg-[#285443] disabled:opacity-50">Excel</button><button disabled={isExportingToDrive} onClick={() => void handleExportToDrive()} className="rounded-lg border-2 border-[#1C3F35] bg-white px-3 py-2 text-xs font-semibold text-[#1C3F35] hover:bg-[#FAF5E8] flex items-center gap-1 shadow-[2px_2px_0_#1C3F35]"><Cloud className="h-3.5 w-3.5 text-emerald-700" />Drive</button></div>}>
            {loading ? <div className="py-6 text-sm text-slate-500">{isBM ? 'Memuatkan rekod...' : 'Loading records…'}</div> : entries.length === 0 ? <div className="py-8 text-center text-sm text-slate-500">{isBM ? 'Tiada rekod aktiviti untuk syarikat ini.' : 'No activity records were returned for this company.'}</div> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead><tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500"><th className="py-3 pr-4">Time</th><th className="py-3 pr-4">Action</th><th className="py-3 pr-4">Actor / role</th><th className="py-3 pr-4">Entity</th><th className="py-3">Hash</th></tr></thead>
                  <tbody>{entries.slice(0, 100).map((entry) => <tr key={`${entry.event_id}-${entry.id}`} className="border-b border-slate-100 last:border-0"><td className="whitespace-nowrap py-3 pr-4 text-xs text-slate-500">{dateTime(entry.timestamp)}</td><td className="py-3 pr-4"><div className="font-semibold text-slate-800">{entry.action}</div><div className="mt-0.5 max-w-sm text-xs text-slate-500">{entry.detail}</div></td><td className="py-3 pr-4 text-xs text-slate-600">{entry.actor}<div className="text-slate-400">{entry.role}</div></td><td className="py-3 pr-4 font-mono text-xs text-slate-500">{entry.entity_id}</td><td className="py-3 font-mono text-xs text-slate-500" title={entry.curr_hash}>{entry.curr_hash?.slice(0, 12) || '—'}…</td></tr>)}</tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
};

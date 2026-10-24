import React, { useState } from 'react';
import {
  CheckSquare,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Lock,
  ChevronRight,
  FileText,
  Clock,
  Sparkles,
  Building2,
  Users,
} from 'lucide-react';
import { InvoiceDraft, RoleType } from '../types';
import { api } from '../services/api';
import { PageHeader, SectionCard, StatusBadge } from './common';

export interface ApprovalsViewProps {
  drafts: InvoiceDraft[];
  currentRole: RoleType;
  onItemApproved: () => void;
  language: 'en' | 'bm';
  onShowToast: (type: 'success' | 'warning' | 'error' | 'info', title: string, message: string) => void;
  ownerName?: string;
  companyName?: string;
  onSelectDraft?: (draftId: string) => void;
}

export const ApprovalsView: React.FC<ApprovalsViewProps> = ({
  drafts,
  currentRole,
  onItemApproved,
  language,
  onShowToast,
  ownerName = 'Ahmad Razak',
  companyName = 'ABC Trading Sdn. Bhd.',
  onSelectDraft,
}) => {
  const isBM = language === 'bm';
  const isOwner = currentRole === 'owner';
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const pendingDrafts = drafts.filter((d) => d.status !== 'approved');
  const approvedDrafts = drafts.filter((d) => d.status === 'approved');

  const handleApprove = async (draftId: string) => {
    if (!isOwner) {
      onShowToast(
        'error',
        isBM ? 'Akses Ditolak (RBAC)' : 'Access Denied (RBAC)',
        isBM
          ? 'Hanya Pemilik Syarikat / Pengarah yang mempunyai kebenaran untuk menandatangani invois rasmi.'
          : 'Only SME Owner / Director permissions can authorize official invoice issuance.'
      );
      return;
    }

    setApprovingId(draftId);
    try {
      const res = await api.approveItem(draftId);
      onItemApproved();
      onShowToast(
        'success',
        isBM ? 'e-Invois Diluluskan' : 'e-Invoice Authorized',
        isBM
          ? `Invois ${draftId} bagi ${companyName} telah disahkan oleh ${ownerName} [Audit ID: ${res.audit_id || 'AUD-OK'}].`
          : `Invoice ${draftId} for ${companyName} authorized by ${ownerName} [Audit ID: ${res.audit_id || 'AUD-OK'}].`
      );
    } catch (err: any) {
      onShowToast(
        'error',
        isBM ? 'Ralat Kelulusan' : 'Authorization Failed',
        err.message || 'Could not approve invoice draft.'
      );
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* RBAC Authority Notice */}
      <div className="p-4 sm:p-5 rounded-xl bg-[#1C3F35] text-white flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-blue-500/20 text-sky-400 flex items-center justify-center font-bold">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs sm:text-sm uppercase tracking-wider text-slate-300 font-bold">
              {isBM ? 'Tadbir Urus Kelulusan (RBAC)' : 'Role-Based Authorization Gate (RBAC)'}
            </div>
            <div className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span>{isOwner ? (isBM ? 'Pemilik Sah / Pengarah' : 'Authorized SME Director') : (isBM ? 'Staf (Paparan Sahaja)' : 'Staff / Finance Clerk (View-Only)')}</span>
              <span className="text-slate-400">•</span>
              <span className="text-sm sm:text-base text-slate-200">{ownerName}</span>
            </div>
          </div>
        </div>

        <div className="text-xs sm:text-sm text-slate-200 bg-slate-800 px-3.5 py-2 rounded-lg border border-slate-700">
          {isOwner ? (
            <span className="text-emerald-400 font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{isBM ? 'Kuasa Menandatangani Aktif' : 'Director Sign-Off Authority Active'}</span>
            </span>
          ) : (
            <span className="text-amber-400 font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span>{isBM ? 'Tindakan Kelulusan Dihadkan' : 'Approval Restricted to Owner'}</span>
            </span>
          )}
        </div>
      </div>

      {/* Pending Invoices Sign-off Queue */}
      <SectionCard
        title={isBM ? 'Senarai Menunggu Kelulusan' : 'Pending Authorization Queue'}
        subtitle={
          isBM
            ? `Semak dan sahkan draf invois sebelum dihantar atau dieksport secara rasmi.`
            : `Review structured validation checks and sign off before final export.`
        }
        icon={CheckSquare}
        headerBadge={
          <span className="text-xs sm:text-sm font-mono font-bold px-3 py-1 rounded-full bg-amber-100 text-amber-900">
            {pendingDrafts.length} {isBM ? 'Perlu Kelulusan' : 'Pending'}
          </span>
        }
      >
        {pendingDrafts.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <h4 className="text-base font-bold text-slate-900">
              {isBM ? 'Tiada Invois Menunggu' : 'No Invoices Pending Authorization'}
            </h4>
            <p className="text-sm text-slate-600">
              {isBM
                ? 'Semua invois aktif telah diluluskan atau tiada draf baharu dalam barisan.'
                : 'All drafts are authorized or no new intakes are pending review.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5 -mb-5">
            <table className="w-full text-left text-sm sm:text-base border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-700 border-b border-slate-200 font-bold">
                  <th className="py-3.5 px-4">Invoice # / Draft</th>
                  <th className="py-3.5 px-4">Buyer / Customer</th>
                  <th className="py-3.5 px-4">Total (MYR)</th>
                  <th className="py-3.5 px-4">Review cues</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {pendingDrafts.map((d) => {
                  const amount = d.parsedAmount || d.amount || 0;
                  const isOver10k = amount > 10000;
                  const hasTin = Boolean(d.buyer_tin || d.fields?.buyerTIN);
                  const needsReview = isOver10k || !hasTin;

                  return (
                    <tr key={d.draft_id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-4 px-4 font-mono font-bold text-slate-900">
                        {d.invoiceNumber || d.draft_id}
                        <div className="text-xs text-slate-500 font-sans font-normal mt-0.5">
                          {d.date || 'Today'}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-bold text-slate-900">
                          {d.company || d.fields?.buyerName || 'Customer'}
                        </div>
                        <div className="text-xs sm:text-sm text-slate-600 font-mono mt-0.5">
                          TIN: {d.buyer_tin || d.fields?.buyerTIN || (
                            <span className="text-amber-700 font-bold underline">MISSING</span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4 font-mono font-bold text-slate-900 text-base">
                        RM {amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 px-4">
                        {isOver10k || !hasTin ? (
                          <span className="text-xs font-bold px-2.5 py-1 rounded-full inline-flex items-center gap-1.5 bg-amber-100 text-amber-800">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>{isOver10k ? '>RM10k review reference' : 'TIN missing — review'}</span>
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-slate-500">
                            No review flag
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                          d.status === 'Ready' || d.status === 'pending_approval'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {d.status}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          {onSelectDraft && (
                            <button
                              type="button"
                              onClick={() => onSelectDraft(d.draft_id)}
                              className="h-9 px-3 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-semibold cursor-pointer"
                            >
                              {isBM ? 'Edit' : 'Review'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleApprove(d.draft_id)}
                            disabled={!isOwner || approvingId === d.draft_id}
                            className={`h-9 px-4 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                              !isOwner
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                : needsReview
                                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                                : 'bg-[#1C3F35] hover:bg-[#285443] text-white'
                            }`}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>{approvingId === d.draft_id ? 'Authorizing...' : (isBM ? 'Luluskan' : 'Sign Off')}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Authorized Invoices Count */}
      {approvedDrafts.length > 0 && (
        <div className="p-4 sm:p-5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-sm sm:text-base text-slate-700 font-medium">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>
              <strong className="text-slate-900 font-bold">{approvedDrafts.length}</strong> {isBM ? 'invois telah diluluskan oleh pengarah syarikat.' : 'invoice(s) fully signed off and ready for Excel export.'}
            </span>
          </div>
          <span className="text-xs sm:text-sm font-mono text-emerald-800 font-bold bg-emerald-50 px-3 py-1 rounded border border-emerald-200">
            AUDIT-LOCKED
          </span>
        </div>
      )}
    </div>
  );
};

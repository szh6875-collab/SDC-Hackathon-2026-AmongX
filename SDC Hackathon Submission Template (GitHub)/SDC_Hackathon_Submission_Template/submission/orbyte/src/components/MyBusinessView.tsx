import React, { useState } from 'react';
import {
  Building2,
  Edit3,
  PlusCircle,
  Check,
  CheckCircle2,
  DollarSign,
  Users,
  ShieldCheck,
  Briefcase,
  FileText,
  ArrowRight,
  TrendingUp,
  RefreshCw,
  Sparkles,
  Info,
} from 'lucide-react';
import { CompanyEntity, RoleType } from '../types';
import { PageHeader, SectionCard, StatusBadge } from './common';
import { api } from '../services/api';

interface MyBusinessViewProps {
  companies: CompanyEntity[];
  activeCompanyId: string;
  onCompanySwitch: (companyId: string) => void;
  onOpenEditProfile: () => void;
  language: 'en' | 'bm';
  onShowToast: (type: 'success' | 'warning' | 'error' | 'info', title: string, message: string) => void;
  onRefreshData: () => void;
  currentRole: RoleType;
}

export const MyBusinessView: React.FC<MyBusinessViewProps> = ({
  companies,
  activeCompanyId,
  onCompanySwitch,
  onOpenEditProfile,
  language,
  onShowToast,
  onRefreshData,
  currentRole,
}) => {
  const isBM = language === 'bm';
  const activeCompany = companies.find((c) => c.id === activeCompanyId) || companies[0];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Page Header */}
      <PageHeader
        tag={isBM ? 'Tetapan Perniagaan' : 'Business Settings'}
        tagIcon={Building2}
        title={isBM ? 'Tetapan Perniagaan & Profil Syarikat' : 'Business Settings & Entity Management'}
        description={
          isBM
            ? 'Urus profil pendaftaran syarikat, nombor cukai (TIN), perolehan tahunan, dan tukar ruang kerja antara entiti perniagaan anda.'
            : 'Manage company registration details, tax identification numbers (TIN), annual turnover, and switch workspaces across your business entities.'
        }
        primaryAction={{
          label: isBM ? 'Kemas Kini Profil' : 'Edit Active Profile',
          icon: Edit3,
          onClick: onOpenEditProfile,
          variant: 'primary',
        }}
        secondaryAction={{
          label: isBM ? '+ Daftar Syarikat Baharu' : '+ Register New Entity',
          icon: PlusCircle,
          onClick: onOpenEditProfile,
          variant: 'secondary',
        }}
      />

      <div className="flex items-start gap-2.5 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-950">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" />
        <p>
          {isBM
            ? 'Nota demo: profil perniagaan yang dipaparkan mungkin menggunakan data contoh. Sahkan dan kemas kini butiran sebenar sebelum bergantung pada hasil semakan kelayakan dasar.'
            : 'Demo note: business profiles in this preview may contain sample data. Confirm and update the actual company details before relying on policy eligibility results.'}
        </p>
      </div>

      {/* Active Business Entity Card */}
      {activeCompany && (
        <div className="bg-[#1C3F35] text-white rounded-2xl p-6 shadow-[4px_4px_0_#0F241E] border-2 border-[#0F241E]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[#E5A842] text-[#1C3F35] border-2 border-white flex items-center justify-center shrink-0 shadow-xs font-bold">
                <Building2 className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#1C3F35] bg-[#E5A842] px-2.5 py-0.5 rounded-full border border-white/40">
                    {isBM ? 'Ruang Kerja Aktif' : 'Active Workspace'}
                  </span>
                  <span className="text-xs text-white/95 font-mono font-bold" style={{ color: '#FFFFFF' }}>
                    ID: {activeCompany.id}
                  </span>
                </div>
                <h2
                  className="text-xl sm:text-2xl font-black text-white tracking-tight !text-white"
                  style={{ color: '#FFFFFF' }}
                >
                  {activeCompany.name}
                </h2>
                <p className="text-xs text-[#D5EAE2]">
                  {isBM ? 'Pengarah / Pemilik Sah:' : 'Authorized Director / Owner:'}{' '}
                  <strong className="text-white font-bold" style={{ color: '#FFFFFF' }}>{activeCompany.director_name}</strong>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={onOpenEditProfile}
                className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer shadow-xs"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{isBM ? 'Ubah Maklumat' : 'Edit Company Info'}</span>
              </button>
            </div>
          </div>

          {/* Key Business Details Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800 text-xs">
            <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/60">
              <span className="text-slate-400 text-[11px] block font-medium">
                {isBM ? 'Pendaftaran SSM' : 'SSM Registration'}
              </span>
              <strong className="text-white font-mono text-xs sm:text-sm mt-0.5 block truncate">
                {activeCompany.ssm_registration || (isBM ? 'Belum diisi' : 'Not provided')}
              </strong>
            </div>

            <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/60">
              <span className="text-slate-400 text-[11px] block font-medium">
                {isBM ? 'Nombor Cukai (TIN)' : 'Tax ID (TIN)'}
              </span>
              <strong className="text-white font-mono text-xs sm:text-sm mt-0.5 block truncate">
                {activeCompany.uen_or_tin || (isBM ? 'Belum diisi' : 'Not provided')}
              </strong>
            </div>

            <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/60">
              <span className="text-slate-400 text-[11px] block font-medium">
                {isBM ? 'Perolehan Tahunan' : 'Annual Sales Turnover'}
              </span>
              <strong className="text-emerald-400 font-bold text-xs sm:text-sm mt-0.5 block truncate">
                {activeCompany.sales !== undefined && activeCompany.sales !== null ? `RM ${activeCompany.sales.toLocaleString()}` : (isBM ? 'Belum diisi' : 'Not provided')}
              </strong>
            </div>

            <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/60">
              <span className="text-slate-400 text-[11px] block font-medium">
                {isBM ? 'Industri / Sektor' : 'Sector / Industry'}
              </span>
              <strong className="text-white text-xs sm:text-sm mt-0.5 block truncate">
                {activeCompany.industry || (isBM ? 'Belum diisi' : 'Not provided')}
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* Business Entities Portfolio Grid */}
      <SectionCard
        title={isBM ? 'Portfolio Entiti Perniagaan' : 'Business Entities Portfolio'}
        subtitle={
          isBM
            ? 'Pilih syarikat untuk mengasingkan invois, kelayakan pelepasan cukai, dan rekod aktiviti.'
            : 'Select an entity to switch workspaces. Each company maintains isolated invoices, tax pre-checks, and activity records.'
        }
        icon={Briefcase}
        headerAction={
          <button
            onClick={onOpenEditProfile}
            className="h-8 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5 text-blue-600" />
            <span>{isBM ? 'Daftar Syarikat' : 'Add Entity'}</span>
          </button>
        }
      >
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {companies.map((comp) => {
            const isCurrent = comp.id === activeCompanyId;
            return (
              <div
                key={comp.id}
                onClick={() => onCompanySwitch(comp.id)}
                className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                  isCurrent
                    ? 'border-blue-500 bg-blue-50/40 shadow-sm ring-2 ring-blue-500/20'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold">
                      {comp.id}
                    </span>
                    {isCurrent ? (
                      <span className="text-[11px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        {isBM ? 'Aktif' : 'Active'}
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-500 hover:text-blue-700 font-semibold flex items-center gap-1">
                        {isBM ? 'Tukar Sini' : 'Switch'}
                        <ArrowRight className="w-3 h-3" />
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-900 text-sm leading-tight">
                      {comp.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      {isBM ? 'Pemilik:' : 'Owner:'} {comp.director_name}
                    </p>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs text-slate-600">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">{isBM ? 'Perolehan:' : 'Turnover:'}</span>
                      <strong className="text-slate-900 font-mono">
                        RM {comp.sales?.toLocaleString() || comp.salesDisplay || '—'}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">{isBM ? 'Modal:' : 'Capital:'}</span>
                      <span className="text-slate-700 font-mono">
                        RM {comp.paidUpCapital?.toLocaleString() || '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">{isBM ? 'Pekerja:' : 'Staff:'}</span>
                      <span className="text-slate-700">
                        {(comp.staffCount || comp.staff) ? `${comp.staffCount || comp.staff} people` : '—'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-slate-500 truncate max-w-[150px]">
                    {comp.industry || 'General Business'}
                  </span>
                  {isCurrent ? (
                    <span className="font-bold text-blue-700 text-[11px]">
                      {isBM ? 'Sedang Digunakan' : 'In Use'}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCompanySwitch(comp.id);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      {isBM ? 'Pilih Syarikat' : 'Select'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* Entity Administration & Governance Parameters */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2">
          <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" />
            <span>{isBM ? 'Pengasingan Ruang Kerja' : 'Workspace Data Isolation'}</span>
          </div>
          <div className="text-sm font-bold text-slate-900">
            {isBM ? 'Perlindungan Multi-Entiti Aktif' : 'Entity Isolation Active'}
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            {isBM
              ? 'Invois, jejak audit, dan pengiraan cukai diasingkan sepenuhnya mengikut ID entiti yang dipilih.'
              : 'Invoices, audit entries, and tax calculations are strictly scoped to the currently active entity.'}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2">
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-wider">
            <FileText className="w-4 h-4" />
            <span>{isBM ? 'Pengecam Cukai Berkanun' : 'Statutory Tax Identifiers'}</span>
          </div>
          <div className="text-sm font-bold text-slate-900 font-mono">
            TIN: {activeCompany?.uen_or_tin || 'C24892019020'}
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            {isBM
              ? 'Digunakan secara automatik sebagai maklumat pembekal (Supplier TIN) untuk semua eksport e-Invois LHDN.'
              : 'Automatically injected as Supplier TIN on all outgoing e-Invoice XML/Excel validations.'}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2">
          <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs uppercase tracking-wider">
            <CheckCircle2 className="w-4 h-4" />
            <span>{isBM ? 'Integriti Profil SSM' : 'SSM Corporate Profile'}</span>
          </div>
          <div className="text-sm font-bold text-slate-900">
            {activeCompany?.paidUpCapital ? `RM ${activeCompany.paidUpCapital.toLocaleString()} Capital` : 'Capital Pending Input'}
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            {isBM
              ? 'Modal saham berbayar diselaraskan untuk pengesahan had pelepasan cukai PKS di bawah Akta Syarikat 2016.'
              : 'Share capital aligned for preferential SME statutory limits under Companies Act 2016.'}
          </p>
        </div>
      </div>
    </div>
  );
};

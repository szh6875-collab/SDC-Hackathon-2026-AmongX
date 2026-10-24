import React, { useState, useEffect } from 'react';
import {
  X,
  Building2,
  User,
  Check,
  ShieldCheck,
  RefreshCw,
  PlusCircle,
  Archive,
  RotateCcw,
  Trash2,
  AlertTriangle,
  ChevronRight,
  Info,
} from 'lucide-react';
import { CompanyEntity } from '../types';
import { api } from '../services/api';
import { EXEMPTION_RADAR_THRESHOLD } from '../constants/policyConstants';

interface CompanyProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCompanyName: string;
  currentOwnerName: string;
  onSave: (companyName: string, ownerName: string) => Promise<void>;
  language: 'en' | 'bm';
  activeCompanyId?: string;
  onCompanySwitched?: (companyId: string) => void;
  onCompaniesChanged?: () => void;
}

export const CompanyProfileModal: React.FC<CompanyProfileModalProps> = ({
  isOpen,
  onClose,
  currentCompanyName,
  currentOwnerName,
  onSave,
  language,
  activeCompanyId = 'COMP-A',
  onCompanySwitched,
  onCompaniesChanged,
}) => {
  const isBM = language === 'bm';
  const [activeTab, setActiveTab] = useState<'edit' | 'portfolio' | 'create'>('portfolio');

  // Edit current company state
  const [companyName, setCompanyName] = useState<string>(currentCompanyName);
  const [ownerName, setOwnerName] = useState<string>(currentOwnerName);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Portfolio directory state
  const [companies, setCompanies] = useState<CompanyEntity[]>([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState<boolean>(false);
  const [showArchived, setShowArchived] = useState<boolean>(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // New Company Form State
  const [newName, setNewName] = useState<string>('');
  const [newSSM, setNewSSM] = useState<string>('');
  const [newTIN, setNewTIN] = useState<string>('');
  const [newIndustry, setNewIndustry] = useState<string>('');
  const [newSales, setNewSales] = useState<string>('');
  const [newCapital, setNewCapital] = useState<string>('');
  const [newStaff, setNewStaff] = useState<string>('');
  const [newDirector, setNewDirector] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return;
    setCompanyName(currentCompanyName);
    setOwnerName(currentOwnerName);
    setError(null);
    setSuccessMsg(null);
    loadCompanies();
  }, [currentCompanyName, currentOwnerName, isOpen]);

  const loadCompanies = async () => {
    setIsLoadingCompanies(true);
    try {
      const data = await api.getCompanies(true);
      setCompanies(data);
    } catch (err: any) {
      console.warn('Failed to load companies:', err);
    } finally {
      setIsLoadingCompanies(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      setError(isBM ? 'Sila masukkan nama syarikat.' : 'Please enter a valid company name.');
      return;
    }
    if (!ownerName.trim()) {
      setError(isBM ? 'Sila masukkan nama pemilik.' : 'Please enter a valid owner name.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onSave(companyName.trim(), ownerName.trim());
      setSuccessMsg(isBM ? 'Profil syarikat berjaya dikemas kini!' : 'Company profile updated successfully!');
      await loadCompanies();
      onCompaniesChanged?.();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update company profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      setError(isBM ? 'Sila masukkan nama syarikat berdaftar.' : 'Please enter registered company name.');
      return;
    }
    if (newSales.trim() === '' || !Number.isFinite(Number(newSales)) || Number(newSales) < 0) {
      setError(isBM ? 'Sila masukkan perolehan tahunan sebenar atau anggaran yang diketahui.' : 'Enter a known annual turnover value; do not leave it blank.');
      return;
    }
    if (newStaff.trim() === '' || !Number.isInteger(Number(newStaff)) || Number(newStaff) < 0) {
      setError(isBM ? 'Sila masukkan bilangan pekerja yang diketahui.' : 'Enter a known employee count; do not leave it blank.');
      return;
    }
    if (!newIndustry) {
      setError(isBM ? 'Sila pilih industri.' : 'Select an industry.');
      return;
    }
    if (!newDirector.trim()) {
      setError(isBM ? 'Sila masukkan nama pengarah atau pemilik.' : 'Enter the director or owner name.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const cap = newCapital.trim() === '' ? null : Number(newCapital);
      await api.createCompany({
        name: newName.trim(),
        uen_or_tin: newTIN.trim() || undefined,
        ssm_registration: newSSM.trim() || undefined,
        industry: newIndustry,
        sales: Number(newSales),
        paidUpCapital: cap !== null && Number.isFinite(cap) && cap >= 0 ? cap : null,
        staff: Number(newStaff),
        director_name: newDirector.trim(),
      });

      setSuccessMsg(isBM ? `Syarikat '${newName}' berjaya didaftarkan!` : `Company '${newName}' registered successfully!`);
      setNewName('');
      setNewSSM('');
      setNewTIN('');
      setNewIndustry('');
      setNewSales('');
      setNewCapital('');
      setNewStaff('');
      setNewDirector('');
      await loadCompanies();
      onCompaniesChanged?.();
      setActiveTab('portfolio');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to register company');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSwitchCompany = async (comp: CompanyEntity) => {
    try {
      await api.switchCompany(comp.id);
      onCompanySwitched?.(comp.id);
      onCompaniesChanged?.();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to switch company');
    }
  };

  const handleArchiveCompany = async (id: string) => {
    try {
      await api.archiveCompany(id);
      await loadCompanies();
      onCompaniesChanged?.();
    } catch (err: any) {
      setError(err.message || 'Failed to archive company');
    }
  };

  const handleRestoreCompany = async (id: string) => {
    try {
      await api.restoreCompany(id);
      await loadCompanies();
      onCompaniesChanged?.();
    } catch (err: any) {
      setError(err.message || 'Failed to restore company');
    }
  };

  const handleDeleteCompany = async (id: string) => {
    try {
      await api.deleteCompany(id);
      setDeleteConfirmId(null);
      await loadCompanies();
      onCompaniesChanged?.();
    } catch (err: any) {
      setError(err.message || 'Safe deletion blocked');
      setDeleteConfirmId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#1C3F35]/70 backdrop-blur-xs animate-in fade-in">
      <div className="bg-[#FFFFFF] rounded border-2 border-[#1C3F35] shadow-[8px_8px_0_#1C3F35] max-w-2xl w-full overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-[#FAF5E8] border-b-2 border-[#1C3F35] text-[#1C3F35] px-5 sm:px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-[#EDF6EB] text-[#1C3F35] border border-[#1C3F35] flex items-center justify-center font-bold">
              <Building2 className="w-4 h-4 text-[#285443] shrink-0" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base text-[#1C3F35] tracking-wide flex items-center gap-2">
                <span>{isBM ? 'Pengurusan Multi-Syarikat' : 'Multi-Company Management'}</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-[2px] bg-[#E5A842] text-[#1C3F35] border border-[#1C3F35] font-bold">
                  {companies.filter((c) => c.status === 'active').length} {isBM ? 'Aktif' : 'Active'}
                </span>
              </h3>
              <p className="text-xs text-[#4A635B]">
                {isBM
                  ? 'Urus portfolio perniagaan PKS, tukar entiti aktif, dan asingkan data pematuhan.'
                  : 'Manage SME business portfolio, switch active company, and isolate compliance records.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#1C3F35] hover:bg-[#FFFFFF] border border-[#1C3F35] transition-colors p-1 rounded cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50/80 px-4 sm:px-6 pt-2 shrink-0 gap-2">
          <button
            onClick={() => { setActiveTab('portfolio'); setError(null); }}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'portfolio'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {isBM ? 'Portfolio & Tukar Syarikat' : 'Portfolio & Switch'}
          </button>
          <button
            onClick={() => { setActiveTab('edit'); setError(null); }}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'edit'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {isBM ? 'Kemaskini Syarikat Semasa' : 'Edit Current Company'}
          </button>
          <button
            onClick={() => { setActiveTab('create'); setError(null); }}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'create'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>{isBM ? 'Daftar Syarikat Baharu' : 'Add New Company'}</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* TAB 1: PORTFOLIO & SWITCH */}
          {activeTab === 'portfolio' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">
                    {isBM ? 'Senarai Entiti Perniagaan Berdaftar' : 'Registered SME Business Entities'}
                  </h4>
                  <p className="text-slate-500 text-xs">
                    {isBM
                      ? 'Pilih satu syarikat untuk mengasingkan invois, kelayakan dasar, dan jejak audit.'
                      : 'Select a company to filter invoices, PolicyMatch evaluations, and audit records.'}
                  </p>
                </div>
                <label className="flex items-center gap-1.5 text-slate-600 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={showArchived}
                    onChange={(e) => setShowArchived(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>{isBM ? 'Tunjuk Arkib' : 'Show Archived'}</span>
                </label>
              </div>

              {isLoadingCompanies ? (
                <div className="py-8 text-center text-slate-400 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                  <span>Loading companies...</span>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {companies
                    .filter((c) => showArchived || c.status === 'active')
                    .map((comp) => {
                      const isActive = comp.id === activeCompanyId;
                      const isArchived = comp.status === 'archived';

                      return (
                        <div
                          key={comp.id}
                          className={`p-3.5 rounded-xl border transition-all ${
                            isActive
                              ? 'bg-blue-50/70 border-blue-300 ring-1 ring-blue-400'
                              : isArchived
                              ? 'bg-slate-50/80 border-slate-200 opacity-75'
                              : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2.5">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 text-sm truncate">
                                  {comp.name}
                                </span>
                                {isActive && (
                                  <span className="px-2 py-0.5 rounded-md bg-blue-600 text-white font-bold text-[10px]">
                                    {isBM ? 'Sedang Digunakan' : 'Current Active'}
                                  </span>
                                )}
                                {isArchived && (
                                  <span className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-600 font-semibold text-[10px]">
                                    {isBM ? 'Diarkib' : 'Archived'}
                                  </span>
                                )}
                              </div>

                              <div className="text-slate-500 text-[11px] flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 font-mono">
                                <span>SSM: {comp.ssm_registration}</span>
                                <span>TIN: {comp.uen_or_tin}</span>
                                <span className="text-slate-700 font-sans font-semibold">
                                  {isBM ? 'Perolehan:' : 'Turnover:'} {comp.salesDisplay}
                                </span>
                                <span className="text-slate-700 font-sans font-semibold">
                                  {isBM ? 'Modal:' : 'Capital:'} {comp.paidUpCapitalDisplay}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {!isActive && !isArchived && (
                                <button
                                  type="button"
                                  onClick={() => handleSwitchCompany(comp)}
                                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-2xs transition-all cursor-pointer flex items-center gap-1"
                                >
                                  <span>{isBM ? 'Pilih Syarikat' : 'Switch'}</span>
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {!isArchived ? (
                                <button
                                  type="button"
                                  onClick={() => handleArchiveCompany(comp.id)}
                                  className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                                  title={isBM ? 'Arkibkan Syarikat' : 'Archive Company'}
                                >
                                  <Archive className="w-4 h-4" />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleRestoreCompany(comp.id)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold text-xs transition-colors cursor-pointer flex items-center gap-1"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  <span>{isBM ? 'Pulihkan' : 'Restore'}</span>
                                </button>
                              )}

                              {deleteConfirmId === comp.id ? (
                                <div className="flex items-center gap-1 bg-rose-50 p-1 rounded-lg border border-rose-200 animate-in fade-in">
                                  <span className="text-rose-700 text-[10px] font-bold px-1">
                                    {isBM ? 'Pasti padam?' : 'Delete?'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCompany(comp.id)}
                                    className="px-2 py-0.5 bg-rose-600 text-white rounded font-bold hover:bg-rose-700"
                                  >
                                    Yes
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeleteConfirmId(null)}
                                    className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
                                  >
                                    No
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmId(comp.id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title={isBM ? 'Padam Kekal (Hanya jika tiada invois tertunggak)' : 'Delete Permanently (Only if safe)'}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 text-xs flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong>{isBM ? 'Pencegahan Kebocoran Data:' : 'Company Data Isolation:'}</strong>{' '}
                  {isBM
                    ? 'Invois dan semakan kelayakan mengikuti perniagaan yang dipilih. Pengarkiban mengeluarkan perniagaan daripada senarai aktif tanpa sengaja memadam rekodnya.'
                    : 'Invoice and eligibility views follow the selected business. Archiving removes a business from the active list without intentionally deleting its records.'}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: EDIT CURRENT COMPANY */}
          {activeTab === 'edit' && (
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-blue-600" />
                    <span>{isBM ? 'Nama Penuh Syarikat (SSM)' : 'Company Registered Name (SSM)'}</span>
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. ABC Trading Sdn. Bhd."
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                  <span className="text-xs text-slate-500 mt-1 block">
                    {isBM
                      ? 'Nama ini dipaparkan dalam ruang kerja dan eksport invois yang dijana. Penghantaran terus ke LHDN memerlukan integrasi MyInvois berasingan.'
                      : 'This name appears in the workspace and generated invoice exports. Sending directly to LHDN requires a separate MyInvois integration.'}
                  </span>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1.5 flex items-center gap-1.5">
                    <User className="w-4 h-4 text-blue-600" />
                    <span>{isBM ? 'Nama Pemilik / Pengarah PKS' : 'SME Owner / Authorized Director Name'}</span>
                  </label>
                  <input
                    type="text"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="e.g. Ahmad Razak"
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                  <span className="text-xs text-slate-500 mt-1 block">
                    {isBM
                      ? 'Nama ini dipaparkan sebagai pemilik perniagaan dan dalam rekod kelulusan.'
                      : 'This name is shown as the business contact and used in approval records.'}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg text-blue-900 text-xs flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Audit record:</strong> Company profile changes are recorded in the application audit log.
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-9 px-5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>{isBM ? 'Simpan Profil Syarikat' : 'Save Company Profile'}</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: REGISTER NEW SME COMPANY */}
          {activeTab === 'create' && (
            <form onSubmit={handleCreateCompany} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-slate-700 font-bold mb-1">
                    {isBM ? 'Nama Syarikat Penuh (SSM)' : 'Registered Business Name (SSM)'} *
                  </label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Borneo Precision Engineering Sdn. Bhd."
                    className="w-full h-9 px-3 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-semibold text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    {isBM ? 'Nombor Pendaftaran SSM' : 'SSM Registration Number'}
                  </label>
                  <input
                    type="text"
                    value={newSSM}
                    onChange={(e) => setNewSSM(e.target.value)}
                    placeholder="e.g. 202401019876 (1498765-P)"
                    className="w-full h-9 px-3 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    {isBM ? 'Nombor TIN Cukai (LHDN)' : 'Tax Identification Number (TIN)'}
                  </label>
                  <input
                    type="text"
                    value={newTIN}
                    onChange={(e) => setNewTIN(e.target.value)}
                    placeholder="e.g. C8819283011"
                    className="w-full h-9 px-3 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    {isBM ? 'Sektor / Industri' : 'Industry / Sector'}
                  </label>
                  <select
                    value={newIndustry}
                    onChange={(e) => setNewIndustry(e.target.value)}
                    className="w-full h-9 px-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">{isBM ? 'Pilih industri…' : 'Select industry…'}</option>
                    <option value="Food & Beverage Retail">Food & Beverage Retail</option>
                    <option value="Logistics & Freight Haulage">Logistics & Freight Haulage</option>
                    <option value="Precision Machinery & Engineering">Precision Machinery & Engineering</option>
                    <option value="Wholesale FMCG & Distribution">Wholesale FMCG & Distribution</option>
                    <option value="Digital Services & Software">Digital Services & Software</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    {isBM ? 'Nama Pengarah Sah PKS' : 'Authorized SME Director Name'}
                  </label>
                  <input
                    type="text"
                    value={newDirector}
                    onChange={(e) => setNewDirector(e.target.value)}
                    placeholder="e.g. Ahmad Razak"
                    className="w-full h-9 px-3 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    {isBM ? 'Anggaran Perolehan Tahunan (MYR)' : 'Annual Turnover (MYR)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="10000"
                    value={newSales}
                    required
                    onChange={(e) => setNewSales(e.target.value)}
                    className="w-full h-9 px-3 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-semibold text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    {newSales.trim() === ''
                      ? (isBM ? 'Masukkan perolehan untuk saringan awal; status sebenar memerlukan semakan lanjut.' : 'Enter turnover for a preliminary screen; actual status requires further checks.')
                      : Number(newSales) < EXEMPTION_RADAR_THRESHOLD
                      ? (isBM ? 'Di bawah rujukan RM3 juta. Semak kriteria pengecualian rasmi, tahun perolehan, pemilikan dan syarikat berkaitan.' : 'Below the RM3M published threshold reference. Verify the official exemption criteria, relevant turnover year, ownership, and related-entity conditions.')
                      : (isBM ? 'Semak garis masa pelaksanaan e-Invois rasmi berdasarkan tahun perolehan dan keadaan entiti.' : 'Check the official e-Invoice implementation timeline against turnover year and entity circumstances.')}
                  </span>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    {isBM ? 'Modal Berbayar (MYR)' : 'Paid-up Capital (MYR)'}
                  </label>
                  <input
                    type="text"
                    value={newCapital}
                    onChange={(e) => setNewCapital(e.target.value)}
                    placeholder="Leave blank if unspecified"
                    className="w-full h-9 px-3 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    {isBM ? 'Maklumat diperlukan untuk saringan awal cukai; sahkan semua syarat rasmi.' : 'Used for a preliminary tax screen; all statutory conditions must be verified.'}
                  </span>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    {isBM ? 'Bilangan Pekerja Tempatan' : 'Local Staff Headcount'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newStaff}
                    required
                    onChange={(e) => setNewStaff(e.target.value)}
                    className="w-full h-9 px-3 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-amber-900 text-xs flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>{isBM ? 'Pemberitahuan Pematuhan Demo:' : 'Demo Integrity Notice:'}</strong>{' '}
                  {isBM
                    ? 'Syarikat baharu ini disimpan dalam ingatan tempatan untuk aliran kerja demonstrasi. Tiada sambungan terus SSM/LHDN beroperasi secara langsung.'
                    : 'This company profile is stored in server memory for governance workflows. No live SSM or MyInvois API integration is claimed.'}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-9 px-5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                  <span>{isBM ? 'Daftar Syarikat Baharu' : 'Register Company'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

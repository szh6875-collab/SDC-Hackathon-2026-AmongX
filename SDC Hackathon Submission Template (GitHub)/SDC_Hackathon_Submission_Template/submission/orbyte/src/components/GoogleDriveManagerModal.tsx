/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Cloud,
  CheckCircle2,
  AlertTriangle,
  FolderOpen,
  FileText,
  UploadCloud,
  RefreshCw,
  Trash2,
  ExternalLink,
  Download,
  X,
  FileCode,
  ShieldCheck,
  HardDrive,
  LogOut,
  Sparkles,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  initAuth,
  googleSignIn,
  googleLogout,
  getAccessToken,
  findOrCreateDriveFolder,
  listDriveFiles,
  uploadFileToDrive,
  deleteDriveFile,
  downloadDriveFileText,
  DriveFileItem,
  DEFAULT_FOLDER_NAME,
} from '../services/googleDriveAuth';
import { InvoiceDraft } from '../types';

interface GoogleDriveManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: 'en' | 'bm';
  activeDraft: InvoiceDraft | null;
  companyDrafts: InvoiceDraft[];
  companyName: string;
  activeCompanyId: string;
  onShowToast: (type: 'success' | 'warning' | 'error' | 'info', title: string, message: string) => void;
}

export const GoogleDriveManagerModal: React.FC<GoogleDriveManagerModalProps> = ({
  isOpen,
  onClose,
  language,
  activeDraft,
  companyDrafts,
  companyName,
  activeCompanyId,
  onShowToast,
}) => {
  const isBM = language === 'bm';
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [files, setFiles] = useState<DriveFileItem[]>([]);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [isLoadingFiles, setIsLoadingFiles] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [activeUploadName, setActiveUploadName] = useState<string>('');

  // Destructive Confirmation Dialog State (Mandatory per Workspace Skill)
  const [fileToDelete, setFileToDelete] = useState<DriveFileItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = initAuth(
      (authedUser, authedToken) => {
        setUser(authedUser);
        setToken(authedToken);
      },
      () => {
        setUser(null);
        setToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  const refreshDriveFiles = async () => {
    const curToken = await getAccessToken();
    if (!curToken) return;

    setIsLoadingFiles(true);
    try {
      const fId = await findOrCreateDriveFolder();
      setFolderId(fId);
      const driveFiles = await listDriveFiles(fId);
      setFiles(driveFiles);
    } catch (err: any) {
      console.error('Failed to load Google Drive files:', err);
      onShowToast('error', isBM ? 'Ralat Google Drive' : 'Google Drive Error', err.message || 'Failed to sync with Google Drive');
    } finally {
      setIsLoadingFiles(false);
    }
  };

  useEffect(() => {
    if (isOpen && token) {
      refreshDriveFiles();
    }
  }, [isOpen, token]);

  if (!isOpen) return null;

  const handleSignIn = async () => {
    setIsLoggingIn(true);
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setToken(res.accessToken);
        onShowToast(
          'success',
          isBM ? 'Google Drive Disambungkan' : 'Google Drive Connected',
          isBM
            ? `Berjaya log masuk sebagai ${res.user.email}. Akaun Google Drive anda sedia untuk sandaran e-invois.`
            : `Successfully connected as ${res.user.email}. Google Drive is ready for cloud synchronization.`
        );
        // Refresh folder and files
        setTimeout(() => refreshDriveFiles(), 300);
      }
    } catch (err: any) {
      onShowToast(
        'error',
        isBM ? 'Sambungan Gagal' : 'Connection Failed',
        err.message || 'Failed to authenticate with Google'
      );
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await googleLogout();
      setUser(null);
      setToken(null);
      setFiles([]);
      setFolderId(null);
      onShowToast(
        'info',
        isBM ? 'Google Drive Diputuskan' : 'Google Drive Disconnected',
        isBM ? 'Token akses telah dipadam daripada memori.' : 'Signed out from Google Drive. Access token wiped from memory.'
      );
    } catch (err: any) {
      onShowToast('error', 'Sign out error', err.message);
    }
  };

  // Upload single active invoice as UBL XML and JSON to Drive
  const handleUploadActiveInvoice = async () => {
    if (!activeDraft) {
      onShowToast('warning', isBM ? 'Tiada Invois' : 'No Invoice Selected', isBM ? 'Sila pilih draf invois terlebih dahulu.' : 'Please select an invoice draft first.');
      return;
    }
    const curToken = await getAccessToken();
    if (!curToken) {
      await handleSignIn();
      return;
    }

    setIsUploading(true);
    setActiveUploadName(activeDraft.draft_id);
    try {
      const targetFolderId = folderId || (await findOrCreateDriveFolder());
      setFolderId(targetFolderId);

      const invoiceNum = activeDraft.fields?.invoiceNumber || activeDraft.draft_id;
      const cleanNum = invoiceNum.replace(/[^a-zA-Z0-9_-]/g, '_');

      // 1. Upload JSON payload
      const jsonContent = JSON.stringify(activeDraft, null, 2);
      await uploadFileToDrive({
        name: `${cleanNum}_eInvoice_Data.json`,
        mimeType: 'application/json',
        content: jsonContent,
        folderId: targetFolderId,
        description: `Malaysian e-Invoice ${cleanNum} for ${companyName} (${activeCompanyId}) - Verified by Orbyte InvoisReady.`,
      });

      // 2. Upload UBL 2.1 XML if available or generated
      const xmlHeader = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ID>${invoiceNum}</cbc:ID>
  <cbc:IssueDate>${activeDraft.fields?.date || new Date().toISOString().split('T')[0]}</cbc:IssueDate>
  <cbc:InvoiceTypeCode listVersionID="1.0">${activeDraft.documentType || 'Invoice'}</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>MYR</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>${activeDraft.supplier?.name || companyName}</cbc:Name></cac:PartyName>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${activeDraft.supplier?.tin || 'TIN-PENDING'}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>OTH</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>${activeDraft.buyer?.name || activeDraft.fields?.buyerName || 'Buyer'}</cbc:Name></cac:PartyName>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${activeDraft.buyer?.tin || activeDraft.fields?.buyerTIN || 'IG-PENDING'}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>OTH</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:LegalMonetaryTotal>
    <cbc:PayableAmount currencyID="MYR">${(activeDraft.fields?.amount || activeDraft.parsedAmount || 0).toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
</Invoice>`;

      await uploadFileToDrive({
        name: `${cleanNum}_LHDN_UBL21.xml`,
        mimeType: 'application/xml',
        content: xmlHeader,
        folderId: targetFolderId,
        description: `LHDN Compliant UBL 2.1 e-Invoice XML for ${cleanNum}.`,
      });

      await refreshDriveFiles();
      onShowToast(
        'success',
        isBM ? 'Invois Disimpan ke Google Drive' : 'Saved to Google Drive',
        isBM
          ? `Invois ${cleanNum} berjaya dimuat naik ke folder Google Drive "${DEFAULT_FOLDER_NAME}".`
          : `Invoice ${cleanNum} (XML & JSON) successfully backed up to your Google Drive folder.`
      );
    } catch (err: any) {
      onShowToast('error', 'Google Drive Upload Error', err.message);
    } finally {
      setIsUploading(false);
      setActiveUploadName('');
    }
  };

  // Batch sync all company drafts
  const handleBatchSyncDrafts = async () => {
    if (companyDrafts.length === 0) {
      onShowToast('warning', isBM ? 'Tiada Invois' : 'No Invoices', isBM ? 'Tiada draf invois untuk disegerakkan.' : 'No invoices to synchronize.');
      return;
    }
    const curToken = await getAccessToken();
    if (!curToken) {
      await handleSignIn();
      return;
    }

    setIsUploading(true);
    setActiveUploadName(isBM ? 'Menyegerakkan semua invois...' : 'Synchronizing all invoices...');
    try {
      const targetFolderId = folderId || (await findOrCreateDriveFolder());
      setFolderId(targetFolderId);

      const readyDrafts = companyDrafts.filter(
        (d) => d.company_id === activeCompanyId || !d.company_id
      );

      // Create an aggregate index file
      const summaryPayload = {
        companyId: activeCompanyId,
        companyName,
        exportDate: new Date().toISOString(),
        totalDrafts: readyDrafts.length,
        drafts: readyDrafts.map((d) => ({
          draftId: d.draft_id,
          invoiceNumber: d.fields?.invoiceNumber || d.draft_id,
          date: d.fields?.date,
          amount: d.fields?.amount || d.parsedAmount,
          status: d.status,
          buyerName: d.buyer?.name || d.fields?.buyerName,
          buyerTIN: d.buyer?.tin || d.fields?.buyerTIN,
        })),
      };

      await uploadFileToDrive({
        name: `${activeCompanyId}_eInvoices_Batch_Export_${new Date().toISOString().split('T')[0]}.json`,
        mimeType: 'application/json',
        content: JSON.stringify(summaryPayload, null, 2),
        folderId: targetFolderId,
        description: `Batch e-Invoice ledger for ${companyName} (${activeCompanyId}) exported from Orbyte InvoisReady.`,
      });

      await refreshDriveFiles();
      onShowToast(
        'success',
        isBM ? 'Penyegerakan Berkelompok Berjaya' : 'Batch Sync Completed',
        isBM
          ? `${readyDrafts.length} rekod invois telah disandarkan ke Google Drive.`
          : `Successfully synchronized ${readyDrafts.length} invoices to your Google Drive.`
      );
    } catch (err: any) {
      onShowToast('error', 'Batch Sync Error', err.message);
    } finally {
      setIsUploading(false);
      setActiveUploadName('');
    }
  };

  // Prompt confirmation modal for destructive action (Mandatory per Workspace Skill)
  const promptDeleteConfirmation = (file: DriveFileItem) => {
    setFileToDelete(file);
  };

  // Perform destructive file deletion once user explicitly confirms
  const handleConfirmDelete = async () => {
    if (!fileToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDriveFile(fileToDelete.id);
      setFiles((prev) => prev.filter((f) => f.id !== fileToDelete.id));
      onShowToast(
        'success',
        isBM ? 'Fail Dipadam daripada Google Drive' : 'File Deleted from Google Drive',
        isBM
          ? `Fail "${fileToDelete.name}" telah dikeluarkan secara kekal daripada storan awan.`
          : `File "${fileToDelete.name}" was permanently removed from Google Drive.`
      );
      setFileToDelete(null);
    } catch (err: any) {
      onShowToast('error', isBM ? 'Gagal Memadam Fail' : 'Delete Failed', err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs select-none">
      <div className="relative w-full max-w-3xl bg-[#FAF5E8] border-2 border-[#1C3F35] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-[#1C3F35] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#E5A842]/20 border border-[#E5A842] flex items-center justify-center text-[#E5A842]">
              <Cloud className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-serif text-xl text-white tracking-wide flex items-center gap-2">
                {isBM ? 'Pengurus Storan Awan Google Drive' : 'Google Drive Cloud Manager'}
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-medium border border-emerald-400/30">
                  Workspace API
                </span>
              </h3>
              <p className="text-xs text-slate-300 font-sans mt-0.5">
                {isBM
                  ? 'Sandaran selamat e-Invois LHDN & lejar audit terus ke akaun Google Drive anda dengan kebenaran anda.'
                  : 'Secure Malaysian e-Invoices & audit ledger synchronization with user permission.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Connection Status Card */}
          <div className="bg-white border border-[#1C3F35]/20 rounded-xl p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center">
                  <svg className="w-6 h-6" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-slate-900 text-sm">
                      {token && user ? user.displayName || user.email : (isBM ? 'Akaun Google Drive Belum Disambung' : 'Google Drive Disconnected')}
                    </h4>
                    {token && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        {isBM ? 'Aktif' : 'Connected'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {token && user
                      ? `${user.email} • ${isBM ? 'Folder SAS' : 'Drive App Target'}: "${DEFAULT_FOLDER_NAME}"`
                      : (isBM
                          ? 'Sambungkan akaun Google Drive anda untuk membolehkan sandaran terus e-invois LHDN.'
                          : 'Connect your Google Drive account to enable direct e-invoice and compliance cloud synchronization.')}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                {!token ? (
                  /* Official Sign in with Google Button styled as required by Skill */
                  <button
                    onClick={handleSignIn}
                    disabled={isLoggingIn}
                    className="gsi-material-button w-full sm:w-auto"
                    type="button"
                  >
                    <div className="gsi-material-button-state"></div>
                    <div className="gsi-material-button-content-wrapper">
                      <div className="gsi-material-button-icon">
                        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block' }}>
                          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                          <path fill="none" d="M0 0h48v48H0z"></path>
                        </svg>
                      </div>
                      <span className="gsi-material-button-contents">
                        {isLoggingIn ? (isBM ? 'Menghubungkan...' : 'Connecting...') : (isBM ? 'Log Masuk Google Drive' : 'Sign in with Google')}
                      </span>
                    </div>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={refreshDriveFiles}
                      disabled={isLoadingFiles}
                      className="p-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
                      title={isBM ? 'Segerakkan Fail' : 'Refresh Files'}
                    >
                      <RefreshCw className={`w-4 h-4 ${isLoadingFiles ? 'animate-spin text-[#1C3F35]' : ''}`} />
                    </button>
                    <button
                      onClick={handleSignOut}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      {isBM ? 'Putuskan' : 'Disconnect'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* In-Memory Token Notice */}
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-mono">
              <span className="flex items-center gap-1 text-emerald-800">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                {isBM ? 'Keselamatan Memori: Token OAuth tidak disimpan di cakera setempat.' : 'In-memory token caching active. Scopes: drive.file.'}
              </span>
              <span>Workspace App ID: 860434536198</span>
            </div>
          </div>

          {/* Quick Upload / Sync Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Action 1: Upload Active Invoice */}
            <div className="bg-white border border-[#1C3F35]/20 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <FileCode className="w-5 h-5 text-[#1C3F35]" />
                  <h4 className="font-semibold text-slate-900 text-sm">
                    {isBM ? 'Muat Naik Invois Semasa' : 'Backup Active Invoice'}
                  </h4>
                </div>
                <p className="text-xs text-slate-600 mb-3">
                  {activeDraft
                    ? (isBM
                        ? `Muat naik XML UBL 2.1 & JSON draf ${activeDraft.fields?.invoiceNumber || activeDraft.draft_id} ke Google Drive.`
                        : `Save draft ${activeDraft.fields?.invoiceNumber || activeDraft.draft_id} (UBL 2.1 XML + JSON) to Google Drive.`)
                    : (isBM ? 'Pilih satu invois daripada senarai untuk dimuat naik.' : 'Select an invoice draft first to sync to Drive.')}
                </p>
              </div>
              <button
                onClick={handleUploadActiveInvoice}
                disabled={!token || !activeDraft || isUploading}
                className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-lg bg-[#1C3F35] text-white hover:bg-[#285443] disabled:opacity-50 transition-colors"
              >
                {isUploading && activeUploadName === activeDraft?.draft_id ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <UploadCloud className="w-3.5 h-3.5" />
                )}
                {isBM ? 'Simpan ke Google Drive' : 'Save Active to Drive'}
              </button>
            </div>

            {/* Action 2: Batch Sync Invoices */}
            <div className="bg-white border border-[#1C3F35]/20 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <HardDrive className="w-5 h-5 text-[#E5A842]" />
                  <h4 className="font-semibold text-slate-900 text-sm">
                    {isBM ? 'Segerakkan Semua Invois Syarikat' : 'Sync Company Invoices'}
                  </h4>
                </div>
                <p className="text-xs text-slate-600 mb-3">
                  {isBM
                    ? `Eksport indeks sandaran bagi kesemua ${companyDrafts.length} invois ${companyName} ke Google Drive.`
                    : `Export full synchronized batch index of ${companyDrafts.length} invoices for ${companyName} to Drive.`}
                </p>
              </div>
              <button
                onClick={handleBatchSyncDrafts}
                disabled={!token || companyDrafts.length === 0 || isUploading}
                className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-lg bg-[#E5A842] text-[#1C3F35] hover:bg-[#d89b37] disabled:opacity-50 transition-colors"
              >
                {isUploading && activeUploadName.includes('Synchronizing') ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Cloud className="w-3.5 h-3.5" />
                )}
                {isBM ? 'Segerakkan Keseluruhan' : 'Sync All to Drive'}
              </button>
            </div>
          </div>

          {/* Cloud Files List */}
          <div className="bg-white border border-[#1C3F35]/20 rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-[#1C3F35]" />
                <h4 className="font-semibold text-slate-900 text-sm">
                  {isBM ? 'Fail e-Invois di Google Drive' : 'Stored Files in Google Drive'}
                </h4>
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  {files.length} {isBM ? 'fail' : 'files'}
                </span>
              </div>
              {folderId && (
                <a
                  href={`https://drive.google.com/drive/folders/${folderId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-[#1C3F35] font-semibold hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  {isBM ? 'Buka Folder di Drive' : 'Open Folder in Drive'}
                </a>
              )}
            </div>

            {!token ? (
              <div className="text-center py-8 px-4 border border-dashed border-slate-200 rounded-lg">
                <Cloud className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-700">
                  {isBM ? 'Google Drive belum disambungkan' : 'Google Drive is not connected yet'}
                </p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {isBM
                    ? 'Sila log masuk dengan Google di atas untuk melihat dan mengurus fail e-invois anda di Google Drive.'
                    : 'Sign in with your Google account above to browse and manage your compliance files.'}
                </p>
              </div>
            ) : isLoadingFiles ? (
              <div className="text-center py-10">
                <RefreshCw className="w-6 h-6 animate-spin text-[#1C3F35] mx-auto mb-2" />
                <p className="text-xs text-slate-500 font-medium">
                  {isBM ? 'Memuatkan fail dari Google Drive...' : 'Querying Google Drive API...'}
                </p>
              </div>
            ) : files.length === 0 ? (
              <div className="text-center py-8 px-4 border border-dashed border-slate-200 rounded-lg">
                <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-700">
                  {isBM ? 'Tiada fail ditemui' : 'No files stored yet'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {isBM
                    ? 'Gunakan butang di atas untuk memuat naik invois atau lejar pematuhan ke Google Drive.'
                    : 'Use the buttons above to backup active invoices or batch export your e-invoices.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {files.map((file) => {
                  const isXml = file.name.endsWith('.xml') || file.mimeType.includes('xml');
                  const isJson = file.name.endsWith('.json') || file.mimeType.includes('json');
                  const isXlsm = file.name.endsWith('.xlsm') || file.name.endsWith('.xlsx');

                  return (
                    <div
                      key={file.id}
                      className="py-3 px-2 flex items-center justify-between hover:bg-slate-50 transition-colors rounded-lg group"
                    >
                      <div className="flex items-center gap-3 min-w-0 pr-3">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-mono font-bold ${
                            isXml
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : isJson
                                ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                : isXlsm
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : 'bg-slate-100 text-slate-800 border border-slate-300'
                          }`}
                        >
                          {isXml ? 'XML' : isJson ? 'JSON' : isXlsm ? 'XLS' : 'FILE'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate" title={file.name}>
                            {file.name}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono mt-0.5">
                            {file.size && <span>{(parseInt(file.size, 10) / 1024).toFixed(1)} KB</span>}
                            {file.modifiedTime && (
                              <span>• {new Date(file.modifiedTime).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {file.webViewLink && (
                          <a
                            href={file.webViewLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-slate-600 hover:text-[#1C3F35] hover:bg-slate-100 rounded-md transition-colors"
                            title={isBM ? 'Buka di Google Drive' : 'Open in Google Drive'}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                        {/* Destructive Action: Opens Mandatory Confirmation Dialog */}
                        <button
                          onClick={() => promptDeleteConfirmation(file)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                          title={isBM ? 'Padam Fail' : 'Delete File'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-[#FAF5E8] border-t border-[#1C3F35]/20 px-6 py-3 flex items-center justify-between text-xs text-slate-600">
          <span>
            {isBM
              ? 'Diselaraskan di bawah skop terhad (drive.file) dengan keselamatan token dalam memori.'
              : 'Synchronized under least-privilege scope (drive.file) with in-memory tokens.'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            {isBM ? 'Tutup' : 'Close'}
          </button>
        </div>
      </div>

      {/* MANDATORY USER CONFIRMATION DIALOG FOR DESTRUCTIVE OPERATIONS */}
      {fileToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs select-none">
          <div className="bg-white border-2 border-rose-600 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-rose-100 border border-rose-300 flex items-center justify-center shrink-0 text-rose-600">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h4 className="text-base font-bold text-slate-900">
                  {isBM ? 'Sahkan Pemadaman Fail Google Drive?' : 'Permanently Delete Google Drive File?'}
                </h4>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  {isBM
                    ? `Adakah anda pasti mahu memadam fail "${fileToDelete.name}" daripada Google Drive? Tindakan ini adalah kekal dan tidak boleh dibatalkan.`
                    : `Are you sure you want to delete "${fileToDelete.name}" from Google Drive? This action cannot be undone.`}
                </p>
                <div className="bg-slate-50 border border-slate-200 rounded p-2.5 mt-3 text-xs font-mono text-slate-700 truncate">
                  {fileToDelete.name}
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setFileToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                {isBM ? 'Batal' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
              >
                {isDeleting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                {isBM ? 'Padam Fail Sekarang' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

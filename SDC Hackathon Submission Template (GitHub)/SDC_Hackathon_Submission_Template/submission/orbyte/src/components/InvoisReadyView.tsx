import React, { useState, useEffect, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Download,
  Edit3,
  Sparkles,
  MessageSquare,
  RefreshCw,
  Building2,
  SlidersHorizontal,
  ChevronRight,
  ShieldCheck,
  Check,
  Eye,
  Archive,
  FileArchive,
  X,
  ExternalLink,
  FileSpreadsheet,
  Layers,
  CreditCard,
  Hash,
  AlertCircle,
  FileCode,
  ShieldAlert,
  Cloud,
  Send,
  Bot,
  RotateCcw,
} from 'lucide-react';
import { InvoiceDraft, RuleResult, RoleType, InvoiceLineItem, PreExportValidationResult } from '../types';
import { api, triggerBrowserDownload, triggerUrlDownload } from '../services/api';
import { generateInvoiceXlsmBuffer, validateInvoiceForExport } from '../services/excelExport';
import { TermTooltip } from './TermTooltip';
import {
  googleSignIn,
  getAccessToken,
  findOrCreateDriveFolder,
  uploadFileToDrive,
  DEFAULT_FOLDER_NAME,
} from '../services/googleDriveAuth';
import { PageHeader, SectionCard, StatusBadge, AdvancedDetails, StepIndicator, InfoHint } from './common';
import { ApprovalsView } from './ApprovalsView';

interface InvoisReadyViewProps {
  currentRole: RoleType;
  onExplainRule: (rule: RuleResult) => void;
  onDraftCreatedOrUpdated: () => void;
  language: 'en' | 'bm';
  onShowToast: (type: 'success' | 'warning' | 'error' | 'info', title: string, message: string) => void;
  companyName?: string;
  ownerName?: string;
  onOpenEditProfile?: () => void;
  showDemoNotice?: boolean;
  activeCompanyId?: string;
  initialSubTab?: 'intake' | 'approvals';
}

interface ChatMessage {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  timestamp: string;
  suggestedActions?: string[];
  invoiceDraftData?: any;
  isOffTopic?: boolean;
  isDraftLoaded?: boolean;
}

export const InvoisReadyView: React.FC<InvoisReadyViewProps> = ({
  currentRole,
  onExplainRule,
  onDraftCreatedOrUpdated,
  language,
  onShowToast,
  companyName = 'ABC Trading Sdn. Bhd.',
  ownerName = 'Ahmad Razak',
  onOpenEditProfile,
  showDemoNotice = true,
  activeCompanyId = 'COMP-A',
  initialSubTab = 'intake',
}) => {
  const isBM = language === 'bm';

  // Company-isolated drafts list and active draft
  const [companyDrafts, setCompanyDrafts] = useState<InvoiceDraft[]>([]);
  const [activeDraft, setActiveDraft] = useState<InvoiceDraft | null>(null);
  const [isFetchingDrafts, setIsFetchingDrafts] = useState<boolean>(false);
  const [subTab, setSubTab] = useState<'intake' | 'approvals'>(initialSubTab || 'intake');

  useEffect(() => {
    if (initialSubTab) {
      setSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  const pendingApprovalsCount = companyDrafts.filter((d) => d.status !== 'approved').length;

  const handleDirectApprove = async () => {
    if (!activeDraft) return;

    if (currentRole !== 'owner') {
      onShowToast(
        'error',
        'HTTP 403 Forbidden',
        isBM
          ? 'Hanya Pemilik PKS yang diberi kuasa meluluskan dan menandatangani draf e-invois rasmi.'
          : 'Only the SME Owner is authorized to give final sign-off for statutory e-invoices.'
      );
      return;
    }

    const hasBlocking = activeDraft.ruleResults?.some((r) => ['FAIL', 'BLOCKED', 'MISSING_DATA'].includes(r.status));
    if (hasBlocking || (activeDraft.status !== 'Ready' && activeDraft.status !== 'pending_approval')) {
      onShowToast(
        'error',
        isBM ? 'Kelulusan Disekat' : 'Approval Blocked',
        isBM
          ? 'Invois ini mempunyai semakan statutori yang belum selesai. Sila betulkan medan yang diwajibkan terlebih dahulu.'
          : 'This invoice has unresolved statutory issues. Correct required fields before sign-off.'
      );
      return;
    }

    setIsLoading(true);
    try {
      await api.approveItem(activeDraft.draft_id);
      await loadCompanyDrafts(activeCompanyId);
      onDraftCreatedOrUpdated();
      onShowToast(
        'success',
        isBM ? 'Invois Diluluskan' : 'Invoice Approved',
        isBM
          ? `Invois ${activeDraft.draft_id} telah diluluskan oleh pemilik dan direkodkan ke lejar berantai SHA-256.`
          : `Invoice ${activeDraft.draft_id} authorized by owner and committed to SHA-256 activity ledger.`
      );
    } catch (err: any) {
      onShowToast('error', isBM ? 'Kelulusan Gagal' : 'Approval Failed', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Editable Form fields (Complete e-Invoice applicable structure)
  const [editAmount, setEditAmount] = useState<string>('0.00');
  const [editInvoiceNumber, setEditInvoiceNumber] = useState<string>('');
  const [editDocumentType, setEditDocumentType] = useState<string>('Invoice');
  const [editDate, setEditDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [editTime, setEditTime] = useState<string>('12:00:00');
  
  // Buyer fields
  const [editBuyerName, setEditBuyerName] = useState<string>('');
  const [editBuyerTIN, setEditBuyerTIN] = useState<string>('');
  const [editBuyerBRN, setEditBuyerBRN] = useState<string>('');
  const [editBuyerAddress, setEditBuyerAddress] = useState<string>('');
  const [editBuyerEmail, setEditBuyerEmail] = useState<string>('');

  // Supplier fields
  const [editSupplierName, setEditSupplierName] = useState<string>(companyName);
  const [editSupplierTIN, setEditSupplierTIN] = useState<string>('');
  const [editSupplierBRN, setEditSupplierBRN] = useState<string>('');
  const [editSupplierSST, setEditSupplierSST] = useState<string>('');
  const [editSupplierAddress, setEditSupplierAddress] = useState<string>('');

  // Payment fields
  const [editPaymentMode, setEditPaymentMode] = useState<string>('Electronic Funds Transfer');
  const [editPaymentTerms, setEditPaymentTerms] = useState<string>('30 Days Net');
  const [editBankAccount, setEditBankAccount] = useState<string>('');

  // Line items
  const [editItems, setEditItems] = useState<InvoiceLineItem[]>([]);

  // Input mode tab: 'file' | 'whatsapp' | 'samples'
  const [inputTab, setInputTab] = useState<'file' | 'whatsapp' | 'samples'>('file');

  // AI Chatbot conversation state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'msg-welcome',
      role: 'assistant',
      content: language === 'bm'
        ? `👋 **Salam! Saya Pembantu AI e-Invois Orbyte bagi ${companyName || 'syarikat anda'}.**\n\nSaya bersedia membantu anda membina, menyemak dan mengesahkan e-invois mengikut piawaian LHDN MyInvois terkini.\n\n**Apakah jenis invois yang ingin anda sediakan hari ini?** Anda boleh nyatakan butiran seperti:\n• *“Jana invois B2B perkhidmatan katering RM 11,200 kepada Farhans Bistro”*\n• *“Draf invois jualan runcit disatukan RM 4,350”*\n• *“Invois beli sendiri (Self-billed) atau Nota Kredit”*\n\nJika anda ada sebarang pertanyaan mengenai peraturan cukai, ambang semakan TIN pembeli RM10k, atau had pengecualian RM3M, sila ajukan terus!`
        : `👋 **Hello! I'm your Orbyte AI e-Invoice Assistant for ${companyName || 'your company'}.**\n\nI can help you create, review, and validate e-invoices strictly compliant with Malaysian LHDN MyInvois standards.\n\n**What invoice would you like to generate today?** You can describe the transaction, for example:\n• *“Generate a B2B catering invoice for RM 11,200 to Farhans Bistro”*\n• *“Draft a consolidated retail B2C invoice for RM 4,350”*\n• *“Create a Self-Billed invoice or Credit/Debit Note”*\n\nYou can also ask me about LHDN rules, mandatory buyer TIN thresholds (>RM10k), or the RM3M SME exemption!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      suggestedActions: language === 'bm'
        ? ['Jana Invois Katering RM 11,200', 'Invois Runcit Disatukan B2C', 'Peraturan TIN Pembeli > RM10k', 'Semak Ambang Pengecualian RM3M']
        : ['Draft Catering Invoice (RM 11,200)', 'Consolidated Retail Invoice (B2C)', 'Buyer TIN Rules (>RM10,000)', 'RM3M Exemption Threshold Info'],
    },
  ]);
  const [chatInput, setChatInput] = useState<string>('');
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to latest message
  useEffect(() => {
    if (inputTab === 'whatsapp') {
      chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isChatLoading, inputTab]);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [processingStage, setProcessingStage] = useState<'idle' | 'uploading' | 'extracting' | 'validating' | 'completed'>('idle');

  // Sample files and download states
  const [sampleFiles, setSampleFiles] = useState<Array<{
    filename: string;
    size: number;
    sizeDisplay: string;
    type: string;
    mimetype: string;
    downloadUrl: string;
    previewUrl: string;
  }>>([]);
  const [zipPackUrl, setZipPackUrl] = useState<string>('/api/sample-invoices/pack/zip');
  const [isLoadingSamples, setIsLoadingSamples] = useState<boolean>(false);
  const [isDownloadingOriginal, setIsDownloadingOriginal] = useState<boolean>(false);
  const [filePreviewModal, setFilePreviewModal] = useState<{
    isOpen: boolean;
    title: string;
    filename: string;
    mimeType: string;
    downloadUrl: string;
    textBody?: string;
    previewUrl?: string;
  } | null>(null);

  // Helper to populate the form and active state from a draft
  const populateFormWithDraft = (draft: InvoiceDraft | null) => {
    setActiveDraft(draft);
    if (!draft) {
      setEditAmount('0.00');
      setEditInvoiceNumber('');
      setEditBuyerName('');
      setEditBuyerTIN('');
      setEditBuyerBRN('');
      setEditBuyerAddress('');
      setEditBuyerEmail('');
      setEditItems([]);
      return;
    }

    const amt = draft.parsedAmount ?? draft.amount ?? (draft.fields?.amount as number) ?? 0;
    setEditAmount(amt.toFixed(2));
    setEditInvoiceNumber(draft.fields?.invoiceNumber || draft.invoiceNumber || draft.draft_id);
    setEditDocumentType(draft.documentType || 'Invoice');
    setEditDate(draft.fields?.date || draft.date || new Date().toISOString().split('T')[0]);
    setEditTime(draft.time || '12:00:00');

    // Buyer
    const bName = draft.buyer?.name || draft.fields?.buyerName || draft.company || '';
    const bTIN = draft.buyer?.tin || draft.fields?.buyerTIN || draft.buyer_tin || '';
    setEditBuyerName(bName);
    setEditBuyerTIN(bTIN);
    setEditBuyerBRN(draft.buyer?.brn || draft.fields?.buyerBRN || '');
    setEditBuyerAddress(draft.buyer?.address || draft.fields?.buyerAddress || '');
    setEditBuyerEmail(draft.buyer?.email || draft.fields?.buyerEmail || '');

    // Supplier
    setEditSupplierName(draft.supplier?.name || draft.fields?.supplierName || companyName);
    setEditSupplierTIN(draft.supplier?.tin || draft.fields?.supplierTIN || '');
    setEditSupplierBRN(draft.supplier?.brn || draft.fields?.supplierBRN || '');
    setEditSupplierSST(draft.supplier?.sst || draft.fields?.supplierSST || '');
    setEditSupplierAddress(draft.supplier?.address || draft.fields?.supplierAddress || '');

    // Payment
    setEditPaymentMode(draft.payment?.mode || 'Electronic Funds Transfer');
    setEditPaymentTerms(draft.payment?.terms || '30 Days Net');
    setEditBankAccount(draft.payment?.bankAccount || draft.payment_info?.bankAccountNumber || '');

    // Items
    if (draft.items && draft.items.length > 0) {
      setEditItems(draft.items);
    } else {
      setEditItems([
        {
          id: 'ITEM-1',
          classification: '010',
          description: draft.fields?.notes || 'Commercial goods/services',
          quantity: 1,
          unit: 'UNIT',
          unitPrice: amt,
          discount: 0,
          charges: 0,
          taxRate: 0,
          taxAmount: 0,
          total: amt,
        },
      ]);
    }
  };

  // Strictly fetch and isolate drafts belonging to activeCompanyId
  const loadCompanyDrafts = async (targetCompId: string) => {
    setIsFetchingDrafts(true);
    try {
      const allDrafts = await api.getDrafts(targetCompId);
      // Strict isolation filter
      const filtered = (allDrafts || []).filter((d) => (d.company_id || 'COMP-A') === targetCompId);
      setCompanyDrafts(filtered);

      if (filtered.length > 0) {
        // Keep active draft if it belongs to this company, otherwise pick the first
        const currentActiveStillValid = filtered.find((d) => d.draft_id === activeDraft?.draft_id);
        populateFormWithDraft(currentActiveStillValid || filtered[0]);
      } else {
        populateFormWithDraft(null);
      }
    } catch (err: any) {
      console.warn('[InvoisReady] Error loading company drafts:', err);
    } finally {
      setIsFetchingDrafts(false);
    }
  };

  // Load drafts when activeCompanyId changes
  useEffect(() => {
    loadCompanyDrafts(activeCompanyId);
  }, [activeCompanyId, companyName]);

  // Load sample invoices list on mount
  useEffect(() => {
    let isMounted = true;
    setIsLoadingSamples(true);
    api.getSampleInvoices()
      .then((data) => {
        if (isMounted) {
          setSampleFiles(data.files || []);
          if (data.zipPackUrl) setZipPackUrl(data.zipPackUrl);
        }
      })
      .catch((err) => console.warn('[InvoisReady] Could not fetch sample invoices list:', err))
      .finally(() => {
        if (isMounted) setIsLoadingSamples(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Client-side file upload with MIME & size check
  const handleFileUpload = async (file: File) => {
    const allowedTypes = [
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
      'application/pdf',
      'application/xml',
      'text/xml',
      'application/json',
      'text/json',
    ];
    const allowedExtensions = ['.xml', '.json', '.pdf', '.png', '.jpg', '.jpeg', '.webp'];
    const fileExt = '.' + (file.name.split('.').pop() || '').toLowerCase();
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExt)) {
      onShowToast('error', 'Invalid File Type (415)', 'Accepted formats: XML, JSON, PDF, PNG, JPG, JPEG, WEBP.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      onShowToast('error', 'Payload Too Large (413)', 'File size exceeds the 10MB limit.');
      return;
    }

    setIsLoading(true);
    setProcessingStage('uploading');
    try {
      await new Promise((r) => setTimeout(r, 150));
      setProcessingStage('extracting');
      const response = await api.uploadInvoiceFile(file, undefined, undefined, activeCompanyId);
      setProcessingStage('validating');
      await new Promise((r) => setTimeout(r, 200));
      
      await loadCompanyDrafts(activeCompanyId);
      populateFormWithDraft(response);
      onDraftCreatedOrUpdated();
      setProcessingStage('completed');
      onShowToast(
        'success',
        isBM ? 'Invois Dimuat Naik & Diekstrak' : 'Invoice Uploaded & Extracted',
        `File ${file.name} parsed into ${companyName}. Quality: ${
          typeof response.confidence === 'number'
            ? `${Math.round(response.confidence * 100)}% (${response.confidenceBasis || 'heuristic'}).`
            : 'Review fields manually.'
        }`
      );
    } catch (err: any) {
      setProcessingStage('idle');
      onShowToast('error', 'Upload Error', err.message || 'File processing failed');
    } finally {
      setIsLoading(false);
    }
  };

  // AI Chatbot: Send Message & Multi-Turn Chat
  const handleSendChatMessage = async (textToSend?: string) => {
    const text = (textToSend || chatInput).trim();
    if (!text || isChatLoading) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newHistory = [...chatMessages, userMsg];
    setChatMessages(newHistory);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const apiMessages = newHistory.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await api.chatInvoiceAssistant({
        messages: apiMessages,
        language,
        companyName,
        activeCompanyId,
      });

      const assistantMsg: ChatMessage = {
        id: `ast-${Date.now()}`,
        role: 'assistant',
        content: res.reply || (isBM ? 'Invois diproses.' : 'Invoice processed.'),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedActions: Array.isArray(res.suggestedActions) ? res.suggestedActions : undefined,
        invoiceDraftData: res.invoiceDraftData,
      };

      setChatMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.warn('Chat invoice assistant error:', err);
      const fallbackMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: isBM
          ? 'Maaf, perkhidmatan AI mengalami gangguan seketika. Sila cuba lagi atau pilih daripada cadangan pantas di bawah.'
          : 'I encountered a brief connection issue. Please try again or select one of the suggested actions below.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedActions: isBM
          ? ['Jana Invois Katering RM 11,200', 'Peraturan TIN Pembeli']
          : ['Draft Catering Invoice (RM 11,200)', 'Buyer TIN Mandatory Rules'],
      };
      setChatMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // AI Chatbot: Load generated invoice draft into editing form & compliance workspace
  const handleLoadChatDraftIntoWorkspace = async (draftData: any, msgId: string) => {
    if (!draftData) return;
    setIsLoading(true);
    setProcessingStage('validating');
    try {
      const amount = Number(draftData.amount) || 11200;
      const buyerName = draftData.buyerName || 'Farhans Bistro Sdn. Bhd.';
      const buyerTIN = draftData.buyerTIN || (amount > 10000 ? 'C258901230' : null);
      const invoiceNum = draftData.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`;
      const docType = draftData.documentType || 'Invoice';

      const invoiceText = `${docType} for ${buyerName}. Total Amount: RM ${amount.toFixed(2)}. ${buyerTIN ? `Buyer TIN: ${buyerTIN}.` : 'No TIN provided.'} ${draftData.notes || ''}`;
      const backendDraft = await api.uploadInvoiceText({
        text: invoiceText,
        company_id: activeCompanyId,
      });

      setChatMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, isDraftLoaded: true } : m)));

      await loadCompanyDrafts(activeCompanyId);
      populateFormWithDraft(backendDraft);
      onDraftCreatedOrUpdated();
      setProcessingStage('completed');

      onShowToast(
        'success',
        isBM ? 'Draf Berjaya Dimuatkan' : 'Draft Loaded to Workspace',
        isBM
          ? `Invois RM ${amount.toLocaleString('en-MY', { minimumFractionDigits: 2 })} untuk ${buyerName} telah dimuatkan ke dalam ruang kerja penyuntingan anda.`
          : `Invoice for RM ${amount.toLocaleString('en-MY', { minimumFractionDigits: 2 })} to ${buyerName} is now loaded into your editor workspace.`
      );
    } catch (err: any) {
      console.warn('Backend draft creation failed, loading into local state:', err);
      const amount = Number(draftData.amount) || 11200;
      const buyerName = draftData.buyerName || 'Farhans Bistro Sdn. Bhd.';
      const buyerTIN = draftData.buyerTIN || (amount > 10000 ? 'C258901230' : null);
      const invoiceNum = draftData.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`;

      populateFormWithDraft({
        draft_id: invoiceNum,
        company_id: activeCompanyId || 'COMP-A',
        amount,
        parsedAmount: amount,
        buyerName,
        buyerTIN,
        status: amount > 10000 && !buyerTIN ? 'Missing Information' : 'Ready',
        date: draftData.date || new Date().toISOString().split('T')[0],
        method: 'ai',
        fields: {
          amount,
          buyerName,
          buyerTIN,
          buyerBRN: draftData.buyerBRN || '202301088441',
          buyerAddress: draftData.buyerAddress || 'No. 28, Jalan Ampang Utama, 50450 Kuala Lumpur',
          invoiceNumber: invoiceNum,
          date: draftData.date || new Date().toISOString().split('T')[0],
          notes: draftData.notes || '',
        },
      } as any);

      setChatMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, isDraftLoaded: true } : m)));
      onShowToast(
        'success',
        isBM ? 'Draf Dimuatkan ke Borang' : 'Draft Populated into Form',
        isBM ? 'Maklumat invois telah dimasukkan ke borang penyuntingan.' : 'Invoice details populated into editing form.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // AI Chatbot: Reset chat session
  const handleResetChat = () => {
    setChatMessages([
      {
        id: `msg-welcome-${Date.now()}`,
        role: 'assistant',
        content: isBM
          ? `👋 **Salam! Sesi sembang telah dimulakan semula untuk ${companyName || 'syarikat anda'}.**\n\nApakah jenis invois yang ingin anda sediakan sekarang? Nyatakan butiran seperti amaun, nama pembeli atau jenis transaksi.`
          : `👋 **Hello! Chat session reset for ${companyName || 'your company'}.**\n\nWhat invoice would you like to generate today? State your details like amount, buyer name, or transaction type.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedActions: isBM
          ? ['Jana Invois Katering RM 11,200', 'Invois Runcit Disatukan B2C', 'Peraturan TIN Pembeli > RM10k', 'Semak Ambang Pengecualian RM3M']
          : ['Draft Catering Invoice (RM 11,200)', 'Consolidated Retail Invoice (B2C)', 'Buyer TIN Rules (>RM10,000)', 'RM3M Exemption Threshold Info'],
      },
    ]);
    setChatInput('');
  };

  // Helper to cleanly render formatted chat content with bold, bullets, and line wrapping
  const renderFormattedChatMessage = (content: string) => {
    const lines = content.split('\n');
    return (
      <div className="space-y-1.5 break-words overflow-hidden text-left max-w-full">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={idx} className="h-1" />;

          // Format **bold**
          const parts = line.split(/(\*\*[^*]+\*\*)/g);
          const formattedParts = parts.map((part, pIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={pIdx} className="font-bold text-[#1C3F35]">{part.slice(2, -2)}</strong>;
            }
            if (part.startsWith('*') && part.endsWith('*')) {
              return <em key={pIdx} className="italic text-[#285443]">{part.slice(1, -1)}</em>;
            }
            return part;
          });

          // Bullet point
          if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('* ')) {
            return (
              <div key={idx} className="flex items-start gap-1.5 ml-1 break-words">
                <span className="text-[#E5A842] shrink-0 font-bold">•</span>
                <span className="flex-1 break-words">{formattedParts}</span>
              </div>
            );
          }

          return <p key={idx} className="break-words leading-relaxed">{formattedParts}</p>;
        })}
      </div>
    );
  };

  // Preset Simulations
  const runPresetSimulation = async (type: 'blurry' | 'clear' | 'boundary' | 'high_value') => {
    setIsLoading(true);
    setProcessingStage('extracting');

    let text = '';
    if (type === 'blurry') {
      text = `WhatsApp receipt from Farhans Bistro kitchen: Order Total: RM 11,200.00 payable to ${companyName}. No buyer TIN provided. Blurry mobile snapshot.`;
    } else if (type === 'clear') {
      text = `Demo digital B2B invoice fixture from Kedai Kopi Malaya to ${companyName}. Total Amount: RM 4,350.00. Sample Buyer TIN: C2891928301. Date: 2026-10-19.`;
    } else if (type === 'boundary') {
      text = `Daily retail delivery invoice for Klang Valley Grocers to ${companyName}. Total Amount: RM 10,000.00. Buyer TIN: C99281726011.`;
    } else if (type === 'high_value') {
      text = `Wholesale machinery delivery invoice to Perak Precision Machinery from ${companyName}. Total Amount: RM 15,000.00. Missing TIN.`;
    }

    try {
      await new Promise((r) => setTimeout(r, 150));
      setProcessingStage('validating');
      const response = await api.uploadInvoiceText({ text, company_id: activeCompanyId });
      await loadCompanyDrafts(activeCompanyId);
      populateFormWithDraft(response);
      onDraftCreatedOrUpdated();
      setProcessingStage('completed');
      onShowToast(
        response.confidence >= 0.9 ? 'success' : 'warning',
        type === 'clear' ? 'Clear Receipt Parsed' : 'Receipt Parsed via Demo Engine',
        `Amount: RM ${(response.amount || 0).toFixed(2)}. Quality: ${Math.round((response.confidence || 0) * 100)}%. ${
          response.amount > 10000 ? 'Flagged for review by the configured >RM10,000 demo threshold.' : 'Below configured review threshold; this does not confirm consolidation eligibility.'
        }`
      );
    } catch (err: any) {
      setProcessingStage('idle');
      onShowToast('error', 'Simulation Error', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Submit human-verified fields
  const handleConfirmFields = async () => {
    if (!activeDraft) return;

    if (currentRole === 'clerk') {
      onShowToast(
        'error',
        'HTTP 403 Forbidden',
        isBM
          ? 'Akaun staf/kerani hanya mempunyai akses melihat dan tidak boleh mengesahkan medan draf.'
          : 'Staff / Clerk accounts are view-only and cannot confirm or unlock draft fields. Please switch to SME Owner.'
      );
      return;
    }

    const numAmt = parseFloat(editAmount);
    if (isNaN(numAmt) || numAmt <= 0) {
      onShowToast('error', 'Invalid Input', isBM ? 'Sila masukkan jumlah invois yang sah melebihi RM 0.00.' : 'Please enter a valid invoice amount greater than RM 0.00.');
      return;
    }

    if (!editBuyerName.trim()) {
      onShowToast('error', 'Invalid Input', isBM ? 'Nama pembeli / syarikat pelanggan diperlukan.' : 'Buyer / customer company name is required.');
      return;
    }

    if (!editDate || !/^\d{4}-\d{2}-\d{2}$/.test(editDate)) {
      onShowToast('error', 'Invalid Input', isBM ? 'Tarikh invois mesti dalam format YYYY-MM-DD.' : 'Invoice date must be in YYYY-MM-DD format.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.confirmDraftFields(activeDraft.draft_id, {
        amount: numAmt,
        invoiceNumber: editInvoiceNumber.trim() || activeDraft.draft_id,
        documentType: editDocumentType.trim() || 'Invoice',
        buyerTIN: editBuyerTIN.trim() || null,
        buyerName: editBuyerName.trim(),
        date: editDate,
        buyer: {
          name: editBuyerName.trim(),
          tin: editBuyerTIN.trim() || null,
          brn: editBuyerBRN.trim() || null,
          address: editBuyerAddress.trim() || null,
          email: editBuyerEmail.trim() || null,
        },
        supplier: {
          name: editSupplierName.trim(),
          tin: editSupplierTIN.trim() || null,
          brn: editSupplierBRN.trim() || null,
          sst: editSupplierSST.trim() || null,
          address: editSupplierAddress.trim() || null,
        },
        items: editItems,
        payment: {
          mode: editPaymentMode,
          terms: editPaymentTerms,
          bankAccount: editBankAccount.trim() || null,
        },
      });

      await loadCompanyDrafts(activeCompanyId);
      populateFormWithDraft(res.updatedDraft);
      onDraftCreatedOrUpdated();

      const isNowReady = res.status === 'Ready' || res.status === 'pending_approval';
      onShowToast(
        isNowReady ? 'success' : 'warning',
        isNowReady
          ? (isBM ? 'Invois Disahkan & Sedia' : 'Corrections Saved & Ready')
          : (isBM ? 'Perubahan Disimpan (Isu Masih Ada)' : 'Saved (Issues Remain)'),
        isNowReady
          ? (isBM
              ? `Semua peraturan berkanun dipatuhi. Draf ${activeDraft.draft_id} kini sedia untuk pengesahan Pemilik.`
              : `All statutory rules satisfied. Draft ${activeDraft.draft_id} is now ready for SME Owner authorization.`)
          : (isBM
              ? `Draf ${activeDraft.draft_id} dikemas kini, namun beberapa semakan statutori masih memerlukan pembetulan.`
              : `Draft ${activeDraft.draft_id} updated, but some statutory rules still require attention before sign-off.`)
      );
    } catch (err: any) {
      onShowToast('error', 'Confirmation Error', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Genuine Excel Macro-Enabled Workbook (.xlsm) Export
  const handleDownloadExcel = async () => {
    if (!activeDraft) {
      onShowToast('warning', isBM ? 'Tiada Invois' : 'No Invoice Selected', isBM ? 'Sila pilih atau muat naik invois dahulu.' : 'Please select or upload an invoice first.');
      return;
    }

    const draftCompanyId = activeDraft.company_id || 'COMP-A';
    if (draftCompanyId !== activeCompanyId) {
      onShowToast('error', isBM ? 'Syarikat Tidak Sepadan' : 'Company Mismatch', isBM ? 'Invois ini bukan milik syarikat yang dipilih.' : 'This invoice does not belong to the selected company.');
      return;
    }

    setIsExportingExcel(true);
    const invoiceNum = editInvoiceNumber || activeDraft.fields?.invoiceNumber || activeDraft.draft_id;
    const cleanNum = invoiceNum.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${cleanNum}_eInvoice.xlsm`;

    try {
      // 1. First attempt authenticated server stream of genuine .xlsm
      const result = await api.exportDraftExcel(activeDraft.draft_id, activeCompanyId);
      if (!result?.blob) throw new Error('The server did not return a workbook.');
      triggerBrowserDownload(result.blob, result.filename || filename);

      onShowToast(
        'success',
        isBM ? 'Excel e-Invois Dimuat Turun' : 'e-Invoice Excel Exported',
        isBM ? `Buku kerja Excel Macro-Enabled (${filename}) berjaya dimuat turun.` : `Genuine Excel Macro-Enabled Workbook (${filename}) downloaded.`
      );
    } catch (err: any) {
      console.warn('Server export failed, using client generator fallback:', err);
      try {
        // Client fallback using our genuine OpenXML .xlsm generator
        const clientDraft: InvoiceDraft = {
          ...activeDraft,
          company_id: activeCompanyId,
          fields: {
            ...activeDraft.fields,
            invoiceNumber: editInvoiceNumber,
            date: editDate,
            amount: parseFloat(editAmount) || activeDraft.parsedAmount,
            buyerName: editBuyerName,
            buyerTIN: editBuyerTIN || null,
          },
          buyer: {
            name: editBuyerName,
            tin: editBuyerTIN || null,
            brn: editBuyerBRN || null,
            address: editBuyerAddress || null,
            email: editBuyerEmail || null,
          },
          supplier: {
            name: editSupplierName,
            tin: editSupplierTIN || null,
            brn: editSupplierBRN || null,
            sst: editSupplierSST || null,
            address: editSupplierAddress || null,
          },
          items: editItems,
          payment: {
            mode: editPaymentMode,
            terms: editPaymentTerms,
            bankAccount: editBankAccount || null,
          },
        };

        const companyObj = {
          id: activeCompanyId,
          name: editSupplierName || companyName,
          tin: editSupplierTIN,
          brn: editSupplierBRN,
          sst: editSupplierSST,
          address: editSupplierAddress,
          email: '',
          phone: '',
          sales: 0,
          capital: 0,
          staff: 0,
          director_name: ownerName,
          incorporation_date: '',
        };

        const buf = await generateInvoiceXlsmBuffer(clientDraft, companyObj);
        const blob = new Blob([new Uint8Array(buf)], { type: 'application/vnd.ms-excel.sheet.macroEnabled.12' });
        triggerBrowserDownload(blob, filename);

        onShowToast(
          'success',
          isBM ? 'Excel e-Invois Dimuat Turun' : 'e-Invoice Excel Exported',
          isBM ? `Buku kerja Excel Macro-Enabled (${filename}) telah dimuat turun.` : `Genuine Excel Macro-Enabled Workbook (${filename}) generated and downloaded.`
        );
      } catch (clientErr: any) {
        onShowToast('error', 'Export Failed', clientErr.message || 'Could not generate e-Invoice Excel file.');
      }
    } finally {
      setIsExportingExcel(false);
    }
  };

  // Structured e-Invoice JSON Payload Export
  const handleDownloadJson = async () => {
    if (!activeDraft) {
      onShowToast('warning', isBM ? 'Tiada Invois' : 'No Invoice Selected', isBM ? 'Sila pilih atau muat naik invois dahulu.' : 'Please select an invoice first.');
      return;
    }

    try {
      const blob = await api.exportDraftJSON(activeDraft.draft_id);
      const invoiceNum = editInvoiceNumber || activeDraft.fields?.invoiceNumber || activeDraft.draft_id;
      const cleanNum = invoiceNum.replace(/[^a-zA-Z0-9_-]/g, '_');
      triggerBrowserDownload(blob, `${cleanNum}_eInvoice.json`);
      onShowToast(
        'success',
        isBM ? 'JSON e-Invois Dimuat Turun' : 'e-Invoice JSON Exported',
        isBM ? `Fail e-invois JSON (${cleanNum}_eInvoice.json) berjaya dimuat turun.` : `Structured e-Invoice JSON payload (${cleanNum}_eInvoice.json) downloaded.`
      );
    } catch (err: any) {
      onShowToast('error', 'Export Failed', err.message || 'Could not export JSON payload.');
    }
  };

  const [isUploadingToDrive, setIsUploadingToDrive] = useState<boolean>(false);

  // Direct Save / Backup to Google Drive
  const handleSaveToGoogleDrive = async () => {
    if (!activeDraft) {
      onShowToast('warning', isBM ? 'Tiada Invois' : 'No Invoice Selected', isBM ? 'Sila pilih atau muat naik invois dahulu.' : 'Please select or upload an invoice first.');
      return;
    }

    setIsUploadingToDrive(true);
    try {
      let token = await getAccessToken();
      if (!token) {
        const authRes = await googleSignIn();
        if (!authRes) throw new Error('Authentication required for Google Drive');
      }

      const folderId = await findOrCreateDriveFolder();
      const invoiceNum = editInvoiceNumber || activeDraft.fields?.invoiceNumber || activeDraft.draft_id;
      const cleanNum = invoiceNum.replace(/[^a-zA-Z0-9_-]/g, '_');

      // Upload JSON payload
      await uploadFileToDrive({
        name: `${cleanNum}_eInvoice.json`,
        mimeType: 'application/json',
        content: JSON.stringify(activeDraft, null, 2),
        folderId,
        description: `Malaysian e-Invoice ${cleanNum} for ${companyName} (${activeCompanyId}) - Verified by Orbyte InvoisReady`,
      });

      onShowToast(
        'success',
        isBM ? 'Invois Disimpan ke Google Drive' : 'Saved to Google Drive',
        isBM
          ? `Invois ${cleanNum} berjaya disandarkan ke folder Google Drive "${DEFAULT_FOLDER_NAME}".`
          : `Invoice ${cleanNum} successfully synchronized to your Google Drive.`
      );
    } catch (err: any) {
      onShowToast('error', 'Google Drive Sync Error', err.message);
    } finally {
      setIsUploadingToDrive(false);
    }
  };

  // Download original uploaded file with token authentication and Blob fallback
  const handleDownloadOriginalFile = async () => {
    if (!activeDraft) return;
    setIsDownloadingOriginal(true);
    const filename = activeDraft.originalFile?.filename || activeDraft.filename || `${activeDraft.draft_id}_file`;

    try {
      const result = await api.downloadDraftFile(activeDraft.draft_id, activeCompanyId);
      if (!result?.blob || result.blob.size === 0) throw new Error('The source file is empty.');
      triggerBrowserDownload(result.blob, result.filename || filename);

      onShowToast(
        'success',
        isBM ? 'Fail Asal Dimuat Turun' : 'Original File Downloaded',
        isBM ? `Memuat turun ${filename}` : `Downloading source file ${filename}.`
      );
    } catch (err: any) {
      onShowToast(
        'error',
        isBM ? 'Gagal Muat Turun Fail' : 'Download Failed',
        err.message || 'Could not download original file.'
      );
    } finally {
      setIsDownloadingOriginal(false);
    }
  };

  // Download a single sample invoice file
  const handleDownloadSampleFile = (filename: string) => {
    try {
      const url = `/api/sample-invoices/${encodeURIComponent(filename)}?download=true`;
      triggerUrlDownload(url, filename);
      onShowToast(
        'success',
        isBM ? 'Fail Sampel Dimuat Turun' : 'Sample Downloaded',
        isBM ? `Memuat turun fail ${filename}` : `Downloading sample file: ${filename}`
      );
    } catch (err: any) {
      onShowToast('error', 'Download Error', err.message);
    }
  };

  // Download the complete sample invoice pack as a ZIP
  const handleDownloadSamplePack = () => {
    try {
      triggerUrlDownload(zipPackUrl, 'orbyte_sample_invoices.zip');
      onShowToast(
        'success',
        isBM ? 'Pek Sampel Dimuat Turun' : 'Sample Pack Downloaded',
        isBM ? 'Memuat turun pek arkib ZIP invois sampel.' : 'Downloading full sample invoices ZIP pack.'
      );
    } catch (err: any) {
      onShowToast('error', 'Download Error', err.message);
    }
  };

  // 1-Click Intake Test: Fetch a sample file from server and feed it to uploadInvoiceFile
  const handleIngestSampleFile = async (filename: string) => {
    setIsLoading(true);
    setProcessingStage('uploading');
    try {
      const res = await fetch(`/api/sample-invoices/${encodeURIComponent(filename)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to read sample file`);
      const blob = await res.blob();
      const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
      await handleFileUpload(file);
      onShowToast(
        'success',
        isBM ? 'Sampel Berjaya Dimasukkan' : 'Sample File Ingested',
        isBM ? `Invois sampel ${filename} berjaya diekstrak.` : `Sample file ${filename} extracted and evaluated.`
      );
    } catch (err: any) {
      setProcessingStage('idle');
      onShowToast('error', 'Intake Failed', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Preview an original file or sample file
  const handlePreviewFile = (title: string, filename: string, mimeType: string, url: string, textBody?: string) => {
    setFilePreviewModal({
      isOpen: true,
      title,
      filename,
      mimeType,
      downloadUrl: url,
      textBody,
      previewUrl: url,
    });
  };

  const isClerk = currentRole === 'clerk';
  const hasBlockedRule = activeDraft?.ruleResults?.some(r => r.status === 'BLOCKED' || r.status === 'FAIL');
  const hasWarningRule = activeDraft?.ruleResults?.some(r => r.status === 'WARN' || r.status === 'REVIEW_REQUIRED' || r.status === 'MISSING_DATA');

  // Compute pre-export validation result
  const preExportValidation: PreExportValidationResult = activeDraft
    ? validateInvoiceForExport(activeDraft)
    : { status: 'Missing', passed: false, checks: [], summary: 'No active invoice selected' };

  const steps = [
    { id: 1, title: isBM ? 'Import Fail Invois' : '1. Ingest Invoice', subtitle: isBM ? 'Fail atau teks' : 'File / Text' },
    { id: 2, title: isBM ? 'Semak & Lengkapkan' : '2. Verify & Check', subtitle: isBM ? 'Peraturan e-Invois' : 'Fields & Rules' },
    { id: 3, title: isBM ? 'Eksport Excel (.xlsm)' : '3. Export Excel', subtitle: isBM ? 'Buku kerja e-Invois' : 'Excel Workbook' },
  ];

  const currentStepIndex = activeDraft?.status === 'approved' ? 3 : activeDraft?.status === 'Ready' ? 2 : 1;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Page Header */}
      <PageHeader
        tag={isBM ? 'Pintu Gerbang e-Invois' : 'e-Invoice Intake & Compliance'}
        tagIcon={Sparkles}
        title={isBM ? `Pengambilan Invois: ${companyName}` : `e-Invoice Intake & Processing: ${companyName}`}
        description={
          isBM
            ? `Peti masuk invois terlindung bagi ${companyName}. Menyokong pemprosesan fail PDF, imbasan, teks mesej, dan eksport buku kerja Excel Macro-Enabled (.xlsm) lengkap.`
            : `Authoritative invoice gateway strictly isolated for ${companyName}. Ingest multi-format documents and export complete Macro-Enabled Excel (.xlsm) workbooks.`
        }
        primaryAction={{
          label: isBM ? 'Muat Turun Excel e-Invois' : 'Download e-Invoice Excel',
          icon: FileSpreadsheet,
          onClick: handleDownloadExcel,
          variant: 'primary',
          disabled: !activeDraft || isExportingExcel,
        }}
      />

      {/* Primary Sub-Navigation: Ingest & Process vs. Approvals Queue */}
      <div className="flex items-center gap-2.5 border-b border-slate-200 pb-3 flex-wrap">
        <button
          type="button"
          onClick={() => setSubTab('intake')}
          className={`px-4.5 py-2.5 rounded-xl text-sm sm:text-base font-bold transition-all flex items-center gap-2 cursor-pointer ${
            subTab === 'intake'
              ? 'bg-[#1C3F35] text-white shadow-xs'
              : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
          }`}
        >
          <UploadCloud className="w-4.5 h-4.5" />
          <span>{isBM ? 'Pengambilan & Pemprosesan Invois' : 'Ingest & Process Invoices'}</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('approvals')}
          className={`px-4.5 py-2.5 rounded-xl text-sm sm:text-base font-bold transition-all flex items-center gap-2 cursor-pointer ${
            subTab === 'approvals'
              ? 'bg-[#1C3F35] text-white shadow-xs'
              : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
          }`}
        >
          <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500" />
          <span>{isBM ? 'Senarai Kelulusan Pemilik' : 'Owner Approvals Queue'}</span>
          {pendingApprovalsCount > 0 && (
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold ${
                subTab === 'approvals' ? 'bg-amber-400 text-slate-900' : 'bg-amber-100 text-amber-900'
              }`}
            >
              {pendingApprovalsCount}
            </span>
          )}
        </button>
      </div>

      {subTab === 'approvals' ? (
        <ApprovalsView
          drafts={companyDrafts}
          currentRole={currentRole}
          onItemApproved={() => {
            loadCompanyDrafts(activeCompanyId);
            onDraftCreatedOrUpdated();
          }}
          language={language}
          onShowToast={onShowToast}
          ownerName={ownerName}
          companyName={companyName}
          onSelectDraft={(draftId) => {
            setSubTab('intake');
            const target = companyDrafts.find((d) => d.draft_id === draftId);
            if (target) populateFormWithDraft(target);
          }}
        />
      ) : (
        <>
          {/* 3-Step Process Indicator */}
          <div className="bg-white rounded-xl border border-slate-200 px-5 py-3.5 shadow-2xs">
            <StepIndicator steps={steps} currentStep={currentStepIndex} />
          </div>

          <div className="grid lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (5 cols): Intake Channels & Company Context */}
        <div className="lg:col-span-5 space-y-5">
          {/* Active Company Banner */}
          <div className="p-4 rounded-xl border-2 border-[#1C3F35] bg-white shadow-[2px_2px_0_#1C3F35] text-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#FAF5E8] border-2 border-[#1C3F35] text-[#1C3F35] flex items-center justify-center font-bold shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs uppercase font-extrabold text-[#1C3F35] block tracking-wider">
                  {isBM ? 'Ruang Kerja Syarikat Semasa' : 'Active Company Workspace'}
                </span>
                <span className="text-base sm:text-lg font-black text-[#0A1814]">{companyName}</span>
                <span className="text-xs text-[#285443] font-bold block mt-0.5">ID: {activeCompanyId} • {ownerName}</span>
              </div>
            </div>
            {onOpenEditProfile && (
              <button
                type="button"
                onClick={onOpenEditProfile}
                className="text-[#1C3F35] hover:text-[#0A1814] bg-[#FAF8F2] hover:bg-[#E5A842] border border-[#1C3F35] px-2.5 py-1 rounded font-bold flex items-center gap-1.5 cursor-pointer text-xs transition-colors shadow-2xs"
              >
                <Edit3 className="w-3.5 h-3.5" /> {isBM ? 'Profil' : 'Profile'}
              </button>
            )}
          </div>

          <SectionCard
            title={isBM ? 'Saluran Pengambilan Invois' : 'Invoice Intake Channels'}
            subtitle={isBM ? `Pilih kaedah muat naik bagi ${companyName}` : `Upload invoice file or paste message for ${companyName}`}
            icon={UploadCloud}
          >
            {/* Input Mode Tabs */}
            <div className="flex bg-slate-100 p-1.5 rounded-lg text-sm font-semibold mb-4 border border-slate-200/80">
              <button
                type="button"
                onClick={() => setInputTab('file')}
                className={`flex-1 py-2 rounded-md transition-all cursor-pointer ${
                  inputTab === 'file' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {isBM ? 'Fail Invois' : 'Upload File'}
              </button>
              <button
                type="button"
                onClick={() => setInputTab('whatsapp')}
                className={`flex-1 py-2 px-1 text-center rounded-md transition-all cursor-pointer ${
                  inputTab === 'whatsapp' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {isBM ? 'Pembantu AI Chatbot' : 'AI Invoice Chatbot'}
              </button>
              <button
                type="button"
                onClick={() => setInputTab('samples')}
                className={`flex-1 py-2 rounded-md transition-all cursor-pointer ${
                  inputTab === 'samples' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {isBM ? 'Ujian Sampel' : 'Presets & Samples'}
              </button>
            </div>

            {/* TAB 1: File Upload */}
            {inputTab === 'file' && (
              <div className="space-y-3">
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleFileUpload(e.dataTransfer.files[0]);
                    }
                  }}
                  onClick={() => document.getElementById('receipt-file-input')?.click()}
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                    isDragOver
                      ? 'border-blue-500 bg-blue-50/50'
                      : 'border-slate-300 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-50'
                  }`}
                >
                  <input
                    id="receipt-file-input"
                    type="file"
                    accept=".xml,.json,.pdf,.png,.jpg,.jpeg,.webp"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileUpload(e.target.files[0]);
                      }
                    }}
                  />
                  <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3 shadow-2xs">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-slate-800">
                    {isBM ? 'Klik atau seret fail invois ke sini' : 'Click to select or drag and drop invoice'}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    PDF, PNG, JPG, WEBP, XML (UBL 2.1), JSON (Max 10MB)
                  </p>
                  <span className="inline-block mt-2 text-[10px] font-semibold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded">
                    {isBM ? `Diasingkan untuk ${companyName}` : `Assigned strictly to ${companyName}`}
                  </span>
                </div>
              </div>
            )}

            {/* TAB 2: Interactive AI Invoice Chatbot */}
            {inputTab === 'whatsapp' && (
              <div className="legacy-whatsapp-shell w-full max-w-full overflow-hidden">
                <div className="legacy-whatsapp-header flex items-center justify-between gap-3 p-3 sm:p-4 bg-[#1C3F35] text-white">
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#E5A842] text-[#1C3F35] border-2 border-white flex items-center justify-center font-bold text-sm shrink-0 shadow-sm">
                      <Bot className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-xs sm:text-sm truncate flex items-center gap-1.5">
                        <span>{isBM ? 'Pembantu AI e-Invois' : 'Orbyte e-Invoice Assistant'}</span>
                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                      </div>
                      <div className="text-[11px] text-[#C1E1D7] truncate">
                        {isBM ? 'Sembang interaktif • Jana invois • Semakan LHDN' : 'Interactive Chat • Invoice Generation • LHDN Rules'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleResetChat}
                      className="px-2.5 py-1 text-[11px] font-bold text-white/90 hover:text-white bg-white/10 hover:bg-white/20 border border-white/25 rounded transition-colors flex items-center gap-1 cursor-pointer"
                      title={isBM ? 'Mula semula sesi sembang' : 'Reset chat session'}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{isBM ? 'Mula Semula' : 'Reset'}</span>
                    </button>
                    <span className="px-2 py-0.5 text-[10px] font-mono font-bold border border-white/30 rounded bg-white/10 uppercase tracking-wider max-w-[110px] sm:max-w-none truncate">
                      {companyName}
                    </span>
                  </div>
                </div>

                {/* Messages Container */}
                <div className="legacy-whatsapp-messages w-full box-border overflow-y-auto">
                  {chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`legacy-whatsapp-bubble ${msg.role === 'user' ? 'user' : 'bot'} break-words overflow-hidden`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5 border-b border-black/5 pb-1">
                        <span className="font-bold text-[11px] uppercase tracking-wider text-[#1C3F35]">
                          {msg.role === 'user' ? (isBM ? 'Anda' : 'You') : 'Orbyte AI'}
                        </span>
                        <span className="text-[10px] text-[#6B857D] font-mono shrink-0">{msg.timestamp}</span>
                      </div>

                      {renderFormattedChatMessage(msg.content)}

                      {/* Draft Card if generated */}
                      {msg.invoiceDraftData?.hasInvoice && (
                        <div className="mt-3 p-3 rounded bg-[#FAF5E8] border-2 border-[#1C3F35] shadow-[2px_2px_0_#1C3F35] text-xs space-y-2 break-words">
                          <div className="flex items-center justify-between border-b border-[#1C3F35]/20 pb-1.5 font-bold text-[#1C3F35]">
                            <span className="flex items-center gap-1.5">
                              <FileText className="w-4 h-4 text-[#285443]" />
                              {msg.invoiceDraftData.documentType || 'e-Invoice'} Draft
                            </span>
                            <span className="text-sm font-mono text-emerald-800 font-extrabold">
                              RM {Number(msg.invoiceDraftData.amount || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-[#285443]">
                            <div>
                              <span className="text-[#6B857D] block">{isBM ? 'Pembeli' : 'Buyer'}:</span>
                              <strong className="text-[#1C3F35] break-words">{msg.invoiceDraftData.buyerName || 'N/A'}</strong>
                            </div>
                            <div>
                              <span className="text-[#6B857D] block">{isBM ? 'TIN Pembeli' : 'Buyer TIN'}:</span>
                              <span className="font-mono font-bold text-[#1C3F35]">
                                {msg.invoiceDraftData.buyerTIN || (Number(msg.invoiceDraftData.amount) > 10000 ? (isBM ? '⚠️ Perlu TIN (>RM10k)' : '⚠️ TIN Required (>RM10k)') : 'N/A (<=RM10k)')}
                              </span>
                            </div>
                          </div>
                          <div className="pt-1">
                            {msg.isDraftLoaded ? (
                              <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-xs bg-emerald-50 px-2.5 py-1.5 rounded border border-emerald-300">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                <span>{isBM ? 'Draf telah dimuatkan ke ruang kerja invois' : 'Draft loaded into invoice workspace'}</span>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleLoadChatDraftIntoWorkspace(msg.invoiceDraftData, msg.id)}
                                disabled={isLoading}
                                className="w-full sm:w-auto px-3.5 py-2 rounded bg-[#285443] hover:bg-[#1C3F35] text-white border-2 border-[#1C3F35] shadow-[2px_2px_0_#1C3F35] font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:translate-x-[1px] active:translate-y-[1px]"
                              >
                                <Sparkles className="w-3.5 h-3.5 text-[#E5A842]" />
                                {isBM ? 'Muatkan Draf ke Ruang Kerja' : 'Load Draft into Invoice Workspace'}
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Suggested Actions */}
                      {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                        <div className="mt-3 pt-2 border-t border-black/5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B857D] block mb-1.5">
                            {isBM ? 'Cadangan Pantas:' : 'Suggested Actions:'}
                          </span>
                          <div className="flex flex-wrap gap-1.5 max-w-full">
                            {msg.suggestedActions.map((action, aIdx) => (
                              <button
                                key={aIdx}
                                type="button"
                                onClick={() => handleSendChatMessage(action)}
                                disabled={isChatLoading}
                                className="text-xs px-2.5 py-1 rounded bg-[#FAF8F2] hover:bg-[#E5A842] text-[#1C3F35] hover:text-[#1C3F35] border border-[#1C3F35]/30 hover:border-[#1C3F35] transition-all font-semibold max-w-full text-left break-words cursor-pointer"
                              >
                                {action}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Typing Indicator */}
                  {isChatLoading && (
                    <div className="legacy-whatsapp-bubble bot flex items-center gap-2 text-xs text-[#285443] font-semibold py-2.5">
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="w-2 h-2 rounded-full bg-[#285443] animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 rounded-full bg-[#285443] animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 rounded-full bg-[#285443] animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="truncate">{isBM ? 'Orbyte AI sedang menaip & menyemak garis panduan LHDN...' : 'Orbyte AI is thinking & checking LHDN compliance...'}</span>
                    </div>
                  )}

                  <div ref={chatMessagesEndRef} />
                </div>

                {/* Composer Area */}
                <div className="legacy-whatsapp-composer flex flex-col sm:flex-row gap-2 p-3 bg-white border-t-2 border-[#1C3F35] box-border w-full">
                  <textarea
                    rows={2}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendChatMessage();
                      }
                    }}
                    placeholder={
                      isBM
                        ? 'Taip sebarang soalan atau nyatakan: "Jana invois RM 11,200 kepada Farhans Bistro"... (Enter untuk hantar)'
                        : 'Ask anything or state: "Generate catering invoice for RM 11,200 to Farhans Bistro"... (Enter to send)'
                    }
                    className="flex-1 p-2.5 bg-[#FAF8F2] border-2 border-[#1C3F35] text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[#1C3F35] break-words rounded"
                  />
                  <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                    <span className="text-[10px] text-[#6B857D] hidden md:inline font-mono">
                      Enter ↵
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSendChatMessage()}
                      disabled={isChatLoading || !chatInput.trim()}
                      className="px-4 py-2 bg-[#285443] hover:bg-[#19382E] disabled:bg-slate-300 disabled:cursor-not-allowed text-white border-2 border-[#1C3F35] shadow-[2px_2px_0_#1C3F35] text-xs font-bold flex items-center justify-center gap-1.5 h-10 rounded transition-all cursor-pointer active:translate-x-[1px] active:translate-y-[1px]"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isBM ? 'Hantar' : 'Send'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: Presets & Samples */}
            {inputTab === 'samples' && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <span className="text-[11px] uppercase font-bold text-slate-400 block">
                    {isBM ? 'Simulasi Ujian Pantas' : 'Rapid Intake Presets'}
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      onClick={() => runPresetSimulation('blurry')}
                      disabled={isLoading}
                      className="p-2.5 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-900 font-semibold text-left transition-colors cursor-pointer"
                    >
                      <div className="font-bold text-amber-800 text-xs">1. Low Quality Scan</div>
                      <div className="text-[11px] text-amber-700 mt-0.5">RM 11,200 • Review</div>
                    </button>
                    <button
                      onClick={() => runPresetSimulation('clear')}
                      disabled={isLoading}
                      className="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-semibold text-left transition-colors cursor-pointer"
                    >
                      <div className="font-bold text-emerald-800 text-xs">2. Clear Scan</div>
                      <div className="text-[11px] text-emerald-700 mt-0.5">RM 4,350 • Valid TIN</div>
                    </button>
                    <button
                      onClick={() => runPresetSimulation('boundary')}
                      disabled={isLoading}
                      className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 font-semibold text-left transition-colors cursor-pointer"
                    >
                      <div className="font-bold text-slate-800 text-xs">3. Boundary Test</div>
                      <div className="text-[11px] text-slate-600 mt-0.5">RM 10,000 exact</div>
                    </button>
                    <button
                      onClick={() => runPresetSimulation('high_value')}
                      disabled={isLoading}
                      className="p-2.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-900 font-semibold text-left transition-colors cursor-pointer"
                    >
                      <div className="font-bold text-rose-800 text-xs">4. High Value Block</div>
                      <div className="text-[11px] text-rose-700 mt-0.5">RM 15,000 • Missing TIN</div>
                    </button>
                  </div>
                </div>

                {/* Sample files suite */}
                <div className="pt-2 border-t border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase font-bold text-slate-400 block">
                      {isBM ? 'Fail Sampel e-Invois' : 'Sample Document Suite'}
                    </span>
                    <button
                      type="button"
                      onClick={handleDownloadSamplePack}
                      className="text-[11px] text-blue-700 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Archive className="w-3 h-3" />
                      <span>{isBM ? 'Muat Turun Pek ZIP' : 'Sample Pack (.zip)'}</span>
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {sampleFiles.map((sf) => (
                      <div
                        key={sf.filename}
                        className="p-2 rounded-lg bg-white border border-slate-200 hover:border-slate-300 flex items-center justify-between gap-2 text-xs transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="font-semibold text-slate-800 truncate block text-xs" title={sf.filename}>
                            {sf.filename}
                          </span>
                          <span className="text-[10px] text-slate-500 block truncate">
                            {sf.type} • {sf.sizeDisplay}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleDownloadSampleFile(sf.filename)}
                            className="h-6 px-2 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                            title={`Download ${sf.filename}`}
                          >
                            <Download className="w-2.5 h-2.5" />
                            <span>Download</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleIngestSampleFile(sf.filename)}
                            disabled={isLoading}
                            className="h-6 px-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                            title={`Ingest ${sf.filename}`}
                          >
                            <Sparkles className="w-2.5 h-2.5" />
                            <span>Test</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </SectionCard>

          {/* Statutory Rules & Compliance Checklist */}
          {activeDraft && activeDraft.ruleResults && activeDraft.ruleResults.length > 0 && (
            <div className="p-4 rounded-xl border border-slate-200 bg-white text-xs space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="font-bold uppercase tracking-wider text-slate-500 text-[11px] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <span>{isBM ? 'Peraturan e-Invois & Kesahan Berkanun' : 'Statutory e-Invoice Rules'}</span>
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  {activeDraft.ruleResults.filter((r) => r.status === 'PASS').length}/{activeDraft.ruleResults.length} {isBM ? 'Lulus' : 'Passed'}
                </span>
              </div>

              <div className="space-y-2 pt-1 border-t border-slate-100">
                {activeDraft.ruleResults.map((rule, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                          {rule.rule_id || rule.rule}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                            rule.status === 'PASS'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : rule.status === 'WARN'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : rule.status === 'REVIEW_REQUIRED'
                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                              : 'bg-rose-50 text-rose-800 border-rose-200'
                          }`}
                        >
                          {rule.status}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onExplainRule(rule)}
                        className="text-[11px] text-blue-700 hover:text-blue-900 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                        title={isBM ? 'Lihat huraian peraturan dan rujukan akta' : 'View rule citation and statutory rationale'}
                      >
                        <Info className="w-3 h-3" />
                        <span>{isBM ? 'Huraian' : 'Explain'}</span>
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-700 leading-snug">{rule.explanation}</p>
                    {rule.reference && (
                      <span className="text-[10px] text-slate-500 font-mono block truncate" title={rule.reference}>
                        {isBM ? 'Rujukan:' : 'Citation:'} {rule.reference}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pre-Export e-Invoice Validation Audit Checklist */}
          {activeDraft && (
            <div className="p-4 rounded-xl border border-slate-200 bg-white text-xs space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="font-bold uppercase tracking-wider text-slate-500 text-[11px] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>{isBM ? 'Status Pematuhan Pra-Eksport' : 'Pre-Export Compliance Status'}</span>
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] uppercase tracking-wide border ${
                    preExportValidation.status === 'Passed'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : preExportValidation.status === 'Warning'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : preExportValidation.status === 'Missing'
                      ? 'bg-orange-50 text-orange-800 border-orange-200'
                      : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}
                >
                  {preExportValidation.status}
                </span>
              </div>
              <p className="text-[11px] text-slate-600">{preExportValidation.summary}</p>

              <div className="space-y-1.5 pt-1 border-t border-slate-100">
                {preExportValidation.checks.map((chk, i) => (
                  <div key={i} className="flex items-center justify-between py-1 border-b border-slate-50 text-[11px]">
                    <div className="flex items-center gap-1.5 truncate max-w-[240px]">
                      {chk.status === 'Passed' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                      {chk.status === 'Warning' && <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                      {chk.status === 'Missing' && <AlertCircle className="w-3.5 h-3.5 text-orange-600 shrink-0" />}
                      {chk.status === 'Invalid' && <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />}
                      <span className="text-slate-800 font-medium truncate" title={chk.field}>
                        {chk.field}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-semibold font-mono ${
                        chk.status === 'Passed'
                          ? 'text-emerald-700'
                          : chk.status === 'Warning'
                          ? 'text-amber-700'
                          : chk.status === 'Missing'
                          ? 'text-orange-700'
                          : 'text-rose-700'
                      }`}
                    >
                      {chk.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column (7 cols): Active Draft Review, Complete e-Invoice Information & Excel Export */}
        <div className="lg:col-span-7 space-y-5">
          {/* Company Draft Selector Bar */}
          {companyDrafts.length > 0 && (
            <div className="p-3 rounded-xl border border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3 shadow-2xs text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-bold uppercase text-[11px]">
                  {isBM ? 'Invois Syarikat Semasa:' : 'Active Company Invoices:'}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 font-mono font-bold text-xs">
                  {companyDrafts.length}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-xs">{isBM ? 'Pilih Draf:' : 'Select Draft:'}</span>
                <select
                  value={activeDraft?.draft_id || ''}
                  onChange={(e) => {
                    const sel = companyDrafts.find((d) => d.draft_id === e.target.value);
                    if (sel) populateFormWithDraft(sel);
                  }}
                  className="p-1.5 px-3 rounded-lg border border-slate-300 font-mono text-xs font-semibold bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                >
                  {companyDrafts.map((d) => (
                    <option key={d.draft_id} value={d.draft_id}>
                      {d.draft_id} • {d.fields?.invoiceNumber || d.invoiceNumber || 'INV'} • RM {(d.parsedAmount ?? d.amount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {!activeDraft ? (
            <div className="p-8 text-center bg-white rounded-xl border border-slate-200 shadow-2xs space-y-3">
              <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-900">
                {isBM ? `Tiada Draf Invois untuk ${companyName}` : `No Invoices Recorded for ${companyName}`}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {isBM
                  ? 'Muat naik fail invois, imbasan resit atau tampal teks WhatsApp di panel kiri untuk memulakan pengambilan e-invois bagi syarikat ini.'
                  : 'Upload an invoice document, receipt scan, or paste WhatsApp intake text on the left panel to begin intake for this company.'}
              </p>
            </div>
          ) : (
            <SectionCard
              title={`e-Invoice #${editInvoiceNumber || activeDraft.draft_id}`}
              subtitle={isBM ? `Pengesahan berstruktur bagi ${companyName}` : `Complete structured e-Invoice verification for ${companyName}`}
              icon={FileText}
              headerBadge={
                <div className="flex items-center gap-2">
                  {hasBlockedRule ? (
                    <StatusBadge status="BLOCKED" label={isBM ? 'Disekat Ambang' : 'Threshold Blocked'} />
                  ) : hasWarningRule ? (
                    <StatusBadge status="WARN" label={isBM ? 'Perlu Semakan' : 'Review Required'} />
                  ) : (
                    <StatusBadge status="PASS" label={isBM ? 'Sedia Kelulusan' : 'Ready'} />
                  )}
                  {activeDraft.extractionMethod && (
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 uppercase">
                      {activeDraft.extractionMethod}
                    </span>
                  )}
                </div>
              }
            >
              {/* Source Document Bar if uploaded */}
              {activeDraft.originalFile && (
                <div className="p-3 rounded-lg bg-blue-50/80 border border-blue-200/80 mb-4 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-blue-700 shrink-0" />
                    <div className="truncate">
                      <span className="text-[10px] uppercase font-bold text-blue-800 block">
                        {isBM ? 'Fail Sumber Asal' : 'Source Document'}
                      </span>
                      <span className="font-semibold text-slate-900 truncate block">
                        {activeDraft.originalFile.filename}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-3">
                    <button
                      type="button"
                      onClick={handleDownloadOriginalFile}
                      disabled={isDownloadingOriginal}
                      className="h-7 px-2.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      <span>{isBM ? 'Muat Turun Asal' : 'Download Original'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Discrepancy Alert: High Confidence Extraction vs. Deterministic Compliance */}
              {activeDraft.confidence >= 0.85 && (hasBlockedRule || hasWarningRule) && (
                <div className="p-3.5 rounded-xl border border-amber-300 bg-amber-50/90 mb-4 flex items-start gap-3 text-xs text-amber-900 shadow-2xs">
                  <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="font-bold block">
                      {isBM ? 'Percanggahan Dikesan: Keyakinan AI vs. Pematuhan Berkanun' : 'Discrepancy Detected: AI Extraction Quality vs. Statutory Compliance'}
                    </span>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      {isBM
                        ? `Skor ketepatan imbasan (${Math.round((activeDraft.confidence || 0) * 100)}%) tidak membuktikan pematuhan cukai LHDN. Semak butiran transaksi dan keperluan TIN pembeli mengikut panduan rasmi yang terpakai sebelum meluluskan invois.`
                        : `High extraction quality (${Math.round((activeDraft.confidence || 0) * 100)}%) does not establish statutory compliance. Review flagged fields against the applicable official guidance; the configured RM10,000 threshold alone does not determine legal issuance or TIN requirements.`}
                    </p>
                  </div>
                </div>
              )}

              {/* Editable e-Invoice Primary Form */}
              <div className="space-y-4 text-xs">
                {/* 1. Invoice Identification */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50/70 rounded-xl border border-slate-200/80">
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1 text-[11px] uppercase">
                      {isBM ? 'Nombor Invois' : 'Invoice Number'}
                    </label>
                    <input
                      type="text"
                      disabled={isClerk}
                      value={editInvoiceNumber}
                      onChange={(e) => setEditInvoiceNumber(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1 text-[11px] uppercase">
                      {isBM ? 'Tarikh Dikeluarkan' : 'Issue Date'}
                    </label>
                    <input
                      type="date"
                      disabled={isClerk}
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg text-slate-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1 text-[11px] uppercase">
                      {isBM ? 'Jumlah Keseluruhan (RM)' : 'Total Payable (RM)'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      disabled={isClerk}
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* 2. Supplier & Buyer Identification */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Supplier Box */}
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                      {isBM ? 'Maklumat Pembekal (Syarikat Anda)' : 'Supplier Information (Your Company)'}
                    </span>
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase">Name</span>
                      <strong className="text-slate-900 block truncate">{editSupplierName}</strong>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-[10px] text-slate-500 block uppercase">TIN</span>
                        <input
                          type="text"
                          disabled={isClerk}
                          value={editSupplierTIN}
                          onChange={(e) => setEditSupplierTIN(e.target.value)}
                          placeholder="e.g. C25890192000"
                          className="w-full p-1.5 border border-slate-300 rounded font-mono text-slate-900 text-xs"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block uppercase">BRN</span>
                        <input
                          type="text"
                          disabled={isClerk}
                          value={editSupplierBRN}
                          onChange={(e) => setEditSupplierBRN(e.target.value)}
                          placeholder="e.g. 202201048899"
                          className="w-full p-1.5 border border-slate-300 rounded font-mono text-slate-900 text-xs"
                        />
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase">Address</span>
                      <input
                        type="text"
                        disabled={isClerk}
                        value={editSupplierAddress}
                        onChange={(e) => setEditSupplierAddress(e.target.value)}
                        placeholder="Registered business address"
                        className="w-full p-1.5 border border-slate-300 rounded text-slate-900 text-xs"
                      />
                    </div>
                  </div>

                  {/* Buyer Box */}
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                      {isBM ? 'Maklumat Pembeli / Pelanggan' : 'Buyer / Customer Information'}
                    </span>
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase">Buyer Name</span>
                      <input
                        type="text"
                        disabled={isClerk}
                        value={editBuyerName}
                        onChange={(e) => setEditBuyerName(e.target.value)}
                        placeholder="Buyer legal company name"
                        className="w-full p-1.5 border border-slate-300 rounded font-semibold text-slate-900 text-xs"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-[10px] text-slate-500 block uppercase">Buyer TIN</span>
                        <input
                          type="text"
                          disabled={isClerk}
                          value={isClerk && editBuyerTIN ? `***${editBuyerTIN.slice(-4)}` : editBuyerTIN}
                          onChange={(e) => setEditBuyerTIN(e.target.value)}
                          placeholder="e.g. C2891928301"
                          className="w-full p-1.5 border border-slate-300 rounded font-mono text-slate-900 text-xs"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block uppercase">Buyer BRN</span>
                        <input
                          type="text"
                          disabled={isClerk}
                          value={editBuyerBRN}
                          onChange={(e) => setEditBuyerBRN(e.target.value)}
                          placeholder="e.g. 202101039981"
                          className="w-full p-1.5 border border-slate-300 rounded font-mono text-slate-900 text-xs"
                        />
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase">Buyer Address</span>
                      <input
                        type="text"
                        disabled={isClerk}
                        value={editBuyerAddress}
                        onChange={(e) => setEditBuyerAddress(e.target.value)}
                        placeholder="Buyer premises address"
                        className="w-full p-1.5 border border-slate-300 rounded text-slate-900 text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Line Items Breakdown Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                  <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-blue-600" />
                      <span>{isBM ? 'Item Barisan e-Invois' : 'Invoice Line Items'} ({editItems.length})</span>
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      Classification: 010 (Standard Taxable Goods/Services)
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100/70 text-slate-500 font-semibold text-[10px] uppercase border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3">Code</th>
                          <th className="py-2 px-3">Description</th>
                          <th className="py-2 px-2 text-center">Qty</th>
                          <th className="py-2 px-2 text-center">Unit</th>
                          <th className="py-2 px-2 text-right">Unit Price</th>
                          <th className="py-2 px-2 text-right">Tax Rate</th>
                          <th className="py-2 px-2 text-right">Tax</th>
                          <th className="py-2 px-3 text-right">Total (RM)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700 font-mono text-xs">
                        {editItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/80">
                            <td className="py-2.5 px-3 font-semibold text-blue-800">{item.classification || '010'}</td>
                            <td className="py-2.5 px-3 font-sans font-medium text-slate-900 max-w-[200px] truncate" title={item.description}>
                              {item.description}
                            </td>
                            <td className="py-2.5 px-2 text-center font-bold">{item.quantity}</td>
                            <td className="py-2.5 px-2 text-center text-slate-500">{item.unit || 'UNIT'}</td>
                            <td className="py-2.5 px-2 text-right font-medium">
                              {(item.unitPrice || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2.5 px-2 text-right text-slate-500">
                              {(item.taxRate || 0)}%
                            </td>
                            <td className="py-2.5 px-2 text-right text-slate-600">
                              {(item.taxAmount || 0).toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                              {(item.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 4. Complete Totals, Tax & Payment Information */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Totals Summary */}
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5 text-xs font-mono">
                    <span className="font-sans font-bold text-slate-500 uppercase text-[11px] block mb-2">
                      {isBM ? 'Pecahan Kewangan & Cukai' : 'Tax & Totals Breakdown'}
                    </span>
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal (Net):</span>
                      <span>RM {(activeDraft.totals?.subtotal ?? activeDraft.subtotal ?? (parseFloat(editAmount) || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Taxable Amount:</span>
                      <span>RM {(activeDraft.totals?.taxableAmount ?? (parseFloat(editAmount) || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Total Tax / SST:</span>
                      <span>RM {(activeDraft.totals?.taxAmount ?? activeDraft.tax ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Rounding Adjustment:</span>
                      <span>RM {(activeDraft.totals?.rounding ?? 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-900 font-bold border-t border-slate-200 pt-1.5 text-sm">
                      <span>Total Payable:</span>
                      <span className="text-blue-900">RM {(parseFloat(editAmount) || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  {/* Payment & Terms */}
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2 text-xs">
                    <span className="font-sans font-bold text-slate-500 uppercase text-[11px] block">
                      {isBM ? 'Terma Pembayaran & Bank' : 'Payment Mode & Terms'}
                    </span>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block">Payment Mode</span>
                      <input
                        type="text"
                        disabled={isClerk}
                        value={editPaymentMode}
                        onChange={(e) => setEditPaymentMode(e.target.value)}
                        placeholder="e.g. Electronic Funds Transfer"
                        className="w-full p-1.5 border border-slate-300 rounded font-medium text-slate-900 text-xs bg-white"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block">Payment Terms</span>
                      <input
                        type="text"
                        disabled={isClerk}
                        value={editPaymentTerms}
                        onChange={(e) => setEditPaymentTerms(e.target.value)}
                        placeholder="e.g. 30 Days Net"
                        className="w-full p-1.5 border border-slate-300 rounded font-medium text-slate-900 text-xs bg-white"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block">Bank Account</span>
                      <input
                        type="text"
                        disabled={isClerk}
                        value={editBankAccount}
                        onChange={(e) => setEditBankAccount(e.target.value)}
                        placeholder="e.g. Maybank 514012348890"
                        className="w-full p-1.5 border border-slate-300 rounded font-mono text-slate-900 text-xs bg-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Primary Action Buttons: Confirm & Export Excel (.xlsm) */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadExcel}
                      disabled={isExportingExcel}
                      className="h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      title="Download complete e-Invoice workbook in genuine Excel Macro-Enabled format (.xlsm)"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>{isBM ? 'Excel (.xlsm)' : 'Export Excel (.xlsm)'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadJson}
                      className="h-9 px-3.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                      title="Download structured e-Invoice JSON payload"
                    >
                      <FileCode className="w-4 h-4 text-blue-600" />
                      <span>{isBM ? 'JSON' : 'Export JSON'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveToGoogleDrive}
                      disabled={isUploadingToDrive}
                      className="h-9 px-3.5 rounded-lg border-2 border-[#1C3F35] bg-[#FFFFFF] hover:bg-[#FAF5E8] text-[#1C3F35] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-[2px_2px_0_#1C3F35]"
                      title={isBM ? 'Simpan e-invois ini terus ke Google Drive' : 'Save this e-Invoice (XML & JSON) directly to Google Drive'}
                    >
                      <Cloud className={`w-4 h-4 text-emerald-700 ${isUploadingToDrive ? 'animate-pulse' : ''}`} />
                      <span>{isUploadingToDrive ? (isBM ? 'Menyimpan...' : 'Saving...') : (isBM ? 'Google Drive' : 'Save to Drive')}</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {activeDraft && activeDraft.status !== 'approved' && currentRole === 'owner' && (
                      <button
                        type="button"
                        onClick={handleDirectApprove}
                        disabled={isLoading || hasBlockedRule}
                        className={`h-9 px-4 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer ${
                          hasBlockedRule
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                        title={
                          hasBlockedRule
                            ? isBM
                              ? 'Selesaikan peraturan statutori yang disekat sebelum meluluskan'
                              : 'Resolve blocking statutory rules before authorizing'
                            : isBM
                            ? 'Luluskan invois ini sebagai Pemilik PKS'
                            : 'Authorize this invoice as SME Owner'
                        }
                      >
                        <Check className="w-4 h-4" />
                        <span>{isBM ? 'Luluskan e-Invois' : 'Authorize & Sign Off'}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleConfirmFields}
                      disabled={isLoading || isClerk}
                      className={`h-9 px-5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shadow-xs cursor-pointer ${
                        isClerk
                          ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                          : 'bg-[#1C3F35] hover:bg-[#285443] text-white'
                      }`}
                      title={
                        isClerk
                          ? 'Akaun staf/kerani adalah mod paparan sahaja'
                          : 'Save field edits and re-evaluate compliance rules'
                      }
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isBM ? 'Simpan & Nilai Semula' : 'Save Corrections & Re-validate'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </SectionCard>
          )}
        </div>
      </div>
      </>
      )}

      {/* MODAL: Document Preview Modal */}
      {filePreviewModal?.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <span>{filePreviewModal.title}</span>
                </h3>
                <span className="text-xs font-mono text-slate-500">
                  {filePreviewModal.filename} ({filePreviewModal.mimeType})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setFilePreviewModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 min-h-[160px] max-h-[380px] overflow-auto flex items-center justify-center">
              {filePreviewModal.mimeType.startsWith('image/') ? (
                <img
                  src={filePreviewModal.previewUrl}
                  alt={filePreviewModal.filename}
                  className="max-h-72 max-w-full rounded object-contain border border-slate-200"
                />
              ) : filePreviewModal.textBody ? (
                <pre className="text-xs font-mono text-slate-800 whitespace-pre-wrap w-full">
                  {filePreviewModal.textBody}
                </pre>
              ) : (
                <div className="text-center p-4 space-y-2">
                  <FileText className="w-10 h-10 text-slate-400 mx-auto" />
                  <p className="text-xs text-slate-600 font-medium">
                    {filePreviewModal.filename}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Binary document file ready for download.
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <span className="text-[11px] text-slate-400">
                Direct authenticated file streaming
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFilePreviewModal(null)}
                  className="h-8 px-3 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerUrlDownload(filePreviewModal.downloadUrl, filePreviewModal.filename);
                    onShowToast('success', 'Download Started', `Downloading ${filePreviewModal.filename}`);
                  }}
                  className="h-8 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Document</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

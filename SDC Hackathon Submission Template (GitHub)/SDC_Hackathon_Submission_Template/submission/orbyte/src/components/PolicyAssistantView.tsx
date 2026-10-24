import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Bot,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  Database,
  ExternalLink,
  FileText,
  Key,
  LoaderCircle,
  Lock,
  RefreshCw,
  Send,
  ShieldCheck,
  ShieldQuestion,
  Sparkles,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { api } from '../services/api';
import type { PolicyQaCitation, PolicyQaResponse, PolicyQaStatus } from '../types';

interface PolicyAssistantViewProps {
  language: 'en' | 'bm';
}

type Message = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  status?: PolicyQaStatus;
  citations?: PolicyQaCitation[];
  caveats?: string[];
  retrievedAt?: string;
  aiModel?: string;
  provider?: string;
};

interface KeysStatusData {
  gemini: { configured: boolean; model: string; masked: string | null; keyCount: number };
  supabase: { configured: boolean; url: string | null; fullUrl: string | null; maskedKey: string | null };
  openai: { configured: boolean; model: string; masked: string | null; keyCount: number };
  providerOrder: string;
  preservedPermanently: boolean;
  storageTarget: string;
}

function formatDate(value: string | null | undefined, language: 'en' | 'bm'): string {
  if (!value) return language === 'bm' ? 'Tidak direkodkan' : 'Not recorded';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(language === 'bm' ? 'ms-MY' : 'en-MY', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusLabel(status: PolicyQaStatus, language: 'en' | 'bm'): string {
  const labels: Record<PolicyQaStatus, { en: string; bm: string }> = {
    supported: { en: 'Evidence-supported · Verified', bm: 'Disokong bukti rasmi · Sah' },
    partially_supported: { en: 'Partially supported · verify current status', bm: 'Bukti separa · sahkan status semasa' },
    insufficient_evidence: { en: 'Unable to verify from sources', bm: 'Tidak dapat disahkan dari sumber' },
    ai_unavailable: { en: 'AI unavailable · evidence only', bm: 'AI tidak tersedia · bukti sahaja' },
    source_unavailable: { en: 'Official sources unavailable', bm: 'Sumber rasmi tidak tersedia' },
  };
  return labels[status]?.[language] || (language === 'bm' ? 'Status tidak diketahui' : 'Unknown status');
}

function sourceTrustLabel(citation: PolicyQaCitation, language: 'en' | 'bm'): string {
  if (citation.evidenceType === 'approved_policy_package') {
    if (citation.trustStatus === 'human_approved_active_package') {
      return language === 'bm' ? 'Pakej diluluskan · aktif & disahkan' : 'Approved package · active & verified';
    }
    if (citation.trustStatus === 'human_approved_package_source_not_reconciled') {
      return language === 'bm' ? 'Pakej diluluskan · semakan sumber diperlukan' : 'Approved package · source review required';
    }
    return language === 'bm' ? 'Pakej diluluskan' : 'Approved package';
  }
  const values: Record<string, { en: string; bm: string }> = {
    recently_checked_unchanged: { en: 'Recently verified · unchanged', bm: 'Baru disemak · tiada perubahan' },
    baseline_only_no_change_comparison: { en: 'Baseline snapshot · official', bm: 'Snapshot asas · rasmi' },
    review_required: { en: 'Review required', bm: 'Perlu semakan' },
    snapshot_hash_mismatch: { en: 'Snapshot hash mismatch', bm: 'Hash snapshot tidak sepadan' },
    stale_or_retrieval_time_unverified: { en: 'Stale snapshot', bm: 'Snapshot luput' },
    saved_snapshot_not_currently_verified: { en: 'Saved snapshot', bm: 'Snapshot disimpan' },
  };
  return values[citation.trustStatus]?.[language] || (language === 'bm' ? 'Sumber rasmi disimpan' : 'Saved official source');
}

const safeExternalUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && (parsed.hostname === 'gov.my' || parsed.hostname.endsWith('.gov.my'));
  } catch {
    return false;
  }
};

const assistantGreeting = (language: 'en' | 'bm'): Message => ({
  id: 'greeting',
  role: 'assistant',
  text: language === 'bm'
    ? 'Salam! Saya Chatbot AI Gemini, pembantu pematuhan e-Invois & percukaian PKS Malaysia anda.\n\nTanya saya soalan tentang tarikh kuat kuasa e-Invois, had pengecualian RM150k, e-invois disatukan (consolidated), kadar SST, atau penalti Seksyen 120. Saya merujuk terus garis panduan rasmi HASiL LHDN, ucapan Belanjawan MOF, dan pakej polisi berkanun.'
    : 'Hello! I am the Gemini AI Chatbot, your Malaysian SME e-Invoice and statutory compliance guide.\n\nAsk questions about e-Invoice mandatory timelines, the RM150,000 turnover exemption, consolidated e-Invoicing, SST rates, or Section 120 penalties. All answers are grounded in official HASiL LHDN guidelines, MOF Budget announcements, and verified policy packages with clickable references.',
  status: 'supported',
});

export const PolicyAssistantView: React.FC<PolicyAssistantViewProps> = ({ language }) => {
  const isBM = language === 'bm';
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([assistantGreeting(language)]);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeCitationId, setActiveCitationId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isKeysModalOpen, setIsKeysModalOpen] = useState(false);
  const [keysStatus, setKeysStatus] = useState<KeysStatusData | null>(null);
  const [keysLoading, setKeysLoading] = useState(false);
  const [keysSaveMessage, setKeysSaveMessage] = useState<string | null>(null);

  // Key form fields for persistent update
  const [inputSupabaseUrl, setInputSupabaseUrl] = useState('');
  const [inputSupabaseKey, setInputSupabaseKey] = useState('');
  const [inputGeminiKey, setInputGeminiKey] = useState('');
  const [inputOpenAiKey, setInputOpenAiKey] = useState('');

  const conversationBodyRef = useRef<HTMLDivElement | null>(null);

  const starters = useMemo(() => isBM
    ? [
        'Bilakah e-Invois mandatori untuk PKS?',
        'Apakah syarat pengecualian RM150,000?',
        'Bagaimana e-invois disatukan (consolidated) berfungsi?',
        'Apakah penalti di bawah Seksyen 120 jika tidak patuh?',
        'Adakah transaksi luar negara tertakluk kepada invois kendiri?',
        'Berapakah kadar SST bagi perkhidmatan dalam 2025/2026?'
      ]
    : [
        'When is the mandatory e-Invoice deadline for SMEs?',
        'How does the RM150,000 turnover exemption threshold work?',
        'How do consolidated e-Invoices work for B2C retail?',
        'What are the penalties under Section 120 for non-compliance?',
        'Are cross-border foreign supplier invoices subject to self-billed e-Invoice?',
        'What are the current SST service tax rates for 2025/2026?'
      ], [isBM]);

  // Load keys status on mount
  const loadKeysStatus = async () => {
    try {
      setKeysLoading(true);
      const data = await api.getKeysStatus();
      setKeysStatus(data);
      if (data.supabase.fullUrl) setInputSupabaseUrl(data.supabase.fullUrl);
    } catch (err) {
      console.warn('Failed to fetch keys status:', err);
    } finally {
      setKeysLoading(false);
    }
  };

  useEffect(() => {
    loadKeysStatus();
  }, []);

  useEffect(() => {
    setMessages([assistantGreeting(language)]);
    setInput('');
  }, [language]);

  useEffect(() => {
    const body = conversationBodyRef.current;
    if (body) body.scrollTop = body.scrollHeight;
  }, [messages, loading]);

  const clearConversation = () => {
    if (loading) return;
    setMessages([assistantGreeting(language)]);
    setInput('');
    setActiveCitationId(null);
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // fallback
    }
  };

  const handleSaveKeys = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setKeysLoading(true);
      setKeysSaveMessage(null);
      await api.updateKeys({
        supabaseUrl: inputSupabaseUrl || undefined,
        supabaseAnonKey: inputSupabaseKey || undefined,
        supabaseSecretKey: inputSupabaseKey || undefined,
        geminiApiKey: inputGeminiKey || undefined,
        openaiApiKey: inputOpenAiKey || undefined,
      });
      setKeysSaveMessage(isBM ? 'Kunci berjaya disimpan dan dikekalkan secara kekal!' : 'Keys successfully saved and permanently preserved!');
      await loadKeysStatus();
      setTimeout(() => setKeysSaveMessage(null), 3000);
    } catch (err) {
      setKeysSaveMessage((err as Error)?.message || 'Failed to update keys');
    } finally {
      setKeysLoading(false);
    }
  };

  const ask = async (question = input) => {
    const q = question.trim();
    if (!q || loading) return;
    setInput('');
    const userMsgId = `user-${Date.now()}`;
    setMessages((prev) => [...prev, { id: userMsgId, role: 'user', text: q }]);
    setLoading(true);

    try {
      const response: PolicyQaResponse = await api.askPolicyQuestion(q, language);
      const responseStatus = response?.status || 'supported';
      const answerText = typeof response?.answer === 'string' ? response.answer.trim() : '';

      const fallbackAnswer = responseStatus === 'ai_unavailable'
        ? (isBM
            ? 'Bukti sumber ditemui, tetapi perkhidmatan AI tidak dapat menghasilkan jawapan sekarang. Sila semak petikan rujukan di bawah.'
            : 'Supporting official references were found, but the AI service could not formulate a response right now. Review the references below.')
        : responseStatus === 'source_unavailable'
          ? (isBM
              ? 'Sumber dasar tidak dapat dicapai sekarang. Sila semak sambungan dan cuba sebentar lagi.'
              : 'Policy sources could not be reached right now. Check connection and retry shortly.')
          : responseStatus === 'insufficient_evidence'
            ? (isBM
                ? 'Bukti yang disimpan dalam pangkalan dasar tidak mencukupi untuk menjawab soalan ini dengan tepat. Sila cuba soalan yang lebih khusus mengenai e-Invois atau cukai.'
                : 'The official evidence retrieved is not sufficient to confirm this rule definitively. Please try a more specific question about Malaysian e-Invoice or tax laws.')
            : (isBM
                ? 'Maklum balas kosong diterima daripada perkhidmatan dasar. Rujukan yang berkaitan dipaparkan di bawah.'
                : 'Empty response received. Relevant policy citations are displayed below.');

      const assistantMsgId = `assistant-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMsgId,
          role: 'assistant',
          text: answerText || fallbackAnswer,
          status: responseStatus,
          citations: Array.isArray(response?.citations) ? response.citations : [],
          caveats: Array.isArray(response?.caveats) ? response.caveats : [],
          retrievedAt: response?.retrievedAt,
          aiModel: (response as any)?.aiModel || 'gemini-3.8-flash',
          provider: (response as any)?.provider,
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          status: 'partially_supported',
          text: error instanceof Error
            ? `${isBM ? 'Soalan tidak dapat diproses' : 'The question could not be processed'}: ${error.message}`
            : (isBM ? 'Sumber polisi tidak dapat dicapai sekarang.' : 'Policy sources could not be reached right now.'),
          citations: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Helper to render text with interactive [E1], [E2] citation pills
  const renderMessageTextWithCitations = (text: string, citations?: PolicyQaCitation[]) => {
    if (!citations || citations.length === 0) {
      return <span>{text}</span>;
    }

    const parts = text.split(/(\[E\d+\])/g);
    return (
      <>
        {parts.map((part, index) => {
          const match = part.match(/^\[(E\d+)\]$/);
          if (match) {
            const citeId = match[1];
            const citation = citations.find((c) => c.id === citeId);
            return (
              <button
                key={`${index}-${citeId}`}
                type="button"
                onClick={() => {
                  setActiveCitationId(citeId);
                  const el = document.getElementById(`citation-card-${citeId}`);
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }}
                title={citation ? `${citation.title}: ${citation.excerpt.slice(0, 100)}...` : `Citation ${citeId}`}
                className="mx-1 inline-flex items-center gap-1 rounded bg-[#E2F4E9] px-1.5 py-0.5 text-xs font-mono font-bold text-[#1C3F35] border border-[#7B9A86] hover:bg-[#1C3F35] hover:text-white transition-colors cursor-pointer shadow-2xs"
              >
                <span>[{citeId}]</span>
                <BookOpen className="h-2.5 w-2.5 opacity-70" />
              </button>
            );
          }
          return <span key={index}>{part}</span>;
        })}
      </>
    );
  };

  // Collect all unique citations across conversation
  const allConversationCitations = useMemo(() => {
    const map = new Map<string, PolicyQaCitation>();
    for (const msg of messages) {
      if (msg.citations) {
        for (const c of msg.citations) {
          if (!map.has(c.id)) map.set(c.id, c);
        }
      }
    }
    return Array.from(map.values());
  }, [messages]);

  return (
    <div className="rounded-xl border-2 border-[#1C3F35] bg-white shadow-[6px_6px_0_#1C3F35] overflow-hidden flex flex-col">
      {/* Top Header */}
      <div className="bg-[#1C3F35] text-white px-4 py-3.5 flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#1C3F35]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-900/80 border border-emerald-400/40 text-amber-300 shadow-inner">
            <Sparkles className="h-5 w-5 animate-pulse" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm sm:text-base tracking-tight">Gemini AI Chatbot</span>
              <span className="rounded-full bg-emerald-500/20 border border-emerald-400/30 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-200">
                gemini-3.8-flash
              </span>
              <span className="rounded-full bg-amber-400/20 border border-amber-300/30 px-2 py-0.5 text-[10px] font-bold text-amber-200">
                {isBM ? 'Dasar Malaysia' : 'Malaysian Grounded'}
              </span>
            </div>
            <p className="text-xs text-emerald-200/90 truncate mt-0.5">
              {isBM ? 'Tanya soalan & periksa rujukan berkanun LHDN & Belanjawan' : 'Ask questions & inspect official statutory references'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Key preservation inspector button */}
          <button
            type="button"
            onClick={() => {
              setIsKeysModalOpen(true);
              loadKeysStatus();
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-950/60 px-2.5 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-900/80 transition-colors cursor-pointer"
            title={isBM ? 'Status Kunci & Supabase Kekal' : 'Keys & Supabase Permanent Status'}
          >
            <Lock className="h-3.5 w-3.5 text-amber-300" />
            <span className="hidden sm:inline">{isBM ? 'Kunci & Supabase Kekal' : 'API & Supabase Keys'}</span>
            <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
          </button>

          {/* Inspect References Drawer Toggle */}
          {allConversationCitations.length > 0 && (
            <button
              type="button"
              onClick={() => setIsDrawerOpen(!isDrawerOpen)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-950/60 px-2.5 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-900/80 transition-colors cursor-pointer"
            >
              <BookOpen className="h-3.5 w-3.5 text-amber-300" />
              <span>{isBM ? 'Periksa Rujukan' : 'Inspect References'}</span>
              <span className="rounded bg-amber-300 px-1 text-[10px] font-bold text-slate-950">
                {allConversationCitations.length}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={clearConversation}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-white/20 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{isBM ? 'Bual Baharu' : 'New Chat'}</span>
          </button>
        </div>
      </div>

      {/* Suggested Quick Prompts */}
      <div className="bg-[#FAF6EE] border-b-2 border-[#1C3F35] px-4 py-2.5 overflow-x-auto flex items-center gap-2 scrollbar-thin">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#1C3F35] shrink-0 flex items-center gap-1 mr-1">
          <Sparkles className="h-3 w-3 text-amber-600" />
          {isBM ? 'Cadangan Soalan:' : 'Quick Prompts:'}
        </span>
        {starters.map((starter) => (
          <button
            key={starter}
            type="button"
            disabled={loading}
            onClick={() => void ask(starter)}
            className="shrink-0 rounded-lg border-2 border-[#1C3F35] bg-white px-2.5 py-1 text-xs font-semibold text-[#1C3F35] shadow-[2px_2px_0_#1C3F35] hover:bg-[#E2F4E9] active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50 transition-all cursor-pointer"
          >
            {starter}
          </button>
        ))}
      </div>

      {/* Conversation Messages */}
      <div
        ref={conversationBodyRef}
        className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-[#F5F2EB] min-h-[380px] max-h-[580px]"
      >
        {messages.map((message) => {
          const isUser = message.role === 'user';
          return (
            <div
              key={message.id}
              className={`flex gap-3 max-w-3xl ${isUser ? 'ml-auto flex-row-reverse' : ''}`}
            >
              {/* Avatar */}
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-[#1C3F35] shadow-[2px_2px_0_#1C3F35] ${
                  isUser ? 'bg-[#FAF6EE] text-[#1C3F35]' : 'bg-[#1C3F35] text-amber-300'
                }`}
              >
                {isUser ? <Bot className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
              </div>

              {/* Message Bubble */}
              <div
                className={`rounded-xl border-2 border-[#1C3F35] p-4 shadow-[3px_3px_0_#1C3F35] ${
                  isUser ? 'bg-[#E2F4E9] text-[#1C3F35]' : 'bg-white text-slate-900'
                }`}
              >
                {/* Status Badge */}
                {!isUser && message.status && (
                  <div className="flex flex-wrap items-center gap-2 mb-2.5 pb-2 border-b border-slate-200">
                    <div
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        message.status === 'supported'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : message.status === 'partially_supported'
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : 'bg-slate-100 text-slate-700 border border-slate-300'
                      }`}
                    >
                      {message.status === 'supported' ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
                      ) : message.status === 'partially_supported' ? (
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-700" />
                      ) : (
                        <ShieldQuestion className="h-3.5 w-3.5 text-slate-600" />
                      )}
                      <span>{statusLabel(message.status, language)}</span>
                    </div>

                    <span className="text-[11px] font-mono text-slate-600 flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-emerald-600" />
                      {message.aiModel || 'gemini-3.8-flash'}
                    </span>

                    <button
                      type="button"
                      onClick={() => copyToClipboard(message.text, message.id)}
                      className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-[#1C3F35]"
                    >
                      {copiedId === message.id ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-600" />
                          <span>{isBM ? 'Disalin' : 'Copied'}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>{isBM ? 'Salin' : 'Copy'}</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Message Content */}
                <div className="text-sm leading-relaxed whitespace-pre-wrap break-words font-sans text-slate-800">
                  {isUser ? message.text : renderMessageTextWithCitations(message.text, message.citations)}
                </div>

                {/* Caveats / Verification Notes */}
                {!isUser && message.caveats && message.caveats.length > 0 && (
                  <div className="mt-3.5 rounded-lg border border-amber-300 bg-amber-50/80 p-3 text-xs text-amber-950">
                    <div className="font-bold flex items-center gap-1.5 mb-1 text-amber-900">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-700" />
                      {isBM ? 'Nota Pengesahan & Peringatan:' : 'Verification Notes:'}
                    </div>
                    <ul className="list-disc pl-4 space-y-1">
                      {message.caveats.map((caveat, idx) => (
                        <li key={idx} className="leading-snug">{caveat}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Inline Citations List (Inspect References Section) */}
                {!isUser && message.citations && message.citations.length > 0 && (
                  <div className="mt-4 pt-3.5 border-t-2 border-dashed border-[#1C3F35]/20">
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#1C3F35]">
                        <BookOpen className="h-4 w-4 text-emerald-700" />
                        <span>{isBM ? 'Rujukan & Petikan Berkanun Rasmi' : 'Grounded Official Citations & Evidence'}</span>
                        <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.2 text-[10px] font-bold">
                          {message.citations.length}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      {message.citations.map((citation) => {
                        const isHighlighted = activeCitationId === citation.id;
                        return (
                          <div
                            key={citation.id}
                            id={`citation-card-${citation.id}`}
                            className={`rounded-lg border-2 p-3 transition-all ${
                              isHighlighted
                                ? 'border-[#1C3F35] bg-[#E2F4E9]/50 shadow-[3px_3px_0_#1C3F35]'
                                : 'border-slate-300 bg-slate-50 hover:border-slate-400'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="rounded bg-[#1C3F35] px-1.5 py-0.5 font-mono text-[11px] font-bold text-amber-300">
                                  [{citation.id}]
                                </span>
                                <span className="text-xs font-bold text-slate-900">{citation.title}</span>
                                {citation.version && (
                                  <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                                    {citation.version}
                                  </span>
                                )}
                              </div>

                              <span
                                className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                                  citation.requiresReview
                                    ? 'bg-amber-100 text-amber-900'
                                    : 'bg-emerald-100 text-emerald-900'
                                }`}
                              >
                                {sourceTrustLabel(citation, language)}
                              </span>
                            </div>

                            {/* Quoted Excerpt */}
                            <blockquote className="mt-2 pl-2.5 border-l-2 border-[#1C3F35] text-xs text-slate-700 italic leading-relaxed bg-white/70 py-1 rounded-r">
                              “{citation.excerpt}”
                            </blockquote>

                            {/* Source Link & Details */}
                            <div className="mt-2.5 flex items-center justify-between gap-2 flex-wrap text-[11px]">
                              {safeExternalUrl(citation.sourceUrl) && (
                                <a
                                  href={citation.sourceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 font-bold text-[#1C3F35] hover:underline"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  <span>{isBM ? 'Buka Portal Rasmi Kerajaan' : 'Open Official Portal'}</span>
                                </a>
                              )}

                              <details className="text-[10px] text-slate-500 ml-auto">
                                <summary className="cursor-pointer font-semibold hover:text-slate-800">
                                  {isBM ? 'Integriti & Hash' : 'Integrity & Hash'}
                                </summary>
                                <div className="mt-1 p-2 rounded bg-white border border-slate-200 text-slate-700 space-y-0.5 font-mono">
                                  {citation.contentSha256 && (
                                    <div className="truncate">SHA-256: {citation.contentSha256}</div>
                                  )}
                                  <div>Status: {citation.sourceStatus}</div>
                                  {citation.lastSuccessfulRetrievalAt && (
                                    <div>{isBM ? 'Pengambilan' : 'Retrieved'}: {formatDate(citation.lastSuccessfulRetrievalAt, language)}</div>
                                  )}
                                </div>
                              </details>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Timestamp */}
                {message.retrievedAt && (
                  <div className="mt-2 text-[10px] text-slate-600 flex items-center gap-1">
                    <Clock3 className="h-3 w-3" />
                    <span>{isBM ? 'Dijana pada' : 'Generated at'}: {formatDate(message.retrievedAt, language)}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Thinking Loading State */}
        {loading && (
          <div className="flex gap-3 max-w-2xl">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-[#1C3F35] bg-[#1C3F35] text-amber-300 shadow-[2px_2px_0_#1C3F35]">
              <Sparkles className="h-4 w-4 animate-spin" />
            </div>
            <div className="rounded-xl border-2 border-[#1C3F35] bg-white p-4 shadow-[3px_3px_0_#1C3F35] flex items-center gap-3">
              <LoaderCircle className="h-4 w-4 text-[#1C3F35] animate-spin" />
              <div className="text-xs font-semibold text-[#1C3F35]">
                {isBM
                  ? 'Gemini 3.8 Flash sedang menganalisis garis panduan berkanun & mengesahkan rujukan...'
                  : 'Gemini 3.8 Flash is analyzing statutory guidelines & verifying citations...'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Composer Input Area */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask();
        }}
        className="p-3.5 bg-white border-t-2 border-[#1C3F35] flex gap-2.5 items-center"
      >
        <div className="relative flex-1">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              isBM
                ? 'Tanya Gemini AI tentang e-Invois LHDN, kelayakan PKS, atau kadar SST...'
                : 'Ask Gemini AI about Malaysian e-Invoice, SME eligibility, or SST rates...'
            }
            maxLength={800}
            disabled={loading}
            className="w-full rounded-lg border-2 border-[#1C3F35] bg-[#FAF8F2] px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1C3F35] disabled:opacity-60 shadow-inner"
          />
          {input.length > 0 && (
            <span className="absolute right-3 top-2.5 text-[10px] text-slate-600 font-mono">
              {input.length}/800
            </span>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1C3F35] px-5 py-2.5 text-sm font-bold text-white shadow-[3px_3px_0_#1C3F35] hover:bg-[#285443] active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
        >
          <Send className="h-4 w-4 text-amber-300" />
          <span>{isBM ? 'Tanya' : 'Ask'}</span>
        </button>
      </form>

      {/* Bottom Footer Note */}
      <div className="bg-[#FAF6EE] px-4 py-2 border-t border-slate-200 text-[11px] text-[#4A635B] flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
          <span>
            {isBM
              ? 'Jawapan berdasarkan garis panduan rasmi berkanun. Kunci Supabase & AI dipelihara secara kekal pada pelayan.'
              : 'Grounded in official statutory policy rules. Supabase & AI API keys are permanently preserved server-side.'}
          </span>
        </div>
        <span className="text-[10px] font-mono font-bold text-[#1C3F35]">
          Google Gemini 3.8 Flash
        </span>
      </div>

      {/* Keys & Supabase Permanent Storage Modal */}
      {isKeysModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl rounded-xl border-2 border-[#1C3F35] bg-white p-6 shadow-[8px_8px_0_#1C3F35] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b-2 border-[#1C3F35]">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1C3F35] text-amber-300">
                  <Key className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1C3F35]">
                    {isBM ? 'Pengurusan & Pengekalan Kunci AI & Supabase' : 'AI & Supabase Keys Management'}
                  </h3>
                  <p className="text-xs text-slate-600">
                    {isBM ? 'Semua kunci disimpan secara kekal di pelayan' : 'All keys are permanently preserved in server-side storage'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsKeysModalOpen(false)}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Permanent Guarantee Notice */}
            <div className="mt-4 rounded-lg border-2 border-emerald-600 bg-emerald-50 p-3.5 text-xs text-emerald-950">
              <div className="font-bold flex items-center gap-1.5 text-emerald-900 mb-1">
                <ShieldCheck className="h-4 w-4 text-emerald-700" />
                <span>{isBM ? 'Jaminan Pengekalan Kekal Kunci' : 'Permanent Key Preservation Guarantee'}</span>
              </div>
              <p className="leading-relaxed">
                {isBM
                  ? 'Kunci Supabase (SUPABASE_URL, SUPABASE_SECRET_KEY) dan kunci AI (Gemini, OpenAI) disimpan secara kekal dalam pelayan di `.env.local` dan `data/system-config.json`. Kunci tidak akan dipadam atau hilang semasa restart.'
                  : 'Supabase keys (SUPABASE_URL, SUPABASE_SECRET_KEY) and AI keys (Gemini, OpenAI) are permanently synchronized and persisted in `.env.local` and `data/system-config.json`. They are never wiped during restarts or sessions.'}
              </p>
            </div>

            {/* Current Status Overview */}
            <div className="mt-4 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {isBM ? 'Status Konfigurasi Semasa' : 'Current Configuration Status'}
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Gemini AI Status */}
                <div className="rounded-lg border border-slate-300 p-3 bg-slate-50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Google Gemini AI</span>
                    <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      {isBM ? 'Aktif' : 'Active'}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-600 font-mono">
                    Model: {keysStatus?.gemini.model || 'gemini-3.8-flash'}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500 font-mono">
                    Key: {keysStatus?.gemini.masked || 'process.env.GEMINI_API_KEY'}
                  </div>
                </div>

                {/* Supabase Status */}
                <div className="rounded-lg border border-slate-300 p-3 bg-slate-50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Supabase</span>
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold flex items-center gap-1 ${
                        keysStatus?.supabase.configured
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {keysStatus?.supabase.configured ? (
                        <>
                          <CheckCircle2 className="h-3 w-3" />
                          {isBM ? 'Tersambung' : 'Connected'}
                        </>
                      ) : (
                        <>
                          <Database className="h-3 w-3" />
                          {isBM ? 'Dasar Tempatan Aktif' : 'Local Policy Active'}
                        </>
                      )}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-600 truncate">
                    URL: {keysStatus?.supabase.url || (isBM ? 'Dasar Berkanun Tempatan' : 'Local Statutory Fallback')}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500 font-mono">
                    Key: {keysStatus?.supabase.maskedKey || 'Configured via .env'}
                  </div>
                </div>
              </div>
            </div>

            {/* Keys Update Form */}
            <form onSubmit={handleSaveKeys} className="mt-5 space-y-3.5 border-t border-slate-200 pt-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {isBM ? 'Kemas Kini atau Tambah Kunci (Dikekalkan ke Fail)' : 'Update or Add Keys (Persisted to Storage)'}
              </h4>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  SUPABASE_URL
                </label>
                <input
                  type="text"
                  value={inputSupabaseUrl}
                  onChange={(e) => setInputSupabaseUrl(e.target.value)}
                  placeholder="https://your-project-id.supabase.co"
                  className="w-full rounded border border-slate-300 p-2 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  SUPABASE_ANON_KEY (or SUPABASE_SECRET_KEY)
                </label>
                <input
                  type="password"
                  value={inputSupabaseKey}
                  onChange={(e) => setInputSupabaseKey(e.target.value)}
                  placeholder="SUPABASE_ANON_KEY (anon public, service_role, or sb_secret_...)"
                  className="w-full rounded border border-slate-300 p-2 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  GEMINI_API_KEY (Optional override)
                </label>
                <input
                  type="password"
                  value={inputGeminiKey}
                  onChange={(e) => setInputGeminiKey(e.target.value)}
                  placeholder="AIzaSy... (leave blank to use current active Gemini key)"
                  className="w-full rounded border border-slate-300 p-2 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  OPENAI_API_KEY (Optional fallback)
                </label>
                <input
                  type="password"
                  value={inputOpenAiKey}
                  onChange={(e) => setInputOpenAiKey(e.target.value)}
                  placeholder="sk-... (optional fallback provider)"
                  className="w-full rounded border border-slate-300 p-2 text-xs font-mono"
                />
              </div>

              {keysSaveMessage && (
                <div className="rounded p-2.5 text-xs font-semibold bg-emerald-100 text-emerald-900 border border-emerald-300">
                  {keysSaveMessage}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsKeysModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  {isBM ? 'Tutup' : 'Close'}
                </button>
                <button
                  type="submit"
                  disabled={keysLoading}
                  className="rounded-lg bg-[#1C3F35] px-4 py-2 text-xs font-bold text-white hover:bg-[#285443] disabled:opacity-50 flex items-center gap-1.5"
                >
                  {keysLoading ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
                  <span>{isBM ? 'Simpan & Kekalkan Kekal' : 'Save & Preserve Permanently'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inspect All References Drawer */}
      {isDrawerOpen && (
        <div className="border-t-2 border-[#1C3F35] bg-[#FAF8F2] p-4 max-h-96 overflow-y-auto">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-300">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-[#1C3F35]" />
              <h4 className="text-sm font-bold text-[#1C3F35]">
                {isBM ? 'Semua Dokumen & Rujukan Terlibat' : 'All Grounded References in Conversation'}
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setIsDrawerOpen(false)}
              className="text-slate-500 hover:text-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {allConversationCitations.map((c) => (
              <div key={c.id} className="rounded-lg border border-slate-300 bg-white p-3 shadow-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-[#1C3F35] bg-[#E2F4E9] px-1.5 py-0.5 rounded">
                    [{c.id}]
                  </span>
                  <span className="text-xs font-bold text-slate-900 truncate flex-1">{c.title}</span>
                  {safeExternalUrl(c.sourceUrl) && (
                    <a
                      href={c.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#1C3F35] hover:underline shrink-0"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
                <p className="mt-2 text-xs text-slate-600 italic line-clamp-3">“{c.excerpt}”</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

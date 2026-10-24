import React from 'react';
import { X, ArrowRight, FileCheck, ShieldCheck, Sparkles } from 'lucide-react';
import { LanguageType } from '../types';

interface WelcomeGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tabId: string) => void;
  language: LanguageType;
}

export const WelcomeGuideModal: React.FC<WelcomeGuideModalProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
  language,
}) => {
  if (!isOpen) return null;
  const isBM = language === 'bm';

  const steps = [
    {
      num: '1',
      title: isBM ? 'Pengambilan & Semakan Invois' : 'Upload & Verify Invoices',
      desc: isBM
        ? 'Muat naik fail invois (PDF/Imej) atau tampal pesanan WhatsApp. Sistem menyemak nombor cukai (TIN) dan had ambang secara automatik.'
        : 'Upload an invoice (PDF, image, XML/JSON) or paste WhatsApp order text. The system automatically verifies amounts and buyer tax IDs.',
      actionLabel: isBM ? 'Buka Invois' : 'Go to Invoices',
      tabId: 'invoices',
      icon: FileCheck,
      color: 'bg-[#EDF6EB] text-[#1C3F35] border-[#1C3F35]',
    },
    {
      num: '2',
      title: isBM ? 'Pelepasan Cukai & Peluang PKS' : 'Tax Relief & Grants Pre-check',
      desc: isBM
        ? 'Semak padanan awal dasar PKS, pengumuman subsidi premium MediAsas tahun pertama (RM200 seorang, maksimum 50 pekerja) dan rujukan ambang perolehan e-Invois RM3 juta. Sahkan semua syarat melalui sumber rasmi.'
        : 'Review preliminary SME policy matches, the announced MediAsas first-year premium subsidy (RM200 per employee, capped at 50 employees per company), and the RM3M published e-Invoice turnover threshold reference. Verify all conditions against official sources.',
      actionLabel: isBM ? 'Peluang Perniagaan' : 'Explore Opportunities',
      tabId: 'compliance',
      icon: Sparkles,
      color: 'bg-[#FEF3C7] text-[#1C3F35] border-[#1C3F35]',
    },
    {
      num: '3',
      title: isBM ? 'Tetapan Perniagaan & Profil Entiti' : 'Business Settings & Entities',
      desc: isBM
        ? 'Urus profil syarikat anda, nombor pengenalan cukai (TIN), perolehan tahunan, dan tukar ruang kerja antara entiti perniagaan.'
        : 'Manage your company profile, tax identifiers (TIN), annual turnover, and switch workspaces across business entities.',
      actionLabel: isBM ? 'Tetapan Perniagaan' : 'Business Settings',
      tabId: 'business',
      icon: ShieldCheck,
      color: 'bg-[#D9ECDD] text-[#1C3F35] border-[#1C3F35]',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1C3F35]/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#FFFFFF] rounded border-2 border-[#1C3F35] shadow-[8px_8px_0_#1C3F35] max-w-2xl w-full overflow-hidden">
        {/* Header */}
        <div className="bg-[#FAF5E8] border-b-2 border-[#1C3F35] px-6 py-5 flex items-start justify-between">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[2px] bg-[#E5A842] text-[#1C3F35] border border-[#1C3F35] text-xs font-mono font-bold">
              <Sparkles className="w-3.5 h-3.5 text-[#1C3F35]" />
              {isBM ? 'Panduan Mula Pantas 60 Saat' : '60-Second Quick Start Guide'}
            </div>
            <h2 className="text-xl font-serif font-bold tracking-tight text-[#1C3F35]">
              {isBM ? 'Selamat Datang ke Orbyte Hub' : 'Welcome to Orbyte Hub'}
            </h2>
            <p className="text-xs text-[#4A635B] max-w-lg leading-relaxed">
              {isBM
                ? 'Platform bantuan e-Invois dan pematuhan dasar untuk PKS Malaysia. Fahami aliran kerja penuh dalam 3 langkah:'
                : 'Malaysian SME e-Invoice and policy compliance workflow. Complete the loop in three simple steps:'}
            </p>
          </div>

          <button
            onClick={onClose}
            className="text-[#1C3F35] hover:bg-[#FFFFFF] transition-colors p-1 rounded border border-[#1C3F35] cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3 Steps */}
        <div className="p-6 space-y-4 bg-[#FFFFFF]">
          <div className="grid gap-3">
            {steps.map((st) => {
              const Icon = st.icon;
              return (
                <div
                  key={st.num}
                  className="p-4 rounded border-2 border-[#1C3F35] bg-[#FFFDF8] shadow-[3px_3px_0_#1C3F35] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5">
                    <div
                      className={`w-9 h-9 rounded flex items-center justify-center shrink-0 font-bold border-2 text-sm shadow-[1.5px_1.5px_0_#1C3F35] ${st.color}`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-serif font-bold text-sm text-[#1C3F35]">
                        {st.title}
                      </div>
                      <p className="text-xs text-[#4A635B] mt-0.5 leading-relaxed max-w-md">
                        {st.desc}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      onNavigateTab(st.tabId);
                      onClose();
                    }}
                    className="h-8 px-3 rounded bg-[#FFFFFF] hover:bg-[#FAF8F2] text-[#1C3F35] border-2 border-[#1C3F35] text-xs font-bold flex items-center gap-1.5 self-end sm:self-center shrink-0 cursor-pointer shadow-[2px_2px_0_#1C3F35] active:translate-x-[1px] active:translate-y-[1px]"
                  >
                    <span>{st.actionLabel}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#285443]" />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="pt-2 text-xs text-[#4A635B] flex items-center gap-2">
            <span className="font-bold text-[#1C3F35]">💡 Demo Note:</span>
            <span>
              {isBM
                ? 'Gunakan butang "Pusat Demo" di atas untuk mencuba senario demonstrasi 3-minit bila-bila masa.'
                : 'You can test 4 pre-built 3-minute pitch scenarios anytime from the Demo & Walkthrough menu in the top bar.'}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[#FAF5E8] border-t-2 border-[#1C3F35] flex items-center justify-between">
          <span className="text-xs text-[#6B857D] font-mono">
            {isBM ? 'Panduan ini boleh dibuka semula bila-bila masa.' : 'Accessible anytime from the top bar help icon.'}
          </span>
          <button
            onClick={onClose}
            className="h-9 px-4 rounded bg-[#285443] hover:bg-[#19382E] text-white text-xs font-bold transition-colors cursor-pointer border-2 border-[#1C3F35] shadow-[2px_2px_0_#1C3F35]"
          >
            {isBM ? 'Faham, Mari Mulakan' : 'Got it, let’s begin'}
          </button>
        </div>
      </div>
    </div>
  );
};

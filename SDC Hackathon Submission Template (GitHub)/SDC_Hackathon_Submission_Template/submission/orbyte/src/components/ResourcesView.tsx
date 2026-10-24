import React from 'react';
import { ExternalLink, FileText, Landmark, ShieldCheck, BookOpen, LockKeyhole, Scale, Database, MessageSquare } from 'lucide-react';
import { PageHeader, SectionCard } from './common';

interface ResourcesViewProps { language: 'en' | 'bm'; onOpenPitchDeck?: () => void; }

const resources = [
  { name: 'LHDN e-Invoice Guidelines', detail: 'Official General and Specific e-Invoice guideline index.', url: 'https://www.hasil.gov.my/e-invois/rujukan-pelaksanaan-e-invois/garis-panduan/' },
  { name: 'LHDN e-Invoice FAQs', detail: 'Official general, industry and MyInvois clarifications.', url: 'https://www.hasil.gov.my/e-invois/rujukan-pelaksanaan-e-invois/soalan-lazim/' },
  { name: 'MyInvois SDK', detail: 'Technical API/schema reference; it is not a substitute for policy guidance.', url: 'https://sdk.myinvois.hasil.gov.my/guidelines/' },
  { name: 'Ministry of Finance', detail: 'Official MOF policy and Budget publications.', url: 'https://www.mof.gov.my/portal/en' },
];

export const ResourcesView: React.FC<ResourcesViewProps> = ({ language }) => {
  const isBM = language === 'bm';
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader tag={isBM ? 'Tentang & Rujukan' : 'About & Resources'} tagIcon={BookOpen} title={isBM ? 'Tentang Orbyte & Sumber' : 'About Orbyte & Resources'} description={isBM ? 'Halaman rujukan untuk memahami fungsi produk, privasi dan sumber rasmi berkanun.' : 'A dedicated reference area for the product architecture, privacy compliance, and official statutory sources.'} />

      <div className="grid gap-6 lg:grid-cols-[1.45fr_.8fr]">
        <div className="space-y-6">
          <SectionCard title={isBM ? '01 // Tentang Orbyte' : '01 // About Orbyte'} icon={ShieldCheck}>
            <p className="text-sm leading-7 text-slate-700">{isBM ? 'Orbyte membantu PKS mengurus intake e-Invois, semakan peraturan, kelayakan polisi dan jejak audit dalam satu ruang kerja. AI membaca input tidak berstruktur; rule engine menentukan keputusan; manusia kekal meluluskan tindakan kritikal.' : 'Orbyte helps SMEs manage e-Invoice intake, rule checks, policy eligibility and audit evidence in one workspace. AI reads unstructured input; the rule engine makes deterministic checks; humans retain approval authority for critical actions.'}</p>
            <div className="grid gap-3 md:grid-cols-3 mt-5">
              {[
                ['AI Reads', 'PDF, receipts and WhatsApp text are converted into structured fields.'],
                ['Rules Decide', 'Configured backend rules evaluate thresholds, fields and eligibility.'],
                ['Humans Approve', 'Owners or authorised reviewers approve sensitive actions and policy changes.'],
              ].map(([title, body], i) => <div key={title} className="p-4 bg-[#FAF8F2] border-2 border-[#1C3F35] shadow-[3px_3px_0_#1C3F35]"><div className="text-xs font-mono font-bold text-[#E5A842]">0{i + 1}</div><h3 className="font-bold text-[#1C3F35] mt-1">{title}</h3><p className="text-xs leading-5 text-[#4A635B] mt-2">{body}</p></div>)}
            </div>
          </SectionCard>

          <SectionCard title={isBM ? '02 // PDPA & Privasi' : '02 // PDPA & Privacy'} icon={LockKeyhole}>
            <p className="text-sm leading-7 text-slate-700">{isBM ? 'Bahagian ini menerangkan cara Orbyte direka untuk meminimumkan dan mengawal penggunaan data perniagaan serta data pihak berurus niaga. Ia ialah penerangan produk, bukan pengesahan undang-undang bahawa setiap konfigurasi organisasi mematuhi PDPA.' : 'This section explains how Orbyte is designed to minimise and control business and counterparty data use. It is a product privacy explanation, not a legal certification that every deployment configuration complies with PDPA.'}</p>
            <div className="mt-5 space-y-3">
              {[
                ['Purpose & Minimisation', 'Invoice fields such as names, TIN/BRN and transaction details are processed for the relevant compliance workflow and should not be collected beyond the configured purpose.'],
                ['Access Control', 'RBAC separates staff/view-only access, owner approval authority and expert/admin policy operations. Server-side authorisation remains the control point.'],
                ['Auditability', 'Approval and policy actions are recorded in the audit ledger; integrity verification uses the backend SHA-256 chain.'],
                ['No Banking Credentials', 'Orbyte does not need online-banking passwords, card PINs or payment credentials to perform the demonstrated compliance workflow.'],
                ['AI Processing', 'AI is used for unstructured extraction and policy-text assistance where configured. Deterministic compliance calculations remain in backend rules.'],
                ['Retention & Deployment', 'Actual retention, hosting, Supabase configuration and third-party processing depend on the deployed environment and must be configured and documented by the operator.'],
                ['User Rights & Requests', 'Organisations should provide an appropriate contact and process for data access, correction, deletion/retention and other applicable privacy requests under their own governance process.'],
              ].map(([title, body]) => <div key={title} className="p-4 bg-white border-2 border-[#1C3F35]"><div className="font-bold text-sm text-[#1C3F35]">{title}</div><div className="text-xs leading-6 text-[#4A635B] mt-1">{body}</div></div>)}
            </div>
            <div className="mt-5 p-4 bg-[#F4FAF7] border-2 border-[#1C3F35] border-l-[5px] border-l-[#337365] text-xs leading-6 text-[#1C3F35]"><strong>Privacy note:</strong> {isBM ? 'Semak konfigurasi deployment, pembekal AI, Supabase, logging dan polisi retention sebenar sebelum production use.' : 'Review the actual deployment, AI provider, Supabase, logging and retention configuration before production use.'}</div>
          </SectionCard>

          <SectionCard title={isBM ? '03 // Penafian' : '03 // Disclaimer'} icon={Scale}>
            <div className="p-4 bg-[#FFFBEB] border-2 border-[#D97706] border-l-[5px] text-sm leading-7 text-[#78350F]">{isBM ? 'Keputusan Orbyte ialah bantuan semakan awal. Ia bukan nasihat undang-undang atau cukai, bukan pengesahan rasmi MyInvois dan bukan bukti bahawa sesuatu langkah telah menjadi kewajipan undang-undang. Semak sumber rasmi, tarikh kuat kuasa dan penasihat yang berkelayakan sebelum bertindak.' : 'Orbyte results are preliminary compliance assistance. They are not legal or tax advice, official MyInvois validation, or proof that a measure has legal effect. Confirm official sources, effective dates and professional advice before acting.'}</div>
          </SectionCard>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24 self-start">
          <SectionCard title={isBM ? 'Sumber Rasmi' : 'Official Sources'} icon={Landmark}>
            <div className="divide-y divide-[#E5DEC9]">
              {resources.map((r) => <a key={r.name} href={r.url} target="_blank" rel="noreferrer" className="flex gap-3 py-4 first:pt-0 last:pb-0 no-underline"><div className="p-2 bg-[#EDF6EB] border border-[#1C3F35] text-[#1C3F35]"><FileText className="w-4 h-4" /></div><div className="min-w-0 flex-1"><div className="font-bold text-sm text-[#1C3F35]">{r.name}</div><div className="text-xs leading-5 text-[#4A635B] mt-1">{r.detail}</div></div><ExternalLink className="w-4 h-4 text-[#4A635B] mt-1 shrink-0" /></a>)}
            </div>
          </SectionCard>

          <SectionCard title={isBM ? 'Aliran Utama' : 'Core Flow'} icon={Database}>
            <div className="space-y-2 text-xs text-[#4A635B]"><div className="flex gap-2"><MessageSquare className="w-4 h-4 shrink-0 text-[#285443]" />WhatsApp / PDF intake</div><div>↓ AI extraction</div><div>↓ deterministic compliance checks</div><div>↓ human review & approval</div><div>↓ SHA-256 audit evidence</div></div>
          </SectionCard>
        </aside>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';

export type TermKey = 'TIN' | 'RBAC' | 'SHA-256' | 'Consolidation';

interface TermTooltipProps {
  term: TermKey;
  children?: React.ReactNode;
  language?: 'en' | 'bm';
}

const TERM_EXPLANATIONS: Record<TermKey, { name: string; en: string; bm: string; zh: string }> = {
  TIN: {
    name: 'TIN (Tax Identification Number)',
    en: 'A tax identification number issued by LHDN. Whether it is required depends on the transaction and the current official e-Invoice guidance.',
    bm: 'Nombor Pengenalan Cukai unik yang dikeluarkan oleh LHDN. Wajib untuk e-invois dan tuntutan pelepasan cukai rasmi.',
    zh: '由 LHDN 赋予的税务识别号码。是否需要提供，应根据交易类型和现行官方电子发票指引确认。',
  },
  RBAC: {
    name: 'RBAC (Role-Based Access Control)',
    en: 'Permissions depend on role. The server must enforce access checks; interface hiding alone is not authorization.',
    bm: 'Kawalan akses berasaskan peranan jawatan: Staf hanya lihat (403), Pemilik lulus invois, Pakar Cukai terbit peraturan.',
    zh: '基于角色的权限控制：员工只读脱敏信息（越权返回403）、老板签署确认、税务专家审批法规，严防违规。',
  },
  'SHA-256': {
    name: 'SHA-256 Cryptographic Hash Chain',
    en: 'A SHA-256 hash links a record to the previous record. Verification can detect changes in the checked chain; this demo stores records in memory and has no external immutable checkpoint.',
    bm: 'Hash SHA-256 menghubungkan rekod dengan rekod sebelumnya. Pengesahan boleh mengesan perubahan pada rantaian yang diperiksa; demo ini menyimpan rekod dalam memori tanpa titik semak luaran yang tidak boleh diubah.',
    zh: 'SHA-256 哈希链会把每条记录连接到上一条记录。验证可以发现当前检查链中的不一致；此 Demo 使用内存储存，未配置外部不可变校验点。',
  },
  Consolidation: {
    name: 'Invoice Consolidation (Penyatuan)',
    en: 'The demo models a configurable invoice-consolidation threshold. Confirm the current official e-Invoice guidance before relying on any threshold or exception.',
    bm: 'Demo ini memodelkan ambang penyatuan invois yang boleh dikonfigurasi. Sahkan panduan e-Invois rasmi terkini sebelum bergantung pada mana-mana ambang atau pengecualian.',
    zh: '发票合并说明：本 Demo 使用可配置的合并阈值。实际使用任何阈值或例外前，应核对最新官方电子发票指引。',
  },
};

export const TermTooltip: React.FC<TermTooltipProps> = ({ term, children, language = 'en' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const info = TERM_EXPLANATIONS[term];
  const isBM = language === 'bm';
  const text = isBM ? info.bm : info.zh ? `${info.zh} (${info.en})` : info.en;

  return (
    <span className="relative inline-flex items-center gap-1 group cursor-help">
      {children || <span>{term}</span>}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        className="text-slate-400 hover:text-blue-600 transition-colors inline-flex items-center p-0.5 rounded focus:outline-none"
        title={text}
        aria-label={`Explain ${term}`}
      >
        <HelpCircle className="w-3.5 h-3.5 text-blue-500 hover:text-blue-700" />
      </button>

      {isOpen && (
        <span
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 bg-[#1C3F35] text-white text-xs font-normal rounded-xl shadow-xl z-50 pointer-events-none leading-relaxed border border-slate-700 normal-case"
        >
          <strong className="block text-sky-300 font-bold mb-1 border-b border-slate-700 pb-1">
            {info.name}
          </strong>
          <span className="text-slate-200">{text}</span>
          <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900" />
        </span>
      )}
    </span>
  );
};

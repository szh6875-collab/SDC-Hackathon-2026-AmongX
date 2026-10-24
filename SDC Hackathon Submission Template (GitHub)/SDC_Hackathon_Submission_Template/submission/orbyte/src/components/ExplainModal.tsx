import React from 'react';
import { X, BookOpen, ShieldCheck, FileText, CheckCircle2 } from 'lucide-react';
import { RuleResult } from '../types';

interface ExplainModalProps {
  rule: RuleResult | null;
  onClose: () => void;
}

export const ExplainModal: React.FC<ExplainModalProps> = ({ rule, onClose }) => {
  if (!rule) return null;

  const isBlocked = rule.status === 'BLOCKED' || rule.status === 'FAIL';
  const isReview = rule.status === 'REVIEW_REQUIRED' || rule.status === 'WARN' || rule.status === 'MISSING_DATA';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1C3F35]/70 backdrop-blur-xs animate-in fade-in">
      <div className="bg-[#FFFFFF] rounded border-2 border-[#1C3F35] shadow-[8px_8px_0_#1C3F35] max-w-xl w-full overflow-hidden">
        {/* Header */}
        <div className="bg-[#FAF5E8] border-b-2 border-[#1C3F35] text-[#1C3F35] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#285443]" />
            <h3 className="font-serif font-bold text-base tracking-wide text-[#1C3F35]">
              Rule Explainability &amp; Legal Citation
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#1C3F35] hover:bg-[#FFFFFF] transition-colors p-1 rounded border border-[#1C3F35] cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-sm bg-[#FFFFFF]">
          <div className="flex items-center justify-between pb-3 border-b-2 border-[#1C3F35]/20">
            <div>
              <span className="text-[10px] uppercase font-mono tracking-wider text-[#6B857D] font-bold">Rule Identifier</span>
              <div className="text-base font-mono font-bold text-[#1C3F35]">{rule.rule_id || rule.rule}</div>
            </div>
            <div>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-[2px] text-xs font-mono font-bold border ${
                isBlocked
                  ? 'bg-[#FDF2F2] text-[#991B1B] border-[#B33927]'
                  : isReview
                  ? 'bg-[#FEF3C7] text-[#1C3F35] border-[#1C3F35]'
                  : 'bg-[#EDF6EB] text-[#1C3F35] border-[#1C3F35]'
              }`}>
                {rule.status}
              </span>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-mono font-bold text-[#4A635B] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#285443]" /> Deterministic Outcome Explanation
            </h4>
            <div className="bg-[#FAF5E8] border-2 border-[#1C3F35] rounded p-3 text-[#1C3F35] leading-relaxed font-sans shadow-[2px_2px_0_#1C3F35]">
              {rule.explanation}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-mono font-bold text-[#4A635B] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#285443]" /> Configured Demo Rule Reference
            </h4>
            <div className="bg-[#EDF6EB] border-2 border-[#1C3F35] rounded p-3.5 space-y-2 shadow-[2px_2px_0_#1C3F35]">
              <div className="font-bold text-[#1C3F35] text-xs font-mono">
                {rule.reference || 'Orbyte local demo rule (source not verified)'}
              </div>
              <p className="text-xs text-[#4A635B] leading-relaxed">
                This result is produced by Orbyte's locally configured demo rules. The source labels and thresholds shown here have not been independently checked against current official guidance. This prototype does not verify TIN/BRN with LHDN and does not submit invoices to MyInvois.
              </p>
            </div>
          </div>

          <div className="bg-[#FFFDF8] p-3 rounded border border-[#1C3F35] text-xs text-[#4A635B] flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#285443] shrink-0 mt-0.5" />
            <div>
              <strong className="text-[#1C3F35]">Suggested next step:</strong> Review the source document and the configured demo rule result. Confirm current official requirements independently before making a compliance decision.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#FAF5E8] px-6 py-3 border-t-2 border-[#1C3F35] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#285443] hover:bg-[#19382E] text-white rounded text-xs font-bold transition-colors border-2 border-[#1C3F35] shadow-[2px_2px_0_#1C3F35] cursor-pointer"
          >
            Close Citation
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { HelpCircle, Info, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

interface InfoHintProps {
  title: string;
  children?: React.ReactNode;
  content?: React.ReactNode;
  variant?: 'hint' | 'disclaimer' | 'banner' | 'amber' | 'blue';
  defaultOpen?: boolean;
  className?: string;
}

export const InfoHint: React.FC<InfoHintProps> = ({
  title,
  children,
  content,
  variant = 'hint',
  defaultOpen = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const body = children ?? content;

  if (variant === 'banner' || variant === 'blue') {
    return (
      <div className={`p-4 rounded-xl bg-blue-50/70 border border-blue-200/80 text-blue-900 text-xs leading-relaxed ${className}`}>
        <div className="flex items-start gap-2.5">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong className="font-semibold block mb-0.5 text-blue-950">{title}</strong>
            <div className="text-blue-900/90 text-xs">{body}</div>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'amber' || variant === 'disclaimer') {
    return (
      <div className={`p-4 rounded-xl bg-amber-50/80 border border-amber-200/90 text-amber-950 text-xs leading-relaxed ${className}`}>
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong className="font-semibold block mb-0.5 text-amber-950">{title}</strong>
            <div className="text-amber-900/90 text-xs">{body}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-slate-200 bg-slate-50/50 text-xs overflow-hidden transition-all ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between text-left text-slate-700 hover:bg-slate-100/70 transition-colors cursor-pointer"
      >
        <span className="flex items-center gap-2 font-medium text-slate-800">
          <HelpCircle className="w-4 h-4 text-blue-600" />
          <span>{title}</span>
        </span>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {isOpen && (
        <div className="px-4 pb-3.5 pt-1.5 text-slate-600 leading-relaxed border-t border-slate-200/50 bg-white">
          {body}
        </div>
      )}
    </div>
  );
};

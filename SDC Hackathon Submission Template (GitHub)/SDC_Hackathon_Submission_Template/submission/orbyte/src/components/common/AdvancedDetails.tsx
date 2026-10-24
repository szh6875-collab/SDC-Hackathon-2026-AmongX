import React, { useState } from 'react';
import { ChevronDown, ChevronRight, SlidersHorizontal } from 'lucide-react';

interface AdvancedDetailsProps {
  title: string;
  badge?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

export const AdvancedDetails: React.FC<AdvancedDetailsProps> = ({
  title,
  badge,
  children,
  defaultOpen = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors cursor-pointer"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2">
          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-500" />
          )}
          <span className="text-sm font-semibold text-slate-800">{title}</span>
          {badge && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
              {badge}
            </span>
          )}
        </div>
        <span className="text-xs text-blue-600 font-medium hover:underline">
          {isOpen ? 'Collapse' : 'Expand'}
        </span>
      </button>

      {isOpen && (
        <div className="p-4 border-t border-slate-100 bg-slate-50/40 text-xs">
          {children}
        </div>
      )}
    </div>
  );
};

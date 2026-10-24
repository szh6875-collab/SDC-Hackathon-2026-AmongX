import React from 'react';
import { LucideIcon } from 'lucide-react';

interface SectionCardProps {
  title?: string;
  subtitle?: string;
  icon?: LucideIcon | React.ComponentType<{ className?: string }> | React.ReactNode;
  headerBadge?: React.ReactNode;
  badge?: React.ReactNode;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
  footer?: React.ReactNode;
}

export const SectionCard: React.FC<SectionCardProps> = ({
  title,
  subtitle,
  icon,
  headerBadge,
  badge,
  headerAction,
  children,
  className = '',
  noPadding = false,
  footer,
}) => {
  const effectiveBadge = badge ?? headerBadge;
  const hasHeader = Boolean(title || effectiveBadge || headerAction);

  const renderIcon = () => {
    if (!icon) return null;
    if (React.isValidElement(icon)) return icon;
    const IconComp = icon as React.ComponentType<{ className?: string }>;
    return <IconComp className="w-4 h-4" />;
  };

  return (
    <div className={`bg-white rounded-xl border-2 border-[#1C3F35] shadow-[3px_3px_0_#1C3F35] overflow-hidden ${className}`}>
      {hasHeader && (
        <div className="px-5 py-4 border-b-2 border-[#1C3F35]/20 bg-[#FAF8F2] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {icon && (
              <div className="w-8 h-8 rounded-lg bg-[#1C3F35] text-white flex items-center justify-center shrink-0 shadow-2xs">
                {renderIcon()}
              </div>
            )}
            <div>
              {title && (
                <h2
                  className="text-base sm:text-lg lg:text-xl font-black text-[#0A1814] leading-tight tracking-tight !text-[#0A1814]"
                  style={{ color: '#0A1814' }}
                >
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="text-sm sm:text-base text-[#1C3F35] mt-1 leading-relaxed font-bold">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {effectiveBadge}
            {headerAction}
          </div>
        </div>
      )}

      <div className={noPadding ? '' : 'p-5 sm:p-6'}>
        {children}
      </div>

      {footer && (
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/60 text-sm sm:text-base text-slate-700 font-medium">
          {footer}
        </div>
      )}
    </div>
  );
};

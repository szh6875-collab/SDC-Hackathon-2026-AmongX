import React from 'react';
import { LucideIcon } from 'lucide-react';

interface ActionConfig {
  label: string;
  icon?: LucideIcon | React.ComponentType<{ className?: string }> | React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  title?: string;
}

interface PageHeaderProps {
  title: string;
  description: string;
  tag?: string;
  tagIcon?: LucideIcon | React.ComponentType<{ className?: string }> | React.ReactNode;
  primaryAction?: ActionConfig;
  secondaryAction?: ActionConfig;
  children?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  tag,
  tagIcon,
  primaryAction,
  secondaryAction,
  children,
}) => {
  const getButtonClass = (variant: ActionConfig['variant'] = 'primary', disabled?: boolean) => {
    if (disabled) {
      return 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed';
    }
    switch (variant) {
      case 'secondary':
        return 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 hover:border-slate-400 shadow-xs';
      case 'danger':
        return 'bg-rose-600 hover:bg-rose-500 text-white shadow-xs';
      case 'ghost':
        return 'bg-transparent hover:bg-slate-100 text-slate-600';
      case 'primary':
      default:
        return 'bg-[#1C3F35] hover:bg-[#285443] text-white shadow-xs';
    }
  };

  const renderIcon = (iconItem: any, defaultClass: string) => {
    if (!iconItem) return null;
    if (React.isValidElement(iconItem)) return iconItem;
    const IconComp = iconItem;
    return <IconComp className={defaultClass} />;
  };

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
      <div className="space-y-1 max-w-3xl">
        {tag && (
          <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200/80 mb-1">
            {renderIcon(tagIcon, 'w-4 h-4')}
            <span>{tag}</span>
          </div>
        )}
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#0A1814]">
          {title}
        </h1>
        <p className="text-base sm:text-lg text-[#1C3F35] leading-relaxed font-bold">
          {description}
        </p>
      </div>

      {(primaryAction || secondaryAction || children) && (
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              disabled={secondaryAction.disabled}
              title={secondaryAction.title}
              className={`h-10 px-4 rounded-lg text-sm sm:text-base font-semibold transition-colors flex items-center gap-2 cursor-pointer ${getButtonClass(
                secondaryAction.variant || 'secondary',
                secondaryAction.disabled
              )}`}
            >
              {renderIcon(secondaryAction.icon, 'w-4.5 h-4.5')}
              <span>{secondaryAction.label}</span>
            </button>
          )}

          {primaryAction && (
            <button
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
              title={primaryAction.title}
              className={`h-10 px-4 rounded-lg text-sm sm:text-base font-semibold transition-colors flex items-center gap-2 cursor-pointer ${getButtonClass(
                primaryAction.variant || 'primary',
                primaryAction.disabled
              )}`}
            >
              {renderIcon(primaryAction.icon, 'w-4.5 h-4.5')}
              <span>{primaryAction.label}</span>
            </button>
          )}

          {children}
        </div>
      )}
    </div>
  );
};

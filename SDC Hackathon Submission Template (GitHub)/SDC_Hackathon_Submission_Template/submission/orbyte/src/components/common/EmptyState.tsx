import React from 'react';
import { LucideIcon, Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon | React.ComponentType<{ className?: string }> | React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon | React.ComponentType<{ className?: string }> | React.ReactNode;
  };
  actionLabel?: string;
  onAction?: () => void;
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = Inbox,
  title,
  description,
  action,
  actionLabel,
  onAction,
  secondaryAction,
  className = '',
}) => {
  const effectiveAction = action ?? (actionLabel && onAction ? { label: actionLabel, onClick: onAction } : undefined);

  const renderIcon = (iconItem: any, defaultClass: string) => {
    if (!iconItem) return null;
    if (React.isValidElement(iconItem)) return iconItem;
    const IconComp = iconItem;
    return <IconComp className={defaultClass} />;
  };

  return (
    <div className={`p-8 text-center max-w-md mx-auto flex flex-col items-center justify-center ${className}`}>
      <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-3.5">
        {renderIcon(icon, 'w-6 h-6')}
      </div>
      <h3 className="text-base font-semibold text-slate-800 mb-1">
        {title}
      </h3>
      <p className="text-sm text-slate-500 mb-5 leading-relaxed">
        {description}
      </p>

      {(effectiveAction || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          {effectiveAction && (
            <button
              onClick={effectiveAction.onClick}
              className="h-9 px-4 rounded-lg bg-[#1C3F35] hover:bg-[#285443] text-white text-sm font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              {renderIcon(effectiveAction.icon, 'w-4 h-4')}
              <span>{effectiveAction.label}</span>
            </button>
          )}

          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="h-9 px-3.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-semibold transition-colors cursor-pointer"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

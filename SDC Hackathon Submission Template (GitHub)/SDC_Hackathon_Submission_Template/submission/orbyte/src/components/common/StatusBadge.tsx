import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Clock, ShieldCheck, HelpCircle } from 'lucide-react';

export type StatusVariant =
  | 'PASS'
  | 'WARN'
  | 'BLOCKED'
  | 'FAIL'
  | 'REVIEW_REQUIRED'
  | 'MISSING_DATA'
  | 'approved'
  | 'pending_approval'
  | 'pending_review'
  | 'ready'
  | 'in_force'
  | 'proposed'
  | 'awaiting_details'
  | 'neutral';

interface StatusBadgeProps {
  status: StatusVariant | string;
  label?: string;
  size?: 'sm' | 'md';
  showIcon?: boolean;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  size = 'md',
  showIcon = true,
  className = '',
}) => {
  const norm = String(status).toLowerCase();

  let styles = 'bg-slate-100 text-slate-700 border-slate-200';
  let Icon = HelpCircle;
  let defaultLabel = String(status);

  if (norm === 'pass' || norm === 'approved' || norm === 'in_force' || norm === 'ready') {
    styles = 'bg-emerald-50 text-emerald-800 border-emerald-300';
    Icon = CheckCircle2;
    defaultLabel = norm === 'approved' ? 'Approved' : norm === 'in_force' ? 'Active' : 'Pass';
  } else if (
    norm === 'warn' ||
    norm === 'review_required' ||
    norm === 'pending_review' ||
    norm === 'pending_approval' ||
    norm === 'awaiting_details'
  ) {
    styles = 'bg-amber-50 text-amber-900 border-amber-300';
    Icon = norm === 'pending_approval' ? Clock : AlertTriangle;
    defaultLabel =
      norm === 'pending_approval'
        ? 'Pending Approval'
        : norm === 'awaiting_details'
        ? 'Awaiting Details'
        : 'Review Required';
  } else if (norm === 'blocked' || norm === 'fail' || norm === 'missing_data' || norm === 'rejected') {
    styles = 'bg-rose-50 text-rose-800 border-rose-300';
    Icon = XCircle;
    defaultLabel = norm === 'blocked' ? 'Blocked' : norm === 'missing_data' ? 'Missing Info' : 'Failed';
  } else if (norm === 'proposed') {
    styles = 'bg-blue-50 text-blue-800 border-blue-300';
    Icon = Clock;
    defaultLabel = 'Proposed Draft';
  }

  const sizeClasses =
    size === 'sm'
      ? 'text-xs sm:text-sm px-2.5 py-0.5 gap-1.5'
      : 'text-sm sm:text-base px-3 py-1 gap-2 font-semibold';

  return (
    <span
      className={`inline-flex items-center rounded-md border font-sans font-medium tracking-wide ${styles} ${sizeClasses} ${className}`}
    >
      {showIcon && <Icon className={size === 'sm' ? 'w-3.5 h-3.5 shrink-0' : 'w-4 h-4 shrink-0'} />}
      <span>{label || defaultLabel}</span>
    </span>
  );
};

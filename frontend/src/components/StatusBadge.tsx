import React from 'react';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const normalized = status.toLowerCase();

  let colorClasses =
    'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';

  if (
    normalized === 'completed' ||
    normalized === 'done' ||
    normalized === 'satisfied' ||
    normalized === 'verified' ||
    normalized === 'eligible for completion'
  ) {
    colorClasses =
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800';
  } else if (
    normalized === 'in progress' ||
    normalized === 'in review' ||
    normalized === 'ready for review'
  ) {
    colorClasses =
      'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800';
  } else if (
    normalized === 'needs verification' ||
    normalized === 'pending' ||
    normalized === 'planning' ||
    normalized === 'to do' ||
    normalized === 'medium'
  ) {
    colorClasses =
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800';
  } else if (
    normalized === 'blocked' ||
    normalized === 'failed' ||
    normalized === 'not ready' ||
    normalized === 'critical' ||
    normalized === 'high' ||
    normalized === 'unmapped'
  ) {
    colorClasses =
      'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800';
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClasses} ${className}`}
    >
      {status}
    </span>
  );
};

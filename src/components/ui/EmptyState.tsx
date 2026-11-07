import React from 'react';
import { Button } from './Button';

export interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-4 text-center border border-dashed border-[#E8E8E8] dark:border-[#252525] rounded-xl bg-neutral-50/50 dark:bg-[#090909]/40">
      <div className="p-3 bg-white dark:bg-[#161616] border border-[#E8E8E8] dark:border-[#252525] rounded-xl text-[#111111] dark:text-neutral-300 mb-3 shadow-xs">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-[#111111] dark:text-white tracking-tight">{title}</h3>
      <p className="text-xs text-[#666666] dark:text-[#A1A1A1] max-w-sm mt-1 leading-relaxed">{description}</p>
      {(actionLabel || secondaryActionLabel) && (
        <div className="flex items-center gap-2.5 mt-5">
          {secondaryActionLabel && onSecondaryAction && (
            <Button variant="outline" size="sm" onClick={onSecondaryAction}>
              {secondaryActionLabel}
            </Button>
          )}
          {actionLabel && onAction && (
            <Button variant="primary" size="sm" onClick={onAction}>
              {actionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

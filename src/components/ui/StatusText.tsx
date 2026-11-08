import React from 'react';
import type { LicenseStatus } from '../../types';

interface StatusTextProps {
  status: LicenseStatus | 'online' | 'offline' | 'active' | 'disabled' | string;
  showDot?: boolean;
}

export const StatusText: React.FC<StatusTextProps> = ({ status }) => {
  const safeStatus = (typeof status === 'string' && status.trim()) ? status.trim() : 'active';
  const normalized = safeStatus.toLowerCase();

  const getStatusConfig = () => {
    switch (normalized) {
      case 'active':
      case 'online':
      case 'funcional':
        return {
          label: 'Ativa / Funcional',
          dotClass: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]',
          textClass: 'text-emerald-700 dark:text-emerald-400 font-medium',
        };
      case 'pending':
      case 'pendente':
        return {
          label: 'Pendente (1º uso)',
          dotClass: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]',
          textClass: 'text-amber-700 dark:text-amber-400 font-medium',
        };
      case 'expired':
      case 'expirada':
        return {
          label: 'Expirada',
          dotClass: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.3)]',
          textClass: 'text-red-700 dark:text-red-400 font-normal',
        };
      case 'suspended':
      case 'suspensa':
        return {
          label: 'Suspensa',
          dotClass: 'bg-amber-500',
          textClass: 'text-amber-700 dark:text-amber-400 font-medium',
        };
      case 'banned':
      case 'banida':
      case 'revoked':
        return {
          label: 'Banida',
          dotClass: 'bg-red-600',
          textClass: 'text-red-700 dark:text-red-400 font-semibold',
        };
      case 'archived':
      case 'arquivada':
        return {
          label: 'Arquivada',
          dotClass: 'bg-neutral-400 dark:bg-neutral-600',
          textClass: 'text-neutral-600 dark:text-neutral-400 font-normal',
        };
      case 'deleted':
      case 'excluida':
      case 'excluída':
        return {
          label: 'Excluída',
          dotClass: 'bg-red-950 dark:bg-red-600',
          textClass: 'text-neutral-500 dark:text-neutral-400 line-through font-normal',
        };
      case 'offline':
        return {
          label: 'Offline',
          dotClass: 'bg-neutral-400 dark:bg-neutral-600',
          textClass: 'text-neutral-600 dark:text-neutral-400 font-normal',
        };
      case 'disabled':
        return {
          label: 'Desativado',
          dotClass: 'bg-neutral-400 dark:bg-neutral-600',
          textClass: 'text-neutral-600 dark:text-neutral-400 font-normal',
        };
      case 'unlinked':
        return {
          label: 'Desvinculado',
          dotClass: 'bg-neutral-400 dark:bg-neutral-600',
          textClass: 'text-neutral-600 dark:text-neutral-400 font-normal',
        };
      default:
        return {
          label: safeStatus,
          dotClass: 'bg-neutral-400 dark:bg-neutral-500',
          textClass: 'text-neutral-600 dark:text-neutral-300 font-normal',
        };
    }
  };

  const config = getStatusConfig();

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${config.textClass}`}>
      <span aria-hidden="true" className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dotClass}`} />
      <span className="capitalize">{config.label}</span>
    </span>
  );
};

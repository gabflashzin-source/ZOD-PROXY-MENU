import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  className = '',
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium transition-all select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-400 disabled:opacity-40 disabled:pointer-events-none rounded-lg whitespace-nowrap shrink-0 active:scale-[0.98] cursor-pointer';

  const sizeStyles = {
    xs: 'text-[11px] px-2.5 py-1 h-7 min-h-[28px] gap-1.5',
    sm: 'text-xs px-3 py-1.5 h-8 min-h-[32px] gap-1.5',
    md: 'text-sm px-4 py-2 h-9 min-h-[36px] gap-2',
    lg: 'text-sm px-5 py-2.5 h-10 min-h-[40px] gap-2.5',
  };

  const variantStyles = {
    primary:
      'bg-[#111111] text-white hover:bg-[#252525] border border-[#111111] dark:bg-white dark:text-[#050505] dark:hover:bg-neutral-200 dark:border-white font-semibold shadow-xs',
    secondary:
      'bg-white text-[#111111] hover:bg-neutral-100 border border-[#E8E8E8] dark:bg-[#161616] dark:text-neutral-100 dark:hover:bg-[#222222] dark:border-[#252525]',
    outline:
      'bg-transparent text-[#111111] hover:bg-black/5 border border-[#E8E8E8] dark:text-neutral-200 dark:hover:bg-white/5 dark:border-[#252525]',
    danger:
      'bg-transparent text-red-600 border border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-900/60 dark:hover:bg-red-950/40',
    ghost:
      'bg-transparent text-[#666666] hover:text-[#111111] hover:bg-black/5 dark:text-[#A1A1A1] dark:hover:text-white dark:hover:bg-white/5 border border-transparent',
  };

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-current" />
      ) : (
        icon && <span className="shrink-0">{icon}</span>
      )}
      {children && <span>{children}</span>}
    </button>
  );
};

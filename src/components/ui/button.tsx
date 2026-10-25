import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled = false,
      icon,
      children,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const isIconOnly = variant === 'icon' || (!children && icon);

    const sizeClasses = {
      sm: isIconOnly ? 'w-8 h-8 p-1.5' : 'h-8 px-3 text-xs gap-1.5',
      md: isIconOnly ? 'w-10 h-10 p-2.5 sm:w-10 sm:h-10 min-w-[44px] min-h-[44px] sm:min-w-10 sm:min-h-10' : 'h-10 px-4 text-xs font-semibold gap-2 min-h-[44px] sm:min-h-10',
      lg: isIconOnly ? 'w-12 h-12 p-3' : 'h-12 px-6 text-sm font-semibold gap-2.5 min-h-[48px]',
    }[size];

    const variantClasses = {
      primary:
        'bg-stamp text-on-stamp hover:bg-stamp-strong shadow-xs active:scale-[0.98] border border-transparent',
      secondary:
        'bg-sheet hover:bg-sheet-2 text-ink border border-rule-strong shadow-xs active:scale-[0.98]',
      ghost:
        'bg-transparent text-stamp hover:bg-stamp-soft active:scale-[0.98]',
      danger:
        'bg-critical-solid text-on-critical-solid hover:opacity-90 shadow-xs active:scale-[0.98] border border-transparent',
      icon:
        'bg-transparent text-ink-2 hover:bg-sheet-2 hover:text-ink active:scale-[0.98] rounded-full',
    }[variant];

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center rounded-control transition-all duration-instant select-none font-sans cursor-pointer',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-stamp focus-visible:ring-offset-2 focus-visible:ring-offset-sheet',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 disabled:hover:bg-auto',
          sizeClasses,
          variantClasses,
          className
        )}
        {...props}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
        ) : (
          icon && <span className="shrink-0">{icon}</span>
        )}
        {children && <span className="truncate">{children}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';

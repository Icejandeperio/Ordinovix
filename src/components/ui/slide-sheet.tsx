import React, { useEffect } from 'react';
import { m, AnimatePresence, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/cn';

export interface SlideSheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
  side?: 'right' | 'left';
  zIndex?: string;
  ariaLabel?: string;
  className?: string;
  panelClassName?: string;
  isPrintable?: boolean;
}

export function SlideSheet({
  open,
  onClose,
  children,
  maxWidth = 'max-w-lg',
  side = 'right',
  zIndex = 'z-50',
  ariaLabel = 'Slide panel',
  className,
  panelClassName,
  isPrintable = false,
}: SlideSheetProps) {
  const systemReducedMotion = useReducedMotion();
  const htmlReduceMotion =
    typeof document !== 'undefined' &&
    document.documentElement.getAttribute('data-reduce-motion') === 'true';
  const shouldReduceMotion = systemReducedMotion || htmlReduceMotion;

  // Handle Escape key to close
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Lock body scroll when sheet is open
  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  const slideInitial = side === 'right' ? '100%' : '-100%';
  const slideExit = side === 'right' ? '100%' : '-100%';

  return (
    <AnimatePresence>
      {open && (
        <div
          className={cn(
            'fixed inset-0 overflow-hidden flex',
            side === 'right' ? 'justify-end' : 'justify-start',
            zIndex,
            className
          )}
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
          data-printable-drawer={isPrintable ? 'true' : undefined}
        >
          {/* Backdrop with gradual fade and gradual backdrop blur */}
          <m.div
            key="sheet-backdrop"
            initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            animate={{ opacity: 1, backdropFilter: 'blur(6px)' }}
            exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            transition={{
              duration: shouldReduceMotion ? 0 : 0.28,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="fixed inset-0 bg-ink/40"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Smooth Sliding Drawer Panel */}
          <m.div
            key="sheet-panel"
            initial={{ x: shouldReduceMotion ? 0 : slideInitial }}
            animate={{ x: 0 }}
            exit={{ x: shouldReduceMotion ? 0 : slideExit }}
            transition={{
              duration: shouldReduceMotion ? 0 : 0.32,
              ease: [0.16, 1, 0.3, 1],
            }}
            className={cn(
              'relative w-full h-full bg-sheet border-rule shadow-2xl flex flex-col z-10 overflow-hidden',
              side === 'right' ? 'border-l' : 'border-r',
              maxWidth,
              panelClassName
            )}
            data-printable-drawer={isPrintable ? 'true' : undefined}
          >
            {children}
          </m.div>
        </div>
      )}
    </AnimatePresence>
  );
}

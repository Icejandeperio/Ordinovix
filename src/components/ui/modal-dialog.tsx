import React, { useEffect } from 'react';
import { m, AnimatePresence, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/cn';
import { centerModalStore } from '@/lib/modal-store';

export interface ModalDialogProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
  zIndex?: string;
  ariaLabel?: string;
  className?: string;
  panelClassName?: string;
}

export function ModalDialog({
  open,
  onClose,
  children,
  maxWidth = 'max-w-md',
  zIndex = 'z-50',
  ariaLabel = 'Dialog window',
  className,
  panelClassName,
}: ModalDialogProps) {
  const systemReducedMotion = useReducedMotion();
  const htmlReduceMotion =
    typeof document !== 'undefined' &&
    document.documentElement.getAttribute('data-reduce-motion') === 'true';
  const shouldReduceMotion = systemReducedMotion || htmlReduceMotion;

  // Notify global store when center floating window opens/closes so AppShell can smoothly slide out bars
  useEffect(() => {
    if (!open) return;
    centerModalStore.open();
    return () => {
      centerModalStore.close();
    };
  }, [open]);

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

  // Lock body scroll when modal is open
  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  // Fallback for legacy z-modal tokens to ensure high elevation over application bars
  const computedZIndex = !zIndex || zIndex === 'z-modal' ? 'z-[100]' : zIndex;

  return (
    <AnimatePresence>
      {open && (
        <div
          className={cn(
            'fixed inset-0 overflow-y-auto flex flex-col items-center justify-center p-3 sm:p-6',
            computedZIndex,
            className
          )}
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
        >
          {/* Backdrop with gradual fade and gradual backdrop blur */}
          <m.div
            key="modal-backdrop"
            initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            animate={{ opacity: 1, backdropFilter: 'blur(6px)' }}
            exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            transition={{
              duration: shouldReduceMotion ? 0 : 0.24,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="fixed inset-0 bg-ink/40"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Smooth scaling and fading modal dialog panel */}
          <m.div
            key="modal-panel"
            initial={{
              opacity: shouldReduceMotion ? 1 : 0,
              scale: shouldReduceMotion ? 1 : 0.94,
              y: shouldReduceMotion ? 0 : 10,
            }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
            }}
            exit={{
              opacity: shouldReduceMotion ? 1 : 0,
              scale: shouldReduceMotion ? 1 : 0.94,
              y: shouldReduceMotion ? 0 : 8,
            }}
            transition={{
              duration: shouldReduceMotion ? 0 : 0.22,
              ease: [0.16, 1, 0.3, 1],
            }}
            className={cn(
              'relative w-full my-auto bg-sheet border border-rule rounded-modal shadow-2xl z-10 overflow-hidden flex flex-col',
              maxWidth,
              panelClassName
            )}
            style={{
              maxHeight: 'calc(100vh - 2.5rem)',
            }}
          >
            {children}
          </m.div>
        </div>
      )}
    </AnimatePresence>
  );
}

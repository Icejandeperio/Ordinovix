import React from 'react';
import { m } from 'motion/react';
import { cn } from '@/lib/cn';

export interface ReviewStampProps {
  id?: string;
  variant?: 'line' | 'ready' | 'done' | 'received';
  date?: string;          // e.g. "24 OCT" or "OCT 28"
  initials?: string;      // e.g. "ANA S."
  office?: string;        // e.g. "RDO 39"
  evidenceCount?: number; // e.g. 2
  animate?: boolean;
  className?: string;
}

export function ReviewStamp({
  id = 'sample-stamp',
  variant = 'line',
  date = '24 OCT',
  initials = 'ANA S.',
  office = 'RDO 39',
  evidenceCount = 1,
  animate = true,
  className,
}: ReviewStampProps) {
  // Derive a deterministic angle between -2deg and -4deg based on ID string
  const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const rotation = -2 - (hash % 20) / 10; // -2.0 to -3.9 degrees

  const isLarge = variant === 'ready' || variant === 'done';

  const content = (() => {
    switch (variant) {
      case 'ready':
        return (
          <div className="flex flex-col items-center justify-center p-2 text-center select-none tracking-widest font-mono">
            <span className="text-[10px] font-black uppercase text-stamp-ink opacity-90">VISIT</span>
            <span className="text-sm font-black uppercase text-stamp-ink leading-tight">READY TO GO</span>
            <span className="text-[10px] font-bold uppercase text-stamp-ink/80">{office} · {date}</span>
          </div>
        );
      case 'done':
        return (
          <div className="flex flex-col items-center justify-center p-2 text-center select-none tracking-widest font-mono">
            <span className="text-xs font-black uppercase text-stamp-ink leading-tight">COMPLETED</span>
            <span className="text-[13px] font-black uppercase text-stamp-ink">{date}</span>
            <span className="text-[9px] font-bold uppercase text-stamp-ink/80">{evidenceCount} EVIDENCE ATTACHED</span>
          </div>
        );
      case 'received':
        return (
          <div className="flex flex-col items-center justify-center px-2 py-1 text-center select-none tracking-wider font-mono">
            <span className="text-[10px] font-black uppercase text-stamp-ink">RECEIVED</span>
            <span className="text-[11px] font-bold uppercase text-stamp-ink/90">{date}</span>
          </div>
        );
      case 'line':
      default:
        return (
          <div className="flex flex-col items-center justify-center px-2.5 py-0.5 text-center select-none tracking-wider font-mono">
            <span className="text-[10px] font-black uppercase text-stamp-ink leading-tight">ACCEPTED</span>
            <span className="text-xs font-black uppercase text-stamp-ink leading-tight">{date}</span>
            <span className="text-[9px] font-bold uppercase text-stamp-ink/80 leading-tight">{initials}</span>
          </div>
        );
    }
  })();

  const filterId = `stamp-texture-${id.replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <div className={cn('relative inline-block select-none', className)}>
      {/* SVG noise texture definition for the ink knockout effect */}
      <svg className="absolute w-0 h-0" aria-hidden="true">
        <filter id={filterId}>
          <feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves="3" result="noise" />
          <feColorMatrix
            type="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.85 0"
            in="noise"
            result="coloredNoise"
          />
          <feComposite in="SourceGraphic" in2="coloredNoise" operator="in" />
        </filter>
      </svg>

      <m.div
        initial={
          animate
            ? { opacity: 0, scale: 1.35, rotate: -9, filter: 'blur(2px)' }
            : { opacity: 0.95, scale: 1, rotate: rotation, filter: 'blur(0px)' }
        }
        animate={{
          opacity: 0.95,
          scale: [1.35, 0.94, 1],
          rotate: rotation,
          filter: 'blur(0px)',
        }}
        transition={{
          duration: animate ? 0.36 : 0,
          times: [0, 0.6, 1],
          ease: 'easeOut',
        }}
        style={{
          transformOrigin: 'center center',
          filter: `url(#${filterId})`,
        }}
        className={cn(
          'border-2 border-stamp-ink rounded-[3px] bg-stamp-soft/30 backdrop-blur-[0.5px]',
          'outline outline-1 outline-stamp-ink outline-offset-2',
          isLarge ? 'min-w-[160px]' : 'min-w-[88px]'
        )}
      >
        {content}
      </m.div>
    </div>
  );
}

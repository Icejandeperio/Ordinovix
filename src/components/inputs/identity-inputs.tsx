import React, { useState, useEffect } from 'react';
import { PatternFormat } from 'react-number-format';
import { Eye, EyeOff, Phone, MessageSquare, Mail, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatPhoneE164, formatPhoneDisplay } from '@/lib/phone';

// ===== 9.4 TinInput =====
export interface TinInputProps {
  id?: string;
  label?: string;
  optional?: boolean;
  value: string;
  onChange: (val: string) => void;
  hint?: string;
  duplicateWarning?: string;
  disabled?: boolean;
  className?: string;
}

export function TinInput({
  id,
  label = 'Taxpayer Identification Number (TIN)',
  optional = false,
  value,
  onChange,
  hint,
  duplicateWarning,
  disabled = false,
  className,
}: TinInputProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-xs font-semibold text-ink-2">
          {label}
        </label>
        {optional && <span className="text-[11px] text-ink-3">Optional</span>}
      </div>

      <div className="relative">
        <PatternFormat
          id={id}
          format="###-###-###-#####"
          mask="_"
          value={value}
          disabled={disabled}
          placeholder="000-000-000-00000"
          onValueChange={(values) => {
            onChange(values.formattedValue);
          }}
          className={cn(
            'w-full px-3 py-2 text-xs font-mono font-bold tracking-wider rounded-control bg-sheet border transition-colors',
            'border-rule-strong text-ink placeholder:text-ink-3/40',
            'focus:outline-none focus:border-stamp focus:ring-2 focus:ring-stamp/20',
            'disabled:bg-sheet-2 disabled:text-ink-3 disabled:cursor-not-allowed hover:border-ink-3'
          )}
        />
      </div>

      {duplicateWarning && (
        <div className="flex items-start gap-1.5 text-[11px] text-warn-fg bg-warn-bg border border-warn-bd p-2 rounded-control">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-warn-fg" />
          <span>{duplicateWarning}</span>
        </div>
      )}

      {hint && !duplicateWarning && <p className="text-[11px] text-ink-3">{hint}</p>}
    </div>
  );
}

// ===== 9.7 MaskedTin Component =====
export interface MaskedTinProps {
  tin: string;
  allowReveal?: boolean;
  onReveal?: () => void;
  className?: string;
}

export function MaskedTin({ tin, allowReveal = true, onReveal, className }: MaskedTinProps) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (revealed) {
      const timer = setTimeout(() => {
        setRevealed(false);
      }, 30000); // Mask again after 30 seconds per spec 9.7
      return () => clearTimeout(timer);
    }
  }, [revealed]);

  const handleToggle = () => {
    if (!revealed) {
      onReveal?.();
    }
    setRevealed(!revealed);
  };

  const getMasked = (raw: string) => {
    const clean = raw.replace(/\D/g, '');
    if (clean.length < 9) return '•••-•••-•••-00000';
    const last3 = clean.slice(6, 9);
    const branch = clean.slice(9).padEnd(5, '0') || '00000';
    return `•••-•••-${last3}-${branch}`;
  };

  return (
    <div className={cn('inline-flex items-center gap-2 font-mono text-xs', className)}>
      <span className="tabular-nums font-semibold text-ink">
        {revealed ? tin : getMasked(tin)}
      </span>
      {allowReveal && (
        <button
          type="button"
          onClick={handleToggle}
          title={revealed ? 'Hide TIN' : 'Reveal full TIN for 30s'}
          className="p-1 rounded text-ink-3 hover:text-stamp hover:bg-sheet-2 transition-colors cursor-pointer"
        >
          {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      )}
    </div>
  );
}

// ===== 9.4 PhoneInput =====
export interface PhoneInputProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (e164: string) => void;
  hint?: string;
  disabled?: boolean;
  className?: string;
}

export function PhoneInput({
  id,
  label = 'Philippine Mobile or Landline',
  value,
  onChange,
  hint,
  disabled = false,
  className,
}: PhoneInputProps) {
  const [rawInput, setRawInput] = useState(value);

  const handleBlur = () => {
    const formattedE164 = formatPhoneE164(rawInput);
    if (formattedE164) {
      onChange(formattedE164);
      setRawInput(formatPhoneDisplay(formattedE164));
    }
  };

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-xs font-semibold text-ink-2">
          {label}
        </label>
        {value && (
          <div className="flex items-center gap-1">
            <a
              href={`tel:${value}`}
              className="p-1 rounded text-ink-3 hover:text-stamp hover:bg-sheet-2 transition-colors"
              title="Call contact"
            >
              <Phone className="w-3 h-3" />
            </a>
            <a
              href={`sms:${value}`}
              className="p-1 rounded text-ink-3 hover:text-stamp hover:bg-sheet-2 transition-colors"
              title="Send SMS"
            >
              <MessageSquare className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>

      <div className="relative">
        <input
          id={id}
          type="tel"
          value={rawInput}
          disabled={disabled}
          onChange={(e) => setRawInput(e.target.value)}
          onBlur={handleBlur}
          placeholder="0917 123 4567 or (02) 8123 4567"
          className={cn(
            'w-full px-3 py-2 text-xs font-sans rounded-control bg-sheet border transition-colors',
            'border-rule-strong text-ink placeholder:text-ink-3/50',
            'focus:outline-none focus:border-stamp focus:ring-2 focus:ring-stamp/20',
            'disabled:bg-sheet-2 disabled:text-ink-3 disabled:cursor-not-allowed hover:border-ink-3'
          )}
        />
      </div>

      {hint ? (
        <p className="text-[11px] text-ink-3">{hint}</p>
      ) : (
        <p className="text-[10px] text-ink-3">Stores as E.164 (+63917...)</p>
      )}
    </div>
  );
}

// ===== 9.4 EmailInput =====
export interface EmailInputProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (val: string) => void;
  hint?: string;
  disabled?: boolean;
  className?: string;
}

export function EmailInput({
  id,
  label = 'Email Address',
  value,
  onChange,
  hint,
  disabled = false,
  className,
}: EmailInputProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-xs font-semibold text-ink-2">
          {label}
        </label>
        {value && (
          <a
            href={`mailto:${value}`}
            className="p-1 rounded text-ink-3 hover:text-stamp hover:bg-sheet-2 transition-colors"
            title="Open in email client"
          >
            <Mail className="w-3 h-3" />
          </a>
        )}
      </div>

      <input
        id={id}
        type="email"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onChange(e.target.value.trim().toLowerCase())}
        placeholder="preparer@example.com"
        className={cn(
          'w-full px-3 py-2 text-xs font-sans rounded-control bg-sheet border transition-colors',
          'border-rule-strong text-ink placeholder:text-ink-3/50',
          'focus:outline-none focus:border-stamp focus:ring-2 focus:ring-stamp/20',
          'disabled:bg-sheet-2 disabled:text-ink-3 disabled:cursor-not-allowed hover:border-ink-3'
        )}
      />

      {hint && <p className="text-[11px] text-ink-3">{hint}</p>}
    </div>
  );
}

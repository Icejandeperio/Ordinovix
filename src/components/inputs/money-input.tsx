import React from 'react';
import { NumericFormat } from 'react-number-format';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { Centavos } from '@/domain/types';

export interface MoneyInputProps {
  id?: string;
  label?: string;
  optional?: boolean;
  centavos: Centavos | null;
  onChangeCentavos: (val: Centavos | null) => void;
  min?: number;
  max?: number;
  allowNegative?: boolean;
  quickChips?: { label: string; centavos: Centavos }[];
  hint?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
}

export function MoneyInput({
  id,
  label,
  optional = false,
  centavos,
  onChangeCentavos,
  min = 0,
  max = 99999999999, // default 999M pesos
  allowNegative = false,
  quickChips,
  hint,
  error,
  disabled = false,
  className,
}: MoneyInputProps) {
  // Convert centavos to peso float for NumericFormat
  const floatValue = centavos !== null ? centavos / 100 : '';

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <div className="flex items-center justify-between">
          <label htmlFor={id} className="text-xs font-semibold text-ink-2">
            {label}
          </label>
          {optional && <span className="text-[11px] text-ink-3">Optional</span>}
        </div>
      )}

      <div className="relative flex items-center">
        <span className="absolute left-3 text-sm font-semibold text-ink-3 select-none pointer-events-none">
          ₱
        </span>
        <NumericFormat
          id={id}
          value={floatValue}
          thousandSeparator=","
          decimalScale={2}
          fixedDecimalScale
          allowNegative={allowNegative}
          inputMode="decimal"
          disabled={disabled}
          placeholder="0.00"
          onValueChange={(values) => {
            const { floatValue: nextFloat } = values;
            if (nextFloat === undefined || isNaN(nextFloat)) {
              onChangeCentavos(null);
            } else {
              const cents = Math.round(nextFloat * 100);
              onChangeCentavos(cents);
            }
          }}
          className={cn(
            'w-full pl-8 pr-3 py-2 text-sm font-semibold text-right tabular-nums rounded-control bg-sheet border transition-colors',
            'border-rule-strong text-ink placeholder:text-ink-3',
            'focus:outline-none focus:border-stamp focus:ring-2 focus:ring-stamp/20',
            'disabled:bg-sheet-2 disabled:text-ink-3 disabled:cursor-not-allowed',
            error ? 'border-critical-fg focus:border-critical-fg focus:ring-critical-fg/20' : 'hover:border-ink-3'
          )}
        />
      </div>

      {quickChips && quickChips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {quickChips.map((chip, i) => (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => onChangeCentavos(chip.centavos)}
              className="px-2 py-0.5 rounded text-[11px] font-semibold bg-sheet-2 hover:bg-stamp-soft text-ink-2 hover:text-stamp border border-rule transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {error ? (
        <p className="text-[11px] font-semibold text-critical-fg flex items-center gap-1">
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p className="text-[11px] text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}

export interface NumberStepperProps {
  id?: string;
  label?: string;
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  hint?: string;
  disabled?: boolean;
}

export function NumberStepper({
  id,
  label,
  value,
  onChange,
  min = 1,
  max = 99,
  step = 1,
  unit,
  hint,
  disabled = false,
}: NumberStepperProps) {
  const handleDec = () => {
    if (value - step >= min) onChange(value - step);
  };

  const handleInc = () => {
    if (value + step <= max) onChange(value + step);
  };

  return (
    <div className="space-y-1.5">
      {label && <div className="text-xs font-semibold text-ink-2">{label}</div>}
      <div className="flex items-center gap-2">
        <div className="flex items-center rounded-control bg-sheet border border-rule-strong overflow-hidden shadow-xs">
          <button
            type="button"
            disabled={disabled || value <= min}
            onClick={handleDec}
            className="w-8 h-8 flex items-center justify-center text-ink-2 hover:bg-sheet-2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            aria-label="Decrease"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <span className="w-12 text-center text-xs font-bold tabular-nums text-ink select-none">
            {value}
          </span>
          <button
            type="button"
            disabled={disabled || value >= max}
            onClick={handleInc}
            className="w-8 h-8 flex items-center justify-center text-ink-2 hover:bg-sheet-2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            aria-label="Increase"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        {unit && <span className="text-xs text-ink-3 font-medium">{unit}</span>}
      </div>
      {hint && <p className="text-[11px] text-ink-3">{hint}</p>}
    </div>
  );
}

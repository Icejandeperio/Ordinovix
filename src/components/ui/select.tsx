import React, { useState, useRef, useEffect, useMemo } from 'react';
import { m, AnimatePresence } from 'motion/react';
import { ChevronDown, Check, Search } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options?: SelectOption[];
  children?: React.ReactNode;
  placeholder?: string;
  prefix?: string;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  disabled?: boolean;
  searchable?: boolean;
  align?: 'left' | 'right';
  id?: string;
  name?: string;
  'aria-label'?: string;
}

export function Select({
  value,
  onChange,
  options,
  children,
  placeholder,
  prefix,
  className = '',
  buttonClassName = '',
  menuClassName = '',
  disabled = false,
  searchable,
  align = 'left',
  id,
  'aria-label': ariaLabel,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Resolve options from props or <option> children
  const resolvedOptions = useMemo<SelectOption[]>(() => {
    if (options && options.length > 0) return options;
    if (!children) return [];

    const extracted: SelectOption[] = [];
    React.Children.forEach(children, (child) => {
      if (React.isValidElement(child)) {
        const props = child.props as any;
        extracted.push({
          value: String(props.value ?? ''),
          label: typeof props.children === 'string' ? props.children : String(props.label ?? props.value ?? ''),
          disabled: Boolean(props.disabled),
        });
      }
    });
    return extracted;
  }, [options, children]);

  // Find active option
  const selectedOption = resolvedOptions.find((opt) => opt.value === value);
  const displayLabel = selectedOption
    ? selectedOption.label
    : placeholder || (resolvedOptions[0]?.label ?? '');

  // Determine if search input should appear inside dropdown
  const showSearch = searchable !== undefined ? searchable : resolvedOptions.length >= 8;

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return resolvedOptions;
    const q = searchQuery.toLowerCase();
    return resolvedOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.description && opt.description.toLowerCase().includes(q))
    );
  }, [resolvedOptions, searchQuery]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  // Focus search input when opened
  useEffect(() => {
    if (open && showSearch) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else if (!open) {
      setSearchQuery('');
    }
  }, [open, showSearch]);

  const handleSelect = (val: string) => {
    onChange(val);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      if (!open) {
        e.preventDefault();
        setOpen(true);
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative inline-block text-left ${className}`}
      onKeyDown={handleKeyDown}
    >
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between gap-1.5 h-8 px-2.5 rounded-control text-xs font-medium cursor-pointer transition-all duration-150 border select-none ${
          open
            ? 'border-[var(--stamp)] ring-2 ring-[var(--stamp)]/20 bg-[var(--sheet)] text-[var(--ink)] shadow-xs'
            : 'border-[var(--rule)] bg-[var(--sheet-2)] hover:bg-[var(--sheet)] hover:border-[var(--rule-strong)] text-[var(--ink)] shadow-xs'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${buttonClassName}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel || displayLabel || 'Select an option'}
      >
        <span className="truncate text-left font-medium">
          {prefix && <span className="text-[var(--ink-3)] mr-1">{prefix}</span>}
          {displayLabel}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[var(--ink-3)] transition-transform duration-200 shrink-0 ${
            open ? 'rotate-180 text-[var(--stamp)]' : ''
          }`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <m.div
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className={`absolute z-50 mt-1.5 min-w-full w-max max-w-[320px] rounded-control bg-[var(--sheet)] border border-[var(--rule)] shadow-[var(--shadow-float)] py-1 overflow-hidden focus:outline-none ${
              align === 'right' ? 'right-0' : 'left-0'
            } ${menuClassName}`}
            role="listbox"
            tabIndex={-1}
          >
            {showSearch && (
              <div className="px-2 pt-1 pb-1.5 border-b border-[var(--rule)] mb-1">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-[var(--ink-3)]" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search options..."
                    className="w-full text-xs pl-7 pr-2 py-1 rounded bg-[var(--sheet-2)] border border-[var(--rule)] focus:outline-none focus:border-[var(--stamp)] text-[var(--ink)] placeholder:text-[var(--ink-3)]"
                  />
                </div>
              </div>
            )}

            <div className="max-h-60 overflow-y-auto px-1 py-0.5 space-y-0.5">
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-2 text-xs text-[var(--ink-3)] text-center italic">
                  No matching options
                </div>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = opt.value === value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={opt.disabled}
                      onClick={() => handleSelect(opt.value)}
                      className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs text-left cursor-pointer transition-colors duration-100 rounded-[calc(var(--r-control)-4px)] select-none ${
                        isSelected
                          ? 'bg-[var(--stamp-soft)] text-[var(--stamp-ink)] font-semibold'
                          : 'text-[var(--ink)] hover:bg-[var(--sheet-2)]'
                      } ${opt.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                      role="option"
                      aria-selected={isSelected}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                        <span className="truncate">{opt.label}</span>
                      </div>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-[var(--stamp)] shrink-0 ml-2" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

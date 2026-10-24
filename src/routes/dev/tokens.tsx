import { useTheme } from '@/app/theme';
import { Sun, Moon, Laptop, Check } from 'lucide-react';

export function DevTokensPage() {
  const { theme, setTheme } = useTheme();

  const surfaces = [
    { name: '--paper', desc: 'Page background canvas' },
    { name: '--sheet', desc: 'Card / container background' },
    { name: '--sheet-2', desc: 'Subtle container / table header' },
    { name: '--sheet-3', desc: 'Hover / active container layer' },
    { name: '--rule', desc: 'Default borders & dividers' },
    { name: '--rule-strong', desc: 'Emphasized borders & inputs' },
  ];

  const typographyColors = [
    { name: '--ink', desc: 'Primary headings & body text' },
    { name: '--ink-2', desc: 'Secondary metadata & labels' },
    { name: '--ink-3', desc: 'Tertiary captions & placeholders' },
  ];

  const brandColors = [
    { name: '--stamp', desc: 'Primary brand accent' },
    { name: '--stamp-strong', desc: 'Pressed / hover brand accent' },
    { name: '--stamp-soft', desc: 'Brand tinted background container' },
    { name: '--stamp-ink', desc: 'Brand foreground text color' },
    { name: '--on-stamp', desc: 'Contrasting text on solid brand stamp' },
  ];

  const statusTones = [
    { key: 'neutral', label: 'Neutral (Draft / Unassigned)' },
    { key: 'info', label: 'Info (In Progress / Received)' },
    { key: 'warn', label: 'Warn (Approaching / Missing)' },
    { key: 'serious', label: 'Serious (Urgent / Blocked)' },
    { key: 'critical', label: 'Critical (Overdue / Penalized)' },
    { key: 'good', label: 'Good (Accepted / Completed)' },
  ];

  const seriesColors = [
    { name: '--series-1', desc: 'Withholding Taxes' },
    { name: '--series-2', desc: 'Income & Corporate Taxes' },
    { name: '--series-3', desc: 'Percentage Taxes' },
    { name: '--series-4', desc: 'LGU & Mayor Permits' },
    { name: '--series-5', desc: 'SEC & Registration Compliance' },
    { name: '--series-6', desc: 'Miscellaneous Book Inscriptions' },
  ];

  const typographyScales = [
    { name: 'Display', spec: '28px / 36px · Weight 700 · Tracking -0.02em', sample: 'Ordinovix Tax Suite' },
    { name: 'Title 1', spec: '22px / 28px · Weight 700 · Tracking -0.015em', sample: 'Quarterly Withholding Remittance' },
    { name: 'Title 2', spec: '18px / 24px · Weight 600 · Tracking -0.01em', sample: 'Bureau of Internal Revenue RDO 048' },
    { name: 'Body', spec: '14px / 20px · Weight 400 · Tracking normal', sample: 'All required withholding certificates (Form 2307) have been verified against the schedule.' },
    { name: 'Caption', spec: '12px / 16px · Weight 500 · Tracking +0.01em', sample: 'Due in 3 calendar days · Prepared by Ana Santos' },
    { name: 'Micro', spec: '10px / 14px · Weight 600 · Uppercase Tracking +0.05em', sample: 'STAMPED · WET SIGNATURE REQUIRED' },
  ];

  return (
    <div className="space-y-10 max-w-6xl mx-auto pb-20">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--rule)] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[var(--stamp-soft)] text-[var(--stamp-ink)]">
              DEV / QA ONLY
            </span>
            <h1 className="text-2xl font-bold text-[var(--ink)] tracking-tight">Design Token Sheet</h1>
          </div>
          <p className="text-sm text-[var(--ink-2)] mt-0.5">
            Living catalog of Section 8 tokens: surfaces, contrast tones, brand stamps, series, and tabular figures.
          </p>
        </div>

        {/* Theme Switcher */}
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[var(--sheet-2)] border border-[var(--rule)] self-start sm:self-auto">
          {[
            { id: 'system', icon: Laptop, label: 'System' },
            { id: 'light', icon: Sun, label: 'Light' },
            { id: 'dark', icon: Moon, label: 'Dark' },
          ].map((mode) => {
            const Icon = mode.icon;
            const active = theme === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => setTheme(mode.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  active
                    ? 'bg-[var(--stamp)] text-[var(--on-stamp)] font-semibold'
                    : 'text-[var(--ink-2)] hover:text-[var(--ink)]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{mode.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Surface Palette */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--ink-3)]">1. Structural Surfaces & Dividers</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {surfaces.map((s) => (
            <div key={s.name} className="p-3 rounded-lg border border-[var(--rule)] bg-[var(--sheet)] shadow-xs space-y-2">
              <div
                className="w-full h-12 rounded border border-[var(--rule)] shadow-inner"
                style={{ backgroundColor: `var(${s.name})` }}
              />
              <div>
                <div className="font-mono text-xs font-bold text-[var(--ink)]">{s.name}</div>
                <div className="text-[11px] text-[var(--ink-3)] mt-0.5 leading-snug">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Typography Inks */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--ink-3)]">2. Typography Inks</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {typographyColors.map((ink) => (
            <div key={ink.name} className="p-4 rounded-lg border border-[var(--rule)] bg-[var(--sheet)] flex items-center gap-3">
              <div
                className="w-10 h-10 rounded border border-[var(--rule)] shrink-0"
                style={{ backgroundColor: `var(${ink.name})` }}
              />
              <div>
                <div className="font-mono text-xs font-bold text-[var(--ink)]">{ink.name}</div>
                <div className="text-xs text-[var(--ink-3)]">{ink.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Brand Accent */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--ink-3)]">3. Brand Accent Stamp</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {brandColors.map((brand) => (
            <div key={brand.name} className="p-3 rounded-lg border border-[var(--rule)] bg-[var(--sheet)] space-y-2">
              <div
                className="w-full h-12 rounded border border-[var(--rule)]"
                style={{ backgroundColor: `var(${brand.name})` }}
              />
              <div className="font-mono text-xs font-bold text-[var(--ink)]">{brand.name}</div>
              <div className="text-[11px] text-[var(--ink-3)]">{brand.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Semantic Status Tones */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--ink-3)]">4. Status Tone Matrix (5 Tokens Each)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {statusTones.map((tone) => (
            <div key={tone.key} className="p-4 rounded-lg border border-[var(--rule)] bg-[var(--sheet)] space-y-3">
              <div className="text-xs font-bold text-[var(--ink)]">{tone.label}</div>
              
              {/* Badge demo */}
              <div className="flex items-center gap-2">
                <span
                  className="px-2.5 py-1 rounded text-xs font-semibold border flex items-center gap-1.5"
                  style={{
                    backgroundColor: `var(--${tone.key}-bg)`,
                    borderColor: `var(--${tone.key}-bd)`,
                    color: `var(--${tone.key}-fg)`,
                  }}
                >
                  <Check className="w-3.5 h-3.5" />
                  Subtle Chip
                </span>

                <span
                  className="px-2.5 py-1 rounded text-xs font-bold"
                  style={{
                    backgroundColor: `var(--${tone.key}-solid)`,
                    color: `var(--on-${tone.key}-solid)`,
                  }}
                >
                  Solid Action
                </span>
              </div>

              {/* Tokens list */}
              <div className="grid grid-cols-5 gap-1 pt-2 border-t border-[var(--rule)] text-[10px] font-mono text-[var(--ink-3)] text-center">
                <div>
                  <div className="h-5 rounded mb-1" style={{ backgroundColor: `var(--${tone.key}-fg)` }} />
                  fg
                </div>
                <div>
                  <div className="h-5 rounded mb-1 border border-[var(--rule)]" style={{ backgroundColor: `var(--${tone.key}-bg)` }} />
                  bg
                </div>
                <div>
                  <div className="h-5 rounded mb-1 border border-[var(--rule)]" style={{ backgroundColor: `var(--${tone.key}-bd)` }} />
                  bd
                </div>
                <div>
                  <div className="h-5 rounded mb-1" style={{ backgroundColor: `var(--${tone.key}-solid)` }} />
                  solid
                </div>
                <div>
                  <div className="h-5 rounded mb-1 border border-[var(--rule)]" style={{ backgroundColor: `var(--on-${tone.key}-solid)` }} />
                  on-solid
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Series Colors */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--ink-3)]">5. Categorical Series Colors</h2>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {seriesColors.map((s) => (
            <div key={s.name} className="p-3 rounded-lg border border-[var(--rule)] bg-[var(--sheet)] space-y-2">
              <div
                className="w-full h-10 rounded border border-[var(--rule)]"
                style={{ backgroundColor: `var(${s.name})` }}
              />
              <div className="font-mono text-xs font-bold text-[var(--ink)]">{s.name}</div>
              <div className="text-[10px] text-[var(--ink-3)]">{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Typography Scale */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--ink-3)]">6. Archivo Typography Hierarchy</h2>
        <div className="bg-[var(--sheet)] border border-[var(--rule)] rounded-lg divide-y divide-[var(--rule)] overflow-hidden">
          {typographyScales.map((scale) => (
            <div key={scale.name} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-2">
              <div className="w-48 shrink-0">
                <div className="text-xs font-bold text-[var(--ink)]">{scale.name}</div>
                <div className="font-mono text-[10px] text-[var(--ink-3)]">{scale.spec}</div>
              </div>
              <div className="grow text-[var(--ink)]">
                {scale.name === 'Display' && <h1 className="text-3xl font-bold tracking-tight">{scale.sample}</h1>}
                {scale.name === 'Title 1' && <h2 className="text-xl font-bold tracking-tight">{scale.sample}</h2>}
                {scale.name === 'Title 2' && <h3 className="text-lg font-semibold tracking-tight">{scale.sample}</h3>}
                {scale.name === 'Body' && <p className="text-sm text-[var(--ink-2)]">{scale.sample}</p>}
                {scale.name === 'Caption' && <p className="text-xs text-[var(--ink-3)] font-medium">{scale.sample}</p>}
                {scale.name === 'Micro' && <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-3)]">{scale.sample}</span>}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Tabular Figures Demonstration */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--ink-3)]">7. Tabular Figures Test (`tnum`)</h2>
        <div className="p-4 rounded-lg border border-[var(--rule)] bg-[var(--sheet)] space-y-4">
          <p className="text-xs text-[var(--ink-2)]">
            Numeric data aligns vertically across rows regardless of individual digit widths (e.g. "1" occupies the exact same horizontal width as "8").
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 rounded border border-[var(--rule)] bg-[var(--sheet-2)] font-mono text-xs space-y-1">
              <div className="font-bold text-[var(--ink-3)] mb-2 uppercase text-[10px]">Standard Monospace:</div>
              <div>₱  1,111,111.11</div>
              <div>₱  8,888,888.88</div>
              <div>₱ 12,345,678.90</div>
            </div>

            <div className="p-3 rounded border border-[var(--rule)] bg-[var(--sheet-2)] text-xs space-y-1 tabular-nums">
              <div className="font-bold text-[var(--ink-3)] mb-2 uppercase text-[10px]">Archivo Variable Tabular (`tabular-nums`):</div>
              <div className="font-semibold text-[var(--ink)]">₱  1,111,111.11</div>
              <div className="font-semibold text-[var(--ink)]">₱  8,888,888.88</div>
              <div className="font-semibold text-[var(--ink)]">₱ 12,345,678.90</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

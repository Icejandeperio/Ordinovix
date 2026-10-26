import React, { useState } from 'react';

// ==========================================
// 1. SvgLineChart
// ==========================================
export interface LinePoint {
  x: string;
  y: number;
}

export interface LineSeries {
  name: string;
  color: string;
  points: LinePoint[];
}

export interface SvgLineChartProps {
  series: LineSeries[];
  baseline?: { value: number; label: string };
  unit?: string;
  height?: number;
  minY?: number;
  maxY?: number;
}

export function SvgLineChart({
  series,
  baseline,
  unit = '',
  height = 180,
  minY,
  maxY,
}: SvgLineChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!series || series.length === 0 || !series[0].points.length) {
    return <div className="h-44 flex items-center justify-center text-xs text-[var(--ink-3)]">No data points available</div>;
  }

  const xLabels = series[0].points.map((p) => p.x);
  const allY = series.flatMap((s) => s.points.map((p) => p.y));
  if (baseline) allY.push(baseline.value);

  const computedMinY = minY !== undefined ? minY : 0;
  const computedMaxY = maxY !== undefined ? maxY : Math.max(10, Math.ceil(Math.max(...allY) * 1.15));
  const rangeY = computedMaxY - computedMinY || 1;

  const paddingLeft = 36;
  const paddingRight = baseline ? 82 : 24;
  const paddingTop = 16;
  const paddingBottom = 28;
  const width = 500;

  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;

  const getX = (idx: number) => paddingLeft + (idx / Math.max(1, xLabels.length - 1)) * plotWidth;
  const getY = (val: number) => paddingTop + plotHeight - ((val - computedMinY) / rangeY) * plotHeight;

  // Grid ticks
  const yTicks = [
    computedMinY,
    Math.round(computedMinY + rangeY * 0.5),
    computedMaxY,
  ];

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full min-w-[320px] select-none text-[10px] font-sans"
        style={{ height }}
      >
        {/* Horizontal gridlines */}
        {yTicks.map((tick, i) => {
          const y = getY(tick);
          return (
            <g key={i}>
              <line
                x1={paddingLeft}
                y1={y}
                x2={width - paddingRight}
                y2={y}
                stroke="var(--chart-grid)"
                strokeWidth="1"
                strokeDasharray={i === 0 ? undefined : '2 2'}
              />
              <text
                x={paddingLeft - 6}
                y={y + 3}
                fill="var(--ink-3)"
                textAnchor="end"
                className="font-mono tabular-nums text-[9px]"
              >
                {tick}
                {unit}
              </text>
            </g>
          );
        })}

        {/* Baseline reference line across plot */}
        {baseline && (
          <g>
            <line
              x1={paddingLeft}
              y1={getY(baseline.value)}
              x2={width - paddingRight}
              y2={getY(baseline.value)}
              stroke="var(--rule-strong)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
            {/* Connector line to right margin badge */}
            <line
              x1={width - paddingRight}
              y1={getY(baseline.value)}
              x2={width - paddingRight + 4}
              y2={getY(baseline.value)}
              stroke="var(--rule-strong)"
              strokeWidth="1.5"
            />
          </g>
        )}

        {/* Series lines */}
        {series.map((s, sIdx) => {
          const pathD = s.points
            .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx)} ${getY(p.y)}`)
            .join(' ');

          return (
            <g key={sIdx}>
              <path
                d={pathD}
                fill="none"
                stroke={s.color}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Markers: 8px with 2px sheet ring */}
              {s.points.map((p, idx) => {
                const cx = getX(idx);
                const cy = getY(p.y);
                const isHovered = hoveredIdx === idx;
                return (
                  <circle
                    key={idx}
                    cx={cx}
                    cy={cy}
                    r={isHovered ? 5.5 : 4}
                    fill={s.color}
                    stroke="var(--sheet)"
                    strokeWidth="2"
                    className="transition-all cursor-pointer"
                  />
                );
              })}
            </g>
          );
        })}

        {/* X axis labels */}
        {xLabels.map((lbl, idx) => (
          <text
            key={idx}
            x={getX(idx)}
            y={height - 8}
            fill="var(--ink-3)"
            textAnchor="middle"
            className="font-medium text-[10px]"
          >
            {lbl}
          </text>
        ))}

        {/* Interactive Hover Vertical Crosshair and Tooltip */}
        {xLabels.map((_, idx) => {
          const x = getX(idx);
          const colWidth = plotWidth / xLabels.length;
          return (
            <rect
              key={idx}
              x={x - colWidth / 2}
              y={paddingTop}
              width={colWidth}
              height={plotHeight}
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            />
          );
        })}

        {hoveredIdx !== null && (
          <g>
            <line
              x1={getX(hoveredIdx)}
              y1={paddingTop}
              x2={getX(hoveredIdx)}
              y2={paddingTop + plotHeight}
              stroke="var(--rule-strong)"
              strokeWidth="1"
              strokeDasharray="2 2"
            />
            {series.map((s, sIdx) => {
              const pt = s.points[hoveredIdx];
              return (
                <text
                  key={sIdx}
                  x={getX(hoveredIdx)}
                  y={getY(pt.y) - 8}
                  fill="var(--ink)"
                  textAnchor="middle"
                  className="font-bold font-mono text-[10px] bg-[var(--sheet)]"
                >
                  {pt.y}{unit}
                </text>
              );
            })}
          </g>
        )}

        {/* Baseline pill badge in right margin (rendered on top layer to prevent collisions) */}
        {baseline && (() => {
          const badgeY = Math.max(4, Math.min(height - paddingBottom - 16, getY(baseline.value) - 8));
          const badgeW = paddingRight - 8;
          const badgeX = width - paddingRight + 4;
          return (
            <g className="baseline-badge select-none">
              <rect
                x={badgeX}
                y={badgeY}
                width={badgeW}
                height={16}
                rx={3}
                fill="var(--sheet-2)"
                stroke="var(--rule-strong)"
                strokeWidth="1"
              />
              <text
                x={badgeX + badgeW / 2}
                y={badgeY + 11}
                fill="var(--ink-2)"
                textAnchor="middle"
                className="font-mono text-[9px] font-semibold"
              >
                {baseline.label} {baseline.value}{unit}
              </text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}

// ==========================================
// 2. SvgBarChart
// ==========================================
export interface BarItem {
  label: string;
  value: number;
  color?: string;
}

export interface SvgBarChartProps {
  data: BarItem[];
  unit?: string;
  height?: number;
  defaultColor?: string;
}

export function SvgBarChart({
  data,
  unit = '',
  height = 180,
  defaultColor = 'var(--series-1)',
}: SvgBarChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return <div className="h-44 flex items-center justify-center text-xs text-[var(--ink-3)]">No data</div>;
  }

  const values = data.map((d) => d.value);
  const maxVal = Math.max(1, Math.ceil(Math.max(...values) * 1.15));

  const paddingLeft = 32;
  const paddingRight = 16;
  const paddingTop = 20;
  const paddingBottom = 28;
  const width = 450;

  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;

  const barCount = data.length;
  const slotWidth = plotWidth / barCount;
  const barWidth = Math.min(36, slotWidth * 0.65);

  const yTicks = [0, Math.round(maxVal / 2), maxVal];

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full min-w-[320px] select-none text-[10px] font-sans"
        style={{ height }}
      >
        {/* Horizontal gridlines */}
        {yTicks.map((tick, i) => {
          const y = paddingTop + plotHeight - (tick / maxVal) * plotHeight;
          return (
            <g key={i}>
              <line
                x1={paddingLeft}
                y1={y}
                x2={width - paddingRight}
                y2={y}
                stroke="var(--chart-grid)"
                strokeWidth="1"
                strokeDasharray={i === 0 ? undefined : '2 2'}
              />
              <text
                x={paddingLeft - 6}
                y={y + 3}
                fill="var(--ink-3)"
                textAnchor="end"
                className="font-mono tabular-nums text-[9px]"
              >
                {tick}{unit}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((item, idx) => {
          const barHeight = Math.max(2, (item.value / maxVal) * plotHeight);
          const x = paddingLeft + idx * slotWidth + (slotWidth - barWidth) / 2;
          const y = paddingTop + plotHeight - barHeight;
          const isHovered = hoveredIdx === idx;

          return (
            <g
              key={idx}
              className="cursor-pointer"
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx="4"
                fill={item.color || defaultColor}
                opacity={isHovered ? 0.85 : 1}
                className="transition-all"
              />
              {/* Value label on top of bar */}
              <text
                x={x + barWidth / 2}
                y={y - 4}
                fill="var(--ink)"
                textAnchor="middle"
                className="font-bold font-mono text-[9px] tabular-nums"
              >
                {item.value}
              </text>
              {/* X axis category label */}
              <text
                x={x + barWidth / 2}
                y={height - 8}
                fill="var(--ink-3)"
                textAnchor="middle"
                className="font-medium text-[9px]"
              >
                {item.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ==========================================
// 3. SvgStackedBarChart
// ==========================================
export interface StackedSegment {
  label: string;
  value: number;
  color: string;
}

export interface StackedBarGroup {
  category: string;
  segments: StackedSegment[];
}

export interface SvgStackedBarChartProps {
  groups: StackedBarGroup[];
  height?: number;
  isPercent?: boolean;
}

export function SvgStackedBarChart({
  groups,
  height = 190,
  isPercent = false,
}: SvgStackedBarChartProps) {
  if (!groups || groups.length === 0) {
    return <div className="h-44 flex items-center justify-center text-xs text-[var(--ink-3)]">No data</div>;
  }

  const totals = groups.map((g) => g.segments.reduce((acc, s) => acc + s.value, 0));
  const maxTotal = isPercent ? 100 : Math.max(1, Math.ceil(Math.max(...totals) * 1.15));

  const paddingLeft = 34;
  const paddingRight = 16;
  const paddingTop = 16;
  const paddingBottom = 28;
  const width = 450;

  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;

  const slotWidth = plotWidth / groups.length;
  const barWidth = Math.min(36, slotWidth * 0.65);

  const yTicks = isPercent ? [0, 50, 100] : [0, Math.round(maxTotal / 2), maxTotal];

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full min-w-[320px] select-none text-[10px] font-sans"
        style={{ height }}
      >
        {/* Gridlines */}
        {yTicks.map((tick, i) => {
          const y = paddingTop + plotHeight - (tick / maxTotal) * plotHeight;
          return (
            <g key={i}>
              <line
                x1={paddingLeft}
                y1={y}
                x2={width - paddingRight}
                y2={y}
                stroke="var(--chart-grid)"
                strokeWidth="1"
                strokeDasharray={i === 0 ? undefined : '2 2'}
              />
              <text
                x={paddingLeft - 6}
                y={y + 3}
                fill="var(--ink-3)"
                textAnchor="end"
                className="font-mono tabular-nums text-[9px]"
              >
                {tick}{isPercent ? '%' : ''}
              </text>
            </g>
          );
        })}

        {/* Stacked Bars */}
        {groups.map((grp, gIdx) => {
          const x = paddingLeft + gIdx * slotWidth + (slotWidth - barWidth) / 2;
          const groupTotal = totals[gIdx] || 1;

          let currentY = paddingTop + plotHeight;

          return (
            <g key={gIdx}>
              {grp.segments.map((seg, sIdx) => {
                const fraction = isPercent ? (seg.value / groupTotal) * 100 : seg.value;
                const segHeight = Math.max(0, (fraction / maxTotal) * plotHeight);
                currentY -= segHeight;

                return (
                  <rect
                    key={sIdx}
                    x={x}
                    y={currentY}
                    width={barWidth}
                    height={Math.max(0, segHeight - 1)} // 1px separation
                    rx={sIdx === grp.segments.length - 1 ? 4 : 0}
                    fill={seg.color}
                    className="transition-all hover:opacity-90 cursor-pointer"
                  >
                    <title>{`${grp.category} - ${seg.label}: ${seg.value}${isPercent ? '%' : ''}`}</title>
                  </rect>
                );
              })}
              {/* Category label */}
              <text
                x={x + barWidth / 2}
                y={height - 8}
                fill="var(--ink-3)"
                textAnchor="middle"
                className="font-medium text-[9px]"
              >
                {grp.category}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ==========================================
// 4. SvgHorizontalBarChart
// ==========================================
export interface HorizontalBarItem {
  label: string;
  value: number;
  tag?: string;
  isAvoidable?: boolean;
  color?: string;
}

export interface SvgHorizontalBarChartProps {
  data: HorizontalBarItem[];
  defaultColor?: string;
}

export function SvgHorizontalBarChart({
  data,
  defaultColor = 'var(--series-1)',
}: SvgHorizontalBarChartProps) {
  if (!data || data.length === 0) {
    return <div className="h-36 flex items-center justify-center text-xs text-[var(--ink-3)]">No data</div>;
  }

  const maxVal = Math.max(1, Math.max(...data.map((d) => d.value)));
  const rowHeight = 32;
  const height = data.length * rowHeight + 10;
  const width = 450;
  const labelWidth = 160;
  const barAreaWidth = width - labelWidth - 40;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full min-w-[320px] select-none text-[11px] font-sans"
        style={{ height }}
      >
        {data.map((item, idx) => {
          const y = idx * rowHeight + 6;
          const barW = Math.max(4, (item.value / maxVal) * barAreaWidth);

          return (
            <g key={idx}>
              {/* Row label */}
              <text
                x={labelWidth - 10}
                y={y + 14}
                fill="var(--ink)"
                textAnchor="end"
                className="font-medium text-[10px]"
              >
                {item.label}
              </text>

              {/* Bar */}
              <rect
                x={labelWidth}
                y={y + 2}
                width={barW}
                height={16}
                rx="3"
                fill={item.color || defaultColor}
                className="transition-all hover:opacity-90"
              />

              {/* Value */}
              <text
                x={labelWidth + barW + 8}
                y={y + 14}
                fill="var(--ink)"
                className="font-bold font-mono text-[10px] tabular-nums"
              >
                {item.value}
              </text>

              {/* Tag pill if avoidable */}
              {item.isAvoidable && (
                <g transform={`translate(${labelWidth + barW + 28}, ${y + 2})`}>
                  <rect
                    width="48"
                    height="16"
                    rx="3"
                    fill="var(--warn-bg)"
                    stroke="var(--warn-bd)"
                    strokeWidth="1"
                  />
                  <text
                    x="24"
                    y="11"
                    fill="var(--warn-fg)"
                    textAnchor="middle"
                    className="font-semibold text-[8px] uppercase tracking-wider"
                  >
                    Avoidable
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ==========================================
// 5. SvgHeatCalendar
// ==========================================
export interface HeatCell {
  date: string;
  count: number;
}

export interface SvgHeatCalendarProps {
  weeks?: number;
  data: HeatCell[];
  onSelectDate?: (date: string) => void;
}

export function SvgHeatCalendar({
  weeks = 8,
  data,
  onSelectDate,
}: SvgHeatCalendarProps) {
  const dayNames = ['M', 'T', 'W', 'T', 'F'];
  const cellWidth = 32;
  const cellHeight = 22;
  const gap = 4;

  const dataMap = new Map(data.map((d) => [d.date, d.count]));

  // Build grid of 8 weeks x 5 weekdays
  const getColor = (count: number) => {
    if (count === 0) return 'var(--sheet-2)';
    if (count === 1) return 'var(--seq-200)';
    if (count === 2) return 'var(--seq-300)';
    if (count <= 4) return 'var(--seq-400)';
    return 'var(--seq-500)';
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[10px] text-[var(--ink-3)] font-mono">
        <span className="w-4"></span>
        {Array.from({ length: weeks }).map((_, w) => (
          <span key={w} className="w-8 text-center">
            W{w + 1}
          </span>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        {dayNames.map((dName, dayIdx) => (
          <div key={dayIdx} className="flex items-center gap-2">
            <span className="w-4 text-[10px] font-bold text-[var(--ink-3)] text-right">
              {dName}
            </span>
            <div className="flex gap-1">
              {Array.from({ length: weeks }).map((_, weekIdx) => {
                // Mock synthetic weekday date sequence
                const syntheticCount = (weekIdx * 3 + dayIdx * 2) % 6;
                return (
                  <div
                    key={weekIdx}
                    onClick={() => onSelectDate && onSelectDate(`2026-W${weekIdx + 1}-${dayIdx + 1}`)}
                    className="w-8 h-6 rounded-xs cursor-pointer transition-transform hover:scale-105 flex items-center justify-center text-[9px] font-bold font-mono"
                    style={{ backgroundColor: getColor(syntheticCount) }}
                    title={`Week ${weekIdx + 1}, Day ${dName}: ${syntheticCount} tasks due`}
                  >
                    {syntheticCount > 0 && (
                      <span className="text-white drop-shadow-xs">{syntheticCount}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Sequential color legend */}
      <div className="flex items-center justify-end gap-1.5 text-[10px] text-[var(--ink-3)] pt-2">
        <span>Fewer</span>
        <span className="w-3 h-3 rounded-xs bg-[var(--sheet-2)]" />
        <span className="w-3 h-3 rounded-xs bg-[var(--seq-200)]" />
        <span className="w-3 h-3 rounded-xs bg-[var(--seq-300)]" />
        <span className="w-3 h-3 rounded-xs bg-[var(--seq-400)]" />
        <span className="w-3 h-3 rounded-xs bg-[var(--seq-500)]" />
        <span>More filings</span>
      </div>
    </div>
  );
}

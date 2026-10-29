import { useId, useMemo } from 'react';
import { clsx } from 'clsx';
import { money } from '../lib/format';
import { useI18n } from '../lib/i18n';
import type { ForecastPoint } from '../lib/types';

interface ForecastChartProps {
  history: ForecastPoint[];
  forecast: ForecastPoint[];
  height?: number;
  format?: (value: number) => string;
  className?: string;
}

/** Hand-rolled responsive SVG chart: actual line, forecast line + 80% band. */
export function ForecastChart({
  history,
  forecast,
  height = 240,
  format = (value) => String(value),
  className,
}: ForecastChartProps) {
  const gradientId = useId().replace(/:/g, '');
  const { t } = useI18n();

  const geometry = useMemo(() => {
    const points = [...history, ...forecast];
    if (!points.length) return null;

    const width = 720;
    const padding = { top: 16, right: 12, bottom: 26, left: 44 };
    const innerW = width - padding.left - padding.right;
    const innerH = height - padding.top - padding.bottom;

    const values = points.flatMap((point) => [point.value, point.lower ?? point.value, point.upper ?? point.value]);
    const max = Math.max(...values, 1);
    const min = 0;

    const x = (index: number) => padding.left + (index / Math.max(points.length - 1, 1)) * innerW;
    const y = (value: number) => padding.top + innerH - ((value - min) / (max - min || 1)) * innerH;

    const actualPath = history.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(point.value).toFixed(1)}`).join(' ');

    const offset = history.length - 1;
    const forecastPath = [
      `${offset >= 0 ? 'M' : 'L'}${x(Math.max(offset, 0)).toFixed(1)},${y(history.at(-1)?.value ?? forecast[0]?.value ?? 0).toFixed(1)}`,
      ...forecast.map((point, index) => `L${x(offset + 1 + index).toFixed(1)},${y(point.value).toFixed(1)}`),
    ].join(' ');

    const bandTop = forecast.map((point, index) => `${x(offset + 1 + index).toFixed(1)},${y(point.upper ?? point.value).toFixed(1)}`);
    const bandBottom = forecast
      .map((point, index) => `${x(offset + 1 + index).toFixed(1)},${y(point.lower ?? point.value).toFixed(1)}`)
      .reverse();
    const bandPath =
      forecast.length > 0
        ? [
            `M${x(offset).toFixed(1)},${y(history.at(-1)?.value ?? 0).toFixed(1)}`,
            ...bandTop.map((pair) => `L${pair}`),
            ...bandBottom.map((pair) => `L${pair}`),
            'Z',
          ].join(' ')
        : '';

    const areaPath = history.length
      ? `${actualPath} L${x(history.length - 1).toFixed(1)},${padding.top + innerH} L${x(0).toFixed(1)},${padding.top + innerH} Z`
      : '';

    const gridLines = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
      y: padding.top + innerH * ratio,
      value: Math.round(max - (max - min) * ratio),
    }));

    return { width, padding, innerH, innerW, x, y, actualPath, forecastPath, bandPath, areaPath, gridLines, max, points };
  }, [history, forecast, height]);

  if (!geometry) {
    return <div className="flex h-40 items-center justify-center text-sm text-white/35">{t('common.loading')}</div>;
  }

  const { width, padding, innerH, x, y, actualPath, forecastPath, bandPath, areaPath, gridLines, points } = geometry;
  const dividerX = x(Math.max(history.length - 1, 0));

  return (
    <div className={clsx('w-full', className)}>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label={t('admin.forecast')}>
        <defs>
          <linearGradient id={`area-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6d5ef8" stopOpacity="0.42" />
            <stop offset="100%" stopColor="#6d5ef8" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`line-${gradientId}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#8b84ff" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
        </defs>

        {gridLines.map((line) => (
          <g key={line.y}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={line.y}
              y2={line.y}
              stroke="rgba(255,255,255,0.06)"
              strokeDasharray="3 5"
            />
            <text x={padding.left - 8} y={line.y + 3} textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.28)">
              {line.value}
            </text>
          </g>
        ))}

        {areaPath ? <path d={areaPath} fill={`url(#area-${gradientId})`} /> : null}
        {bandPath ? <path d={bandPath} fill="rgba(34,211,238,0.12)" stroke="rgba(34,211,238,0.28)" strokeWidth="0.6" /> : null}

        <line
          x1={dividerX}
          x2={dividerX}
          y1={padding.top}
          y2={padding.top + innerH}
          stroke="rgba(255,255,255,0.14)"
          strokeDasharray="4 4"
        />

        <path d={actualPath} fill="none" stroke={`url(#line-${gradientId})`} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        <path d={forecastPath} fill="none" stroke="#67e8f9" strokeWidth="2" strokeDasharray="5 4" strokeLinecap="round" />

        {points.length ? (
          <circle cx={x(history.length - 1)} cy={y(history.at(-1)?.value ?? 0)} r="3.5" fill="#fff" stroke="#6d5ef8" strokeWidth="2" />
        ) : null}

        <text x={dividerX - 6} y={height - 8} textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.28)">
          {t('assistant.grounded').split(' ')[0]}
        </text>
        <text x={width - padding.right} y={height - 8} textAnchor="end" fontSize="9" fill="rgba(103,232,249,0.6)">
          {t('admin.forecast')}
        </text>
      </svg>
      <div className="mt-1 flex items-center gap-4 text-[11px] text-white/40">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded bg-gradient-to-r from-brand-400 to-aqua-400" />
          {t('admin.revenueTrend')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded bg-aqua-300" style={{ borderTop: '2px dashed #67e8f9' }} />
          {t('admin.forecast')} · {format(forecast.reduce((sum, point) => sum + point.value, 0))}
        </span>
      </div>
    </div>
  );
}

export function Sparkbars({ data, tone = 'brand' }: { data: { date: string; value: number }[]; tone?: 'brand' | 'gold' }) {
  const max = Math.max(...data.map((point) => point.value), 1);
  return (
    <div className="flex h-16 items-end gap-1">
      {data.map((point) => (
        <div
          key={point.date}
          title={`${point.date}: ${point.value}`}
          className={clsx(
            'flex-1 rounded-t-[3px] transition-all hover:opacity-80',
            tone === 'brand' ? 'bg-gradient-to-t from-brand-600/40 to-aqua-400/70' : 'bg-gradient-to-t from-gold-400/30 to-gold-300/70',
          )}
          style={{ height: `${Math.max(4, (point.value / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

export function BarList({
  items,
  format = (value) => money(value),
}: {
  items: { label: string; value: number; hint?: string }[];
  format?: (value: number) => string;
}) {
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
            <span className="truncate text-white/70">{item.label}</span>
            <span className="shrink-0 font-mono text-white/90">{format(item.value)}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/6">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-500 via-brand-400 to-aqua-400"
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
          {item.hint ? <p className="mt-1 text-[10px] text-white/30">{item.hint}</p> : null}
        </div>
      ))}
    </div>
  );
}

export function RiskMeter({ score }: { score: number }) {
  const percent = Math.round(score * 100);
  const tone = score >= 0.72 ? 'from-rose-400 to-orange-400' : score >= 0.42 ? 'from-gold-400 to-orange-300' : 'from-mint-400 to-aqua-400';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/8">
        <div className={clsx('h-full rounded-full bg-gradient-to-r', tone)} style={{ width: `${percent}%` }} />
      </div>
      <span className="font-mono text-[11px] text-white/50">{percent}%</span>
    </div>
  );
}

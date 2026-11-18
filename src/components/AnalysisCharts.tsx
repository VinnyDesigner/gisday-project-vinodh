import { CheckCircle2, ShieldCheck, Thermometer } from 'lucide-react';
import type { AnalysisStatsDataset } from '../types/gis';

interface AnalysisChartsProps {
  dataset: AnalysisStatsDataset;
}

export function AnalysisCharts({ dataset }: AnalysisChartsProps) {
  const epochs = [...dataset.epochs].sort((a, b) => a.year - b.year);
  const firstEpoch = epochs[0];
  const lastEpoch = epochs[epochs.length - 1];

  const allClassNames = Array.from(
    new Set(epochs.flatMap((e) => e.classes.map((c) => c.className)))
  );

  const maxTotalArea = Math.max(...epochs.map((e) => e.totalAreaKm2), 1);

  return (
    <div className="space-y-4">
      {/* Provenance Header */}
      <div className="rounded-xl border border-emerald-500/35 bg-emerald-950/20 p-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Measured Analysis Dataset
          </span>
          <span className="font-mono text-[10px] text-slate-400">
            {dataset.crs}
          </span>
        </div>
        <div className="mt-1 text-xs font-medium text-slate-100">
          {dataset.studyAreaName}
        </div>
        <div className="mt-0.5 font-mono text-[10px] text-slate-400">
          Source: {dataset.generatedBy} • {dataset.generatedAt}
        </div>
      </div>

      {/* 1. Class-Wise Area Stacked Bar Chart (SVG) */}
      <div className="rounded-xl border border-[#641600]/55 bg-[#0c0503] p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
            Class-Wise Area by Epoch (km²)
          </span>
          <span className="font-mono text-[10px] text-[#cd9b76]">
            {epochs.length} Epochs
          </span>
        </div>

        <svg
          viewBox="0 0 360 180"
          className="w-full overflow-visible"
          role="img"
          aria-label="Class-wise area by epoch chart"
        >
          {epochs.map((ep, idx) => {
            const barWidth = Math.min(44, 240 / Math.max(epochs.length, 1));
            const gap = (320 - barWidth * epochs.length) / (epochs.length + 1);
            const x = 20 + gap * (idx + 1) + barWidth * idx;
            let currentY = 148;

            return (
              <g key={ep.year}>
                {ep.classes.map((cls) => {
                  const h = (cls.areaKm2 / maxTotalArea) * 130;
                  currentY -= h;
                  return (
                    <rect
                      key={`${ep.year}-${cls.className}`}
                      x={x}
                      y={currentY}
                      width={barWidth}
                      height={Math.max(h, 1)}
                      fill={cls.color}
                      rx={1}
                    >
                      <title>
                        {`${ep.year} • ${cls.className}: ${cls.areaKm2.toFixed(1)} km² (${cls.percent.toFixed(1)}%)`}
                      </title>
                    </rect>
                  );
                })}
                <text
                  x={x + barWidth / 2}
                  y={166}
                  textAnchor="middle"
                  className="fill-slate-300 font-mono text-[10px]"
                >
                  {ep.year}
                </text>
              </g>
            );
          })}
          <line x1={16} y1={148} x2={348} y2={148} stroke="#334155" strokeWidth={1} />
        </svg>
      </div>

      {/* 2. Net Change Statistics Table */}
      {epochs.length >= 2 && (
        <div className="rounded-xl border border-[#641600]/55 bg-[#0c0503] p-4">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-slate-400">
            Net Change ({firstEpoch.year} → {lastEpoch.year})
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="border-b border-[#641600]/55 font-mono text-[10px] text-slate-400">
                <tr>
                  <th className="py-1.5 pr-2">Class</th>
                  <th className="py-1.5 px-2 text-right">{firstEpoch.year}</th>
                  <th className="py-1.5 px-2 text-right">{lastEpoch.year}</th>
                  <th className="py-1.5 pl-2 text-right">Δ km²</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {allClassNames.map((name) => {
                  const c1 = firstEpoch.classes.find((c) => c.className === name);
                  const c2 = lastEpoch.classes.find((c) => c.className === name);
                  const a1 = c1?.areaKm2 ?? 0;
                  const a2 = c2?.areaKm2 ?? 0;
                  const delta = a2 - a1;
                  const color = c2?.color || c1?.color || '#94a3b8';

                  return (
                    <tr key={name}>
                      <td className="flex items-center gap-1.5 py-1.5 pr-2 text-slate-200">
                        <span
                          className="h-2 w-2 shrink-0 rounded-xs"
                          style={{ backgroundColor: color }}
                        />
                        <span className="truncate">{name}</span>
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono text-slate-400">
                        {a1.toFixed(1)}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono text-slate-200">
                        {a2.toFixed(1)}
                      </td>
                      <td
                        className={`py-1.5 pl-2 text-right font-mono ${
                          delta >= 0 ? 'text-[#ebcaa1]' : 'text-[#ebcaa1]'
                        }`}
                      >
                        {delta >= 0 ? '+' : ''}
                        {delta.toFixed(1)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. Landsat LST Summary (if present) */}
      {lastEpoch.lstStats && (
        <div className="rounded-xl border border-[#641600]/55 bg-[#0c0503] p-4">
          <div className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-[#dab089]">
            <Thermometer className="h-3.5 w-3.5" />
            <span>Landsat Surface Temperature ({lastEpoch.year})</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded bg-[#1e0e09] p-2">
              <div className="font-mono text-[10px] text-slate-400">Min</div>
              <div className="font-mono text-sm text-[#ebcaa1]">
                {lastEpoch.lstStats.minC.toFixed(1)}°C
              </div>
            </div>
            <div className="rounded bg-[#1e0e09] p-2">
              <div className="font-mono text-[10px] text-slate-400">Mean</div>
              <div className="font-mono text-sm text-[#ebcaa1]">
                {lastEpoch.lstStats.meanC.toFixed(1)}°C
              </div>
            </div>
            <div className="rounded bg-[#1e0e09] p-2">
              <div className="font-mono text-[10px] text-slate-400">Max</div>
              <div className="font-mono text-sm text-red-400">
                {lastEpoch.lstStats.maxC.toFixed(1)}°C
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Classification Validation & Uncertainty */}
      {lastEpoch.validation && (
        <div className="rounded-xl border border-[#641600]/55 bg-[#0c0503] p-4 space-y-2">
          <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-[#cd9b76]">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Validation &amp; Uncertainty ({lastEpoch.year})</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded bg-[#1e0e09] p-2">
              <div className="font-mono text-[10px] text-slate-400">Overall Acc.</div>
              <div className="font-mono text-sm font-semibold text-emerald-300">
                {lastEpoch.validation.overallAccuracyPct.toFixed(1)}%
              </div>
            </div>
            <div className="rounded bg-[#1e0e09] p-2">
              <div className="font-mono text-[10px] text-slate-400">Kappa</div>
              <div className="font-mono text-sm font-semibold text-[#ebcaa1]">
                {lastEpoch.validation.kappa.toFixed(3)}
              </div>
            </div>
            <div className="rounded bg-[#1e0e09] p-2">
              <div className="font-mono text-[10px] text-slate-400">Samples</div>
              <div className="font-mono text-sm text-slate-200">
                {lastEpoch.validation.validationSampleCount}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

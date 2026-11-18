import { useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { exportSvgElement } from '../services/exportService';
import type { LulcMatrixReport } from '../types/analytics';

interface ChartFrameProps {
  title: string;
  unit: string;
  period: string;
  areaLabel: string;
  source: string;
  methodology: string;
  svgRef?: React.RefObject<SVGSVGElement>;
  exportFilename?: string;
  children: React.ReactNode;
}

export function ChartFrame({
  title,
  unit,
  period,
  areaLabel,
  source,
  methodology,
  svgRef,
  exportFilename,
  children,
}: ChartFrameProps) {
  return (
    <div className="rounded-xl border border-[#641600]/55 bg-[#0c0503] p-4 space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-semibold text-slate-100">{title}</div>
          <div className="font-mono text-[10px] text-[#cd9b76]">
            {areaLabel} • {period} • Unit: {unit}
          </div>
        </div>
        {svgRef && exportFilename && (
          <button
            type="button"
            onClick={() => exportSvgElement(svgRef.current, exportFilename)}
            title="Export chart as SVG"
            className="inline-flex shrink-0 items-center gap-1 rounded border border-[#98472b]/50 bg-[#1e0e09] px-2 py-1 font-mono text-[10px] text-slate-300 hover:border-[#cd9b76]/50 hover:text-[#ebcaa1]"
          >
            <Download className="h-3 w-3" />
            <span>SVG</span>
          </button>
        )}
      </div>

      <div>{children}</div>

      <div className="border-t border-[#641600]/55/80 pt-2 font-mono text-[9px] leading-relaxed text-slate-500">
        <div>Source: {source}</div>
        <div>Method: {methodology}</div>
      </div>
    </div>
  );
}

export function LulcDonutChart({ report }: { report: LulcMatrixReport }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const classes = report.endEpoch.classes;
  const total = classes.reduce((acc, c) => acc + c.areaKm2, 0) || 1;

  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <ChartFrame
      title={`LULC Composition (${report.endYear})`}
      unit="km² & %"
      period={report.endEpoch.compositePeriod}
      areaLabel={report.area.toUpperCase()}
      source={report.endEpoch.datasetId}
      methodology={report.classificationScheme}
      svgRef={svgRef}
      exportFilename={`lulc_donut_${report.area}_${report.endYear}.svg`}
    >
      <div className="flex flex-col items-center gap-4 sm:flex-row">
        <svg ref={svgRef} viewBox="0 0 140 140" className="h-36 w-36 shrink-0">
          <g transform="rotate(-90 70 70)">
            {classes.map((c) => {
              const frac = c.areaKm2 / total;
              const dash = frac * circumference;
              const currentOffset = offset;
              offset += dash;
              return (
                <circle
                  key={c.code}
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="transparent"
                  stroke={c.color}
                  strokeWidth={hovered === c.className ? 22 : 18}
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-currentOffset}
                  onMouseEnter={() => setHovered(c.className)}
                  onMouseLeave={() => setHovered(null)}
                  className="cursor-pointer transition-all"
                >
                  <title>{`${c.className}: ${c.areaKm2.toFixed(1)} km² (${c.percent.toFixed(1)}%)`}</title>
                </circle>
              );
            })}
          </g>
          <text
            x="70"
            y="67"
            textAnchor="middle"
            className="fill-slate-100 font-mono text-[11px] font-semibold"
          >
            {report.endEpoch.totalKm2?.toFixed(0) ?? '—'}
          </text>
          <text
            x="70"
            y="81"
            textAnchor="middle"
            className="fill-slate-400 font-mono text-[8px]"
          >
            km² total
          </text>
        </svg>

        <div className="w-full space-y-1.5">
          {classes.map((c) => (
            <div
              key={c.code}
              onMouseEnter={() => setHovered(c.className)}
              onMouseLeave={() => setHovered(null)}
              className={`flex items-center justify-between rounded px-1.5 py-0.5 text-[11px] transition-colors ${
                hovered === c.className ? 'bg-slate-800/80' : ''
              }`}
            >
              <span className="flex items-center gap-1.5 text-slate-300">
                <span
                  className="h-2.5 w-2.5 rounded-xs"
                  style={{ backgroundColor: c.color }}
                />
                <span>{c.className}</span>
              </span>
              <span className="font-mono text-slate-200">
                {c.areaKm2.toFixed(1)} km² ({c.percent.toFixed(1)}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    </ChartFrame>
  );
}

export function DivergingGainLossChart({ report }: { report: LulcMatrixReport }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const rows = report.endEpoch.classes.map((endC) => {
    const startC = report.startEpoch.classes.find((c) => c.code === endC.code);
    const delta = endC.areaKm2 - (startC?.areaKm2 ?? 0);
    return { ...endC, delta };
  });
  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.delta)), 1);

  return (
    <ChartFrame
      title={`Net Class Gain & Loss (${report.startYear} → ${report.endYear})`}
      unit="Δ km²"
      period={`${report.startYear} vs ${report.endYear} (${report.season})`}
      areaLabel={report.area.toUpperCase()}
      source={`${report.startEpoch.datasetId} → ${report.endEpoch.datasetId}`}
      methodology="30m pixel-area difference across aligned seasonal composites"
      svgRef={svgRef}
      exportFilename={`gain_loss_${report.area}_${report.startYear}_${report.endYear}.svg`}
    >
      <svg ref={svgRef} viewBox="0 0 360 155" className="w-full">
        <line x1="185" y1="8" x2="185" y2="145" stroke="#475569" strokeWidth="1" />
        {rows.map((r, idx) => {
          const y = 16 + idx * 26;
          const barW = (Math.abs(r.delta) / maxAbs) * 120;
          const x = r.delta >= 0 ? 185 : 185 - barW;
          return (
            <g key={r.code}>
              <text
                x="4"
                y={y + 11}
                className="fill-slate-300 font-sans text-[10px]"
              >
                {r.className}
              </text>
              <rect
                x={x}
                y={y}
                width={Math.max(barW, 2)}
                height="14"
                rx="2"
                fill={r.delta >= 0 ? '#F59E0B' : '#22D3EE'}
              >
                <title>{`${r.className}: ${r.delta >= 0 ? '+' : ''}${r.delta.toFixed(2)} km²`}</title>
              </rect>
              <text
                x={r.delta >= 0 ? 185 + barW + 5 : 185 - barW - 5}
                y={y + 11}
                textAnchor={r.delta >= 0 ? 'start' : 'end'}
                className="fill-slate-200 font-mono text-[9px]"
              >
                {r.delta >= 0 ? '+' : ''}
                {r.delta.toFixed(1)}
              </text>
            </g>
          );
        })}
      </svg>
    </ChartFrame>
  );
}

export function ConversionMatrixHeatmap({ report }: { report: LulcMatrixReport }) {
  const classes = report.endEpoch.classes;
  const maxCell = Math.max(
    ...report.conversionMatrix.filter((c) => c.fromCode !== c.toCode).map((c) => c.areaKm2),
    1
  );

  const getVal = (fromCode: number, toCode: number) =>
    report.conversionMatrix.find(
      (c) => c.fromCode === fromCode && c.toCode === toCode
    )?.areaKm2 ?? 0;

  return (
    <ChartFrame
      title={`Land Conversion Matrix (${report.startYear} → ${report.endYear})`}
      unit="km² transitioned"
      period={`${report.startYear} (rows) → ${report.endYear} (cols)`}
      areaLabel={report.area.toUpperCase()}
      source="Aligned 30m GEE Raster Cross-Tabulation"
      methodology="fromClass * 10 + toClass pixelArea reducer"
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-center font-mono text-[10px]">
          <thead>
            <tr>
              <th className="p-1.5 text-left text-slate-400">From \ To</th>
              {classes.map((c) => (
                <th key={c.code} className="p-1.5 text-slate-300">
                  {c.className.split(' ')[0]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {classes.map((rowCls) => (
              <tr key={rowCls.code} className="border-t border-[#641600]/55/70">
                <td className="p-1.5 text-left text-slate-300">
                  {rowCls.className.split(' ')[0]}
                </td>
                {classes.map((colCls) => {
                  const val = getVal(rowCls.code, colCls.code);
                  const isDiag = rowCls.code === colCls.code;
                  const intensity = isDiag ? 0.12 : Math.min(0.85, (val / maxCell) * 0.85);
                  return (
                    <td
                      key={colCls.code}
                      title={`${rowCls.className} → ${colCls.className}: ${val.toFixed(2)} km²`}
                      style={{
                        backgroundColor: isDiag
                          ? `rgba(148, 163, 184, ${intensity})`
                          : `rgba(245, 158, 11, ${intensity})`,
                      }}
                      className="border border-slate-900/70 p-1.5 text-slate-100"
                    >
                      {val.toFixed(1)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartFrame>
  );
}

export function LandConversionSankey({ report }: { report: LulcMatrixReport }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const startClasses = report.startEpoch.classes;
  const endClasses = report.endEpoch.classes;
  const totalKm2 = report.endEpoch.totalKm2 || 1;
  const height = 220;

  const buildPositions = (list: typeof startClasses) => {
    let y = 12;
    return list.map((c) => {
      const h = Math.max(12, (c.areaKm2 / totalKm2) * (height - 48));
      const item = { ...c, y, h };
      y += h + 6;
      return item;
    });
  };

  const leftNodes = buildPositions(startClasses);
  const rightNodes = buildPositions(endClasses);

  // Top transitions (exclude tiny noise < 0.5 km2)
  const flows = report.conversionMatrix
    .filter((f) => f.areaKm2 >= 0.5)
    .sort((a, b) => b.areaKm2 - a.areaKm2)
    .slice(0, 14);

  return (
    <ChartFrame
      title={`LULC Transition Sankey (${report.startYear} → ${report.endYear})`}
      unit="km²"
      period={`${report.startYear} → ${report.endYear}`}
      areaLabel={report.area.toUpperCase()}
      source="Aligned 30m GEE Raster Cross-Tabulation"
      methodology="Top verified class-to-class area flows (>= 0.5 km²)"
      svgRef={svgRef}
      exportFilename={`sankey_${report.area}_${report.startYear}_${report.endYear}.svg`}
    >
      <svg ref={svgRef} viewBox={`0 0 380 ${height}`} className="w-full">
        {flows.map((f, idx) => {
          const ln = leftNodes.find((n) => n.code === f.fromCode);
          const rn = rightNodes.find((n) => n.code === f.toCode);
          if (!ln || !rn) return null;
          const strokeW = Math.max(1.5, (f.areaKm2 / totalKm2) * 110);
          const y1 = ln.y + ln.h / 2;
          const y2 = rn.y + rn.h / 2;
          const d = `M 92 ${y1} C 190 ${y1}, 190 ${y2}, 288 ${y2}`;
          return (
            <path
              key={`${f.fromCode}-${f.toCode}`}
              d={d}
              fill="none"
              stroke={rn.color}
              strokeWidth={strokeW}
              strokeOpacity={hoverIdx === idx ? 0.85 : 0.35}
              onMouseEnter={() => setHoverIdx(idx)}
              onMouseLeave={() => setHoverIdx(null)}
              className="cursor-pointer transition-opacity"
            >
              <title>{`${f.fromName} → ${f.toName}: ${f.areaKm2.toFixed(2)} km²`}</title>
            </path>
          );
        })}

        {leftNodes.map((n) => (
          <g key={`l-${n.code}`}>
            <rect x="80" y={n.y} width="12" height={n.h} rx="2" fill={n.color} />
            <text
              x="76"
              y={n.y + n.h / 2 + 3}
              textAnchor="end"
              className="fill-slate-300 font-sans text-[9px]"
            >
              {n.className.split(' ')[0]}
            </text>
          </g>
        ))}

        {rightNodes.map((n) => (
          <g key={`r-${n.code}`}>
            <rect x="288" y={n.y} width="12" height={n.h} rx="2" fill={n.color} />
            <text
              x="304"
              y={n.y + n.h / 2 + 3}
              textAnchor="start"
              className="fill-slate-300 font-sans text-[9px]"
            >
              {n.className.split(' ')[0]}
            </text>
          </g>
        ))}
      </svg>
    </ChartFrame>
  );
}

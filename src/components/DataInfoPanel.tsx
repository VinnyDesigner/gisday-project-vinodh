import { Info } from 'lucide-react';
import type { GeeImageryResult, TgracBoundaryMetadata } from '../types/gis';

interface DataInfoPanelProps {
  boundaryMeta?: TgracBoundaryMetadata;
  geeImagery?: GeeImageryResult | null;
}

export function DataInfoPanel({ boundaryMeta, geeImagery }: DataInfoPanelProps) {
  const rows: { label: string; value: string }[] = [
    {
      label: 'Data Provider',
      value: geeImagery?.dataProvider || 'TGRAC / Esri / OpenStreetMap',
    },
    {
      label: 'Dataset Identifier',
      value: geeImagery?.datasetId || `TGRAC MapServer/${boundaryMeta?.layerId ?? '45,52'}`,
    },
    {
      label: 'Satellite Sensor',
      value: geeImagery?.sensor || 'N/A (Vector Boundary Active)',
    },
    {
      label: 'Composite Period',
      value: geeImagery?.compositePeriod || 'Current Official Boundary',
    },
    {
      label: 'Processing Method',
      value:
        geeImagery?.processingMethod ||
        'ArcGIS REST Polygon -> EPSG:4326 GeoJSON',
    },
    {
      label: 'Boundary Source',
      value: boundaryMeta?.source || 'TGRAC TCUR_V2',
    },
    {
      label: 'Spatial Resolution',
      value: geeImagery?.spatialResolution || 'Vector Polygon',
    },
    {
      label: 'Scene Count',
      value:
        typeof geeImagery?.sceneCount === 'number'
          ? String(geeImagery.sceneCount)
          : 'N/A',
    },
    {
      label: 'Last Updated',
      value: geeImagery?.lastUpdated
        ? new Date(geeImagery.lastUpdated).toLocaleDateString()
        : boundaryMeta?.fetchedAt
          ? new Date(boundaryMeta.fetchedAt).toLocaleDateString()
          : 'N/A',
    },
  ];

  return (
    <div className="rounded-xl border border-[#641600]/55 bg-[#0c0503] p-3.5">
      <div className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-[#cd9b76]">
        <Info className="h-3.5 w-3.5" />
        <span>Data Provenance &amp; Transparency</span>
      </div>
      <dl className="space-y-1.5 text-[11px]">
        {rows.map((r) => (
          <div key={r.label} className="flex items-start justify-between gap-2">
            <dt className="shrink-0 text-slate-500">{r.label}</dt>
            <dd className="text-right font-mono text-[10px] text-slate-300 break-words">
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

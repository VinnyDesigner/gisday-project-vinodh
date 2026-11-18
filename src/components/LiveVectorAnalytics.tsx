import { useMemo } from 'react';
import {
  computeGeoJsonAreaKm2,
  computeGeoJsonLengthKm,
  getTopNamedPolygonsKm2,
} from '../services/analysisStatsService';
import type { VectorLayerId } from '../types/gis';

interface LiveVectorAnalyticsProps {
  hmdaGeoJson?: GeoJSON.FeatureCollection;
  ghmcGeoJson?: GeoJSON.FeatureCollection;
  vectorData: Partial<Record<Exclude<VectorLayerId, 'landmarks'>, GeoJSON.FeatureCollection>>;
  onFlyTo?: (lng: number, lat: number, zoom: number, label: string) => void;
}

function getNamedCenter(
  fc: GeoJSON.FeatureCollection | undefined,
  name: string
): [number, number] | null {
  if (!fc) return null;
  const feat = fc.features.find(
    (f) => String(f.properties?.name || '').trim() === name
  );
  if (!feat || !feat.geometry) return null;
  let ring: number[][] = [];
  if (feat.geometry.type === 'Polygon') ring = feat.geometry.coordinates[0] || [];
  else if (feat.geometry.type === 'MultiPolygon')
    ring = feat.geometry.coordinates[0]?.[0] || [];
  if (ring.length === 0) return null;
  let sx = 0;
  let sy = 0;
  for (const pt of ring) {
    sx += pt[0];
    sy += pt[1];
  }
  return [sx / ring.length, sy / ring.length];
}

export function LiveVectorAnalytics({
  hmdaGeoJson,
  ghmcGeoJson,
  vectorData,
  onFlyTo,
}: LiveVectorAnalyticsProps) {
  const hmdaAreaKm2 = useMemo(() => computeGeoJsonAreaKm2(hmdaGeoJson), [hmdaGeoJson]);
  const ghmcAreaKm2 = useMemo(() => computeGeoJsonAreaKm2(ghmcGeoJson), [ghmcGeoJson]);
  const waterAreaKm2 = useMemo(
    () => computeGeoJsonAreaKm2(vectorData['osm-waterbodies']),
    [vectorData]
  );
  const vegAreaKm2 = useMemo(
    () => computeGeoJsonAreaKm2(vectorData['osm-vegetation']),
    [vectorData]
  );
  const roadLengthKm = useMemo(
    () => computeGeoJsonLengthKm(vectorData['osm-roads']),
    [vectorData]
  );

  const topLakes = useMemo(
    () => getTopNamedPolygonsKm2(vectorData['osm-waterbodies'], 5),
    [vectorData]
  );
  const topParks = useMemo(
    () => getTopNamedPolygonsKm2(vectorData['osm-vegetation'], 5),
    [vectorData]
  );

  const maxLake = Math.max(...topLakes.map((l) => l.areaKm2), 1);
  const maxPark = Math.max(...topParks.map((p) => p.areaKm2), 1);

  return (
    <div className="space-y-4">
      {/* KPI Strip from Verified TGRAC + Live OSM */}
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/15 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-300">
            Live Measured Baseline • TGRAC &amp; OpenStreetMap
          </span>
          <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[9px] text-emerald-300">
            REAL DATA
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-lg border border-[#641600]/55 bg-[#0c0503] p-3">
            <div className="font-mono text-[10px] text-[#00D5FF]">HMDA Official Area</div>
            <div className="mt-0.5 font-mono text-lg font-semibold text-slate-100">
              {hmdaAreaKm2 ? `${hmdaAreaKm2.toFixed(1)} km²` : '—'}
            </div>
            <div className="text-[10px] text-slate-500">TGRAC MapServer/52</div>
          </div>

          <div className="rounded-lg border border-[#641600]/55 bg-[#0c0503] p-3">
            <div className="font-mono text-[10px] text-[#FFB547]">GHMC Official Area</div>
            <div className="mt-0.5 font-mono text-lg font-semibold text-slate-100">
              {ghmcAreaKm2 ? `${ghmcAreaKm2.toFixed(1)} km²` : '—'}
            </div>
            <div className="text-[10px] text-slate-500">TGRAC MapServer/45</div>
          </div>

          <div className="rounded-lg border border-[#641600]/55 bg-[#0c0503] p-3">
            <div className="font-mono text-[10px] text-[#ebcaa1]">OSM Waterbodies</div>
            <div className="mt-0.5 font-mono text-lg font-semibold text-slate-100">
              {waterAreaKm2 !== null ? `${waterAreaKm2.toFixed(2)} km²` : 'Loading...'}
            </div>
            <div className="text-[10px] text-slate-500">
              {vectorData['osm-waterbodies']?.features.length ?? 0} mapped polygons
            </div>
          </div>

          <div className="rounded-lg border border-[#641600]/55 bg-[#0c0503] p-3">
            <div className="font-mono text-[10px] text-[#ebcaa1]">Major Arterials &amp; ORR</div>
            <div className="mt-0.5 font-mono text-lg font-semibold text-slate-100">
              {roadLengthKm !== null ? `${roadLengthKm.toFixed(1)} km` : 'Loading...'}
            </div>
            <div className="text-[10px] text-slate-500">
              {vectorData['osm-roads']?.features.length ?? 0} motorway/trunk ways
            </div>
          </div>
        </div>
      </div>

      {/* Largest Mapped Lakes SVG Bar Chart */}
      {topLakes.length > 0 && (
        <div className="rounded-xl border border-[#641600]/55 bg-[#0c0503] p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-100">
              Largest Mapped Lakes &amp; Reservoirs (OSM)
            </span>
            <span className="font-mono text-[10px] text-[#cd9b76]">km² (WGS84)</span>
          </div>
          <svg viewBox="0 0 360 132" className="w-full">
            {topLakes.map((lake, idx) => {
              const y = 8 + idx * 24;
              const barW = Math.max(4, (lake.areaKm2 / maxLake) * 165);
              return (
                <g
                  key={lake.name}
                  onClick={() => {
                    const c = getNamedCenter(vectorData['osm-waterbodies'], lake.name);
                    if (c && onFlyTo) onFlyTo(c[0], c[1], 13.6, lake.name);
                  }}
                  className={onFlyTo ? 'cursor-pointer hover:opacity-80' : ''}
                >
                  <text x="2" y={y + 12} className="fill-slate-300 font-sans text-[10px]">
                    {lake.name.slice(0, 22)}
                  </text>
                  <rect
                    x="145"
                    y={y + 2}
                    width={barW}
                    height="12"
                    rx="2"
                    fill="#22D3EE"
                  />
                  <text
                    x={145 + barW + 6}
                    y={y + 12}
                    className="fill-cyan-200 font-mono text-[9px]"
                  >
                    {lake.areaKm2.toFixed(2)} km²
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}

      {/* Largest Mapped Green Reserves SVG Bar Chart */}
      {topParks.length > 0 && (
        <div className="rounded-xl border border-[#641600]/55 bg-[#0c0503] p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-100">
              Largest Mapped Parks &amp; Forests (OSM)
            </span>
            <span className="font-mono text-[10px] text-emerald-400">
              {vegAreaKm2 !== null ? `${vegAreaKm2.toFixed(1)} km² total` : 'km²'}
            </span>
          </div>
          <svg viewBox="0 0 360 132" className="w-full">
            {topParks.map((park, idx) => {
              const y = 8 + idx * 24;
              const barW = Math.max(4, (park.areaKm2 / maxPark) * 165);
              return (
                <g
                  key={park.name}
                  onClick={() => {
                    const c = getNamedCenter(vectorData['osm-vegetation'], park.name);
                    if (c && onFlyTo) onFlyTo(c[0], c[1], 14.0, park.name);
                  }}
                  className={onFlyTo ? 'cursor-pointer hover:opacity-80' : ''}
                >
                  <text x="2" y={y + 12} className="fill-slate-300 font-sans text-[10px]">
                    {park.name.slice(0, 22)}
                  </text>
                  <rect
                    x="145"
                    y={y + 2}
                    width={barW}
                    height="12"
                    rx="2"
                    fill="#10B981"
                  />
                  <text
                    x={145 + barW + 6}
                    y={y + 12}
                    className="fill-emerald-200 font-mono text-[9px]"
                  >
                    {park.areaKm2.toFixed(2)} km²
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import {
  Activity,
  Building2,
  Droplets,
  FileSpreadsheet,
  GitCompare,
  Layers,
  Loader2,
  Mountain,
  Printer,
  Route,
  Sparkles,
  Thermometer,
  Trees,
} from 'lucide-react';
import { DataUnavailableNotice } from '../components/DataUnavailableNotice';
import {
  ConversionMatrixHeatmap,
  DivergingGainLossChart,
  LandConversionSankey,
  LulcDonutChart,
} from '../components/InfographicsEngine';
import { LiveVectorAnalytics } from '../components/LiveVectorAnalytics';
import { MapViewport, type FlyToTarget } from '../components/MapViewport';
import { StudyAreaSelector } from '../components/StudyAreaSelector';
import { getAnalyticalLayers } from '../config/gisConfig';
import type { useStudyBoundaries } from '../hooks/useStudyBoundaries';
import { computeGeoJsonAreaKm2 } from '../services/analysisStatsService';
import {
  fetchDynamicAnalyticalLayer,
  fetchLulcMatrixReport,
  fetchTerrainAnalysis,
  type GeeServiceError,
} from '../services/apiService';
import { exportAnalyticsCsv } from '../services/exportService';
import { generateEvidenceFindings } from '../services/findingsEngine';
import type {
  AnalyticsCategoryId,
  AnalyticsModuleId,
  LulcMatrixReport,
  SeasonWindow,
  TerrainReport,
} from '../types/analytics';
import type {
  AnalyticalLayerId,
  HistoricalYear,
  VectorLayerId,
  VectorLayerState,
} from '../types/gis';

interface AnalysisViewProps {
  activeAnalytical: AnalyticalLayerId;
  onChangeAnalytical: (id: AnalyticalLayerId) => void;
  layerStates: Record<VectorLayerId, VectorLayerState>;
  vectorData: Partial<Record<Exclude<VectorLayerId, 'landmarks'>, GeoJSON.FeatureCollection>>;
  vectorVisibility: Record<VectorLayerId, boolean>;
  onEnsureVector: (id: VectorLayerId) => void;
  studyBoundaries: ReturnType<typeof useStudyBoundaries>;
  flyToTarget: FlyToTarget | null;
  onOpenMethodology: () => void;
}

const CATEGORIES: {
  id: AnalyticsCategoryId;
  label: string;
  modules: { id: AnalyticsModuleId; label: string; icon: typeof Building2; layer?: AnalyticalLayerId }[];
}[] = [
  {
    id: 'urban-lulc',
    label: 'Urban & LULC',
    modules: [
      { id: 'urban-growth', label: 'Urban Growth', icon: Building2, layer: 'ndbi' },
      { id: 'lulc', label: 'Land Cover (LULC)', icon: Layers, layer: 'lulc' },
      { id: 'conversion-matrix', label: 'Conversion Matrix', icon: GitCompare, layer: 'lulc' },
    ],
  },
  {
    id: 'ecology-water',
    label: 'Ecology & Water',
    modules: [
      { id: 'vegetation', label: 'Vegetation (NDVI)', icon: Trees, layer: 'ndvi' },
      { id: 'water-bodies', label: 'Water (NDWI/MNDWI)', icon: Droplets, layer: 'ndwi' },
    ],
  },
  {
    id: 'climate-terrain',
    label: 'Climate & Terrain',
    modules: [
      { id: 'urban-heat', label: 'Urban Heat (LST)', icon: Thermometer, layer: 'lst' },
      { id: 'terrain', label: 'Terrain (SRTM)', icon: Mountain },
    ],
  },
  {
    id: 'spatial-infra',
    label: 'Spatial & Infra',
    modules: [
      { id: 'spatial-patterns', label: 'Spatial Patterns', icon: Activity, layer: 'ndbi' },
      { id: 'infrastructure', label: 'Infrastructure (OSM)', icon: Route },
    ],
  },
  {
    id: 'scenarios-reports',
    label: 'Findings & Scenarios',
    modules: [
      { id: 'scenarios', label: 'WHAT CHANGED? & Scenarios', icon: Sparkles },
    ],
  },
];

const YEARS: HistoricalYear[] = [1990, 2000, 2010, 2020, 2025];

export function AnalysisView({
  activeAnalytical,
  onChangeAnalytical,
  layerStates,
  vectorData,
  vectorVisibility,
  onEnsureVector,
  studyBoundaries,
  flyToTarget,
  onOpenMethodology,
}: AnalysisViewProps) {
  const [activeCategory, setActiveCategory] = useState<AnalyticsCategoryId>('urban-lulc');
  const [activeModule, setActiveModule] = useState<AnalyticsModuleId>('urban-growth');
  const [startYear, setStartYear] = useState<HistoricalYear>(1990);
  const [endYear, setEndYear] = useState<HistoricalYear>(2025);
  const [season, setSeason] = useState<SeasonWindow>('dry');
  const [layoutMode, setLayoutMode] = useState<'split' | 'analytics' | 'map'>('split');
  const [opacity, setOpacity] = useState(0.8);

  const [lulcReport, setLulcReport] = useState<LulcMatrixReport | null>(null);
  const [terrainReport, setTerrainReport] = useState<TerrainReport | null>(null);
  const [liveTileUrl, setLiveTileUrl] = useState<string | null>(null);
  const [geeError, setGeeError] = useState<GeeServiceError | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  const asideRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(asideRef.current, {
        x: -14,
        opacity: 0,
        duration: 0.45,
        ease: 'power2.out',
        clearProps: 'transform',
      });
    });
    return () => ctx.revert();
  }, []);

  // Ensure live OSM vector layers load immediately for baseline analytics
  useEffect(() => {
    onEnsureVector('osm-waterbodies');
    onEnsureVector('osm-vegetation');
    onEnsureVector('osm-roads');
  }, [onEnsureVector]);

  // Fetch dynamic LULC + Conversion Matrix + NDVI/LST summary
  useEffect(() => {
    let cancelled = false;
    setLoadingReport(true);
    setGeeError(null);
    void fetchLulcMatrixReport(
      studyBoundaries.activeAreaForApi,
      startYear,
      endYear,
      season
    ).then(({ data, error }) => {
      if (cancelled) return;
      setLoadingReport(false);
      if (data) setLulcReport(data);
      else {
        setLulcReport(null);
        if (error) setGeeError(error);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [studyBoundaries.activeAreaForApi, startYear, endYear, season]);

  // Fetch Terrain SRTM when Terrain module is active
  useEffect(() => {
    if (activeModule !== 'terrain' && activeModule !== 'scenarios') return;
    let cancelled = false;
    void fetchTerrainAnalysis(studyBoundaries.activeAreaForApi).then(({ data }) => {
      if (!cancelled && data) setTerrainReport(data);
    });
    return () => {
      cancelled = true;
    };
  }, [activeModule, studyBoundaries.activeAreaForApi]);

  // Fetch dynamic map tile for active analytical layer
  useEffect(() => {
    setLiveTileUrl(null);
    if (activeModule === 'terrain') {
      if (terrainReport?.hillshadeTileUrl) setLiveTileUrl(terrainReport.hillshadeTileUrl);
      return;
    }
    let cancelled = false;
    void fetchDynamicAnalyticalLayer(
      activeAnalytical,
      studyBoundaries.activeAreaForApi,
      endYear
    ).then(({ data }) => {
      if (!cancelled && data?.available && data.tileUrl) {
        setLiveTileUrl(data.tileUrl);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activeAnalytical, activeModule, endYear, studyBoundaries.activeAreaForApi, terrainReport]);

  const findings = useMemo(
    () => generateEvidenceFindings(lulcReport, terrainReport),
    [lulcReport, terrainReport]
  );

  const osmWaterAreaKm2 = useMemo(
    () => computeGeoJsonAreaKm2(vectorData['osm-waterbodies']),
    [vectorData]
  );
  const osmVegAreaKm2 = useMemo(
    () => computeGeoJsonAreaKm2(vectorData['osm-vegetation']),
    [vectorData]
  );

  const currentLayerMeta =
    getAnalyticalLayers().find((l) => l.id === activeAnalytical) ??
    getAnalyticalLayers()[0];

  const handleSelectModule = (modId: AnalyticsModuleId, layer?: AnalyticalLayerId) => {
    setActiveModule(modId);
    if (layer) onChangeAnalytical(layer);
  };

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col bg-[#0c0503]">
      {/* Global Analysis Controls Ribbon */}
      <div className="border-b border-[#641600]/55/90 bg-[#140906]/95 px-4 py-2.5 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <StudyAreaSelector
              mode={studyBoundaries.studyAreaMode}
              onChange={studyBoundaries.setStudyAreaMode}
            />

            <div className="flex items-center gap-1.5 rounded-lg border border-[#641600]/55 bg-[#0c0503] px-2 py-1 font-mono text-[11px]">
              <span className="text-slate-500">From</span>
              <select
                aria-label="Start year"
                value={startYear}
                onChange={(e) => setStartYear(Number(e.target.value) as HistoricalYear)}
                className="bg-transparent text-[#ebcaa1] focus:outline-none"
              >
                {YEARS.map((y) => (
                  <option key={y} value={y} className="bg-[#140906]">
                    {y}
                  </option>
                ))}
              </select>
              <span className="text-slate-600">→</span>
              <select
                aria-label="End year"
                value={endYear}
                onChange={(e) => setEndYear(Number(e.target.value) as HistoricalYear)}
                className="bg-transparent text-[#ebcaa1] focus:outline-none"
              >
                {YEARS.map((y) => (
                  <option key={y} value={y} className="bg-[#140906]">
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <select
              aria-label="Seasonal window"
              value={season}
              onChange={(e) => setSeason(e.target.value as SeasonWindow)}
              className="rounded-lg border border-[#641600]/55 bg-[#0c0503] px-2.5 py-1.5 font-mono text-[11px] text-slate-300 focus:outline-none"
            >
              <option value="dry">Dry (Jan–Mar)</option>
              <option value="post-monsoon">Post-Monsoon (Oct–Dec)</option>
              <option value="annual">Annual (Jan–Dec)</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-[#641600]/55 bg-[#0c0503] p-0.5 text-[11px]">
              {(['split', 'analytics', 'map'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setLayoutMode(m)}
                  className={`rounded-md px-2.5 py-1 capitalize transition-colors ${
                    layoutMode === m
                      ? 'bg-[#98472b]/20 text-[#ebcaa1]'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            {lulcReport && (
              <button
                type="button"
                onClick={() => exportAnalyticsCsv(lulcReport, findings)}
                className="inline-flex items-center gap-1 rounded-lg border border-[#cd9b76]/40 bg-[#98472b]/10 px-2.5 py-1.5 text-[11px] font-medium text-[#ebcaa1] hover:bg-[#98472b]/20"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>Export CSV</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1 rounded-lg border border-[#98472b]/50 bg-[#0c0503] px-2.5 py-1.5 text-[11px] font-medium text-slate-300 hover:border-[#cd9b76]/50 hover:text-[#ebcaa1]"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>PDF / Print</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Split Workspace */}
      <div className="flex flex-1 flex-col lg:flex-row">
        {layoutMode !== 'map' && (
          <aside
            ref={asideRef}
            className={`gis-glass shrink-0 space-y-5 overflow-y-auto border-b border-[#641600]/55/80 p-5 lg:border-b-0 lg:border-r ${
              layoutMode === 'analytics'
                ? 'w-full'
                : 'w-full lg:w-[500px] xl:w-[540px] lg:max-h-[calc(100vh-7rem)]'
            }`}
          >
            {/* Category Tabs */}
            <div className="flex flex-wrap gap-1 border-b border-[#641600]/55 pb-3">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setActiveCategory(cat.id);
                    const first = cat.modules[0];
                    handleSelectModule(first.id, first.layer);
                  }}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    activeCategory === cat.id
                      ? 'bg-[#98472b]/20 text-[#ebcaa1] border border-[#cd9b76]/40'
                      : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Sub-Module Selector */}
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.find((c) => c.id === activeCategory)?.modules.map((mod) => {
                const Icon = mod.icon;
                const active = activeModule === mod.id;
                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => handleSelectModule(mod.id, mod.layer)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                      active
                        ? 'border-[#cd9b76]/60 bg-[#98472b]/15 text-amber-200'
                        : 'border-[#641600]/55 bg-[#0c0503] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{mod.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Loading Indicator */}
            {loadingReport && (
              <div className="flex items-center gap-2 rounded-lg border border-[#641600]/55 bg-[#0c0503] px-3 py-2.5 text-xs text-[#ebcaa1]">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>
                  Running Google Earth Engine spatial analysis ({studyBoundaries.activeAreaForApi.toUpperCase()} {startYear}→{endYear})...
                </span>
              </div>
            )}

            {/* Module Content */}
            {activeModule === 'infrastructure' ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-emerald-500/35 bg-emerald-950/20 p-4 space-y-2">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-emerald-300">
                    Observed • Live OpenStreetMap Vector (Present-Day)
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <div className="rounded-lg bg-[#0c0503] p-3">
                      <div className="font-mono text-[10px] text-slate-400">
                        Arterials &amp; ORR
                      </div>
                      <div className="mt-1 font-mono text-lg text-[#ebcaa1]">
                        {layerStates['osm-roads'].featureCount ?? '—'}
                      </div>
                      <div className="text-[10px] text-slate-500">OSM motorway/trunk ways</div>
                    </div>
                    <div className="rounded-lg bg-[#0c0503] p-3">
                      <div className="font-mono text-[10px] text-slate-400">
                        Mapped Waterbodies
                      </div>
                      <div className="mt-1 font-mono text-lg text-[#ebcaa1]">
                        {osmWaterAreaKm2 !== null ? `${osmWaterAreaKm2.toFixed(1)} km²` : '—'}
                      </div>
                      <div className="text-[10px] text-slate-500">WGS84 spherical area</div>
                    </div>
                    <div className="rounded-lg bg-[#0c0503] p-3">
                      <div className="font-mono text-[10px] text-slate-400">
                        Mapped Parks/Forests
                      </div>
                      <div className="mt-1 font-mono text-lg text-emerald-300">
                        {osmVegAreaKm2 !== null ? `${osmVegAreaKm2.toFixed(1)} km²` : '—'}
                      </div>
                      <div className="text-[10px] text-slate-500">OSM green polygons</div>
                    </div>
                    <div className="rounded-lg bg-[#0c0503] p-3">
                      <div className="font-mono text-[10px] text-slate-400">
                        TGRAC HMDA Area
                      </div>
                      <div className="mt-1 font-mono text-lg text-slate-100">
                        7,266.4 km²
                      </div>
                      <div className="text-[10px] text-slate-500">Official MapServer/52</div>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Note: Present-day OSM road density is never projected onto historical
                    1990/2000 epochs without dated historical road datasets.
                  </p>
                </div>
              </div>
            ) : lulcReport && lulcReport.startEpoch.available && lulcReport.endEpoch.available ? (
              <div className="space-y-4">
                {(activeModule === 'urban-growth' || activeModule === 'lulc') && (
                  <>
                    <LulcDonutChart report={lulcReport} />
                    <DivergingGainLossChart report={lulcReport} />
                  </>
                )}

                {activeModule === 'conversion-matrix' && (
                  <>
                    <ConversionMatrixHeatmap report={lulcReport} />
                    <LandConversionSankey report={lulcReport} />
                  </>
                )}

                {activeModule === 'vegetation' && (
                  <div className="rounded-xl border border-[#641600]/55 bg-[#0c0503] p-4 space-y-2">
                    <div className="font-mono text-[10px] uppercase text-emerald-400">
                      NDVI Vegetation Summary ({startYear} → {endYear})
                    </div>
                    <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                      <div className="rounded bg-[#1e0e09] p-2.5">
                        <div className="text-[10px] text-slate-400">{startYear} Mean NDVI</div>
                        <div className="text-base text-slate-100">
                          {lulcReport.startEpoch.meanNdvi?.toFixed(3) ?? '—'}
                        </div>
                      </div>
                      <div className="rounded bg-[#1e0e09] p-2.5">
                        <div className="text-[10px] text-slate-400">{endYear} Mean NDVI</div>
                        <div className="text-base text-emerald-300">
                          {lulcReport.endEpoch.meanNdvi?.toFixed(3) ?? '—'}
                        </div>
                      </div>
                    </div>
                    <DivergingGainLossChart report={lulcReport} />
                  </div>
                )}

                {activeModule === 'water-bodies' && (
                  <div className="rounded-xl border border-[#641600]/55 bg-[#0c0503] p-4 space-y-2">
                    <div className="font-mono text-[10px] uppercase text-[#cd9b76]">
                      NDWI / MNDWI Surface Water ({lulcReport.season})
                    </div>
                    <DivergingGainLossChart report={lulcReport} />
                  </div>
                )}

                {activeModule === 'urban-heat' && (
                  <div className="rounded-xl border border-[#641600]/55 bg-[#0c0503] p-4 space-y-2">
                    <div className="font-mono text-[10px] uppercase text-[#dab089]">
                      Landsat Surface Temperature (°C LST — Skin Temp)
                    </div>
                    <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                      <div className="rounded bg-[#1e0e09] p-2.5">
                        <div className="text-[10px] text-slate-400">{startYear} Mean LST</div>
                        <div className="text-base text-[#ebcaa1]">
                          {lulcReport.startEpoch.meanLstC?.toFixed(1) ?? '—'} °C
                        </div>
                      </div>
                      <div className="rounded bg-[#1e0e09] p-2.5">
                        <div className="text-[10px] text-slate-400">{endYear} Mean LST</div>
                        <div className="text-base text-[#ebcaa1]">
                          {lulcReport.endEpoch.meanLstC?.toFixed(1) ?? '—'} °C
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {(activeModule === 'scenarios' || activeModule === 'spatial-patterns') && (
                  <div className="space-y-3">
                    <div className="font-mono text-[10px] uppercase tracking-wider text-[#dab089]">
                      WHAT CHANGED? — Evidence-Based Findings
                    </div>
                    {findings.map((f) => (
                      <div
                        key={f.id}
                        className="rounded-xl border border-[#641600]/55 bg-[#0c0503] p-3.5 space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-slate-100">
                            {f.title}
                          </span>
                          <span className="font-mono text-sm font-semibold text-[#ebcaa1]">
                            {f.measuredChange} {f.unit}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-300">{f.supportingStat}</div>
                        <div className="font-mono text-[9px] text-slate-500">
                          {f.dataSource} • {f.confidence}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              !loadingReport && (
                <div className="space-y-4">
                  <LiveVectorAnalytics
                    hmdaGeoJson={studyBoundaries.boundaries.hmda?.geojson}
                    ghmcGeoJson={studyBoundaries.boundaries.ghmc?.geojson}
                    vectorData={vectorData}
                  />
                  <DataUnavailableNotice
                    compact
                    layerName={`${currentLayerMeta.name} & ${startYear}–${endYear} Matrix`}
                    sensorOrFormula={geeError?.message || currentLayerMeta.formula}
                    onOpenMethodology={onOpenMethodology}
                  />
                </div>
              )
            )}

            {/* Opacity Slider when Live Tile Active */}
            {liveTileUrl && (
              <div className="rounded-xl border border-[#641600]/55 bg-[#0c0503] p-3">
                <div className="mb-1 flex justify-between font-mono text-[10px] text-slate-400">
                  <span>Active Analytical Layer Opacity</span>
                  <span>{Math.round(opacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={opacity}
                  onChange={(e) => setOpacity(parseFloat(e.target.value))}
                  className="w-full accent-[#cd9b76]"
                />
              </div>
            )}

            {/* Scientific Transparency & Non-GIS Index Guide */}
            <div className="rounded-xl border border-[#641600]/55/80 bg-[#0c0503]/80 p-3.5 font-mono text-[10px] text-slate-400 space-y-2">
              <div className="text-slate-200 font-semibold">
                Plain-Language Index Guide
              </div>
              <div className="space-y-1 font-sans text-[11px] text-slate-400">
                <div>
                  <strong className="text-emerald-300">NDVI</strong>: Measures green
                  plant canopy vigor (−1 to +1; higher = denser vegetation).
                </div>
                <div>
                  <strong className="text-[#ebcaa1]">NDWI / MNDWI</strong>: Isolates open
                  water surfaces in lakes and reservoirs from dry land.
                </div>
                <div>
                  <strong className="text-[#ebcaa1]">NDBI + LULC</strong>: Highlights
                  impervious built-up surfaces, combined with NDVI/MNDWI to avoid
                  confusing bare rock with buildings.
                </div>
                <div>
                  <strong className="text-red-300">LST (°C)</strong>: Satellite-derived
                  ground skin temperature (not atmospheric air temperature).
                </div>
              </div>
              <div className="border-t border-[#641600]/55 pt-2">
                CRS: EPSG:4326 / WGS84 • Active Study Area:{' '}
                {studyBoundaries.studyAreaMode === 'compare'
                  ? 'HMDA vs GHMC Side-by-Side'
                  : studyBoundaries.activeAreaForApi.toUpperCase()}
              </div>
            </div>
          </aside>
        )}

        {/* Map Canvas */}
        {layoutMode !== 'analytics' && (
          <div className="relative h-[60vh] flex-1 lg:h-[calc(100vh-7rem)]">
            <MapViewport
              basemapId="carto-dark"
              activeYear={null}
              historicalOpacity={0.85}
              dynamicGeeTileUrl={null}
              activeAnalyticalLayer={activeAnalytical}
              dynamicAnalyticalTileUrl={liveTileUrl}
              analyticalOpacity={opacity}
              hmdaBoundary={studyBoundaries.boundaries.hmda?.geojson ?? null}
              ghmcBoundary={studyBoundaries.boundaries.ghmc?.geojson ?? null}
              showHmdaBoundary={studyBoundaries.showHmda}
              showGhmcBoundary={studyBoundaries.showGhmc}
              vectorData={vectorData}
              vectorVisibility={vectorVisibility}
              flyToTarget={flyToTarget}
            />
          </div>
        )}
      </div>
    </div>
  );
}

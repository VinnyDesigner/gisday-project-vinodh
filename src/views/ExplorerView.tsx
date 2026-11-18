import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import {
  Box,
  Camera,
  ChevronLeft,
  ChevronRight,
  Clock,
  Layers,
  Loader2,
  Map as MapIcon,
  Mountain,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import { DataInfoPanel } from '../components/DataInfoPanel';
import { DataUnavailableNotice } from '../components/DataUnavailableNotice';
import { LocationSearch } from '../components/LocationSearch';
import { MapViewport, type FlyToTarget } from '../components/MapViewport';
import { StudyAreaSelector } from '../components/StudyAreaSelector';
import { TimelineEvolutionBar } from '../components/TimelineEvolutionBar';
import {
  BASEMAPS,
  getAnalyticalLayers,
  getHistoricalPeriods,
  HYDERABAD_CENTER,
  HYDERABAD_DEFAULT_ZOOM,
  VECTOR_LAYERS,
} from '../config/gisConfig';
import {
  fetchDynamicAnalyticalLayer,
  fetchGeeImagery,
  type GeeServiceError,
} from '../services/apiService';
import type { useStudyBoundaries } from '../hooks/useStudyBoundaries';
import type {
  AnalyticalLayerId,
  BasemapId,
  GeeImageryResult,
  HistoricalYear,
  VectorLayerId,
  VectorLayerState,
  VisualStyle3D,
} from '../types/gis';

interface ExplorerViewProps {
  basemapId: BasemapId;
  onChangeBasemap: (id: BasemapId) => void;
  activeYear: HistoricalYear | null;
  onChangeYear: (year: HistoricalYear | null) => void;
  activeAnalytical: AnalyticalLayerId | null;
  onChangeAnalytical: (id: AnalyticalLayerId | null) => void;
  layerStates: Record<VectorLayerId, VectorLayerState>;
  vectorData: Partial<Record<Exclude<VectorLayerId, 'landmarks'>, GeoJSON.FeatureCollection>>;
  vectorVisibility: Record<VectorLayerId, boolean>;
  onToggleVector: (id: VectorLayerId) => void;
  onRetryVector: (id: Exclude<VectorLayerId, 'landmarks'>) => void;
  studyBoundaries: ReturnType<typeof useStudyBoundaries>;
  flyToTarget: FlyToTarget | null;
  onSelectLocation: (lng: number, lat: number, zoom: number, label?: string) => void;
  onOpenMethodology: () => void;
}

const EVOLUTION_STOPS: Record<
  HistoricalYear,
  { lng: number; lat: number; zoom: number; pitch: number; bearing: number; label: string }
> = {
  1990: {
    lng: 78.4747,
    lat: 17.3616,
    zoom: 13.8,
    pitch: 52,
    bearing: 12,
    label: '1990 • Historic Charminar & Musi Core',
  },
  2000: {
    lng: 78.4738,
    lat: 17.4239,
    zoom: 13.4,
    pitch: 54,
    bearing: -10,
    label: '2000 • Hussain Sagar & Central Axis',
  },
  2010: {
    lng: 78.348,
    lat: 17.44,
    zoom: 12.8,
    pitch: 50,
    bearing: -20,
    label: '2010 • Outer Ring Road & Western Expansion',
  },
  2020: {
    lng: 78.3816,
    lat: 17.448,
    zoom: 13.8,
    pitch: 55,
    bearing: -18,
    label: '2020 • HITEC City (Sentinel-2 10m)',
  },
  2025: {
    lng: 78.3816,
    lat: 17.448,
    zoom: 15.2,
    pitch: 58,
    bearing: -24,
    label: '2025 • HITEC City 3D Buildings',
  },
};

export function ExplorerView({
  basemapId,
  onChangeBasemap,
  activeYear,
  onChangeYear,
  activeAnalytical,
  onChangeAnalytical,
  layerStates,
  vectorData,
  vectorVisibility,
  onToggleVector,
  onRetryVector,
  studyBoundaries,
  flyToTarget,
  onSelectLocation,
  onOpenMethodology,
}: ExplorerViewProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showRoadsLabels, setShowRoadsLabels] = useState(true);
  const [is3DMode, setIs3DMode] = useState(true);
  const [enableTerrain, setEnableTerrain] = useState(true);
  const [enableBuildings, setEnableBuildings] = useState(true);
  const [visualStyle, setVisualStyle] = useState<VisualStyle3D>('satellite-3d');
  const [isTimelinePlaying, setIsTimelinePlaying] = useState(false);
  const [historicalOpacity, setHistoricalOpacity] = useState(0.85);
  const [analyticalOpacity, setAnalyticalOpacity] = useState(0.75);
  const [geeRevision, setGeeRevision] = useState(0);
  const [geeResult, setGeeResult] = useState<GeeImageryResult | null>(null);
  const [geeError, setGeeError] = useState<GeeServiceError | null>(null);
  const [geeLoading, setGeeLoading] = useState(false);
  const [analyticalTileUrl, setAnalyticalTileUrl] = useState<string | null>(null);
  const [analyticalError, setAnalyticalError] = useState<GeeServiceError | null>(null);
  const [analyticalLoading, setAnalyticalLoading] = useState(false);
  const hudRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.explorer-hud', {
        y: 14,
        opacity: 0,
        duration: 0.55,
        stagger: 0.08,
        ease: 'power3.out',
        clearProps: 'transform',
      });
    }, hudRef);
    return () => ctx.revert();
  }, []);

  useEffect(() => {
    const onGeeUpdate = () => setGeeRevision((r) => r + 1);
    window.addEventListener('htt-gee-updated', onGeeUpdate);
    return () => window.removeEventListener('htt-gee-updated', onGeeUpdate);
  }, []);

  useEffect(() => {
    if (!activeYear) {
      setGeeResult(null);
      setGeeError(null);
      setGeeLoading(false);
      return;
    }
    let cancelled = false;
    setGeeLoading(true);
    setGeeError(null);
    void fetchGeeImagery(studyBoundaries.activeAreaForApi, activeYear).then(
      ({ data, error }) => {
        if (cancelled) return;
        setGeeLoading(false);
        if (data?.available) {
          setGeeResult(data);
        } else if (activeYear === 2020) {
          setGeeResult({
            available: true,
            area: studyBoundaries.activeAreaForApi,
            year: 2020,
            tileUrl:
              'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg',
            sceneCount: 1,
            dataProvider: 'EOX IT Services / Copernicus (CC BY 4.0)',
            datasetId: 's2cloudless-2020_3857',
            sensor: 'Sentinel-2A/B MSI (10m)',
            spatialResolution: '10m',
            compositePeriod: '2020 Annual Cloudless Mosaic',
          });
        } else {
          setGeeResult(null);
          if (error) setGeeError(error);
        }
      }
    );
    return () => {
      cancelled = true;
    };
  }, [activeYear, studyBoundaries.activeAreaForApi, geeRevision]);

  useEffect(() => {
    if (!activeAnalytical) {
      setAnalyticalTileUrl(null);
      setAnalyticalError(null);
      setAnalyticalLoading(false);
      return;
    }
    let cancelled = false;
    setAnalyticalLoading(true);
    setAnalyticalError(null);
    void fetchDynamicAnalyticalLayer(
      activeAnalytical,
      studyBoundaries.activeAreaForApi,
      activeYear ?? 2025
    ).then(({ data, error }) => {
      if (cancelled) return;
      setAnalyticalLoading(false);
      if (data?.available && data.tileUrl) {
        setAnalyticalTileUrl(data.tileUrl);
      } else {
        setAnalyticalTileUrl(null);
        if (error) setAnalyticalError(error);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activeAnalytical, activeYear, studyBoundaries.activeAreaForApi]);

  const historicalPeriods = getHistoricalPeriods();
  const analyticalLayers = getAnalyticalLayers();

  const selectedPeriod = historicalPeriods.find((p) => p.year === activeYear) ?? null;
  const selectedAnalytical =
    analyticalLayers.find((a) => a.id === activeAnalytical) ?? null;

  return (
    <div ref={hudRef} className="relative h-[calc(100vh-3.5rem)] w-full overflow-hidden bg-[#0c0503]">
      {/* Full-Viewport MapLibre Canvas */}
      <MapViewport
        basemapId={basemapId}
        showRoadsLabelsOverlay={showRoadsLabels}
        is3DMode={is3DMode}
        enableTerrain={enableTerrain}
        enableBuildings={enableBuildings}
        visualStyle={visualStyle}
        activeYear={activeYear}
        historicalOpacity={historicalOpacity}
        dynamicGeeTileUrl={geeResult?.available ? geeResult.tileUrl : null}
        activeAnalyticalLayer={activeAnalytical}
        dynamicAnalyticalTileUrl={analyticalTileUrl}
        analyticalOpacity={analyticalOpacity}
        hmdaBoundary={studyBoundaries.boundaries.hmda?.geojson ?? null}
        ghmcBoundary={studyBoundaries.boundaries.ghmc?.geojson ?? null}
        showHmdaBoundary={studyBoundaries.showHmda}
        showGhmcBoundary={studyBoundaries.showGhmc}
        vectorData={vectorData}
        vectorVisibility={vectorVisibility}
        flyToTarget={flyToTarget}
      />

      {/* Top Search Bar + Reset Extent */}
      <div className="pointer-events-none absolute left-4 right-14 top-3 z-20 flex items-center justify-center gap-2 sm:left-auto sm:right-14 sm:w-[430px]">
        <div className="pointer-events-auto flex-1">
          <LocationSearch
            onSelectLocation={(lng, lat, zoom, label) =>
              onSelectLocation(lng, lat, zoom, label)
            }
          />
        </div>
        <button
          type="button"
          title="Export Current Map View as PNG"
          onClick={() => {
            const canvas = document.querySelector<HTMLCanvasElement>(
              '.maplibregl-canvas'
            );
            if (!canvas) return;
            const link = document.createElement('a');
            link.download = `hyderabad_${studyBoundaries.activeAreaForApi}_${activeYear ?? 'live'}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
          }}
          className="pointer-events-auto flex h-[34px] shrink-0 items-center gap-1.5 rounded-lg border border-[#98472b]/50/80 bg-[#140906]/95 px-2.5 text-xs text-slate-300 shadow-lg backdrop-blur-md hover:border-[#cd9b76]/50 hover:text-[#ebcaa1]"
        >
          <Camera className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">PNG</span>
        </button>
        <button
          type="button"
          title="Reset Hyderabad Extent"
          onClick={() =>
            onSelectLocation(
              HYDERABAD_CENTER[0],
              HYDERABAD_CENTER[1],
              HYDERABAD_DEFAULT_ZOOM
            )
          }
          className="pointer-events-auto flex h-[34px] shrink-0 items-center gap-1.5 rounded-lg border border-[#98472b]/50/80 bg-[#140906]/95 px-2.5 text-xs text-slate-300 shadow-lg backdrop-blur-md hover:border-[#cd9b76]/50 hover:text-[#ebcaa1]"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Reset</span>
        </button>
      </div>

      {/* Collapsible Left GIS Control Drawer */}
      <aside
        className={`explorer-hud absolute bottom-14 left-3 top-16 z-20 flex transition-transform duration-300 sm:top-3 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-[calc(100%+12px)]'
        }`}
      >
        <div className="gis-glass flex h-full w-80 max-w-[85vw] flex-col overflow-hidden rounded-xl">
          <div className="flex items-center justify-between border-b border-[#641600]/55 px-4 py-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-[#cd9b76]" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                GIS Layer Stack
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              aria-label="Collapse layer panel"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto p-4">
            {/* 0A. 3D Digital Twin Controls */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-wider text-[#cd9b76]">
                  3D City Twin &amp; Visual Mode
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIs3DMode(true);
                    setEnableBuildings(true);
                    onSelectLocation(78.3816, 17.448, 15.2, 'HITEC City 3D');
                  }}
                  className="font-mono text-[10px] text-[#ebcaa1] hover:underline"
                >
                  Fly to 3D Buildings
                </button>
              </div>

              <div className="grid grid-cols-3 gap-1">
                <button
                  type="button"
                  onClick={() => setIs3DMode((v) => !v)}
                  className={`rounded-md border py-1.5 font-mono text-[11px] transition-colors ${
                    is3DMode
                      ? 'border-[#ebcaa1]/60 bg-[#98472b]/20 text-[#dab089]'
                      : 'border-[#641600]/55 bg-[#0c0503]/70 text-slate-400'
                  }`}
                >
                  {is3DMode ? '3D Pitch' : '2D Flat'}
                </button>
                <button
                  type="button"
                  onClick={() => setEnableTerrain((v) => !v)}
                  className={`inline-flex items-center justify-center gap-1 rounded-md border py-1.5 font-mono text-[11px] transition-colors ${
                    enableTerrain
                      ? 'border-[#ebcaa1]/60 bg-[#98472b]/20 text-[#dab089]'
                      : 'border-[#641600]/55 bg-[#0c0503]/70 text-slate-400'
                  }`}
                >
                  <Mountain className="h-3 w-3" />
                  <span>DEM</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEnableBuildings((v) => !v)}
                  className={`inline-flex items-center justify-center gap-1 rounded-md border py-1.5 font-mono text-[11px] transition-colors ${
                    enableBuildings
                      ? 'border-[#cd9b76]/60 bg-[#98472b]/20 text-amber-200'
                      : 'border-[#641600]/55 bg-[#0c0503]/70 text-slate-400'
                  }`}
                >
                  <Box className="h-3 w-3" />
                  <span>3D Bldg</span>
                </button>
              </div>

              <div className="grid grid-cols-3 gap-1">
                {(
                  [
                    { id: 'cinematic-dark', label: 'Dark 3D' },
                    { id: 'satellite-3d', label: 'Satellite 3D' },
                    { id: 'urban-growth', label: 'Growth' },
                  ] as const
                ).map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => {
                      setVisualStyle(st.id);
                      if (st.id === 'urban-growth') onChangeAnalytical('ndbi');
                    }}
                    className={`rounded border py-1 text-[10px] font-medium transition-colors ${
                      visualStyle === st.id
                        ? 'border-[#ebcaa1]/60 bg-slate-800 text-slate-100'
                        : 'border-[#641600]/55 bg-[#0c0503]/70 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </section>

            {/* 0B. Official Study Area Selector (TGRAC HMDA & GHMC) */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
                  Study Area (TGRAC Official)
                </span>
                {studyBoundaries.status === 'loading' && (
                  <Loader2 className="h-3 w-3 animate-spin text-[#cd9b76]" />
                )}
              </div>
              <StudyAreaSelector
                mode={studyBoundaries.studyAreaMode}
                onChange={studyBoundaries.setStudyAreaMode}
              />
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                <label className="flex cursor-pointer items-center justify-between rounded border border-[#641600]/55 bg-[#0c0503]/75 px-2.5 py-1.5 text-[11px]">
                  <span className="flex items-center gap-1.5 text-slate-200">
                    <span className="h-2 w-2 rounded-full bg-[#00D5FF]" />
                    HMDA
                  </span>
                  <input
                    type="checkbox"
                    checked={studyBoundaries.showHmda}
                    onChange={() => studyBoundaries.setShowHmda((v) => !v)}
                    className="h-3 w-3 accent-[#cd9b76]"
                  />
                </label>
                <label className="flex cursor-pointer items-center justify-between rounded border border-[#641600]/55 bg-[#0c0503]/75 px-2.5 py-1.5 text-[11px]">
                  <span className="flex items-center gap-1.5 text-slate-200">
                    <span className="h-2 w-2 rounded-full bg-[#FFB547]" />
                    GHMC
                  </span>
                  <input
                    type="checkbox"
                    checked={studyBoundaries.showGhmc}
                    onChange={() => studyBoundaries.setShowGhmc((v) => !v)}
                    className="h-3 w-3 accent-[#ebcaa1]"
                  />
                </label>
              </div>
            </section>

            {/* 1. Visual Basemaps */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-400">
                  <MapIcon className="h-3 w-3 text-[#cd9b76]" />
                  Visual Basemap
                </span>
                <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[9px] text-slate-300">
                  LIVE
                </span>
              </div>
              <div className="grid gap-1.5">
                {BASEMAPS.map((bm) => {
                  const active = basemapId === bm.id;
                  return (
                    <button
                      key={bm.id}
                      type="button"
                      onClick={() => onChangeBasemap(bm.id)}
                      className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                        active
                          ? 'border-[#cd9b76]/50 bg-[#98472b]/12 text-slate-100'
                          : 'border-[#641600]/55 bg-[#0c0503]/70 text-slate-400 hover:border-[#98472b]/50 hover:text-slate-200'
                      }`}
                    >
                      <div className="text-xs font-medium">{bm.name}</div>
                      <div className="text-[10px] text-slate-500">{bm.subtitle}</div>
                    </button>
                  );
                })}
              </div>

              {basemapId !== 'osm-standard' && (
                <label className="flex cursor-pointer items-center justify-between rounded-lg border border-[#641600]/55 bg-[#0c0503]/75 px-3 py-2">
                  <span className="text-[11px] text-slate-300">
                    OSM Labels &amp; Roads Overlay
                  </span>
                  <input
                    type="checkbox"
                    checked={showRoadsLabels}
                    onChange={() => setShowRoadsLabels((prev) => !prev)}
                    className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900 accent-[#cd9b76]"
                  />
                </label>
              )}
            </section>

            {/* 2. Historical Satellite Epoch */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-400">
                  <Clock className="h-3 w-3 text-[#dab089]" />
                  Historical Satellite (GEE)
                </span>
                {activeYear && (
                  <button
                    type="button"
                    onClick={() => onChangeYear(null)}
                    className="font-mono text-[10px] text-slate-400 hover:text-[#ebcaa1]"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="grid grid-cols-5 gap-1">
                {historicalPeriods.map((p) => {
                  const active = activeYear === p.year;
                  return (
                    <button
                      key={p.year}
                      type="button"
                      onClick={() => onChangeYear(active ? null : p.year)}
                      className={`rounded border py-1.5 font-mono text-[11px] transition-colors ${
                        active
                          ? 'border-[#cd9b76]/70 bg-[#98472b]/20 text-[#ebcaa1]'
                          : 'border-[#641600]/55 bg-[#0c0503]/70 text-slate-400 hover:border-[#98472b]/50 hover:text-slate-200'
                      }`}
                    >
                      {p.year}
                    </button>
                  );
                })}
              </div>

              {geeLoading && (
                <div className="flex items-center gap-2 rounded border border-[#641600]/55 bg-[#0c0503] px-3 py-2 text-[11px] text-[#ebcaa1]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Querying Google Earth Engine ({studyBoundaries.activeAreaForApi.toUpperCase()} {activeYear})...</span>
                </div>
              )}

              {selectedPeriod && !geeLoading && (selectedPeriod.isAvailable || geeResult?.available) && (
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between font-mono text-[10px] text-slate-400">
                    <span>Epoch Opacity</span>
                    <span>{Math.round(historicalOpacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={historicalOpacity}
                    onChange={(e) => setHistoricalOpacity(parseFloat(e.target.value))}
                    className="w-full accent-[#ebcaa1]"
                  />
                </div>
              )}

              {selectedPeriod && !geeLoading && !selectedPeriod.isAvailable && !geeResult?.available && (
                <DataUnavailableNotice
                  compact
                  layerName={`${selectedPeriod.year} Imagery`}
                  sensorOrFormula={geeError?.message || selectedPeriod.sensor}
                  onOpenMethodology={onOpenMethodology}
                />
              )}
            </section>

            {/* 3. Processed Analytical Layers */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-400">
                  <Layers className="h-3 w-3 text-[#cd9b76]" />
                  Analytical Layers (GEE)
                </span>
                {activeAnalytical && (
                  <button
                    type="button"
                    onClick={() => onChangeAnalytical(null)}
                    className="font-mono text-[10px] text-slate-400 hover:text-[#ebcaa1]"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {analyticalLayers.map((a) => {
                  const active = activeAnalytical === a.id;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => onChangeAnalytical(active ? null : a.id)}
                      className={`rounded-md border px-2.5 py-1.5 text-left text-[11px] transition-colors ${
                        active
                          ? 'border-[#cd9b76]/60 bg-[#98472b]/15 text-[#dab089]'
                          : 'border-[#641600]/55 bg-[#0c0503]/70 text-slate-400 hover:border-[#98472b]/50 hover:text-slate-200'
                      }`}
                    >
                      {a.shortName}
                    </button>
                  );
                })}
              </div>

              {analyticalLoading && (
                <div className="flex items-center gap-2 rounded border border-[#641600]/55 bg-[#0c0503] px-3 py-2 text-[11px] text-[#ebcaa1]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Computing {selectedAnalytical?.shortName} via Earth Engine...</span>
                </div>
              )}

              {selectedAnalytical && !analyticalLoading && analyticalTileUrl && (
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between font-mono text-[10px] text-slate-400">
                    <span>Overlay Opacity</span>
                    <span>{Math.round(analyticalOpacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={analyticalOpacity}
                    onChange={(e) => setAnalyticalOpacity(parseFloat(e.target.value))}
                    className="w-full accent-[#cd9b76]"
                  />
                </div>
              )}

              {selectedAnalytical && !analyticalLoading && !analyticalTileUrl && (
                <DataUnavailableNotice
                  compact
                  layerName={selectedAnalytical.name}
                  sensorOrFormula={analyticalError?.message || selectedAnalytical.formula}
                  onOpenMethodology={onOpenMethodology}
                />
              )}
            </section>

            {/* 4. Vector Boundaries & Live OSM Overpass */}
            <section className="space-y-2">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
                Vector &amp; OSM Overpass Layers
              </div>
              <div className="space-y-1.5">
                {VECTOR_LAYERS.map((vl) => {
                  const state = layerStates[vl.id];
                  return (
                    <div
                      key={vl.id}
                      className="rounded-lg border border-[#641600]/55 bg-[#0c0503]/75 px-3 py-2"
                    >
                      <label className="flex cursor-pointer items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={state.enabled}
                            onChange={() => onToggleVector(vl.id)}
                            className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900 accent-[#cd9b76]"
                          />
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: vl.color }}
                          />
                          <span className="truncate text-xs text-slate-200">
                            {vl.name}
                          </span>
                        </div>
                        {state.status === 'loading' && (
                          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#cd9b76]" />
                        )}
                        {state.status === 'ready' && state.featureCount !== null && (
                          <span className="shrink-0 font-mono text-[10px] text-slate-400">
                            {state.featureCount}
                          </span>
                        )}
                      </label>

                      {state.status === 'error' && vl.id !== 'landmarks' && (
                        <div className="mt-1.5 flex items-center justify-between text-[10px] text-[#ebcaa1]">
                          <span className="truncate">{state.errorMessage}</span>
                          <button
                            type="button"
                            onClick={() => onRetryVector(vl.id as Exclude<VectorLayerId, 'landmarks'>)}
                            className="ml-2 inline-flex shrink-0 items-center gap-1 rounded bg-[#98472b]/15 px-1.5 py-0.5 text-[#ebcaa1] hover:bg-[#98472b]/25"
                          >
                            <RefreshCw className="h-2.5 w-2.5" /> Retry
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* 5. Data Provenance & Transparency */}
            <DataInfoPanel
              boundaryMeta={
                studyBoundaries.boundaries[studyBoundaries.activeAreaForApi]?.metadata
              }
              geeImagery={geeResult}
            />
          </div>
        </div>
      </aside>

      {/* Re-open Drawer Button */}
      {!sidebarOpen && (
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="absolute left-3 top-16 z-20 flex items-center gap-1.5 rounded-lg border border-[#98472b]/50/80 bg-[#140906]/90 px-3 py-2 text-xs font-medium text-slate-200 shadow-lg backdrop-blur-md hover:border-[#cd9b76]/50 sm:top-3"
        >
          <SlidersHorizontal className="h-3.5 w-3.5 text-[#cd9b76]" />
          <span>Layers</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Bottom-Center Compact 3D Timeline Evolution Bar */}
      <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 hidden -translate-x-1/2 lg:block">
        <TimelineEvolutionBar
          activeYear={activeYear}
          onChangeYear={(yr) => {
            onChangeYear(yr);
            if (yr && isTimelinePlaying) {
              const stop = EVOLUTION_STOPS[yr];
              setIs3DMode(true);
              if (yr === 2025) setEnableBuildings(true);
              onSelectLocation(stop.lng, stop.lat, stop.zoom, stop.label);
            }
          }}
          isPlaying={isTimelinePlaying}
          onTogglePlay={() => {
            setIsTimelinePlaying((prev) => {
              const next = !prev;
              if (next) {
                const startYr = activeYear ?? 1990;
                const stop = EVOLUTION_STOPS[startYr];
                setIs3DMode(true);
                onChangeYear(startYr);
                onSelectLocation(stop.lng, stop.lat, stop.zoom, stop.label);
              }
              return next;
            });
          }}
        />
      </div>

      {/* Bottom-Right Dynamic Legend */}
      <div className="explorer-hud gis-glass pointer-events-auto absolute bottom-10 right-2.5 z-10 hidden w-64 rounded-xl p-3 md:block">
        <div className="mb-2 flex items-center justify-between border-b border-[#641600]/55 pb-1.5">
          <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
            Active Legend
          </span>
          <span className="font-mono text-[10px] text-[#cd9b76]">
            {BASEMAPS.find((b) => b.id === basemapId)?.name}
          </span>
        </div>

        <div className="space-y-1.5 text-[11px]">
          {VECTOR_LAYERS.filter((v) => layerStates[v.id].enabled).map((v) => (
            <div key={v.id} className="flex items-center gap-2 text-slate-300">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: v.color }}
              />
              <span className="truncate">{v.name}</span>
            </div>
          ))}

          {selectedAnalytical && (
            <div className="mt-2 border-t border-[#641600]/55 pt-2">
              <div className="mb-1 font-mono text-[10px] text-[#ebcaa1]">
                {selectedAnalytical.shortName}
                {!selectedAnalytical.isAvailable ? ' (Awaiting GEE)' : ''}
              </div>
              {selectedAnalytical.legend.map((stop) => (
                <div
                  key={stop.label}
                  className="flex items-center justify-between gap-2 text-[10px] text-slate-400"
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <span
                      className="h-2 w-2 shrink-0 rounded-xs"
                      style={{ backgroundColor: stop.color }}
                    />
                    {stop.label}
                  </span>
                  {stop.rangeOrCode && (
                    <span className="shrink-0 font-mono text-[9px] text-slate-500">
                      {stop.rangeOrCode}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

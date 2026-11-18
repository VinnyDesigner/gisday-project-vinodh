import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { Clock, Columns2, Layers, Loader2, MoveHorizontal, Satellite } from 'lucide-react';
import { DataInfoPanel } from '../components/DataInfoPanel';
import { DataUnavailableNotice } from '../components/DataUnavailableNotice';
import {
  MapViewport,
  type CameraState,
  type FlyToTarget,
} from '../components/MapViewport';
import { StudyAreaSelector } from '../components/StudyAreaSelector';
import { getHistoricalPeriods } from '../config/gisConfig';
import type { useStudyBoundaries } from '../hooks/useStudyBoundaries';
import { fetchGeeImagery, type GeeServiceError } from '../services/apiService';
import type { GeeImageryResult, HistoricalYear, VectorLayerId } from '../types/gis';

interface HistoricalViewProps {
  activeYear: HistoricalYear;
  onChangeYear: (year: HistoricalYear) => void;
  vectorData: Partial<Record<Exclude<VectorLayerId, 'landmarks'>, GeoJSON.FeatureCollection>>;
  vectorVisibility: Record<VectorLayerId, boolean>;
  studyBoundaries: ReturnType<typeof useStudyBoundaries>;
  flyToTarget: FlyToTarget | null;
  onOpenMethodology: () => void;
}

export function HistoricalView({
  activeYear,
  onChangeYear,
  vectorData,
  vectorVisibility,
  studyBoundaries,
  flyToTarget,
  onOpenMethodology,
}: HistoricalViewProps) {
  const [compareMode, setCompareMode] = useState(false);
  const [leftYear, setLeftYear] = useState<HistoricalYear>(1990);
  const [rightYear, setRightYear] = useState<HistoricalYear>(2020);
  const [swipePercent, setSwipePercent] = useState(50);
  const [opacity, setOpacity] = useState(0.9);
  const [leftSyncCam, setLeftSyncCam] = useState<CameraState | null>(null);
  const [rightSyncCam, setRightSyncCam] = useState<CameraState | null>(null);
  const [geeRevision, setGeeRevision] = useState(0);
  const [geeResult, setGeeResult] = useState<GeeImageryResult | null>(null);
  const [geeError, setGeeError] = useState<GeeServiceError | null>(null);
  const [geeLoading, setGeeLoading] = useState(false);
  const [leftGeeResult, setLeftGeeResult] = useState<GeeImageryResult | null>(null);
  const [rightGeeResult, setRightGeeResult] = useState<GeeImageryResult | null>(null);
  const [rightFallbackBasemap, setRightFallbackBasemap] = useState<
    'esri-imagery' | 'osm-standard'
  >('osm-standard');
  const [nativeZoomTarget, setNativeZoomTarget] = useState<FlyToTarget | null>(
    flyToTarget
  );

  useEffect(() => {
    setNativeZoomTarget(flyToTarget);
  }, [flyToTarget]);

  useEffect(() => {
    const onGeeUpdate = () => setGeeRevision((r) => r + 1);
    window.addEventListener('htt-gee-updated', onGeeUpdate);
    return () => window.removeEventListener('htt-gee-updated', onGeeUpdate);
  }, []);

  useEffect(() => {
    if (compareMode) return;
    let cancelled = false;
    setGeeLoading(true);
    setGeeError(null);
    void fetchGeeImagery(studyBoundaries.activeAreaForApi, activeYear).then(
      ({ data, error }) => {
        if (cancelled) return;
        setGeeLoading(false);
        if (data) setGeeResult(data);
        else if (error) setGeeError(error);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [activeYear, compareMode, studyBoundaries.activeAreaForApi, geeRevision]);

  useEffect(() => {
    if (!compareMode) return;
    let cancelled = false;
    void Promise.all([
      fetchGeeImagery(studyBoundaries.activeAreaForApi, leftYear),
      fetchGeeImagery(studyBoundaries.activeAreaForApi, rightYear),
    ]).then(([leftRes, rightRes]) => {
      if (cancelled) return;
      setLeftGeeResult(leftRes.data?.available ? leftRes.data : null);
      if (rightRes.data?.available) {
        setRightGeeResult(rightRes.data);
      } else if (rightYear === 2020) {
        setRightGeeResult({
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
        setRightGeeResult(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [compareMode, leftYear, rightYear, studyBoundaries.activeAreaForApi]);

  const periods = getHistoricalPeriods();
  const stageRef = useRef<HTMLDivElement>(null);
  const asideRef = useRef<HTMLElement>(null);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.hist-stagger', {
        x: -16,
        opacity: 0,
        duration: 0.5,
        stagger: 0.06,
        ease: 'power2.out',
        clearProps: 'transform',
      });
    }, asideRef);
    return () => ctx.revert();
  }, []);

  const period = periods.find((p) => p.year === activeYear) ?? periods[0];
  const leftPeriod = periods.find((p) => p.year === leftYear) ?? periods[0];
  const rightPeriod =
    periods.find((p) => p.year === rightYear) ?? periods[periods.length - 1];

  const updateSwipeFromClientX = (clientX: number) => {
    if (!stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setSwipePercent(Math.min(92, Math.max(8, pct)));
  };

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col lg:flex-row">
      {/* Left Metadata & Epoch Selector Panel */}
      <aside ref={asideRef} className="gis-glass w-full shrink-0 border-b border-[#641600]/55/80 p-5 lg:w-[430px] lg:border-b-0 lg:border-r lg:overflow-y-auto">
        <div className="hist-stagger flex items-center justify-between">
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-[#dab089]">
            <Clock className="h-3.5 w-3.5" />
            <span>Historical Satellite Archive</span>
          </div>

          <div className="inline-flex rounded-lg border border-[#641600]/55 bg-[#0c0503] p-0.5">
            <button
              type="button"
              onClick={() => setCompareMode(false)}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                !compareMode
                  ? 'bg-[#98472b]/20 text-[#ebcaa1]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="h-3 w-3" />
              Single
            </button>
            <button
              type="button"
              onClick={() => setCompareMode(true)}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                compareMode
                  ? 'bg-[#98472b]/20 text-[#ebcaa1]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Columns2 className="h-3 w-3" />
              Swipe
            </button>
          </div>
        </div>

        <h1 className="mt-2 font-serif text-3xl text-slate-50">
          Hyderabad: 1990 – 2025
        </h1>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
          Comparable dry-season (Jan–Mar) cloud-masked composites from Landsat 5/8/9
          clipped to the selected TGRAC study area. No year is ever substituted for another.
        </p>

        <div className="mt-4">
          <StudyAreaSelector
            mode={studyBoundaries.studyAreaMode}
            onChange={studyBoundaries.setStudyAreaMode}
          />
        </div>

        {!compareMode ? (
          <>
            {/* Single Epoch Selector */}
            <div className="mt-5 grid grid-cols-5 gap-1.5">
              {periods.map((p) => {
                const active = p.year === activeYear;
                return (
                  <button
                    key={p.year}
                    type="button"
                    onClick={() => onChangeYear(p.year)}
                    className={`rounded-lg border py-2 font-mono text-xs font-medium transition-all ${
                      active
                        ? 'border-[#cd9b76] bg-[#98472b]/20 text-[#ebcaa1] shadow-sm'
                        : 'border-[#641600]/55 bg-[#0c0503] text-slate-400 hover:border-[#98472b]/50 hover:text-slate-200'
                    }`}
                  >
                    {p.year}
                  </button>
                );
              })}
            </div>

            {/* Active Epoch Provenance Card */}
            <div className="mt-5 space-y-3 rounded-xl border border-[#641600]/55 bg-[#0c0503] p-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xl font-semibold text-[#dab089]">
                  {period.year} Epoch
                </span>
                <span
                  className={`rounded px-2 py-0.5 font-mono text-[10px] ${
                    period.isAvailable
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : 'bg-[#98472b]/15 text-[#ebcaa1]'
                  }`}
                >
                  {period.isAvailable ? 'GEE CONNECTED' : 'GEE REQUIRED'}
                </span>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-1.5 text-[#ebcaa1]">
                  <Satellite className="h-3.5 w-3.5 shrink-0" />
                  <span className="font-medium">{period.spacecraft}</span>
                </div>
                <div className="font-mono text-[11px] text-slate-300">
                  Source: {period.source}
                </div>
                <div className="font-mono text-[11px] text-slate-400">
                  Collection: {period.collectionId}
                </div>
                <div className="font-mono text-[11px] text-slate-400">
                  Acquisition: {period.acquisitionWindow}
                </div>
                <div className="font-mono text-[11px] text-slate-400">
                  Resolution: {period.resolutionMeters}m • Mask: {period.cloudMasking}
                </div>
                <div className="font-mono text-[11px] text-slate-500">
                  Bands: {period.bandsUsed}
                </div>
              </div>

              <p className="border-t border-[#641600]/55/80 pt-3 text-xs leading-relaxed text-slate-300">
                {period.notes}
              </p>

              {period.isAvailable && (
                <div className="border-t border-[#641600]/55/80 pt-3">
                  <div className="mb-1 flex justify-between font-mono text-[10px] text-slate-400">
                    <span>Blend with Current Esri Imagery</span>
                    <span>{Math.round(opacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={opacity}
                    onChange={(e) => setOpacity(parseFloat(e.target.value))}
                    className="w-full accent-[#ebcaa1]"
                  />
                </div>
              )}
            </div>

            {geeLoading && (
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-[#641600]/55 bg-[#0c0503] px-3 py-2 text-xs text-[#ebcaa1]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>
                  Generating {activeYear} {studyBoundaries.activeAreaForApi.toUpperCase()} composite via Google Earth Engine...
                </span>
              </div>
            )}

            {!geeLoading && !period.isAvailable && !geeResult?.available && (
              <div className="mt-4">
                <DataUnavailableNotice
                  layerName={`${period.year} Historical Composite`}
                  sensorOrFormula={geeError?.message || `${period.sensor} • ${period.resolutionMeters}m`}
                  onOpenMethodology={onOpenMethodology}
                />
              </div>
            )}

            <div className="mt-4">
              <DataInfoPanel
                boundaryMeta={
                  studyBoundaries.boundaries[studyBoundaries.activeAreaForApi]?.metadata
                }
                geeImagery={geeResult}
              />
            </div>
          </>
        ) : (
          /* Swipe Comparison Controls */
          <div className="mt-5 space-y-4">
            <div className="rounded-xl border border-[#641600]/55 bg-[#0c0503] p-4 space-y-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-[#cd9b76]">
                Left Pane (Before)
              </div>
              <div className="grid grid-cols-5 gap-1">
                {periods.map((p) => (
                  <button
                    key={`left-${p.year}`}
                    type="button"
                    onClick={() => setLeftYear(p.year)}
                    className={`rounded border py-1.5 font-mono text-[11px] ${
                      leftYear === p.year
                        ? 'border-[#ebcaa1] bg-[#98472b]/20 text-[#ebcaa1]'
                        : 'border-[#641600]/55 text-slate-400 hover:border-[#98472b]/50'
                    }`}
                  >
                    {p.year}
                  </button>
                ))}
              </div>
              <div className="font-mono text-[11px] text-slate-400">
                {leftPeriod.sensor} ({leftPeriod.resolutionMeters}m) •{' '}
                {leftPeriod.isAvailable ? 'GEE Live' : 'GEE Not Configured'}
              </div>
            </div>

            <div className="rounded-xl border border-[#641600]/55 bg-[#0c0503] p-4 space-y-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-[#dab089]">
                Right Pane (After)
              </div>
              <div className="grid grid-cols-5 gap-1">
                {periods.map((p) => (
                  <button
                    key={`right-${p.year}`}
                    type="button"
                    onClick={() => setRightYear(p.year)}
                    className={`rounded border py-1.5 font-mono text-[11px] ${
                      rightYear === p.year
                        ? 'border-[#cd9b76] bg-[#98472b]/20 text-[#ebcaa1]'
                        : 'border-[#641600]/55 text-slate-400 hover:border-[#98472b]/50'
                    }`}
                  >
                    {p.year}
                  </button>
                ))}
              </div>
              <div className="font-mono text-[11px] text-slate-400">
                {rightPeriod.sensor} ({rightPeriod.resolutionMeters}m) •{' '}
                {rightPeriod.isAvailable ? 'GEE Live' : 'GEE Not Configured'}
              </div>
            </div>

            {(!leftPeriod.isAvailable || !rightPeriod.isAvailable) && (
              <DataUnavailableNotice
                compact
                layerName={`${!leftPeriod.isAvailable ? leftYear : ''}${
                  !leftPeriod.isAvailable && !rightPeriod.isAvailable ? ' & ' : ''
                }${!rightPeriod.isAvailable ? rightYear : ''} GEE Composites`}
                sensorOrFormula="Drag the map divider to compare synchronized views; Esri World Imagery remains active as spatial reference."
                onOpenMethodology={onOpenMethodology}
              />
            )}
          </div>
        )}
      </aside>

      {/* Map Canvas (Single or Synchronized Swipe Comparison) */}
      <div
        ref={stageRef}
        onPointerMove={(e) => {
          if (isDraggingRef.current && compareMode) {
            updateSwipeFromClientX(e.clientX);
          }
        }}
        onPointerUp={() => {
          isDraggingRef.current = false;
        }}
        onPointerLeave={() => {
          isDraggingRef.current = false;
        }}
        className="relative h-[60vh] flex-1 select-none overflow-hidden lg:h-[calc(100vh-3.5rem)]"
      >
        {!compareMode ? (
          <MapViewport
            basemapId="esri-imagery"
            activeYear={activeYear}
            historicalOpacity={opacity}
            dynamicGeeTileUrl={geeResult?.available ? geeResult.tileUrl : null}
            activeAnalyticalLayer={null}
            analyticalOpacity={0.75}
            hmdaBoundary={studyBoundaries.boundaries.hmda?.geojson ?? null}
            ghmcBoundary={studyBoundaries.boundaries.ghmc?.geojson ?? null}
            showHmdaBoundary={studyBoundaries.showHmda}
            showGhmcBoundary={studyBoundaries.showGhmc}
            vectorData={vectorData}
            vectorVisibility={vectorVisibility}
            flyToTarget={flyToTarget}
          />
        ) : (
          <>
            {/* Left Map (Base) */}
            <div className="absolute inset-0">
              <MapViewport
                basemapId="esri-imagery"
                activeYear={leftYear}
                historicalOpacity={0.95}
                dynamicGeeTileUrl={leftGeeResult?.tileUrl ?? null}
                activeAnalyticalLayer={null}
                analyticalOpacity={0.75}
                hmdaBoundary={studyBoundaries.boundaries.hmda?.geojson ?? null}
                ghmcBoundary={studyBoundaries.boundaries.ghmc?.geojson ?? null}
                showHmdaBoundary={studyBoundaries.showHmda}
                showGhmcBoundary={studyBoundaries.showGhmc}
                vectorData={vectorData}
                vectorVisibility={vectorVisibility}
                flyToTarget={nativeZoomTarget}
                syncCameraState={leftSyncCam}
                onCameraMove={(cam) => setRightSyncCam(cam)}
              />
            </div>

            {/* Right Map (Clipped by Swipe Slider) */}
            <div
              className="absolute inset-0"
              style={{ clipPath: `inset(0 0 0 ${swipePercent}%)` }}
            >
              <MapViewport
                basemapId={rightGeeResult?.tileUrl ? 'esri-imagery' : rightFallbackBasemap}
                activeYear={rightYear}
                historicalOpacity={0.95}
                dynamicGeeTileUrl={rightGeeResult?.tileUrl ?? null}
                activeAnalyticalLayer={null}
                analyticalOpacity={0.75}
                hmdaBoundary={studyBoundaries.boundaries.hmda?.geojson ?? null}
                ghmcBoundary={studyBoundaries.boundaries.ghmc?.geojson ?? null}
                showHmdaBoundary={studyBoundaries.showHmda}
                showGhmcBoundary={studyBoundaries.showGhmc}
                vectorData={vectorData}
                vectorVisibility={vectorVisibility}
                flyToTarget={nativeZoomTarget}
                hideControls
                syncCameraState={rightSyncCam}
                onCameraMove={(cam) => setLeftSyncCam(cam)}
              />
            </div>

            {/* Left & Right Floating Provenance Badges */}
            <div className="pointer-events-none absolute left-3 top-3 z-20 rounded-lg border border-[#cd9b76]/40 bg-[#0c0503]/90 px-3 py-1.5 backdrop-blur-md">
              <div className="font-mono text-xs font-semibold text-[#ebcaa1]">
                {leftPeriod.year} • {leftPeriod.sensor} ({leftPeriod.resolutionMeters}m)
              </div>
              <div className="font-mono text-[10px] text-slate-400">
                {leftGeeResult?.tileUrl
                  ? leftGeeResult.compositePeriod
                  : 'Esri Reference (GEE Not Configured)'}
              </div>
            </div>

            <div className="pointer-events-auto absolute right-14 top-3 z-20 rounded-lg border border-[#98472b]/40 bg-[#0c0503]/90 px-3 py-1.5 text-right backdrop-blur-md">
              <div className="font-mono text-xs font-semibold text-[#ebcaa1]">
                {rightGeeResult?.tileUrl
                  ? `${rightYear} • ${rightGeeResult.sensor}`
                  : `${rightPeriod.year} • ${rightFallbackBasemap === 'osm-standard' ? 'OSM Reference' : 'Esri Reference'}`}
              </div>
              <div className="flex items-center justify-end gap-2 font-mono text-[10px] text-slate-400">
                <span>
                  {rightGeeResult?.tileUrl
                    ? `${rightGeeResult.compositePeriod} (best at z10–13)`
                    : 'GEE Not Configured'}
                </span>
                {rightGeeResult?.tileUrl && (leftSyncCam?.zoom ?? 11.2) > 14 && (
                  <button
                    type="button"
                    onClick={() =>
                      setNativeZoomTarget({
                        lng: leftSyncCam?.lng ?? 78.4747,
                        lat: leftSyncCam?.lat ?? 17.415,
                        zoom: 12.8,
                        nonce: Date.now(),
                      })
                    }
                    className="rounded border border-[#ebcaa1]/50 bg-[#98472b]/15 px-1.5 py-0.5 text-[9px] text-[#dab089] hover:bg-[#98472b]/25"
                  >
                    Native z12.8
                  </button>
                )}
                {!rightGeeResult?.tileUrl && (
                  <button
                    type="button"
                    onClick={() =>
                      setRightFallbackBasemap((b) =>
                        b === 'osm-standard' ? 'esri-imagery' : 'osm-standard'
                      )
                    }
                    className="rounded border border-[#cd9b76]/40 px-1.5 py-0.5 text-[9px] text-[#ebcaa1] hover:bg-[#98472b]/20"
                  >
                    {rightFallbackBasemap === 'osm-standard' ? 'Use Esri' : 'Use OSM'}
                  </button>
                )}
              </div>
            </div>

            {/* Draggable Vertical Swipe Divider */}
            <div
              role="slider"
              aria-label="Swipe comparison divider"
              aria-valuemin={8}
              aria-valuemax={92}
              aria-valuenow={Math.round(swipePercent)}
              tabIndex={0}
              onPointerDown={(e) => {
                isDraggingRef.current = true;
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              }}
              style={{ left: `${swipePercent}%` }}
              className="absolute bottom-0 top-0 z-30 w-0.5 -translate-x-1/2 cursor-ew-resize bg-[#ebcaa1] shadow-[0_0_14px_rgba(34,211,238,0.8)]"
            >
              <div className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-cyan-300 bg-[#140906] text-[#ebcaa1] shadow-xl">
                <MoveHorizontal className="h-4 w-4" />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

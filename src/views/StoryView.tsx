import { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import {
  ArrowUpRight,
  BarChart3,
  BookOpenCheck,
  ChevronLeft,
  ChevronRight,
  Compass,
  FileText,
  HelpCircle,
  Layers,
  MapPin,
  Maximize2,
  Minimize2,
  Mountain,
  Pause,
  Play,
  RotateCw,
} from 'lucide-react';
import { LiveVectorAnalytics } from '../components/LiveVectorAnalytics';
import { MapViewport, type FlyToTarget } from '../components/MapViewport';
import { HYDERABAD_LANDMARKS } from '../config/gisConfig';
import { STORY_CHAPTERS, type StoryChapter } from '../config/storyChapters';
import type { useStudyBoundaries } from '../hooks/useStudyBoundaries';
import {
  computeGeoJsonAreaKm2,
  computeGeoJsonLengthKm,
  getTopNamedPolygonsKm2,
} from '../services/analysisStatsService';
import type { BasemapId, VectorLayerId } from '../types/gis';

interface StoryViewProps {
  vectorData: Partial<Record<Exclude<VectorLayerId, 'landmarks'>, GeoJSON.FeatureCollection>>;
  studyBoundaries: ReturnType<typeof useStudyBoundaries>;
  onEnsureVector: (id: VectorLayerId) => void;
  onOpenInExplorer: (chapter: StoryChapter) => void;
}

function getFeatureCenter(
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

export function StoryView({
  vectorData,
  studyBoundaries,
  onEnsureVector,
  onOpenInExplorer,
}: StoryViewProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [panelTab, setPanelTab] = useState<'story' | 'analytics'>('story');
  const [isPlaying, setIsPlaying] = useState(false);
  const [cardMinimized, setCardMinimized] = useState(false);
  const [failedPhotos, setFailedPhotos] = useState<Record<string, boolean>>({});
  const [customFlyTarget, setCustomFlyTarget] = useState<FlyToTarget | null>(null);
  const [show2020Mosaic, setShow2020Mosaic] = useState(true);
  const [basemapOverride, setBasemapOverride] = useState<BasemapId | null>(null);
  const [enable3DOverride, setEnable3DOverride] = useState<boolean | null>(null);
  const [bearingOffset, setBearingOffset] = useState(0);
  const [isOrbiting, setIsOrbiting] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const activeChapter = STORY_CHAPTERS[activeIndex] ?? STORY_CHAPTERS[0];

  // GSAP smooth card entrance on chapter switch
  useEffect(() => {
    if (!cardRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        cardRef.current,
        { y: 14, opacity: 0.4 },
        { y: 0, opacity: 1, duration: 0.45, ease: 'power3.out', clearProps: 'transform' }
      );
    });
    return () => ctx.revert();
  }, [activeIndex]);

  // Auto-play documentary tour
  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % STORY_CHAPTERS.length);
    }, 7500);
    return () => window.clearInterval(timer);
  }, [isPlaying]);

  // Subtle 3D orbital camera sweep when Orbit is toggled
  useEffect(() => {
    if (!isOrbiting) return;
    const timer = window.setInterval(() => {
      setBearingOffset((b) => (b + 12) % 360);
    }, 900);
    return () => window.clearInterval(timer);
  }, [isOrbiting]);

  // Ensure vector layers required by the active chapter or Analytics tab are loaded
  useEffect(() => {
    for (const vl of activeChapter.vectorLayers) {
      onEnsureVector(vl);
    }
    if (panelTab === 'analytics') {
      onEnsureVector('osm-waterbodies');
      onEnsureVector('osm-vegetation');
      onEnsureVector('osm-roads');
    } else {
      if (activeChapter.metricFocus === 'water') onEnsureVector('osm-waterbodies');
      if (activeChapter.metricFocus === 'growth-geo') onEnsureVector('osm-roads');
      if (activeChapter.metricFocus === 'climate') onEnsureVector('osm-vegetation');
    }
  }, [activeChapter, panelTab, onEnsureVector]);

  useEffect(() => {
    setCustomFlyTarget(null);
    setEnable3DOverride(null);
    setBasemapOverride(null);
    setBearingOffset(0);
  }, [activeIndex]);

  const flyToTarget: FlyToTarget = useMemo(
    () =>
      customFlyTarget ?? {
        lng: activeChapter.camera.lng,
        lat: activeChapter.camera.lat,
        zoom: activeChapter.camera.zoom,
        pitch: activeChapter.camera.pitch,
        bearing: activeChapter.camera.bearing + bearingOffset,
        nonce: activeIndex + 1 + bearingOffset * 0.001,
      },
    [activeChapter, activeIndex, customFlyTarget, bearingOffset]
  );

  const chapterVectorVisibility: Record<VectorLayerId, boolean> = useMemo(
    () => ({
      landmarks: activeChapter.vectorLayers.includes('landmarks'),
      'ghmc-boundary': activeChapter.vectorLayers.includes('ghmc-boundary'),
      'osm-waterbodies': activeChapter.vectorLayers.includes('osm-waterbodies'),
      'osm-vegetation': activeChapter.vectorLayers.includes('osm-vegetation'),
      'osm-roads': activeChapter.vectorLayers.includes('osm-roads'),
    }),
    [activeChapter]
  );

  const flyToPoint = (
    lng: number,
    lat: number,
    zoom: number,
    label: string,
    pitch = 42
  ) => {
    setCustomFlyTarget({
      lng,
      lat,
      zoom,
      pitch,
      bearing: -14,
      label,
      nonce: Date.now(),
    });
  };

  const hmdaAreaKm2 = useMemo(
    () => computeGeoJsonAreaKm2(studyBoundaries.boundaries.hmda?.geojson),
    [studyBoundaries.boundaries.hmda]
  );
  const ghmcAreaKm2 = useMemo(
    () => computeGeoJsonAreaKm2(studyBoundaries.boundaries.ghmc?.geojson),
    [studyBoundaries.boundaries.ghmc]
  );
  const osmWaterKm2 = useMemo(
    () => computeGeoJsonAreaKm2(vectorData['osm-waterbodies']),
    [vectorData]
  );
  const osmVegKm2 = useMemo(
    () => computeGeoJsonAreaKm2(vectorData['osm-vegetation']),
    [vectorData]
  );
  const osmRoadsKm = useMemo(
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

  const sentinel2020Tile =
    activeChapter.id === 'land-transformation' && show2020Mosaic
      ? 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg'
      : null;

  const effectiveBasemap = basemapOverride ?? activeChapter.basemapId;
  const is3D = enable3DOverride ?? Boolean(activeChapter.enable3DBuildings || activeChapter.camera.pitch > 25);
  const maxLake = Math.max(...topLakes.map((l) => l.areaKm2), 1);
  const maxPark = Math.max(...topParks.map((p) => p.areaKm2), 1);

  return (
    <div className="relative h-[calc(100vh-3.5rem)] w-full overflow-hidden bg-[#0c0503]">
      {/* Full-Viewport Interactive 3D Map Canvas */}
      <MapViewport
        basemapId={effectiveBasemap}
        is3DMode={is3D}
        enableTerrain={is3D}
        enableBuildings={Boolean(activeChapter.enable3DBuildings || enable3DOverride)}
        activeYear={activeChapter.activeYear}
        dynamicGeeTileUrl={sentinel2020Tile}
        historicalOpacity={0.9}
        activeAnalyticalLayer={activeChapter.activeAnalytical}
        analyticalOpacity={0.78}
        hmdaBoundary={studyBoundaries.boundaries.hmda?.geojson ?? null}
        ghmcBoundary={studyBoundaries.boundaries.ghmc?.geojson ?? null}
        showHmdaBoundary
        showGhmcBoundary
        vectorData={vectorData}
        vectorVisibility={chapterVectorVisibility}
        flyToTarget={flyToTarget}
      />

      {/* Top-Right Quick Map Style & 3D Orbit Controls */}
      <div className="gis-glass pointer-events-auto absolute right-14 top-3 z-20 hidden items-center gap-1.5 rounded-xl px-2.5 py-1.5 sm:flex">
        {(['esri-imagery', 'osm-standard', 'carto-dark'] as BasemapId[]).map((bm) => (
          <button
            key={bm}
            type="button"
            onClick={() => setBasemapOverride(bm)}
            className={`rounded-md px-2 py-1 font-mono text-[10px] transition-colors ${
              effectiveBasemap === bm
                ? 'bg-[#98472b]/20 text-[#ebcaa1]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {bm === 'esri-imagery' ? 'Satellite' : bm === 'osm-standard' ? 'OSM' : 'Dark'}
          </button>
        ))}
        <div className="h-3.5 w-px bg-slate-700" />
        <button
          type="button"
          onClick={() => setEnable3DOverride((v) => !(v ?? is3D))}
          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[10px] ${
            is3D ? 'bg-[#98472b]/20 text-[#ebcaa1]' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Mountain className="h-3 w-3" />
          <span>{is3D ? '3D' : '2D'}</span>
        </button>
        <button
          type="button"
          onClick={() => setIsOrbiting((o) => !o)}
          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[10px] ${
            isOrbiting ? 'bg-[#98472b]/25 text-[#dab089]' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <RotateCw className={`h-3 w-3 ${isOrbiting ? 'animate-spin' : ''}`} />
          <span>Orbit</span>
        </button>
      </div>

      {/* Left Floating Luminous Chapter Deck */}
      <div className="pointer-events-none absolute bottom-20 left-3 top-3 z-20 flex w-[calc(100%-1.5rem)] max-w-[440px] flex-col">
        <div
          ref={cardRef}
          className="gis-glass pointer-events-auto flex max-h-full flex-col overflow-hidden rounded-2xl"
        >
          {/* Card Header */}
          <div className="flex items-center justify-between border-b border-[#641600]/55/80 px-4 py-3">
            <div className="flex items-center gap-2">
              <BookOpenCheck className="h-4 w-4 text-[#cd9b76]" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-[#ebcaa1]">
                Chapter {activeChapter.number} of 08
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsPlaying((p) => !p)}
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[10px] ${
                  isPlaying
                    ? 'bg-[#98472b]/20 text-[#ebcaa1]'
                    : 'bg-[#98472b]/15 text-[#ebcaa1] hover:bg-[#98472b]/25'
                }`}
              >
                {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                <span>{isPlaying ? 'Pause' : 'Auto Tour'}</span>
              </button>
              <button
                type="button"
                onClick={() => setCardMinimized((m) => !m)}
                aria-label={cardMinimized ? 'Expand chapter' : 'Minimize chapter'}
                className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              >
                {cardMinimized ? (
                  <Maximize2 className="h-3.5 w-3.5" />
                ) : (
                  <Minimize2 className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>

          {!cardMinimized && (
            <>
              {/* Story | Analytics Tab Switcher */}
              <div className="grid grid-cols-2 gap-1 border-b border-[#641600]/55/80 bg-[#0c0503]/60 px-4 py-2">
                <button
                  type="button"
                  onClick={() => setPanelTab('story')}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors ${
                    panelTab === 'story'
                      ? 'bg-[#98472b]/20 text-[#dab089] border border-[#cd9b76]/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>Story</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPanelTab('analytics')}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors ${
                    panelTab === 'analytics'
                      ? 'bg-[#98472b]/20 text-amber-200 border border-[#98472b]/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                  <span>Analytics</span>
                </button>
              </div>

              {panelTab === 'analytics' ? (
                <div className="flex-1 space-y-4 overflow-y-auto p-4">
                  {/* HMDA vs GHMC Donut Comparison */}
                  <div className="rounded-xl border border-[#641600]/55 bg-[#0c0503] p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-100">
                        HMDA vs GHMC Area Share
                      </span>
                      <span className="font-mono text-[10px] text-[#cd9b76]">
                        TGRAC Official
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <svg viewBox="0 0 100 100" className="h-24 w-24 shrink-0">
                        <circle
                          cx="50"
                          cy="50"
                          r="36"
                          fill="transparent"
                          stroke="#00D5FF"
                          strokeWidth="12"
                        />
                        <circle
                          cx="50"
                          cy="50"
                          r="36"
                          fill="transparent"
                          stroke="#FFB547"
                          strokeWidth="12"
                          strokeDasharray={`${
                            hmdaAreaKm2 && ghmcAreaKm2
                              ? (ghmcAreaKm2 / hmdaAreaKm2) * (2 * Math.PI * 36)
                              : 20
                          } ${2 * Math.PI * 36}`}
                          transform="rotate(-90 50 50)"
                        />
                        <text
                          x="50"
                          y="48"
                          textAnchor="middle"
                          className="fill-slate-100 font-mono text-[10px] font-semibold"
                        >
                          {hmdaAreaKm2 && ghmcAreaKm2
                            ? `${((ghmcAreaKm2 / hmdaAreaKm2) * 100).toFixed(1)}%`
                            : '—'}
                        </text>
                        <text
                          x="50"
                          y="60"
                          textAnchor="middle"
                          className="fill-slate-400 font-mono text-[7px]"
                        >
                          GHMC/HMDA
                        </text>
                      </svg>
                      <div className="space-y-1.5 font-mono text-[11px]">
                        <div className="text-[#00D5FF]">
                          HMDA: {hmdaAreaKm2 ? `${hmdaAreaKm2.toFixed(1)} km²` : '—'}
                        </div>
                        <div className="text-[#FFB547]">
                          GHMC: {ghmcAreaKm2 ? `${ghmcAreaKm2.toFixed(1)} km²` : '—'}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Measured WGS84 geodesic polygon area
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Live OSM Charts (Lakes, Parks, Arterials) */}
                  <LiveVectorAnalytics
                    hmdaGeoJson={studyBoundaries.boundaries.hmda?.geojson}
                    ghmcGeoJson={studyBoundaries.boundaries.ghmc?.geojson}
                    vectorData={vectorData}
                    onFlyTo={(lng, lat, zoom, label) =>
                      flyToPoint(lng, lat, zoom, label)
                    }
                  />
                </div>
              ) : (
                <div className="flex-1 space-y-3.5 overflow-y-auto p-4">
              <div>
                <h2 className="font-serif text-3xl leading-tight text-slate-50">
                  {activeChapter.title}
                </h2>
                <div className="text-xs font-medium text-[#ebcaa1]">
                  {activeChapter.subtitle}
                </div>
              </div>

              {/* Research Question */}
              <div className="rounded-lg border border-[#cd9b76]/25 bg-[#0c0503]/85 p-3">
                <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-[#cd9b76]">
                  <HelpCircle className="h-3 w-3" />
                  <span>Research Question</span>
                </div>
                <p className="mt-1 text-xs font-medium leading-relaxed text-slate-100">
                  {activeChapter.researchQuestion}
                </p>
              </div>

              {activeChapter.photo && !failedPhotos[activeChapter.id] && (
                <div className="overflow-hidden rounded-xl border border-[#641600]/55 bg-[#0c0503]">
                  <img
                    src={activeChapter.photo.url}
                    alt={activeChapter.photo.caption}
                    onError={() =>
                      setFailedPhotos((prev) => ({ ...prev, [activeChapter.id]: true }))
                    }
                    className="h-36 w-full object-cover"
                  />
                  <div className="flex items-center justify-between gap-2 px-2.5 py-1 text-[10px] text-slate-400">
                    <span className="truncate">{activeChapter.photo.caption}</span>
                    <span className="shrink-0 font-mono text-slate-500">
                      {activeChapter.photo.credit}
                    </span>
                  </div>
                </div>
              )}

              <p className="text-xs leading-relaxed text-slate-300">
                {activeChapter.narrative}
              </p>

              {/* Interactive Chapter Data Widget */}
              <div className="rounded-xl border border-[#641600]/55 bg-[#0c0503]/90 p-3 space-y-2.5">
                {activeChapter.metricFocus === 'core' && (
                  <div className="flex flex-wrap gap-1.5">
                    {HYDERABAD_LANDMARKS.filter((l) =>
                      ['charminar', 'golconda', 'hussain-sagar'].includes(l.id)
                    ).map((lm) => (
                      <button
                        key={lm.id}
                        type="button"
                        onClick={() =>
                          flyToPoint(
                            lm.coordinates[0],
                            lm.coordinates[1],
                            lm.zoom,
                            lm.name
                          )
                        }
                        className="inline-flex items-center gap-1 rounded-md border border-[#98472b]/50 bg-[#1e0e09] px-2.5 py-1 text-[11px] text-slate-200 hover:border-[#ebcaa1]/60 hover:text-[#ebcaa1]"
                      >
                        <MapPin className="h-3 w-3 text-[#cd9b76]" />
                        <span>{lm.name.split(' ')[0]}</span>
                      </button>
                    ))}
                  </div>
                )}

                {activeChapter.metricFocus === 'urban' && (
                  <div className="space-y-1.5 font-mono text-[11px]">
                    <div>
                      <div className="flex justify-between text-slate-300">
                        <span className="text-[#00D5FF]">HMDA Region</span>
                        <span>{hmdaAreaKm2 ? `${hmdaAreaKm2.toFixed(1)} km²` : '—'}</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full rounded bg-slate-800">
                        <div className="h-1.5 w-full rounded bg-[#00D5FF]" />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-slate-300">
                        <span className="text-[#FFB547]">GHMC Core</span>
                        <span>{ghmcAreaKm2 ? `${ghmcAreaKm2.toFixed(1)} km²` : '—'}</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full rounded bg-slate-800">
                        <div
                          className="h-1.5 rounded bg-[#FFB547]"
                          style={{
                            width:
                              hmdaAreaKm2 && ghmcAreaKm2
                                ? `${Math.max(4, (ghmcAreaKm2 / hmdaAreaKm2) * 100)}%`
                                : '10%',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {activeChapter.metricFocus === 'conversion' && (
                  <button
                    type="button"
                    onClick={() => setShow2020Mosaic((v) => !v)}
                    className="w-full rounded border border-[#cd9b76]/40 bg-[#98472b]/15 px-3 py-1.5 font-mono text-[11px] text-[#dab089] hover:bg-[#98472b]/25"
                  >
                    {show2020Mosaic
                      ? 'Toggle: 2020 Sentinel-2 (10m) Active'
                      : 'Toggle: Current Esri Imagery Active'}
                  </button>
                )}

                {activeChapter.metricFocus === 'water' && (
                  <div className="space-y-2">
                    <div className="flex justify-between font-mono text-[10px] text-[#cd9b76]">
                      <span>LARGEST LAKES (CLICK TO FLY)</span>
                      <span>
                        {osmWaterKm2 !== null
                          ? `${osmWaterKm2.toFixed(1)} km²`
                          : vectorData['osm-waterbodies']
                            ? '0 km²'
                            : 'Querying OSM...'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { name: 'Hussain Sagar', lng: 78.4738, lat: 17.4239, z: 13.8 },
                        { name: 'Osman Sagar', lng: 78.2995, lat: 17.3767, z: 12.8 },
                        { name: 'Himayat Sagar', lng: 78.3614, lat: 17.3342, z: 12.8 },
                        { name: 'Durgam Cheruvu', lng: 78.3895, lat: 17.4292, z: 14.5 },
                      ].map((lk) => (
                        <button
                          key={lk.name}
                          type="button"
                          onClick={() => flyToPoint(lk.lng, lk.lat, lk.z, lk.name)}
                          className="inline-flex items-center gap-1 rounded border border-[#98472b]/50 bg-[#1e0e09] px-2 py-1 text-[10px] text-[#ebcaa1] hover:border-[#ebcaa1]"
                        >
                          <MapPin className="h-2.5 w-2.5" />
                          <span>{lk.name}</span>
                        </button>
                      ))}
                    </div>
                    {topLakes.map((lake) => (
                      <button
                        key={lake.name}
                        type="button"
                        onClick={() => {
                          const c = getFeatureCenter(
                            vectorData['osm-waterbodies'],
                            lake.name
                          );
                          if (c) flyToPoint(c[0], c[1], 13.5, lake.name);
                        }}
                        className="block w-full text-left group"
                      >
                        <div className="flex justify-between text-[11px] text-slate-300 group-hover:text-[#ebcaa1]">
                          <span className="truncate">{lake.name}</span>
                          <span className="font-mono">{lake.areaKm2.toFixed(2)} km²</span>
                        </div>
                        <div className="mt-0.5 h-1.5 w-full rounded bg-slate-800">
                          <div
                            className="h-1.5 rounded bg-[#ebcaa1]"
                            style={{ width: `${(lake.areaKm2 / maxLake) * 100}%` }}
                          />
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {activeChapter.metricFocus === 'growth-geo' && (
                  <div className="space-y-2">
                    <div className="flex justify-between font-mono text-[10px] text-[#ebcaa1]">
                      <span>ARTERIALS &amp; ORR (OSM)</span>
                      <span>{osmRoadsKm !== null ? `${osmRoadsKm.toFixed(1)} km` : '...'}</span>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => flyToPoint(78.4294, 17.2403, 13, 'RGIA Shamshabad')}
                        className="flex-1 rounded border border-[#98472b]/50 bg-[#1e0e09] py-1 text-[11px] text-slate-200 hover:border-[#cd9b76]/60"
                      >
                        RGIA Airport
                      </button>
                      <button
                        type="button"
                        onClick={() => flyToPoint(78.348, 17.44, 13.2, 'ORR Gachibowli')}
                        className="flex-1 rounded border border-[#98472b]/50 bg-[#1e0e09] py-1 text-[11px] text-slate-200 hover:border-[#cd9b76]/60"
                      >
                        ORR West
                      </button>
                    </div>
                  </div>
                )}

                {activeChapter.metricFocus === 'climate' && (
                  <div className="space-y-2">
                    <div className="flex justify-between font-mono text-[10px] text-emerald-400">
                      <span>GREEN RESERVES (CLICK TO FLY)</span>
                      <span>
                        {osmVegKm2 !== null
                          ? `${osmVegKm2.toFixed(1)} km²`
                          : vectorData['osm-vegetation']
                            ? '0 km²'
                            : 'Querying OSM...'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { name: 'KBR National Park', lng: 78.4214, lat: 17.4156, z: 14.5 },
                        { name: 'Mrugavani Park', lng: 78.3472, lat: 17.3506, z: 13.8 },
                        { name: 'Vanasthali Park', lng: 78.5917, lat: 17.3414, z: 13.8 },
                      ].map((pk) => (
                        <button
                          key={pk.name}
                          type="button"
                          onClick={() => flyToPoint(pk.lng, pk.lat, pk.z, pk.name)}
                          className="inline-flex items-center gap-1 rounded border border-[#98472b]/50 bg-[#1e0e09] px-2 py-1 text-[10px] text-emerald-300 hover:border-emerald-400"
                        >
                          <MapPin className="h-2.5 w-2.5" />
                          <span>{pk.name}</span>
                        </button>
                      ))}
                    </div>
                    {topParks.map((park) => (
                      <button
                        key={park.name}
                        type="button"
                        onClick={() => {
                          const c = getFeatureCenter(
                            vectorData['osm-vegetation'],
                            park.name
                          );
                          if (c) flyToPoint(c[0], c[1], 14.0, park.name);
                        }}
                        className="block w-full text-left group"
                      >
                        <div className="flex justify-between text-[11px] text-slate-300 group-hover:text-emerald-300">
                          <span className="truncate">{park.name}</span>
                          <span className="font-mono">{park.areaKm2.toFixed(2)} km²</span>
                        </div>
                        <div className="mt-0.5 h-1.5 w-full rounded bg-slate-800">
                          <div
                            className="h-1.5 rounded bg-emerald-400"
                            style={{ width: `${(park.areaKm2 / maxPark) * 100}%` }}
                          />
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {activeChapter.metricFocus === '3d' && (
                  <div className="text-[11px] text-slate-300">
                    Click any extruded 3D building on the map to inspect its OSM ID,
                    footprint area (m²), and verified vs. estimated height source.
                  </div>
                )}

                {activeChapter.metricFocus === 'synthesis' && (
                  <div className="space-y-1 text-[11px] text-slate-300">
                    <div>
                      HMDA: {hmdaAreaKm2 ? `${hmdaAreaKm2.toFixed(1)} km²` : '7,266.4 km²'} • GHMC: {ghmcAreaKm2 ? `${ghmcAreaKm2.toFixed(1)} km²` : 'Official TGRAC'}
                    </div>
                    <div>
                      OSM Water: {osmWaterKm2 !== null ? `${osmWaterKm2.toFixed(1)} km²` : '—'} • Green Reserves: {osmVegKm2 !== null ? `${osmVegKm2.toFixed(1)} km²` : '—'}
                    </div>
                  </div>
                )}

                <div className="border-t border-[#641600]/55/80 pt-2 text-[11px] leading-relaxed text-slate-300">
                  <strong className="text-slate-100">Interpretation:</strong>{' '}
                  {activeChapter.interpretation}
                </div>
                <div className="font-mono text-[9px] text-slate-500">
                  {activeChapter.datasetRef}
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setCustomFlyTarget(null);
                    setBearingOffset(0);
                  }}
                  className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-[#ebcaa1]"
                >
                  <Compass className="h-3.5 w-3.5" />
                  <span>Reset View</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenInExplorer(activeChapter)}
                  className="inline-flex items-center gap-1 rounded-md border border-[#cd9b76]/40 bg-[#98472b]/15 px-2.5 py-1 text-[11px] font-medium text-[#dab089] hover:bg-[#98472b]/25"
                >
                  <span>Explore Full GIS</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Bottom Cinematic Filmstrip Chapter Dock */}
      <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 flex w-[94%] max-w-4xl -translate-x-1/2 justify-center">
        <div className="gis-glass pointer-events-auto flex items-center gap-1.5 overflow-x-auto rounded-2xl px-2.5 py-2">
          <button
            type="button"
            aria-label="Previous chapter"
            disabled={activeIndex === 0}
            onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
            className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-800 disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {STORY_CHAPTERS.map((ch, idx) => {
            const active = idx === activeIndex;
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => setActiveIndex(idx)}
                className={`shrink-0 rounded-xl px-2.5 py-1.5 text-left transition-all ${
                  active
                    ? 'bg-[#ebcaa1] text-[#0c0503] font-semibold shadow-[0_0_20px_rgba(0,213,255,0.35)]'
                    : 'text-slate-300 hover:bg-slate-800/80'
                }`}
              >
                <div className="font-mono text-[9px] opacity-80">{ch.number}</div>
                <div className="text-[11px] whitespace-nowrap">{ch.title}</div>
              </button>
            );
          })}

          <button
            type="button"
            aria-label="Next chapter"
            disabled={activeIndex === STORY_CHAPTERS.length - 1}
            onClick={() =>
              setActiveIndex((i) => Math.min(STORY_CHAPTERS.length - 1, i + 1))
            }
            className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-800 disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Bottom-Right Map Legend */}
      <div className="gis-glass pointer-events-none absolute bottom-20 right-2.5 z-10 hidden w-52 rounded-xl p-2.5 md:block">
        <div className="mb-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-400">
          <Layers className="h-3 w-3 text-[#cd9b76]" />
          <span>Story Layers</span>
        </div>
        <div className="space-y-1 text-[10px] text-slate-300">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#00D5FF]" />
            <span>HMDA Boundary</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#FFB547]" />
            <span>GHMC Boundary</span>
          </div>
          {chapterVectorVisibility['osm-waterbodies'] && (
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#22D3EE]" />
              <span>Lakes (OSM)</span>
            </div>
          )}
          {chapterVectorVisibility['osm-vegetation'] && (
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#10B981]" />
              <span>Parks (OSM)</span>
            </div>
          )}
          {chapterVectorVisibility['osm-roads'] && (
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#FBBF24]" />
              <span>ORR &amp; Arterials</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

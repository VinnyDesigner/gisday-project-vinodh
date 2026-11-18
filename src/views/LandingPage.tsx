import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  ArrowRight,
  BookOpen,
  Clock,
  Compass,
  ExternalLink,
  Layers,
  MapPin,
} from 'lucide-react';
import { HeroParticleLandmarks } from '../components/HeroParticleLandmarks';
import { WebGLDeccanTerrain } from '../components/WebGLDeccanTerrain';
import {
  ANALYTICAL_LAYERS,
  HISTORICAL_PERIODS,
  HYDERABAD_LANDMARKS,
  HYDERABAD_PHOTOS,
} from '../config/gisConfig';
import type { AppView } from '../types/gis';

gsap.registerPlugin(ScrollTrigger);

interface LandingPageProps {
  onNavigate: (view: AppView) => void;
  onExploreLandmark: (lng: number, lat: number, zoom: number, label: string) => void;
}

export function LandingPage({ onNavigate, onExploreLandmark }: LandingPageProps) {
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [heroSlide, setHeroSlide] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const slideTextRef = useRef<HTMLDivElement>(null);

  const heroPhoto = HYDERABAD_PHOTOS[1]; // Hussain Sagar

  const heroStatements = [
    {
      tag: 'GIS DAY 2026 SUBMISSION • RESEARCH QUESTION',
      titleTop: 'Hyderabad',
      titleAccent: 'Through Time',
      useGisDayLogo: false,
      text: 'A geospatial research documentary investigating how Hyderabad transformed spatially, environmentally, and vertically from 1990 to 2025 across GHMC and the 7,266 km² HMDA region.',
    },
    {
      tag: 'OFFICIAL SUBMISSION • BY VINODH KUMAR MANDHALA',
      titleTop: 'GIS Day 2026',
      titleAccent: 'By Vinodh Kumar Mandhala',
      useGisDayLogo: true,
      text: 'By Vinodh Kumar Mandhala — Created for GIS Day 2026 to showcase open-data urban intelligence, official TGRAC boundaries, 3D city evolution, and Google Earth Engine analytics.',
    },
    {
      tag: 'AUTHORITATIVE BOUNDARIES & 3D DIGITAL TWIN',
      titleTop: 'Official Boundaries',
      titleAccent: 'HMDA & GHMC',
      useGisDayLogo: false,
      text: 'Powered by official TGRAC administrative polygons (MapServer/45 & 52), MapLibre GL JS 3D terrain, and OpenStreetMap building extrusions with transparent height provenance.',
    },
    {
      tag: 'GOOGLE EARTH ENGINE SPECTRAL ANALYTICS',
      titleTop: 'Earth Observation',
      titleAccent: '1990 – 2025',
      useGisDayLogo: false,
      text: 'Processes Landsat 5, 8, and 9 seasonal composites on the backend to compute 5-class LULC conversion matrices, NDVI vegetation vigor, MNDWI water extent, and Landsat LST (°C).',
    },
  ];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setHeroSlide((prev) => (prev + 1) % 4);
    }, 4800);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!slideTextRef.current) return;
    gsap.fromTo(
      slideTextRef.current,
      { y: 10, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.55, ease: 'power2.out', clearProps: 'transform' }
    );
  }, [heroSlide]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.hero-stagger', {
        y: 24,
        opacity: 0,
        duration: 0.85,
        stagger: 0.1,
        ease: 'power3.out',
        clearProps: 'transform,opacity',
      });
    }, rootRef);

    const animateOnView = (selector: string, staggerDelay = 0.08) => {
      const els = Array.from(document.querySelectorAll<HTMLElement>(selector));
      if (els.length === 0) return () => {};
      const observer = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((e) => e.isIntersecting)
            .map((e) => e.target as HTMLElement);
          if (visible.length > 0) {
            gsap.fromTo(
              visible,
              { y: 22, opacity: 0 },
              {
                y: 0,
                opacity: 1,
                duration: 0.65,
                stagger: staggerDelay,
                ease: 'power3.out',
                clearProps: 'transform,opacity',
              }
            );
            visible.forEach((el) => observer.unobserve(el));
          }
        },
        { threshold: 0.05 }
      );
      els.forEach((el) => observer.observe(el));
      return () => observer.disconnect();
    };

    const cleanAnchors = animateOnView('.anchor-card', 0.12);
    const cleanEpochs = animateOnView('.epoch-card', 0.07);
    const cleanLenses = animateOnView('.lens-card', 0.08);
    ScrollTrigger.refresh();

    return () => {
      ctx.revert();
      cleanAnchors();
      cleanEpochs();
      cleanLenses();
    };
  }, []);

  return (
    <div ref={rootRef} className="min-h-screen bg-[#0c0503] text-slate-100">
      {/* Full-Screen Cinematic WebGL + Photography Hero */}
      <section className="relative flex min-h-[calc(100vh-3.5rem)] items-center overflow-hidden border-b border-[#641600]/55/70">
        {/* Background Real Photography + Three.js WebGL Topographic Mesh */}
        <div className="absolute inset-0 z-0">
          {!failedImages[heroPhoto.id] ? (
            <img
              src={heroPhoto.imageUrl}
              alt={heroPhoto.title}
              onError={() =>
                setFailedImages((prev) => ({ ...prev, [heroPhoto.id]: true }))
              }
              className="h-full w-full scale-105 object-cover opacity-25"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-[#2a1008] via-[#0c0503] to-[#180905]" />
          )}

          {/* Ambient Radial Glows */}
          <div className="pointer-events-none absolute -left-32 top-1/4 h-[520px] w-[520px] rounded-full bg-[#98472b]/15 blur-[120px]" />
          <div className="pointer-events-none absolute -right-24 bottom-10 h-[420px] w-[420px] rounded-full bg-[#98472b]/15 blur-[120px]" />

          <div className="absolute inset-0 bg-gradient-to-r from-[#0c0503]/95 via-[#0c0503]/70 to-[#0c0503]/35" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0c0503] via-transparent to-[#0c0503]/55" />

          {/* Interactive Three.js WebGL Deccan Terrain */}
          <WebGLDeccanTerrain />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-[1400px] px-6 py-16 sm:px-10">
          <div className="grid items-center gap-10 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-7">
              <div className="hero-stagger inline-flex items-center gap-2.5 rounded-full border border-[#cd9b76]/40 bg-[#98472b]/10 px-4 py-1.5 font-mono text-xs text-[#ebcaa1] backdrop-blur-md">
                <span>17.3850° N, 78.4867° E • DECCAN PLATEAU • GIS DAY 2026</span>
              </div>

              <div ref={slideTextRef} className="space-y-5">
                <div className="font-mono text-[11px] uppercase tracking-widest text-[#cd9b76]">
                  {heroStatements[heroSlide].tag}
                </div>

                {heroStatements[heroSlide].useGisDayLogo ? (
                  <div className="hero-stagger space-y-2">
                    <div className="overflow-hidden">
                      <img
                        src="/images/gis-day-logo.png"
                        alt="GIS Day"
                        className="-my-6 h-28 w-auto origin-left scale-125 object-contain brightness-0 invert sepia-[0.4] saturate-150 sm:-my-8 sm:h-36"
                      />
                    </div>
                    <h1 className="font-serif text-5xl leading-[1.02] tracking-tight sm:text-7xl lg:text-8xl">
                      <span className="block bg-gradient-to-r from-[#ebcaa1] via-[#dab089] to-[#98472b] bg-clip-text italic text-transparent">
                        Vinodh Kumar Mandhala
                      </span>
                    </h1>
                  </div>
                ) : (
                  <h1 className="hero-stagger font-serif text-5xl leading-[1.02] tracking-tight text-slate-50 sm:text-7xl lg:text-8xl">
                    {heroStatements[heroSlide].titleTop}
                    <span className="block bg-gradient-to-r from-[#ebcaa1] via-[#dab089] to-[#98472b] bg-clip-text italic text-transparent">
                      {heroStatements[heroSlide].titleAccent}
                    </span>
                  </h1>
                )}

                <div className="hero-stagger gis-glass max-w-2xl rounded-xl p-4">
                  <p className="min-h-[60px] text-sm leading-relaxed text-[#f6ede1] sm:text-base">
                    {heroStatements[heroSlide].text}
                  </p>
                  <div className="mt-3 flex items-center justify-between border-t border-[#641600]/45 pt-2.5">
                    <span className="font-mono text-[10px] text-[#dab089]">
                      0{heroSlide + 1} / 04 • Project Brief
                    </span>
                    <div className="flex items-center gap-1.5">
                      {heroStatements.map((s, idx) => (
                        <button
                          key={s.tag}
                          type="button"
                          aria-label={`Show project brief ${idx + 1}`}
                          onClick={() => setHeroSlide(idx)}
                          className={`h-1.5 rounded-full transition-all ${
                            idx === heroSlide
                              ? 'w-5 bg-[#ebcaa1]'
                              : 'w-1.5 bg-[#641600] hover:bg-[#98472b]'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="hero-stagger flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => onNavigate('story')}
                  className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#ebcaa1] to-[#cd9b76] px-5 py-3 text-sm font-semibold text-[#0c0503] shadow-[0_0_30px_rgba(0,213,255,0.3)] transition-all hover:scale-[1.02] hover:brightness-110"
                >
                  <BookOpen className="h-4 w-4" />
                  <span>Start 8-Chapter Story Atlas</span>
                  <ArrowRight className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => onNavigate('explorer')}
                  className="gis-glass inline-flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-[#dab089] transition-all hover:border-[#ebcaa1]/50 hover:text-cyan-100"
                >
                  <Compass className="h-4 w-4 text-[#cd9b76]" />
                  <span>Launch GIS Explorer</span>
                </button>

                <button
                  type="button"
                  onClick={() => onNavigate('historical')}
                  className="gis-glass inline-flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-slate-200 transition-all hover:border-[#cd9b76]/50 hover:text-amber-200"
                >
                  <Clock className="h-4 w-4 text-[#dab089]" />
                  <span>Historical Archive (1990–2025)</span>
                </button>

                <button
                  type="button"
                  onClick={() => onNavigate('analysis')}
                  className="gis-glass inline-flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-slate-200 transition-all hover:border-[#ebcaa1]/50 hover:text-[#dab089]"
                >
                  <Layers className="h-4 w-4 text-[#cd9b76]" />
                  <span>LULC &amp; Spectral Indices</span>
                </button>
              </div>
            </div>

            {/* Right-Side Rotating 3D Particle Landmarks */}
            <div className="hero-stagger lg:col-span-5">
              <HeroParticleLandmarks />
            </div>
          </div>

          {/* Hero Bottom Telemetry Strip */}
          <div className="hero-stagger mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-[#641600]/55/80 pt-5 font-mono text-[11px] text-slate-400">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-[#ebcaa1]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#ebcaa1] animate-pulse" />
                TGRAC HMDA &amp; GHMC Official Polygons
              </span>
              <span className="text-slate-700">•</span>
              <span>Esri World Imagery &amp; OpenStreetMap</span>
            </div>
            <div>
              Backdrop: {heroPhoto.title} — {heroPhoto.credit}
            </div>
          </div>
        </div>
      </section>

      {/* Chapter 01: Real Hyderabad Spatial Anchors */}
      <section className="mx-auto max-w-[1400px] px-6 py-24 sm:px-10">
        <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="font-mono text-xs uppercase tracking-widest text-[#dab089]">
              01 / Spatial Anchors
            </div>
            <h2 className="mt-2 font-serif text-3xl text-slate-50 sm:text-5xl">
              Four Centuries of Urban &amp; Hydrological Geography
            </h2>
          </div>
          <p className="max-w-md text-sm text-slate-400">
            Select any verified landmark below to fly directly to its live satellite
            coordinates inside the interactive MapLibre GIS Explorer.
          </p>
        </div>

        <div className="anchor-grid grid gap-6 md:grid-cols-3">
          {HYDERABAD_PHOTOS.map((photo, idx) => {
            const targetLandmark =
              idx === 0
                ? HYDERABAD_LANDMARKS[0]
                : idx === 1
                  ? HYDERABAD_LANDMARKS[1]
                  : HYDERABAD_LANDMARKS[2];

            return (
              <article
                key={photo.id}
                className="anchor-card gis-glass group overflow-hidden rounded-2xl transition-all duration-500 hover:-translate-y-1 hover:border-[#ebcaa1]/40"
              >
                <div className="relative h-60 overflow-hidden bg-[#1e0e09]">
                  {!failedImages[photo.id] ? (
                    <img
                      src={photo.imageUrl}
                      alt={photo.title}
                      loading="lazy"
                      onError={() =>
                        setFailedImages((prev) => ({ ...prev, [photo.id]: true }))
                      }
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center font-mono text-xs text-slate-500">
                      {photo.coordinatesLabel}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#140906] via-transparent to-transparent" />
                  <span className="absolute bottom-3 left-3 rounded border border-[#cd9b76]/30 bg-[#0c0503]/85 px-2.5 py-0.5 font-mono text-[10px] text-[#ebcaa1] backdrop-blur-md">
                    {photo.coordinatesLabel}
                  </span>
                </div>

                <div className="space-y-3 p-5">
                  <h3 className="font-serif text-2xl text-slate-100">{photo.title}</h3>
                  <p className="text-xs leading-relaxed text-slate-400">
                    {photo.caption}
                  </p>
                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() =>
                        onExploreLandmark(
                          targetLandmark.coordinates[0],
                          targetLandmark.coordinates[1],
                          targetLandmark.zoom,
                          targetLandmark.name
                        )
                      }
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-[#cd9b76] transition-colors hover:text-[#ebcaa1]"
                    >
                      <MapPin className="h-3.5 w-3.5" />
                      <span>Inspect on Map</span>
                    </button>
                    <a
                      href={photo.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-[10px] text-slate-500 hover:text-slate-300"
                    >
                      <span>{photo.credit}</span>
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Chapter 02: Temporal & Analytical Framework */}
      <section className="border-y border-[#641600]/55/80 bg-[#140906]/70">
        <div className="mx-auto max-w-[1400px] px-6 py-24 sm:px-10">
          <div className="mb-10">
            <div className="font-mono text-xs uppercase tracking-widest text-[#cd9b76]">
              02 / Earth Observation Pipeline
            </div>
            <h2 className="mt-2 font-serif text-3xl text-slate-50 sm:text-5xl">
              Five Epochs &amp; Five Spectral Lenses
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Visual basemaps are strictly separated from processed remote-sensing
              products. Where Google Earth Engine credentials are not yet configured,
              the platform reports explicit data-unavailable states rather than
              interpolating or fabricating results.
            </p>
          </div>

          <div className="epoch-grid grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {HISTORICAL_PERIODS.map((p) => (
              <div
                key={p.year}
                className="epoch-card gis-glass flex flex-col justify-between rounded-xl p-4 transition-colors hover:border-[#cd9b76]/40"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-2xl font-semibold text-[#dab089]">
                      {p.year}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
                        p.isAvailable
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {p.isAvailable ? 'LIVE' : 'GEE READY'}
                    </span>
                  </div>
                  <div className="mt-2 text-xs font-medium text-[#ebcaa1]">
                    {p.sensor}
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-slate-500">
                    {p.resolutionMeters}m spatial resolution
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-slate-400">
                    {p.notes}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="lens-grid mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {ANALYTICAL_LAYERS.map((layer) => (
              <div
                key={layer.id}
                className="lens-card gis-glass rounded-xl p-4 transition-colors hover:border-[#ebcaa1]/40"
              >
                <div className="font-mono text-[10px] uppercase tracking-wider text-[#cd9b76]">
                  {layer.classification}
                </div>
                <h3 className="mt-1 text-sm font-semibold text-slate-100">
                  {layer.name}
                </h3>
                <div className="mt-2 rounded bg-[#0c0503]/90 px-2 py-1 font-mono text-[10px] text-[#ebcaa1]">
                  {layer.formula}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">
                  {layer.description}
                </p>
              </div>
            ))}
          </div>

          <div className="gis-glass mt-10 flex flex-wrap items-center justify-between gap-4 rounded-xl p-5">
            <div className="space-y-1">
              <div className="text-sm font-medium text-slate-100">
                Inspect Full Methodology, Data Attribution &amp; Google Earth Engine Setup
              </div>
              <div className="text-xs text-slate-400">
                Includes ready-to-run GEE JavaScript code and server-side API endpoints
                for HMDA &amp; GHMC.
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('methodology')}
              className="inline-flex items-center gap-2 rounded-lg border border-[#cd9b76]/40 bg-[#98472b]/10 px-4 py-2 text-xs font-medium text-[#ebcaa1] hover:bg-[#98472b]/20"
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Open Methodology &amp; Setup</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

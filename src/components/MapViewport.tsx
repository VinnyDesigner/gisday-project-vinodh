import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import {
  BASEMAPS,
  CARTO_API_KEY,
  getAnalyticalLayers,
  getHistoricalPeriods,
  HYDERABAD_CENTER,
  HYDERABAD_DEFAULT_ZOOM,
  HYDERABAD_LANDMARKS,
  isCartoUrl,
  withCartoApiKey,
} from '../config/gisConfig';
import type {
  AnalyticalLayerId,
  BasemapId,
  HistoricalYear,
  VectorLayerId,
  VisualStyle3D,
} from '../types/gis';

export interface FlyToTarget {
  lng: number;
  lat: number;
  zoom: number;
  pitch?: number;
  bearing?: number;
  label?: string;
  nonce: number;
}

export interface CameraState {
  lng: number;
  lat: number;
  zoom: number;
  bearing: number;
  pitch: number;
}

interface MapViewportProps {
  basemapId: BasemapId;
  showRoadsLabelsOverlay?: boolean;
  is3DMode?: boolean;
  enableTerrain?: boolean;
  enableBuildings?: boolean;
  visualStyle?: VisualStyle3D;
  activeYear: HistoricalYear | null;
  historicalOpacity: number;
  dynamicGeeTileUrl?: string | null;
  activeAnalyticalLayer: AnalyticalLayerId | null;
  dynamicAnalyticalTileUrl?: string | null;
  analyticalOpacity: number;
  hmdaBoundary?: GeoJSON.FeatureCollection | null;
  ghmcBoundary?: GeoJSON.FeatureCollection | null;
  showHmdaBoundary?: boolean;
  showGhmcBoundary?: boolean;
  vectorData: Partial<Record<Exclude<VectorLayerId, 'landmarks'>, GeoJSON.FeatureCollection>>;
  vectorVisibility: Record<VectorLayerId, boolean>;
  flyToTarget: FlyToTarget | null;
  hideControls?: boolean;
  syncCameraState?: CameraState | null;
  onCameraMove?: (state: CameraState) => void;
}

function escapeHtml(input: unknown): string {
  return String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const focusPolygonCache = new Map<string, GeoJSON.FeatureCollection>();

async function fetchExactLocationBoundary(
  label: string,
  lng: number,
  lat: number
): Promise<GeoJSON.FeatureCollection | null> {
  const key = label.toLowerCase();
  const cached = focusPolygonCache.get(key);
  if (cached) return cached;

  try {
    const params = new URLSearchParams({
      q: `${label}, Hyderabad, Telangana, India`,
      format: 'geojson',
      polygon_geojson: '1',
      limit: '3',
    });
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${params.toString()}`,
      { headers: { Accept: 'application/json' } }
    );
    if (!res.ok) return null;
    const fc = (await res.json()) as GeoJSON.FeatureCollection;
    const polyFeat = (fc.features || []).find(
      (f) =>
        f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon'
    );
    if (!polyFeat) return null;
    const result: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [polyFeat],
    };
    focusPolygonCache.set(key, result);
    return result;
  } catch {
    // Fallback to reverse-lookup polygon if search fails
    try {
      const rev = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=geojson&polygon_geojson=1&zoom=14`
      );
      if (!rev.ok) return null;
      const fc = (await rev.json()) as GeoJSON.FeatureCollection;
      const polyFeat = (fc.features || []).find(
        (f) =>
          f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon'
      );
      if (!polyFeat) return null;
      const result: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: [polyFeat],
      };
      focusPolygonCache.set(key, result);
      return result;
    } catch {
      return null;
    }
  }
}

function buildLandmarksGeoJson(): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: HYDERABAD_LANDMARKS.map((lm) => ({
      type: 'Feature',
      properties: {
        id: lm.id,
        name: lm.name,
        category: lm.category,
        summary: lm.summary,
        osmReference: lm.osmReference,
      },
      geometry: {
        type: 'Point',
        coordinates: lm.coordinates,
      },
    })),
  };
}

export function MapViewport({
  basemapId,
  showRoadsLabelsOverlay = true,
  is3DMode = false,
  enableTerrain = false,
  enableBuildings = false,
  visualStyle = 'satellite-3d',
  activeYear,
  historicalOpacity,
  dynamicGeeTileUrl = null,
  activeAnalyticalLayer,
  dynamicAnalyticalTileUrl = null,
  analyticalOpacity,
  hmdaBoundary = null,
  ghmcBoundary = null,
  showHmdaBoundary = true,
  showGhmcBoundary = true,
  vectorData,
  vectorVisibility,
  flyToTarget,
  hideControls = false,
  syncCameraState = null,
  onCameraMove,
}: MapViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const isSyncingRef = useRef(false);
  const onCameraMoveRef = useRef(onCameraMove);
  onCameraMoveRef.current = onCameraMove;
  const [mapReady, setMapReady] = useState(false);
  const [geeRevision, setGeeRevision] = useState(0);
  const [cartoAuthError, setCartoAuthError] = useState<string | null>(null);
  const [buildingStatus, setBuildingStatus] = useState<{
    state: 'idle' | 'zoom-required' | 'loading' | 'ready' | 'error';
    count: number;
    message?: string;
  }>({ state: 'idle', count: 0 });

  useEffect(() => {
    const onGeeUpdate = () => setGeeRevision((r) => r + 1);
    window.addEventListener('htt-gee-updated', onGeeUpdate);
    return () => window.removeEventListener('htt-gee-updated', onGeeUpdate);
  }, []);
  const [cursorCoords, setCursorCoords] = useState<{
    lng: number;
    lat: number;
    zoom: number;
  }>({
    lng: HYDERABAD_CENTER[0],
    lat: HYDERABAD_CENTER[1],
    zoom: HYDERABAD_DEFAULT_ZOOM,
  });

  // Initialize MapLibre GL JS instance
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialSources: Record<string, maplibregl.SourceSpecification> = {};
    const initialLayers: maplibregl.LayerSpecification[] = [];

    const hasCartoKey = Boolean(CARTO_API_KEY);
    if (!hasCartoKey) {
      console.warn(
        '[CARTO Basemap] VITE_CARTO_API_KEY is not configured. Unauthenticated CARTO tiles are disabled to prevent the "API KEY REQUIRED" watermark.'
      );
    }

    for (const bm of BASEMAPS) {
      if (bm.id === 'carto-dark' && !hasCartoKey) {
        continue;
      }
      initialSources[`basemap-${bm.id}`] = {
        type: 'raster',
        tiles: [bm.tileUrl],
        tileSize: 256,
        attribution: bm.attribution,
        maxzoom: bm.maxZoom,
      };
      initialLayers.push({
        id: `basemap-layer-${bm.id}`,
        type: 'raster',
        source: `basemap-${bm.id}`,
        layout: {
          visibility: bm.id === basemapId ? 'visible' : 'none',
        },
      });
    }

    // Hybrid Roads & Place Labels Overlay (for Satellite & Dark Basemaps)
    initialSources['overlay-esri-transportation'] = {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution: 'Roads © Esri',
      maxzoom: 19,
    };
    initialLayers.push({
      id: 'overlay-layer-transportation',
      type: 'raster',
      source: 'overlay-esri-transportation',
      paint: { 'raster-opacity': 0.85 },
      layout: {
        visibility:
          showRoadsLabelsOverlay && basemapId !== 'osm-standard' ? 'visible' : 'none',
      },
    });

    if (hasCartoKey) {
      initialSources['overlay-carto-labels'] = {
        type: 'raster',
        tiles: [
          'https://basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}@2x.png',
        ],
        tileSize: 256,
        attribution: 'Labels © OpenStreetMap contributors, © CARTO',
        maxzoom: 19,
      };
      initialLayers.push({
        id: 'overlay-layer-labels',
        type: 'raster',
        source: 'overlay-carto-labels',
        paint: { 'raster-opacity': 0.92 },
        layout: {
          visibility:
            showRoadsLabelsOverlay && basemapId !== 'osm-standard' ? 'visible' : 'none',
        },
      });
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        name: 'Hyderabad Through Time Style',
        sources: initialSources,
        layers: initialLayers,
      },
      center: HYDERABAD_CENTER,
      zoom: HYDERABAD_DEFAULT_ZOOM,
      minZoom: 8,
      maxZoom: 18.5,
      attributionControl: false,
      preserveDrawingBuffer: true,
      transformRequest: (url) => {
        if (isCartoUrl(url)) {
          return { url: withCartoApiKey(url) };
        }
        return { url };
      },
    });

    map.on('error', (event) => {
      const errSource = (event as { sourceId?: string }).sourceId;
      if (errSource === 'basemap-carto-dark' || errSource === 'overlay-carto-labels') {
        console.error(
          `[CARTO Auth Error] Failed to load authenticated CARTO tiles for source "${errSource}". Verify VITE_CARTO_API_KEY and allowed domains.`,
          event.error
        );
        setCartoAuthError(
          'CARTO basemap authentication failed. Verify VITE_CARTO_API_KEY and domain restrictions.'
        );
      }
    });

    if (!hideControls) {
      map.addControl(
        new maplibregl.AttributionControl({ compact: true }),
        'bottom-right'
      );
      map.addControl(
        new maplibregl.NavigationControl({ visualizePitch: true }),
        'top-right'
      );
      map.addControl(new maplibregl.FullscreenControl(), 'top-right');
      map.addControl(
        new maplibregl.ScaleControl({ maxWidth: 140, unit: 'metric' }),
        'bottom-left'
      );
    }

    map.on('move', () => {
      if (isSyncingRef.current || !onCameraMoveRef.current) return;
      const c = map.getCenter();
      onCameraMoveRef.current({
        lng: c.lng,
        lat: c.lat,
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch(),
      });
    });

    map.on('mousemove', (e) => {
      setCursorCoords({
        lng: e.lngLat.lng,
        lat: e.lngLat.lat,
        zoom: map.getZoom(),
      });
    });

    map.on('zoomend', () => {
      const center = map.getCenter();
      setCursorCoords((prev) => ({
        lng: prev.lng || center.lng,
        lat: prev.lat || center.lat,
        zoom: map.getZoom(),
      }));
    });

    map.on('load', () => {
      // Genuine Global DEM Terrain Source (AWS Terrarium SRTM/ASTER)
      map.addSource('dem-terrain', {
        type: 'raster-dem',
        tiles: [
          'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
        ],
        tileSize: 256,
        encoding: 'terrarium',
        maxzoom: 15,
      });

      // Animated Fly-To Focus Boundary Layer
      map.addSource('flyto-focus-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'flyto-focus-fill',
        type: 'fill',
        source: 'flyto-focus-source',
        paint: {
          'fill-color': '#ebcaa1',
          'fill-opacity': 0.14,
        },
      });
      map.addLayer({
        id: 'flyto-focus-line',
        type: 'line',
        source: 'flyto-focus-source',
        paint: {
          'line-color': '#ebcaa1',
          'line-width': 3,
          'line-opacity': 0.95,
        },
      });

      // Add verified landmarks source & layers
      map.addSource('vector-landmarks', {
        type: 'geojson',
        data: buildLandmarksGeoJson(),
      });

      map.addLayer({
        id: 'vector-layer-landmarks-halo',
        type: 'circle',
        source: 'vector-landmarks',
        paint: {
          'circle-radius': 10,
          'circle-color': '#22D3EE',
          'circle-opacity': 0.22,
        },
      });

      map.addLayer({
        id: 'vector-layer-landmarks',
        type: 'circle',
        source: 'vector-landmarks',
        paint: {
          'circle-radius': 5.5,
          'circle-color': '#22D3EE',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#0c0503',
        },
      });

      // Pre-register empty GeoJSON sources for live OSM Overpass layers
      const emptyFc: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: [],
      };

      // 1. GHMC Boundary
      map.addSource('vector-ghmc-boundary', { type: 'geojson', data: emptyFc });
      map.addLayer(
        {
          id: 'vector-layer-ghmc-boundary-fill',
          type: 'fill',
          source: 'vector-ghmc-boundary',
          paint: {
            'fill-color': '#F59E0B',
            'fill-opacity': 0.04,
          },
          layout: { visibility: 'none' },
        },
        'vector-layer-landmarks-halo'
      );
      map.addLayer(
        {
          id: 'vector-layer-ghmc-boundary-line',
          type: 'line',
          source: 'vector-ghmc-boundary',
          paint: {
            'line-color': '#F59E0B',
            'line-width': 2.2,
            'line-dasharray': [3, 2],
          },
          layout: { visibility: 'none' },
        },
        'vector-layer-landmarks-halo'
      );

      // 2. OSM Waterbodies
      map.addSource('vector-osm-waterbodies', { type: 'geojson', data: emptyFc });
      map.addLayer(
        {
          id: 'vector-layer-osm-waterbodies-fill',
          type: 'fill',
          source: 'vector-osm-waterbodies',
          paint: {
            'fill-color': '#22D3EE',
            'fill-opacity': 0.35,
          },
          layout: { visibility: 'none' },
        },
        'vector-layer-landmarks-halo'
      );
      map.addLayer(
        {
          id: 'vector-layer-osm-waterbodies-line',
          type: 'line',
          source: 'vector-osm-waterbodies',
          paint: {
            'line-color': '#38BDF8',
            'line-width': 1.4,
          },
          layout: { visibility: 'none' },
        },
        'vector-layer-landmarks-halo'
      );

      // 3. OSM Vegetation
      map.addSource('vector-osm-vegetation', { type: 'geojson', data: emptyFc });
      map.addLayer(
        {
          id: 'vector-layer-osm-vegetation-fill',
          type: 'fill',
          source: 'vector-osm-vegetation',
          paint: {
            'fill-color': '#10B981',
            'fill-opacity': 0.32,
          },
          layout: { visibility: 'none' },
        },
        'vector-layer-landmarks-halo'
      );
      map.addLayer(
        {
          id: 'vector-layer-osm-vegetation-line',
          type: 'line',
          source: 'vector-osm-vegetation',
          paint: {
            'line-color': '#34D399',
            'line-width': 1.2,
          },
          layout: { visibility: 'none' },
        },
        'vector-layer-landmarks-halo'
      );

      // 4. OSM Roads
      map.addSource('vector-osm-roads', { type: 'geojson', data: emptyFc });
      map.addLayer(
        {
          id: 'vector-layer-osm-roads-line',
          type: 'line',
          source: 'vector-osm-roads',
          paint: {
            'line-color': '#FBBF24',
            'line-width': 2.2,
            'line-opacity': 0.85,
          },
          layout: { visibility: 'none' },
        },
        'vector-layer-landmarks-halo'
      );

      // Official TGRAC HMDA Boundary (#00D5FF) & GHMC Boundary (#FFB547)
      map.addSource('official-hmda-source', { type: 'geojson', data: emptyFc });
      map.addLayer(
        {
          id: 'official-hmda-fill',
          type: 'fill',
          source: 'official-hmda-source',
          paint: { 'fill-color': '#00D5FF', 'fill-opacity': 0.04 },
        },
        'vector-layer-landmarks-halo'
      );
      map.addLayer(
        {
          id: 'official-hmda-line',
          type: 'line',
          source: 'official-hmda-source',
          paint: { 'line-color': '#00D5FF', 'line-width': 2.5 },
        },
        'vector-layer-landmarks-halo'
      );

      map.addSource('official-ghmc-source', { type: 'geojson', data: emptyFc });
      map.addLayer(
        {
          id: 'official-ghmc-fill',
          type: 'fill',
          source: 'official-ghmc-source',
          paint: { 'fill-color': '#FFB547', 'fill-opacity': 0.06 },
        },
        'vector-layer-landmarks-halo'
      );
      map.addLayer(
        {
          id: 'official-ghmc-line',
          type: 'line',
          source: 'official-ghmc-source',
          paint: { 'line-color': '#FFB547', 'line-width': 2.5 },
        },
        'vector-layer-landmarks-halo'
      );

      // 3D OSM Building Extrusions via OpenFreeMap Vector Tiles (instant, zoom-gated)
      map.addSource('osm-3d-buildings-source', {
        type: 'vector',
        url: 'https://tiles.openfreemap.org/planet',
        attribution: '3D Buildings © OpenFreeMap © OpenStreetMap contributors',
      });
      map.addLayer(
        {
          id: 'osm-3d-buildings-layer',
          type: 'fill-extrusion',
          source: 'osm-3d-buildings-source',
          'source-layer': 'building',
          minzoom: 13.5,
          filter: ['!=', ['get', 'hide_3d'], true],
          paint: {
            'fill-extrusion-color': [
              'interpolate',
              ['linear'],
              ['coalesce', ['get', 'render_height'], 10],
              0,
              '#641600',
              12,
              '#98472b',
              30,
              '#cd9b76',
              60,
              '#ebcaa1',
            ],
            'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 10],
            'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
            'fill-extrusion-opacity': 0.88,
          },
          layout: { visibility: 'none' },
        },
        'vector-layer-landmarks-halo'
      );

      // Interactive click popups
      const interactiveLayerIds = [
        'vector-layer-landmarks',
        'osm-3d-buildings-layer',
        'official-ghmc-fill',
        'official-hmda-fill',
        'vector-layer-osm-waterbodies-fill',
        'vector-layer-osm-vegetation-fill',
        'vector-layer-osm-roads-line',
        'vector-layer-ghmc-boundary-fill',
      ];

      for (const lyr of interactiveLayerIds) {
        map.on('mouseenter', lyr, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', lyr, () => {
          map.getCanvas().style.cursor = '';
        });
      }

      map.on('click', (e) => {
        const features = map.queryRenderedFeatures(e.point, {
          layers: interactiveLayerIds.filter((id) => Boolean(map.getLayer(id))),
        });

        if (popupRef.current) {
          popupRef.current.remove();
          popupRef.current = null;
        }

        if (features.length > 0) {
          const top = features[0];
          const props = top.properties || {};

          if (top.layer.id === 'osm-3d-buildings-layer') {
            const rawHeight = props.render_height ?? props.heightMeters;
            const heightStr = rawHeight
              ? `${Number(rawHeight).toFixed(1)} m (OpenFreeMap / OSM)`
              : '10.0 m (Estimated category)';
            const bName = escapeHtml(
              props.name || (props.osmId ? `Building (${props.osmId})` : 'OSM 3D Building')
            );
            popupRef.current = new maplibregl.Popup({ maxWidth: '300px' })
              .setLngLat(e.lngLat)
              .setHTML(
                `<div>
                  <div style="font-family:monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#22d3ee;margin-bottom:3px;">3D Building Footprint</div>
                  <div style="font-weight:600;font-size:14px;color:#f8fafc;">${bName}</div>
                  <div style="margin-top:6px;font-family:monospace;font-size:11px;color:#cbd5e1;line-height:1.5;">
                    <div>Height: ${escapeHtml(heightStr)}</div>
                    ${props.render_min_height ? `<div>Base: ${escapeHtml(props.render_min_height)} m</div>` : ''}
                    <div>Source: OpenStreetMap / OpenFreeMap Vector Tiles</div>
                  </div>
                  <div style="margin-top:8px;padding-top:6px;border-top:1px solid rgba(148,163,184,0.2);font-family:monospace;font-size:10px;color:#94a3b8;">
                    ${e.lngLat.lat.toFixed(5)}° N, ${e.lngLat.lng.toFixed(5)}° E
                  </div>
                </div>`
              )
              .addTo(map);
            return;
          }

          const title = escapeHtml(props.name || 'Hyderabad Feature');
          const badge = props.category
            ? escapeHtml(props.category)
            : props.osmId
              ? `OSM ${escapeHtml(props.osmId)}`
              : 'Vector Feature';

          const detailsHtml = props.summary
            ? `<p style="font-size:12px;color:#cbd5e1;margin:6px 0 8px;line-height:1.45;">${escapeHtml(props.summary)}</p>
               <div style="font-family:monospace;font-size:10px;color:#94a3b8;">Ref: ${escapeHtml(props.osmReference)}</div>`
            : `<div style="margin-top:6px;font-family:monospace;font-size:11px;color:#cbd5e1;">
                ${props.natural ? `<div>natural: ${escapeHtml(props.natural)}</div>` : ''}
                ${props.water ? `<div>water: ${escapeHtml(props.water)}</div>` : ''}
                ${props.leisure ? `<div>leisure: ${escapeHtml(props.leisure)}</div>` : ''}
                ${props.landuse ? `<div>landuse: ${escapeHtml(props.landuse)}</div>` : ''}
                ${props.highway ? `<div>highway: ${escapeHtml(props.highway)}</div>` : ''}
                ${props.ref ? `<div>ref: ${escapeHtml(props.ref)}</div>` : ''}
                ${props.admin_level ? `<div>admin_level: ${escapeHtml(props.admin_level)}</div>` : ''}
              </div>`;

          popupRef.current = new maplibregl.Popup({ maxWidth: '280px' })
            .setLngLat(e.lngLat)
            .setHTML(
              `<div>
                <div style="font-family:monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#22d3ee;margin-bottom:3px;">${badge}</div>
                <div style="font-weight:600;font-size:14px;color:#f8fafc;">${title}</div>
                ${detailsHtml}
                <div style="margin-top:8px;padding-top:6px;border-top:1px solid rgba(148,163,184,0.2);font-family:monospace;font-size:10px;color:#94a3b8;">
                  ${e.lngLat.lat.toFixed(5)}° N, ${e.lngLat.lng.toFixed(5)}° E
                </div>
              </div>`
            )
            .addTo(map);
        } else {
          popupRef.current = new maplibregl.Popup({ maxWidth: '240px' })
            .setLngLat(e.lngLat)
            .setHTML(
              `<div>
                <div style="font-family:monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#f59e0b;margin-bottom:3px;">Coordinate Inspector</div>
                <div style="font-family:monospace;font-size:12px;color:#f8fafc;">
                  ${e.lngLat.lat.toFixed(5)}° N, ${e.lngLat.lng.toFixed(5)}° E
                </div>
                <div style="margin-top:4px;font-size:11px;color:#94a3b8;">
                  Zoom z${map.getZoom().toFixed(1)} • WGS84 (EPSG:4326)
                </div>
              </div>`
            )
            .addTo(map);
        }
      });

      setMapReady(true);
    });

    mapRef.current = map;

    return () => {
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  // Sync 3D Terrain (AWS Terrarium DEM)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (enableTerrain && map.getSource('dem-terrain')) {
      map.setTerrain({ source: 'dem-terrain', exaggeration: 1.6 });
    } else {
      map.setTerrain(null);
    }
  }, [enableTerrain, mapReady]);

  // Sync 2D / 3D Camera Pitch & Bearing
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    map.easeTo({
      pitch: is3DMode ? 58 : 0,
      bearing: is3DMode ? -18 : 0,
      duration: 850,
    });
  }, [is3DMode, mapReady]);

  // Sync & Animate 3D Buildings (OpenFreeMap Vector Tiles at zoom >= 13.5; present-day reference only)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const allowPresentBuildings =
      enableBuildings && (activeYear === null || activeYear === 2025);

    if (map.getLayer('osm-3d-buildings-layer')) {
      map.setLayoutProperty(
        'osm-3d-buildings-layer',
        'visibility',
        allowPresentBuildings ? 'visible' : 'none'
      );
    }

    if (!allowPresentBuildings) {
      setBuildingStatus({ state: 'idle', count: 0 });
      return;
    }

    let cancelled = false;
    let rafId = 0;

    // Smoothly animate 3D building heights rising from 0 -> 100%
    const animateRise = () => {
      let start: number | null = null;
      const duration = 950;
      const step = (ts: number) => {
        if (cancelled) return;
        if (start === null) start = ts;
        const t = Math.min(1, (ts - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        const scale = 0.02 + eased * 0.98;
        if (map.getLayer('osm-3d-buildings-layer')) {
          map.setPaintProperty('osm-3d-buildings-layer', 'fill-extrusion-height', [
            '*',
            ['coalesce', ['get', 'render_height'], 10],
            scale,
          ]);
        }
        if (t < 1) {
          rafId = window.requestAnimationFrame(step);
        }
      };
      rafId = window.requestAnimationFrame(step);
    };

    const updateZoomStatus = () => {
      const z = map.getZoom();
      if (z < 13.5) {
        setBuildingStatus({
          state: 'zoom-required',
          count: 0,
          message: 'Zoom in (z13.5+) to view animated 3D OSM buildings',
        });
      } else {
        setBuildingStatus({ state: 'ready', count: 1 });
      }
    };

    updateZoomStatus();
    animateRise();
    map.on('zoomend', updateZoomStatus);

    return () => {
      cancelled = true;
      if (rafId) window.cancelAnimationFrame(rafId);
      map.off('zoomend', updateZoomStatus);
    };
  }, [enableBuildings, activeYear, flyToTarget, mapReady]);

  // Sync Basemap & Hybrid Roads/Labels Overlay visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const effectiveBasemap =
      visualStyle === 'cinematic-dark'
        ? CARTO_API_KEY
          ? 'carto-dark'
          : basemapId
        : visualStyle === 'urban-growth'
          ? basemapId === 'osm-standard'
            ? 'osm-standard'
            : CARTO_API_KEY
              ? 'carto-dark'
              : basemapId
          : basemapId;

    for (const bm of BASEMAPS) {
      const layerId = `basemap-layer-${bm.id}`;
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(
          layerId,
          'visibility',
          bm.id === effectiveBasemap ? 'visible' : 'none'
        );
      }
    }
    const overlayVis =
      showRoadsLabelsOverlay && effectiveBasemap !== 'osm-standard'
        ? 'visible'
        : 'none';
    if (map.getLayer('overlay-layer-transportation')) {
      map.setLayoutProperty('overlay-layer-transportation', 'visibility', overlayVis);
    }
    if (map.getLayer('overlay-layer-labels')) {
      map.setLayoutProperty('overlay-layer-labels', 'visibility', overlayVis);
    }
  }, [basemapId, visualStyle, showRoadsLabelsOverlay, mapReady]);

  // Sync Official TGRAC HMDA & GHMC Boundaries
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const hmdaSrc = map.getSource('official-hmda-source') as
      | maplibregl.GeoJSONSource
      | undefined;
    if (hmdaSrc && hmdaBoundary) {
      hmdaSrc.setData(hmdaBoundary);
    }
    const ghmcSrc = map.getSource('official-ghmc-source') as
      | maplibregl.GeoJSONSource
      | undefined;
    if (ghmcSrc && ghmcBoundary) {
      ghmcSrc.setData(ghmcBoundary);
    }
  }, [hmdaBoundary, ghmcBoundary, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const hmdaVis = showHmdaBoundary && hmdaBoundary ? 'visible' : 'none';
    const ghmcVis = showGhmcBoundary && ghmcBoundary ? 'visible' : 'none';
    if (map.getLayer('official-hmda-fill')) {
      map.setLayoutProperty('official-hmda-fill', 'visibility', hmdaVis);
      map.setLayoutProperty('official-hmda-line', 'visibility', hmdaVis);
    }
    if (map.getLayer('official-ghmc-fill')) {
      map.setLayoutProperty('official-ghmc-fill', 'visibility', ghmcVis);
      map.setLayoutProperty('official-ghmc-line', 'visibility', ghmcVis);
    }
  }, [showHmdaBoundary, showGhmcBoundary, hmdaBoundary, ghmcBoundary, mapReady]);

  // Sync Historical GEE Satellite Overlay (from backend /api/gee/imagery OR .env/localStorage)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const sourceId = 'gee-historical-source';
    const layerId = 'gee-historical-layer';

    if (map.getLayer(layerId)) map.removeLayer(layerId);
    if (map.getSource(sourceId)) map.removeSource(sourceId);

    const period = activeYear
      ? getHistoricalPeriods().find((p) => p.year === activeYear)
      : undefined;
    const resolvedTileUrl = dynamicGeeTileUrl || (period?.isAvailable ? period.tileUrl : undefined);
    if (!resolvedTileUrl) return;

    const isMediumResSatellite =
      resolvedTileUrl.includes('s2cloudless') ||
      resolvedTileUrl.includes('earthengine.googleapis.com');

    map.addSource(sourceId, {
      type: 'raster',
      tiles: [resolvedTileUrl],
      tileSize: 256,
      maxzoom: isMediumResSatellite ? 14 : 18,
      attribution: period
        ? `${period.source} (${period.sensor})`
        : 'Google Earth Engine',
    });

    map.addLayer(
      {
        id: layerId,
        type: 'raster',
        source: sourceId,
        paint: { 'raster-opacity': historicalOpacity },
      },
      'vector-layer-ghmc-boundary-fill'
    );
  }, [activeYear, dynamicGeeTileUrl, mapReady, geeRevision]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (map.getLayer('gee-historical-layer')) {
      map.setPaintProperty('gee-historical-layer', 'raster-opacity', historicalOpacity);
    }
  }, [historicalOpacity, mapReady]);

  // Sync Analytical GEE Raster Overlay (only if configured in .env)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const sourceId = 'gee-analytical-source';
    const layerId = 'gee-analytical-layer';

    if (map.getLayer(layerId)) map.removeLayer(layerId);
    if (map.getSource(sourceId)) map.removeSource(sourceId);

    const config = activeAnalyticalLayer
      ? getAnalyticalLayers().find((a) => a.id === activeAnalyticalLayer)
      : undefined;
    const resolvedUrl =
      dynamicAnalyticalTileUrl || (config?.isAvailable ? config.tileUrl : undefined);
    if (!resolvedUrl) return;

    map.addSource(sourceId, {
      type: 'raster',
      tiles: [resolvedUrl],
      tileSize: 256,
      attribution: `Google Earth Engine Analytical (${config?.shortName || activeAnalyticalLayer || 'Index'})`,
    });

    map.addLayer(
      {
        id: layerId,
        type: 'raster',
        source: sourceId,
        paint: { 'raster-opacity': analyticalOpacity },
      },
      'vector-layer-ghmc-boundary-fill'
    );
  }, [activeAnalyticalLayer, dynamicAnalyticalTileUrl, mapReady, geeRevision]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (map.getLayer('gee-analytical-layer')) {
      map.setPaintProperty('gee-analytical-layer', 'raster-opacity', analyticalOpacity);
    }
  }, [analyticalOpacity, mapReady]);

  // Sync Vector GeoJSON data
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const ids: Exclude<VectorLayerId, 'landmarks'>[] = [
      'ghmc-boundary',
      'osm-waterbodies',
      'osm-vegetation',
      'osm-roads',
    ];

    for (const id of ids) {
      const src = map.getSource(`vector-${id}`) as maplibregl.GeoJSONSource | undefined;
      const fc = vectorData[id];
      if (src && fc) {
        src.setData(fc);
      }
    }
  }, [vectorData, mapReady]);

  // Sync Vector Visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const mapping: Record<VectorLayerId, string[]> = {
      landmarks: ['vector-layer-landmarks', 'vector-layer-landmarks-halo'],
      'ghmc-boundary': [
        'vector-layer-ghmc-boundary-fill',
        'vector-layer-ghmc-boundary-line',
      ],
      'osm-waterbodies': [
        'vector-layer-osm-waterbodies-fill',
        'vector-layer-osm-waterbodies-line',
      ],
      'osm-vegetation': [
        'vector-layer-osm-vegetation-fill',
        'vector-layer-osm-vegetation-line',
      ],
      'osm-roads': ['vector-layer-osm-roads-line'],
    };

    (Object.keys(mapping) as VectorLayerId[]).forEach((id) => {
      const vis = vectorVisibility[id] ? 'visible' : 'none';
      for (const layerId of mapping[id]) {
        if (map.getLayer(layerId)) {
          map.setLayoutProperty(layerId, 'visibility', vis);
        }
      }
    });
  }, [vectorVisibility, mapReady]);

  // Handle flyToTarget updates + Animated Focus Boundary
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !flyToTarget) return;

    map.flyTo({
      center: [flyToTarget.lng, flyToTarget.lat],
      zoom: flyToTarget.zoom,
      pitch: flyToTarget.pitch ?? (is3DMode ? 58 : map.getPitch()),
      bearing: flyToTarget.bearing ?? (is3DMode ? -18 : map.getBearing()),
      duration: 1500,
      essential: true,
    });

    const focusSrc = map.getSource('flyto-focus-source') as
      | maplibregl.GeoJSONSource
      | undefined;

    let rafId = 0;
    let cancelled = false;

    if (focusSrc && flyToTarget.label) {
      focusSrc.setData({ type: 'FeatureCollection', features: [] });

      const needle = flyToTarget.label.toLowerCase();
      const matchedPoly = [
        ...(vectorData['osm-waterbodies']?.features || []),
        ...(vectorData['osm-vegetation']?.features || []),
      ].find((f) => {
        const fname = String(f.properties?.name || '').toLowerCase();
        return fname && (fname.includes(needle) || needle.includes(fname));
      });

      const startPulse = () => {
        const startTime = performance.now();
        const animateFocus = (now: number) => {
          if (cancelled) return;
          const elapsed = (now - startTime) / 1000;
          if (map.getLayer('flyto-focus-fill')) {
            map.setPaintProperty(
              'flyto-focus-fill',
              'fill-opacity',
              0.12 + 0.1 * Math.sin(elapsed * 3.2)
            );
          }
          if (map.getLayer('flyto-focus-line')) {
            map.setPaintProperty(
              'flyto-focus-line',
              'line-opacity',
              0.65 + 0.35 * Math.sin(elapsed * 3.2)
            );
            map.setPaintProperty(
              'flyto-focus-line',
              'line-width',
              2.5 + 1.1 * Math.sin(elapsed * 3.2)
            );
          }
          rafId = window.requestAnimationFrame(animateFocus);
        };
        rafId = window.requestAnimationFrame(animateFocus);
      };

      if (matchedPoly) {
        focusSrc.setData({ type: 'FeatureCollection', features: [matchedPoly] });
        startPulse();
      } else {
        void fetchExactLocationBoundary(
          flyToTarget.label,
          flyToTarget.lng,
          flyToTarget.lat
        ).then((fc) => {
          if (cancelled || !fc) return;
          focusSrc.setData(fc);
          startPulse();
        });
      }
    } else if (focusSrc) {
      focusSrc.setData({ type: 'FeatureCollection', features: [] });
    }

    if (flyToTarget.label) {
      popupRef.current?.remove();
      popupRef.current = new maplibregl.Popup({ maxWidth: '260px' })
        .setLngLat([flyToTarget.lng, flyToTarget.lat])
        .setHTML(
          `<div>
            <div style="font-family:monospace;font-size:10px;text-transform:uppercase;color:#cd9b76;margin-bottom:2px;">Selected Location</div>
            <div style="font-weight:600;font-size:13px;color:#f6ede1;">${escapeHtml(flyToTarget.label)}</div>
            <div style="margin-top:6px;font-family:monospace;font-size:10px;color:#dab089;">
              ${flyToTarget.lat.toFixed(5)}° N, ${flyToTarget.lng.toFixed(5)}° E
            </div>
          </div>`
        )
        .addTo(map);
    }

    return () => {
      cancelled = true;
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [flyToTarget, mapReady]);

  // Sync external camera state (used for Swipe Comparison)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !syncCameraState) return;
    isSyncingRef.current = true;
    map.jumpTo({
      center: [syncCameraState.lng, syncCameraState.lat],
      zoom: syncCameraState.zoom,
      bearing: syncCameraState.bearing,
      pitch: syncCameraState.pitch,
    });
    isSyncingRef.current = false;
  }, [syncCameraState, mapReady]);

  const cartoMissingWarning =
    !CARTO_API_KEY && basemapId === 'carto-dark'
      ? 'CARTO Dark Matter requires VITE_CARTO_API_KEY in .env (unauthenticated CARTO tiles suppressed).'
      : null;

  const activeCartoWarning = cartoAuthError || cartoMissingWarning;

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0c0503]">
      <div ref={containerRef} className="h-full w-full" />

      {!hideControls && activeCartoWarning && (
        <div className="pointer-events-auto absolute left-1/2 top-14 z-20 -translate-x-1/2 rounded-lg border border-[#98472b]/45 bg-[#140906]/95 px-3 py-1.5 font-mono text-[11px] text-[#ebcaa1] shadow-lg backdrop-blur-md">
          {activeCartoWarning}
        </div>
      )}

      {!hideControls && enableBuildings && buildingStatus.state !== 'idle' && (
        <div className="pointer-events-none absolute left-1/2 top-24 z-20 -translate-x-1/2 rounded-lg border border-[#cd9b76]/40 bg-[#140906]/90 px-3 py-1 font-mono text-[10px] text-[#dab089] shadow-lg backdrop-blur-md">
          {buildingStatus.state === 'zoom-required' && buildingStatus.message}
          {buildingStatus.state === 'loading' && 'Loading OSM 3D buildings in viewport...'}
          {buildingStatus.state === 'ready' &&
            '3D OSM Buildings Active (click any building for height & source)'}
          {buildingStatus.state === 'error' && `Buildings error: ${buildingStatus.message}`}
        </div>
      )}

      {/* Live WGS84 Coordinate & Zoom Readout */}
      {!hideControls && (
        <div className="pointer-events-none absolute bottom-9 left-2.5 z-10 rounded-md border border-[#98472b]/50/70 bg-[#0c0503]/85 px-2.5 py-1 font-mono text-[11px] text-slate-300 backdrop-blur-md">
          <span>
            {cursorCoords.lat.toFixed(4)}° N, {cursorCoords.lng.toFixed(4)}° E
          </span>
          <span className="mx-2 text-slate-600">|</span>
          <span className="text-[#cd9b76]">z{cursorCoords.zoom.toFixed(1)}</span>
        </div>
      )}
    </div>
  );
}

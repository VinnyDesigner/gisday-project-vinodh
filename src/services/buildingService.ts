const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const DEFAULT_FLOOR_HEIGHT_M = 3.2;
const MAX_BUILDINGS_PER_VIEWPORT = 550;

const bboxCache = new Map<string, GeoJSON.FeatureCollection>();

interface OverpassNode {
  lat: number;
  lon: number;
}

interface OverpassBuildingWay {
  type: 'way';
  id: number;
  tags?: Record<string, string>;
  geometry?: OverpassNode[];
}

function polygonAreaM2(coords: [number, number][]): number {
  if (coords.length < 3) return 0;
  const R = 6371008.8;
  const rad = Math.PI / 180;
  let total = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const [lon1, lat1] = coords[i];
    const [lon2, lat2] = coords[i + 1];
    total +=
      (lon2 * rad - lon1 * rad) *
      (2 + Math.sin(lat1 * rad) + Math.sin(lat2 * rad));
  }
  return Math.abs((total * R * R) / 2);
}

function parseHeightInfo(tags: Record<string, string>): {
  heightMeters: number;
  levels: number | null;
  heightSource: 'measured' | 'levels-derived' | 'estimated-category';
  heightLabel: string;
} {
  const rawHeight = tags.height || tags['building:height'];
  if (rawHeight) {
    const numeric = parseFloat(rawHeight.replace(/[^\d.]/g, ''));
    if (!Number.isNaN(numeric) && numeric > 0 && numeric < 500) {
      const levelsRaw = tags['building:levels']
        ? parseInt(tags['building:levels'], 10)
        : null;
      return {
        heightMeters: numeric,
        levels: levelsRaw && !Number.isNaN(levelsRaw) ? levelsRaw : null,
        heightSource: 'measured',
        heightLabel: `${numeric.toFixed(1)} m (Measured OSM height)`,
      };
    }
  }

  const rawLevels = tags['building:levels'];
  if (rawLevels) {
    const levels = parseInt(rawLevels, 10);
    if (!Number.isNaN(levels) && levels > 0 && levels < 150) {
      const h = Number((levels * DEFAULT_FLOOR_HEIGHT_M).toFixed(1));
      return {
        heightMeters: h,
        levels,
        heightSource: 'levels-derived',
        heightLabel: `${h} m (Derived: ${levels} floors × ${DEFAULT_FLOOR_HEIGHT_M}m)`,
      };
    }
  }

  const bType = (tags.building || 'yes').toLowerCase();
  const est =
    bType === 'commercial' || bType === 'office'
      ? 16
      : bType === 'apartments' || bType === 'hotel'
        ? 14
        : bType === 'industrial' || bType === 'warehouse'
          ? 8
          : 7;

  return {
    heightMeters: est,
    levels: null,
    heightSource: 'estimated-category',
    heightLabel: `~${est} m (Estimated category — unmeasured)`,
  };
}

export async function fetchViewportBuildings(bounds: {
  south: number;
  west: number;
  north: number;
  east: number;
}): Promise<GeoJSON.FeatureCollection> {
  // Round bbox to ~100m grid to maximize cache hits during small pans
  const s = bounds.south.toFixed(3);
  const w = bounds.west.toFixed(3);
  const n = bounds.north.toFixed(3);
  const e = bounds.east.toFixed(3);
  const cacheKey = `${s},${w},${n},${e}`;

  const cached = bboxCache.get(cacheKey);
  if (cached) return cached;

  const query = `[out:json][timeout:18];
(
  way["building"](${s},${w},${n},${e});
);
out geom ${MAX_BUILDINGS_PER_VIEWPORT};`;

  let lastErr: Error | null = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 16000);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });
      window.clearTimeout(timer);
      if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);

      const json = (await res.json()) as { elements?: OverpassBuildingWay[] };
      const features: GeoJSON.Feature[] = [];

      for (const el of json.elements || []) {
        if (el.type !== 'way' || !el.geometry || el.geometry.length < 3) continue;
        const ring: [number, number][] = el.geometry.map((pt) => [pt.lon, pt.lat]);
        const first = ring[0];
        const last = ring[ring.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
          ring.push([first[0], first[1]]);
        }

        const tags = el.tags || {};
        const heightInfo = parseHeightInfo(tags);
        const footprintAreaM2 = Math.round(polygonAreaM2(ring));

        features.push({
          type: 'Feature',
          id: el.id,
          properties: {
            osmId: `way/${el.id}`,
            name: tags.name || tags['name:en'] || '',
            buildingUse: tags.building || 'yes',
            amenity: tags.amenity || '',
            footprintAreaM2,
            heightMeters: heightInfo.heightMeters,
            levels: heightInfo.levels ?? '',
            heightSource: heightInfo.heightSource,
            heightLabel: heightInfo.heightLabel,
            dataSource: 'OpenStreetMap Overpass API',
          },
          geometry: {
            type: 'Polygon',
            coordinates: [ring],
          },
        });
      }

      const fc: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features };
      bboxCache.set(cacheKey, fc);
      return fc;
    } catch (err) {
      window.clearTimeout(timer);
      lastErr = err instanceof Error ? err : new Error('Failed to load buildings');
    }
  }

  throw lastErr ?? new Error('Unable to reach Overpass API for 3D buildings');
}

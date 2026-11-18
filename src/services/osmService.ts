import { HYDERABAD_BBOX } from '../config/gisConfig';
import type { NominatimResult, VectorLayerId } from '../types/gis';

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const CACHE_PREFIX = 'htt_osm_v1_';

interface OverpassGeomNode {
  lat: number;
  lon: number;
}

interface OverpassMember {
  type: 'node' | 'way' | 'relation';
  ref: number;
  role: string;
  geometry?: OverpassGeomNode[];
}

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  tags?: Record<string, string>;
  geometry?: OverpassGeomNode[];
  members?: OverpassMember[];
}

function toRing(nodes: OverpassGeomNode[]): [number, number][] {
  const coords = nodes.map((n) => [n.lon, n.lat] as [number, number]);
  if (coords.length >= 3) {
    const first = coords[0];
    const last = coords[coords.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      coords.push([first[0], first[1]]);
    }
  }
  return coords;
}

function overpassToGeoJson(
  elements: OverpassElement[],
  layerId: Exclude<VectorLayerId, 'landmarks'>
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];

  for (const el of elements) {
    const tags = el.tags || {};
    const name = tags.name || tags['name:en'] || 'Unnamed Feature';

    if (el.type === 'way' && el.geometry && el.geometry.length >= 2) {
      const isLine = layerId === 'osm-roads';
      if (isLine) {
        features.push({
          type: 'Feature',
          id: el.id,
          properties: {
            osmId: `way/${el.id}`,
            name,
            highway: tags.highway || '',
            ref: tags.ref || '',
          },
          geometry: {
            type: 'LineString',
            coordinates: el.geometry.map((n) => [n.lon, n.lat]),
          },
        });
      } else if (el.geometry.length >= 3) {
        features.push({
          type: 'Feature',
          id: el.id,
          properties: {
            osmId: `way/${el.id}`,
            name,
            natural: tags.natural || '',
            water: tags.water || '',
            leisure: tags.leisure || '',
            landuse: tags.landuse || '',
          },
          geometry: {
            type: 'Polygon',
            coordinates: [toRing(el.geometry)],
          },
        });
      }
    } else if (el.type === 'relation' && el.members) {
      const outerRings: [number, number][][] = [];
      const lineStrings: [number, number][][] = [];

      for (const m of el.members) {
        if (!m.geometry || m.geometry.length < 2) continue;
        if (layerId === 'osm-roads') {
          lineStrings.push(m.geometry.map((n) => [n.lon, n.lat]));
        } else if (m.role === 'outer' || m.role === '') {
          if (m.geometry.length >= 3) {
            outerRings.push(toRing(m.geometry));
          }
        }
      }

      if (layerId === 'osm-roads' && lineStrings.length > 0) {
        features.push({
          type: 'Feature',
          id: el.id,
          properties: {
            osmId: `relation/${el.id}`,
            name,
            ref: tags.ref || '',
          },
          geometry: {
            type: 'MultiLineString',
            coordinates: lineStrings,
          },
        });
      } else if (outerRings.length > 0) {
        features.push({
          type: 'Feature',
          id: el.id,
          properties: {
            osmId: `relation/${el.id}`,
            name,
            admin_level: tags.admin_level || '',
            boundary: tags.boundary || '',
            natural: tags.natural || '',
            water: tags.water || '',
            leisure: tags.leisure || '',
          },
          geometry:
            outerRings.length === 1
              ? { type: 'Polygon', coordinates: outerRings }
              : { type: 'MultiPolygon', coordinates: outerRings.map((r) => [r]) },
        });
      }
    }
  }

  return {
    type: 'FeatureCollection',
    features,
  };
}

function buildOverpassQuery(layerId: Exclude<VectorLayerId, 'landmarks'>): string {
  const { south, west, north, east } = HYDERABAD_BBOX;
  const bbox = `${south},${west},${north},${east}`;

  switch (layerId) {
    case 'ghmc-boundary':
      return `[out:json][timeout:25];
(
  relation["boundary"="administrative"]["name"~"Greater Hyderabad|Hyderabad",i](${bbox});
);
out geom;`;

    case 'osm-waterbodies':
      return `[out:json][timeout:18];
(
  way["natural"="water"]["name"](${bbox});
  relation["natural"="water"]["name"](${bbox});
);
out geom 120;`;

    case 'osm-vegetation':
      return `[out:json][timeout:18];
(
  way["leisure"="park"]["name"](${bbox});
  way["landuse"="forest"]["name"](${bbox});
  relation["leisure"="nature_reserve"](${bbox});
  way["boundary"="national_park"](${bbox});
);
out geom 120;`;

    case 'osm-roads':
      return `[out:json][timeout:18];
(
  way["highway"~"motorway|trunk"](${bbox});
);
out geom 250;`;
  }
}

export async function fetchOsmVectorLayer(
  layerId: Exclude<VectorLayerId, 'landmarks'>
): Promise<GeoJSON.FeatureCollection> {
  // For GHMC/Hyderabad administrative boundary, use user-configured URL or verified OSM relation/7868535 GeoJSON
  if (layerId === 'ghmc-boundary') {
    const boundaryUrl =
      import.meta.env.VITE_GHMC_BOUNDARY_URL || '/data/ghmc-boundary.geojson';
    const resp = await fetch(boundaryUrl);
    if (!resp.ok) {
      throw new Error(`Failed to fetch GHMC boundary (${resp.status})`);
    }
    return (await resp.json()) as GeoJSON.FeatureCollection;
  }

  const cacheKey = `${CACHE_PREFIX}${layerId}`;
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      return JSON.parse(cached) as GeoJSON.FeatureCollection;
    }
  } catch {
    // Ignore storage errors
  }

  const query = buildOverpassQuery(layerId);
  let lastError: Error | null = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 22000);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });
      window.clearTimeout(timer);

      if (!res.ok) {
        throw new Error(`Overpass API returned HTTP ${res.status}`);
      }
      const json = (await res.json()) as { elements?: OverpassElement[] };
      const geojson = overpassToGeoJson(json.elements || [], layerId);

      try {
        sessionStorage.setItem(cacheKey, JSON.stringify(geojson));
      } catch {
        // Ignore quota errors
      }
      return geojson;
    } catch (err) {
      window.clearTimeout(timer);
      lastError = err instanceof Error ? err : new Error('Overpass request failed');
    }
  }

  throw lastError ?? new Error('Unable to reach OpenStreetMap Overpass API');
}

export async function searchHyderabadLocations(
  query: string
): Promise<NominatimResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const { west, north, east, south } = HYDERABAD_BBOX;
  const params = new URLSearchParams({
    q: `${trimmed}, Hyderabad`,
    format: 'json',
    limit: '7',
    countrycodes: 'in',
    viewbox: `${west},${north},${east},${south}`,
    bounded: '1',
    addressdetails: '1',
  });

  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`,
    {
      headers: {
        Accept: 'application/json',
      },
    }
  );

  if (!res.ok) {
    throw new Error(`Nominatim geocoding failed (HTTP ${res.status})`);
  }

  return (await res.json()) as NominatimResult[];
}

import type { AnalysisStatsDataset } from '../types/gis';

const EARTH_RADIUS_KM = 6371.0088;
const DEG_TO_RAD = Math.PI / 180;

/**
 * Computes spherical polygon ring area in km^2 using the standard
 * WGS84 mean-radius spherical excess (Shoelace) formula.
 */
function ringAreaKm2(ring: number[][]): number {
  if (ring.length < 3) return 0;
  let total = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const p1 = ring[i];
    const p2 = ring[i + 1];
    const lon1 = p1[0] * DEG_TO_RAD;
    const lat1 = p1[1] * DEG_TO_RAD;
    const lon2 = p2[0] * DEG_TO_RAD;
    const lat2 = p2[1] * DEG_TO_RAD;
    total += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }
  return Math.abs((total * EARTH_RADIUS_KM * EARTH_RADIUS_KM) / 2);
}

function polygonAreaKm2(coords: number[][][]): number {
  if (coords.length === 0) return 0;
  let area = ringAreaKm2(coords[0]);
  for (let i = 1; i < coords.length; i++) {
    area -= ringAreaKm2(coords[i]);
  }
  return Math.max(0, area);
}

/**
 * Computes total geodesic area (km^2) across all Polygon / MultiPolygon
 * features in a live GeoJSON FeatureCollection.
 */
export function computeGeoJsonAreaKm2(
  fc: GeoJSON.FeatureCollection | undefined
): number | null {
  if (!fc || !fc.features) return null;
  let total = 0;
  for (const feature of fc.features) {
    const geom = feature.geometry;
    if (!geom) continue;
    if (geom.type === 'Polygon') {
      total += polygonAreaKm2(geom.coordinates);
    } else if (geom.type === 'MultiPolygon') {
      for (const poly of geom.coordinates) {
        total += polygonAreaKm2(poly);
      }
    }
  }
  return total;
}

function haversineKm(a: number[], b: number[]): number {
  const dLat = (b[1] - a[1]) * DEG_TO_RAD;
  const dLon = (b[0] - a[0]) * DEG_TO_RAD;
  const lat1 = a[1] * DEG_TO_RAD;
  const lat2 = b[1] * DEG_TO_RAD;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

function lineCoordsLengthKm(coords: number[][]): number {
  let len = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    len += haversineKm(coords[i], coords[i + 1]);
  }
  return len;
}

export function computeGeoJsonLengthKm(
  fc: GeoJSON.FeatureCollection | undefined
): number | null {
  if (!fc || !fc.features) return null;
  let total = 0;
  for (const f of fc.features) {
    const g = f.geometry;
    if (!g) continue;
    if (g.type === 'LineString') {
      total += lineCoordsLengthKm(g.coordinates);
    } else if (g.type === 'MultiLineString') {
      for (const line of g.coordinates) {
        total += lineCoordsLengthKm(line);
      }
    }
  }
  return total;
}

export function getTopNamedPolygonsKm2(
  fc: GeoJSON.FeatureCollection | undefined,
  limit = 6
): { name: string; areaKm2: number }[] {
  if (!fc || !fc.features) return [];
  const byName = new Map<string, number>();
  for (const f of fc.features) {
    const name = String(f.properties?.name || '').trim();
    if (!name || name === 'Unnamed Feature') continue;
    let area = 0;
    if (f.geometry?.type === 'Polygon') {
      area = polygonAreaKm2(f.geometry.coordinates);
    } else if (f.geometry?.type === 'MultiPolygon') {
      for (const poly of f.geometry.coordinates) {
        area += polygonAreaKm2(poly);
      }
    }
    if (area > 0.01) {
      byName.set(name, (byName.get(name) ?? 0) + area);
    }
  }
  return Array.from(byName.entries())
    .map(([name, areaKm2]) => ({ name, areaKm2: Number(areaKm2.toFixed(2)) }))
    .sort((a, b) => b.areaKm2 - a.areaKm2)
    .slice(0, limit);
}

export function validateAnalysisStats(raw: unknown): AnalysisStatsDataset | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Partial<AnalysisStatsDataset>;
  if (obj.status !== 'measured' || !Array.isArray(obj.epochs) || obj.epochs.length === 0) {
    return null;
  }
  return obj as AnalysisStatsDataset;
}

export async function fetchProcessedAnalysisStats(): Promise<AnalysisStatsDataset | null> {
  const url =
    import.meta.env.VITE_ANALYSIS_STATS_URL || '/data/hyderabad-analysis-stats.json';
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const json: unknown = await resp.json();
    return validateAnalysisStats(json);
  } catch {
    return null;
  }
}

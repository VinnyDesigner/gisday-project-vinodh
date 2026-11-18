import fs from 'node:fs/promises';
import path from 'node:path';
import https from 'node:https';

export type StudyAreaId = 'hmda' | 'ghmc';

export interface TgracLayerMetadata {
  area: StudyAreaId;
  name: string;
  layerId: number;
  serviceUrl: string;
  geometryType: string;
  nativeSpatialReference: string;
  outputSpatialReference: string;
  featureCount: number;
  attributes: string[];
  lastEdited: string | null;
  source: string;
  fetchedAt: string;
  cacheMode: 'live-tgrac' | 'verified-local-snapshot';
}

export interface BoundaryBundle {
  metadata: TgracLayerMetadata;
  geojson: GeoJSON.FeatureCollection;
}

const TGRAC_BASE =
  'https://tgrac.telangana.gov.in/arcgis/rest/services/TCUR_Folder/TCUR_Telangana_Core_Urban_Region_V2/MapServer';

const LAYER_CONFIG: Record<
  StudyAreaId,
  { layerId: number; fallbackFile: string; label: string }
> = {
  ghmc: {
    layerId: 45,
    fallbackFile: 'public/data/tgrac-ghmc.geojson',
    label: 'GHMC Boundary',
  },
  hmda: {
    layerId: 52,
    fallbackFile: 'public/data/tgrac-hmda.geojson',
    label: 'HMDA Boundary',
  },
};

const CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes
const memoryCache = new Map<StudyAreaId, { expiresAt: number; data: BoundaryBundle }>();

function fetchJsonInsecureTls(url: string, timeoutMs = 20000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        rejectUnauthorized: false,
        timeout: timeoutMs,
      },
      (res) => {
        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`TGRAC HTTP ${res.statusCode ?? 'unknown'}`));
          res.resume();
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          try {
            const text = Buffer.concat(chunks).toString('utf8');
            resolve(JSON.parse(text));
          } catch (err) {
            reject(err);
          }
        });
      }
    );
    req.on('timeout', () => {
      req.destroy(new Error('TGRAC request timed out'));
    });
    req.on('error', reject);
  });
}

function esriToGeoJson(
  esriResponse: {
    features?: Array<{
      attributes?: Record<string, unknown>;
      geometry?: { rings?: number[][][] };
    }>;
  },
  area: StudyAreaId,
  layerId: number
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = (esriResponse.features || []).map((f, idx) => {
    const rings = f.geometry?.rings || [];
    const geometry: GeoJSON.Geometry =
      rings.length === 1
        ? { type: 'Polygon', coordinates: rings }
        : { type: 'MultiPolygon', coordinates: rings.map((r) => [r]) };

    return {
      type: 'Feature',
      id: idx,
      properties: {
        ...(f.attributes || {}),
        studyArea: area,
        name: LAYER_CONFIG[area].label,
        source: `TGRAC MapServer/${layerId}`,
      },
      geometry,
    };
  });

  return {
    type: 'FeatureCollection',
    features,
  };
}

export async function getOfficialBoundary(area: StudyAreaId): Promise<BoundaryBundle> {
  const now = Date.now();
  const cached = memoryCache.get(area);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const cfg = LAYER_CONFIG[area];
  const metaUrl = `${TGRAC_BASE}/${cfg.layerId}?f=json`;
  const queryUrl = `${TGRAC_BASE}/${cfg.layerId}/query?where=1%3D1&outFields=*&outSR=4326&f=json`;

  try {
    const [layerMetaRaw, queryRaw] = await Promise.all([
      fetchJsonInsecureTls(metaUrl, 15000),
      fetchJsonInsecureTls(queryUrl, 25000),
    ]);

    const layerMeta = layerMetaRaw as {
      name?: string;
      geometryType?: string;
      extent?: { spatialReference?: { wkt?: string; wkid?: number } };
      fields?: Array<{ name: string }>;
      editingInfo?: { lastEditDate?: number };
    };
    const queryData = queryRaw as {
      features?: Array<{
        attributes?: Record<string, unknown>;
        geometry?: { rings?: number[][][] };
      }>;
    };

    const geojson = esriToGeoJson(queryData, area, cfg.layerId);
    if (geojson.features.length === 0) {
      throw new Error(`TGRAC layer ${cfg.layerId} returned 0 features`);
    }

    const lastEditMs = layerMeta.editingInfo?.lastEditDate;
    const bundle: BoundaryBundle = {
      metadata: {
        area,
        name: layerMeta.name || cfg.label,
        layerId: cfg.layerId,
        serviceUrl: `${TGRAC_BASE}/${cfg.layerId}`,
        geometryType: layerMeta.geometryType || 'esriGeometryPolygon',
        nativeSpatialReference:
          layerMeta.extent?.spatialReference?.wkt?.includes('UTM_Zone_44N')
            ? 'WGS_1984_UTM_Zone_44N'
            : String(layerMeta.extent?.spatialReference?.wkid || 'Unknown'),
        outputSpatialReference: 'EPSG:4326 (WGS84)',
        featureCount: geojson.features.length,
        attributes: (layerMeta.fields || []).map((f) => f.name),
        lastEdited: lastEditMs ? new Date(lastEditMs).toISOString() : null,
        source:
          'Telangana Remote Sensing Applications Centre (TGRAC) — TCUR_Telangana_Core_Urban_Region_V2',
        fetchedAt: new Date().toISOString(),
        cacheMode: 'live-tgrac',
      },
      geojson,
    };

    memoryCache.set(area, { expiresAt: now + CACHE_TTL_MS, data: bundle });
    return bundle;
  } catch (liveErr) {
    // Fallback only to verified TGRAC snapshot downloaded from the same official service
    try {
      const absPath = path.resolve(process.cwd(), cfg.fallbackFile);
      const raw = await fs.readFile(absPath, 'utf8');
      const geojson = JSON.parse(raw) as GeoJSON.FeatureCollection;
      const firstProps = (geojson.features?.[0]?.properties || {}) as Record<
        string,
        unknown
      >;

      const bundle: BoundaryBundle = {
        metadata: {
          area,
          name: cfg.label,
          layerId: cfg.layerId,
          serviceUrl: `${TGRAC_BASE}/${cfg.layerId}`,
          geometryType: 'esriGeometryPolygon',
          nativeSpatialReference: 'WGS_1984_UTM_Zone_44N',
          outputSpatialReference: 'EPSG:4326 (WGS84)',
          featureCount: geojson.features.length,
          attributes: Object.keys(firstProps),
          lastEdited: null,
          source:
            'TGRAC Verified Snapshot (live TGRAC endpoint unreachable: ' +
            (liveErr instanceof Error ? liveErr.message : 'network error') +
            ')',
          fetchedAt: new Date().toISOString(),
          cacheMode: 'verified-local-snapshot',
        },
        geojson,
      };
      return bundle;
    } catch {
      throw new Error(
        `Official TGRAC service unavailable (${liveErr instanceof Error ? liveErr.message : 'error'}) and no verified snapshot found.`
      );
    }
  }
}

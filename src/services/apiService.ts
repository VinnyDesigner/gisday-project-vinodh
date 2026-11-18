import type {
  AnalyticalLayerId,
  BoundaryBundle,
  GeeImageryResult,
  HistoricalYear,
  StudyAreaId,
} from '../types/gis';
import type {
  LulcMatrixReport,
  SeasonWindow,
  TerrainReport,
} from '../types/analytics';

export interface GeeServiceError {
  error: 'GEE_NOT_CONFIGURED' | 'GEE_SERVICE_ERROR' | 'NETWORK_ERROR';
  message: string;
}

const SNAPSHOT_URLS: Record<StudyAreaId, string> = {
  hmda: '/data/tgrac-hmda.geojson',
  ghmc: '/data/tgrac-ghmc.geojson',
};

const SNAPSHOT_META: Record<StudyAreaId, { layerId: number; name: string }> = {
  ghmc: { layerId: 45, name: 'GHMC Boundary' },
  hmda: { layerId: 52, name: 'HMDA Boundary' },
};

export async function fetchOfficialBoundary(
  area: StudyAreaId
): Promise<BoundaryBundle> {
  try {
    const res = await fetch(`/api/boundaries/${area}`);
    if (res.ok) {
      return (await res.json()) as BoundaryBundle;
    }
  } catch {
    // Backend server may not be running in static Vite preview; fall through to verified TGRAC snapshot
  }

  const snapRes = await fetch(SNAPSHOT_URLS[area]);
  if (!snapRes.ok) {
    throw new Error(`Failed to load official ${area.toUpperCase()} boundary`);
  }
  const geojson = (await snapRes.json()) as GeoJSON.FeatureCollection;
  const firstProps = (geojson.features?.[0]?.properties || {}) as Record<
    string,
    unknown
  >;

  return {
    metadata: {
      area,
      name: SNAPSHOT_META[area].name,
      layerId: SNAPSHOT_META[area].layerId,
      serviceUrl: `https://tgrac.telangana.gov.in/arcgis/rest/services/TCUR_Folder/TCUR_Telangana_Core_Urban_Region_V2/MapServer/${SNAPSHOT_META[area].layerId}`,
      geometryType: 'esriGeometryPolygon',
      nativeSpatialReference: 'WGS_1984_UTM_Zone_44N',
      outputSpatialReference: 'EPSG:4326 (WGS84)',
      featureCount: geojson.features.length,
      attributes: Object.keys(firstProps),
      lastEdited: null,
      source: 'TGRAC Verified GeoJSON Snapshot (MapServer/' + SNAPSHOT_META[area].layerId + ')',
      fetchedAt: new Date().toISOString(),
      cacheMode: 'verified-local-snapshot',
    },
    geojson,
  };
}

export async function fetchGeeImagery(
  area: StudyAreaId,
  year: HistoricalYear
): Promise<{ data?: GeeImageryResult; error?: GeeServiceError }> {
  try {
    const res = await fetch(`/api/gee/imagery?area=${area}&year=${year}`);
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return {
        error: {
          error: 'NETWORK_ERROR',
          message:
            'Backend GIS API is not running on port 8787. Run "npm run dev" (which starts both API + UI) and configure GEE credentials in .env.',
        },
      };
    }
    const json = await res.json();
    if (!res.ok) {
      return {
        error: {
          error: json.error || 'GEE_SERVICE_ERROR',
          message: json.message || `HTTP ${res.status}`,
        },
      };
    }
    return { data: json as GeeImageryResult };
  } catch (err) {
    return {
      error: {
        error: 'NETWORK_ERROR',
        message:
          err instanceof Error
            ? `Backend GIS API unreachable (${err.message}). Run "npm run dev" to start both API and UI.`
            : 'Backend GIS API unreachable.',
      },
    };
  }
}

export async function fetchDynamicAnalyticalLayer(
  layer: AnalyticalLayerId,
  area: StudyAreaId,
  year: HistoricalYear = 2025
): Promise<{ data?: GeeImageryResult; error?: GeeServiceError }> {
  try {
    const res = await fetch(
      `/api/gee/analytical?layer=${layer}&area=${area}&year=${year}`
    );
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return {
        error: {
          error: 'NETWORK_ERROR',
          message:
            'Backend GIS API is not running on port 8787. Run "npm run dev" to start both API and UI.',
        },
      };
    }
    const json = await res.json();
    if (!res.ok) {
      return {
        error: {
          error: json.error || 'GEE_SERVICE_ERROR',
          message: json.message || `HTTP ${res.status}`,
        },
      };
    }
    return { data: json as GeeImageryResult };
  } catch (err) {
    return {
      error: {
        error: 'NETWORK_ERROR',
        message:
          err instanceof Error
            ? `Backend GIS API unreachable (${err.message}).`
            : 'Backend GIS API unreachable.',
      },
    };
  }
}

export async function fetchLulcMatrixReport(
  area: StudyAreaId,
  startYear: HistoricalYear,
  endYear: HistoricalYear,
  season: SeasonWindow = 'dry'
): Promise<{ data?: LulcMatrixReport; error?: GeeServiceError }> {
  try {
    const res = await fetch(
      `/api/analysis/lulc-matrix?area=${area}&startYear=${startYear}&endYear=${endYear}&season=${season}`
    );
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return {
        error: {
          error: 'NETWORK_ERROR',
          message: 'Backend GIS API is not running on port 8787.',
        },
      };
    }
    const json = await res.json();
    if (!res.ok) {
      return {
        error: {
          error: json.error || 'GEE_SERVICE_ERROR',
          message: json.message || `HTTP ${res.status}`,
        },
      };
    }
    return { data: json as LulcMatrixReport };
  } catch (err) {
    return {
      error: {
        error: 'NETWORK_ERROR',
        message:
          err instanceof Error ? err.message : 'Backend GIS API unreachable.',
      },
    };
  }
}

export async function fetchTerrainAnalysis(
  area: StudyAreaId
): Promise<{ data?: TerrainReport; error?: GeeServiceError }> {
  try {
    const res = await fetch(`/api/analysis/terrain?area=${area}`);
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return {
        error: {
          error: 'NETWORK_ERROR',
          message: 'Backend GIS API is not running on port 8787.',
        },
      };
    }
    const json = await res.json();
    if (!res.ok) {
      return {
        error: {
          error: json.error || 'GEE_SERVICE_ERROR',
          message: json.message || `HTTP ${res.status}`,
        },
      };
    }
    return { data: json as TerrainReport };
  } catch (err) {
    return {
      error: {
        error: 'NETWORK_ERROR',
        message:
          err instanceof Error ? err.message : 'Backend GIS API unreachable.',
      },
    };
  }
}

export async function fetchGeeAnalysis(
  endpoint: 'ndvi' | 'water' | 'urban-growth',
  area: StudyAreaId,
  year?: HistoricalYear
): Promise<{ data?: Record<string, unknown>; error?: GeeServiceError }> {
  const qs =
    endpoint === 'urban-growth'
      ? `area=${area}`
      : `area=${area}&year=${year ?? 2025}`;
  try {
    const res = await fetch(`/api/analysis/${endpoint}?${qs}`);
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return {
        error: {
          error: 'NETWORK_ERROR',
          message:
            'Backend GIS API is not running on port 8787. Run "npm run dev" to start both API and UI.',
        },
      };
    }
    const json = await res.json();
    if (!res.ok) {
      return {
        error: {
          error: json.error || 'GEE_SERVICE_ERROR',
          message: json.message || `HTTP ${res.status}`,
        },
      };
    }
    return { data: json as Record<string, unknown> };
  } catch (err) {
    return {
      error: {
        error: 'NETWORK_ERROR',
        message:
          err instanceof Error
            ? `Backend GIS API unreachable (${err.message}). Start server with "npm run server".`
            : 'Backend GIS API unreachable.',
      },
    };
  }
}

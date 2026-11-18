import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import cors from 'cors';
import { getOfficialBoundary, type StudyAreaId } from './services/tgracService';
import {
  analyzeNdvi,
  analyzeUrbanGrowth,
  analyzeWater,
  EPOCH_SPECS,
  getCompositeImagery,
  getDynamicAnalyticalLayer,
  getGeeConfigStatus,
  getImageryAvailability,
  type SupportedAnalyticalLayer,
  type SupportedYear,
} from './services/geeService';
import {
  analyzeTerrain,
  computeLulcAndConversion,
  type SeasonWindow,
} from './services/analyticsService';

const app = express();
const PORT = Number(process.env.PORT || 8787);

app.use(cors());
app.use(express.json());

// Simple in-memory response cache for expensive GEE queries
const apiCache = new Map<string, { expiresAt: number; payload: unknown }>();
const GEE_CACHE_TTL_MS = 1000 * 60 * 20;

function parseArea(raw: unknown): StudyAreaId | null {
  const val = String(raw || '').toLowerCase();
  if (val === 'hmda' || val === 'ghmc') return val;
  return null;
}

function parseYear(raw: unknown): SupportedYear | null {
  const num = Number(raw);
  if (num === 1990 || num === 2000 || num === 2010 || num === 2020 || num === 2025) {
    return num;
  }
  return null;
}

function handleGeeError(res: Response, err: unknown) {
  const msg = err instanceof Error ? err.message : 'Earth Engine request failed';
  const isNotConfigured = msg.startsWith('GEE_NOT_CONFIGURED');
  console.error('[GEE Error]', msg);
  res.status(503).json({
    error: isNotConfigured ? 'GEE_NOT_CONFIGURED' : 'GEE_SERVICE_ERROR',
    message: msg,
    gee: getGeeConfigStatus(),
  });
}

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: 'hyderabad-through-time-gis-api',
    gee: getGeeConfigStatus(),
    supportedYears: Object.keys(EPOCH_SPECS).map(Number),
  });
});

app.get('/api/boundaries', async (_req: Request, res: Response) => {
  try {
    const [hmda, ghmc] = await Promise.all([
      getOfficialBoundary('hmda'),
      getOfficialBoundary('ghmc'),
    ]);
    res.json({
      hmda: hmda.metadata,
      ghmc: ghmc.metadata,
    });
  } catch (err) {
    res.status(503).json({
      error: 'TGRAC_BOUNDARY_ERROR',
      message: err instanceof Error ? err.message : 'Failed to load TGRAC boundaries',
    });
  }
});

app.get('/api/boundaries/:area', async (req: Request, res: Response) => {
  const area = parseArea(req.params.area);
  if (!area) {
    res.status(400).json({ error: 'INVALID_AREA', message: 'area must be hmda or ghmc' });
    return;
  }
  try {
    const bundle = await getOfficialBoundary(area);
    res.json(bundle);
  } catch (err) {
    res.status(503).json({
      error: 'TGRAC_BOUNDARY_ERROR',
      message: err instanceof Error ? err.message : 'Failed to load TGRAC boundary',
    });
  }
});

app.get('/api/gee/availability', async (req: Request, res: Response) => {
  const area = parseArea(req.query.area);
  const year = parseYear(req.query.year);
  if (!area || !year) {
    res.status(400).json({
      error: 'INVALID_PARAMS',
      message: 'Required query params: area=(hmda|ghmc)&year=(1990|2000|2010|2020|2025)',
    });
    return;
  }

  const cacheKey = `avail:${area}:${year}`;
  const cached = apiCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    res.json(cached.payload);
    return;
  }

  try {
    const result = await getImageryAvailability(area, year);
    apiCache.set(cacheKey, { expiresAt: Date.now() + GEE_CACHE_TTL_MS, payload: result });
    res.json(result);
  } catch (err) {
    handleGeeError(res, err);
  }
});

app.get('/api/gee/imagery', async (req: Request, res: Response) => {
  const area = parseArea(req.query.area);
  const year = parseYear(req.query.year);
  if (!area || !year) {
    res.status(400).json({
      error: 'INVALID_PARAMS',
      message: 'Required query params: area=(hmda|ghmc)&year=(1990|2000|2010|2020|2025)',
    });
    return;
  }

  const cacheKey = `img:${area}:${year}`;
  const cached = apiCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    res.json(cached.payload);
    return;
  }

  try {
    const result = await getCompositeImagery(area, year);
    apiCache.set(cacheKey, { expiresAt: Date.now() + GEE_CACHE_TTL_MS, payload: result });
    res.json(result);
  } catch (err) {
    handleGeeError(res, err);
  }
});

app.get('/api/gee/analytical', async (req: Request, res: Response) => {
  const area = parseArea(req.query.area);
  const year = parseYear(req.query.year || 2025);
  const layerRaw = String(req.query.layer || '').toLowerCase();
  const validLayers: SupportedAnalyticalLayer[] = ['ndvi', 'ndbi', 'ndwi', 'lulc', 'lst'];
  if (!area || !year || !validLayers.includes(layerRaw as SupportedAnalyticalLayer)) {
    res.status(400).json({
      error: 'INVALID_PARAMS',
      message:
        'Required query params: layer=(ndvi|ndbi|ndwi|lulc|lst)&area=(hmda|ghmc)&year=(1990|2000|2010|2020|2025)',
    });
    return;
  }

  const layer = layerRaw as SupportedAnalyticalLayer;
  const cacheKey = `analytical:${layer}:${area}:${year}`;
  const cached = apiCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    res.json(cached.payload);
    return;
  }

  try {
    const result = await getDynamicAnalyticalLayer(layer, area, year);
    apiCache.set(cacheKey, { expiresAt: Date.now() + GEE_CACHE_TTL_MS, payload: result });
    res.json(result);
  } catch (err) {
    handleGeeError(res, err);
  }
});

app.get('/api/analysis/urban-growth', async (req: Request, res: Response) => {
  const area = parseArea(req.query.area);
  if (!area) {
    res.status(400).json({ error: 'INVALID_PARAMS', message: 'area must be hmda or ghmc' });
    return;
  }

  const cacheKey = `urban:${area}`;
  const cached = apiCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    res.json(cached.payload);
    return;
  }

  try {
    const result = await analyzeUrbanGrowth(area);
    apiCache.set(cacheKey, { expiresAt: Date.now() + GEE_CACHE_TTL_MS, payload: result });
    res.json(result);
  } catch (err) {
    handleGeeError(res, err);
  }
});

app.get('/api/analysis/ndvi', async (req: Request, res: Response) => {
  const area = parseArea(req.query.area);
  const year = parseYear(req.query.year);
  if (!area || !year) {
    res.status(400).json({ error: 'INVALID_PARAMS', message: 'Required: area & year' });
    return;
  }

  const cacheKey = `ndvi:${area}:${year}`;
  const cached = apiCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    res.json(cached.payload);
    return;
  }

  try {
    const result = await analyzeNdvi(area, year);
    apiCache.set(cacheKey, { expiresAt: Date.now() + GEE_CACHE_TTL_MS, payload: result });
    res.json(result);
  } catch (err) {
    handleGeeError(res, err);
  }
});

app.get('/api/analysis/water', async (req: Request, res: Response) => {
  const area = parseArea(req.query.area);
  const year = parseYear(req.query.year);
  if (!area || !year) {
    res.status(400).json({ error: 'INVALID_PARAMS', message: 'Required: area & year' });
    return;
  }

  const cacheKey = `water:${area}:${year}`;
  const cached = apiCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    res.json(cached.payload);
    return;
  }

  try {
    const result = await analyzeWater(area, year);
    apiCache.set(cacheKey, { expiresAt: Date.now() + GEE_CACHE_TTL_MS, payload: result });
    res.json(result);
  } catch (err) {
    handleGeeError(res, err);
  }
});

app.get('/api/analysis/lulc-matrix', async (req: Request, res: Response) => {
  const area = parseArea(req.query.area);
  const startYear = parseYear(req.query.startYear || 1990);
  const endYear = parseYear(req.query.endYear || 2025);
  const seasonRaw = String(req.query.season || 'dry').toLowerCase();
  const season: SeasonWindow =
    seasonRaw === 'post-monsoon' || seasonRaw === 'annual' ? seasonRaw : 'dry';

  if (!area || !startYear || !endYear) {
    res.status(400).json({
      error: 'INVALID_PARAMS',
      message: 'Required: area=(hmda|ghmc)&startYear=(1990..2025)&endYear=(1990..2025)',
    });
    return;
  }

  const cacheKey = `lulc-matrix:${area}:${startYear}:${endYear}:${season}`;
  const cached = apiCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    res.json(cached.payload);
    return;
  }

  try {
    const result = await computeLulcAndConversion(area, startYear, endYear, season);
    apiCache.set(cacheKey, { expiresAt: Date.now() + GEE_CACHE_TTL_MS, payload: result });
    res.json(result);
  } catch (err) {
    handleGeeError(res, err);
  }
});

app.get('/api/analysis/terrain', async (req: Request, res: Response) => {
  const area = parseArea(req.query.area);
  if (!area) {
    res.status(400).json({ error: 'INVALID_PARAMS', message: 'area must be hmda or ghmc' });
    return;
  }

  const cacheKey = `terrain:${area}`;
  const cached = apiCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    res.json(cached.payload);
    return;
  }

  try {
    const result = await analyzeTerrain(area);
    apiCache.set(cacheKey, { expiresAt: Date.now() + GEE_CACHE_TTL_MS, payload: result });
    res.json(result);
  } catch (err) {
    handleGeeError(res, err);
  }
});

app.listen(PORT, () => {
  const gee = getGeeConfigStatus();
  console.log(
    `[Hyderabad GIS API] Listening on http://localhost:${PORT} | GEE Project: ${gee.projectId} | Credentials configured: ${gee.configured}`
  );
});

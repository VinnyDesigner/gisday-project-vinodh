import ee from '@google/earthengine';
import { getOfficialBoundary, type StudyAreaId } from './tgracService';

export type SupportedYear = 1990 | 2000 | 2010 | 2020 | 2025;

export type SupportedAnalyticalLayer = 'ndvi' | 'ndbi' | 'ndwi' | 'lulc' | 'lst';

interface EpochSpec {
  year: SupportedYear;
  collectionId: string;
  sensor: string;
  resolutionMeters: number;
  rgbBands: [string, string, string];
  redBand: string;
  nirBand: string;
  greenBand: string;
  swir1Band: string;
  thermalBand: string;
  seasonStart: string;
  seasonEnd: string;
  sensorNotes: string;
}

export const EPOCH_SPECS: Record<SupportedYear, EpochSpec> = {
  1990: {
    year: 1990,
    collectionId: 'LANDSAT/LT05/C02/T1_L2',
    sensor: 'Landsat 5 TM',
    resolutionMeters: 30,
    rgbBands: ['SR_B3', 'SR_B2', 'SR_B1'],
    redBand: 'SR_B3',
    nirBand: 'SR_B4',
    greenBand: 'SR_B2',
    swir1Band: 'SR_B5',
    thermalBand: 'ST_B6',
    seasonStart: '1990-01-01',
    seasonEnd: '1990-03-31',
    sensorNotes: 'Thematic Mapper (TM) Collection 2 Level-2 surface reflectance.',
  },
  2000: {
    year: 2000,
    collectionId: 'LANDSAT/LT05/C02/T1_L2',
    sensor: 'Landsat 5 TM',
    resolutionMeters: 30,
    rgbBands: ['SR_B3', 'SR_B2', 'SR_B1'],
    redBand: 'SR_B3',
    nirBand: 'SR_B4',
    greenBand: 'SR_B2',
    swir1Band: 'SR_B5',
    thermalBand: 'ST_B6',
    seasonStart: '2000-01-01',
    seasonEnd: '2000-03-31',
    sensorNotes: 'Thematic Mapper (TM) Collection 2 Level-2 surface reflectance.',
  },
  2010: {
    year: 2010,
    collectionId: 'LANDSAT/LT05/C02/T1_L2',
    sensor: 'Landsat 5 TM',
    resolutionMeters: 30,
    rgbBands: ['SR_B3', 'SR_B2', 'SR_B1'],
    redBand: 'SR_B3',
    nirBand: 'SR_B4',
    greenBand: 'SR_B2',
    swir1Band: 'SR_B5',
    thermalBand: 'ST_B6',
    seasonStart: '2010-01-01',
    seasonEnd: '2010-03-31',
    sensorNotes: 'Thematic Mapper (TM) Collection 2 Level-2 surface reflectance.',
  },
  2020: {
    year: 2020,
    collectionId: 'LANDSAT/LC08/C02/T1_L2',
    sensor: 'Landsat 8 OLI',
    resolutionMeters: 30,
    rgbBands: ['SR_B4', 'SR_B3', 'SR_B2'],
    redBand: 'SR_B4',
    nirBand: 'SR_B5',
    greenBand: 'SR_B3',
    swir1Band: 'SR_B6',
    thermalBand: 'ST_B10',
    seasonStart: '2020-01-01',
    seasonEnd: '2020-03-31',
    sensorNotes:
      'OLI sensor has narrower spectral bands than TM; quantitative cross-sensor comparisons account for TM-to-OLI spectral differences.',
  },
  2025: {
    year: 2025,
    collectionId: 'LANDSAT/LC09/C02/T1_L2',
    sensor: 'Landsat 9 OLI-2',
    resolutionMeters: 30,
    rgbBands: ['SR_B4', 'SR_B3', 'SR_B2'],
    redBand: 'SR_B4',
    nirBand: 'SR_B5',
    greenBand: 'SR_B3',
    swir1Band: 'SR_B6',
    thermalBand: 'ST_B10',
    seasonStart: '2025-01-01',
    seasonEnd: '2025-03-31',
    sensorNotes:
      'OLI-2 14-bit radiometric resolution Collection 2 Level-2 surface reflectance.',
  },
};

let eeInitPromise: Promise<void> | null = null;
let eeInitialized = false;

export function getGeeConfigStatus() {
  const projectId = process.env.GEE_PROJECT_ID || 'pivotal-shield-455916-h2';
  const clientEmail = process.env.GEE_SERVICE_ACCOUNT_EMAIL || '';
  const privateKey = (process.env.GEE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  return {
    projectId,
    configured: Boolean(clientEmail && privateKey),
    initialized: eeInitialized,
  };
}

export async function ensureGeeInitialized(): Promise<void> {
  if (eeInitialized) return;
  if (eeInitPromise) return eeInitPromise;

  const projectId = process.env.GEE_PROJECT_ID || 'pivotal-shield-455916-h2';
  const clientEmail = process.env.GEE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GEE_PRIVATE_KEY;

  if (!clientEmail || !rawKey) {
    throw new Error(
      `GEE_NOT_CONFIGURED: Set GEE_SERVICE_ACCOUNT_EMAIL and GEE_PRIVATE_KEY in server .env for project ${projectId}.`
    );
  }

  const privateKey = rawKey.replace(/\\n/g, '\n');

  eeInitPromise = new Promise<void>((resolve, reject) => {
    ee.data.authenticateViaPrivateKey(
      { client_email: clientEmail, private_key: privateKey },
      () => {
        ee.initialize(
          null,
          null,
          () => {
            eeInitialized = true;
            resolve();
          },
          (err: Error) => {
            eeInitPromise = null;
            reject(err);
          },
          null,
          projectId
        );
      },
      (err: Error) => {
        eeInitPromise = null;
        reject(err);
      }
    );
  });

  return eeInitPromise;
}

function geojsonToEeGeometry(geojson: GeoJSON.FeatureCollection): unknown {
  const first = geojson.features[0];
  if (!first || !first.geometry) {
    throw new Error('Study area GeoJSON has no geometry');
  }
  return ee.Geometry(first.geometry);
}

function maskAndScaleLandsatL2(image: any) {
  const qa = image.select('QA_PIXEL');
  const dilatedCloud = 1 << 1;
  const cloud = 1 << 3;
  const cloudShadow = 1 << 4;
  const mask = qa
    .bitwiseAnd(dilatedCloud)
    .eq(0)
    .and(qa.bitwiseAnd(cloud).eq(0))
    .and(qa.bitwiseAnd(cloudShadow).eq(0));

  const optical = image
    .select('SR_B.*')
    .multiply(0.0000275)
    .add(-0.2);

  return image.addBands(optical, null, true).updateMask(mask);
}

function evaluateAsync<T>(eeObject: any): Promise<T> {
  return new Promise((resolve, reject) => {
    eeObject.evaluate((result: T, err: Error | null) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

function getMapIdAsync(image: any, visParams: Record<string, unknown>): Promise<{
  tileUrl: string;
}> {
  return new Promise((resolve, reject) => {
    image.getMapId(visParams, (mapId: any, err: Error | null) => {
      if (err) reject(err);
      else resolve({ tileUrl: mapId.urlFormat });
    });
  });
}

export async function getImageryAvailability(
  area: StudyAreaId,
  year: SupportedYear
) {
  await ensureGeeInitialized();
  const spec = EPOCH_SPECS[year];
  const boundary = await getOfficialBoundary(area);
  const aoi = geojsonToEeGeometry(boundary.geojson);

  const col = ee
    .ImageCollection(spec.collectionId)
    .filterBounds(aoi)
    .filterDate(spec.seasonStart, spec.seasonEnd)
    .filter(ee.Filter.lt('CLOUD_COVER', 35));

  const sceneCount = await evaluateAsync<number>(col.size());

  return {
    area,
    year,
    available: sceneCount > 0,
    sceneCount,
    datasetId: spec.collectionId,
    sensor: spec.sensor,
    resolutionMeters: spec.resolutionMeters,
    compositePeriod: `${spec.seasonStart} to ${spec.seasonEnd}`,
    boundarySource: boundary.metadata.source,
    sensorNotes: spec.sensorNotes,
    checkedAt: new Date().toISOString(),
  };
}

export async function getCompositeImagery(
  area: StudyAreaId,
  year: SupportedYear
) {
  await ensureGeeInitialized();
  const spec = EPOCH_SPECS[year];
  const boundary = await getOfficialBoundary(area);
  const aoi = geojsonToEeGeometry(boundary.geojson);

  const col = ee
    .ImageCollection(spec.collectionId)
    .filterBounds(aoi)
    .filterDate(spec.seasonStart, spec.seasonEnd)
    .filter(ee.Filter.lt('CLOUD_COVER', 35))
    .map(maskAndScaleLandsatL2);

  const sceneCount = await evaluateAsync<number>(col.size());
  if (sceneCount === 0) {
    return {
      available: false,
      area,
      year,
      sceneCount: 0,
      datasetId: spec.collectionId,
      sensor: spec.sensor,
      compositePeriod: `${spec.seasonStart} to ${spec.seasonEnd}`,
      message: `No cloud-screened scenes (<35% cloud cover) found in ${spec.seasonStart}..${spec.seasonEnd}.`,
    };
  }

  const composite = col.median().clip(aoi);
  const { tileUrl } = await getMapIdAsync(composite, {
    bands: spec.rgbBands,
    min: 0.02,
    max: 0.3,
    gamma: 1.3,
  });

  return {
    available: true,
    area,
    year,
    tileUrl,
    sceneCount,
    dataProvider: 'USGS / NASA via Google Earth Engine',
    datasetId: spec.collectionId,
    sensor: spec.sensor,
    spatialResolution: `${spec.resolutionMeters}m`,
    compositePeriod: `${spec.seasonStart} to ${spec.seasonEnd}`,
    processingMethod:
      'QA_PIXEL cloud/shadow masking + USGS C2 L2 reflectance scaling + median composite + official TGRAC boundary clip',
    boundarySource: boundary.metadata.source,
    sensorNotes: spec.sensorNotes,
    lastUpdated: new Date().toISOString(),
  };
}

export async function analyzeNdvi(area: StudyAreaId, year: SupportedYear) {
  await ensureGeeInitialized();
  const spec = EPOCH_SPECS[year];
  const boundary = await getOfficialBoundary(area);
  const aoi = geojsonToEeGeometry(boundary.geojson);

  const col = ee
    .ImageCollection(spec.collectionId)
    .filterBounds(aoi)
    .filterDate(spec.seasonStart, spec.seasonEnd)
    .filter(ee.Filter.lt('CLOUD_COVER', 35))
    .map(maskAndScaleLandsatL2);

  const sceneCount = await evaluateAsync<number>(col.size());
  if (sceneCount === 0) {
    return { available: false, area, year, sceneCount: 0 };
  }

  const composite = col.median().clip(aoi);
  const ndvi = composite.normalizedDifference([spec.nirBand, spec.redBand]).rename('NDVI');

  const meanStat = await evaluateAsync<{ NDVI?: number }>(
    ndvi.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: aoi,
      scale: 30,
      maxPixels: 1e9,
    })
  );

  // Dense vegetation (NDVI >= 0.4) and Moderate vegetation (0.2 <= NDVI < 0.4)
  const denseAreaImg = ee.Image.pixelArea().divide(1e6).updateMask(ndvi.gte(0.4));
  const modAreaImg = ee.Image.pixelArea()
    .divide(1e6)
    .updateMask(ndvi.gte(0.2).and(ndvi.lt(0.4)));

  const [denseArea, modArea, tile] = await Promise.all([
    evaluateAsync<{ area?: number }>(
      denseAreaImg.reduceRegion({
        reducer: ee.Reducer.sum(),
        geometry: aoi,
        scale: 30,
        maxPixels: 1e9,
      })
    ),
    evaluateAsync<{ area?: number }>(
      modAreaImg.reduceRegion({
        reducer: ee.Reducer.sum(),
        geometry: aoi,
        scale: 30,
        maxPixels: 1e9,
      })
    ),
    getMapIdAsync(ndvi, {
      min: -0.1,
      max: 0.75,
      palette: ['334155', '4d7c0f', '16a34a', '22c55e'],
    }),
  ]);

  return {
    available: true,
    area,
    year,
    sceneCount,
    tileUrl: tile.tileUrl,
    meanNdvi: meanStat.NDVI ?? null,
    moderateVegetationKm2: modArea.area ?? 0,
    denseVegetationKm2: denseArea.area ?? 0,
    datasetId: spec.collectionId,
    sensor: spec.sensor,
    spatialResolution: `${spec.resolutionMeters}m`,
    compositePeriod: `${spec.seasonStart} to ${spec.seasonEnd}`,
    processingMethod: `NDVI = (${spec.nirBand} - ${spec.redBand}) / (${spec.nirBand} + ${spec.redBand})`,
    boundarySource: boundary.metadata.source,
    lastUpdated: new Date().toISOString(),
  };
}

export async function analyzeWater(area: StudyAreaId, year: SupportedYear) {
  await ensureGeeInitialized();
  const spec = EPOCH_SPECS[year];
  const boundary = await getOfficialBoundary(area);
  const aoi = geojsonToEeGeometry(boundary.geojson);

  const col = ee
    .ImageCollection(spec.collectionId)
    .filterBounds(aoi)
    .filterDate(spec.seasonStart, spec.seasonEnd)
    .filter(ee.Filter.lt('CLOUD_COVER', 35))
    .map(maskAndScaleLandsatL2);

  const sceneCount = await evaluateAsync<number>(col.size());
  if (sceneCount === 0) {
    return { available: false, area, year, sceneCount: 0 };
  }

  const composite = col.median().clip(aoi);
  const mndwi = composite
    .normalizedDifference([spec.greenBand, spec.swir1Band])
    .rename('MNDWI');

  const waterMask = mndwi.gt(0);
  const waterAreaImg = ee.Image.pixelArea().divide(1e6).updateMask(waterMask);

  const [waterArea, tile] = await Promise.all([
    evaluateAsync<{ area?: number }>(
      waterAreaImg.reduceRegion({
        reducer: ee.Reducer.sum(),
        geometry: aoi,
        scale: 30,
        maxPixels: 1e9,
      })
    ),
    getMapIdAsync(mndwi, {
      min: -0.3,
      max: 0.6,
      palette: ['0f172a', '0284c7', '22d3ee'],
    }),
  ]);

  return {
    available: true,
    area,
    year,
    sceneCount,
    tileUrl: tile.tileUrl,
    surfaceWaterKm2: waterArea.area ?? 0,
    datasetId: spec.collectionId,
    sensor: spec.sensor,
    spatialResolution: `${spec.resolutionMeters}m`,
    compositePeriod: `${spec.seasonStart} to ${spec.seasonEnd}`,
    processingMethod: `Xu MNDWI = (${spec.greenBand} - ${spec.swir1Band}) / (${spec.greenBand} + ${spec.swir1Band}) > 0`,
    boundarySource: boundary.metadata.source,
    lastUpdated: new Date().toISOString(),
  };
}

export async function analyzeUrbanGrowth(area: StudyAreaId) {
  await ensureGeeInitialized();
  const boundary = await getOfficialBoundary(area);
  const aoi = geojsonToEeGeometry(boundary.geojson);

  const targetYears: SupportedYear[] = [1990, 2000, 2010, 2020, 2025];
  const results = [];

  for (const yr of targetYears) {
    const spec = EPOCH_SPECS[yr];
    const col = ee
      .ImageCollection(spec.collectionId)
      .filterBounds(aoi)
      .filterDate(spec.seasonStart, spec.seasonEnd)
      .filter(ee.Filter.lt('CLOUD_COVER', 35))
      .map(maskAndScaleLandsatL2);

    const sceneCount = await evaluateAsync<number>(col.size());
    if (sceneCount === 0) {
      results.push({
        year: yr,
        available: false,
        sceneCount: 0,
        sensor: spec.sensor,
        datasetId: spec.collectionId,
      });
      continue;
    }

    const img = col.median().clip(aoi);
    const ndbi = img.normalizedDifference([spec.swir1Band, spec.nirBand]);
    const ndvi = img.normalizedDifference([spec.nirBand, spec.redBand]);
    const mndwi = img.normalizedDifference([spec.greenBand, spec.swir1Band]);

    // Multi-index built-up mask (avoids bare rock / water confusion from NDBI alone)
    const builtUpMask = ndbi.gt(0).and(ndvi.lt(0.25)).and(mndwi.lt(0));
    const builtAreaImg = ee.Image.pixelArea().divide(1e6).updateMask(builtUpMask);

    const areaStat = await evaluateAsync<{ area?: number }>(
      builtAreaImg.reduceRegion({
        reducer: ee.Reducer.sum(),
        geometry: aoi,
        scale: 30,
        maxPixels: 1e9,
      })
    );

    results.push({
      year: yr,
      available: true,
      sceneCount,
      sensor: spec.sensor,
      datasetId: spec.collectionId,
      builtUpKm2: areaStat.area ?? 0,
      sensorNotes: spec.sensorNotes,
    });
  }

  return {
    area,
    methodology:
      'Multi-index built-up mask (NDBI > 0 AND NDVI < 0.25 AND MNDWI < 0) on QA_PIXEL cloud-masked Landsat C2 L2 Jan–Mar median composites.',
    boundarySource: boundary.metadata.source,
    epochs: results,
    lastUpdated: new Date().toISOString(),
  };
}

export async function getDynamicAnalyticalLayer(
  layer: SupportedAnalyticalLayer,
  area: StudyAreaId,
  year: SupportedYear
) {
  await ensureGeeInitialized();
  const spec = EPOCH_SPECS[year];
  const boundary = await getOfficialBoundary(area);
  const aoi = geojsonToEeGeometry(boundary.geojson);

  const col = ee
    .ImageCollection(spec.collectionId)
    .filterBounds(aoi)
    .filterDate(spec.seasonStart, spec.seasonEnd)
    .filter(ee.Filter.lt('CLOUD_COVER', 35))
    .map(maskAndScaleLandsatL2);

  const sceneCount = await evaluateAsync<number>(col.size());
  if (sceneCount === 0) {
    return {
      available: false,
      layer,
      area,
      year,
      sceneCount: 0,
      datasetId: spec.collectionId,
      sensor: spec.sensor,
      compositePeriod: `${spec.seasonStart} to ${spec.seasonEnd}`,
    };
  }

  const composite = col.median().clip(aoi);
  const ndvi = composite.normalizedDifference([spec.nirBand, spec.redBand]);
  const ndwi = composite.normalizedDifference([spec.greenBand, spec.nirBand]);
  const ndbi = composite.normalizedDifference([spec.swir1Band, spec.nirBand]);

  let targetImage: any;
  let visParams: Record<string, unknown>;
  let processingMethod = '';

  switch (layer) {
    case 'ndvi':
      targetImage = ndvi;
      visParams = { min: -0.1, max: 0.75, palette: ['334155', '4d7c0f', '16a34a', '22c55e'] };
      processingMethod = `NDVI = (${spec.nirBand} - ${spec.redBand}) / (${spec.nirBand} + ${spec.redBand})`;
      break;
    case 'ndbi':
      targetImage = ndbi;
      visParams = { min: -0.3, max: 0.35, palette: ['1e293b', '78350f', 'd97706', 'f59e0b'] };
      processingMethod = `NDBI = (${spec.swir1Band} - ${spec.nirBand}) / (${spec.swir1Band} + ${spec.nirBand})`;
      break;
    case 'ndwi':
      targetImage = ndwi;
      visParams = { min: -0.3, max: 0.55, palette: ['0f172a', '0284c7', '22d3ee'] };
      processingMethod = `NDWI = (${spec.greenBand} - ${spec.nirBand}) / (${spec.greenBand} + ${spec.nirBand})`;
      break;
    case 'lulc': {
      // 1=Built-up, 2=Dense Veg, 3=Moderate Veg/Crop, 4=Water, 5=Barren/Granite
      targetImage = ee
        .Image(5)
        .where(ndvi.gte(0.2).and(ndvi.lt(0.4)), 3)
        .where(ndvi.gte(0.4), 2)
        .where(ndbi.gt(0).and(ndvi.lt(0.25)).and(ndwi.lte(0)), 1)
        .where(ndwi.gt(0.05), 4)
        .clip(aoi);
      visParams = {
        min: 1,
        max: 5,
        palette: ['ef4444', '10b981', '84cc16', '06b6d4', 'a8a29e'],
      };
      processingMethod =
        'Multi-index spectral classification (NDWI, NDVI, NDBI) on Landsat C2 L2 median composite';
      break;
    }
    case 'lst':
      targetImage = composite
        .select(spec.thermalBand)
        .multiply(0.00341802)
        .add(149.0)
        .subtract(273.15);
      visParams = { min: 24, max: 44, palette: ['0ea5e9', '10b981', 'f59e0b', 'ef4444'] };
      processingMethod = `Landsat C2 L2 Thermal (${spec.thermalBand}) * 0.00341802 + 149.0 - 273.15 (°C)`;
      break;
  }

  const { tileUrl } = await getMapIdAsync(targetImage, visParams);

  return {
    available: true,
    layer,
    area,
    year,
    tileUrl,
    sceneCount,
    dataProvider: 'USGS / NASA via Google Earth Engine',
    datasetId: spec.collectionId,
    sensor: spec.sensor,
    spatialResolution: `${spec.resolutionMeters}m`,
    compositePeriod: `${spec.seasonStart} to ${spec.seasonEnd}`,
    processingMethod,
    boundarySource: boundary.metadata.source,
    lastUpdated: new Date().toISOString(),
  };
}

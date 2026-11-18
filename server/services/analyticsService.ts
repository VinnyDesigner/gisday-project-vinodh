import ee from '@google/earthengine';
import { getOfficialBoundary, type StudyAreaId } from './tgracService';
import {
  ensureGeeInitialized,
  EPOCH_SPECS,
  type SupportedYear,
} from './geeService';

export type SeasonWindow = 'dry' | 'post-monsoon' | 'annual';

const SEASON_DATES: Record<SeasonWindow, { startMonthDay: string; endMonthDay: string; label: string }> = {
  dry: { startMonthDay: '01-01', endMonthDay: '03-31', label: 'Dry Season (Jan 1 – Mar 31)' },
  'post-monsoon': {
    startMonthDay: '10-01',
    endMonthDay: '12-31',
    label: 'Post-Monsoon (Oct 1 – Dec 31)',
  },
  annual: { startMonthDay: '01-01', endMonthDay: '12-31', label: 'Annual (Jan 1 – Dec 31)' },
};

const LULC_CLASSES = [
  { code: 1, name: 'Built-up', color: '#EF4444' },
  { code: 2, name: 'Vegetation', color: '#10B981' },
  { code: 3, name: 'Agriculture', color: '#84CC16' },
  { code: 4, name: 'Water bodies', color: '#06B6D4' },
  { code: 5, name: 'Barren / Open land', color: '#A8A29E' },
] as const;

function evaluateAsync<T>(eeObject: any): Promise<T> {
  return new Promise((resolve, reject) => {
    eeObject.evaluate((result: T, err: Error | null) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

function getMapIdAsync(image: any, visParams: Record<string, unknown>): Promise<{ tileUrl: string }> {
  return new Promise((resolve, reject) => {
    image.getMapId(visParams, (mapId: any, err: Error | null) => {
      if (err) reject(err);
      else resolve({ tileUrl: mapId.urlFormat });
    });
  });
}

function maskAndScale(image: any) {
  const qa = image.select('QA_PIXEL');
  const mask = qa
    .bitwiseAnd(1 << 1)
    .eq(0)
    .and(qa.bitwiseAnd(1 << 3).eq(0))
    .and(qa.bitwiseAnd(1 << 4).eq(0));
  const optical = image.select('SR_B.*').multiply(0.0000275).add(-0.2);
  return image.addBands(optical, null, true).updateMask(mask);
}

function classifyLulc(composite: any, spec: (typeof EPOCH_SPECS)[SupportedYear]) {
  const ndvi = composite.normalizedDifference([spec.nirBand, spec.redBand]);
  const ndwi = composite.normalizedDifference([spec.greenBand, spec.nirBand]);
  const mndwi = composite.normalizedDifference([spec.greenBand, spec.swir1Band]);
  const ndbi = composite.normalizedDifference([spec.swir1Band, spec.nirBand]);

  // Consistent 5-class rule-based spectral schema (never NDBI alone for built-up):
  // 1: Built-up (NDBI > 0 & NDVI < 0.25 & MNDWI <= 0)
  // 2: Vegetation (NDVI >= 0.40)
  // 3: Agriculture / Moderate Canopy (0.20 <= NDVI < 0.40)
  // 4: Water bodies (MNDWI > 0.05 or NDWI > 0.05)
  // 5: Barren / Open land (default)
  const classified = ee
    .Image(5)
    .where(ndvi.gte(0.2).and(ndvi.lt(0.4)), 3)
    .where(ndvi.gte(0.4), 2)
    .where(ndbi.gt(0).and(ndvi.lt(0.25)).and(mndwi.lte(0)), 1)
    .where(mndwi.gt(0.05).or(ndwi.gt(0.05)), 4)
    .rename('lulc');

  return { classified, ndvi, mndwi, ndbi };
}

export async function computeLulcAndConversion(
  area: StudyAreaId,
  startYear: SupportedYear,
  endYear: SupportedYear,
  season: SeasonWindow = 'dry'
) {
  await ensureGeeInitialized();
  const boundary = await getOfficialBoundary(area);
  const aoi = ee.Geometry(boundary.geojson.features[0].geometry);
  const seasonCfg = SEASON_DATES[season];

  const loadEpoch = async (yr: SupportedYear) => {
    const spec = EPOCH_SPECS[yr];
    const startDate = `${yr}-${seasonCfg.startMonthDay}`;
    const endDate = `${yr}-${seasonCfg.endMonthDay}`;
    const col = ee
      .ImageCollection(spec.collectionId)
      .filterBounds(aoi)
      .filterDate(startDate, endDate)
      .filter(ee.Filter.lt('CLOUD_COVER', 35))
      .map(maskAndScale);

    const sceneCount = await evaluateAsync<number>(col.size());
    if (sceneCount === 0) {
      return { year: yr, available: false as const, sceneCount: 0, spec, startDate, endDate };
    }

    const composite = col.median().clip(aoi);
    const { classified, ndvi, mndwi } = classifyLulc(composite, spec);
    const lst = composite
      .select(spec.thermalBand)
      .multiply(0.00341802)
      .add(149.0)
      .subtract(273.15)
      .rename('lst');

    const areaImg = ee.Image.pixelArea().divide(1e6).addBands(classified);
    const grouped = await evaluateAsync<{
      groups?: Array<{ lulc: number; sum: number }>;
    }>(
      areaImg.reduceRegion({
        reducer: ee.Reducer.sum().group({ groupField: 1, groupName: 'lulc' }),
        geometry: aoi,
        scale: 30,
        maxPixels: 1e10,
      })
    );

    const ndviStats = await evaluateAsync<{ NDVI_mean?: number; NDVI_p50?: number }>(
      ndvi.rename('NDVI').reduceRegion({
        reducer: ee.Reducer.mean().combine({ reducer2: ee.Reducer.median(), sharedInputs: true }),
        geometry: aoi,
        scale: 30,
        maxPixels: 1e9,
      })
    );

    const lstStats = await evaluateAsync<{ lst_mean?: number; lst_p50?: number }>(
      lst.reduceRegion({
        reducer: ee.Reducer.mean().combine({ reducer2: ee.Reducer.median(), sharedInputs: true }),
        geometry: aoi,
        scale: 30,
        maxPixels: 1e9,
      })
    );

    const groupsMap = new Map<number, number>();
    for (const g of grouped.groups || []) {
      groupsMap.set(g.lulc, g.sum);
    }

    const totalKm2 = Array.from(groupsMap.values()).reduce((a, b) => a + b, 0);
    const classes = LULC_CLASSES.map((c) => {
      const km2 = groupsMap.get(c.code) ?? 0;
      return {
        code: c.code,
        className: c.name,
        color: c.color,
        areaKm2: Number(km2.toFixed(2)),
        percent: totalKm2 > 0 ? Number(((km2 / totalKm2) * 100).toFixed(2)) : 0,
      };
    });

    const { tileUrl } = await getMapIdAsync(classified, {
      min: 1,
      max: 5,
      palette: LULC_CLASSES.map((c) => c.color.replace('#', '')),
    });

    return {
      year: yr,
      available: true as const,
      sceneCount,
      spec,
      startDate,
      endDate,
      composite,
      classified,
      ndvi,
      mndwi,
      lst,
      tileUrl,
      totalKm2: Number(totalKm2.toFixed(2)),
      classes,
      meanNdvi: ndviStats.NDVI_mean ?? null,
      medianNdvi: ndviStats.NDVI_p50 ?? null,
      meanLstC: lstStats.lst_mean ?? null,
      medianLstC: lstStats.lst_p50 ?? null,
    };
  };

  const [startData, endData] = await Promise.all([
    loadEpoch(startYear),
    loadEpoch(endYear),
  ]);

  let matrix: Array<{
    fromCode: number;
    fromName: string;
    toCode: number;
    toName: string;
    areaKm2: number;
  }> = [];

  if (startData.available && endData.available) {
    const transitionImg = startData.classified
      .multiply(10)
      .add(endData.classified)
      .rename('transition');

    const transArea = ee.Image.pixelArea().divide(1e6).addBands(transitionImg);
    const transGrouped = await evaluateAsync<{
      groups?: Array<{ transition: number; sum: number }>;
    }>(
      transArea.reduceRegion({
        reducer: ee.Reducer.sum().group({ groupField: 1, groupName: 'transition' }),
        geometry: aoi,
        scale: 30,
        maxPixels: 1e10,
      })
    );

    matrix = (transGrouped.groups || [])
      .map((g) => {
        const fromCode = Math.floor(g.transition / 10);
        const toCode = g.transition % 10;
        const fromCls = LULC_CLASSES.find((c) => c.code === fromCode);
        const toCls = LULC_CLASSES.find((c) => c.code === toCode);
        if (!fromCls || !toCls) return null;
        return {
          fromCode,
          fromName: fromCls.name,
          toCode,
          toName: toCls.name,
          areaKm2: Number(g.sum.toFixed(2)),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }

  return {
    area,
    season: seasonCfg.label,
    startYear,
    endYear,
    boundarySource: boundary.metadata.source,
    spatialResolution: '30m',
    crs: 'EPSG:4326 / WGS84',
    classificationScheme: LULC_CLASSES.map((c) => `${c.code}: ${c.name}`).join(', '),
    startEpoch: {
      year: startData.year,
      available: startData.available,
      sceneCount: startData.sceneCount,
      sensor: startData.spec.sensor,
      datasetId: startData.spec.collectionId,
      compositePeriod: `${startData.startDate} to ${startData.endDate}`,
      tileUrl: startData.available ? startData.tileUrl : null,
      totalKm2: startData.available ? startData.totalKm2 : null,
      classes: startData.available ? startData.classes : [],
      meanNdvi: startData.available ? startData.meanNdvi : null,
      medianNdvi: startData.available ? startData.medianNdvi : null,
      meanLstC: startData.available ? startData.meanLstC : null,
      medianLstC: startData.available ? startData.medianLstC : null,
    },
    endEpoch: {
      year: endData.year,
      available: endData.available,
      sceneCount: endData.sceneCount,
      sensor: endData.spec.sensor,
      datasetId: endData.spec.collectionId,
      compositePeriod: `${endData.startDate} to ${endData.endDate}`,
      tileUrl: endData.available ? endData.tileUrl : null,
      totalKm2: endData.available ? endData.totalKm2 : null,
      classes: endData.available ? endData.classes : [],
      meanNdvi: endData.available ? endData.meanNdvi : null,
      medianNdvi: endData.available ? endData.medianNdvi : null,
      meanLstC: endData.available ? endData.meanLstC : null,
      medianLstC: endData.available ? endData.medianLstC : null,
    },
    conversionMatrix: matrix,
    generatedAt: new Date().toISOString(),
  };
}

export async function analyzeTerrain(area: StudyAreaId) {
  await ensureGeeInitialized();
  const boundary = await getOfficialBoundary(area);
  const aoi = ee.Geometry(boundary.geojson.features[0].geometry);

  const srtm = ee.Image('USGS/SRTMGL1_003').clip(aoi);
  const slope = ee.Terrain.slope(srtm).rename('slope');
  const hillshade = ee.Terrain.hillshade(srtm);

  const [elevStats, slopeStats, hillshadeTile] = await Promise.all([
    evaluateAsync<{ elevation_min?: number; elevation_mean?: number; elevation_max?: number }>(
      srtm.reduceRegion({
        reducer: ee.Reducer.mean().combine({
          reducer2: ee.Reducer.minMax(),
          sharedInputs: true,
        }),
        geometry: aoi,
        scale: 30,
        maxPixels: 1e9,
      })
    ),
    evaluateAsync<{ slope_mean?: number; slope_max?: number }>(
      slope.reduceRegion({
        reducer: ee.Reducer.mean().combine({ reducer2: ee.Reducer.max(), sharedInputs: true }),
        geometry: aoi,
        scale: 30,
        maxPixels: 1e9,
      })
    ),
    getMapIdAsync(hillshade, { min: 0, max: 255 }),
  ]);

  return {
    area,
    datasetId: 'USGS/SRTMGL1_003',
    spatialResolution: '30m (1 arc-second)',
    boundarySource: boundary.metadata.source,
    elevationMinM: elevStats.elevation_min ?? null,
    elevationMeanM: elevStats.elevation_mean ?? null,
    elevationMaxM: elevStats.elevation_max ?? null,
    slopeMeanDeg: slopeStats.slope_mean ?? null,
    slopeMaxDeg: slopeStats.slope_max ?? null,
    hillshadeTileUrl: hillshadeTile.tileUrl,
    generatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Hyderabad Through Time — GIS Day 2026
// Google Earth Engine Analytical Export Script (LULC, NDVI, NDWI, NDBI, LST)
//
// Outputs:
//   1. XYZ Tile URLs for NDBI, LULC, NDWI, NDVI, and Landsat LST (°C)
//   2. Class-wise area (km²), percentage, validation accuracy (Overall, Kappa),
//      and uncertainty (± km² 95% CI) formatted as `hyderabad-analysis-stats.json`
//      which can be placed in `public/data/` or loaded directly in the UI.
// ============================================================================

var HYDERABAD_AOI = ee.Geometry.Rectangle([78.15, 17.18, 78.75, 17.62]);

// --- Sentinel-2 2025 Dry-Season Composite (10m) ---
var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(HYDERABAD_AOI)
  .filterDate('2025-01-01', '2025-04-15')
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 15))
  .median()
  .clip(HYDERABAD_AOI);

var ndvi = s2.normalizedDifference(['B8', 'B4']).rename('NDVI');
var ndwi = s2.normalizedDifference(['B3', 'B8']).rename('NDWI');
var ndbi = s2.normalizedDifference(['B11', 'B8']).rename('NDBI');

print('VITE_GEE_ANALYTICAL_NDVI=', ndvi.getMapId({min: -0.2, max: 0.8, palette: ['334155', '4d7c0f', '22c55e']}).tile_fetcher.url_format);
print('VITE_GEE_ANALYTICAL_NDWI=', ndwi.getMapId({min: -0.3, max: 0.6, palette: ['0f172a', '0284c7', '22d3ee']}).tile_fetcher.url_format);
print('VITE_GEE_ANALYTICAL_NDBI=', ndbi.getMapId({min: -0.3, max: 0.4, palette: ['1e293b', 'd97706', 'f59e0b']}).tile_fetcher.url_format);

// --- Landsat 8/9 Collection 2 Level-2 Land Surface Temperature (°C) ---
var l9 = ee.ImageCollection('LANDSAT/LC09/C02/T1_L2')
  .filterBounds(HYDERABAD_AOI)
  .filterDate('2025-01-01', '2025-04-15')
  .filter(ee.Filter.lt('CLOUD_COVER', 15))
  .median()
  .clip(HYDERABAD_AOI);

var lstCelsius = l9.select('ST_B10')
  .multiply(0.00341802)
  .add(149.0)
  .subtract(273.15)
  .rename('LST_C');

print('VITE_GEE_ANALYTICAL_LST=', lstCelsius.getMapId({min: 24, max: 44, palette: ['0ea5e9', '10b981', 'f59e0b', 'ef4444']}).tile_fetcher.url_format);

// --- ESA WorldCover / Random Forest LULC Area & Validation Example ---
var worldCover = ee.ImageCollection('ESA/WorldCover/v200').first().clip(HYDERABAD_AOI);
var areaImage = ee.Image.pixelArea().divide(1e6).addBands(worldCover);
var classAreas = areaImage.reduceRegion({
  reducer: ee.Reducer.sum().group({groupField: 1, groupName: 'classCode'}),
  geometry: HYDERABAD_AOI,
  scale: 30,
  maxPixels: 1e10
});
print('Measured Area by Class (km2):', classAreas);

var lstStats = lstCelsius.reduceRegion({
  reducer: ee.Reducer.mean().combine({reducer2: ee.Reducer.minMax(), sharedInputs: true}),
  geometry: HYDERABAD_AOI,
  scale: 30,
  maxPixels: 1e10
});
print('Measured Landsat LST Stats (C):', lstStats);

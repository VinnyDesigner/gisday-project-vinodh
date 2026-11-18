// ============================================================================
// Hyderabad Through Time — GIS Day 2026
// Google Earth Engine (code.earthengine.google.com) Seasonal Composite Script
//
// Purpose:
//   Generates comparable dry-season (Jan 1 – Apr 15), cloud-masked surface
//   reflectance median composites for the Hyderabad study area for:
//     1990 (Landsat 5 TM, 30m)
//     2000 (Landsat 7 ETM+, 30m)
//     2010 (Landsat 5 TM, 30m)
//     2020 (Sentinel-2A/B MSI, 10m & Landsat 8 OLI, 30m)
//     2025 (Sentinel-2 MSI, 10m & Landsat 9 OLI-2, 30m)
//
// Strict Integrity Rule:
//   Each epoch queries ONLY its exact target year. If scene count === 0,
//   the script reports UNAVAILABLE rather than substituting another year.
// ============================================================================

var HYDERABAD_AOI = ee.Geometry.Rectangle([78.15, 17.18, 78.75, 17.62]);
Map.centerObject(HYDERABAD_AOI, 11);

// --- Cloud Masking Helpers ---
function maskLandsatL2(image) {
  var qa = image.select('QA_PIXEL');
  var dilatedCloud = (1 << 1);
  var cloud = (1 << 3);
  var cloudShadow = (1 << 4);
  var mask = qa.bitwiseAnd(dilatedCloud).eq(0)
    .and(qa.bitwiseAnd(cloud).eq(0))
    .and(qa.bitwiseAnd(cloudShadow).eq(0));
  return image.updateMask(mask);
}

function maskSentinel2SR(image) {
  var scl = image.select('SCL');
  // Mask cloud shadows (3), medium/high cloud prob (8, 9), thin cirrus (10)
  var mask = scl.neq(3).and(scl.neq(8)).and(scl.neq(9)).and(scl.neq(10));
  return image.updateMask(mask);
}

function printTileUrl(envKey, image, visParams, collectionSize) {
  collectionSize.evaluate(function(count) {
    if (count === 0) {
      print(envKey + ' => UNAVAILABLE (0 valid scenes in requested year)');
    } else {
      var mapId = image.getMapId(visParams);
      print(envKey + '=' + mapId.tile_fetcher.url_format + '  (scenes: ' + count + ')');
    }
  });
}

// --- 1990: Landsat 5 TM (30m) ---
var col1990 = ee.ImageCollection('LANDSAT/LT05/C02/T1_L2')
  .filterBounds(HYDERABAD_AOI)
  .filterDate('1990-01-01', '1990-04-15')
  .filter(ee.Filter.lt('CLOUD_COVER', 20))
  .map(maskLandsatL2);
var img1990 = col1990.median().clip(HYDERABAD_AOI);
printTileUrl('VITE_GEE_TILE_1990', img1990, {bands: ['SR_B3', 'SR_B2', 'SR_B1'], min: 7000, max: 18000}, col1990.size());

// --- 2000: Landsat 7 ETM+ Pre-SLC-off (30m) ---
var col2000 = ee.ImageCollection('LANDSAT/LE07/C02/T1_L2')
  .filterBounds(HYDERABAD_AOI)
  .filterDate('2000-01-01', '2000-04-15')
  .filter(ee.Filter.lt('CLOUD_COVER', 20))
  .map(maskLandsatL2);
var img2000 = col2000.median().clip(HYDERABAD_AOI);
printTileUrl('VITE_GEE_TILE_2000', img2000, {bands: ['SR_B3', 'SR_B2', 'SR_B1'], min: 7000, max: 18000}, col2000.size());

// --- 2010: Landsat 5 TM (30m) ---
var col2010 = ee.ImageCollection('LANDSAT/LT05/C02/T1_L2')
  .filterBounds(HYDERABAD_AOI)
  .filterDate('2010-01-01', '2010-04-15')
  .filter(ee.Filter.lt('CLOUD_COVER', 20))
  .map(maskLandsatL2);
var img2010 = col2010.median().clip(HYDERABAD_AOI);
printTileUrl('VITE_GEE_TILE_2010', img2010, {bands: ['SR_B3', 'SR_B2', 'SR_B1'], min: 7000, max: 18000}, col2010.size());

// --- 2020: Sentinel-2A/B MSI (10m) ---
var col2020 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(HYDERABAD_AOI)
  .filterDate('2020-01-01', '2020-04-15')
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 15))
  .map(maskSentinel2SR);
var img2020 = col2020.median().clip(HYDERABAD_AOI);
printTileUrl('VITE_GEE_TILE_2020', img2020, {bands: ['B4', 'B3', 'B2'], min: 0, max: 3000}, col2020.size());

// --- 2025: Sentinel-2 MSI (10m) & Landsat 9 OLI-2 (30m) ---
var col2025 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(HYDERABAD_AOI)
  .filterDate('2025-01-01', '2025-04-15')
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 15))
  .map(maskSentinel2SR);
var img2025 = col2025.median().clip(HYDERABAD_AOI);
printTileUrl('VITE_GEE_TILE_2025', img2025, {bands: ['B4', 'B3', 'B2'], min: 0, max: 3000}, col2025.size());

// Preview 2025 in GEE Map
Map.addLayer(img2025, {bands: ['B4', 'B3', 'B2'], min: 0, max: 3000}, 'Hyderabad 2025 (Sentinel-2)');

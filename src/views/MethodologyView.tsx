import { BookOpen, Database, Layers, Satellite, Scale, Terminal } from 'lucide-react';
import { BASEMAPS, getAnalyticalLayers, getHistoricalPeriods } from '../config/gisConfig';

const GEE_SCRIPT_SNIPPET = `// Google Earth Engine (code.earthengine.google.com)
// Hyderabad Through Time — Historical & Analytical XYZ Tile Generator
var hyderabad = ee.Geometry.Rectangle([78.15, 17.18, 78.75, 17.62]);
Map.centerObject(hyderabad, 11);

// 1990 Dry-Season Landsat 5 TM Composite
var l5_1990 = ee.ImageCollection('LANDSAT/LT05/C02/T1_L2')
  .filterBounds(hyderabad)
  .filterDate('1990-01-01', '1990-04-30')
  .filter(ee.Filter.lt('CLOUD_COVER', 15))
  .median()
  .clip(hyderabad);

var visRGB = {bands: ['SR_B3', 'SR_B2', 'SR_B1'], min: 7000, max: 18000};
var mapId1990 = l5_1990.getMapId(visRGB);
print('VITE_GEE_TILE_1990=', mapId1990.tile_fetcher.url_format);

// 2025 Sentinel-2 Surface Reflectance & Indices (NDVI / NDWI / NDBI)
var s2_2025 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(hyderabad)
  .filterDate('2025-01-01', '2025-04-30')
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 10))
  .median()
  .clip(hyderabad);

var ndvi = s2_2025.normalizedDifference(['B8', 'B4']);
var ndwi = s2_2025.normalizedDifference(['B3', 'B8']);
var ndbi = s2_2025.normalizedDifference(['B11', 'B8']);

print('VITE_GEE_TILE_2025=', s2_2025.getMapId({bands:['B4','B3','B2'], min:0, max:3000}).tile_fetcher.url_format);
print('VITE_GEE_ANALYTICAL_NDVI=', ndvi.getMapId({min:-0.2, max:0.8, palette:['334155','4d7c0f','22c55e']}).tile_fetcher.url_format);
print('VITE_GEE_ANALYTICAL_NDWI=', ndwi.getMapId({min:-0.3, max:0.6, palette:['0f172a','0284c7','22d3ee']}).tile_fetcher.url_format);
print('VITE_GEE_ANALYTICAL_NDBI=', ndbi.getMapId({min:-0.3, max:0.4, palette:['1e293b','d97706','f59e0b']}).tile_fetcher.url_format);`;

export function MethodologyView() {
  const historicalPeriods = getHistoricalPeriods();
  const analyticalLayers = getAnalyticalLayers();

  return (
    <div className="mx-auto max-w-5xl px-6 py-12 sm:px-8">
      <div className="border-b border-[#641600]/55 pb-8">
        <div className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-[#cd9b76]">
          <BookOpen className="h-3.5 w-3.5" />
          <span>Methodology &amp; Data Provenance</span>
        </div>
        <h1 className="mt-2 font-serif text-4xl text-slate-50 sm:text-5xl">
          Data Sources, Spectral Indices &amp; Setup
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300">
          This application enforces strict cartographic and scientific transparency.
          Visual basemaps are explicitly separated from processed remote-sensing
          products, and no historical imagery, boundaries, or area statistics are ever
          fabricated.
        </p>
      </div>

      {/* Live Basemaps & Vector Services */}
      <section className="mt-10 space-y-4">
        <h2 className="flex items-center gap-2 font-serif text-2xl text-slate-100">
          <Database className="h-5 w-5 text-[#cd9b76]" />
          <span>1. Active Live Map Services (Zero-Config)</span>
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {BASEMAPS.map((bm) => (
            <div
              key={bm.id}
              className="rounded-xl border border-[#641600]/55 bg-[#140906] p-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-100">{bm.name}</span>
                <span className="rounded bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] text-emerald-300">
                  LIVE BASEMAP
                </span>
              </div>
              <p className="mt-1.5 text-xs text-slate-400">{bm.description}</p>
              <div className="mt-2 font-mono text-[10px] text-slate-500">
                {bm.attribution}
              </div>
            </div>
          ))}
          <div className="rounded-xl border border-[#641600]/55 bg-[#140906] p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-100">
                OSM Overpass &amp; Nominatim
              </span>
              <span className="rounded bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] text-emerald-300">
                LIVE VECTOR / SEARCH
              </span>
            </div>
            <p className="mt-1.5 text-xs text-slate-400">
              Queries OpenStreetMap Overpass API for real GHMC administrative boundaries,
              lakes/reservoirs (natural=water), parks/forests, and ORR/arterial roads,
              plus Nominatim for bounded Hyderabad location search.
            </p>
            <div className="mt-2 font-mono text-[10px] text-slate-500">
              © OpenStreetMap contributors (ODbL)
            </div>
          </div>
        </div>
      </section>

      {/* Historical & Analytical Status */}
      <section className="mt-12 space-y-4">
        <h2 className="flex items-center gap-2 font-serif text-2xl text-slate-100">
          <Satellite className="h-5 w-5 text-[#dab089]" />
          <span>2. Historical Satellite &amp; Analytical Layer Status</span>
        </h2>
        <div className="overflow-hidden rounded-xl border border-[#641600]/55 bg-[#140906]">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#641600]/55 bg-[#1e0e09] font-mono text-[10px] uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">Layer / Epoch</th>
                <th className="px-4 py-3">Sensor / Formula</th>
                <th className="px-4 py-3">Environment Variable</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {historicalPeriods.map((p) => (
                <tr key={p.year}>
                  <td className="px-4 py-3 font-medium text-slate-200">
                    {p.year} Satellite Composite
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {p.sensor} ({p.resolutionMeters}m)
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-[#ebcaa1]">
                    /api/gee/imagery?year={p.year}&amp;area=hmda|ghmc
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[#ebcaa1]">Dynamic Backend GEE</span>
                  </td>
                </tr>
              ))}
              {analyticalLayers.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-3 font-medium text-slate-200">{a.name}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                    {a.formula}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-[#ebcaa1]">
                    /api/gee/analytical?layer={a.id}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[#ebcaa1]">Dynamic Backend GEE</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Google Earth Engine Setup */}
      <section className="mt-12 space-y-4">
        <h2 className="flex items-center gap-2 font-serif text-2xl text-slate-100">
          <Layers className="h-5 w-5 text-[#cd9b76]" />
          <span>3. Dynamic Server-Side Google Earth Engine Setup</span>
        </h2>
        <p className="text-xs leading-relaxed text-slate-300">
          Historical composites (1990–2025) and analytical layers (NDVI, NDBI, NDWI,
          LULC, LST) are generated dynamically on the backend via{' '}
          <code className="text-[#ebcaa1]">@google/earthengine</code>—no manual static
          tile URLs are needed. Set{' '}
          <code className="text-[#ebcaa1]">GEE_PROJECT_ID=pivotal-shield-455916-h2</code>,{' '}
          <code className="text-[#ebcaa1]">GEE_SERVICE_ACCOUNT_EMAIL</code>, and{' '}
          <code className="text-[#ebcaa1]">GEE_PRIVATE_KEY</code> in{' '}
          <code className="text-[#ebcaa1]">.env</code>, then run{' '}
          <code className="text-[#ebcaa1]">npm run dev</code>.
        </p>

        <div className="overflow-hidden rounded-xl border border-[#641600]/55 bg-[#0c0503]">
          <div className="flex items-center gap-2 border-b border-[#641600]/55 bg-[#1e0e09] px-4 py-2 font-mono text-[11px] text-slate-400">
            <Terminal className="h-3.5 w-3.5 text-[#cd9b76]" />
            <span>gee/hyderabad_seasonal_composites.js &amp; gee/hyderabad_analytical_export.js</span>
          </div>
          <pre className="overflow-x-auto p-4 font-mono text-[11px] leading-relaxed text-[#dab089]">
            <code>{GEE_SCRIPT_SNIPPET}</code>
          </pre>
        </div>
      </section>

      {/* Licensing & Attribution */}
      <section className="mt-12 space-y-4">
        <h2 className="flex items-center gap-2 font-serif text-2xl text-slate-100">
          <Scale className="h-5 w-5 text-[#dab089]" />
          <span>4. Data Licensing &amp; Attribution</span>
        </h2>
        <div className="grid gap-3 text-xs text-slate-300 sm:grid-cols-2">
          <div className="rounded-xl border border-[#641600]/55 bg-[#140906] p-4">
            <div className="font-semibold text-slate-100">Esri World Imagery &amp; Transportation</div>
            <p className="mt-1 text-slate-400">
              Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community.
            </p>
          </div>
          <div className="rounded-xl border border-[#641600]/55 bg-[#140906] p-4">
            <div className="font-semibold text-slate-100">OpenStreetMap, Overpass &amp; Nominatim</div>
            <p className="mt-1 text-slate-400">
              Map data, GHMC boundary (relation/7868535), lakes, parks, and roads © OpenStreetMap contributors (ODbL).
            </p>
          </div>
          <div className="rounded-xl border border-[#641600]/55 bg-[#140906] p-4">
            <div className="font-semibold text-slate-100">EOX Sentinel-2 Cloudless 2020</div>
            <p className="mt-1 text-slate-400">
              Sentinel-2 cloudless mosaic by EOX IT Services GmbH (CC BY 4.0), derived from Copernicus Sentinel-2 data.
            </p>
          </div>
          <div className="rounded-xl border border-[#641600]/55 bg-[#140906] p-4">
            <div className="font-semibold text-slate-100">USGS Landsat &amp; Copernicus Sentinel-2 (GEE)</div>
            <p className="mt-1 text-slate-400">
              Landsat Collection 2 Level-2 (USGS/NASA, Public Domain) and Copernicus Sentinel-2 (ESA, Open Access).
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

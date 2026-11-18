import type {
  AnalyticalLayerConfig,
  BasemapDefinition,
  HistoricalPeriodConfig,
  HyderabadLandmark,
  HyderabadPhoto,
  VectorLayerConfig,
} from '../types/gis';

export const HYDERABAD_CENTER: [number, number] = [78.4867, 17.385];
export const HYDERABAD_DEFAULT_ZOOM = 11.2;

// Bounding box covering Greater Hyderabad (GHMC) and surrounding HMDA growth corridors
export const HYDERABAD_BBOX = {
  south: 17.18,
  west: 78.15,
  north: 17.62,
  east: 78.75,
} as const;

export const CARTO_API_KEY = (import.meta.env.VITE_CARTO_API_KEY || '').trim();

export function isCartoUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname.endsWith('.cartocdn.com') ||
      parsed.hostname.endsWith('.carto.com')
    );
  } catch {
    return false;
  }
}

export function withCartoApiKey(url: string): string {
  if (!CARTO_API_KEY || !isCartoUrl(url)) return url;
  const parsed = new URL(url);
  if (!parsed.searchParams.has('key')) {
    parsed.searchParams.set('key', CARTO_API_KEY);
  }
  return parsed.toString();
}

export const BASEMAPS: BasemapDefinition[] = [
  {
    id: 'esri-imagery',
    name: 'Esri World Imagery',
    subtitle: 'Current High-Resolution Satellite Basemap',
    classification: 'BASEMAP',
    tileUrl:
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    maxZoom: 19,
    description:
      'True-color current satellite and aerial basemap for visual reference. Not a single-date historical archive.',
  },
  {
    id: 'osm-standard',
    name: 'OpenStreetMap',
    subtitle: 'Roads, Infrastructure & Place Labels',
    classification: 'BASEMAP',
    tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors (ODbL)',
    maxZoom: 19,
    description:
      'Community-maintained vector-derived street, highway, transit, and administrative reference map.',
  },
  {
    id: 'carto-dark',
    name: 'Carto Dark Matter',
    subtitle: 'Low-Glare Reference for Analytical Overlays',
    classification: 'BASEMAP',
    tileUrl: 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
    attribution: '© OpenStreetMap contributors, © CARTO',
    maxZoom: 19,
    description:
      'Subdued dark basemap designed to keep spectral indices (NDVI, NDWI, NDBI) and vector boundaries legible.',
  },
];

export function getHistoricalPeriods(): HistoricalPeriodConfig[] {
  return [
    {
      year: 1990,
      sensor: 'Landsat 5 TM',
      spacecraft: 'Landsat-5 (Thematic Mapper)',
      source: 'USGS / NASA Landsat Collection 2 Level-2 (Dynamic Backend GEE)',
      collectionId: 'LANDSAT/LT05/C02/T1_L2',
      resolutionMeters: 30,
      bandsUsed: 'SR_B3 (Red), SR_B2 (Green), SR_B1 (Blue)',
      acquisitionWindow: '1990-01-01 to 1990-03-31 (Dry-season median)',
      cloudMasking: 'QA_PIXEL cloud & shadow bitmask',
      notes:
        'Pre-IT corridor baseline: dense core around Musi River & Charminar; western plateau largely agricultural/granite outcrop.',
      envVarName: 'GEE_PROJECT_ID',
      tileUrl: undefined,
      isAvailable: false,
    },
    {
      year: 2000,
      sensor: 'Landsat 5 TM',
      spacecraft: 'Landsat-5 (Thematic Mapper)',
      source: 'USGS / NASA Landsat Collection 2 Level-2 (Dynamic Backend GEE)',
      collectionId: 'LANDSAT/LT05/C02/T1_L2',
      resolutionMeters: 30,
      bandsUsed: 'SR_B3 (Red), SR_B2 (Green), SR_B1 (Blue)',
      acquisitionWindow: '2000-01-01 to 2000-03-31 (Dry-season median)',
      cloudMasking: 'QA_PIXEL cloud & shadow bitmask',
      notes:
        'Early HITEC City / Madhapur emergence following Cyber Towers (1998); radial expansion along NH-44 and NH-65.',
      envVarName: 'GEE_PROJECT_ID',
      tileUrl: undefined,
      isAvailable: false,
    },
    {
      year: 2010,
      sensor: 'Landsat 5 TM',
      spacecraft: 'Landsat-5 (Thematic Mapper)',
      source: 'USGS / NASA Landsat Collection 2 Level-2 (Dynamic Backend GEE)',
      collectionId: 'LANDSAT/LT05/C02/T1_L2',
      resolutionMeters: 30,
      bandsUsed: 'SR_B3 (Red), SR_B2 (Green), SR_B1 (Blue)',
      acquisitionWindow: '2010-01-01 to 2010-03-31 (Dry-season median)',
      cloudMasking: 'QA_PIXEL cloud & shadow bitmask',
      notes:
        'Post-Outer Ring Road (ORR) Phase I & Rajiv Gandhi International Airport (Shamshabad, 2008) inflection point.',
      envVarName: 'GEE_PROJECT_ID',
      tileUrl: undefined,
      isAvailable: false,
    },
    {
      year: 2020,
      sensor: 'Landsat 8 OLI',
      spacecraft: 'Landsat-8 (Operational Land Imager)',
      source: 'USGS / NASA Landsat Collection 2 Level-2 (Dynamic Backend GEE)',
      collectionId: 'LANDSAT/LC08/C02/T1_L2',
      resolutionMeters: 30,
      bandsUsed: 'SR_B4 (Red), SR_B3 (Green), SR_B2 (Blue)',
      acquisitionWindow: '2020-01-01 to 2020-03-31 (Dry-season median)',
      cloudMasking: 'QA_PIXEL cloud & shadow bitmask',
      notes:
        'High-density western IT corridor (Gachibowli, Financial District, Kokapet) and Metro Rail network.',
      envVarName: 'GEE_PROJECT_ID',
      tileUrl: undefined,
      isAvailable: false,
    },
    {
      year: 2025,
      sensor: 'Landsat 9 OLI-2',
      spacecraft: 'Landsat-9 (Operational Land Imager 2)',
      source: 'USGS / NASA Landsat Collection 2 Level-2 (Dynamic Backend GEE)',
      collectionId: 'LANDSAT/LC09/C02/T1_L2',
      resolutionMeters: 30,
      bandsUsed: 'SR_B4 (Red), SR_B3 (Green), SR_B2 (Blue)',
      acquisitionWindow: '2025-01-01 to 2025-03-31 (Dry-season median)',
      cloudMasking: 'QA_PIXEL cloud & shadow bitmask',
      notes:
        'Contemporary metropolitan footprint across HMDA growth nodes, peri-urban infill, and lake conservation zones.',
      envVarName: 'GEE_PROJECT_ID',
      tileUrl: undefined,
      isAvailable: false,
    },
  ];
}

export const HISTORICAL_PERIODS: HistoricalPeriodConfig[] = getHistoricalPeriods();

export function getAnalyticalLayers(): AnalyticalLayerConfig[] {
  return [
    {
      id: 'ndbi',
      name: 'Urban Expansion (NDBI)',
      shortName: 'Built-up (NDBI)',
      classification: 'ANALYTICAL',
      formula: 'NDBI = (SWIR1 - NIR) / (SWIR1 + NIR)',
      description:
        'Normalized Difference Built-up Index highlighting impervious surfaces, concrete, and urban density.',
      sensorBasis: 'Landsat 5/8/9 Collection 2 L2 (30m)',
      envVarName: 'GEE_PROJECT_ID',
      tileUrl: undefined,
      isAvailable: false,
      legend: [
        { color: '#1E293B', label: 'Non-built / Water / Dense Canopy', rangeOrCode: '< -0.10' },
        { color: '#78350F', label: 'Sparse / Barren Granite', rangeOrCode: '-0.10 to 0.05' },
        { color: '#D97706', label: 'Suburban / Mixed Built-up', rangeOrCode: '0.05 to 0.20' },
        { color: '#F59E0B', label: 'Dense Urban Core', rangeOrCode: '> 0.20' },
      ],
    },
    {
      id: 'lulc',
      name: 'Land Use / Land Cover (LULC)',
      shortName: 'LULC Classes',
      classification: 'ANALYTICAL',
      formula: 'Multi-Index Spectral Classification (GEE)',
      description:
        'Multi-class land cover classification separating built-up fabric, waterbodies, vegetation, and rock/barren land.',
      sensorBasis: 'Landsat 5/8/9 Collection 2 L2 (30m)',
      envVarName: 'GEE_PROJECT_ID',
      tileUrl: undefined,
      isAvailable: false,
      legend: [
        { color: '#EF4444', label: 'Built-up / Impervious', rangeOrCode: 'Class 1' },
        { color: '#10B981', label: 'Tree Cover & Urban Parks', rangeOrCode: 'Class 2' },
        { color: '#84CC16', label: 'Cropland & Scrub', rangeOrCode: 'Class 3' },
        { color: '#06B6D4', label: 'Open Water / Reservoirs', rangeOrCode: 'Class 4' },
        { color: '#A8A29E', label: 'Deccan Granite / Barren', rangeOrCode: 'Class 5' },
      ],
    },
    {
      id: 'ndwi',
      name: 'Waterbodies & Lakes (NDWI)',
      shortName: 'Water (NDWI)',
      classification: 'ANALYTICAL',
      formula: 'NDWI = (Green - NIR) / (Green + NIR)',
      description:
        'McFeeters Normalized Difference Water Index isolating surface water extent across Hyderabad’s lakes and tanks.',
      sensorBasis: 'Landsat 5/8/9 Collection 2 L2 (30m)',
      envVarName: 'GEE_PROJECT_ID',
      tileUrl: undefined,
      isAvailable: false,
      legend: [
        { color: '#0F172A', label: 'Dry Land / Built-up', rangeOrCode: '< 0.00' },
        { color: '#0284C7', label: 'Shallow / Turbid Water', rangeOrCode: '0.00 to 0.25' },
        { color: '#22D3EE', label: 'Open Surface Water', rangeOrCode: '> 0.25' },
      ],
    },
    {
      id: 'ndvi',
      name: 'Vegetation Cover (NDVI)',
      shortName: 'Vegetation (NDVI)',
      classification: 'ANALYTICAL',
      formula: 'NDVI = (NIR - Red) / (NIR + Red)',
      description:
        'Normalized Difference Vegetation Index measuring photosynthetic canopy vigor across parks, forests, and wetlands.',
      sensorBasis: 'Landsat 5/8/9 Collection 2 L2 (30m)',
      envVarName: 'GEE_PROJECT_ID',
      tileUrl: undefined,
      isAvailable: false,
      legend: [
        { color: '#334155', label: 'Water / Bare Impervious', rangeOrCode: '< 0.10' },
        { color: '#4D7C0F', label: 'Sparse Grass / Scrub', rangeOrCode: '0.10 to 0.30' },
        { color: '#16A34A', label: 'Moderate Urban Canopy', rangeOrCode: '0.30 to 0.55' },
        { color: '#22C55E', label: 'Dense Forest / Reserve', rangeOrCode: '> 0.55' },
      ],
    },
    {
      id: 'lst',
      name: 'Land Surface Temperature (LST)',
      shortName: 'Surface Temp (LST)',
      classification: 'ANALYTICAL',
      formula: 'LST (°C) = ST * 0.00341802 + 149.0 - 273.15',
      description:
        'Landsat 5/8/9 Collection 2 Level-2 thermal infrared surface temperature revealing urban heat islands and cool lake/park sinks.',
      sensorBasis: 'Landsat 5 ST_B6 & Landsat 8/9 ST_B10 (USGS C2 L2)',
      envVarName: 'GEE_PROJECT_ID',
      tileUrl: undefined,
      isAvailable: false,
      legend: [
        { color: '#0EA5E9', label: 'Cool (Water / Dense Canopy)', rangeOrCode: '< 28 °C' },
        { color: '#10B981', label: 'Moderate (Suburban / Scrub)', rangeOrCode: '28–33 °C' },
        { color: '#F59E0B', label: 'Warm (Mixed Built-up)', rangeOrCode: '33–38 °C' },
        { color: '#EF4444', label: 'Urban Heat Island Core', rangeOrCode: '> 38 °C' },
      ],
    },
  ];
}

export const ANALYTICAL_LAYERS: AnalyticalLayerConfig[] = getAnalyticalLayers();

export const VECTOR_LAYERS: VectorLayerConfig[] = [
  {
    id: 'ghmc-boundary',
    name: 'GHMC / Hyderabad Admin Boundary',
    classification: 'VECTOR',
    source: 'OpenStreetMap Overpass API (admin_level=5/6)',
    description: 'Live municipal & district administrative boundary polygons from OpenStreetMap.',
    color: '#F59E0B',
  },
  {
    id: 'osm-waterbodies',
    name: 'Lakes & Reservoirs (OSM)',
    classification: 'VECTOR',
    source: 'OpenStreetMap Overpass API (natural=water)',
    description: 'Live mapped waterbodies including Hussain Sagar, Osman Sagar, Himayat Sagar & Durgam Cheruvu.',
    color: '#22D3EE',
  },
  {
    id: 'osm-vegetation',
    name: 'Parks & Reserve Forests (OSM)',
    classification: 'VECTOR',
    source: 'OpenStreetMap Overpass API (leisure=park / landuse=forest)',
    description: 'Live mapped urban parks, botanical gardens, and reserve forest polygons.',
    color: '#10B981',
  },
  {
    id: 'osm-roads',
    name: 'Major Arterials & ORR (OSM)',
    classification: 'VECTOR',
    source: 'OpenStreetMap Overpass API (highway=motorway|trunk)',
    description: 'Live Outer Ring Road (ORR), National Highways, and expressway network.',
    color: '#FBBF24',
  },
  {
    id: 'landmarks',
    name: 'Key Geographic Landmarks',
    classification: 'VECTOR',
    source: 'Verified Gazetteer Coordinates (WGS84)',
    description: 'Reference points for historical, hydrological, and urban growth corridors.',
    color: '#38BDF8',
  },
];

export const HYDERABAD_LANDMARKS: HyderabadLandmark[] = [
  {
    id: 'charminar',
    name: 'Charminar & Old City Core',
    category: 'Heritage',
    coordinates: [78.4747, 17.3616],
    zoom: 15,
    summary:
      '1591 Qutb Shahi monument anchoring the historic southern bank of the Musi River.',
    osmReference: 'OSM Node: Charminar, Hyderabad',
  },
  {
    id: 'hussain-sagar',
    name: 'Hussain Sagar Lake',
    category: 'Waterbody',
    coordinates: [78.4738, 17.4239],
    zoom: 13.8,
    summary:
      '1563 artificial lake separating Hyderabad and Secunderabad; key urban hydrological benchmark.',
    osmReference: 'OSM Way/Relation: Hussain Sagar',
  },
  {
    id: 'hitec-city',
    name: 'HITEC City (Cyber Towers)',
    category: 'Urban Corridor',
    coordinates: [78.3816, 17.4504],
    zoom: 14.2,
    summary:
      'Nucleus of Hyderabad’s post-1998 IT/ITES expansion across Madhapur and Gachibowli.',
    osmReference: 'OSM Node: Cyber Towers, Madhapur',
  },
  {
    id: 'osman-sagar',
    name: 'Osman Sagar (Gandipet)',
    category: 'Waterbody',
    coordinates: [78.2995, 17.3767],
    zoom: 12.8,
    summary:
      '1920 Musi River dam & drinking water reservoir on the western fringe, governed by GO 111.',
    osmReference: 'OSM Relation: Osman Sagar',
  },
  {
    id: 'himayat-sagar',
    name: 'Himayat Sagar',
    category: 'Waterbody',
    coordinates: [78.3614, 17.3342],
    zoom: 12.8,
    summary:
      '1927 reservoir on the Esi tributary of the Musi River, twin drinking-water source with Osman Sagar.',
    osmReference: 'OSM Relation: Himayat Sagar',
  },
  {
    id: 'kbr-park',
    name: 'KBR National Park',
    category: 'Green Cover',
    coordinates: [78.4214, 17.4156],
    zoom: 14.5,
    summary:
      '142-hectare urban biodiversity reserve in Jubilee Hills preserving Deccan scrub-forest ecology.',
    osmReference: 'OSM Way: Kasu Brahmananda Reddy National Park',
  },
  {
    id: 'golconda',
    name: 'Golconda Fort',
    category: 'Heritage',
    coordinates: [78.4011, 17.3833],
    zoom: 14.5,
    summary:
      '16th-century granite citadel perched on Deccan batholith formations west of the Old City.',
    osmReference: 'OSM Way: Golconda Fort',
  },
  {
    id: 'rgia-shamshabad',
    name: 'Rajiv Gandhi International Airport',
    category: 'Infrastructure',
    coordinates: [78.4294, 17.2403],
    zoom: 13,
    summary:
      '2008 greenfield airport at Shamshabad catalyzing southern metropolitan growth along the ORR.',
    osmReference: 'OSM Way: Rajiv Gandhi International Airport',
  },
];

export const HYDERABAD_PHOTOS: HyderabadPhoto[] = [
  {
    id: 'charminar-photo',
    title: 'Charminar — Historic Core (1591)',
    caption:
      'Four-minaret monument at the center of the historic walled city south of the Musi River.',
    imageUrl:
      'https://commons.wikimedia.org/wiki/Special:FilePath/CharMinar_Hyderabad.jpg?width=1400',
    credit: 'Wikimedia Commons (CC BY-SA)',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:CharMinar_Hyderabad.jpg',
    coordinatesLabel: '17.3616° N, 78.4747° E',
  },
  {
    id: 'hussain-sagar-photo',
    title: 'Hussain Sagar — Hydrological Heart',
    caption:
      '16th-century reservoir linking Hyderabad and Secunderabad amidst dense metropolitan growth.',
    imageUrl:
      'https://commons.wikimedia.org/wiki/Special:FilePath/Hussainsagar1_hyd.jpg?width=1400',
    credit: 'Wikimedia Commons (CC BY-SA)',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Hussainsagar1_hyd.jpg',
    coordinatesLabel: '17.4239° N, 78.4738° E',
  },
  {
    id: 'cyber-towers-photo',
    title: 'Cyber Towers — Western Growth Axis',
    caption:
      'Inaugurated in 1998 in Madhapur, marking the shift of urban expansion onto the western Deccan plateau.',
    imageUrl:
      'https://commons.wikimedia.org/wiki/Special:FilePath/Cyber_Towers,_Hitech_city,_Hyderabad.jpg?width=1400',
    credit: 'Wikimedia Commons (Adbh266 / CC BY-SA)',
    sourceUrl:
      'https://commons.wikimedia.org/wiki/File:Cyber_Towers,_Hitech_city,_Hyderabad.jpg',
    coordinatesLabel: '17.4504° N, 78.3816° E',
  },
];

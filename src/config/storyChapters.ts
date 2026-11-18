import type {
  AnalyticalLayerId,
  BasemapId,
  HistoricalYear,
  VectorLayerId,
} from '../types/gis';

export interface StoryChapter {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  researchQuestion: string;
  narrative: string;
  interpretation: string;
  datasetRef: string;
  methodologyRef: string;
  metricFocus: 'core' | 'urban' | 'conversion' | 'water' | 'growth-geo' | 'climate' | '3d' | 'synthesis';
  spatialFocusLabel: string;
  camera: {
    lng: number;
    lat: number;
    zoom: number;
    pitch: number;
    bearing: number;
  };
  basemapId: BasemapId;
  activeYear: HistoricalYear | null;
  activeAnalytical: AnalyticalLayerId | null;
  enable3DBuildings?: boolean;
  vectorLayers: VectorLayerId[];
  photo?: {
    url: string;
    caption: string;
    credit: string;
  };
}

export const STORY_CHAPTERS: StoryChapter[] = [
  {
    id: 'origins',
    number: '01',
    title: 'Origins',
    subtitle: "Hyderabad's Historical Urban Core",
    researchQuestion:
      'Where did Hyderabad’s urban geometry originate, and how did topography anchor the 1591 core?',
    narrative:
      'Founded in 1591 along the southern bank of the Musi River, Hyderabad’s spatial spine was anchored by the Charminar crossroads and the 16th-century granite citadel of Golconda Fort. Early tank reservoirs and radial streets defined the compact pre-industrial footprint.',
    interpretation:
      'The historic core occupies a relatively flat alluvial terrace south of the Musi River, bounded by granite ridges to the west and Hussain Sagar to the north—explaining why modern municipal density still peaks inside the GHMC central zone.',
    datasetRef: 'Esri World Imagery • TGRAC GHMC Boundary (MapServer/45) • OSM Landmarks',
    methodologyRef: 'Spatial anchor verification in EPSG:4326 (WGS84)',
    metricFocus: 'core',
    spatialFocusLabel: 'Charminar & Old City Core • 17.3616° N, 78.4747° E',
    camera: { lng: 78.4747, lat: 17.3616, zoom: 14.3, pitch: 40, bearing: 10 },
    basemapId: 'esri-imagery',
    activeYear: null,
    activeAnalytical: null,
    vectorLayers: ['landmarks', 'osm-waterbodies'],
    photo: {
      url: 'https://commons.wikimedia.org/wiki/Special:FilePath/CharMinar_Hyderabad.jpg?width=1000',
      caption: 'Charminar (1591) anchoring the historic southern bank of the Musi River.',
      credit: 'Wikimedia Commons (CC BY-SA)',
    },
  },
  {
    id: 'urban-expansion',
    number: '02',
    title: 'Urban Expansion',
    subtitle: 'How the Metropolitan Footprint Changed (1990–2025)',
    researchQuestion:
      'How much impervious built-up land was added across GHMC and HMDA between 1990 and 2025?',
    narrative:
      'Between 1990 and 2025, Hyderabad transitioned from a compact twin-city core into a polycentric metropolitan region spanning the 7,266.4 km² HMDA planning boundary. Multi-decadal Landsat 5 TM, Landsat 8 OLI, and Landsat 9 OLI-2 composites quantify this outward expansion.',
    interpretation:
      'Comparing GHMC (municipal core) against HMDA (metropolitan region) reveals that while infill densified the inner city, the largest absolute land consumption occurred in peripheral HMDA growth corridors.',
    datasetRef: 'LANDSAT/LT05, LC08, LC09 C2 L2 • TGRAC HMDA (MapServer/52)',
    methodologyRef: 'Multi-index built-up mask (NDBI > 0 & NDVI < 0.25 & MNDWI <= 0) at 30m',
    metricFocus: 'urban',
    spatialFocusLabel: 'Greater Hyderabad Basin • 17.4000° N, 78.4500° E',
    camera: { lng: 78.45, lat: 17.4, zoom: 11.1, pitch: 20, bearing: 0 },
    basemapId: 'esri-imagery',
    activeYear: null,
    activeAnalytical: 'ndbi',
    vectorLayers: ['ghmc-boundary', 'osm-roads', 'landmarks'],
  },
  {
    id: 'land-transformation',
    number: '03',
    title: 'Land Transformation',
    subtitle: 'What Replaced Vegetation and Open Land?',
    researchQuestion:
      'Which land-cover classes (agriculture, open scrub, or vegetation) were converted into built-up fabric?',
    narrative:
      'Urban growth does not occur on blank space—it replaces existing agricultural plots, Deccan granite scrubland, and peri-urban open land. Pixel-level cross-tabulation between 1990 and 2025 tracks exact transitions into built-up land.',
    interpretation:
      'In the western knowledge corridor (Madhapur, Gachibowli, Kokapet), rocky granite outcrops and peri-urban scrub transitioned rapidly after 1998, visible in the 2020 10m Sentinel-2 mosaic.',
    datasetRef: 'Aligned 30m Landsat LULC Grid • 2020 Sentinel-2 Cloudless (10m)',
    methodologyRef: '5-Class LULC Cross-Tabulation Matrix (fromClass * 10 + toClass)',
    metricFocus: 'conversion',
    spatialFocusLabel: 'HITEC City / Madhapur • 17.4504° N, 78.3816° E',
    camera: { lng: 78.3816, lat: 17.445, zoom: 13.8, pitch: 42, bearing: -18 },
    basemapId: 'esri-imagery',
    activeYear: 2020,
    activeAnalytical: null,
    vectorLayers: ['landmarks', 'osm-roads'],
    photo: {
      url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Cyber_Towers,_Hitech_city,_Hyderabad.jpg?width=1000',
      caption: 'Cyber Towers in Madhapur, catalyst of Hyderabad’s western growth axis.',
      credit: 'Wikimedia Commons (Adbh266 / CC BY-SA)',
    },
  },
  {
    id: 'changing-water',
    number: '04',
    title: 'Changing Water Landscape',
    subtitle: 'How Water Surfaces Changed Across Tanks & Reservoirs',
    researchQuestion:
      'How have Hyderabad’s cascading lakes and drinking-water reservoirs changed, and how do we separate seasonal variation from long-term loss?',
    narrative:
      'Hyderabad’s hydrology relies on interconnected man-made tanks and reservoirs—Hussain Sagar (1563), Osman Sagar (1920), Himayat Sagar (1927), and Durgam Cheruvu. Comparing dry-season (Jan–Mar) MNDWI/NDWI composites isolates persistent water from monsoon-driven seasonal spread.',
    interpretation:
      'Live OpenStreetMap hydrography maps current lake footprints, while multi-year MNDWI composites reveal shoreline encroachment and seasonal drawdown.',
    datasetRef: 'OSM Overpass (natural=water) • Landsat MNDWI / NDWI (30m)',
    methodologyRef: 'Xu MNDWI = (Green - SWIR1) / (Green + SWIR1) > 0.05 in dry season',
    metricFocus: 'water',
    spatialFocusLabel: 'Hussain Sagar & Twin Reservoirs • 17.4200° N, 78.4520° E',
    camera: { lng: 78.452, lat: 17.42, zoom: 12.9, pitch: 28, bearing: -8 },
    basemapId: 'esri-imagery',
    activeYear: null,
    activeAnalytical: 'ndwi',
    vectorLayers: ['osm-waterbodies', 'osm-vegetation', 'landmarks'],
    photo: {
      url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Hussainsagar1_hyd.jpg?width=1000',
      caption: 'Hussain Sagar Reservoir linking Hyderabad and Secunderabad.',
      credit: 'Wikimedia Commons (CC BY-SA)',
    },
  },
  {
    id: 'growth-geography',
    number: '05',
    title: 'Growth Geography',
    subtitle: 'Where Did Expansion Concentrate?',
    researchQuestion:
      'How did transport corridors like the Outer Ring Road and Shamshabad Airport shape directional growth?',
    narrative:
      'The 158 km Nehru Outer Ring Road (ORR), radial National Highways (NH-44, NH-65), and Rajiv Gandhi International Airport (2008) pulled development strongly toward the western and southern quadrants of HMDA.',
    interpretation:
      'Highways act as primary spatial attractors: built-up clustering concentrates along ORR interchanges and the western IT/financial arc rather than expanding uniformly in all directions.',
    datasetRef: 'OSM Arterials & ORR (highway=motorway|trunk) • TGRAC HMDA Boundary',
    methodologyRef: 'Live OSM geodesic network length & corridor spatial overlay',
    metricFocus: 'growth-geo',
    spatialFocusLabel: 'Southern ORR & RGIA Corridor • 17.2850° N, 78.4100° E',
    camera: { lng: 78.41, lat: 17.285, zoom: 11.6, pitch: 25, bearing: 5 },
    basemapId: 'osm-standard',
    activeYear: null,
    activeAnalytical: null,
    vectorLayers: ['osm-roads', 'ghmc-boundary', 'landmarks'],
  },
  {
    id: 'environmental-footprint',
    number: '06',
    title: 'Environmental Footprint',
    subtitle: 'Vegetation, Surface Temperature & Measurable Indicators',
    researchQuestion:
      'How do urban canopy loss and impervious surfaces relate to Landsat Land Surface Temperature (LST)?',
    narrative:
      'Using Landsat Collection 2 Level-2 thermal bands (ST_B6 / ST_B10) alongside NDVI, we measure surface skin temperature differences across dense built-up cores, urban parks such as KBR National Park, and open reservoirs.',
    interpretation:
      'Vegetated reserves and waterbodies consistently form cool-island sinks relative to dense impervious districts. Note: satellite LST measures surface skin temperature, not atmospheric air temperature.',
    datasetRef: 'Landsat C2 L2 Thermal (ST_B10/B6) & NDVI • OSM Parks/Forests',
    methodologyRef: 'LST (°C) = ST * 0.00341802 + 149.0 - 273.15; QA_PIXEL cloud masked',
    metricFocus: 'climate',
    spatialFocusLabel: 'Urban Core & KBR Canopy Gradient • 17.4050° N, 78.4350° E',
    camera: { lng: 78.435, lat: 17.405, zoom: 12.2, pitch: 24, bearing: 0 },
    basemapId: 'esri-imagery',
    activeYear: null,
    activeAnalytical: 'lst',
    vectorLayers: ['osm-waterbodies', 'osm-vegetation', 'ghmc-boundary'],
  },
  {
    id: 'vertical-hyderabad',
    number: '07',
    title: 'Vertical Hyderabad',
    subtitle: 'Building Footprints & 3D Urban Development',
    researchQuestion:
      'How is Hyderabad growing vertically in its modern commercial districts, and what height data is actually verified?',
    narrative:
      'Beyond horizontal sprawl, western hubs like HITEC City and Financial District have grown sharply upward. At neighborhood zoom (z14.5+), live OpenStreetMap building footprints extrude using measured heights or documented floor-count assumptions.',
    interpretation:
      'Measured OSM heights (cyan) and floor-derived heights (sky blue) are strictly separated from unmeasured category estimates (slate)—and present-day footprints are never projected backward onto 1990.',
    datasetRef: 'OpenStreetMap Building Footprints (Overpass) • AWS Terrarium 3D DEM',
    methodologyRef: 'Zoom-gated (>=14.5) fill-extrusion with explicit height provenance',
    metricFocus: '3d',
    spatialFocusLabel: 'HITEC City 3D Corridor • 17.4480° N, 78.3816° E',
    camera: { lng: 78.3816, lat: 17.448, zoom: 15.2, pitch: 58, bearing: -22 },
    basemapId: 'esri-imagery',
    activeYear: null,
    activeAnalytical: null,
    enable3DBuildings: true,
    vectorLayers: ['landmarks', 'osm-roads'],
  },
  {
    id: 'bigger-picture',
    number: '08',
    title: 'The Bigger Picture',
    subtitle: 'Evidence-Based Findings & Planning Implications',
    researchQuestion:
      'What do 35 years of spatial evidence imply for water security, urban heat, and metropolitan planning?',
    narrative:
      'Sustaining Hyderabad’s western reservoirs (Osman Sagar and Himayat Sagar), protecting urban green reserves, and guiding transit-oriented infill require transparent, reproducible geospatial monitoring across both GHMC and HMDA.',
    interpretation:
      'By separating observed vector data, derived satellite indices, and unconfigured datasets, Hyderabad Through Time serves as an auditable spatial decision-support platform for GIS Day 2026.',
    datasetRef: 'TGRAC HMDA & GHMC • USGS/NASA Landsat • ESA Sentinel-2 • OSM',
    methodologyRef: 'Open Geospatial Provenance & Reproducible GEE Pipeline',
    metricFocus: 'synthesis',
    spatialFocusLabel: 'Hyderabad Metropolitan Overview • 17.3850° N, 78.4867° E',
    camera: { lng: 78.4867, lat: 17.385, zoom: 11.0, pitch: 0, bearing: 0 },
    basemapId: 'esri-imagery',
    activeYear: null,
    activeAnalytical: null,
    vectorLayers: ['ghmc-boundary', 'osm-waterbodies', 'landmarks'],
  },
];

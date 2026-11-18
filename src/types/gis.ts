export type StudyAreaId = 'hmda' | 'ghmc';

export type StudyAreaMode = 'hmda' | 'ghmc' | 'compare';

export type VisualStyle3D = 'cinematic-dark' | 'satellite-3d' | 'urban-growth';

export type HeightSourceType = 'measured' | 'levels-derived' | 'estimated-category';

export interface TgracBoundaryMetadata {
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
  metadata: TgracBoundaryMetadata;
  geojson: GeoJSON.FeatureCollection;
}

export interface GeeImageryResult {
  available: boolean;
  area: StudyAreaId;
  year: HistoricalYear;
  tileUrl?: string;
  sceneCount: number;
  dataProvider?: string;
  datasetId: string;
  sensor: string;
  spatialResolution?: string;
  compositePeriod: string;
  processingMethod?: string;
  boundarySource?: string;
  sensorNotes?: string;
  lastUpdated?: string;
  message?: string;
}

export type AppView =
  | 'landing'
  | 'story'
  | 'explorer'
  | 'historical'
  | 'analysis'
  | 'methodology';

export type HistoricalYear = 1990 | 2000 | 2010 | 2020 | 2025;

export type BasemapId = 'esri-imagery' | 'osm-standard' | 'carto-dark';

export type AnalyticalLayerId = 'ndbi' | 'lulc' | 'ndwi' | 'ndvi' | 'lst';

export type VectorLayerId =
  | 'ghmc-boundary'
  | 'osm-waterbodies'
  | 'osm-vegetation'
  | 'osm-roads'
  | 'landmarks';

export type LayerClassification =
  | 'BASEMAP'
  | 'HISTORICAL_SATELLITE'
  | 'ANALYTICAL'
  | 'VECTOR';

export interface BasemapDefinition {
  id: BasemapId;
  name: string;
  subtitle: string;
  classification: 'BASEMAP';
  tileUrl: string;
  attribution: string;
  maxZoom: number;
  description: string;
}

export interface HistoricalPeriodConfig {
  year: HistoricalYear;
  sensor: string;
  spacecraft: string;
  source: string;
  collectionId: string;
  resolutionMeters: number;
  bandsUsed: string;
  acquisitionWindow: string;
  cloudMasking: string;
  notes: string;
  envVarName: string;
  tileUrl: string | undefined;
  isAvailable: boolean;
}

export interface LegendStop {
  color: string;
  label: string;
  rangeOrCode?: string;
}

export interface AnalyticalLayerConfig {
  id: AnalyticalLayerId;
  name: string;
  shortName: string;
  classification: 'ANALYTICAL';
  formula: string;
  description: string;
  sensorBasis: string;
  envVarName: string;
  tileUrl: string | undefined;
  isAvailable: boolean;
  legend: LegendStop[];
}

export interface VectorLayerConfig {
  id: VectorLayerId;
  name: string;
  classification: 'VECTOR';
  source: string;
  description: string;
  color: string;
}

export interface HyderabadLandmark {
  id: string;
  name: string;
  category: 'Heritage' | 'Waterbody' | 'Urban Corridor' | 'Green Cover' | 'Infrastructure';
  coordinates: [number, number]; // [lng, lat]
  zoom: number;
  summary: string;
  osmReference: string;
}

export interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  class: string;
  boundingbox?: [string, string, string, string];
}

export interface MapPopupInfo {
  lngLat: [number, number];
  title: string;
  subtitle: string;
  sourceBadge: string;
  properties: Record<string, string | number>;
}

export type FetchStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface VectorLayerState {
  enabled: boolean;
  opacity: number;
  status: FetchStatus;
  featureCount: number | null;
  errorMessage: string | null;
}

export interface HyderabadPhoto {
  id: string;
  title: string;
  caption: string;
  imageUrl: string;
  credit: string;
  sourceUrl: string;
  coordinatesLabel: string;
}

export interface ClassAreaEntry {
  className: string;
  color: string;
  areaKm2: number;
  percent: number;
  uncertaintyKm2?: number;
}

export interface EpochAnalysisStat {
  year: HistoricalYear;
  sensor: string;
  source: string;
  totalAreaKm2: number;
  classes: ClassAreaEntry[];
  lstStats?: {
    meanC: number;
    minC: number;
    maxC: number;
    urbanMeanC?: number;
    vegetationMeanC?: number;
    waterMeanC?: number;
  };
  validation?: {
    overallAccuracyPct: number;
    kappa: number;
    validationSampleCount: number;
    perClassAccuracy?: {
      className: string;
      producersPct: number;
      usersPct: number;
    }[];
  };
}

export interface AnalysisStatsDataset {
  status: 'measured';
  studyAreaName: string;
  crs: string;
  generatedBy: string; // e.g. "Google Earth Engine / QGIS"
  generatedAt: string;
  epochs: EpochAnalysisStat[];
}

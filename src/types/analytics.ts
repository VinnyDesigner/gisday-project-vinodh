import type { HistoricalYear, StudyAreaId } from './gis';

export type SeasonWindow = 'dry' | 'post-monsoon' | 'annual';

export type AnalyticsCategoryId =
  | 'urban-lulc'
  | 'ecology-water'
  | 'climate-terrain'
  | 'spatial-infra'
  | 'scenarios-reports';

export type AnalyticsModuleId =
  | 'urban-growth'
  | 'lulc'
  | 'conversion-matrix'
  | 'vegetation'
  | 'water-bodies'
  | 'urban-heat'
  | 'terrain'
  | 'spatial-patterns'
  | 'infrastructure'
  | 'scenarios';

export interface LulcClassStat {
  code: number;
  className: string;
  color: string;
  areaKm2: number;
  percent: number;
}

export interface EpochLulcSummary {
  year: HistoricalYear;
  available: boolean;
  sceneCount: number;
  sensor: string;
  datasetId: string;
  compositePeriod: string;
  tileUrl: string | null;
  totalKm2: number | null;
  classes: LulcClassStat[];
  meanNdvi: number | null;
  medianNdvi: number | null;
  meanLstC: number | null;
  medianLstC: number | null;
}

export interface ConversionCell {
  fromCode: number;
  fromName: string;
  toCode: number;
  toName: string;
  areaKm2: number;
}

export interface LulcMatrixReport {
  area: StudyAreaId;
  season: string;
  startYear: HistoricalYear;
  endYear: HistoricalYear;
  boundarySource: string;
  spatialResolution: string;
  crs: string;
  classificationScheme: string;
  startEpoch: EpochLulcSummary;
  endEpoch: EpochLulcSummary;
  conversionMatrix: ConversionCell[];
  generatedAt: string;
}

export interface TerrainReport {
  area: StudyAreaId;
  datasetId: string;
  spatialResolution: string;
  boundarySource: string;
  elevationMinM: number | null;
  elevationMeanM: number | null;
  elevationMaxM: number | null;
  slopeMeanDeg: number | null;
  slopeMaxDeg: number | null;
  hillshadeTileUrl: string;
  generatedAt: string;
}

export interface AutomatedFinding {
  id: string;
  title: string;
  zone: string;
  period: string;
  measuredChange: string;
  unit: string;
  supportingStat: string;
  dataSource: string;
  methodology: string;
  confidence: string;
  category: 'urban' | 'vegetation' | 'water' | 'thermal' | 'conversion' | 'terrain';
}

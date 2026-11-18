import type {
  AutomatedFinding,
  LulcMatrixReport,
  TerrainReport,
} from '../types/analytics';

/**
 * Deterministic "WHAT CHANGED?" findings engine.
 * Generates findings strictly from verified processed GIS outputs.
 * Never invents statistics, dates, or unsupported conclusions.
 */
export function generateEvidenceFindings(
  report: LulcMatrixReport | null,
  terrain: TerrainReport | null
): AutomatedFinding[] {
  const findings: AutomatedFinding[] = [];

  if (report && report.startEpoch.available && report.endEpoch.available) {
    const { startEpoch, endEpoch, conversionMatrix, area } = report;
    const areaLabel = area.toUpperCase();
    const period = `${startEpoch.year}–${endEpoch.year}`;
    const yearsSpan = Math.max(1, endEpoch.year - startEpoch.year);

    const builtStart = startEpoch.classes.find((c) => c.code === 1);
    const builtEnd = endEpoch.classes.find((c) => c.code === 1);
    if (builtStart && builtEnd) {
      const delta = builtEnd.areaKm2 - builtStart.areaKm2;
      const pctChange =
        builtStart.areaKm2 > 0 ? (delta / builtStart.areaKm2) * 100 : 0;
      const cagr =
        builtStart.areaKm2 > 0 && builtEnd.areaKm2 > 0
          ? (Math.pow(builtEnd.areaKm2 / builtStart.areaKm2, 1 / yearsSpan) - 1) * 100
          : 0;

      findings.push({
        id: 'builtup-change',
        title: delta >= 0 ? 'Net Built-up Expansion' : 'Net Built-up Contraction',
        zone: `${areaLabel} Study Area`,
        period,
        measuredChange: `${delta >= 0 ? '+' : ''}${delta.toFixed(2)}`,
        unit: 'km²',
        supportingStat: `${builtStart.areaKm2.toFixed(1)} km² (${builtStart.percent.toFixed(1)}%) → ${builtEnd.areaKm2.toFixed(1)} km² (${builtEnd.percent.toFixed(1)}%) • ${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(1)}% (${cagr.toFixed(2)}%/yr)`,
        dataSource: `${startEpoch.datasetId} → ${endEpoch.datasetId}`,
        methodology:
          'Multi-index built-up mask (NDBI > 0 & NDVI < 0.25 & MNDWI <= 0) at 30m',
        confidence:
          startEpoch.sensor !== endEpoch.sensor
            ? `Cross-sensor (${startEpoch.sensor} vs ${endEpoch.sensor}); spectral band differences apply.`
            : `Single-sensor (${startEpoch.sensor}); 30m pixel-area summation.`,
        category: 'urban',
      });
    }

    const vegStart = startEpoch.classes.find((c) => c.code === 2);
    const vegEnd = endEpoch.classes.find((c) => c.code === 2);
    if (vegStart && vegEnd) {
      const vegDelta = vegEnd.areaKm2 - vegStart.areaKm2;
      findings.push({
        id: 'vegetation-change',
        title: vegDelta < 0 ? 'Dense Vegetation Loss' : 'Dense Vegetation Gain',
        zone: `${areaLabel} Study Area`,
        period,
        measuredChange: `${vegDelta >= 0 ? '+' : ''}${vegDelta.toFixed(2)}`,
        unit: 'km²',
        supportingStat: `NDVI ≥ 0.40: ${vegStart.areaKm2.toFixed(1)} km² → ${vegEnd.areaKm2.toFixed(1)} km²`,
        dataSource: `${startEpoch.sensor} & ${endEpoch.sensor}`,
        methodology: 'NDVI >= 0.40 threshold on QA_PIXEL cloud-masked seasonal median',
        confidence: `Scenes: ${startEpoch.sceneCount} (${startEpoch.year}) / ${endEpoch.sceneCount} (${endEpoch.year})`,
        category: 'vegetation',
      });
    }

    const waterStart = startEpoch.classes.find((c) => c.code === 4);
    const waterEnd = endEpoch.classes.find((c) => c.code === 4);
    if (waterStart && waterEnd) {
      const wDelta = waterEnd.areaKm2 - waterStart.areaKm2;
      findings.push({
        id: 'water-change',
        title: 'Surface Water Extent Change',
        zone: `${areaLabel} Lakes & Reservoirs`,
        period,
        measuredChange: `${wDelta >= 0 ? '+' : ''}${wDelta.toFixed(2)}`,
        unit: 'km²',
        supportingStat: `${waterStart.areaKm2.toFixed(2)} km² → ${waterEnd.areaKm2.toFixed(2)} km² (${report.season})`,
        dataSource: `${startEpoch.datasetId} → ${endEpoch.datasetId}`,
        methodology: 'MNDWI > 0.05 or NDWI > 0.05 within selected seasonal window',
        confidence: 'Reflects selected seasonal window; distinguish seasonal variation from permanent loss.',
        category: 'water',
      });
    }

    // Major land conversion into Built-up
    const toBuiltUp = conversionMatrix
      .filter((c) => c.toCode === 1 && c.fromCode !== 1)
      .sort((a, b) => b.areaKm2 - a.areaKm2);
    if (toBuiltUp.length > 0 && toBuiltUp[0].areaKm2 > 0) {
      const top = toBuiltUp[0];
      findings.push({
        id: 'major-conversion',
        title: `Primary Conversion: ${top.fromName} → Built-up`,
        zone: `${areaLabel} Transition Matrix`,
        period,
        measuredChange: top.areaKm2.toFixed(2),
        unit: 'km²',
        supportingStat: `Largest non-built source contributing to urban expansion`,
        dataSource: 'Aligned 30m GEE LULC Grid',
        methodology: 'Pixel-level cross-tabulation (fromClass * 10 + toClass)',
        confidence: 'Derived from rule-based spectral classification.',
        category: 'conversion',
      });
    }

    if (startEpoch.meanLstC !== null && endEpoch.meanLstC !== null) {
      const lstDelta = endEpoch.meanLstC - startEpoch.meanLstC;
      findings.push({
        id: 'lst-change',
        title: 'Mean Land Surface Temperature Shift',
        zone: `${areaLabel} Thermal Profile`,
        period,
        measuredChange: `${lstDelta >= 0 ? '+' : ''}${lstDelta.toFixed(2)}`,
        unit: '°C (LST)',
        supportingStat: `${startEpoch.meanLstC.toFixed(1)} °C → ${endEpoch.meanLstC.toFixed(1)} °C (surface skin temperature, not air temp)`,
        dataSource: `${startEpoch.datasetId} & ${endEpoch.datasetId} Thermal`,
        methodology: 'USGS C2 L2 Thermal Band (ST * 0.00341802 + 149.0 - 273.15)',
        confidence: 'Sensitive to acquisition day meteorology; compare seasonal medians cautiously.',
        category: 'thermal',
      });
    }
  }

  if (terrain && terrain.elevationMeanM !== null) {
    findings.push({
      id: 'terrain-baseline',
      title: 'Deccan Plateau Elevation & Slope Profile',
      zone: `${terrain.area.toUpperCase()} Study Area`,
      period: 'Static DEM Baseline',
      measuredChange: `${terrain.elevationMeanM.toFixed(0)}`,
      unit: 'm ASL (mean)',
      supportingStat: `Range: ${terrain.elevationMinM?.toFixed(0) ?? '—'}–${terrain.elevationMaxM?.toFixed(0) ?? '—'} m • Mean Slope: ${terrain.slopeMeanDeg?.toFixed(2) ?? '—'}°`,
      dataSource: terrain.datasetId,
      methodology: 'SRTM 1 arc-second (30m) elevation & Horn slope reducer',
      confidence: 'Observed Shuttle Radar Topography Mission DEM.',
      category: 'terrain',
    });
  }

  return findings;
}

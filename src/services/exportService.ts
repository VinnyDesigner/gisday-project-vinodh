import type { AutomatedFinding, LulcMatrixReport } from '../types/analytics';

function triggerDownload(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportAnalyticsCsv(
  report: LulcMatrixReport,
  findings: AutomatedFinding[]
) {
  const lines: string[] = [
    `# Hyderabad Through Time — GIS Day 2026 Analytical Export`,
    `# Study Area: ${report.area.toUpperCase()} | Period: ${report.startYear}-${report.endYear} | Season: ${report.season}`,
    `# Boundary Source: ${report.boundarySource}`,
    `# Resolution: ${report.spatialResolution} | CRS: ${report.crs}`,
    `# Generated: ${report.generatedAt}`,
    ``,
    `Section,Class/From,To/Metric,Start (${report.startYear}) km2,End (${report.endYear}) km2,Delta km2`,
  ];

  for (const cls of report.endEpoch.classes) {
    const startCls = report.startEpoch.classes.find((c) => c.code === cls.code);
    const a1 = startCls?.areaKm2 ?? 0;
    const a2 = cls.areaKm2;
    lines.push(
      `LULC Area,"${cls.className}",Area,${a1.toFixed(2)},${a2.toFixed(2)},${(a2 - a1).toFixed(2)}`
    );
  }

  lines.push('');
  lines.push('Section,From Class,To Class,Transitioned Area (km2)');
  for (const cell of report.conversionMatrix) {
    lines.push(
      `Conversion Matrix,"${cell.fromName}","${cell.toName}",${cell.areaKm2.toFixed(2)}`
    );
  }

  if (findings.length > 0) {
    lines.push('');
    lines.push('Section,Finding,Measured Change,Unit,Supporting Stat,Methodology');
    for (const f of findings) {
      lines.push(
        `Finding,"${f.title}","${f.measuredChange}","${f.unit}","${f.supportingStat}","${f.methodology}"`
      );
    }
  }

  triggerDownload(
    `hyderabad_${report.area}_${report.startYear}_${report.endYear}_analytics.csv`,
    lines.join('\n'),
    'text/csv;charset=utf-8'
  );
}

export function exportSvgElement(svgEl: SVGSVGElement | null, filename: string) {
  if (!svgEl) return;
  const serializer = new XMLSerializer();
  const source = serializer.serializeToString(svgEl);
  triggerDownload(filename, source, 'image/svg+xml;charset=utf-8');
}

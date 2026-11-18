import { AlertTriangle, BookOpen, Server } from 'lucide-react';

interface DataUnavailableNoticeProps {
  layerName: string;
  sensorOrFormula: string;
  onOpenMethodology: () => void;
  compact?: boolean;
}

export function DataUnavailableNotice({
  layerName,
  sensorOrFormula,
  onOpenMethodology,
  compact = false,
}: DataUnavailableNoticeProps) {
  return (
    <div
      className={`rounded-lg border border-[#98472b]/35 bg-amber-950/25 ${
        compact ? 'p-3' : 'p-4'
      } text-slate-200`}
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#dab089]" />
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#ebcaa1]">
              Earth Engine Layer Unavailable
            </span>
            <p className="mt-1 text-xs leading-relaxed text-slate-300">
              <strong className="text-slate-100">{layerName}</strong> — {sensorOrFormula}
            </p>
          </div>

          <div className="rounded border border-[#641600]/55 bg-[#0c0503]/90 px-2.5 py-2 font-mono text-[10px] text-[#ebcaa1]">
            <div className="mb-1 flex items-center gap-1.5 text-slate-400">
              <Server className="h-3 w-3" />
              <span>Server-side GEE credentials (.env):</span>
            </div>
            <div>GEE_PROJECT_ID=pivotal-shield-455916-h2</div>
            <div>GEE_SERVICE_ACCOUNT_EMAIL=...</div>
            <div>GEE_PRIVATE_KEY=...</div>
          </div>

          <button
            type="button"
            onClick={onOpenMethodology}
            className="inline-flex items-center gap-1.5 rounded border border-[#98472b]/40 bg-[#98472b]/10 px-2.5 py-1 text-[11px] font-medium text-[#ebcaa1] transition-colors hover:bg-[#98472b]/20"
          >
            <BookOpen className="h-3 w-3" />
            <span>View Backend GEE Setup</span>
          </button>
        </div>
      </div>
    </div>
  );
}

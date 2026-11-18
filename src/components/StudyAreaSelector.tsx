import type { StudyAreaMode } from '../types/gis';

interface StudyAreaSelectorProps {
  mode: StudyAreaMode;
  onChange: (mode: StudyAreaMode) => void;
}

const OPTIONS: { id: StudyAreaMode; label: string; dotColor: string }[] = [
  { id: 'hmda', label: 'HMDA', dotColor: '#00D5FF' },
  { id: 'ghmc', label: 'GHMC', dotColor: '#FFB547' },
  { id: 'compare', label: 'Compare HMDA vs GHMC', dotColor: '#E2E8F0' },
];

export function StudyAreaSelector({ mode, onChange }: StudyAreaSelectorProps) {
  return (
    <div
      className="inline-flex flex-wrap gap-1 rounded-lg border border-[#641600]/55 bg-[#0c0503] p-1"
      role="group"
      aria-label="Study Area Selector"
    >
      {OPTIONS.map((opt) => {
        const active = mode === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
              active
                ? 'bg-slate-800 text-slate-100 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: opt.dotColor }}
            />
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

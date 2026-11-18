import { useEffect } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import type { HistoricalYear } from '../types/gis';

const EPOCHS: HistoricalYear[] = [1990, 2000, 2010, 2020, 2025];

interface TimelineEvolutionBarProps {
  activeYear: HistoricalYear | null;
  onChangeYear: (year: HistoricalYear | null) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
}

export function TimelineEvolutionBar({
  activeYear,
  onChangeYear,
  isPlaying,
  onTogglePlay,
}: TimelineEvolutionBarProps) {
  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setInterval(() => {
      const idx = activeYear ? EPOCHS.indexOf(activeYear) : -1;
      const nextIdx = (idx + 1) % EPOCHS.length;
      onChangeYear(EPOCHS[nextIdx]);
    }, 3200);
    return () => window.clearInterval(timer);
  }, [isPlaying, activeYear, onChangeYear]);

  const currentIdx = activeYear ? EPOCHS.indexOf(activeYear) : -1;

  const handlePrev = () => {
    if (currentIdx <= 0) onChangeYear(EPOCHS[0]);
    else onChangeYear(EPOCHS[currentIdx - 1]);
  };

  const handleNext = () => {
    if (currentIdx < 0) onChangeYear(EPOCHS[0]);
    else if (currentIdx < EPOCHS.length - 1) onChangeYear(EPOCHS[currentIdx + 1]);
    else onChangeYear(EPOCHS[0]);
  };

  return (
    <div className="gis-glass pointer-events-auto flex flex-wrap items-center gap-2 rounded-xl px-3 py-2">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={handlePrev}
          aria-label="Previous epoch"
          className="rounded p-1 text-slate-300 hover:bg-slate-800 hover:text-[#ebcaa1]"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onTogglePlay}
          aria-label={isPlaying ? 'Pause evolution' : 'Play evolution'}
          className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
            isPlaying
              ? 'bg-[#98472b]/20 text-[#ebcaa1]'
              : 'bg-[#98472b]/15 text-[#ebcaa1] hover:bg-[#98472b]/25'
          }`}
        >
          {isPlaying ? (
            <>
              <Pause className="h-3 w-3" />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play className="h-3 w-3" />
              <span>Evolve</span>
            </>
          )}
        </button>
        <button
          type="button"
          onClick={handleNext}
          aria-label="Next epoch"
          className="rounded p-1 text-slate-300 hover:bg-slate-800 hover:text-[#ebcaa1]"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="h-4 w-px bg-slate-700/80" />

      <div className="flex items-center gap-1">
        {EPOCHS.map((yr) => {
          const active = activeYear === yr;
          return (
            <button
              key={yr}
              type="button"
              onClick={() => onChangeYear(active ? null : yr)}
              className={`rounded-md px-2 py-1 font-mono text-[11px] transition-all ${
                active
                  ? 'bg-[#cd9b76] text-[#0c0503] font-semibold shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-[#dab089]'
              }`}
            >
              {yr}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => onChangeYear(null)}
          className={`rounded-md px-2 py-1 font-mono text-[10px] transition-colors ${
            activeYear === null
              ? 'bg-[#98472b]/20 text-[#ebcaa1] border border-[#cd9b76]/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Live
        </button>
      </div>
    </div>
  );
}

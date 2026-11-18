import { useEffect, useRef, useState } from 'react';
import { Loader2, MapPin, Search, X } from 'lucide-react';
import { HYDERABAD_LANDMARKS } from '../config/gisConfig';
import { searchHyderabadLocations } from '../services/osmService';
import type { NominatimResult } from '../types/gis';

interface LocationSearchProps {
  onSelectLocation: (lng: number, lat: number, zoom: number, label: string) => void;
}

export function LocationSearch({ onSelectLocation }: LocationSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setError(null);
      return;
    }

    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await searchHyderabadLocations(trimmed);
        setResults(data);
        setOpen(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed');
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 380);

    return () => window.clearTimeout(timer);
  }, [query]);

  const handleSelectResult = (item: NominatimResult) => {
    const lng = parseFloat(item.lon);
    const lat = parseFloat(item.lat);
    if (!Number.isNaN(lng) && !Number.isNaN(lat)) {
      onSelectLocation(lng, lat, 14.5, item.display_name.split(',')[0]);
      setQuery(item.display_name.split(',')[0]);
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <Search className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Hyderabad places (OSM Nominatim)..."
          aria-label="Search Hyderabad locations"
          className="w-full rounded-lg border border-[#98472b]/50/80 bg-[#140906]/95 py-2 pl-9 pr-8 text-xs text-slate-100 placeholder-slate-500 shadow-lg backdrop-blur-md focus:border-[#cd9b76]/60 focus:outline-none"
        />
        {loading && (
          <Loader2 className="absolute right-3 h-3.5 w-3.5 animate-spin text-[#cd9b76]" />
        )}
        {!loading && query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setResults([]);
            }}
            className="absolute right-2.5 text-slate-400 hover:text-slate-200"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1.5 max-h-72 overflow-y-auto rounded-lg border border-[#98472b]/50/80 bg-[#140906]/98 p-1.5 shadow-2xl backdrop-blur-xl">
          {error && (
            <div className="px-2.5 py-2 text-xs text-[#ebcaa1]">
              {error} — You can still select verified landmarks below.
            </div>
          )}

          {results.length > 0 && (
            <div className="mb-1.5">
              <div className="px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-[#cd9b76]">
                OpenStreetMap Nominatim Results
              </div>
              {results.map((r) => (
                <button
                  key={r.place_id}
                  type="button"
                  onClick={() => handleSelectResult(r)}
                  className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs text-slate-200 hover:bg-[#98472b]/15"
                >
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#cd9b76]" />
                  <span className="line-clamp-2">{r.display_name}</span>
                </button>
              ))}
            </div>
          )}

          <div>
            <div className="px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-slate-400">
              Verified Hyderabad Landmarks
            </div>
            <div className="grid grid-cols-1 gap-0.5">
              {HYDERABAD_LANDMARKS.map((lm) => (
                <button
                  key={lm.id}
                  type="button"
                  onClick={() => {
                    onSelectLocation(
                      lm.coordinates[0],
                      lm.coordinates[1],
                      lm.zoom,
                      lm.name
                    );
                    setOpen(false);
                  }}
                  className="flex items-center justify-between rounded-md px-2 py-1.5 text-left text-xs text-slate-300 hover:bg-slate-800/80"
                >
                  <span className="truncate">{lm.name}</span>
                  <span className="ml-2 shrink-0 rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-[#ebcaa1]">
                    {lm.category}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

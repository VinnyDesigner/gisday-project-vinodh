import { useState } from 'react';
import {
  BookOpen,
  BookOpenCheck,
  Clock,
  Compass,
  Layers,
  Map as MapIcon,
  Menu,
  X,
} from 'lucide-react';
import type { AppView } from '../types/gis';

interface NavbarProps {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
}

const NAV_ITEMS: { id: AppView; label: string; icon: typeof Compass }[] = [
  { id: 'landing', label: 'Overview', icon: Compass },
  { id: 'story', label: 'Story Atlas', icon: BookOpenCheck },
  { id: 'explorer', label: 'GIS Explorer', icon: MapIcon },
  { id: 'historical', label: 'Historical Archive', icon: Clock },
  { id: 'analysis', label: 'LULC & Indices', icon: Layers },
  { id: 'methodology', label: 'Methodology & Sources', icon: BookOpen },
];

export function Navbar({ activeView, onNavigate }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSelect = (view: AppView) => {
    onNavigate(view);
    setMobileOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-[#cd9b76]/15 bg-[#0c0503]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between px-4 sm:px-6">
        <button
          type="button"
          onClick={() => handleSelect('landing')}
          className="flex items-center gap-3 text-left group"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-md border border-[#cd9b76]/40 bg-[#98472b]/10 text-[#cd9b76] transition-colors group-hover:bg-[#98472b]/20">
            <Compass className="h-4 w-4" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif text-lg tracking-wide text-slate-100">
                Hyderabad Through Time
              </span>
              <span className="hidden items-center gap-1 rounded border border-[#98472b]/50 bg-[#98472b]/15 px-2 py-0.5 sm:inline-flex">
                <img
                  src="/images/gis-day-logo.png"
                  alt="GIS Day"
                  className="h-3.5 w-auto object-contain brightness-0 invert"
                />
                <span className="font-mono text-[10px] text-[#ebcaa1]">2026</span>
              </span>
            </div>
          </div>
        </button>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  active
                    ? 'border border-[#cd9b76]/40 bg-[#98472b]/15 text-[#ebcaa1]'
                    : 'border border-transparent text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Mobile Menu Toggle */}
        <button
          type="button"
          onClick={() => setMobileOpen((prev) => !prev)}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-[#641600]/55 bg-slate-900/70 text-slate-300 md:hidden"
          aria-label="Toggle navigation menu"
        >
          {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {/* Mobile Dropdown */}
      {mobileOpen && (
        <nav className="border-t border-[#641600]/55 bg-[#140906] px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item.id)}
                  className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium ${
                    active
                      ? 'bg-[#98472b]/15 text-[#ebcaa1]'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
}

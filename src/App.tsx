import { useState } from 'react';
import { InteractiveCursorGlow } from './components/InteractiveCursorGlow';
import { Navbar } from './components/Navbar';
import type { FlyToTarget } from './components/MapViewport';
import type { StoryChapter } from './config/storyChapters';
import { useOsmLayers } from './hooks/useOsmLayers';
import { useStudyBoundaries } from './hooks/useStudyBoundaries';
import type {
  AnalyticalLayerId,
  AppView,
  BasemapId,
  HistoricalYear,
} from './types/gis';
import { AnalysisView } from './views/AnalysisView';
import { ExplorerView } from './views/ExplorerView';
import { HistoricalView } from './views/HistoricalView';
import { LandingPage } from './views/LandingPage';
import { MethodologyView } from './views/MethodologyView';
import { StoryView } from './views/StoryView';

export function App() {
  const [activeView, setActiveView] = useState<AppView>('landing');
  const [basemapId, setBasemapId] = useState<BasemapId>('esri-imagery');
  const [activeYear, setActiveYear] = useState<HistoricalYear | null>(null);
  const [historicalViewYear, setHistoricalViewYear] =
    useState<HistoricalYear>(2025);
  const [activeAnalytical, setActiveAnalytical] =
    useState<AnalyticalLayerId | null>(null);
  const [analysisViewLens, setAnalysisViewLens] =
    useState<AnalyticalLayerId>('ndbi');
  const [flyToTarget, setFlyToTarget] = useState<FlyToTarget | null>(null);

  const {
    layerStates,
    vectorData,
    vectorVisibility,
    toggleVectorLayer,
    ensureLayerEnabled,
    retryLayer,
  } = useOsmLayers();

  const studyBoundaries = useStudyBoundaries();

  const handleSelectLocation = (
    lng: number,
    lat: number,
    zoom: number,
    label?: string
  ) => {
    setFlyToTarget({
      lng,
      lat,
      zoom,
      label,
      nonce: Date.now(),
    });
  };

  const handleExploreLandmark = (
    lng: number,
    lat: number,
    zoom: number,
    label: string
  ) => {
    setActiveView('explorer');
    handleSelectLocation(lng, lat, zoom, label);
  };

  const handleOpenStoryChapterInExplorer = (chapter: StoryChapter) => {
    setBasemapId(chapter.basemapId);
    setActiveYear(chapter.activeYear);
    setActiveAnalytical(chapter.activeAnalytical);
    for (const vl of chapter.vectorLayers) {
      ensureLayerEnabled(vl);
    }
    setFlyToTarget({
      lng: chapter.camera.lng,
      lat: chapter.camera.lat,
      zoom: chapter.camera.zoom,
      pitch: chapter.camera.pitch,
      bearing: chapter.camera.bearing,
      nonce: Date.now(),
    });
    setActiveView('explorer');
  };

  return (
    <div className="relative min-h-screen bg-[#0c0503] text-slate-100">
      <InteractiveCursorGlow />
      <Navbar activeView={activeView} onNavigate={setActiveView} />

      <main>
        {activeView === 'landing' && (
          <LandingPage
            onNavigate={setActiveView}
            onExploreLandmark={handleExploreLandmark}
          />
        )}

        {activeView === 'story' && (
          <StoryView
            vectorData={vectorData}
            studyBoundaries={studyBoundaries}
            onEnsureVector={ensureLayerEnabled}
            onOpenInExplorer={handleOpenStoryChapterInExplorer}
          />
        )}

        {activeView === 'explorer' && (
          <ExplorerView
            basemapId={basemapId}
            onChangeBasemap={setBasemapId}
            activeYear={activeYear}
            onChangeYear={setActiveYear}
            activeAnalytical={activeAnalytical}
            onChangeAnalytical={setActiveAnalytical}
            layerStates={layerStates}
            vectorData={vectorData}
            vectorVisibility={vectorVisibility}
            onToggleVector={toggleVectorLayer}
            onRetryVector={retryLayer}
            studyBoundaries={studyBoundaries}
            flyToTarget={flyToTarget}
            onSelectLocation={handleSelectLocation}
            onOpenMethodology={() => setActiveView('methodology')}
          />
        )}

        {activeView === 'historical' && (
          <HistoricalView
            activeYear={historicalViewYear}
            onChangeYear={setHistoricalViewYear}
            vectorData={vectorData}
            vectorVisibility={vectorVisibility}
            studyBoundaries={studyBoundaries}
            flyToTarget={flyToTarget}
            onOpenMethodology={() => setActiveView('methodology')}
          />
        )}

        {activeView === 'analysis' && (
          <AnalysisView
            activeAnalytical={analysisViewLens}
            onChangeAnalytical={setAnalysisViewLens}
            layerStates={layerStates}
            vectorData={vectorData}
            vectorVisibility={vectorVisibility}
            onEnsureVector={ensureLayerEnabled}
            studyBoundaries={studyBoundaries}
            flyToTarget={flyToTarget}
            onOpenMethodology={() => setActiveView('methodology')}
          />
        )}

        {activeView === 'methodology' && <MethodologyView />}
      </main>
    </div>
  );
}

export default App;

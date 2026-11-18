import { useCallback, useEffect, useState } from 'react';
import { fetchOfficialBoundary } from '../services/apiService';
import type {
  BoundaryBundle,
  FetchStatus,
  StudyAreaId,
  StudyAreaMode,
} from '../types/gis';

export function useStudyBoundaries() {
  const [studyAreaMode, setStudyAreaMode] = useState<StudyAreaMode>('hmda');
  const [showHmda, setShowHmda] = useState(true);
  const [showGhmc, setShowGhmc] = useState(true);
  const [boundaries, setBoundaries] = useState<
    Partial<Record<StudyAreaId, BoundaryBundle>>
  >({});
  const [status, setStatus] = useState<FetchStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setStatus('loading');
    setErrorMessage(null);
    try {
      const [hmda, ghmc] = await Promise.all([
        fetchOfficialBoundary('hmda'),
        fetchOfficialBoundary('ghmc'),
      ]);
      setBoundaries({ hmda, ghmc });
      setStatus('ready');
    } catch (err) {
      setStatus('error');
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to load TGRAC boundaries'
      );
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleSelectMode = useCallback((mode: StudyAreaMode) => {
    setStudyAreaMode(mode);
    if (mode === 'hmda') {
      setShowHmda(true);
      setShowGhmc(false);
    } else if (mode === 'ghmc') {
      setShowHmda(false);
      setShowGhmc(true);
    } else {
      setShowHmda(true);
      setShowGhmc(true);
    }
  }, []);

  const activeAreaForApi: StudyAreaId =
    studyAreaMode === 'ghmc' ? 'ghmc' : 'hmda';

  return {
    studyAreaMode,
    activeAreaForApi,
    setStudyAreaMode: handleSelectMode,
    showHmda,
    setShowHmda,
    showGhmc,
    setShowGhmc,
    boundaries,
    status,
    errorMessage,
    reload: loadAll,
  };
}

import { useCallback, useEffect, useState } from 'react';
import { HYDERABAD_LANDMARKS } from '../config/gisConfig';
import { fetchOsmVectorLayer } from '../services/osmService';
import type { VectorLayerId, VectorLayerState } from '../types/gis';

type OsmLayerKey = Exclude<VectorLayerId, 'landmarks'>;

const INITIAL_STATES: Record<VectorLayerId, VectorLayerState> = {
  landmarks: {
    enabled: true,
    opacity: 1,
    status: 'ready',
    featureCount: HYDERABAD_LANDMARKS.length,
    errorMessage: null,
  },
  'osm-waterbodies': {
    enabled: true,
    opacity: 1,
    status: 'idle',
    featureCount: null,
    errorMessage: null,
  },
  'ghmc-boundary': {
    enabled: true,
    opacity: 1,
    status: 'idle',
    featureCount: null,
    errorMessage: null,
  },
  'osm-vegetation': {
    enabled: false,
    opacity: 1,
    status: 'idle',
    featureCount: null,
    errorMessage: null,
  },
  'osm-roads': {
    enabled: false,
    opacity: 1,
    status: 'idle',
    featureCount: null,
    errorMessage: null,
  },
};

export function useOsmLayers() {
  const [layerStates, setLayerStates] =
    useState<Record<VectorLayerId, VectorLayerState>>(INITIAL_STATES);
  const [vectorData, setVectorData] = useState<
    Partial<Record<OsmLayerKey, GeoJSON.FeatureCollection>>
  >({});

  const loadOsmLayer = useCallback(async (id: OsmLayerKey) => {
    setLayerStates((prev) => ({
      ...prev,
      [id]: { ...prev[id], status: 'loading', errorMessage: null },
    }));

    try {
      const fc = await fetchOsmVectorLayer(id);
      setVectorData((prev) => ({ ...prev, [id]: fc }));
      setLayerStates((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          status: 'ready',
          featureCount: fc.features.length,
          errorMessage: null,
        },
      }));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load OSM Overpass data';
      setLayerStates((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          status: 'error',
          errorMessage: message,
        },
      }));
    }
  }, []);

  const toggleVectorLayer = useCallback(
    (id: VectorLayerId) => {
      setLayerStates((prev) => {
        const nextEnabled = !prev[id].enabled;
        if (
          nextEnabled &&
          id !== 'landmarks' &&
          prev[id].status === 'idle'
        ) {
          void loadOsmLayer(id);
        }
        return {
          ...prev,
          [id]: { ...prev[id], enabled: nextEnabled },
        };
      });
    },
    [loadOsmLayer]
  );

  const ensureLayerEnabled = useCallback(
    (id: VectorLayerId) => {
      setLayerStates((prev) => {
        if (id !== 'landmarks' && prev[id].status === 'idle') {
          void loadOsmLayer(id);
        }
        if (prev[id].enabled) return prev;
        return {
          ...prev,
          [id]: { ...prev[id], enabled: true },
        };
      });
    },
    [loadOsmLayer]
  );

  // Auto-load initially enabled OSM layers
  useEffect(() => {
    (['osm-waterbodies', 'ghmc-boundary'] as OsmLayerKey[]).forEach((id) => {
      if (layerStates[id].enabled && layerStates[id].status === 'idle') {
        void loadOsmLayer(id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const vectorVisibility: Record<VectorLayerId, boolean> = {
    landmarks: layerStates.landmarks.enabled,
    'ghmc-boundary': layerStates['ghmc-boundary'].enabled,
    'osm-waterbodies': layerStates['osm-waterbodies'].enabled,
    'osm-vegetation': layerStates['osm-vegetation'].enabled,
    'osm-roads': layerStates['osm-roads'].enabled,
  };

  return {
    layerStates,
    vectorData,
    vectorVisibility,
    toggleVectorLayer,
    ensureLayerEnabled,
    retryLayer: loadOsmLayer,
  };
}

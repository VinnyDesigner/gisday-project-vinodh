const STORAGE_KEY = 'htt_gee_overrides_v1';

export type GeeOverrideMap = Record<string, string>;

export function getGeeOverrides(): GeeOverrideMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as GeeOverrideMap;
  } catch {
    return {};
  }
}

export function setGeeOverride(envVarName: string, tileUrl: string): void {
  const trimmed = tileUrl.trim();
  const current = getGeeOverrides();
  if (!trimmed) {
    delete current[envVarName];
  } else {
    current[envVarName] = trimmed;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    window.dispatchEvent(new Event('htt-gee-updated'));
  } catch {
    // Ignore storage quota errors
  }
}

export type ControlSettings = {
  openaiKey?: string;
  defaultStyle: string;
  defaultAspect: '1:1' | '4:5' | '16:9';
  defaultMode: 'image' | 'gif';
  defaultQuality: 'standard' | 'high';
  allowHistory: boolean;
  clientCooldownEnabled: boolean;
  minSecondsBetweenGenerations: number;
  maxDailyGenerations: number;
};

const STORAGE_KEY = 'illuvrse:control';

const defaultSettings: ControlSettings = {
  defaultStyle: 'clean',
  defaultAspect: '1:1',
  defaultMode: 'image',
  defaultQuality: 'standard',
  allowHistory: true,
  clientCooldownEnabled: true,
  minSecondsBetweenGenerations: 5,
  maxDailyGenerations: 100
};

function isBrowser() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

export function getControlSettings(): ControlSettings {
  if (!isBrowser()) return { ...defaultSettings };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultSettings };
    const parsed = JSON.parse(raw) as Partial<ControlSettings>;
    return { ...defaultSettings, ...parsed };
  } catch {
    return { ...defaultSettings };
  }
}

export function setControlSettings(settings: Partial<ControlSettings>) {
  if (!isBrowser()) return;
  const merged = { ...getControlSettings(), ...settings };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
}

export function clearOpenAIKey() {
  if (!isBrowser()) return;
  const current = getControlSettings();
  delete current.openaiKey;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
}

import Storage from 'expo-sqlite/kv-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { isTutorialStep, type TutorialStep } from '@/game/tutorial';

export type ControlsSize = 'small' | 'medium' | 'large';

export type Settings = {
  controlsSize: ControlsSize;
  showHints: boolean;
  /** Sound effects on or off. */
  soundEffects: boolean;
  /** Ambient day and night loops on or off. */
  music: boolean;
  /** Master volume, 0 to 10. */
  volume: number;
  /** The first-time tutorial was finished or skipped. */
  tutorialDone: boolean;
  /** Where the tutorial is, so it resumes after leaving a world. */
  tutorialStep: TutorialStep;
};

export const DEFAULT_SETTINGS: Settings = {
  controlsSize: 'medium',
  showHints: true,
  soundEffects: true,
  music: true,
  volume: 8,
  tutorialDone: false,
  tutorialStep: 'walk',
};

export const MAX_VOLUME = 10;

const KEY = 'blockhaven.settings.v1';

export const CONTROL_SIZES: Record<ControlsSize, number> = { small: 56, medium: 68, large: 84 };

export function parseSettings(raw: string | null): Settings {
  if (!raw) return DEFAULT_SETTINGS;
  try {
    const value = JSON.parse(raw) as Partial<Settings>;
    return {
      controlsSize:
        value.controlsSize === 'small' || value.controlsSize === 'large' || value.controlsSize === 'medium'
          ? value.controlsSize
          : DEFAULT_SETTINGS.controlsSize,
      showHints: typeof value.showHints === 'boolean' ? value.showHints : DEFAULT_SETTINGS.showHints,
      soundEffects: typeof value.soundEffects === 'boolean' ? value.soundEffects : DEFAULT_SETTINGS.soundEffects,
      music: typeof value.music === 'boolean' ? value.music : DEFAULT_SETTINGS.music,
      volume:
        typeof value.volume === 'number' && Number.isFinite(value.volume)
          ? Math.max(0, Math.min(MAX_VOLUME, Math.round(value.volume)))
          : DEFAULT_SETTINGS.volume,
      tutorialDone: typeof value.tutorialDone === 'boolean' ? value.tutorialDone : DEFAULT_SETTINGS.tutorialDone,
      tutorialStep: isTutorialStep(value.tutorialStep) ? value.tutorialStep : DEFAULT_SETTINGS.tutorialStep,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

type SettingsContextValue = {
  settings: Settings;
  /** False until the stored settings have been read, so first-run UI does not flash. */
  loaded: boolean;
  update: (patch: Partial<Settings>) => void;
};

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  update: () => undefined,
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Storage.getItem(KEY)
      .then((raw) => setSettings(parseSettings(raw)))
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      Storage.setItem(KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ settings, loaded, update }), [settings, loaded, update]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  return useContext(SettingsContext);
}

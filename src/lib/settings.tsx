import Storage from 'expo-sqlite/kv-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ControlsSize = 'small' | 'medium' | 'large';

export type Settings = {
  controlsSize: ControlsSize;
  showHints: boolean;
};

export const DEFAULT_SETTINGS: Settings = { controlsSize: 'medium', showHints: true };

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
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

type SettingsContextValue = {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
};

const SettingsContext = createContext<SettingsContextValue>({ settings: DEFAULT_SETTINGS, update: () => undefined });

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    Storage.getItem(KEY)
      .then((raw) => setSettings(parseSettings(raw)))
      .catch(() => undefined);
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      Storage.setItem(KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ settings, update }), [settings, update]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  return useContext(SettingsContext);
}

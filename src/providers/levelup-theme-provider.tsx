import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export type ThemeMode = 'dark' | 'light';

type ThemePalette = {
  background: string;
  surface: string;
  raised: string;
  border: string;
  text: string;
  secondary: string;
  muted: string;
  accent: string;
  accentSoft: string;
  green: string;
  greenSoft: string;
  amber: string;
  amberSoft: string;
  red: string;
  redSoft: string;
};

const palettes: Record<ThemeMode, ThemePalette> = {
  dark: {
    background: '#101214',
    surface: '#191c1f',
    raised: '#22262a',
    border: '#30353a',
    text: '#f1f3f4',
    secondary: '#b2bac0',
    muted: '#828b92',
    accent: '#a6e46d',
    accentSoft: '#26351d',
    green: '#a6e46d',
    greenSoft: '#26351d',
    amber: '#f0c36a',
    amberSoft: '#392f1b',
    red: '#ff8275',
    redSoft: '#3d2422',
  },
  light: {
    background: '#f3f5f2',
    surface: '#ffffff',
    raised: '#edf0eb',
    border: '#dce2d9',
    text: '#20251f',
    secondary: '#586257',
    muted: '#747f72',
    accent: '#386b1f',
    accentSoft: '#e7f1df',
    green: '#386b1f',
    greenSoft: '#e7f1df',
    amber: '#8e630c',
    amberSoft: '#f7eed8',
    red: '#a3382d',
    redSoft: '#fae9e6',
  },
};

const STORAGE_KEY = 'levelup-theme';
let webTheme: ThemeMode = 'dark';

type ThemeContextValue = {
  mode: ThemeMode;
  colors: ThemePalette;
  setMode: (mode: ThemeMode) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

async function getSavedTheme() {
  if (Platform.OS === 'web') return webTheme;
  const saved = await SecureStore.getItemAsync(STORAGE_KEY);
  return saved === 'light' ? 'light' : 'dark';
}

export function LevelUpThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('dark');

  useEffect(() => {
    let active = true;
    void getSavedTheme()
      .then((saved) => {
        if (active) setModeState(saved);
      })
      .catch(() => {
        if (active) setModeState('dark');
      });
    return () => {
      active = false;
    };
  }, []);

  const setMode = async (next: ThemeMode) => {
    if (Platform.OS === 'web') webTheme = next;
    else await SecureStore.setItemAsync(STORAGE_KEY, next);
    setModeState(next);
  };

  const value = useMemo(
    () => ({ mode, colors: palettes[mode], setMode }),
    [mode],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useLevelUpTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useLevelUpTheme must be used inside LevelUpThemeProvider.');
  return context;
}

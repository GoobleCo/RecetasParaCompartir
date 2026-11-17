import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

export type ThemeMode = 'system' | 'light' | 'dark';

const light = {
  bg: '#F3F6F9',
  card: '#FFFFFF',
  cardAlt: '#E8EEF4',
  text: '#0E1A26',
  muted: '#5B6B7B',
  border: '#D5DEE7',
  primary: '#0891B2',
  primarySoft: '#CFF3FA',
  onPrimary: '#FFFFFF',
  danger: '#DC2626',
  dangerSoft: '#FDE2E2',
  success: '#16A34A',
  successSoft: '#DCFCE7',
  star: '#F59E0B',
  overlay: 'rgba(0,0,0,0.35)',
};

const dark: typeof light = {
  bg: '#0A0F14',
  card: '#121A22',
  cardAlt: '#1A2530',
  text: '#E6EEF5',
  muted: '#8A9AAA',
  border: '#243240',
  primary: '#22D3EE',
  primarySoft: '#0E3A46',
  onPrimary: '#04141A',
  danger: '#F87171',
  dangerSoft: '#3B1717',
  success: '#4ADE80',
  successSoft: '#123222',
  star: '#FBBF24',
  overlay: 'rgba(0,0,0,0.6)',
};

export type Colors = typeof light;

type ThemeCtx = { colors: Colors; isDark: boolean; mode: ThemeMode; setMode: (m: ThemeMode) => void };
const Ctx = createContext<ThemeCtx>({ colors: light, isDark: false, mode: 'system', setMode: () => {} });
const KEY = 'omega.theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => { if (v === 'light' || v === 'dark' || v === 'system') setModeState(v); })
      .catch(() => {});
  }, []);

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    AsyncStorage.setItem(KEY, m).catch(() => {});
  };

  const isDark = mode === 'dark' || (mode === 'system' && system === 'dark');
  const value = useMemo(() => ({ colors: isDark ? dark : light, isDark, mode, setMode }), [isDark, mode]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);

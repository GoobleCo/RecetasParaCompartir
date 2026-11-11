import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

export type ThemeMode = 'system' | 'light' | 'dark';

const light = {
  bg: '#FFF8F1',
  card: '#FFFFFF',
  cardAlt: '#FBEFE4',
  text: '#2A1E17',
  muted: '#7A6A5F',
  border: '#EADBCB',
  primary: '#D9480F',
  primarySoft: '#FDE3D3',
  onPrimary: '#FFFFFF',
  danger: '#C92A2A',
  dangerSoft: '#FDE2E2',
  success: '#2B8A3E',
  star: '#F59F00',
  overlay: 'rgba(0,0,0,0.35)',
};

const dark: typeof light = {
  bg: '#17120F',
  card: '#221B16',
  cardAlt: '#2C231C',
  text: '#F5EDE6',
  muted: '#A8988B',
  border: '#3A2F27',
  primary: '#FF7A3D',
  primarySoft: '#4A2614',
  onPrimary: '#1A0F08',
  danger: '#FF6B6B',
  dangerSoft: '#4A1C1C',
  success: '#69DB7C',
  star: '#FFC233',
  overlay: 'rgba(0,0,0,0.6)',
};

export type Colors = typeof light;

type ThemeCtx = { colors: Colors; isDark: boolean; mode: ThemeMode; setMode: (m: ThemeMode) => void };
const Ctx = createContext<ThemeCtx>({ colors: light, isDark: false, mode: 'system', setMode: () => {} });
const KEY = 'sazon.theme';

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

import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** true si el .env / variables de EAS están cargadas */
export const isConfigured = /^https:\/\//.test(url) && anonKey.length > 20;

/**
 * Almacenamiento SEGURO de la sesión (tokens JWT).
 * En el celular se guarda en el llavero cifrado del sistema (Keystore / Keychain)
 * con expo-secure-store. Como SecureStore admite valores chicos (~2 KB), el token
 * se parte en pedazos. En web se usa localStorage.
 */
const CHUNK_SIZE = 1800;
const safeKey = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, '_');

const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(key) ?? null;
    const k = safeKey(key);
    const count = await SecureStore.getItemAsync(`${k}.n`);
    if (!count) return null;
    const parts: string[] = [];
    for (let i = 0; i < Number(count); i++) {
      const part = await SecureStore.getItemAsync(`${k}.${i}`);
      if (part == null) return null;
      parts.push(part);
    }
    return parts.join('');
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.setItem(key, value);
      return;
    }
    await secureStorage.removeItem(key);
    const k = safeKey(key);
    const chunks = Math.ceil(value.length / CHUNK_SIZE);
    for (let i = 0; i < chunks; i++) {
      await SecureStore.setItemAsync(`${k}.${i}`, value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
    }
    await SecureStore.setItemAsync(`${k}.n`, String(chunks));
  },
  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.removeItem(key);
      return;
    }
    const k = safeKey(key);
    const count = await SecureStore.getItemAsync(`${k}.n`);
    if (count) {
      for (let i = 0; i < Number(count); i++) await SecureStore.deleteItemAsync(`${k}.${i}`);
    }
    await SecureStore.deleteItemAsync(`${k}.n`);
  },
};

export const supabase = createClient(
  isConfigured ? url : 'https://no-configurado.supabase.co',
  isConfigured ? anonKey : 'no-configurado-no-configurado-no-configurado',
  {
    auth: {
      storage: secureStorage,
      autoRefreshToken: true, // renueva el JWT antes de que venza
      persistSession: true,   // la sesión sobrevive a cerrar la app
      detectSessionInUrl: false,
      flowType: 'pkce',       // OAuth seguro para apps móviles
    },
  },
);

// Sólo refrescamos tokens mientras la app está en primer plano (recomendación de Supabase)
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

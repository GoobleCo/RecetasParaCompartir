import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { AppError } from './errors';
import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

export type OAuthProvider = 'github' | 'google';

export const OAUTH_PROVIDERS: OAuthProvider[] = (process.env.EXPO_PUBLIC_OAUTH_PROVIDERS ?? 'github')
  .split(',')
  .map((p) => p.trim().toLowerCase())
  .filter((p): p is OAuthProvider => p === 'github' || p === 'google');

export const PROVIDER_LABEL: Record<OAuthProvider, string> = { github: 'GitHub', google: 'Google' };

/**
 * Social Login con flujo OAuth + PKCE:
 * 1. Supabase nos da la URL del proveedor.
 * 2. Se abre el navegador del sistema para que el usuario autorice.
 * 3. El proveedor vuelve a sazon://auth-callback?code=...
 * 4. Cambiamos ese código por una sesión (JWT) de Supabase.
 * Devuelve false si el usuario cancela.
 */
export async function signInWithProvider(provider: OAuthProvider): Promise<boolean> {
  const redirectTo = Linking.createURL('auth-callback');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data?.url) throw new AppError('No se pudo iniciar el login social.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return false;

  const { queryParams } = Linking.parse(result.url);
  const errDesc = queryParams?.error_description ?? queryParams?.error;
  if (errDesc) throw new AppError(`El proveedor rechazó el inicio de sesión: ${String(errDesc)}`);

  const code = queryParams?.code;
  if (typeof code === 'string') {
    const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
    if (exErr) throw exErr;
    return true;
  }

  // Respaldo: flujo implícito (tokens en el fragmento #)
  const hash = new URLSearchParams(result.url.split('#')[1] ?? '');
  const access_token = hash.get('access_token');
  const refresh_token = hash.get('refresh_token');
  if (access_token && refresh_token) {
    const { error: sErr } = await supabase.auth.setSession({ access_token, refresh_token });
    if (sErr) throw sErr;
    return true;
  }
  throw new AppError('No se recibió la autorización del proveedor.');
}

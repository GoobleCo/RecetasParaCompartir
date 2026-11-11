import type { Session } from '@supabase/supabase-js';
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { getProfile, Profile } from './api';
import { unregisterPush } from './notifications';
import { isConfigured, supabase } from './supabase';

type AuthCtx = {
  session: Session | null;
  profile: Profile | null;
  initializing: boolean;
  profileError: string | null;
  isAdmin: boolean;
  isStaff: boolean;
  /** true mientras se completa un cambio de contraseña por recuperación */
  holdRedirect: boolean;
  setHoldRedirect: (v: boolean) => void;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [holdRedirect, setHoldRedirect] = useState(false);
  const userId = session?.user.id;
  const loadSeq = useRef(0);

  // 1) Recuperar la sesión guardada (persistencia entre usos) y escuchar cambios
  useEffect(() => {
    if (!isConfigured) {
      setInitializing(false);
      return;
    }
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .finally(() => setInitializing(false));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // 2) Cargar el perfil (con su rol) cada vez que cambia el usuario
  const refreshProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      return;
    }
    const seq = ++loadSeq.current;
    try {
      // El perfil lo crea un trigger: reintentamos por si recién se registró
      let p: Profile | null = null;
      for (let i = 0; i < 3 && !p; i++) {
        try {
          p = await getProfile(userId);
        } catch (e) {
          if (i === 2) throw e;
          await new Promise((r) => setTimeout(r, 600));
        }
      }
      if (seq === loadSeq.current) {
        setProfile(p);
        setProfileError(null);
      }
    } catch (e) {
      if (seq === loadSeq.current) setProfileError('No se pudo cargar tu perfil.');
    }
  }, [userId]);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const signOut = useCallback(async () => {
    await unregisterPush();
    const { error } = await supabase.auth.signOut();
    if (error) await supabase.auth.signOut({ scope: 'local' }); // sin conexión: cerramos localmente igual
    setProfile(null);
  }, []);

  const value: AuthCtx = {
    session,
    profile,
    initializing,
    profileError,
    isAdmin: profile?.role === 'admin',
    isStaff: profile?.role === 'admin' || profile?.role === 'moderator',
    holdRedirect,
    setHoldRedirect,
    refreshProfile,
    signOut,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);

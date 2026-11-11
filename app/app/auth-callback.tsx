import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { Loading } from '../components/ui';
import { useAuth } from '../lib/auth';

/** Destino del deep link sazon://auth-callback al volver del login social */
export default function AuthCallback() {
  const { session } = useAuth();
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 8000);
    return () => clearTimeout(t);
  }, []);
  if (session) return <Redirect href="/(tabs)" />;
  if (timedOut) return <Redirect href="/(auth)/login" />;
  return <Loading label="Iniciando sesión…" />;
}

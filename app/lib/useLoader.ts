import { useFocusEffect } from 'expo-router';
import { DependencyList, useCallback, useRef, useState } from 'react';
import { friendlyError } from './errors';

/**
 * Carga datos con estados de carga, error y "pull to refresh".
 * Se vuelve a ejecutar cada vez que la pantalla recibe el foco,
 * así los datos quedan actualizados al volver de otra pantalla.
 */
export function useLoader<T>(fn: () => Promise<T>, deps: DependencyList) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const hasData = useRef(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps);

  const load = useCallback(async (mode: 'initial' | 'refresh' | 'silent') => {
    if (mode === 'initial' && !hasData.current) setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    try {
      const result = await run();
      setData(result);
      hasData.current = true;
      setError(null);
    } catch (e) {
      // Si ya mostramos datos y falla una recarga silenciosa, no tapamos la pantalla
      if (mode !== 'silent' || !hasData.current) setError(friendlyError(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [run]);

  useFocusEffect(
    useCallback(() => {
      load(hasData.current ? 'silent' : 'initial');
    }, [load]),
  );

  return {
    data,
    setData,
    error,
    loading,
    refreshing,
    refresh: () => load('refresh'),
    retry: () => { setError(null); setLoading(true); return load('initial'); },
  };
}

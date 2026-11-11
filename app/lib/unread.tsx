import * as Notifications from 'expo-notifications';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { unreadCount } from './api';
import { useAuth } from './auth';
import { supabase } from './supabase';

type UnreadCtx = { unread: number; refreshUnread: () => Promise<void> };
const Ctx = createContext<UnreadCtx>({ unread: 0, refreshUnread: async () => {} });

/**
 * Contador de notificaciones sin leer, actualizado en tiempo real
 * con Supabase Realtime (escucha INSERT en la tabla notifications).
 */
export function UnreadProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const uid = session?.user.id;
  const [unread, setUnread] = useState(0);

  const refreshUnread = useCallback(async () => {
    if (!uid) return setUnread(0);
    try {
      const n = await unreadCount();
      setUnread(n);
      if (Platform.OS !== 'web') Notifications.setBadgeCountAsync(n).catch(() => {});
    } catch {
      // sin conexión: dejamos el valor anterior
    }
  }, [uid]);

  useEffect(() => {
    refreshUnread();
    if (!uid) return;
    const channel = supabase
      .channel(`notif-${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
        () => refreshUnread())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [uid, refreshUnread]);

  return <Ctx.Provider value={{ unread, refreshUnread }}>{children}</Ctx.Provider>;
}

export const useUnread = () => useContext(Ctx);

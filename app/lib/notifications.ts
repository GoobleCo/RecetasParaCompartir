import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Cómo se muestran las notificaciones cuando la app está abierta
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

let currentToken: string | null = null;

export function getProjectId(): string | undefined {
  const id = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  return id && !String(id).startsWith('PEGAR') ? String(id) : undefined;
}

export type PushStatus = 'ok' | 'denied' | 'unsupported' | 'error';

/**
 * Pide permiso, obtiene el Expo Push Token del dispositivo y lo guarda en el
 * backend (RPC register_push_token). El backend lo usa para enviar los push.
 */
export async function registerForPush(): Promise<PushStatus> {
  try {
    if (Platform.OS === 'web' || !Device.isDevice) return 'unsupported';

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'General',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 200, 120, 200],
        lightColor: '#D9480F',
      });
    }

    const current = await Notifications.getPermissionsAsync();
    let granted = current.granted;
    if (!granted && current.canAskAgain) {
      granted = (await Notifications.requestPermissionsAsync()).granted;
    }
    if (!granted) return 'denied';

    const projectId = getProjectId();
    if (!projectId) return 'unsupported';

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    const { error } = await supabase.rpc('register_push_token', { p_token: token, p_platform: Platform.OS });
    if (error) throw error;
    currentToken = token;
    return 'ok';
  } catch (e) {
    // En Expo Go (Android) los push remotos no están disponibles: no rompemos la app.
    console.warn('Push no disponible:', e);
    return 'error';
  }
}

/** Al cerrar sesión, el dispositivo deja de recibir push de esa cuenta */
export async function unregisterPush(): Promise<void> {
  if (!currentToken) return;
  try {
    await supabase.rpc('unregister_push_token', { p_token: currentToken });
  } catch {
    // sin conexión: el token se limpia solo con la tarea semanal del servidor
  }
  currentToken = null;
}

/** Notificación local para demostrar el sistema durante la defensa */
export async function sendTestNotification(): Promise<void> {
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) await Notifications.requestPermissionsAsync();
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Sazón 🍳', body: '¡Las notificaciones funcionan correctamente!', data: { type: 'system' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 2 },
  });
}

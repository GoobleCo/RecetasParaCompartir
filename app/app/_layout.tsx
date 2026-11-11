import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Loading, OfflineBanner, T } from '../components/ui';
import { AuthProvider, useAuth } from '../lib/auth';
import { registerForPush } from '../lib/notifications';
import { isConfigured } from '../lib/supabase';
import { ThemeProvider, useTheme } from '../lib/theme';
import { UnreadProvider, useUnread } from '../lib/unread';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <UnreadProvider>
            <RootNavigator />
          </UnreadProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { session, profile, initializing, holdRedirect } = useAuth();
  const { colors, isDark } = useTheme();
  const { refreshUnread } = useUnread();

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.bg).catch(() => {});
  }, [colors.bg]);

  // Push: registrar el dispositivo al iniciar sesión
  useEffect(() => {
    if (profile?.id) registerForPush();
  }, [profile?.id]);

  // Push: al tocar una notificación, abrir la receta / el perfil correspondiente
  useEffect(() => {
    const open = (data: Record<string, unknown> | undefined) => {
      refreshUnread();
      if (!data) return;
      if (typeof data.recipeId === 'string') router.push(`/recipe/${data.recipeId}`);
      else if (data.type === 'follow' && typeof data.actorId === 'string') router.push(`/user/${data.actorId}`);
      else router.push('/(tabs)/notifications');
    };
    const sub = Notifications.addNotificationResponseReceivedListener((r) =>
      open(r.notification.request.content.data as Record<string, unknown>));
    const recv = Notifications.addNotificationReceivedListener(() => refreshUnread());
    return () => {
      sub.remove();
      recv.remove();
    };
  }, [refreshUnread]);

  if (!isConfigured) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.bg, gap: 8 }}>
        <T variant="h2">Falta configurar Supabase</T>
        <T muted>
          Definí EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY en el archivo .env (o en las variables de entorno de EAS) y volvé a iniciar la app.
        </T>
      </View>
    );
  }
  if (initializing) return <Loading />;

  const header = {
    headerStyle: { backgroundColor: colors.card },
    headerTintColor: colors.text,
    headerTitleStyle: { fontWeight: '700' as const },
    headerShadowVisible: false,
    contentStyle: { backgroundColor: colors.bg },
    headerBackTitle: 'Atrás',
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <OfflineBanner />
      <Stack screenOptions={header}>
        {/* Protección de rutas: sin sesión sólo se puede ver login/registro */}
        <Stack.Protected guard={!!session && !holdRedirect}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="recipe/[id]" options={{ title: 'Receta' }} />
          <Stack.Screen name="recipe/new" options={{ title: 'Nueva receta' }} />
          <Stack.Screen name="recipe/edit/[id]" options={{ title: 'Editar receta' }} />
          <Stack.Screen name="user/[id]" options={{ title: 'Perfil' }} />
          <Stack.Screen name="favorites" options={{ title: 'Mis favoritas' }} />
          <Stack.Screen name="settings/index" options={{ title: 'Configuración' }} />
          <Stack.Screen name="settings/profile" options={{ title: 'Editar perfil' }} />
          <Stack.Screen name="settings/password" options={{ title: 'Cambiar contraseña' }} />
          <Stack.Screen name="admin/index" options={{ title: 'Panel de administración' }} />
        </Stack.Protected>
        <Stack.Protected guard={!session || holdRedirect}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Screen name="auth-callback" options={{ headerShown: false }} />
      </Stack>
    </View>
  );
}

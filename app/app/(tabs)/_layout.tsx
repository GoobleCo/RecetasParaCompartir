import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useTheme } from '../../lib/theme';
import { useUnread } from '../../lib/unread';

export default function TabsLayout() {
  const { colors } = useTheme();
  const { unread } = useUnread();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '800' },
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen name="index" options={{
        title: 'Inicio', headerTitle: 'Sazón',
        tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} />,
      }} />
      <Tabs.Screen name="explore" options={{
        title: 'Explorar',
        tabBarIcon: ({ color, size }) => <Ionicons name="search" color={color} size={size} />,
      }} />
      <Tabs.Screen name="notifications" options={{
        title: 'Avisos', headerTitle: 'Notificaciones',
        tabBarBadge: unread > 0 ? (unread > 99 ? '99+' : unread) : undefined,
        tabBarIcon: ({ color, size }) => <Ionicons name="notifications" color={color} size={size} />,
      }} />
      <Tabs.Screen name="profile" options={{
        title: 'Perfil', headerTitle: 'Mi perfil',
        tabBarIcon: ({ color, size }) => <Ionicons name="person-circle" color={color} size={size} />,
      }} />
    </Tabs>
  );
}

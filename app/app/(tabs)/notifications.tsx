import { Ionicons } from '@expo/vector-icons';
import { router, useNavigation } from 'expo-router';
import { useEffect } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, View } from 'react-native';
import { Empty, ErrorView, IconName, Loading, T } from '../../components/ui';
import { AppNotification, deleteNotification, listNotifications, markAllRead, markRead } from '../../lib/api';
import { friendlyError } from '../../lib/errors';
import { useTheme } from '../../lib/theme';
import { useUnread } from '../../lib/unread';
import { useLoader } from '../../lib/useLoader';

const ICON: Record<AppNotification['type'], IconName> = {
  comment: 'chatbubble-ellipses', rating: 'star', follow: 'person-add', new_recipe: 'restaurant',
  daily: 'sunny', role: 'key', system: 'information-circle',
};

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'ahora';
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  if (s < 604800) return `hace ${Math.floor(s / 86400)} d`;
  return new Date(iso).toLocaleDateString('es-AR');
}

export default function Notifications() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const { unread, refreshUnread } = useUnread();
  const { data, setData, error, loading, refreshing, refresh, retry } = useLoader(listNotifications, []);

  // Si llega una notificación nueva mientras estamos en esta pantalla, recargamos
  useEffect(() => { refresh(); }, [unread]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => unread > 0 ? (
        <Pressable onPress={readAll} style={{ marginRight: 16 }} hitSlop={8}>
          <T style={{ color: colors.primary, fontWeight: '700' }}>Marcar leídas</T>
        </Pressable>
      ) : null,
    });
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const readAll = async () => {
    try {
      await markAllRead();
      setData((d) => d?.map((n) => ({ ...n, read: true })) ?? d);
      refreshUnread();
    } catch (e) {
      Alert.alert('Error', friendlyError(e));
    }
  };

  const open = async (n: AppNotification) => {
    if (!n.read) {
      setData((d) => d?.map((x) => (x.id === n.id ? { ...x, read: true } : x)) ?? d);
      markRead(n.id).then(refreshUnread).catch(() => {});
    }
    if (n.recipe_id) router.push(`/recipe/${n.recipe_id}`);
    else if (n.actor_id && n.type === 'follow') router.push(`/user/${n.actor_id}`);
  };

  const remove = (n: AppNotification) =>
    Alert.alert('Eliminar notificación', '¿Querés borrarla?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        try {
          await deleteNotification(n.id);
          setData((d) => d?.filter((x) => x.id !== n.id) ?? d);
          refreshUnread();
        } catch (e) { Alert.alert('Error', friendlyError(e)); }
      } },
    ]);

  if (loading) return <Loading />;
  if (error) return <ErrorView message={error} onRetry={retry} />;

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      data={data ?? []}
      keyExtractor={(n) => String(n.id)}
      contentContainerStyle={{ padding: 12, gap: 8 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { refresh(); refreshUnread(); }} tintColor={colors.primary} />}
      ListEmptyComponent={<Empty icon="notifications-off-outline" title="No tenés notificaciones"
        subtitle="Te avisamos cuando comenten o valoren tus recetas, o alguien te siga." />}
      ListFooterComponent={data && data.length > 0 ? <T variant="small" muted style={{ textAlign: 'center', marginTop: 8 }}>Mantené presionada una notificación para borrarla</T> : null}
      renderItem={({ item }) => (
        <Pressable onPress={() => open(item)} onLongPress={() => remove(item)} style={({ pressed }) => ({
          flexDirection: 'row', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1,
          borderColor: item.read ? colors.border : colors.primary,
          backgroundColor: item.read ? colors.card : colors.primarySoft, opacity: pressed ? 0.8 : 1,
        })}>
          <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={ICON[item.type] ?? 'notifications'} size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <T variant="h3">{item.title}</T>
            <T variant="small">{item.body}</T>
            <T variant="small" muted>{timeAgo(item.created_at)}</T>
          </View>
          {!item.read && <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary, marginTop: 6 }} />}
        </Pressable>
      )}
    />
  );
}

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { RecipeCard } from '../../components/RecipeCard';
import { Avatar, Chip, Empty, ErrorView, IconName, Loading, SectionHeader, styles, T } from '../../components/ui';
import { getCategories, getFeed, homeStats, listRecipes } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useTheme } from '../../lib/theme';
import { useLoader } from '../../lib/useLoader';

export default function Home() {
  const { colors } = useTheme();
  const { profile } = useAuth();
  const { data, error, loading, refreshing, refresh, retry } = useLoader(async () => {
    const [stats, categories, feed, top, latest] = await Promise.all([
      homeStats(),
      getCategories(),
      getFeed(),
      listRecipes({ order: 'top', limit: 8 }),
      listRecipes({ order: 'recent', limit: 6 }),
    ]);
    return { stats, categories, feed, top: top.filter((r) => r.rating_count > 0), latest };
  }, []);

  if (loading) return <Loading />;
  if (error || !data) return <ErrorView message={error ?? 'Sin datos'} onRetry={retry} />;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buen día' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';
  const name = profile?.full_name?.split(' ')[0] ?? profile?.username ?? '';

  const stats: { label: string; value: number; icon: IconName; onPress: () => void }[] = [
    { label: 'Mis recetas', value: data.stats.my_recipes, icon: 'book', onPress: () => router.push('/(tabs)/profile') },
    { label: 'Favoritas', value: data.stats.favorites, icon: 'heart', onPress: () => router.push('/favorites') },
    { label: 'Seguidores', value: data.stats.followers, icon: 'people', onPress: () => router.push('/(tabs)/profile') },
  ];

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={styles.screen}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
    >
      <View style={styles.row}>
        <Avatar url={profile?.avatar_url} name={name} size={48} />
        <View style={{ flex: 1 }}>
          <T variant="h2">{greeting}{name ? `, ${name}` : ''} 👋</T>
          <T muted>¿Qué cocinamos hoy? Hay {data.stats.total_recipes} recetas en la comunidad.</T>
        </View>
      </View>

      {/* Resumen / estadísticas */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {stats.map((s) => (
          <Pressable key={s.label} onPress={s.onPress} style={({ pressed }) => ({
            flex: 1, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 16,
            padding: 12, gap: 4, opacity: pressed ? 0.8 : 1,
          })}>
            <Ionicons name={s.icon} size={18} color={colors.primary} />
            <T variant="h2">{s.value}</T>
            <T variant="small" muted>{s.label}</T>
          </Pressable>
        ))}
      </View>

      {/* Accesos rápidos */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <QuickAction icon="add-circle" label="Nueva receta" onPress={() => router.push('/recipe/new')} primary />
        <QuickAction icon="search" label="Buscar" onPress={() => router.push('/(tabs)/explore')} />
        <QuickAction icon="heart" label="Favoritas" onPress={() => router.push('/favorites')} />
      </View>

      <SectionHeader title="Categorías" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {data.categories.map((c) => (
          <Chip key={c.id} label={`${c.emoji ?? ''} ${c.name}`.trim()}
            onPress={() => router.push({ pathname: '/(tabs)/explore', params: { categoryId: String(c.id) } })} />
        ))}
      </ScrollView>

      {data.feed.length > 0 && (
        <>
          <SectionHeader title="De quienes seguís" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
            {data.feed.map((r) => <RecipeCard key={r.id} recipe={r} compact />)}
          </ScrollView>
        </>
      )}

      {data.top.length > 0 && (
        <>
          <SectionHeader title="Mejor valoradas ⭐" action="Ver más"
            onAction={() => router.push({ pathname: '/(tabs)/explore', params: { order: 'top' } })} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
            {data.top.map((r) => <RecipeCard key={r.id} recipe={r} compact />)}
          </ScrollView>
        </>
      )}

      <SectionHeader title="Recién publicadas" action="Ver todas" onAction={() => router.push('/(tabs)/explore')} />
      {data.latest.length === 0 ? (
        <Empty title="Todavía no hay recetas" subtitle="¡Sé la primera persona en compartir una!" />
      ) : (
        data.latest.map((r) => <RecipeCard key={r.id} recipe={r} />)
      )}
    </ScrollView>
  );
}

function QuickAction({ icon, label, onPress, primary }: { icon: IconName; label: string; onPress: () => void; primary?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({
      flex: 1, alignItems: 'center', gap: 6, paddingVertical: 14, borderRadius: 16,
      backgroundColor: primary ? colors.primary : colors.cardAlt, opacity: pressed ? 0.8 : 1,
    })}>
      <Ionicons name={icon} size={22} color={primary ? colors.onPrimary : colors.primary} />
      <T variant="small" style={{ color: primary ? colors.onPrimary : colors.text, fontWeight: '700' }}>{label}</T>
    </Pressable>
  );
}

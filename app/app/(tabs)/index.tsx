import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { ChallengeCard } from '../../components/ChallengeCard';
import { Avatar, Empty, ErrorView, IconName, Loading, SectionHeader, styles, T } from '../../components/ui';
import { getFeed, homeStats, listChallenges } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useTheme } from '../../lib/theme';
import { useLoader } from '../../lib/useLoader';

export default function Home() {
  const { colors } = useTheme();
  const { profile } = useAuth();
  const { data, error, loading, refreshing, refresh, retry } = useLoader(async () => {
    const [stats, feed, top, latest] = await Promise.all([
      homeStats(), getFeed(), listChallenges({ order: 'popular', limit: 8 }), listChallenges({ order: 'recent', limit: 5 }),
    ]);
    return { stats, feed, top, latest };
  }, []);

  if (loading) return <Loading />;
  if (error || !data) return <ErrorView message={error ?? 'Sin datos'} onRetry={retry} />;

  const name = profile?.full_name?.split(' ')[0] ?? profile?.username ?? '';
  const s = data.stats;
  const stats: { label: string; value: string; icon: IconName; onPress: () => void }[] = [
    { label: 'Récord', value: s.best_classic != null ? String(s.best_classic) : '—', icon: 'flash', onPress: () => router.push('/(tabs)/ranking') },
    { label: 'Puesto', value: s.classic_rank != null ? `#${s.classic_rank}` : '—', icon: 'trophy', onPress: () => router.push('/(tabs)/ranking') },
    { label: 'Partidas', value: String(s.games_played), icon: 'game-controller', onPress: () => router.push('/(tabs)/profile') },
  ];

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.screen}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}>
      <View style={styles.row}>
        <Avatar url={profile?.avatar_url} name={name} size={48} />
        <View style={{ flex: 1 }}>
          <T variant="h2">Operador/a {name} 📡</T>
          <T muted>La flota espera tus códigos. ¿Listo/a para transmitir?</T>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        {stats.map((st) => (
          <Pressable key={st.label} onPress={st.onPress} style={({ pressed }) => ({
            flex: 1, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 16,
            padding: 12, gap: 4, opacity: pressed ? 0.8 : 1,
          })}>
            <Ionicons name={st.icon} size={18} color={colors.primary} />
            <T variant="h2">{st.value}</T>
            <T variant="small" muted>{st.label}</T>
          </Pressable>
        ))}
      </View>

      <Pressable onPress={() => router.push({ pathname: '/game', params: { mode: 'classic' } })} style={({ pressed }) => ({
        backgroundColor: colors.primary, borderRadius: 20, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 14,
        opacity: pressed ? 0.85 : 1,
      })}>
        <Ionicons name="play-circle" size={48} color={colors.onPrimary} />
        <View style={{ flex: 1 }}>
          <T variant="h2" style={{ color: colors.onPrimary }}>Jugar modo clásico</T>
          <T style={{ color: colors.onPrimary, opacity: 0.85 }}>Rondas infinitas. ¿Hasta dónde llegás?</T>
        </View>
      </Pressable>

      <Pressable onPress={() => router.push({ pathname: '/game', params: { mode: 'daily' } })} style={({ pressed }) => ({
        backgroundColor: colors.card, borderColor: colors.primary, borderWidth: 2, borderRadius: 20, padding: 16,
        flexDirection: 'row', alignItems: 'center', gap: 14, opacity: pressed ? 0.85 : 1,
      })}>
        <Ionicons name="calendar" size={36} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <T variant="h3">Desafío diario</T>
          <T variant="small" muted>
            {s.daily_best != null ? `Tu mejor hoy: ${s.daily_best} (puesto #${s.daily_rank})` : 'La misma secuencia para todos. 10 rondas.'}
          </T>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.muted} />
      </Pressable>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <QuickAction icon="book" label="Códice" onPress={() => router.push('/codex')} />
        <QuickAction icon="add-circle" label="Crear desafío" onPress={() => router.push('/challenge/new')} />
        <QuickAction icon="heart" label="Favoritos" onPress={() => router.push('/favorites')} />
      </View>

      {data.feed.length > 0 && (
        <>
          <SectionHeader title="De quienes seguís" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
            {data.feed.map((c) => <ChallengeCard key={c.id} challenge={c} compact />)}
          </ScrollView>
        </>
      )}

      {data.top.length > 0 && (
        <>
          <SectionHeader title="Más jugados 🔥" action="Ver más" onAction={() => router.push({ pathname: '/(tabs)/challenges', params: { order: 'popular' } })} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
            {data.top.map((c) => <ChallengeCard key={c.id} challenge={c} compact />)}
          </ScrollView>
        </>
      )}

      <SectionHeader title="Desafíos nuevos" action="Ver todos" onAction={() => router.push('/(tabs)/challenges')} />
      {data.latest.length === 0
        ? <Empty title="Todavía no hay desafíos" subtitle="¡Creá el primero para la comunidad!" />
        : data.latest.map((c) => <ChallengeCard key={c.id} challenge={c} />)}
    </ScrollView>
  );
}

function QuickAction({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({
      flex: 1, alignItems: 'center', gap: 6, paddingVertical: 14, borderRadius: 16, backgroundColor: colors.cardAlt, opacity: pressed ? 0.8 : 1,
    })}>
      <Ionicons name={icon} size={22} color={colors.primary} />
      <T variant="small" style={{ fontWeight: '700' }}>{label}</T>
    </Pressable>
  );
}

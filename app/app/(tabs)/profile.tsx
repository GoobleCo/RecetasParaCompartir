import { router } from 'expo-router';
import { RefreshControl, ScrollView, View } from 'react-native';
import { ChallengeCard } from '../../components/ChallengeCard';
import { ProfileHeader } from '../../components/ProfileHeader';
import { Badge, Button, Card, Empty, ErrorView, Loading, SectionHeader, styles, T } from '../../components/ui';
import { followCounts, getMyChallenges, MODE_LABEL, myRuns, userBest } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useTheme } from '../../lib/theme';
import { useLoader } from '../../lib/useLoader';

export default function MyProfile() {
  const { colors } = useTheme();
  const { profile, isStaff, refreshProfile, profileError } = useAuth();
  const { data, error, loading, refreshing, refresh, retry } = useLoader(async () => {
    if (!profile) return null;
    const [challenges, counts, runs, best] = await Promise.all([
      getMyChallenges(), followCounts(profile.id), myRuns(10), userBest(profile.id),
    ]);
    return { challenges, counts, runs, best };
  }, [profile?.id]);

  if (!profile) return profileError ? <ErrorView message={profileError} onRetry={refreshProfile} /> : <Loading />;
  if (loading) return <Loading />;
  if (error || !data) return <ErrorView message={error ?? 'Sin datos'} onRetry={retry} />;

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.screen}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { refresh(); refreshProfile(); }} tintColor={colors.primary} />}>
      <ProfileHeader profile={profile} best={data.best} followers={data.counts.followers} following={data.counts.following} />

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button style={{ flex: 1 }} variant="secondary" icon="create-outline" title="Editar perfil" onPress={() => router.push('/settings/profile')} />
        <Button style={{ flex: 1 }} variant="secondary" icon="settings-outline" title="Configuración" onPress={() => router.push('/settings')} />
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button style={{ flex: 1 }} variant="secondary" icon="heart-outline" title="Favoritos" onPress={() => router.push('/favorites')} />
        {isStaff && <Button style={{ flex: 1 }} variant="secondary" icon="shield-checkmark-outline" title="Administración" onPress={() => router.push('/admin')} />}
      </View>

      <SectionHeader title="Últimas partidas" />
      {data.runs.length === 0 ? <T muted>Todavía no jugaste. ¡Probá el modo clásico!</T> : (
        <Card style={{ gap: 10 }}>
          {data.runs.map((r) => (
            <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Badge tone={r.status === 'rejected' ? 'danger' : 'muted'} label={MODE_LABEL[r.mode]} />
              <T variant="small" muted style={{ flex: 1 }}>
                {new Date(r.started_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                {r.status === 'finished' ? ` · ronda ${r.rounds_cleared ?? 0}${r.completed ? ' ✓' : ''}` : ' · rechazada'}
              </T>
              <T variant="h3" style={{ color: colors.primary }}>{r.score ?? '—'}</T>
            </View>
          ))}
        </Card>
      )}

      <SectionHeader title="Mis desafíos" action="+ Nuevo" onAction={() => router.push('/challenge/new')} />
      {data.challenges.length === 0 ? (
        <Empty icon="flag-outline" title="Todavía no creaste desafíos" subtitle="Armá uno y desafiá a la comunidad."
          action={<Button title="Crear desafío" icon="add" onPress={() => router.push('/challenge/new')} />} />
      ) : data.challenges.map((c) => <ChallengeCard key={c.id} challenge={c} />)}
    </ScrollView>
  );
}

import { router } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { LeaderList } from '../../components/LeaderList';
import { Button, Card, Chip, ErrorView, Loading, styles, T } from '../../components/ui';
import { boards, homeStats, leaderboard, myRank } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useTheme } from '../../lib/theme';
import { useLoader } from '../../lib/useLoader';

type Tab = 'all' | 'week' | 'daily';
const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'Histórico' }, { key: 'week', label: 'Esta semana' }, { key: 'daily', label: 'Diario de hoy' },
];

export default function Ranking() {
  const { colors } = useTheme();
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>('all');

  const { data, error, loading, refreshing, refresh, retry } = useLoader(async () => {
    const s = await homeStats(); // trae la semana y el día "de juego" del servidor
    const board = tab === 'all' ? boards.classic : tab === 'week' ? boards.week(s.week) : boards.daily(s.today);
    const [rows, me] = await Promise.all([leaderboard(board, 50), myRank(board)]);
    return { rows, me };
  }, [tab]);

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.screen}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {TABS.map((t) => <Chip key={t.key} label={t.label} active={tab === t.key} onPress={() => setTab(t.key)} />)}
      </View>
      {loading ? <Loading /> : error || !data ? <ErrorView message={error ?? 'Sin datos'} onRetry={retry} /> : (
        <>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <T muted>Tu posición</T>
              <T variant="h2">{data.me.rank != null ? `#${data.me.rank} de ${data.me.total}` : 'Sin puntaje todavía'}</T>
              {data.me.score != null && <T variant="small" muted>Mejor puntaje: {data.me.score}</T>}
            </View>
            <Button small icon="play" title="Jugar" onPress={() =>
              router.push({ pathname: '/game', params: { mode: tab === 'daily' ? 'daily' : 'classic' } })} />
          </Card>
          <T variant="small" muted>
            {tab === 'week' ? 'El lunes a la medianoche se premia al podio de la semana con una notificación.' :
              tab === 'daily' ? 'Todos juegan la misma secuencia. Se renueva a la medianoche.' :
                'Mejor puntaje de cada jugador en el modo clásico.'}
          </T>
          <LeaderList rows={data.rows} meId={profile?.id} />
        </>
      )}
    </ScrollView>
  );
}

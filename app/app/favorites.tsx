import { FlatList, RefreshControl } from 'react-native';
import { ChallengeCard } from '../components/ChallengeCard';
import { Empty, ErrorView, Loading } from '../components/ui';
import { getFavorites } from '../lib/api';
import { useTheme } from '../lib/theme';
import { useLoader } from '../lib/useLoader';

export default function Favorites() {
  const { colors } = useTheme();
  const { data, error, loading, refreshing, refresh, retry } = useLoader(getFavorites, []);
  if (loading) return <Loading />;
  if (error) return <ErrorView message={error} onRetry={retry} />;
  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      data={data ?? []}
      keyExtractor={(c) => c.id}
      contentContainerStyle={{ padding: 16, gap: 12 }}
      renderItem={({ item }) => <ChallengeCard challenge={item} />}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      ListEmptyComponent={<Empty icon="heart-outline" title="No tenés favoritos" subtitle="Tocá el corazón en un desafío para guardarlo acá." />}
    />
  );
}

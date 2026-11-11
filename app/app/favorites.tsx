import { FlatList, RefreshControl } from 'react-native';
import { RecipeCard } from '../components/RecipeCard';
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
      keyExtractor={(r) => r.id}
      contentContainerStyle={{ padding: 16, gap: 14 }}
      renderItem={({ item }) => <RecipeCard recipe={item} />}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      ListEmptyComponent={<Empty icon="heart-outline" title="No tenés favoritas" subtitle="Tocá el corazón en una receta para guardarla acá." />}
    />
  );
}

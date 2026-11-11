import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, TextInput, View } from 'react-native';
import { RecipeCard } from '../../components/RecipeCard';
import { Chip, Empty, ErrorView, Loading } from '../../components/ui';
import { Category, getCategories, listRecipes } from '../../lib/api';
import { useTheme } from '../../lib/theme';
import { useLoader } from '../../lib/useLoader';

export default function Explore() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ categoryId?: string; order?: string }>();
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(params.categoryId ? Number(params.categoryId) : null);
  const [order, setOrder] = useState<'recent' | 'top'>(params.order === 'top' ? 'top' : 'recent');
  const [categories, setCategories] = useState<Category[]>([]);

  // Si venimos desde Inicio con una categoría/orden, la aplicamos
  useEffect(() => {
    if (params.categoryId) setCategoryId(Number(params.categoryId));
    if (params.order === 'top') setOrder('top');
  }, [params.categoryId, params.order]);

  // Búsqueda con "debounce": espera a que el usuario deje de escribir
  useEffect(() => {
    const t = setTimeout(() => setQ(text), 350);
    return () => clearTimeout(t);
  }, [text]);

  useEffect(() => {
    getCategories().then(setCategories).catch(() => {});
  }, []);

  const { data, error, loading, refreshing, refresh, retry } = useLoader(
    () => listRecipes({ q, categoryId, order, limit: 50 }),
    [q, categoryId, order],
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: 16, paddingBottom: 8, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12 }}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput value={text} onChangeText={setText} placeholder="Buscar recetas…" placeholderTextColor={colors.muted}
            style={{ flex: 1, paddingVertical: 11, color: colors.text, fontSize: 15 }} returnKeyType="search" />
          {text ? <Ionicons name="close-circle" size={18} color={colors.muted} onPress={() => setText('')} /> : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <Chip label="Recientes" icon="time-outline" active={order === 'recent'} onPress={() => setOrder('recent')} />
          <Chip label="Mejor valoradas" icon="star-outline" active={order === 'top'} onPress={() => setOrder('top')} />
          <View style={{ width: 1, backgroundColor: colors.border, marginHorizontal: 2 }} />
          <Chip label="Todas" active={categoryId == null} onPress={() => setCategoryId(null)} />
          {categories.map((c) => (
            <Chip key={c.id} label={`${c.emoji ?? ''} ${c.name}`.trim()} active={categoryId === c.id}
              onPress={() => setCategoryId(categoryId === c.id ? null : c.id)} />
          ))}
        </ScrollView>
      </View>

      {loading ? <Loading /> : error ? <ErrorView message={error} onRetry={retry} /> : (
        <FlatList
          data={data ?? []}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 14 }}
          renderItem={({ item }) => <RecipeCard recipe={item} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
          ListEmptyComponent={<Empty icon="search-outline" title="No encontramos recetas" subtitle="Probá con otra búsqueda o categoría." />}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </View>
  );
}

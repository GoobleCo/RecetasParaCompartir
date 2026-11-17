import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, TextInput, View } from 'react-native';
import { ChallengeCard } from '../../components/ChallengeCard';
import { Button, Chip, Empty, ErrorView, Loading } from '../../components/ui';
import { listChallenges } from '../../lib/api';
import { useTheme } from '../../lib/theme';
import { useLoader } from '../../lib/useLoader';

type Order = 'recent' | 'top' | 'popular';

export default function Challenges() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ order?: string }>();
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [order, setOrder] = useState<Order>((params.order as Order) || 'recent');

  useEffect(() => {
    if (params.order === 'top' || params.order === 'popular' || params.order === 'recent') setOrder(params.order);
  }, [params.order]);

  // Búsqueda con "debounce": espera a que el usuario deje de escribir
  useEffect(() => {
    const t = setTimeout(() => setQ(text), 350);
    return () => clearTimeout(t);
  }, [text]);

  const { data, error, loading, refreshing, refresh, retry } = useLoader(() => listChallenges({ q, order, limit: 50 }), [q, order]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: 16, paddingBottom: 8, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12 }}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput value={text} onChangeText={setText} placeholder="Buscar desafíos…" placeholderTextColor={colors.muted}
            style={{ flex: 1, paddingVertical: 11, color: colors.text, fontSize: 15 }} returnKeyType="search" />
          {text ? <Ionicons name="close-circle" size={18} color={colors.muted} onPress={() => setText('')} /> : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <Chip label="Recientes" icon="time-outline" active={order === 'recent'} onPress={() => setOrder('recent')} />
          <Chip label="Más jugados" icon="flame-outline" active={order === 'popular'} onPress={() => setOrder('popular')} />
          <Chip label="Mejor valorados" icon="star-outline" active={order === 'top'} onPress={() => setOrder('top')} />
        </ScrollView>
      </View>

      {loading ? <Loading /> : error ? <ErrorView message={error} onRetry={retry} /> : (
        <FlatList
          data={data ?? []}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 12 }}
          renderItem={({ item }) => <ChallengeCard challenge={item} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
          ListHeaderComponent={<Button small icon="add" title="Crear desafío" onPress={() => router.push('/challenge/new')} />}
          ListEmptyComponent={<Empty icon="search-outline" title="No encontramos desafíos" subtitle="Probá con otra búsqueda o creá uno." />}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </View>
  );
}

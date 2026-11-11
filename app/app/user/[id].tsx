import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView } from 'react-native';
import { ProfileHeader } from '../../components/ProfileHeader';
import { RecipeCard } from '../../components/RecipeCard';
import { Button, Empty, ErrorView, Loading, SectionHeader, styles } from '../../components/ui';
import { followCounts, getProfile, isFollowing, listRecipes, setFollowing } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { friendlyError } from '../../lib/errors';
import { useTheme } from '../../lib/theme';
import { useLoader } from '../../lib/useLoader';

export default function UserProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const { profile: me } = useAuth();
  const [busy, setBusy] = useState(false);
  const isMe = me?.id === id;

  const { data, setData, error, loading, refreshing, refresh, retry } = useLoader(async () => {
    const [profile, recipes, counts, following] = await Promise.all([
      getProfile(id), listRecipes({ authorId: id, limit: 100 }), followCounts(id), isMe ? Promise.resolve(false) : isFollowing(id),
    ]);
    return { profile, recipes, counts, following };
  }, [id, isMe]);

  useEffect(() => {
    if (data) navigation.setOptions({ title: `@${data.profile.username}` });
  }, [data?.profile.username]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = async () => {
    if (!data) return;
    const next = !data.following;
    setBusy(true);
    try {
      await setFollowing(id, next);
      setData({
        ...data,
        following: next,
        counts: { ...data.counts, followers: data.counts.followers + (next ? 1 : -1) },
      });
    } catch (e) {
      Alert.alert('Error', friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Loading />;
  if (error || !data) return <ErrorView message={error ?? 'Usuario inexistente.'} onRetry={retry} />;

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={styles.screen}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
    >
      <ProfileHeader profile={data.profile} recipes={data.recipes.length} followers={data.counts.followers} following={data.counts.following} />
      {isMe ? (
        <Button variant="secondary" icon="create-outline" title="Editar mi perfil" onPress={() => router.push('/settings/profile')} />
      ) : (
        <Button variant={data.following ? 'secondary' : 'primary'} icon={data.following ? 'checkmark' : 'person-add'}
          title={data.following ? 'Siguiendo' : 'Seguir'} loading={busy} onPress={toggle} />
      )}
      <SectionHeader title="Recetas" />
      {data.recipes.length === 0
        ? <Empty title="Sin recetas públicas" subtitle="Este usuario todavía no compartió recetas." />
        : data.recipes.map((r) => <RecipeCard key={r.id} recipe={r} />)}
    </ScrollView>
  );
}

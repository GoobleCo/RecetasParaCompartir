import { router } from 'expo-router';
import { RefreshControl, ScrollView, View } from 'react-native';
import { ProfileHeader } from '../../components/ProfileHeader';
import { RecipeCard } from '../../components/RecipeCard';
import { Button, Empty, ErrorView, Loading, SectionHeader, styles } from '../../components/ui';
import { followCounts, getMyRecipes } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useTheme } from '../../lib/theme';
import { useLoader } from '../../lib/useLoader';

export default function MyProfile() {
  const { colors } = useTheme();
  const { profile, isStaff, refreshProfile, profileError } = useAuth();
  const { data, error, loading, refreshing, refresh, retry } = useLoader(async () => {
    if (!profile) return null;
    const [recipes, counts] = await Promise.all([getMyRecipes(), followCounts(profile.id)]);
    return { recipes, counts };
  }, [profile?.id]);

  if (!profile) {
    return profileError ? <ErrorView message={profileError} onRetry={refreshProfile} /> : <Loading />;
  }
  if (loading) return <Loading />;
  if (error || !data) return <ErrorView message={error ?? 'Sin datos'} onRetry={retry} />;

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={styles.screen}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { refresh(); refreshProfile(); }} tintColor={colors.primary} />}
    >
      <ProfileHeader profile={profile} recipes={data.recipes.length} followers={data.counts.followers} following={data.counts.following} />

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button style={{ flex: 1 }} variant="secondary" icon="create-outline" title="Editar perfil" onPress={() => router.push('/settings/profile')} />
        <Button style={{ flex: 1 }} variant="secondary" icon="settings-outline" title="Configuración" onPress={() => router.push('/settings')} />
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button style={{ flex: 1 }} variant="secondary" icon="heart-outline" title="Favoritas" onPress={() => router.push('/favorites')} />
        {isStaff && (
          <Button style={{ flex: 1 }} variant="secondary" icon="shield-checkmark-outline" title="Administración" onPress={() => router.push('/admin')} />
        )}
      </View>

      <SectionHeader title="Mis recetas" action="+ Nueva" onAction={() => router.push('/recipe/new')} />
      {data.recipes.length === 0 ? (
        <Empty title="Todavía no publicaste recetas" subtitle="Compartí tu primera receta con la comunidad."
          action={<Button title="Crear receta" icon="add" onPress={() => router.push('/recipe/new')} />} />
      ) : (
        data.recipes.map((r) => <RecipeCard key={r.id} recipe={r} />)
      )}
    </ScrollView>
  );
}

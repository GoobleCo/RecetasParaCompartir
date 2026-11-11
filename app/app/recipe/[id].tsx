import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, Share, View } from 'react-native';
import { Avatar, Badge, Button, Card, ErrorView, Field, IconButton, IconName, Loading, SectionHeader, Stars, T } from '../../components/ui';
import {
  addComment, Comment, deleteComment, deleteRecipe, DIFFICULTY_LABEL, getComments, getMyRating, getRecipe,
  isFavorite, setFavorite, setMyRating,
} from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { friendlyError } from '../../lib/errors';
import { useTheme } from '../../lib/theme';
import { imageUrl } from '../../lib/upload';
import { useLoader } from '../../lib/useLoader';

export default function RecipeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const { profile, isStaff } = useAuth();
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [comment, setComment] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data, setData, error, loading, refreshing, refresh, retry } = useLoader(async () => {
    const [recipe, comments, myRating, fav] = await Promise.all([
      getRecipe(id), getComments(id), getMyRating(id), isFavorite(id),
    ]);
    return { recipe, comments, myRating, fav };
  }, [id]);

  const recipe = data?.recipe;
  const isOwner = !!recipe && recipe.author_id === profile?.id;
  const canEdit = isOwner || isStaff;

  const share = async () => {
    if (!recipe) return;
    const text = [
      `🍳 ${recipe.title}`,
      recipe.description ?? '',
      '',
      'Ingredientes:',
      ...recipe.ingredients.map((i) => `• ${i}`),
      '',
      'Preparación:',
      ...recipe.steps.map((s, n) => `${n + 1}. ${s}`),
      '',
      `Compartido desde Sazón por @${recipe.author?.username ?? ''}`,
    ].join('\n');
    try { await Share.share({ message: text, title: recipe.title }); } catch { /* cancelado */ }
  };

  const toggleFav = async () => {
    if (!data) return;
    const next = !data.fav;
    setData({ ...data, fav: next }); // respuesta optimista
    try {
      await setFavorite(id, next);
    } catch (e) {
      setData({ ...data, fav: !next });
      Alert.alert('Error', friendlyError(e));
    }
  };

  useEffect(() => {
    navigation.setOptions({
      title: recipe?.title ?? 'Receta',
      headerRight: () => recipe ? (
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <IconButton label="Compartir" icon="share-social-outline" onPress={share} />
          <IconButton label={data?.fav ? 'Quitar de favoritas' : 'Agregar a favoritas'} icon={data?.fav ? 'heart' : 'heart-outline'}
            color={data?.fav ? colors.danger : colors.text} onPress={toggleFav} />
        </View>
      ) : null,
    });
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const rate = async (stars: number) => {
    if (!data) return;
    const prev = data.myRating;
    setData({ ...data, myRating: stars });
    try {
      await setMyRating(id, stars);
      refresh();
    } catch (e) {
      setData({ ...data, myRating: prev });
      Alert.alert('No se pudo valorar', friendlyError(e));
    }
  };

  const send = async () => {
    const body = comment.trim();
    if (!body) return setCommentError('Escribí un comentario.');
    if (body.length > 500) return setCommentError('Máximo 500 caracteres.');
    setCommentError(null);
    setSending(true);
    try {
      await addComment(id, body);
      setComment('');
      const comments = await getComments(id);
      setData((d) => (d ? { ...d, comments, recipe: { ...d.recipe, comment_count: comments.length } } : d));
    } catch (e) {
      Alert.alert('No se pudo comentar', friendlyError(e));
    } finally {
      setSending(false);
    }
  };

  const removeComment = (c: Comment) =>
    Alert.alert('Eliminar comentario', '¿Seguro que querés eliminarlo?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        try {
          await deleteComment(c.id);
          setData((d) => (d ? { ...d, comments: d.comments.filter((x) => x.id !== c.id) } : d));
        } catch (e) { Alert.alert('Error', friendlyError(e)); }
      } },
    ]);

  const remove = () => {
    if (!recipe) return;
    Alert.alert('Eliminar receta', `¿Eliminar "${recipe.title}"? Esta acción no se puede deshacer.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        setBusy(true);
        try {
          await deleteRecipe(recipe);
          router.back();
        } catch (e) {
          Alert.alert('No se pudo eliminar', friendlyError(e));
        } finally { setBusy(false); }
      } },
    ]);
  };

  if (loading) return <Loading />;
  if (error || !data || !recipe) return <ErrorView message={error ?? 'La receta no existe.'} onRetry={retry} />;

  const uri = imageUrl('recipe-images', recipe.image_path);
  const canDeleteComment = (c: Comment) => c.user_id === profile?.id || isOwner || isStaff;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        {uri ? (
          <Image source={{ uri }} style={{ width: '100%', height: 260, backgroundColor: colors.cardAlt }} />
        ) : (
          <View style={{ height: 160, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
            <T style={{ fontSize: 64 }}>{recipe.category?.emoji ?? '🍽️'}</T>
          </View>
        )}

        <View style={{ padding: 16, gap: 14 }}>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {recipe.category && <Badge label={`${recipe.category.emoji ?? ''} ${recipe.category.name}`.trim()} />}
            <Badge tone="muted" label={DIFFICULTY_LABEL[recipe.difficulty]} />
            {!recipe.is_public && <Badge tone="danger" label="Privada" />}
          </View>
          <T variant="title">{recipe.title}</T>

          <Pressable onPress={() => recipe.author && router.push(`/user/${recipe.author.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Avatar url={recipe.author?.avatar_url} name={recipe.author?.full_name ?? recipe.author?.username} size={36} />
            <View>
              <T variant="label">{recipe.author?.full_name || recipe.author?.username}</T>
              <T variant="small" muted>@{recipe.author?.username} · {new Date(recipe.created_at).toLocaleDateString('es-AR')}</T>
            </View>
          </Pressable>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Meta icon="time-outline" label={recipe.prep_minutes ? `${recipe.prep_minutes} min` : '—'} />
            <Meta icon="people-outline" label={recipe.servings ? `${recipe.servings} porc.` : '—'} />
            <Meta icon="star" label={`${Number(recipe.avg_rating).toFixed(1)} (${recipe.rating_count})`} />
            <Meta icon="heart-outline" label={String(recipe.favorite_count)} />
          </View>

          {recipe.description ? <T>{recipe.description}</T> : null}

          {canEdit && (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button style={{ flex: 1 }} small variant="secondary" icon="create-outline" title="Editar"
                onPress={() => router.push(`/recipe/edit/${recipe.id}`)} />
              <Button style={{ flex: 1 }} small variant="danger" icon="trash-outline" title="Eliminar" loading={busy} onPress={remove} />
            </View>
          )}
          {canEdit && !isOwner && <T variant="small" muted>Estás viendo esta receta con permisos de moderación.</T>}

          <SectionHeader title={`Ingredientes (${recipe.ingredients.length})`} />
          <Card style={{ gap: 10 }}>
            {recipe.ingredients.map((ing, i) => (
              <Pressable key={i} onPress={() => setChecked({ ...checked, [i]: !checked[i] })} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <Ionicons name={checked[i] ? 'checkbox' : 'square-outline'} size={20} color={colors.primary} />
                <T style={{ flex: 1, textDecorationLine: checked[i] ? 'line-through' : 'none', opacity: checked[i] ? 0.5 : 1 }}>{ing}</T>
              </Pressable>
            ))}
          </Card>

          <SectionHeader title="Preparación" />
          {recipe.steps.map((s, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                <T style={{ color: colors.onPrimary, fontWeight: '800' }}>{i + 1}</T>
              </View>
              <T style={{ flex: 1, paddingTop: 3 }}>{s}</T>
            </View>
          ))}

          {!isOwner && (
            <Card style={{ alignItems: 'center', gap: 8 }}>
              <T variant="h3">{data.myRating ? 'Tu valoración' : '¿La probaste? Valorala'}</T>
              <Stars value={data.myRating ?? 0} size={32} onChange={rate} />
            </Card>
          )}

          <SectionHeader title={`Comentarios (${data.comments.length})`} />
          {data.comments.length === 0 && <T muted>Todavía no hay comentarios. ¡Dejá el primero!</T>}
          {data.comments.map((c) => (
            <View key={c.id} style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable onPress={() => c.user && router.push(`/user/${c.user.id}`)}>
                <Avatar url={c.user?.avatar_url} name={c.user?.full_name ?? c.user?.username} size={34} />
              </Pressable>
              <View style={{ flex: 1, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: 10, gap: 2 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <T variant="label">@{c.user?.username ?? 'usuario'}</T>
                  {canDeleteComment(c) && (
                    <IconButton label="Eliminar comentario" icon="trash-outline" size={16} color={colors.muted} onPress={() => removeComment(c)} />
                  )}
                </View>
                <T>{c.body}</T>
                <T variant="small" muted>{new Date(c.created_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</T>
              </View>
            </View>
          ))}

          <Field placeholder="Escribí un comentario…" value={comment} onChangeText={setComment} error={commentError}
            multiline maxLength={500} />
          <Button title="Comentar" icon="send" onPress={send} loading={sending} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Meta({ icon, label }: { icon: IconName; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 4, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.cardAlt }}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <T variant="small" style={{ fontWeight: '600' }}>{label}</T>
    </View>
  );
}

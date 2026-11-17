import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, Share, View } from 'react-native';
import { CodeView } from '../../components/Arrows';
import { LeaderList } from '../../components/LeaderList';
import { Avatar, Badge, Button, Card, ErrorView, Field, IconButton, Loading, SectionHeader, Stars, T } from '../../components/ui';
import {
  addComment, boards, Comment, deleteChallenge, deleteComment, getChallenge, getComments, getMyRating, getProtocols,
  isFavorite, leaderboard, myRank, setFavorite, setMyRating,
} from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { friendlyError } from '../../lib/errors';
import { CATEGORY_COLOR, codeToArrows, estimateDifficulty } from '../../lib/game';
import { useTheme } from '../../lib/theme';
import { useLoader } from '../../lib/useLoader';

export default function ChallengeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const { profile, isStaff } = useAuth();
  const [comment, setComment] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data, setData, error, loading, refreshing, refresh, retry } = useLoader(async () => {
    const [challenge, comments, myRating, fav, protocols, top, rank] = await Promise.all([
      getChallenge(id), getComments(id), getMyRating(id), isFavorite(id), getProtocols(true),
      leaderboard(boards.challenge(id), 10), myRank(boards.challenge(id)),
    ]);
    const used = protocols.filter((p) => challenge.protocol_ids.includes(p.id));
    return { challenge, comments, myRating, fav, used, top, rank };
  }, [id]);

  const ch = data?.challenge;
  const isOwner = !!ch && ch.author_id === profile?.id;
  const canEdit = isOwner || isStaff;

  const share = async () => {
    if (!ch || !data) return;
    const text = [
      `🎯 Desafío «${ch.title}» en Código Ω`,
      ch.description ?? '',
      `${ch.rounds} rondas · ${ch.round_time_s} s por ronda`,
      data.rank.score != null ? `Mi récord: ${data.rank.score} puntos. ¿Me superás?` : '¿Te animás?',
      '',
      ...data.used.slice(0, 6).map((p) => `${p.icon ?? '•'} ${p.name}: ${codeToArrows(p.code)}`),
    ].join('\n');
    try { await Share.share({ message: text, title: ch.title }); } catch { /* cancelado */ }
  };

  const toggleFav = async () => {
    if (!data) return;
    const next = !data.fav;
    setData({ ...data, fav: next });
    try { await setFavorite(id, next); } catch (e) {
      setData({ ...data, fav: !next });
      Alert.alert('Error', friendlyError(e));
    }
  };

  useEffect(() => {
    navigation.setOptions({
      title: ch?.title ?? 'Desafío',
      headerRight: () => ch ? (
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <IconButton label="Compartir" icon="share-social-outline" onPress={share} />
          <IconButton label={data?.fav ? 'Quitar de favoritos' : 'Agregar a favoritos'} icon={data?.fav ? 'heart' : 'heart-outline'}
            color={data?.fav ? colors.danger : colors.text} onPress={toggleFav} />
        </View>
      ) : null,
    });
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const rate = async (stars: number) => {
    if (!data) return;
    const prev = data.myRating;
    setData({ ...data, myRating: stars });
    try { await setMyRating(id, stars); refresh(); } catch (e) {
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
      setData((d) => (d ? { ...d, comments } : d));
    } catch (e) {
      Alert.alert('No se pudo comentar', friendlyError(e));
    } finally { setSending(false); }
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
    if (!ch) return;
    Alert.alert('Eliminar desafío', `¿Eliminar «${ch.title}»? Se pierden también su ranking y comentarios.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        setBusy(true);
        try { await deleteChallenge(ch.id); router.back(); }
        catch (e) { Alert.alert('No se pudo eliminar', friendlyError(e)); }
        finally { setBusy(false); }
      } },
    ]);
  };

  if (loading) return <Loading />;
  if (error || !data || !ch) return <ErrorView message={error ?? 'El desafío no existe.'} onRetry={retry} />;

  const canDeleteComment = (c: Comment) => c.user_id === profile?.id || isOwner || isStaff;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          <Badge label={estimateDifficulty(data.used, ch.round_time_s, ch.rounds)} />
          <Badge tone="muted" label={`${ch.rounds} rondas`} />
          <Badge tone="muted" label={`${ch.round_time_s} s / ronda`} />
          {!ch.is_public && <Badge tone="danger" label="Privado" />}
        </View>
        <T variant="title">{ch.title}</T>

        <Pressable onPress={() => ch.author && router.push(`/user/${ch.author.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Avatar url={ch.author?.avatar_url} name={ch.author?.full_name ?? ch.author?.username} size={36} />
          <View>
            <T variant="label">{ch.author?.full_name || ch.author?.username}</T>
            <T variant="small" muted>@{ch.author?.username} · {new Date(ch.created_at).toLocaleDateString('es-AR')}</T>
          </View>
        </Pressable>

        {ch.description ? <T>{ch.description}</T> : null}

        <Card style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
          <Stat label="Partidas" value={String(ch.play_count)} />
          <Stat label="Valoración" value={`${Number(ch.avg_rating).toFixed(1)} ★`} />
          <Stat label="Tu récord" value={data.rank.score != null ? String(data.rank.score) : '—'} />
          <Stat label="Tu puesto" value={data.rank.rank != null ? `#${data.rank.rank}` : '—'} />
        </Card>

        <Button title="Jugar desafío" icon="play" onPress={() => router.push({ pathname: '/game', params: { mode: 'challenge', challengeId: ch.id } })} />

        {canEdit && (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button style={{ flex: 1 }} small variant="secondary" icon="create-outline" title="Editar" onPress={() => router.push(`/challenge/edit/${ch.id}`)} />
            <Button style={{ flex: 1 }} small variant="danger" icon="trash-outline" title="Eliminar" loading={busy} onPress={remove} />
          </View>
        )}
        {canEdit && !isOwner && <T variant="small" muted>Estás viendo este desafío con permisos de moderación.</T>}

        <SectionHeader title="Ranking del desafío 🏆" />
        <LeaderList rows={data.top} meId={profile?.id} empty="Nadie lo jugó todavía. ¡Sé el primero!" />

        <SectionHeader title={`Protocolos (${data.used.length})`} />
        {data.used.map((p) => (
          <Card key={p.id} style={{ gap: 8, borderLeftWidth: 4, borderLeftColor: CATEGORY_COLOR[p.category] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <T style={{ fontSize: 20 }}>{p.icon ?? '•'}</T>
              <T variant="h3" style={{ flex: 1 }}>{p.name}</T>
            </View>
            <CodeView code={p.code} size={16} gap={4} />
          </Card>
        ))}

        {!isOwner && (
          <Card style={{ alignItems: 'center', gap: 8 }}>
            <T variant="h3">{data.myRating ? 'Tu valoración' : '¿Lo jugaste? Valoralo'}</T>
            <Stars value={data.myRating ?? 0} size={32} onChange={rate} />
          </Card>
        )}

        <SectionHeader title={`Comentarios (${data.comments.length})`} />
        {data.comments.length === 0 && <T muted>Todavía no hay comentarios.</T>}
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
        <Field placeholder="Escribí un comentario…" value={comment} onChangeText={setComment} error={commentError} multiline maxLength={500} />
        <Button title="Comentar" icon="send" onPress={send} loading={sending} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 2 }}>
      <T variant="h3">{value}</T>
      <T variant="small" muted>{label}</T>
    </View>
  );
}

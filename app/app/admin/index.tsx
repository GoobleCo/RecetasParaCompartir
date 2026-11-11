import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, TextInput, View } from 'react-native';
import { Avatar, Badge, Button, Card, Chip, Empty, ErrorView, Field, IconButton, Loading, styles, T } from '../../components/ui';
import {
  Category, createCategory, deleteCategory, deleteComment, getCategories, listUsers, recentComments,
  Role, ROLE_LABEL, setUserRole, updateCategory,
} from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { friendlyError } from '../../lib/errors';
import { useTheme } from '../../lib/theme';
import { useLoader } from '../../lib/useLoader';

type Tab = 'users' | 'categories' | 'moderation';

/**
 * Panel de administración.
 *  - Administrador: usuarios/roles, categorías (ABM) y moderación.
 *  - Moderador: sólo moderación de comentarios.
 * Ocultar pestañas es sólo visual: cada operación vuelve a validarse en el backend.
 */
export default function Admin() {
  const { colors } = useTheme();
  const { isAdmin, isStaff } = useAuth();
  const [tab, setTab] = useState<Tab>(isAdmin ? 'users' : 'moderation');

  if (!isStaff) return <ErrorView message="Esta sección es sólo para administradores y moderadores." />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flexDirection: 'row', gap: 8, padding: 16, paddingBottom: 4 }}>
        {isAdmin && <Chip label="Usuarios" icon="people-outline" active={tab === 'users'} onPress={() => setTab('users')} />}
        {isAdmin && <Chip label="Categorías" icon="pricetags-outline" active={tab === 'categories'} onPress={() => setTab('categories')} />}
        <Chip label="Moderación" icon="shield-outline" active={tab === 'moderation'} onPress={() => setTab('moderation')} />
      </View>
      {tab === 'users' && <Users />}
      {tab === 'categories' && <Categories />}
      {tab === 'moderation' && <Moderation />}
    </View>
  );
}

function Users() {
  const { colors } = useTheme();
  const { profile: me } = useAuth();
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => { const t = setTimeout(() => setQ(text), 350); return () => clearTimeout(t); }, [text]);
  const { data, setData, error, loading, refreshing, refresh, retry } = useLoader(() => listUsers(q), [q]);

  const change = (userId: string, username: string, role: Role) =>
    Alert.alert('Cambiar rol', `¿Hacer a @${username} ${ROLE_LABEL[role].toLowerCase()}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Confirmar', onPress: async () => {
        try {
          await setUserRole(userId, role);
          setData((d) => d?.map((u) => (u.id === userId ? { ...u, role } : u)) ?? d);
        } catch (e) { Alert.alert('No se pudo cambiar el rol', friendlyError(e)); }
      } },
    ]);

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}>
      <TextInput value={text} onChangeText={setText} placeholder="Buscar por usuario o nombre…" placeholderTextColor={colors.muted}
        style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 11, color: colors.text }} />
      {loading ? <Loading /> : error ? <ErrorView message={error} onRetry={retry} /> : (data ?? []).map((u) => (
        <Card key={u.id} style={{ gap: 10 }}>
          <View style={styles.row}>
            <Avatar url={u.avatar_url} name={u.full_name ?? u.username} />
            <View style={{ flex: 1 }}>
              <T variant="h3" numberOfLines={1}>{u.full_name || u.username}</T>
              <T variant="small" muted>@{u.username}</T>
            </View>
            <Badge label={ROLE_LABEL[u.role]} tone={u.role === 'user' ? 'muted' : 'primary'} />
          </View>
          {u.id === me?.id ? (
            <T variant="small" muted>No podés cambiar tu propio rol.</T>
          ) : (
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              {(['user', 'moderator', 'admin'] as Role[]).map((r) => (
                <Chip key={r} label={ROLE_LABEL[r]} active={u.role === r} onPress={u.role === r ? undefined : () => change(u.id, u.username, r)} />
              ))}
              <Chip label="Ver perfil" icon="open-outline" onPress={() => router.push(`/user/${u.id}`)} />
            </View>
          )}
        </Card>
      ))}
    </ScrollView>
  );
}

function Categories() {
  const { colors } = useTheme();
  const { data, error, loading, refreshing, refresh, retry } = useLoader(getCategories, []);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => { setEditing(null); setName(''); setEmoji(''); setNameError(null); };

  const save = async () => {
    const n = name.trim();
    if (n.length < 2 || n.length > 40) return setNameError('Entre 2 y 40 caracteres.');
    setSaving(true);
    try {
      if (editing) await updateCategory(editing.id, n, emoji);
      else await createCategory(n, emoji);
      reset();
      refresh();
    } catch (e) {
      Alert.alert('No se pudo guardar', friendlyError(e));
    } finally { setSaving(false); }
  };

  const remove = (c: Category) =>
    Alert.alert('Eliminar categoría', `¿Eliminar "${c.name}"? Las recetas quedarán sin categoría.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        try { await deleteCategory(c.id); refresh(); } catch (e) { Alert.alert('Error', friendlyError(e)); }
      } },
    ]);

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}>
      <Card style={{ gap: 10 }}>
        <T variant="h3">{editing ? `Editar "${editing.name}"` : 'Nueva categoría'}</T>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Field style={{ width: 80 }} label="Emoji" value={emoji} onChangeText={setEmoji} maxLength={4} placeholder="🍕" />
          <Field style={{ flex: 1 }} label="Nombre" value={name} onChangeText={setName} error={nameError} maxLength={40} placeholder="Pizzas" />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button style={{ flex: 1 }} small title={editing ? 'Guardar' : 'Agregar'} icon="checkmark" onPress={save} loading={saving} />
          {editing && <Button small variant="secondary" title="Cancelar" onPress={reset} />}
        </View>
      </Card>
      {loading ? <Loading /> : error ? <ErrorView message={error} onRetry={retry} /> : (data ?? []).map((c) => (
        <Card key={c.id} style={styles.row}>
          <T style={{ fontSize: 22 }}>{c.emoji ?? '•'}</T>
          <T variant="h3" style={{ flex: 1 }}>{c.name}</T>
          <IconButton label="Editar" icon="create-outline" onPress={() => { setEditing(c); setName(c.name); setEmoji(c.emoji ?? ''); }} />
          <IconButton label="Eliminar" icon="trash-outline" color={colors.danger} onPress={() => remove(c)} />
        </Card>
      ))}
    </ScrollView>
  );
}

function Moderation() {
  const { colors } = useTheme();
  const { data, setData, error, loading, refreshing, refresh, retry } = useLoader(() => recentComments(50), []);

  const remove = (id: string) =>
    Alert.alert('Eliminar comentario', '¿Eliminar este comentario por moderación?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        try {
          await deleteComment(id);
          setData((d) => d?.filter((c) => c.id !== id) ?? d);
        } catch (e) { Alert.alert('Error', friendlyError(e)); }
      } },
    ]);

  if (loading) return <Loading />;
  if (error) return <ErrorView message={error} onRetry={retry} />;
  return (
    <ScrollView contentContainerStyle={styles.screen}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}>
      <T muted>Últimos comentarios de toda la comunidad. Podés eliminar los que no respeten las normas.</T>
      {(data ?? []).length === 0 && <Empty icon="chatbubbles-outline" title="No hay comentarios" />}
      {(data ?? []).map((c) => (
        <Card key={c.id} style={{ gap: 6 }}>
          <View style={styles.row}>
            <Avatar url={c.user?.avatar_url} name={c.user?.username} size={30} />
            <T variant="label" style={{ flex: 1 }}>@{c.user?.username}</T>
            <IconButton label="Eliminar" icon="trash-outline" color={colors.danger} onPress={() => remove(c.id)} />
          </View>
          <T>{c.body}</T>
          {c.recipe && (
            <T variant="small" style={{ color: colors.primary }} >
              <T variant="small" muted>en </T>
              <T variant="small" style={{ color: colors.primary, fontWeight: '700' }}>{c.recipe.title}</T>
            </T>
          )}
          {c.recipe && <Button small variant="ghost" title="Ver receta" onPress={() => router.push(`/recipe/${c.recipe!.id}`)} />}
        </Card>
      ))}
    </ScrollView>
  );
}

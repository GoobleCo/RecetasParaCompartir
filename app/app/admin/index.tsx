import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, TextInput, View } from 'react-native';
import { ArrowKey, CodeView } from '../../components/Arrows';
import { Avatar, Badge, Button, Card, Chip, Empty, ErrorView, Field, IconButton, Loading, styles, T } from '../../components/ui';
import {
  createProtocol, deleteComment, deleteProtocol, getProtocols, listUsers, ProtocolRow, recentComments,
  Role, ROLE_LABEL, setUserRole, updateProtocol,
} from '../../lib/api';
import { CATEGORY_COLOR, CATEGORY_LABEL, Dir, DIRS, ProtocolCategory } from '../../lib/game';
import { useAuth } from '../../lib/auth';
import { friendlyError } from '../../lib/errors';
import { useTheme } from '../../lib/theme';
import { useLoader } from '../../lib/useLoader';

type Tab = 'users' | 'protocols' | 'moderation';

/**
 * Panel de administración.
 *  - Administrador: usuarios/roles, catálogo de protocolos (ABM) y moderación.
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
        {isAdmin && <Chip label="Protocolos" icon="grid-outline" active={tab === 'protocols'} onPress={() => setTab('protocols')} />}
        <Chip label="Moderación" icon="shield-outline" active={tab === 'moderation'} onPress={() => setTab('moderation')} />
      </View>
      {tab === 'users' && <Users />}
      {tab === 'protocols' && <Protocols />}
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

const EMPTY = { name: '', icon: '', code: '', category: 'ofensivo' as ProtocolCategory, active: true };

function Protocols() {
  const { colors } = useTheme();
  const { data, error, loading, refreshing, refresh, retry } = useLoader(() => getProtocols(true), []);
  const [editing, setEditing] = useState<ProtocolRow | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [saving, setSaving] = useState(false);

  const reset = () => { setEditing(null); setForm(EMPTY); setErrors({}); };
  const edit = (p: ProtocolRow) => {
    setEditing(p);
    setForm({ name: p.name, icon: p.icon ?? '', code: p.code, category: p.category, active: p.active });
    setErrors({});
  };

  const save = async () => {
    const n = form.name.trim();
    const e = {
      name: n.length < 2 || n.length > 40 ? 'Entre 2 y 40 caracteres.' : null,
      code: form.code.length < 3 || form.code.length > 8 ? 'El código debe tener entre 3 y 8 flechas.' : null,
    };
    setErrors(e);
    if (e.name || e.code) return;
    setSaving(true);
    try {
      if (editing) await updateProtocol(editing.id, form);
      else await createProtocol(form);
      reset();
      refresh();
    } catch (err) {
      Alert.alert('No se pudo guardar', friendlyError(err));
    } finally { setSaving(false); }
  };

  const remove = (p: ProtocolRow) =>
    Alert.alert('Eliminar protocolo', `¿Eliminar "${p.name}"? Se quita también de los desafíos que lo usan.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        try { await deleteProtocol(p.id); refresh(); } catch (err) { Alert.alert('No se pudo eliminar', friendlyError(err)); }
      } },
    ]);

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}>
      <Card style={{ gap: 10 }}>
        <T variant="h3">{editing ? `Editar "${editing.name}"` : 'Nuevo protocolo'}</T>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Field style={{ width: 80 }} label="Ícono" value={form.icon} onChangeText={(icon) => setForm({ ...form, icon })} maxLength={4} placeholder="🛰️" />
          <Field style={{ flex: 1 }} label="Nombre" value={form.name} onChangeText={(name) => setForm({ ...form, name })}
            error={errors.name} maxLength={40} placeholder="Escudo iónico" />
        </View>
        <T variant="label">Categoría</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {(Object.keys(CATEGORY_LABEL) as ProtocolCategory[]).map((c) => (
            <Chip key={c} label={CATEGORY_LABEL[c]} active={form.category === c} onPress={() => setForm({ ...form, category: c })} />
          ))}
        </View>
        <T variant="label">Código ({form.code.length}/8)</T>
        <View style={{ minHeight: 44, justifyContent: 'center' }}>
          {form.code ? <CodeView code={form.code} size={18} gap={4} /> : <T muted>Tocá las flechas para armar el código</T>}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {DIRS.map((d) => (
            <Pressable key={d} accessibilityLabel={`Agregar flecha ${d}`} onPress={() => form.code.length < 8 && setForm({ ...form, code: form.code + d })}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
              <ArrowKey dir={d} state="next" size={22} />
            </Pressable>
          ))}
          <Button small variant="ghost" title="Borrar" icon="backspace-outline" onPress={() => setForm({ ...form, code: form.code.slice(0, -1) })} />
        </View>
        {errors.code && <T variant="small" style={{ color: colors.danger }}>{errors.code}</T>}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Chip label={form.active ? 'Activo' : 'Inactivo'} icon={form.active ? 'eye-outline' : 'eye-off-outline'} active={form.active}
            onPress={() => setForm({ ...form, active: !form.active })} />
          <T variant="small" muted style={{ flex: 1 }}>Los inactivos no aparecen en el modo clásico ni en el diario.</T>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button style={{ flex: 1 }} small title={editing ? 'Guardar' : 'Agregar'} icon="checkmark" onPress={save} loading={saving} />
          {editing && <Button small variant="secondary" title="Cancelar" onPress={reset} />}
        </View>
      </Card>
      {loading ? <Loading /> : error ? <ErrorView message={error} onRetry={retry} /> : (data ?? []).map((p) => (
        <Card key={p.id} style={{ gap: 6, borderLeftWidth: 4, borderLeftColor: CATEGORY_COLOR[p.category], opacity: p.active ? 1 : 0.6 }}>
          <View style={styles.row}>
            <T style={{ fontSize: 22 }}>{p.icon ?? '•'}</T>
            <View style={{ flex: 1 }}>
              <T variant="h3">{p.name}</T>
              <T variant="small" muted>{CATEGORY_LABEL[p.category]}{p.active ? '' : ' · inactivo'}</T>
            </View>
            <IconButton label="Editar" icon="create-outline" onPress={() => edit(p)} />
            <IconButton label="Eliminar" icon="trash-outline" color={colors.danger} onPress={() => remove(p)} />
          </View>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {p.code.split('').map((c, i) => <ArrowKey key={i} dir={c as Dir} size={14} />)}
          </View>
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
          {c.challenge && <T variant="small" muted>en «{c.challenge.title}»</T>}
          {c.challenge && <Button small variant="ghost" title="Ver desafío" onPress={() => router.push(`/challenge/${c.challenge!.id}`)} />}
        </Card>
      ))}
    </ScrollView>
  );
}

import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, Switch, View } from 'react-native';
import { Button, Card, Chip, SectionHeader, styles, T } from '../../components/ui';
import { deleteMyAccount, Profile, ROLE_LABEL, updateMyProfile } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { friendlyError } from '../../lib/errors';
import { registerForPush, sendTestNotification } from '../../lib/notifications';
import { ThemeMode, useTheme } from '../../lib/theme';

type NotifKey = 'notify_comments' | 'notify_ratings' | 'notify_follows' | 'notify_new_recipes' | 'notify_daily';
const NOTIF_OPTIONS: { key: NotifKey; label: string; hint: string }[] = [
  { key: 'notify_comments', label: 'Comentarios', hint: 'Cuando comentan tus recetas' },
  { key: 'notify_ratings', label: 'Valoraciones', hint: 'Cuando valoran tus recetas' },
  { key: 'notify_follows', label: 'Seguidores', hint: 'Cuando alguien te sigue' },
  { key: 'notify_new_recipes', label: 'Recetas nuevas', hint: 'Cuando publica alguien que seguís' },
  { key: 'notify_daily', label: 'Receta del día', hint: 'Una sugerencia diaria a las 11 h' },
];

export default function Settings() {
  const { colors, mode, setMode } = useTheme();
  const { session, profile, refreshProfile, signOut } = useAuth();
  const [local, setLocal] = useState<Partial<Profile>>({});
  const [signingOut, setSigningOut] = useState(false);

  const provider = session?.user.app_metadata?.provider ?? 'email';
  const hasPassword = (session?.user.identities ?? []).some((i) => i.provider === 'email');

  const toggleNotif = async (key: NotifKey, value: boolean) => {
    setLocal((l) => ({ ...l, [key]: value }));
    try {
      await updateMyProfile({ [key]: value });
      await refreshProfile();
    } catch (e) {
      setLocal((l) => ({ ...l, [key]: !value }));
      Alert.alert('No se pudo guardar', friendlyError(e));
    }
  };

  const testPush = async () => {
    const status = await registerForPush();
    await sendTestNotification().catch(() => {});
    if (status === 'denied') Alert.alert('Permiso denegado', 'Activá las notificaciones de Sazón en la configuración del teléfono.');
  };

  const logout = () =>
    Alert.alert('Cerrar sesión', '¿Querés salir de tu cuenta?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: async () => { setSigningOut(true); await signOut(); } },
    ]);

  const removeAccount = () =>
    Alert.alert('Eliminar cuenta', 'Se borrarán tu perfil, tus recetas, comentarios y valoraciones. No se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar definitivamente', style: 'destructive', onPress: async () => {
        try {
          await deleteMyAccount();
          await signOut();
        } catch (e) { Alert.alert('Error', friendlyError(e)); }
      } },
    ]);

  const themes: { value: ThemeMode; label: string }[] = [
    { value: 'system', label: 'Sistema' }, { value: 'light', label: 'Claro' }, { value: 'dark', label: 'Oscuro' },
  ];

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.screen}>
      <SectionHeader title="Mi cuenta" />
      <Card style={{ gap: 6 }}>
        <Row label="Email" value={session?.user.email ?? '—'} />
        <Row label="Usuario" value={`@${profile?.username ?? ''}`} />
        <Row label="Nombre" value={profile?.full_name || '—'} />
        <Row label="Rol" value={profile ? ROLE_LABEL[profile.role] : '—'} />
        <Row label="Ingreso con" value={provider === 'email' ? 'Email y contraseña' : provider.charAt(0).toUpperCase() + provider.slice(1)} />
        <Row label="Miembro desde" value={profile ? new Date(profile.created_at).toLocaleDateString('es-AR') : '—'} />
      </Card>
      <Button variant="secondary" icon="create-outline" title="Editar datos personales" onPress={() => router.push('/settings/profile')} />
      {hasPassword ? (
        <Button variant="secondary" icon="key-outline" title="Cambiar contraseña" onPress={() => router.push('/settings/password')} />
      ) : (
        <T variant="small" muted>Ingresaste con {provider}: tu contraseña se gestiona en ese proveedor.</T>
      )}

      <SectionHeader title="Tema" />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {themes.map((t) => <Chip key={t.value} label={t.label} active={mode === t.value} onPress={() => setMode(t.value)} />)}
      </View>

      <SectionHeader title="Notificaciones" />
      <Card style={{ gap: 12 }}>
        {NOTIF_OPTIONS.map((o) => {
          const value = (local[o.key] ?? profile?.[o.key] ?? true) as boolean;
          return (
            <View key={o.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <T variant="h3">{o.label}</T>
                <T variant="small" muted>{o.hint}</T>
              </View>
              <Switch value={value} onValueChange={(v) => toggleNotif(o.key, v)} trackColor={{ true: colors.primary, false: colors.border }} />
            </View>
          );
        })}
      </Card>
      <Button variant="secondary" icon="notifications-outline" title="Probar notificación" onPress={testPush} />

      <SectionHeader title="Sesión" />
      <Button variant="danger" icon="log-out-outline" title="Cerrar sesión" loading={signingOut} onPress={logout} />
      <Button variant="ghost" title="Eliminar mi cuenta" onPress={removeAccount} />
      <T variant="small" muted style={{ textAlign: 'center' }}>Sazón v{Constants.expoConfig?.version ?? '1.0.0'}</T>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
      <T muted>{label}</T>
      <T style={{ flexShrink: 1, textAlign: 'right' }} numberOfLines={1}>{value}</T>
    </View>
  );
}

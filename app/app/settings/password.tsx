import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView } from 'react-native';
import { Button, Field, styles, T } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { AppError, friendlyError } from '../../lib/errors';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../lib/theme';
import { validatePassword } from '../../lib/validation';

export default function ChangePassword() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const e = {
      current: current ? null : 'Ingresá tu contraseña actual.',
      password: validatePassword(password) ?? (password === current ? 'Tiene que ser distinta a la actual.' : null),
      confirm: confirm !== password ? 'Las contraseñas no coinciden.' : null,
    };
    setErrors(e);
    if (Object.values(e).some(Boolean)) return;
    setSaving(true);
    try {
      // Verificamos la contraseña actual antes de cambiarla (re-autenticación)
      const email = session?.user.email;
      if (!email) throw new AppError('Tu cuenta no tiene email asociado.');
      const { error: authErr } = await supabase.auth.signInWithPassword({ email, password: current });
      if (authErr) {
        setErrors({ ...e, current: 'La contraseña actual es incorrecta.' });
        return;
      }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      Alert.alert('Listo', 'Tu contraseña fue actualizada.');
      router.back();
    } catch (err) {
      Alert.alert('No se pudo cambiar', friendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <T muted>Por seguridad, primero confirmá tu contraseña actual.</T>
      <Field label="Contraseña actual" value={current} onChangeText={setCurrent} error={errors.current} secure />
      <Field label="Nueva contraseña" value={password} onChangeText={setPassword} error={errors.password} secure
        hint="Mínimo 8 caracteres, con letras y números" />
      <Field label="Repetir nueva contraseña" value={confirm} onChangeText={setConfirm} error={errors.confirm} secure />
      <Button title="Cambiar contraseña" icon="key" onPress={save} loading={saving} />
    </ScrollView>
  );
}

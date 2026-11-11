import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Button, Field, T } from '../../components/ui';
import { usernameAvailable } from '../../lib/api';
import { friendlyError } from '../../lib/errors';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../lib/theme';
import { required, validateEmail, validatePassword, validateUsername } from '../../lib/validation';

type Errors = Partial<Record<'fullName' | 'username' | 'email' | 'password' | 'confirm', string | null>>;

export default function Register() {
  const { colors } = useTheme();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const e: Errors = {
      fullName: required(fullName, 'El nombre', 60, 2),
      username: validateUsername(username),
      email: validateEmail(email),
      password: validatePassword(password),
      confirm: confirm !== password ? 'Las contraseñas no coinciden.' : null,
    };
    setErrors(e);
    if (Object.values(e).some(Boolean)) return;

    setLoading(true);
    try {
      if (!(await usernameAvailable(username))) {
        setErrors({ ...e, username: 'Ese nombre de usuario ya está en uso.' });
        return;
      }
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { data: { username, full_name: fullName.trim() } },
      });
      if (error) throw error;
      // Supabase no informa error si el email ya existe (para no filtrar datos): lo detectamos así
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        throw new Error('User already registered');
      }
      if (!data.session) {
        Alert.alert('¡Cuenta creada!', 'Te enviamos un email para confirmar tu cuenta. Después iniciá sesión.');
        router.replace('/(auth)/login');
      }
      // Con sesión activa, el guard de rutas lleva a la app automáticamente
    } catch (err) {
      Alert.alert('No se pudo crear la cuenta', friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 14, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <T variant="title">Crear cuenta</T>
        <T muted>Sumate a la comunidad y empezá a compartir tus recetas.</T>
        <Field label="Nombre" value={fullName} onChangeText={setFullName} error={errors.fullName} placeholder="Ana Pérez" autoComplete="name" />
        <Field label="Nombre de usuario" value={username} error={errors.username} placeholder="ana_cocina"
          autoCapitalize="none" hint="Así te van a ver los demás: @usuario"
          onChangeText={(t) => setUsername(t.toLowerCase().replace(/\s/g, ''))} />
        <Field label="Email" value={email} onChangeText={setEmail} error={errors.email}
          autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="tu@email.com" />
        <Field label="Contraseña" value={password} onChangeText={setPassword} error={errors.password}
          secure autoComplete="new-password" hint="Mínimo 8 caracteres, con letras y números" />
        <Field label="Repetir contraseña" value={confirm} onChangeText={setConfirm} error={errors.confirm} secure />
        <Button title="Crear cuenta" onPress={submit} loading={loading} style={{ marginTop: 6 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

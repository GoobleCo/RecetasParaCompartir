import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Field, T } from '../../components/ui';
import { friendlyError } from '../../lib/errors';
import { OAUTH_PROVIDERS, PROVIDER_LABEL, signInWithProvider } from '../../lib/oauth';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../lib/theme';
import { validateEmail } from '../../lib/validation';

export default function Login() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string | null; password?: string | null }>({});
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);

  const submit = async () => {
    const e = { email: validateEmail(email), password: password ? null : 'La contraseña es obligatoria.' };
    setErrors(e);
    if (e.email || e.password) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    setLoading(false);
    if (error) Alert.alert('No se pudo iniciar sesión', friendlyError(error));
    // Si sale bien, el guard de rutas lleva automáticamente a la pantalla principal
  };

  const social = async (p: (typeof OAUTH_PROVIDERS)[number]) => {
    setOauthLoading(p);
    try {
      await signInWithProvider(p);
    } catch (e) {
      Alert.alert(`No se pudo ingresar con ${PROVIDER_LABEL[p]}`, friendlyError(e));
    } finally {
      setOauthLoading(null);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: insets.top + 40, gap: 16 }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <View style={{ width: 84, height: 84, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="restaurant" size={42} color={colors.onPrimary} />
          </View>
          <T variant="title">Sazón</T>
          <T muted style={{ textAlign: 'center' }}>Cociná, compartí y descubrí recetas de la comunidad</T>
        </View>

        <Field label="Email" value={email} onChangeText={setEmail} error={errors.email}
          autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="tu@email.com" />
        <Field label="Contraseña" value={password} onChangeText={setPassword} error={errors.password}
          secure autoComplete="password" placeholder="••••••••" onSubmitEditing={submit} returnKeyType="go" />

        <Link href="/(auth)/forgot-password" style={{ color: colors.primary, fontWeight: '700', alignSelf: 'flex-end' }}>
          ¿Olvidaste tu contraseña?
        </Link>

        <Button title="Iniciar sesión" onPress={submit} loading={loading} />

        {OAUTH_PROVIDERS.length > 0 && (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 4 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
              <T variant="small" muted>o continuá con</T>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            </View>
            {OAUTH_PROVIDERS.map((p) => (
              <Button key={p} variant="secondary" title={PROVIDER_LABEL[p]} icon={p === 'github' ? 'logo-github' : 'logo-google'}
                loading={oauthLoading === p} disabled={!!oauthLoading} onPress={() => social(p)} />
            ))}
          </>
        )}

        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 8 }}>
          <T muted>¿No tenés cuenta?</T>
          <Link href="/(auth)/register" style={{ color: colors.primary, fontWeight: '700' }}>Registrate</Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

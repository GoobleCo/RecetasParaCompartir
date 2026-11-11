import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Button, Field, T } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { friendlyError } from '../../lib/errors';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../lib/theme';
import { validateEmail, validatePassword } from '../../lib/validation';

/**
 * Recuperar y restablecer contraseña en 2 pasos:
 *  1. Pedir un código de 6 dígitos al email (resetPasswordForEmail).
 *  2. Ingresar código + contraseña nueva (verifyOtp tipo "recovery" + updateUser).
 * Se usa código en vez de link para que funcione igual en APK, Expo Go o web.
 */
export default function ForgotPassword() {
  const { colors } = useTheme();
  const { setHoldRedirect } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(false);

  const sendCode = async () => {
    const err = validateEmail(email);
    setErrors({ email: err });
    if (err) return;
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
    setLoading(false);
    if (error) return Alert.alert('No se pudo enviar el código', friendlyError(error));
    // Por seguridad no revelamos si el email existe o no
    Alert.alert('Revisá tu email', 'Si existe una cuenta con ese email, te enviamos un código de verificación.');
    setStep(2);
  };

  const reset = async () => {
    const e = {
      code: /^\d{6,10}$/.test(code.trim()) ? null : 'Ingresá el código numérico que recibiste.',
      password: validatePassword(password),
      confirm: confirm !== password ? 'Las contraseñas no coinciden.' : null,
    };
    setErrors(e);
    if (Object.values(e).some(Boolean)) return;

    setLoading(true);
    setHoldRedirect(true); // que no nos saque de la pantalla al crearse la sesión
    try {
      const { error: otpErr } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'recovery' });
      if (otpErr) throw otpErr;
      const { error: updErr } = await supabase.auth.updateUser({ password });
      if (updErr) throw updErr;
      Alert.alert('¡Listo!', 'Tu contraseña fue actualizada.');
      setHoldRedirect(false); // ya con sesión → entra a la app
    } catch (err) {
      Alert.alert('No se pudo restablecer', friendlyError(err));
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      setHoldRedirect(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 14 }} keyboardShouldPersistTaps="handled">
        <T variant="title">Recuperar contraseña</T>
        {step === 1 ? (
          <>
            <T muted>Ingresá el email de tu cuenta y te enviamos un código para crear una contraseña nueva.</T>
            <Field label="Email" value={email} onChangeText={setEmail} error={errors.email}
              autoCapitalize="none" keyboardType="email-address" placeholder="tu@email.com" />
            <Button title="Enviar código" onPress={sendCode} loading={loading} />
            <Button title="Ya tengo un código" variant="ghost" onPress={() => {
              const err = validateEmail(email);
              if (err) return setErrors({ email: err });
              setStep(2);
            }} />
          </>
        ) : (
          <>
            <T muted>Escribí el código que llegó a {email.trim()} y elegí tu nueva contraseña.</T>
            <Field label="Código" value={code} onChangeText={setCode} error={errors.code}
              keyboardType="number-pad" maxLength={10} placeholder="123456" />
            <Field label="Nueva contraseña" value={password} onChangeText={setPassword} error={errors.password}
              secure hint="Mínimo 8 caracteres, con letras y números" />
            <Field label="Repetir contraseña" value={confirm} onChangeText={setConfirm} error={errors.confirm} secure />
            <Button title="Cambiar contraseña" onPress={reset} loading={loading} />
            <Button title="Reenviar código" variant="ghost" onPress={sendCode} disabled={loading} />
          </>
        )}
        <Button title="Volver al inicio de sesión" variant="ghost" onPress={() => router.back()} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

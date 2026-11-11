import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import type { ImagePickerAsset } from 'expo-image-picker';
import { Avatar, Button, Field, Loading, styles } from '../../components/ui';
import { updateMyProfile, usernameAvailable } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { friendlyError } from '../../lib/errors';
import { useTheme } from '../../lib/theme';
import { imageUrl, pickImage, removeImage, uploadImage } from '../../lib/upload';
import { required, validateUsername } from '../../lib/validation';

export default function EditProfile() {
  const { colors } = useTheme();
  const { profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [avatar, setAvatar] = useState<ImagePickerAsset | null>(null);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [saving, setSaving] = useState(false);

  if (!profile) return <Loading />;

  const choose = async () => {
    try {
      const a = await pickImage([1, 1]);
      if (a) setAvatar(a);
    } catch (e) { Alert.alert('Imagen', friendlyError(e)); }
  };

  const save = async () => {
    const e = {
      fullName: required(fullName, 'El nombre', 60, 2),
      username: validateUsername(username),
      bio: bio.length > 280 ? 'Máximo 280 caracteres.' : null,
    };
    setErrors(e);
    if (Object.values(e).some(Boolean)) return;
    setSaving(true);
    try {
      if (username !== profile.username && !(await usernameAvailable(username))) {
        setErrors({ ...e, username: 'Ese nombre de usuario ya está en uso.' });
        return;
      }
      let avatarUrl = profile.avatar_url;
      if (avatar) {
        const path = await uploadImage('avatars', profile.id, avatar);
        avatarUrl = imageUrl('avatars', path);
      }
      await updateMyProfile({ full_name: fullName.trim(), username, bio: bio.trim() || null, avatar_url: avatarUrl });
      // borrar avatar anterior si era nuestro
      if (avatar && profile.avatar_url?.includes('/avatars/')) {
        const old = profile.avatar_url.split('/avatars/')[1];
        if (old) removeImage('avatars', decodeURIComponent(old)).catch(() => {});
      }
      await refreshProfile();
      router.back();
    } catch (err) {
      Alert.alert('No se pudo guardar', friendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', gap: 10 }}>
          <Avatar url={avatar?.uri ?? profile.avatar_url} name={fullName || username} size={100} />
          <Button small variant="secondary" icon="camera-outline" title="Cambiar foto" onPress={choose} />
        </View>
        <Field label="Nombre" value={fullName} onChangeText={setFullName} error={errors.fullName} maxLength={60} />
        <Field label="Nombre de usuario" value={username} error={errors.username} autoCapitalize="none"
          onChangeText={(t) => setUsername(t.toLowerCase().replace(/\s/g, ''))} maxLength={20} />
        <Field label="Biografía" value={bio} onChangeText={setBio} error={errors.bio} multiline maxLength={280}
          placeholder="Contá algo sobre vos y tu cocina" hint={`${bio.length}/280`} />
        <Button title="Guardar" icon="checkmark" onPress={save} loading={saving} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

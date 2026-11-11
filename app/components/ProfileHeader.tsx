import { View } from 'react-native';
import { Profile, ROLE_LABEL } from '../lib/api';
import { useTheme } from '../lib/theme';
import { Avatar, Badge, T } from './ui';

export function ProfileHeader({ profile, recipes, followers, following }: {
  profile: Profile; recipes: number; followers: number; following: number;
}) {
  const { colors } = useTheme();
  const stat = (n: number, label: string) => (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <T variant="h2">{n}</T>
      <T variant="small" muted>{label}</T>
    </View>
  );
  return (
    <View style={{ alignItems: 'center', gap: 8 }}>
      <Avatar url={profile.avatar_url} name={profile.full_name ?? profile.username} size={88} />
      <T variant="h2">{profile.full_name || profile.username}</T>
      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
        <T muted>@{profile.username}</T>
        {profile.role !== 'user' && <Badge label={ROLE_LABEL[profile.role]} />}
      </View>
      {profile.bio ? <T style={{ textAlign: 'center' }}>{profile.bio}</T> : null}
      <View style={{ flexDirection: 'row', alignSelf: 'stretch', backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 16, paddingVertical: 12, marginTop: 4 }}>
        {stat(recipes, 'Recetas')}
        {stat(followers, 'Seguidores')}
        {stat(following, 'Siguiendo')}
      </View>
    </View>
  );
}

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Challenge } from '../lib/api';
import { useTheme } from '../lib/theme';
import { Badge, IconName, Stars, T } from './ui';

export function ChallengeCard({ challenge, compact }: { challenge: Challenge; compact?: boolean }) {
  const { colors } = useTheme();
  const open = () => router.push(`/challenge/${challenge.id}`);
  const meta = (icon: IconName, text: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      <Ionicons name={icon} size={13} color={colors.muted} />
      <T variant="small" muted>{text}</T>
    </View>
  );

  return (
    <Pressable onPress={open} style={({ pressed }) => ({
      width: compact ? 220 : undefined, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1,
      borderColor: colors.border, borderLeftWidth: 4, borderLeftColor: colors.primary, padding: 14, gap: 6,
      opacity: pressed ? 0.85 : 1,
    })}>
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        <Badge label={`${challenge.rounds} ronda${challenge.rounds === 1 ? '' : 's'}`} />
        <Badge tone="muted" label={`${challenge.round_time_s} s / ronda`} />
        {!challenge.is_public && <Badge tone="danger" label="Privado" />}
      </View>
      <T variant="h3" numberOfLines={compact ? 1 : 2}>{challenge.title}</T>
      {!compact && challenge.description ? <T variant="small" muted numberOfLines={2}>{challenge.description}</T> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Stars value={Number(challenge.avg_rating)} size={12} />
          <T variant="small" muted>({challenge.rating_count})</T>
        </View>
        {meta('game-controller-outline', String(challenge.play_count))}
        {meta('grid-outline', `${challenge.protocol_ids.length} prot.`)}
        {!compact && meta('chatbubble-outline', String(challenge.comment_count))}
      </View>
      {challenge.author && <T variant="small" muted>por @{challenge.author.username}</T>}
    </Pressable>
  );
}

import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { LeaderRow } from '../lib/api';
import { useTheme } from '../lib/theme';
import { Avatar, T } from './ui';

const MEDAL = ['🥇', '🥈', '🥉'];

export function LeaderList({ rows, meId, empty }: { rows: LeaderRow[]; meId?: string; empty?: string }) {
  const { colors } = useTheme();
  if (rows.length === 0) return <T muted>{empty ?? 'Todavía no hay puntajes.'}</T>;
  return (
    <View style={{ gap: 6 }}>
      {rows.map((r, i) => {
        const me = r.user?.id === meId;
        return (
          <Pressable key={r.user?.id ?? i} onPress={() => r.user && router.push(`/user/${r.user.id}`)} style={({ pressed }) => ({
            flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 14, borderWidth: me ? 2 : 1,
            borderColor: me ? colors.primary : colors.border, backgroundColor: me ? colors.primarySoft : colors.card,
            opacity: pressed ? 0.8 : 1,
          })}>
            <T variant="h3" style={{ width: 34, textAlign: 'center' }}>{MEDAL[i] ?? `#${i + 1}`}</T>
            <Avatar url={r.user?.avatar_url} name={r.user?.full_name ?? r.user?.username} size={32} />
            <View style={{ flex: 1 }}>
              <T variant="label" numberOfLines={1}>@{r.user?.username ?? 'usuario'}{me ? ' (vos)' : ''}</T>
              <T variant="small" muted>{new Date(r.achieved_at).toLocaleDateString('es-AR')}</T>
            </View>
            <T variant="h3" style={{ color: colors.primary }}>{r.score}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

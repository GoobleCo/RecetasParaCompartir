import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import { Dir } from '../lib/game';
import { useTheme } from '../lib/theme';
import { IconName } from './ui';

export const DIR_ICON: Record<Dir, IconName> = {
  U: 'arrow-up', D: 'arrow-down', L: 'arrow-back', R: 'arrow-forward',
};
export const DIR_LABEL: Record<Dir, string> = { U: 'Arriba', D: 'Abajo', L: 'Izquierda', R: 'Derecha' };

type KeyState = 'pending' | 'done' | 'next' | 'error';

export function ArrowKey({ dir, state = 'pending', size = 28 }: { dir: Dir; state?: KeyState; size?: number }) {
  const { colors } = useTheme();
  const bg = { pending: colors.cardAlt, done: colors.success, next: colors.primarySoft, error: colors.dangerSoft }[state];
  const fg = { pending: colors.muted, done: colors.card, next: colors.primary, error: colors.danger }[state];
  return (
    <View style={{
      width: size + 12, height: size + 12, borderRadius: 10, backgroundColor: bg, alignItems: 'center', justifyContent: 'center',
      borderWidth: state === 'next' ? 2 : 0, borderColor: colors.primary,
    }}>
      <Ionicons name={DIR_ICON[dir]} size={size} color={fg} />
    </View>
  );
}

/** Muestra un código de flechas. progress = cuántas ya se ingresaron. */
export function CodeView({ code, progress = 0, error, size = 20, gap = 6 }: {
  code: string; progress?: number; error?: boolean; size?: number; gap?: number;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap, justifyContent: 'center' }}>
      {code.split('').map((c, i) => (
        <ArrowKey key={i} dir={c as Dir} size={size}
          state={error ? 'error' : i < progress ? 'done' : i === progress && progress > 0 ? 'next' : 'pending'} />
      ))}
    </View>
  );
}

/** Pad direccional táctil */
export function DPad({ onPress, size = 74, disabled }: { onPress: (d: Dir) => void; size?: number; disabled?: boolean }) {
  const { colors } = useTheme();
  const btn = (d: Dir) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={DIR_LABEL[d]}
      disabled={disabled}
      onPressIn={() => onPress(d)}
      style={({ pressed }) => ({
        width: size, height: size, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
        backgroundColor: pressed ? colors.primary : colors.card, borderWidth: 2,
        borderColor: pressed ? colors.primary : colors.border, opacity: disabled ? 0.4 : 1,
        transform: [{ scale: pressed ? 0.94 : 1 }],
      })}
    >
      {({ pressed }) => <Ionicons name={DIR_ICON[d]} size={size * 0.5} color={pressed ? colors.onPrimary : colors.text} />}
    </Pressable>
  );
  return (
    <View style={{ alignItems: 'center', gap: 8 }}>
      {btn('U')}
      <View style={{ flexDirection: 'row', gap: size + 16 }}>
        {btn('L')}
        {btn('R')}
      </View>
      {btn('D')}
    </View>
  );
}

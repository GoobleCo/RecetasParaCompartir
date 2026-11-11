import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { ComponentProps, ReactNode, useEffect, useState } from 'react';
import {
  ActivityIndicator, Image, Pressable, StyleProp, StyleSheet, Text, TextInput, TextInputProps,
  TextStyle, View, ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../lib/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

// ---------- Texto ----------
export function T({ children, style, variant = 'body', numberOfLines, muted }: {
  children: ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number; muted?: boolean;
  variant?: 'title' | 'h2' | 'h3' | 'body' | 'small' | 'label';
}) {
  const { colors } = useTheme();
  const v = {
    title: { fontSize: 26, fontWeight: '800' as const, letterSpacing: -0.5 },
    h2: { fontSize: 20, fontWeight: '700' as const },
    h3: { fontSize: 16, fontWeight: '700' as const },
    body: { fontSize: 15, lineHeight: 21 },
    small: { fontSize: 13, lineHeight: 18 },
    label: { fontSize: 13, fontWeight: '600' as const },
  }[variant];
  return (
    <Text numberOfLines={numberOfLines} style={[{ color: muted ? colors.muted : colors.text }, v, style]}>
      {children}
    </Text>
  );
}

// ---------- Botón ----------
export function Button({ title, onPress, variant = 'primary', loading, disabled, icon, style, small }: {
  title: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean; disabled?: boolean; icon?: IconName; style?: StyleProp<ViewStyle>; small?: boolean;
}) {
  const { colors } = useTheme();
  const bg = { primary: colors.primary, secondary: colors.cardAlt, danger: colors.dangerSoft, ghost: 'transparent' }[variant];
  const fg = { primary: colors.onPrimary, secondary: colors.text, danger: colors.danger, ghost: colors.primary }[variant];
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        styles.btn,
        small && { paddingVertical: 8, paddingHorizontal: 12 },
        { backgroundColor: bg, opacity: off ? 0.55 : pressed ? 0.8 : 1 },
        variant === 'secondary' && { borderWidth: 1, borderColor: colors.border },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : (
        <>
          {icon && <Ionicons name={icon} size={small ? 16 : 18} color={fg} />}
          <Text style={{ color: fg, fontWeight: '700', fontSize: small ? 14 : 15 }}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({ icon, onPress, color, size = 22, label }: {
  icon: IconName; onPress: () => void; color?: string; size?: number; label: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityLabel={label} hitSlop={10} onPress={onPress} style={({ pressed }) => ({ padding: 6, opacity: pressed ? 0.6 : 1 })}>
      <Ionicons name={icon} size={size} color={color ?? colors.text} />
    </Pressable>
  );
}

// ---------- Campo de texto ----------
export function Field({ label, error, hint, secure, style, ...props }: TextInputProps & {
  label?: string; error?: string | null; hint?: string; secure?: boolean;
}) {
  const { colors } = useTheme();
  const [hidden, setHidden] = useState(true);
  return (
    <View style={[{ gap: 6 }, style as StyleProp<ViewStyle>]}>
      {label && <T variant="label">{label}</T>}
      <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: error ? colors.danger : colors.border }]}>
        <TextInput
          placeholderTextColor={colors.muted}
          secureTextEntry={secure && hidden}
          style={[styles.input, { color: colors.text }, props.multiline && { minHeight: 80, textAlignVertical: 'top' }]}
          {...props}
        />
        {secure && (
          <IconButton label={hidden ? 'Mostrar contraseña' : 'Ocultar contraseña'} icon={hidden ? 'eye-outline' : 'eye-off-outline'}
            color={colors.muted} size={20} onPress={() => setHidden(!hidden)} />
        )}
      </View>
      {error ? <T variant="small" style={{ color: colors.danger }}>{error}</T> : hint ? <T variant="small" muted>{hint}</T> : null}
    </View>
  );
}

// ---------- Contenedores ----------
export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const { colors } = useTheme();
  const base = [styles.card, { backgroundColor: colors.card, borderColor: colors.border }, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return <Pressable onPress={onPress} style={({ pressed }) => [base, { opacity: pressed ? 0.85 : 1 }]}>{children}</Pressable>;
}

export function Chip({ label, active, onPress, icon }: { label: string; active?: boolean; onPress?: () => void; icon?: IconName }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[styles.chip, { backgroundColor: active ? colors.primary : colors.cardAlt, borderColor: active ? colors.primary : colors.border }]}
    >
      {icon && <Ionicons name={icon} size={14} color={active ? colors.onPrimary : colors.text} />}
      <Text style={{ color: active ? colors.onPrimary : colors.text, fontWeight: '600', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

export function Badge({ label, tone = 'primary' }: { label: string; tone?: 'primary' | 'muted' | 'danger' }) {
  const { colors } = useTheme();
  const bg = tone === 'primary' ? colors.primarySoft : tone === 'danger' ? colors.dangerSoft : colors.cardAlt;
  const fg = tone === 'primary' ? colors.primary : tone === 'danger' ? colors.danger : colors.muted;
  return (
    <View style={{ backgroundColor: bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' }}>
      <Text style={{ color: fg, fontSize: 11, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

export function Avatar({ url, name, size = 40 }: { url?: string | null; name?: string | null; size?: number }) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  const initial = (name ?? '?').trim().charAt(0).toUpperCase() || '?';
  if (url && !failed) {
    return <Image source={{ uri: url }} onError={() => setFailed(true)} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.cardAlt }} />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.primary, fontWeight: '800', fontSize: size * 0.42 }}>{initial}</Text>
    </View>
  );
}

// ---------- Estrellas ----------
export function Stars({ value, size = 16, onChange }: { value: number; size?: number; onChange?: (v: number) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: onChange ? 6 : 2 }}>
      {[1, 2, 3, 4, 5].map((i) => {
        const name: IconName = value >= i ? 'star' : value >= i - 0.5 ? 'star-half' : 'star-outline';
        const icon = <Ionicons name={name} size={size} color={colors.star} />;
        return onChange ? (
          <Pressable key={i} hitSlop={6} accessibilityLabel={`${i} estrellas`} onPress={() => onChange(i)}>{icon}</Pressable>
        ) : <View key={i}>{icon}</View>;
      })}
    </View>
  );
}

// ---------- Estados ----------
export function Loading({ label }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.center, { backgroundColor: colors.bg }]}>
      <ActivityIndicator size="large" color={colors.primary} />
      {label && <T muted style={{ marginTop: 12 }}>{label}</T>}
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.center, { backgroundColor: colors.bg, padding: 24 }]}>
      <Ionicons name="cloud-offline-outline" size={48} color={colors.muted} />
      <T style={{ textAlign: 'center', marginVertical: 12 }}>{message}</T>
      {onRetry && <Button title="Reintentar" icon="refresh" onPress={onRetry} />}
    </View>
  );
}

export function Empty({ icon = 'restaurant-outline', title, subtitle, action }: {
  icon?: IconName; title: string; subtitle?: string; action?: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', padding: 32, gap: 8 }}>
      <Ionicons name={icon} size={44} color={colors.muted} />
      <T variant="h3" style={{ textAlign: 'center' }}>{title}</T>
      {subtitle && <T muted style={{ textAlign: 'center' }}>{subtitle}</T>}
      {action}
    </View>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
      <T variant="h2">{title}</T>
      {action && <Pressable onPress={onAction} hitSlop={8}><Text style={{ color: colors.primary, fontWeight: '700' }}>{action}</Text></Pressable>}
    </View>
  );
}

/** Banner global cuando el teléfono no tiene internet */
export function OfflineBanner() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [offline, setOffline] = useState(false);
  useEffect(() => NetInfo.addEventListener((s) => setOffline(s.isConnected === false)), []);
  if (!offline) return null;
  return (
    <View style={{ backgroundColor: colors.danger, paddingTop: insets.top + 4, paddingBottom: 6, alignItems: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Sin conexión a internet</Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  btn: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingVertical: 13, paddingHorizontal: 18, borderRadius: 14 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
  input: { flex: 1, paddingVertical: 11, fontSize: 15 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  screen: { padding: 16, gap: 14, paddingBottom: 40 },
});

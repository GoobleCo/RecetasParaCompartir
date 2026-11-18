import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, View } from 'react-native';
import { Alert } from '../lib/alert';
import { Challenge, ChallengeInput, getProtocols, ProtocolRow } from '../lib/api';
import { friendlyError } from '../lib/errors';
import { CATEGORY_COLOR, CATEGORY_LABEL, codeToArrows, estimateDifficulty, ProtocolCategory } from '../lib/game';
import { useTheme } from '../lib/theme';
import { required } from '../lib/validation';
import { Badge, Button, Card, Chip, ErrorView, Field, Loading, SectionHeader, T } from './ui';

const ROUND_OPTIONS = [1, 3, 5, 8, 10, 15, 20];
const TIME_OPTIONS = [5, 6, 8, 10, 12, 15, 20];

/**
 * Formulario compartido para ALTA y MODIFICACIÓN de desafíos.
 * Valida todo antes de enviar; el servidor vuelve a validar (CHECK + trigger).
 */
export function ChallengeForm({ initial, submitLabel, onSubmit }: {
  initial?: Challenge;
  submitLabel: string;
  onSubmit: (input: ChallengeInput) => Promise<void>;
}) {
  const { colors } = useTheme();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [rounds, setRounds] = useState(initial?.rounds ?? 5);
  const [roundTime, setRoundTime] = useState(initial?.round_time_s ?? 10);
  const [selected, setSelected] = useState<number[]>(initial?.protocol_ids ?? []);
  const [isPublic, setIsPublic] = useState(initial?.is_public ?? true);
  const [filter, setFilter] = useState<ProtocolCategory | null>(null);
  const [protocols, setProtocols] = useState<ProtocolRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoadError(null);
    getProtocols(true).then(setProtocols).catch((e) => setLoadError(friendlyError(e)));
  };
  useEffect(load, []);

  const chosen = useMemo(() => (protocols ?? []).filter((p) => selected.includes(p.id)), [protocols, selected]);
  const visible = (protocols ?? []).filter((p) => (p.active || selected.includes(p.id)) && (!filter || p.category === filter));

  const toggle = (id: number) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 30 ? s : [...s, id]));

  const submit = async () => {
    const e = {
      title: required(title, 'El título', 60, 3),
      description: description.length > 300 ? 'Máximo 300 caracteres.' : null,
      protocols: selected.length < 2 ? 'Elegí al menos 2 protocolos.' : selected.length > 30 ? 'Máximo 30 protocolos.' : null,
    };
    setErrors(e);
    if (Object.values(e).some(Boolean)) {
      Alert.alert('Revisá el formulario', 'Hay campos con errores.');
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        title: title.trim(), description: description.trim() || null, protocol_ids: selected,
        rounds, round_time_s: roundTime, is_public: isPublic,
      });
    } catch (err) {
      Alert.alert('No se pudo guardar', friendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  if (loadError) return <ErrorView message={loadError} onRetry={load} />;
  if (!protocols) return <Loading />;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <Field label="Título *" value={title} onChangeText={setTitle} error={errors.title} placeholder="Ej: Defensa de la base" maxLength={60} />
        <Field label="Descripción" value={description} onChangeText={setDescription} error={errors.description}
          placeholder="¿De qué se trata? ¿Qué tiene de difícil?" multiline maxLength={300} />

        <View style={{ gap: 8 }}>
          <T variant="label">Rondas</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {ROUND_OPTIONS.map((n) => <Chip key={n} label={String(n)} active={rounds === n} onPress={() => setRounds(n)} />)}
          </View>
        </View>
        <View style={{ gap: 8 }}>
          <T variant="label">Tiempo por ronda (segundos)</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {TIME_OPTIONS.map((n) => <Chip key={n} label={`${n} s`} active={roundTime === n} onPress={() => setRoundTime(n)} />)}
          </View>
        </View>

        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <T style={{ flex: 1 }}>Dificultad estimada</T>
          <Badge label={estimateDifficulty(chosen, roundTime, rounds)} />
          <T variant="small" muted>{selected.length}/30</T>
        </Card>

        <SectionHeader title="Protocolos *" />
        <T variant="small" muted>Tocá los protocolos que van a aparecer en el desafío.</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Chip label="Todos" active={filter == null} onPress={() => setFilter(null)} />
          {(Object.keys(CATEGORY_LABEL) as ProtocolCategory[]).map((c) => (
            <Chip key={c} label={CATEGORY_LABEL[c]} active={filter === c} onPress={() => setFilter(c)} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button small variant="secondary" title="Elegir visibles" onPress={() =>
            setSelected((s) => Array.from(new Set([...s, ...visible.map((p) => p.id)])).slice(0, 30))} />
          <Button small variant="ghost" title="Quitar todos" onPress={() => setSelected([])} />
        </View>
        {errors.protocols && <T variant="small" style={{ color: colors.danger }}>{errors.protocols}</T>}
        {visible.map((p) => {
          const on = selected.includes(p.id);
          return (
            <Pressable key={p.id} onPress={() => toggle(p.id)} style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, borderWidth: on ? 2 : 1,
              borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primarySoft : colors.card,
              opacity: pressed ? 0.8 : 1,
            })}>
              <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: CATEGORY_COLOR[p.category] }} />
              <T style={{ fontSize: 22 }}>{p.icon ?? '•'}</T>
              <View style={{ flex: 1 }}>
                <T variant="h3" numberOfLines={1}>{p.name}{p.active ? '' : ' (inactivo)'}</T>
                <T variant="small" muted>{codeToArrows(p.code)}</T>
              </View>
              <T style={{ fontSize: 20, color: on ? colors.primary : colors.muted }}>{on ? '✓' : '+'}</T>
            </Pressable>
          );
        })}

        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <T variant="h3">Desafío público</T>
            <T variant="small" muted>{isPublic ? 'Toda la comunidad puede jugarlo.' : 'Sólo vos (y la moderación) pueden verlo.'}</T>
          </View>
          <Switch value={isPublic} onValueChange={setIsPublic} trackColor={{ true: colors.primary, false: colors.border }} />
        </Card>

        <Button title={submitLabel} icon="checkmark" onPress={submit} loading={saving} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

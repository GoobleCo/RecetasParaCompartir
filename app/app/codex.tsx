import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { CodeView, DPad } from '../components/Arrows';
import { Card, Chip, ErrorView, Loading, styles, T } from '../components/ui';
import { getProtocols, ProtocolRow } from '../lib/api';
import { CATEGORY_COLOR, CATEGORY_LABEL, Dir, ProtocolCategory } from '../lib/game';
import { useTheme } from '../lib/theme';
import { useLoader } from '../lib/useLoader';

/** Catálogo de protocolos con modo práctica (no suma puntos) */
export default function Codex() {
  const { colors } = useTheme();
  const [filter, setFilter] = useState<ProtocolCategory | null>(null);
  const [practice, setPractice] = useState<ProtocolRow | null>(null);
  const [pos, setPos] = useState(0);
  const [err, setErr] = useState(false);
  const [done, setDone] = useState(0);
  const { data, error, loading, refreshing, refresh, retry } = useLoader(() => getProtocols(false), []);

  if (loading) return <Loading />;
  if (error || !data) return <ErrorView message={error ?? 'Sin datos'} onRetry={retry} />;

  const choose = (p: ProtocolRow) => { setPractice(p.id === practice?.id ? null : p); setPos(0); setErr(false); setDone(0); };
  const input = (d: Dir) => {
    if (!practice) return;
    if (practice.code[pos] !== d) { setErr(true); setPos(0); setTimeout(() => setErr(false), 250); return; }
    if (pos + 1 === practice.code.length) { setDone((n) => n + 1); setPos(0); } else setPos(pos + 1);
  };

  const list = data.filter((p) => !filter || p.category === filter);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={styles.screen}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}>
        <T muted>Memorizá los códigos. Tocá un protocolo para practicarlo con el pad.</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Chip label="Todos" active={filter == null} onPress={() => setFilter(null)} />
          {(Object.keys(CATEGORY_LABEL) as ProtocolCategory[]).map((c) => (
            <Chip key={c} label={CATEGORY_LABEL[c]} active={filter === c} onPress={() => setFilter(c)} />
          ))}
        </View>
        {list.map((p) => (
          <Pressable key={p.id} onPress={() => choose(p)}>
            <Card style={{
              gap: 8, borderLeftWidth: 4, borderLeftColor: CATEGORY_COLOR[p.category],
              borderColor: practice?.id === p.id ? colors.primary : colors.border,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <T style={{ fontSize: 24 }}>{p.icon ?? '•'}</T>
                <View style={{ flex: 1 }}>
                  <T variant="h3">{p.name}</T>
                  <T variant="small" muted>{CATEGORY_LABEL[p.category]} · {p.code.length} flechas</T>
                </View>
              </View>
              <CodeView code={p.code} size={18} gap={4}
                progress={practice?.id === p.id ? pos : 0} error={practice?.id === p.id && err} />
            </Card>
          </Pressable>
        ))}
      </ScrollView>
      {practice && (
        <View style={{ padding: 12, paddingBottom: 24, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border, gap: 8 }}>
          <T variant="label" style={{ textAlign: 'center' }}>Practicando: {practice.name} · aciertos: {done}</T>
          <DPad onPress={input} size={56} />
        </View>
      )}
    </View>
  );
}

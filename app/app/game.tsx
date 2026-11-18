import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { ReactNode, useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { PanResponder, Platform, ScrollView, View } from 'react-native';
import { Alert } from '../lib/alert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CodeView, DPad } from '../components/Arrows';
import { Badge, Button, Card, ErrorView, IconButton, Loading, T } from '../components/ui';
import { finishRun, GameMode, MODE_LABEL, RunResult, RunStart, startRun } from '../lib/api';
import { friendlyError } from '../lib/errors';
import {
  CATEGORY_COLOR, computeScore, Dir, GameAction, gameReducer, GameState, newGame, roundBonus,
} from '../lib/game';
import { useTheme } from '../lib/theme';

type Phase = 'loading' | 'error' | 'ready' | 'countdown' | 'playing' | 'submitting' | 'result';

type Action = GameAction | { type: 'init'; state: GameState };
function reducer(s: GameState | null, a: Action): GameState | null {
  if (a.type === 'init') return a.state;
  return s ? gameReducer(s, a) : s;
}

const haptic = (fn: () => Promise<unknown>) => { if (Platform.OS !== 'web') fn().catch(() => {}); };
const KEYS: Record<string, Dir> = {
  ArrowUp: 'U', ArrowDown: 'D', ArrowLeft: 'L', ArrowRight: 'R', w: 'U', s: 'D', a: 'L', d: 'R', W: 'U', S: 'D', A: 'L', D: 'R',
};

export default function Game() {
  const { mode = 'classic', challengeId } = useLocalSearchParams<{ mode?: GameMode; challengeId?: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState<RunStart | null>(null);
  const [count, setCount] = useState(3);
  const [result, setResult] = useState<RunResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const [game, dispatch] = useReducer(reducer, null);
  const submitted = useRef(false);

  // 1) Pedir al servidor una partida nueva (semilla, protocolos y reglas)
  const prepare = useCallback(async () => {
    setPhase('loading');
    setError(null);
    setResult(null);
    setSubmitError(null);
    submitted.current = false;
    try {
      setRun(await startRun(mode, challengeId));
      setPhase('ready');
    } catch (e) {
      setError(friendlyError(e));
      setPhase('error');
    }
  }, [mode, challengeId]);

  useEffect(() => { prepare(); }, [prepare]);

  // 2) Cuenta regresiva 3-2-1
  useEffect(() => {
    if (phase !== 'countdown' || !run) return;
    if (count === 0) {
      dispatch({ type: 'init', state: newGame(run.protocols, run.seed, run.round_time_ms, run.max_rounds) });
      setPhase('playing');
      return;
    }
    const t = setTimeout(() => setCount((c) => c - 1), 700);
    return () => clearTimeout(t);
  }, [phase, count, run]);

  // 3) Reloj del juego (si la app va a segundo plano, el salto de tiempo se limita = pausa)
  const status = game?.status;
  useEffect(() => {
    if (phase !== 'playing' || status !== 'playing') return;
    let last = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      dispatch({ type: 'tick', dtMs: Math.min(now - last, 100) });
      last = now;
    }, 50);
    return () => clearInterval(id);
  }, [phase, status]);

  // 4) Pasar de ronda automáticamente
  useEffect(() => {
    if (status !== 'roundClear') return;
    haptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
    const t = setTimeout(() => dispatch({ type: 'next' }), 1500);
    return () => clearTimeout(t);
  }, [status, game?.round]);

  // 5) Vibración y destello en cada error
  useEffect(() => {
    if (!game?.errorTick) return;
    haptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 250);
    return () => clearTimeout(t);
  }, [game?.errorTick]);

  useEffect(() => {
    if (game?.codeTick) haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
  }, [game?.codeTick]);

  // 6) Fin de la partida → el servidor valida y calcula el puntaje oficial
  const submit = useCallback(async () => {
    if (!run || !game) return;
    setPhase('submitting');
    setSubmitError(null);
    try {
      setResult(await finishRun(run.run_id, game.stats));
      submitted.current = true;
      setPhase('result');
    } catch (e) {
      setSubmitError(friendlyError(e));
      setPhase('result');
    }
  }, [run, game]);

  useEffect(() => {
    if ((status === 'over' || status === 'won') && phase === 'playing' && !submitted.current) submit();
  }, [status, phase, submit]);

  const input = useCallback((d: Dir) => {
    if (phase !== 'playing') return;
    haptic(() => Haptics.selectionAsync());
    dispatch({ type: 'input', dir: d });
  }, [phase]);

  // Teclado (web): flechas o WASD
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      const d = KEYS[e.key];
      if (d) { e.preventDefault(); input(d); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [input]);

  // Deslizar el dedo en la zona superior también ingresa flechas
  const inputRef = useRef(input);
  inputRef.current = input;
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 12 || Math.abs(g.dy) > 12,
    onPanResponderRelease: (_e, g) => {
      if (Math.max(Math.abs(g.dx), Math.abs(g.dy)) < 25) return;
      inputRef.current(Math.abs(g.dx) > Math.abs(g.dy) ? (g.dx > 0 ? 'R' : 'L') : (g.dy > 0 ? 'D' : 'U'));
    },
  })).current;

  const quit = () => {
    if (phase !== 'playing' || status === 'over' || status === 'won') return router.back();
    Alert.alert('Abandonar partida', 'La partida no se va a registrar. ¿Salir igual?', [
      { text: 'Seguir jugando', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: () => router.back() },
    ]);
  };

  const wrap = (children: ReactNode) => (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, height: 48 }}>
        <IconButton label="Salir" icon="close" onPress={quit} />
        <T variant="h3" style={{ flex: 1, textAlign: 'center' }} numberOfLines={1}>{run?.title ?? MODE_LABEL[mode]}</T>
        <View style={{ width: 36 }} />
      </View>
      {children}
    </View>
  );

  if (phase === 'loading') return wrap(<Loading label="Conectando con el centro de mando…" />);
  if (phase === 'error' || !run) return wrap(<ErrorView message={error ?? 'No se pudo iniciar la partida.'} onRetry={prepare} />);

  if (phase === 'ready' || phase === 'countdown') {
    return wrap(
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, flexGrow: 1, justifyContent: 'center' }}>
        {phase === 'countdown' ? (
          <View style={{ alignItems: 'center', gap: 8 }}>
            <T muted>Preparate…</T>
            <T style={{ fontSize: 120, fontWeight: '900', color: colors.primary }}>{count || '¡Ya!'}</T>
          </View>
        ) : (
          <>
            <View style={{ alignItems: 'center', gap: 6 }}>
              <Ionicons name="radio-outline" size={56} color={colors.primary} />
              <T variant="title" style={{ textAlign: 'center' }}>{run.title}</T>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Badge label={run.max_rounds ? `${run.max_rounds} rondas` : 'Rondas infinitas'} />
                <Badge tone="muted" label={`${run.round_time_ms / 1000} s por ronda`} />
                <Badge tone="muted" label={`${run.protocols.length} protocolos`} />
              </View>
            </View>
            <Card style={{ gap: 8 }}>
              <T variant="h3">Cómo se juega</T>
              <T>• Ingresá el código de flechas de cada protocolo con el pad o deslizando el dedo.</T>
              <T>• Cada código completo suma tiempo. Un error reinicia el código y resta tiempo.</T>
              <T>• Completá la cola para pasar de ronda. Si la barra llega a cero, se terminó.</T>
              <T>• Rondas sin errores dan +100 puntos.</T>
              {Platform.OS === 'web' && <T muted>En la compu: flechas del teclado o W A S D.</T>}
            </Card>
            <Button title="¡Empezar!" icon="play" onPress={() => { setCount(3); setPhase('countdown'); }} />
          </>
        )}
      </ScrollView>,
    );
  }

  if (!game) return wrap(<Loading />);

  if (phase === 'submitting') return wrap(<Loading label="Enviando resultado al servidor…" />);

  if (phase === 'result') {
    const st = game.stats;
    const n = st.rounds;
    const lines: [string, number][] = [
      [`Flechas correctas (${st.arrows} × 10)`, st.arrows * 10],
      [`Bonus de rondas (${n})`, 50 * n + (25 * n * (n + 1)) / 2],
      [`Rondas perfectas (${st.perfect} × 100)`, st.perfect * 100],
      ['Tiempo sobrante', Math.floor(st.timeBonusMs / 100)],
    ];
    return wrap(
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
        <View style={{ alignItems: 'center', gap: 4 }}>
          <T variant="h2">{game.status === 'won' ? '¡Desafío completado! 🏆' : 'Fin de la transmisión'}</T>
          <T muted>Llegaste a la ronda {game.round} · {st.codes} códigos · {st.mistakes} errores</T>
        </View>

        {submitError ? (
          <Card style={{ gap: 10, borderColor: colors.danger }}>
            <T variant="h3">No se pudo registrar el resultado</T>
            <T muted>{submitError}</T>
            <Button title="Reintentar envío" icon="cloud-upload-outline" onPress={submit} />
          </Card>
        ) : result?.rejected ? (
          <Card style={{ gap: 6, borderColor: colors.danger }}>
            <T variant="h3">Partida rechazada por el servidor</T>
            <T muted>Motivo: {result.reason}.</T>
          </Card>
        ) : result ? (
          <Card style={{ alignItems: 'center', gap: 6 }}>
            <T muted>Puntaje oficial</T>
            <T style={{ fontSize: 56, fontWeight: '900', color: colors.primary }}>{result.score}</T>
            {result.new_record && <Badge label="¡NUEVO RÉCORD!" />}
            <T>Puesto #{result.rank} · Tu mejor: {result.best}</T>
            {result.previous_best != null && result.new_record && <T variant="small" muted>Récord anterior: {result.previous_best}</T>}
          </Card>
        ) : null}

        <Card style={{ gap: 8 }}>
          {lines.map(([label, v]) => (
            <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <T muted>{label}</T>
              <T style={{ fontWeight: '700' }}>{v}</T>
            </View>
          ))}
          <View style={{ height: 1, backgroundColor: colors.border }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T variant="h3">Total</T>
            <T variant="h3">{computeScore(st)}</T>
          </View>
        </Card>

        <Button title="Jugar de nuevo" icon="refresh" onPress={prepare} />
        <Button variant="secondary" title="Ver ranking" icon="trophy-outline" onPress={() =>
          mode === 'challenge' && challengeId ? router.replace(`/challenge/${challengeId}`) : router.replace('/(tabs)/ranking')} />
        <Button variant="ghost" title="Volver" onPress={() => router.back()} />
      </ScrollView>,
    );
  }

  // ---------- Jugando ----------
  const current = game.queue[game.idx];
  const upcoming = game.queue.slice(game.idx + 1, game.idx + 6);
  const pct = Math.max(0, Math.min(1, game.timeLeftMs / game.roundTimeMs));
  const barColor = pct > 0.5 ? colors.primary : pct > 0.25 ? colors.star : colors.danger;

  return wrap(
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, gap: 8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <T variant="label">Ronda {game.round}{game.maxRounds ? ` / ${game.maxRounds}` : ''}</T>
          <T variant="label">{computeScore(game.stats)} pts</T>
        </View>
        <View style={{ height: 12, borderRadius: 6, backgroundColor: colors.cardAlt, overflow: 'hidden' }}>
          <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: barColor }} />
        </View>
      </View>

      <View {...pan.panHandlers} style={{ flex: 1, justifyContent: 'center', padding: 16, gap: 18 }}>
        {game.status === 'roundClear' && game.lastRoundBonus ? (
          <View style={{ alignItems: 'center', gap: 6 }}>
            <T variant="title">Ronda {game.lastRoundBonus.round} superada</T>
            <T muted>Bonus de ronda +{roundBonus(game.lastRoundBonus.round)}</T>
            <T muted>Tiempo sobrante +{Math.floor(game.lastRoundBonus.time / 100)}</T>
            {game.lastRoundBonus.perfect ? <Badge label="RONDA PERFECTA +100" /> : null}
          </View>
        ) : (
          <>
            <View style={{
              alignItems: 'center', gap: 10, padding: 18, borderRadius: 20, backgroundColor: flash ? colors.dangerSoft : colors.card,
              borderWidth: 2, borderColor: flash ? colors.danger : CATEGORY_COLOR[current.category],
            }}>
              <T style={{ fontSize: 44 }}>{current.icon ?? '📡'}</T>
              <T variant="h2" style={{ textAlign: 'center' }}>{current.name}</T>
              <CodeView code={current.code} progress={game.pos} error={flash} size={26} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, minHeight: 44 }}>
              {upcoming.map((p, i) => (
                <View key={`${game.round}-${game.idx + i + 1}`} style={{
                  width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: colors.cardAlt, borderBottomWidth: 3, borderBottomColor: CATEGORY_COLOR[p.category],
                  opacity: 1 - i * 0.15,
                }}>
                  <T style={{ fontSize: 22 }}>{p.icon ?? '•'}</T>
                </View>
              ))}
            </View>
            <T variant="small" muted style={{ textAlign: 'center' }}>
              {game.queue.length - game.idx} en cola · deslizá o usá el pad
            </T>
          </>
        )}
      </View>

      <View style={{ paddingBottom: 24 }}>
        <DPad onPress={input} disabled={game.status !== 'playing'} />
      </View>
    </View>,
  );
}

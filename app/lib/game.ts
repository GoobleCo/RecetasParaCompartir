/**
 * Motor del juego (lógica pura, sin React: se puede testear aislado).
 *
 * Reglas:
 *  - Cada ronda trae una cola de protocolos; hay que ingresar el código de flechas de cada uno.
 *  - La barra de tiempo arranca llena (roundTimeMs) y baja sin parar.
 *  - Completar un código suma +0,6 s (sin pasar del máximo). Equivocarse reinicia el código y resta 0,3 s.
 *  - Al vaciar la cola se pasa de ronda: bonus de ronda + tiempo sobrante + bonus si fue perfecta.
 *  - Si el tiempo llega a 0, termina la partida. En desafíos con rondas fijas, completarlas es ganar.
 *
 * La secuencia sale de un generador pseudoaleatorio con semilla: el servidor manda la semilla,
 * así en el desafío diario o en un desafío de la comunidad todos juegan exactamente la misma secuencia.
 */

export type Dir = 'U' | 'D' | 'L' | 'R';
export type ProtocolCategory = 'ofensivo' | 'defensivo' | 'apoyo' | 'logistica';
export type Protocol = { id: number; name: string; code: string; icon: string | null; category: ProtocolCategory };

export const DIRS: Dir[] = ['U', 'D', 'L', 'R'];
export const BONUS_PER_CODE_MS = 600;
export const PENALTY_MS = 300;

export type GameStats = {
  arrows: number;        // flechas correctas
  rounds: number;        // rondas completadas
  perfect: number;       // rondas sin errores
  timeBonusMs: number;   // tiempo sobrante acumulado al terminar cada ronda
  mistakes: number;
  codes: number;         // códigos completados
};

export type GameStatus = 'playing' | 'roundClear' | 'over' | 'won';

export type GameState = {
  status: GameStatus;
  round: number;
  queue: Protocol[];
  idx: number;           // protocolo actual dentro de la cola
  pos: number;           // flecha actual dentro del código
  timeLeftMs: number;
  roundTimeMs: number;
  maxRounds: number | null;
  rng: number;           // estado del generador
  pool: Protocol[];
  stats: GameStats;
  roundMistakes: number;
  lastRoundBonus: { round: number; time: number; perfect: number } | null;
  errorTick: number;     // cambia en cada error (para animar)
  codeTick: number;      // cambia en cada código completado
};

export type GameAction =
  | { type: 'input'; dir: Dir }
  | { type: 'tick'; dtMs: number }
  | { type: 'next' };

// ---------- Generador pseudoaleatorio (mulberry32) ----------
export function nextRandom(state: number): [number, number] {
  const a = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, a];
}

export const codesInRound = (round: number) => Math.min(2 + round, 10);

export function buildQueue(pool: Protocol[], round: number, rng: number): { queue: Protocol[]; rng: number } {
  const queue: Protocol[] = [];
  let s = rng;
  for (let i = 0; i < codesInRound(round); i++) {
    let pick: Protocol;
    let tries = 0;
    do {
      const [r, ns] = nextRandom(s);
      s = ns;
      pick = pool[Math.floor(r * pool.length)];
      tries++;
    } while (pool.length > 1 && queue.length > 0 && pick.id === queue[queue.length - 1].id && tries < 10);
    queue.push(pick);
  }
  return { queue, rng: s };
}

export function newGame(pool: Protocol[], seed: number, roundTimeMs: number, maxRounds: number | null): GameState {
  if (pool.length === 0) throw new Error('No hay protocolos para jugar');
  const sorted = [...pool].sort((a, b) => a.id - b.id); // mismo orden que el servidor
  const { queue, rng } = buildQueue(sorted, 1, seed | 0);
  return {
    status: 'playing', round: 1, queue, idx: 0, pos: 0, timeLeftMs: roundTimeMs, roundTimeMs, maxRounds, rng,
    pool: sorted, stats: { arrows: 0, rounds: 0, perfect: 0, timeBonusMs: 0, mistakes: 0, codes: 0 },
    roundMistakes: 0, lastRoundBonus: null, errorTick: 0, codeTick: 0,
  };
}

export function gameReducer(s: GameState, a: GameAction): GameState {
  switch (a.type) {
    case 'tick': {
      if (s.status !== 'playing') return s;
      const timeLeftMs = s.timeLeftMs - Math.max(0, a.dtMs);
      if (timeLeftMs <= 0) return { ...s, timeLeftMs: 0, status: 'over' };
      return { ...s, timeLeftMs };
    }
    case 'input': {
      if (s.status !== 'playing') return s;
      const code = s.queue[s.idx].code;
      if (a.dir !== code[s.pos]) {
        const timeLeftMs = Math.max(0, s.timeLeftMs - PENALTY_MS);
        return {
          ...s, pos: 0, timeLeftMs, roundMistakes: s.roundMistakes + 1, errorTick: s.errorTick + 1,
          stats: { ...s.stats, mistakes: s.stats.mistakes + 1 },
          status: timeLeftMs <= 0 ? 'over' : 'playing',
        };
      }
      const stats = { ...s.stats, arrows: s.stats.arrows + 1 };
      if (s.pos + 1 < code.length) return { ...s, pos: s.pos + 1, stats };

      // Código completo
      stats.codes += 1;
      const timeLeftMs = Math.min(s.roundTimeMs, s.timeLeftMs + BONUS_PER_CODE_MS);
      if (s.idx + 1 < s.queue.length) {
        return { ...s, idx: s.idx + 1, pos: 0, timeLeftMs, stats, codeTick: s.codeTick + 1 };
      }

      // Ronda completa
      const perfect = s.roundMistakes === 0 ? 1 : 0;
      const bonusTime = Math.round(timeLeftMs);
      stats.rounds += 1;
      stats.perfect += perfect;
      stats.timeBonusMs += bonusTime;
      const finished = s.maxRounds != null && stats.rounds >= s.maxRounds;
      return {
        ...s, pos: 0, idx: s.idx, timeLeftMs, stats, codeTick: s.codeTick + 1,
        status: finished ? 'won' : 'roundClear',
        lastRoundBonus: { round: s.round, time: bonusTime, perfect },
      };
    }
    case 'next': {
      if (s.status !== 'roundClear') return s;
      const round = s.round + 1;
      const { queue, rng } = buildQueue(s.pool, round, s.rng);
      return { ...s, status: 'playing', round, queue, rng, idx: 0, pos: 0, timeLeftMs: s.roundTimeMs, roundMistakes: 0 };
    }
  }
}

/** Misma fórmula que public.compute_score() en el servidor */
export function computeScore(st: Pick<GameStats, 'arrows' | 'rounds' | 'perfect' | 'timeBonusMs'>): number {
  const n = st.rounds;
  return st.arrows * 10 + 50 * n + (25 * n * (n + 1)) / 2 + st.perfect * 100 + Math.floor(st.timeBonusMs / 100);
}

export const roundBonus = (round: number) => 50 + 25 * round;

export const ARROW: Record<Dir, string> = { U: '↑', D: '↓', L: '←', R: '→' };
export const codeToArrows = (code: string) => code.split('').map((c) => ARROW[c as Dir] ?? '?').join(' ');

export const CATEGORY_LABEL: Record<ProtocolCategory, string> = {
  ofensivo: 'Ofensivo', defensivo: 'Defensivo', apoyo: 'Apoyo', logistica: 'Logística',
};
export const CATEGORY_COLOR: Record<ProtocolCategory, string> = {
  ofensivo: '#EF4444', defensivo: '#3B82F6', apoyo: '#22C55E', logistica: '#EAB308',
};

/** Dificultad estimada de un desafío (para mostrar una etiqueta) */
export function estimateDifficulty(protocols: Protocol[], roundTimeS: number, rounds: number): 'Fácil' | 'Media' | 'Difícil' | 'Extrema' {
  if (protocols.length === 0) return 'Media';
  const avgLen = protocols.reduce((a, p) => a + p.code.length, 0) / protocols.length;
  const pressure = (avgLen * codesInRound(Math.min(rounds, 8))) / roundTimeS; // flechas por segundo necesarias
  if (pressure < 1.6) return 'Fácil';
  if (pressure < 2.6) return 'Media';
  if (pressure < 3.8) return 'Difícil';
  return 'Extrema';
}

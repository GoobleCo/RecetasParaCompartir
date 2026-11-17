// Tests del motor del juego. Ejecutar con:  npm test   (requiere Node 22.18+ / 24+)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { codesInRound, computeScore, gameReducer, newGame } from '../lib/game.ts';

const pool = [
  { id: 3, name: 'C', code: 'URDDL', icon: null, category: 'apoyo' },
  { id: 1, name: 'A', code: 'LRLU', icon: null, category: 'apoyo' },
  { id: 2, name: 'B', code: 'LDR', icon: null, category: 'apoyo' },
];

function playPerfect(state) {
  let s = state;
  while (s.status === 'playing' || s.status === 'roundClear') {
    if (s.status === 'roundClear') { s = gameReducer(s, { type: 'next' }); continue; }
    s = gameReducer(s, { type: 'tick', dtMs: 100 });
    if (s.status !== 'playing') break;
    s = gameReducer(s, { type: 'input', dir: s.queue[s.idx].code[s.pos] });
  }
  return s;
}

test('la misma semilla genera la misma secuencia (desafío diario justo)', () => {
  const a = newGame(pool, 12345, 10000, null);
  const b = newGame([...pool].reverse(), 12345, 10000, null);
  assert.deepEqual(a.queue.map((p) => p.id), b.queue.map((p) => p.id));
});

test('jugar perfecto un desafío de 3 rondas lo gana con 3 rondas perfectas', () => {
  const s = playPerfect(newGame(pool, 777, 10000, 3));
  assert.equal(s.status, 'won');
  assert.equal(s.stats.rounds, 3);
  assert.equal(s.stats.perfect, 3);
  assert.ok(s.stats.arrows >= s.stats.rounds * 9); // mismo control que hace el servidor
  assert.ok(s.stats.timeBonusMs <= 3 * 10000);
});

test('un error reinicia el código, suma un error y resta tiempo', () => {
  let s = newGame(pool, 1, 10000, null);
  const code = s.queue[0].code;
  s = gameReducer(s, { type: 'input', dir: code[0] });
  s = gameReducer(s, { type: 'input', dir: ['U', 'D', 'L', 'R'].find((d) => d !== code[1]) });
  assert.equal(s.pos, 0);
  assert.equal(s.stats.mistakes, 1);
  assert.equal(s.timeLeftMs, 9700);
});

test('si se acaba el tiempo termina la partida y no acepta más flechas', () => {
  let s = newGame(pool, 1, 1000, null);
  s = gameReducer(s, { type: 'tick', dtMs: 1500 });
  assert.equal(s.status, 'over');
  assert.equal(gameReducer(s, { type: 'input', dir: 'U' }), s);
});

test('la fórmula de puntaje coincide con la del servidor', () => {
  // mismo caso probado en public.compute_score: 300 flechas, 6 rondas, 2 perfectas, 20 s sobrantes
  assert.equal(computeScore({ arrows: 300, rounds: 6, perfect: 2, timeBonusMs: 20000 }), 4225);
  assert.equal(codesInRound(1), 3);
  assert.equal(codesInRound(50), 10);
});

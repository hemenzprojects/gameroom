'use strict';
// Game rules for every game in the room. A round is plain JSON stored on the team row; every change goes through here.
//   rebus  type the word or phrase a sticky note hides
//   bible  pick the right answer for an illustrated Bible scene (four choices)
//   love   the same picture quiz about love and romance; locked until an admin unlocks it for a team
const crypto = require('crypto');
const rebus = require('./puzzles');
const bible = require('./bible');
const love = require('./love');

const ROUND = 10;
const GAMES = {
  rebus: { id: 'rebus', kind: 'rebus', name: 'Rebus Board', tagline: 'Turn pictures into words', levels: rebus.LEVELS },
  bible: { id: 'bible', kind: 'quiz', name: 'Bible Quiz', tagline: 'Name the story in the picture', levels: bible.LEVELS },
  love: { id: 'love', kind: 'quiz', name: 'Love Quiz', tagline: 'Romance, couples and love songs', levels: love.LEVELS, locked: true },
};
const typeOf = g => (g && GAMES[g.type] ? g.type : 'rebus'); // rounds saved before Bible Quiz existed are rebus
const levelOf = g => GAMES[typeOf(g)].levels[g.lv];
const isQuiz = g => GAMES[typeOf(g)].kind === 'quiz';

function shuffle(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) { const k = crypto.randomInt(i + 1); [a[i], a[k]] = [a[k], a[i]]; }
  return a;
}

const puzzleAt = (g, k = g.i) => levelOf(g).pool[g.order[k]];
const answerOf = p => (Array.isArray(p.a) ? p.a[0] : p.a);
// Bible options as shown to players: [answer, ...wrong] in this round's shuffled order.
const optionsAt = (g, k = g.i) => { const p = puzzleAt(g, k); const all = [p.a, ...p.c]; return g.opts[k].map(j => all[j]); };
const correctPos = (g, k = g.i) => g.opts[k].indexOf(0);

// A stable id for each question, used to remember what a team has already seen.
const keyOf = p => (p.q ? `${p.q}|${p.a}` : answerOf(p));

// Choose a round: questions the team has never seen first, then the ones seen longest ago (random among equals),
// with at most one question per Bible picture so the same scene never shows up twice in a round.
function pickRound(pool, seen = {}) {
  const want = Math.min(ROUND, pool.length);
  const ranked = shuffle(pool.map((_, i) => i)).sort((x, y) => (seen[keyOf(pool[x])] || 0) - (seen[keyOf(pool[y])] || 0));
  const out = [], stories = new Set();
  for (const i of ranked) {
    const story = pool[i].story ?? `#${i}`;
    if (stories.has(story)) continue;
    stories.add(story); out.push(i);
    if (out.length === want) break;
  }
  for (const i of ranked) { if (out.length === want) break; if (!out.includes(i)) out.push(i); }
  return shuffle(out);
}

function make(type, lv, seen = {}) {
  const pool = GAMES[type].levels[lv].pool;
  const order = pickRound(pool, seen);
  return {
    id: crypto.randomBytes(6).toString('hex'), type, lv, order,
    seeds: order.map(() => crypto.randomInt(1e9)),
    opts: GAMES[type].kind === 'quiz' ? order.map(() => shuffle([0, 1, 2, 3])) : null,
    i: 0, status: 'play', score: 0, streak: 0, hints: 0, wrong: [], removed: [], picked: {},
    results: [], solvedBy: null, lastPts: 0, startedAt: Date.now(),
  };
}

function solve(g, by) {
  const streak = g.streak + 1;
  const misses = (g.wrong || []).length;
  const base = Math.max(25, 100 - 30 * g.hints - 25 * misses) + (streak >= 2 ? 10 * (streak - 1) : 0);
  const pts = Math.round(base * levelOf(g).mult);
  return { ...g, status: 'solved', streak, score: g.score + pts, lastPts: pts, solvedBy: by, results: [...g.results, { ok: true, by }] };
}
const reveal = (g, by) => ({ ...g, status: 'revealed', streak: 0, lastPts: 0, solvedBy: by, results: [...g.results, { ok: false, by }] });
const maxHints = g => levelOf(g).maxHints;
function hint(g) {
  const h = Math.min(maxHints(g), g.hints + 1);
  // Quiz hint 2 is a 50/50: take away two wrong answers nobody has tried yet.
  if (isQuiz(g) && h === 2) {
    const right = correctPos(g);
    const pool = [0, 1, 2, 3].filter(p => p !== right && !(g.wrong || []).includes(p));
    const already = (g.wrong || []).length;
    return { ...g, hints: h, removed: shuffle(pool).slice(0, Math.max(0, 2 - already)) };
  }
  return { ...g, hints: h };
}
const next = g => g.i + 1 >= g.order.length
  ? { ...g, status: 'done' }
  : { ...g, i: g.i + 1, status: 'play', hints: 0, wrong: [], removed: [], picked: {}, solvedBy: null, lastPts: 0 };
// Quiz games: each player gets ONE pick per question. A wrong pick is crossed out for the team and that player is
// locked out. When every online player has picked (or no wrong answers are left) the question ends as missed.
// Returns { game, ok, missed } — game is null when the pick is not allowed.
function choose(g, by, pos, onlineIds = []) {
  const picked = g.picked || {};
  if (picked[by] !== undefined) return { game: null, ok: false, missed: false, already: true };
  if ((g.wrong || []).includes(pos) || (g.removed || []).includes(pos)) return { game: null, ok: false, missed: false };
  const withPick = { ...g, picked: { ...picked, [by]: pos } };
  if (pos === correctPos(g)) return { game: solve(withPick, by), ok: true, missed: false };
  const g2 = { ...withPick, wrong: [...(g.wrong || []), pos] };
  const everyoneTried = onlineIds.length > 0 && onlineIds.every(id => g2.picked[id] !== undefined);
  const noneLeft = [0, 1, 2, 3].filter(p => p !== correctPos(g) && !g2.wrong.includes(p) && !(g2.removed || []).includes(p)).length === 0;
  if (everyoneTried || noneLeft) return { game: { ...reveal(g2, null) }, ok: false, missed: true };
  return { game: g2, ok: false, missed: false };
}

const pattern = ans => ans.split('').map((c, i, a) =>
  /[a-z0-9]/i.test(c) ? ((i === 0 || a[i - 1] === ' ') ? c.toUpperCase() : '_') : c === ' ' ? '   ' : c).join(' ');

// What players see. Answers and hints only leave the server once they are earned.
function view(g, nameOf) {
  if (!g) return null;
  const type = typeOf(g);
  const playing = g.status === 'play';
  const p = g.status === 'done' ? null : puzzleAt(g);
  const v = {
    id: g.id, type, lv: g.lv, i: g.i, total: g.order.length, status: g.status,
    score: g.score, streak: g.streak, hints: g.hints, maxHints: maxHints(g), lastPts: g.lastPts,
    solvedBy: g.solvedBy ? nameOf(g.solvedBy) : null,
    answer: p && !playing ? answerOf(p) : null,
    results: g.results.map((r, k) => ({ ok: r.ok, by: r.by ? nameOf(r.by) : null, answer: answerOf(puzzleAt(g, k)), ref: puzzleAt(g, k).ref || null })),
  };
  if (!isQuiz(g)) {
    Object.assign(v, {
      note: p ? { e: p.e, seed: g.seeds[g.i] } : null,
      hint: p && playing && g.hints >= 1 ? p.h : null,
      pattern: p && playing && g.hints >= 2 ? pattern(answerOf(p)) : null,
    });
  } else if (p) {
    Object.assign(v, {
      scene: { s: p.s, fx: p.fx, e: p.e, seed: g.seeds[g.i] },
      question: p.q,
      choices: optionsAt(g),
      wrong: g.wrong || [],
      picked: Object.keys(g.picked || {}).map(Number),
      removed: playing ? g.removed || [] : [],
      correct: playing ? null : correctPos(g),
      hint: playing && g.hints >= 1 ? p.h : null,
      ref: playing ? null : p.ref,
    });
  }
  return v;
}

module.exports = { GAMES, isQuiz, keyOf, make, solve, reveal, hint, next, choose, view, puzzleAt, answerOf, optionsAt, maxHints, typeOf, levelOf };

'use strict';
// Game Room client. The server owns all game state; this file only draws it and sends moves.
// Screens: sign in → join a team → pick a game (Rebus Board or Bible Quiz) → play.

const $ = id => document.getElementById(id);
let GAMES = [
  { id: 'rebus', name: 'Rebus Board', tagline: 'Turn pictures into words', levels: [] },
  { id: 'bible', name: 'Bible Quiz', tagline: 'Name the story in the picture', levels: [] },
  { id: 'love', name: 'Love Quiz', tagline: 'Romance, couples and love songs', levels: [], locked: true },
];
const GAME_INFO = {
  rebus: { icon: '🧩', item: 'note', items: 'notes', blurb: 'Each sticky note hides a word or phrase. Read the picture, say it out loud, type what it means.' },
  bible: { icon: '📖', item: 'question', items: 'questions', blurb: 'Each card paints a Bible story. Pick the right answer from four, then see where to read it.',
           factLabel: 'Read it: ', cover: { s: 'heaven', fx: ['light'], e: [{ k: 't', t: '📖', x: 150, y: 120, s: 84 }], seed: 11 },
           done: n => (n >= 8 ? 'Well done, good and faithful servant' : n >= 5 ? 'Nicely done' : 'Keep reading, keep playing') },
  love: { icon: '💘', item: 'question', items: 'questions', blurb: 'Famous couples, love songs, romantic films and wedding traditions. Pick the right answer from four.',
          factLabel: 'Did you know? ', cover: { s: 'rosegarden', fx: ['hearts', 'petals'], e: [{ k: 't', t: '💘', x: 150, y: 130, s: 90 }], seed: 31 },
          done: n => (n >= 8 ? 'True romantics' : n >= 5 ? 'Sweet work' : 'Love takes practice') },
};
let ME = null, TEAM = null, MEMBERS = [], GAME = null, FEED = [];
let MODE = loadMode();            // hub | rebus | bible | love | admin
let ACCESS = {};                  // locked games for my team: { love: { status: 'locked' | 'pending' | 'approved' | 'declined', requester } }
let ADMIN_PENDING = 0;            // access requests waiting for an admin
let LB = { game: 'rebus', lv: 0, rows: [] }, AUTH_MODE = 'login', ERR = '', BUSY = false, CONFIRM = null;
let MSG = { text: '', type: '' }, LASTKEY = '', socket = null, ONLINE = true;

// ---------- helpers ----------
async function api(path, body) {
  const r = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Something went wrong. Try again.');
  return j;
}
let toastT;
function toast(t) { const el = $('toast'); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (el.hidden = true), 3200); }
const initial = n => (n || '?').trim().charAt(0).toUpperCase();
function hue(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }
const avatar = (name, on) => `<span class="av"><span style="display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:hsl(${hue(name)} 55% 45%);color:#fff;font-weight:700;font-size:13px">${esc(initial(name))}</span>${on === undefined ? '' : `<i class="${on ? 'on' : ''}" title="${on ? 'Online' : 'Away'}"></i>`}</span>`;
function loadMode() { try { const m = localStorage.getItem('rebus-mode'); return ['hub', 'rebus', 'bible', 'love', 'admin'].includes(m) ? m : 'hub'; } catch { return 'hub'; } }
function setMode(m) {
  MODE = m; CONFIRM = null;
  try { localStorage.setItem('rebus-mode', m); } catch {}
  if (m === 'admin') Admin.start(); else Admin.stop();
  if (m !== 'hub' && m !== 'admin' && LB.game !== m) { LB = { game: m, lv: 0, rows: [] }; loadLeaderboard(); }
  render(); scrollTo({ top: 0 });
}
const gameDef = id => GAMES.find(g => g.id === id) || GAMES[0];
const levelsOf = id => gameDef(id).levels;
const isQuizType = t => t === 'bible' || t === 'love';
const unlocked = id => !gameDef(id).locked || (ACCESS[id] && ACCESS[id].status === 'approved');
const article = w => (/^[AEIOU]/i.test(w) ? 'an' : 'a');

// ---------- data ----------
async function init() {
  try { GAMES = await api('/api/games'); } catch {}
  const r = await api('/api/me').catch(() => ({ user: null }));
  ME = r.user; TEAM = r.team;
  if (ME) connect();
  if (MODE === 'admin') { if (ME && ME.role === 'admin') Admin.start(); else MODE = 'hub'; }
  if (ME && ME.role === 'admin' && MODE !== 'admin') Admin.peek();
  LB.game = MODE === 'hub' || MODE === 'admin' ? 'rebus' : MODE;
  loadLeaderboard();
  render();
}
function connect() {
  if (socket) { socket.disconnect(); socket.connect(); return; }
  socket = io({ transports: ['websocket', 'polling'] });
  Chat.attach(socket);
  socket.on('connect', () => { ONLINE = true; render(); });
  socket.on('disconnect', reason => {
    if (reason === 'io server disconnect') { refreshMe(); return; } // moved team: rejoin the new room
    ONLINE = false; render();
  });
  socket.on('connect_error', () => { ONLINE = false; render(); });
  socket.on('state', s => {
    const before = GAME && GAME.id;
    const wasOpen = MODE !== 'hub' && MODE !== 'admin' && unlocked(MODE);
    TEAM = s.team; MEMBERS = s.members; GAME = s.game; ACCESS = s.access || {};
    if (wasOpen && !unlocked(MODE)) { toast(`${gameDef(MODE).name} has been locked for your team.`); MODE = 'hub'; }
    // A teammate started a new round: follow them into that game.
    if (GAME && before && GAME.id !== before && MODE !== 'hub' && MODE !== GAME.type && GAME.status === 'play') { MODE = GAME.type; LB = { game: MODE, lv: 0, rows: [] }; loadLeaderboard(); }
    render();
  });
  socket.on('wrong', ({ text }) => {
    MSG = { text: `"${text}" is not it. Try again or take a hint.`, type: 'no' };
    const m = $('msg'); if (m) { m.textContent = MSG.text; m.className = 'msg no'; }
    const f = $('guess'); if (f) { f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake'); f.select(); }
  });
  socket.on('guess', f => { FEED.unshift(f); FEED = FEED.slice(0, 8); render(); });
  socket.on('suspended', () => {
    ME = TEAM = GAME = null; MEMBERS = []; MODE = 'hub'; Admin.stop();
    socket.disconnect(); socket = null;
    ERR = 'Your account has been suspended. Talk to your admin to get it restored.'; render();
  });
  socket.on('locked', ({ game }) => toast(`${gameDef(game).name} is locked for your team. Ask an admin to unlock it.`));
  socket.on('admin:request', r => {
    ADMIN_PENDING++; toast(`🔒 ${r.by} (${r.team}) asked to unlock ${r.game}. Open Admin to approve.`);
    if (MODE === 'admin') Admin.refresh(); else render();
  });
  socket.on('pick:locked', () => toast('You have already used your pick for this question.'));
  socket.on('moved', refreshMe);
  socket.on('scores', loadLeaderboard);
}
async function refreshMe() {
  const r = await api('/api/me').catch(() => null);
  if (!r) return;
  ME = r.user; TEAM = r.team; GAME = null; MEMBERS = []; FEED = [];
  if (!ME) { socket && socket.disconnect(); render(); return; }
  if (socket) socket.connect();
  render();
}
async function loadLeaderboard() {
  try { const r = await api(`/api/leaderboard?game=${LB.game}&lv=${LB.lv}`); if (r.game === LB.game && r.lv === LB.lv) LB = r; render(); } catch {}
}
function send(ev, data) {
  if (!socket || !socket.connected) { toast('You are offline. Reconnecting…'); return; }
  socket.emit(ev, data);
}

// ---------- shared pieces ----------
function levelTabs(type) {
  const L = levelsOf(type), active = GAME && GAME.type === type ? GAME.lv : -1;
  return `<div class="ladder" role="group" aria-label="Choose a level to start a round">${L.map((l, i) =>
    `<button class="rung${i === L.length - 1 ? ' legend' : ''}" data-lv="${i}" aria-pressed="${active === i}">
      <span class="lbl">Level ${i + 1}</span>
      <b>${esc(l.name)}</b>
      <span class="pips" aria-label="Difficulty ${i + 1} of ${L.length}">${L.map((_, k) => `<i class="${k <= i ? 'on' : ''}"></i>`).join('')}</span>
      <small>${esc(l.blurb)}</small>
      <span class="mult">×${l.mult} points</span>
    </button>`).join('')}</div>
  ${CONFIRM != null ? `<div class="confirm"><span>Start ${article(L[CONFIRM].name)} <b>${esc(L[CONFIRM].name)}</b> round of ${esc(gameDef(type).name)} for the whole team? The current round ends.</span>
    <button class="btn primary small" data-go="${CONFIRM}">Start round</button><button class="btn small ghost" data-cancel>Keep playing</button></div>` : ''}`;
}
function roundInProgress() { const g = GAME; return g && g.status !== 'done' && (g.i > 0 || g.status !== 'play' || g.hints > 0 || (g.wrong || []).length > 0); }
function stats(g) {
  const info = GAME_INFO[g.type];
  return `<div class="stats">
      <div class="stat"><small class="lbl">${info.item[0].toUpperCase() + info.item.slice(1)}</small><b>${g.i + 1}<span class="muted" style="font-size:18px"> / ${g.total}</span></b></div>
      <div class="stat"><small class="lbl">Team score</small><b>${g.score}</b></div>
      <div class="stat"><small class="lbl">Streak</small><b>${g.streak}</b></div>
      <div class="stat"><small class="lbl">Level</small><b>${esc(levelsOf(g.type)[g.lv].name)}</b></div>
    </div>
    <div class="dots" aria-hidden="true">${Array.from({ length: g.total }, (_, k) => { const r = g.results[k]; return `<span class="dot ${r ? (r.ok ? 'ok' : 'no') : k === g.i ? 'now' : ''}"></span>`; }).join('')}</div>`;
}
function statusMsg(g) {
  const who = g.solvedBy === ME.name ? 'You' : g.solvedBy || 'Someone';
  if (g.status === 'solved') return { text: `${who} ${isQuizType(g.type) ? 'got it' : 'solved it'}! +${g.lastPts}${g.streak >= 2 ? ` (streak ×${g.streak})` : ''}`, type: 'ok' };
  if (g.status === 'revealed' && !g.solvedBy) return { text: 'Nobody got this one. The answer is on the card.', type: 'no' };
  if (g.status === 'revealed') return { text: who === 'You' ? `The answer is on the ${GAME_INFO[g.type].item === 'note' ? 'note' : 'card'}.` : `${who} gave up on this one.`, type: 'no' };
  return MSG;
}
function feedHTML(g) {
  const feed = FEED.filter(f => f.gid === g.id && f.i === g.i).slice(0, 5);
  return `<div><small class="lbl">Teammates' wrong answers</small>${feed.length
    ? `<ul class="feed">${feed.map(f => `<li>${avatar(f.name)}<span>${esc(f.name)}: “${esc(f.text)}”</span><span class="x">✗</span></li>`).join('')}</ul>`
    : `<p class="muted" style="font-size:14px">Wrong answers from your team show up here.</p>`}</div>`;
}
function hintRow(g) {
  const out = g.hints >= g.maxHints;
  const label = out ? 'No more hints' : g.hints === 0 ? 'Hint (−30%)' : isQuizType(g.type) ? '50/50 (−30%)' : 'Show letters (−30%)';
  return `<div class="row"><button class="btn" id="hint" ${out ? 'disabled' : ''}>${label}</button><button class="btn" id="reveal">Give up</button></div>`;
}
function summaryHTML(g) {
  const n = g.results.filter(r => r.ok).length, L = levelsOf(g.type), bible = isQuizType(g.type);
  return `<div class="summary"><h2>${esc(L[g.lv].name)} finished with ${g.score} points</h2>
    <p class="muted">${n} of ${g.results.length} ${bible ? 'right' : 'solved'}. This round is on the leaderboard.</p>
    <ol>${g.results.map(r => `<li class="${r.ok ? '' : 'no'}"><span class="ans">${esc(r.answer)}</span>${r.ref ? ` <span class="ref">${esc(r.ref)}</span>` : ''}${r.ok && r.by ? ` <span class="muted">· ${esc(r.by === ME.name ? 'you' : r.by)}</span>` : ''}</li>`).join('')}</ol>
    <div class="row"><button class="btn primary" data-go="${g.lv}">Play again</button>${g.lv < L.length - 1 ? `<button class="btn" data-go="${g.lv + 1}">Try ${esc(L[g.lv + 1].name)}</button>` : ''}</div></div>`;
}

// ---------- Rebus Board ----------
function bigNote(lines, bg) {
  return `<div class="note" style="background:${bg};transform:rotate(-2deg)"><svg viewBox="0 0 300 300" role="img" aria-label="${esc(lines.join(' '))}">${lines.map((t, k) =>
    `<text x="150" y="${150 + (k - (lines.length - 1) / 2) * 58}" font-size="${k === 0 && lines.length > 1 && /\d/.test(t) ? 64 : 38}" font-family='Kalam,cursive' font-weight="700" text-anchor="middle" dominant-baseline="central" fill="#1C2230">${esc(t)}</text>`).join('')}</svg></div>`;
}
function rebusStage(g) {
  if (!g) return bigNote(['Pick a level', 'to start ↗'], NOTES[0]);
  if (g.status === 'done') { const n = g.results.filter(r => r.ok).length; return bigNote([`${n} / ${g.results.length}`, n >= 8 ? 'Rebus royalty' : n >= 5 ? 'Nicely done' : 'Keep at it'], NOTES[0]); }
  const d = drawNote(g.note, g.note.seed);
  return `<div class="note" style="background:${d.bg};transform:rotate(${d.tilt.toFixed(1)}deg)">${d.svg}${g.answer ? `<div class="stamp ${g.status === 'solved' ? '' : 'miss'}">${esc(g.answer)}</div>` : ''}</div>`;
}
function rebusPanel(g) {
  if (!g) return `<div class="summary"><h2>Ready when you are</h2><p class="muted">Pick a level above. Everyone on the team gets the same 10 notes, and anyone can guess.</p></div>`;
  if (g.status === 'done') return summaryHTML(g);
  const done = g.status !== 'play', msg = statusMsg(g);
  return `${stats(g)}
    <form class="guess" id="gform" autocomplete="off">
      <label for="guess" class="sr">Your answer</label>
      <input id="guess" placeholder="Type the word or phrase" ${done ? 'disabled' : ''} autocapitalize="off" spellcheck="false" maxlength="80">
      ${done ? `<button type="button" class="btn primary" id="next">${g.i + 1 < g.total ? 'Next note' : 'See results'}</button>` : `<button class="btn primary" type="submit">Guess</button>`}
    </form>
    <p class="msg ${msg.type}" id="msg">${esc(msg.text)}</p>
    ${g.hint ? `<p class="hint">${esc(g.hint)}${g.pattern ? `<span class="pattern">${esc(g.pattern)}</span>` : ''}</p>` : ''}
    ${done ? '' : hintRow(g)}
    ${feedHTML(g)}`;
}

// ---------- picture quizzes (Bible Quiz, Love Quiz) ----------
function bigCard(type, title, sub) {
  const sc = drawScene(GAME_INFO[type].cover);
  return `<figure class="scroll"><div class="art">${sc}</div><figcaption><b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</figcaption></figure>`;
}
function quizStage(type, g) {
  if (!g) return bigCard(type, 'Pick a level to start ↗', 'Ten illustrated questions per round');
  if (g.status === 'done') { const n = g.results.filter(r => r.ok).length; return bigCard(type, `${n} / ${g.results.length} right`, GAME_INFO[type].done(n)); }
  const after = g.status !== 'play';
  return `<figure class="scroll"><div class="art">${drawScene(g.scene)}</div>
    <figcaption>${after ? `<b>${esc(g.answer)}</b>${g.ref ? `<span>${esc(GAME_INFO[type].factLabel + g.ref)}</span>` : ''}` : `<b>${esc(levelsOf(type)[g.lv].name)} · Question ${g.i + 1}</b><span>Look closely at the picture</span>`}</figcaption></figure>`;
}
function quizPanel(g) {
  if (!g) return `<div class="summary"><h2>Ready when you are</h2><p class="muted">Pick a level above. Everyone on the team sees the same 10 pictures. Each person gets one pick per question. The first right answer wins the points, and a wrong pick is crossed out for the rest of the team.</p></div>`;
  if (g.status === 'done') return summaryHTML(g);
  const done = g.status !== 'play', used = !done && g.picked.includes(ME.id);
  const letters = 'ABCD';
  let msg = statusMsg(g);
  if (used) msg = { text: 'Not that one. You have used your pick, so it is up to your teammates now.', type: 'no' };
  return `${stats(g)}
    <h2 class="question">${esc(g.question)}</h2>
    <div class="choices${used ? ' locked' : ''}" role="group" aria-label="Answers">${g.choices.map((c, k) => {
      const wrong = g.wrong.includes(k), gone = g.removed.includes(k), right = g.correct === k;
      const cls = right ? 'right' : wrong ? 'wrong' : gone ? 'gone' : '';
      return `<button class="choice ${cls}" data-choice="${k}" ${done || used || wrong || gone ? 'disabled' : ''}><span class="key">${letters[k]}</span><span class="txt">${esc(c)}</span>${right ? '<span class="mark">✓</span>' : wrong ? '<span class="mark">✗</span>' : ''}</button>`;
    }).join('')}</div>
    ${!done && !used && !msg.text ? '<p class="muted pickrule">One pick each. Choose carefully.</p>' : ''}
    <p class="msg ${msg.type}" id="msg">${esc(msg.text)}</p>
    ${g.hint ? `<p class="hint">${esc(g.hint)}</p>` : ''}
    ${done ? `<div class="row"><button type="button" class="btn primary" id="next">${g.i + 1 < g.total ? 'Next question' : 'See results'}</button></div>` : hintRow(g)}
    ${feedHTML(g)}`;
}

// ---------- screens ----------
function leaderboardHTML() {
  const L = levelsOf(LB.game), rows = LB.rows || [];
  const body = rows.length
    ? `<div style="overflow-x:auto"><table><thead><tr><th></th><th>Team</th><th class="n">Right</th><th class="n">Points</th></tr></thead><tbody>${rows.map((r, i) =>
        `<tr class="${TEAM && r.team_id === TEAM.id ? 'mine' : ''}"><td class="rank">${i + 1}</td><td class="tname">${esc(r.team_name)}</td><td class="n">${r.correct}/${r.total}</td><td class="n">${r.score}</td></tr>`).join('')}</tbody></table></div>`
    : `<p class="muted">No ${esc((L[LB.lv] || {}).name || '')} rounds finished yet. Finish one with your team to take the top spot.</p>`;
  return `<section class="card lb"><div class="row" style="justify-content:space-between"><h3>${esc(gameDef(LB.game).name)} leaderboard</h3>
    <div class="seg" role="group" aria-label="Leaderboard level">${L.map((l, i) => `<button data-lb="${i}" aria-pressed="${i === LB.lv}">${esc(l.name)}</button>`).join('')}</div></div>${body}</section>`;
}
function previews() {
  const note = drawNote({ e: [{ k: 't', t: 'T', x: 72, y: 150, s: 66 }, { k: 't', t: '+', x: 150, y: 146, s: 44 }, { k: 't', t: '🌧️', x: 228, y: 150, s: 76 }] }, 7);
  const scene = drawScene({ s: 'sea', fx: ['waves', 'clouds', 'sun'], e: [{ k: 't', t: '🐋', x: 165, y: 200, s: 116 }, { k: 't', t: '🧔', x: 78, y: 168, s: 38 }], seed: 23 });
  const love = drawScene({ s: 'sunset', fx: ['hearts', 'sparkle'], e: [{ k: 't', t: '👫', x: 150, y: 196, s: 74 }, { k: 't', t: '💘', x: 150, y: 96, s: 54 }], seed: 41 });
  return { note: `<div class="note" style="background:${note.bg};transform:rotate(-3deg)">${note.svg}</div>`, scene: `<div class="scroll mini"><div class="art">${scene}</div></div>`,
           love: `<div class="scroll mini"><div class="art">${love}</div></div>` };
}
function introHTML() {
  const p = previews();
  return `<section class="intro two"><div class="duo">${p.note}${p.scene}</div>
    <div style="display:grid;gap:10px"><h2>Game night for your team</h2>
    <p class="muted">Solve picture puzzles and quizzes together. Make a team, share the code, and everyone sees the same picture at the same time. The first person to crack it scores the points.</p></div></section>`;
}
function renderAuth() {
  const reg = AUTH_MODE === 'register';
  return `<div class="home"><div class="homeleft">${introHTML()}
    <section class="card auth">
      <div class="tabs" role="group" aria-label="Account"><button data-mode="login" aria-pressed="${!reg}">Log in</button><button data-mode="register" aria-pressed="${reg}">Create account</button></div>
      <form id="authF" autocomplete="on">
        <div><label class="lbl" for="aname">Your name</label><input id="aname" name="username" autocomplete="username" maxlength="24" placeholder="e.g. Ama Mensah" required ${BUSY ? 'disabled' : ''}></div>
        <div><label class="lbl" for="apass">Password</label><input id="apass" name="password" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}" minlength="6" required ${BUSY ? 'disabled' : ''}></div>
        ${ERR ? `<p class="msg no">${esc(ERR)}</p>` : ''}
        <button class="btn primary" ${BUSY ? 'disabled' : ''}>${reg ? 'Create account' : 'Log in'}</button>
        ${reg ? '<p class="muted" style="font-size:14px">Your colleagues see this name on the team and the leaderboard.</p>' : ''}
      </form>
    </section></div>${leaderboardHTML()}</div>`;
}
function renderLobby() {
  return `<div class="home"><div class="homeleft">${introHTML()}
    <section class="card"><h3>Join a team to play</h3>
      <form id="createF" autocomplete="off"><label class="lbl" for="tname">Start a new team</label>
        <div class="row"><input id="tname" maxlength="32" placeholder="Team name, e.g. Finance Foxes" ${BUSY ? 'disabled' : ''}><button class="btn primary" ${BUSY ? 'disabled' : ''}>Create team</button></div></form>
      <div class="or">or</div>
      <form id="joinF" autocomplete="off"><label class="lbl" for="tcode">Join a colleague's team</label>
        <div class="row"><input id="tcode" maxlength="5" placeholder="5-character code" style="text-transform:uppercase;letter-spacing:.1em" ${BUSY ? 'disabled' : ''}><button class="btn" ${BUSY ? 'disabled' : ''}>Join team</button></div></form>
      ${ERR ? `<p class="msg no">${esc(ERR)}</p>` : ''}
    </section></div>${leaderboardHTML()}</div>`;
}
function teamCard() {
  const online = MEMBERS.filter(m => m.online).length;
  return `${ONLINE ? '' : '<p class="offline">Connection lost. Reconnecting…</p>'}
    <section class="card"><div class="teambar">
      <div class="grow"><small class="lbl">Team · ${online} of ${MEMBERS.length} online</small><h2>${esc(TEAM.name)}</h2></div>
      <div class="code"><small class="lbl">Invite code</small><div class="row"><b id="codeText">${esc(TEAM.code)}</b><button class="btn small" id="copy">Copy</button></div></div>
    </div>
    <ul class="members">${MEMBERS.map(m => `<li class="chip">${avatar(m.name, m.online)}<span>${esc(m.id === ME.id ? m.name + ' (you)' : m.name)}</span><b>${m.points}</b></li>`).join('')}</ul></section>`;
}
function renderHub() {
  const p = previews();
  const card = (id, art) => {
    const def = gameDef(id), info = GAME_INFO[id], live = GAME && GAME.type === id && GAME.status !== 'done';
    if (!unlocked(id)) return lockedCard(id, art);
    return `<button class="gamecard ${id}" data-open="${id}">
      <div class="gc-art">${art}</div>
      <div class="gc-body">
        ${live ? `<span class="live"><i></i>Your team is playing · ${esc(levelsOf(id)[GAME.lv].name)} · ${GAME.i + 1}/${GAME.total}</span>` : ''}
        <h2>${info.icon} ${esc(def.name)}</h2>
        <p class="muted">${esc(info.blurb)}</p>
        <div class="gc-levels">${def.levels.map((l, i) => `<span class="${i === def.levels.length - 1 ? 'legend' : ''}">${esc(l.name)}</span>`).join('')}</div>
        <span class="btn primary gc-cta">${live ? 'Join the round' : 'Play'} →</span>
      </div></button>`;
  };
  return `<div style="display:grid;gap:20px">${teamCard()}
    <div><h2 style="margin-bottom:4px">Pick a game</h2><p class="muted">Everyone on your team plays the same round. Switch games any time.</p></div>
    <div class="hub">${card('rebus', p.note)}${card('bible', p.scene)}${card('love', p.love)}</div></div>`;
}
// A game that needs an admin's OK: shows a padlock and the team's request status.
function lockedCard(id, art) {
  const def = gameDef(id), info = GAME_INFO[id], a = ACCESS[id] || { status: 'locked' };
  const action = a.status === 'pending'
    ? `<p class="lockstate"><b>Request sent${a.requester ? ` by ${esc(a.requester === ME.name ? 'you' : a.requester)}` : ''}.</b> Waiting for an admin to unlock it.</p>`
    : `${a.status === 'declined' ? '<p class="lockstate">Your last request was declined. You can ask again.</p>' : ''}
       <button class="btn primary gc-cta" data-request="${id}">🔑 Request access</button>`;
  return `<div class="gamecard ${id} locked">
      <div class="gc-art">${art}<span class="padlock" aria-hidden="true">🔒</span></div>
      <div class="gc-body">
        <span class="lockpill">🔒 Locked${a.status === 'pending' ? ' · request pending' : ''}</span>
        <h2>${info.icon} ${esc(def.name)}</h2>
        <p class="muted">${esc(info.blurb)} An admin unlocks it for your team.</p>
        <div class="gc-levels">${def.levels.map((l, i) => `<span class="${i === def.levels.length - 1 ? 'legend' : ''}">${esc(l.name)}</span>`).join('')}</div>
        ${action}
      </div></div>`;
}
function renderGame() {
  const g = GAME && GAME.type === MODE ? GAME : null;
  const other = GAME && GAME.type !== MODE && GAME.status !== 'done' ? GAME : null;
  const stage = isQuizType(MODE) ? quizStage(MODE, g) : rebusStage(g);
  const panel = other
    ? `<div class="summary"><h2>Your team is in a ${esc(gameDef(other.type).name)} round</h2>
        <p class="muted">${esc(levelsOf(other.type)[other.lv].name)}, ${GAME_INFO[other.type].item} ${other.i + 1} of ${other.total}. Starting a ${esc(gameDef(MODE).name)} round here ends it for everyone.</p>
        <div class="row"><button class="btn primary" data-open="${other.type}">Join that round</button></div></div>`
    : isQuizType(MODE) ? quizPanel(g) : rebusPanel(g);
  return `<div style="display:grid;gap:20px">${teamCard()}
    ${levelTabs(MODE)}
    <div class="game"><div class="stage">${stage}</div><section class="panel" aria-live="polite">${panel}</section></div>
    ${leaderboardHTML()}</div>`;
}
const RULES = {
  rebus: 'Scoring: 100 points for a solve, minus 30% for each hint, plus a streak bonus for solving two or more in a row. Harder levels multiply the points, up to ×3 on Legend, where each note allows only one hint.',
  love: 'One pick per person per question. A wrong pick is crossed out for your team and costs 25%; if everyone online misses, the question is lost. Hints cost 30% and hint 2 is a 50/50. Streaks earn a bonus, and harder levels multiply the points, up to ×3 on Legend.',
  bible: 'One pick per person per question. A wrong pick is crossed out for your team and costs 25%; if everyone online misses, the question is lost. Hints cost 30% and hint 2 is a 50/50. Streaks earn a bonus, and harder levels multiply the points, up to ×3 on Legend.',
  hub: 'Pick a game, pick a level, and play together. Points for each answer go to whoever gets it first, and every finished round goes on that game’s leaderboard.',
};
function render() {
  const keep = {}; document.querySelectorAll('#app input[id]').forEach(i => (keep[i.id] = i.value));
  const fid = document.activeElement && document.activeElement.id;
  const key = GAME ? `${GAME.id}:${GAME.i}:${GAME.status}` : '';
  const changed = key !== LASTKEY;
  if (changed) { delete keep.guess; MSG = { text: '', type: '' }; LASTKEY = key; }
  if (MODE === 'admin' && !(ME && ME.role === 'admin')) MODE = 'hub';
  if (MODE !== 'hub' && MODE !== 'admin' && TEAM && !unlocked(MODE)) MODE = 'hub';
  const isAdminView = ME && MODE === 'admin';
  const inGame = ME && TEAM && MODE !== 'hub' && !isAdminView;
  document.body.dataset.game = inGame ? MODE : 'hub';
  $('brand').innerHTML = isAdminView ? 'Game <span>Room</span> <small class="adminbadge">Admin</small>' : inGame && MODE === 'bible' ? 'Bible <span>Quiz</span>' : inGame && MODE === 'love' ? 'Love <span>Quiz</span>' : inGame ? 'Rebus <span>Board</span>' : 'Game <span>Room</span>';
  document.title = isAdminView ? 'Admin · Game Room' : inGame ? gameDef(MODE).name : 'Game Room';
  const adminBtn = ME && ME.role === 'admin' ? (isAdminView ? '<button class="btn small" id="toHub">← Back to games</button>' : `<button class="btn small" id="toAdmin">Admin${ADMIN_PENDING ? ` <span class="nbadge" title="Access requests waiting">${ADMIN_PENDING}</span>` : ''}</button>`) : '';
  $('hdr').innerHTML = ME ? `${inGame ? '<button class="btn small" id="toHub">← All games</button>' : ''}${adminBtn}<span class="who">${avatar(ME.name)}${esc(ME.name)}</span>${TEAM && !isAdminView ? '<button class="btn small ghost" id="leave">Leave team</button>' : ''}<button class="btn small ghost" id="logout">Log out</button>` : '';
  $('rules').textContent = isAdminView ? 'Suspended people are logged out straight away and cannot log in until an admin restores them. Their scores and chat messages stay.' : RULES[inGame ? MODE : 'hub'];
  $('app').innerHTML = !ME ? renderAuth() : isAdminView ? Admin.html() : !TEAM ? renderLobby() : MODE === 'hub' ? renderHub() : renderGame();
  Chat.update({ me: ME, team: TEAM, members: MEMBERS });
  for (const id in keep) { const el = $(id); if (el && !el.disabled && id !== 'apass') el.value = keep[id]; }
  if (fid) {
    const el = $(fid);
    if (el && !el.disabled) el.focus();
    else if (changed && (fid === 'guess' || fid === 'next')) { const g = $('guess'); (g && !g.disabled ? g : $('next'))?.focus(); }
  }
}

// ---------- events ----------
async function withBusy(fn) {
  BUSY = true; ERR = ''; render();
  try { await fn(); } catch (e) { ERR = e.message; }
  BUSY = false; render();
}
document.addEventListener('submit', e => {
  const id = e.target.id;
  if (!['gform', 'authF', 'createF', 'joinF'].includes(id)) return;
  e.preventDefault();
  if (id === 'gform') {
    const text = $('guess').value.trim();
    if (text && GAME) send('guess', { text, i: GAME.i });
  } else if (id === 'authF') {
    const name = $('aname').value, password = $('apass').value;
    withBusy(async () => {
      const r = await api(AUTH_MODE === 'register' ? '/api/register' : '/api/login', { name, password });
      ME = r.user; TEAM = r.team; MODE = 'hub'; connect();
    });
  } else if (id === 'createF') {
    const name = $('tname').value;
    withBusy(async () => { const r = await api('/api/teams', { name }); TEAM = r.team; GAME = null; MODE = 'hub'; toast(`Team created. Share the code ${r.team.code} with your colleagues.`); });
  } else if (id === 'joinF') {
    const code = $('tcode').value;
    withBusy(async () => { const r = await api('/api/teams/join', { code }); TEAM = r.team; GAME = null; MODE = 'hub'; });
  }
});
document.addEventListener('click', async e => {
  const t = e.target.closest('button'); if (!t || t.closest('#chatDock')) return;
  if (t.dataset.adm) { Admin.click(t); return; }
  if (t.dataset.mode) { AUTH_MODE = t.dataset.mode; ERR = ''; render(); return; }
  if (t.dataset.open) { if (unlocked(t.dataset.open)) setMode(t.dataset.open); return; }
  if (t.dataset.request) {
    t.disabled = true;
    api('/api/access/request', { game: t.dataset.request })
      .then(r => { ACCESS[t.dataset.request] = { status: r.status, requester: ME.name }; toast(r.status === 'approved' ? 'Already unlocked. Have fun!' : 'Request sent. An admin will unlock it for your team.'); render(); })
      .catch(err => { toast(err.message); t.disabled = false; });
    return;
  }
  if (t.dataset.lb != null) { LB.lv = +t.dataset.lb; LB.rows = []; render(); loadLeaderboard(); return; }
  if (t.dataset.lv != null) {
    const lv = +t.dataset.lv;
    if (roundInProgress()) { CONFIRM = lv; render(); } else send('start', { game: MODE, lv });
    return;
  }
  if (t.dataset.go != null) { CONFIRM = null; send('start', { game: MODE, lv: +t.dataset.go }); return; }
  if (t.dataset.cancel != null) { CONFIRM = null; render(); return; }
  if (t.dataset.choice != null && GAME) { send('choose', { i: GAME.i, pos: +t.dataset.choice }); return; }
  const g = GAME;
  switch (t.id) {
    case 'toHub': setMode('hub'); break;
    case 'toAdmin': setMode('admin'); break;
    case 'hint': if (g) send('hint', { i: g.i }); break;
    case 'reveal': if (g) send('reveal', { i: g.i }); break;
    case 'next': if (g) send('next', { i: g.i }); break;
    case 'leave': await api('/api/teams/leave', {}).catch(err => toast(err.message)); TEAM = null; GAME = null; MEMBERS = []; render(); break;
    case 'logout': await api('/api/logout', {}).catch(() => {}); socket && socket.disconnect(); socket = null; ME = TEAM = GAME = null; MEMBERS = []; MODE = 'hub'; Admin.stop(); render(); break;
    case 'copy': navigator.clipboard.writeText(TEAM.code).then(() => toast('Code copied. Send it to your colleagues.'), () => {
      const r = document.createRange(); r.selectNodeContents($('codeText')); getSelection().removeAllRanges(); getSelection().addRange(r); }); break;
  }
});
document.addEventListener('input', e => { if (e.target.id === 'admSearch') Admin.search(); });
document.addEventListener('keydown', e => {
  const g = GAME, a = document.activeElement;
  if (!g || MODE !== g.type || a?.closest?.('#chatDock')) return;
  if (e.key === 'Enter' && (g.status === 'solved' || g.status === 'revealed') && a?.id !== 'next' && a?.tagName !== 'INPUT') { e.preventDefault(); send('next', { i: g.i }); return; }
  // Bible Quiz: press A–D (or 1–4) to answer
  if (isQuizType(g.type) && g.status === 'play' && a?.tagName !== 'INPUT' && !e.metaKey && !e.ctrlKey) {
    const k = 'abcd'.indexOf(e.key.toLowerCase()), n = '1234'.indexOf(e.key), pos = k >= 0 ? k : n;
    if (pos >= 0 && !g.picked.includes(ME.id) && !g.wrong.includes(pos) && !g.removed.includes(pos)) send('choose', { i: g.i, pos });
  }
});

init();

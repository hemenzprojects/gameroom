'use strict';
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const { Server } = require('socket.io');

const db = require('./db');
const G = require('./game');
const { matches } = require('./puzzles');
const { hashPassword, verifyPassword, parseCookies, tooManyAttempts } = require('./auth');

const PORT = Number(process.env.PORT) || 4100;
const COOKIE = 'rebus_sid';
const SESSION_DAYS = 30;
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
// Accounts named here are made admins on start-up and when they sign up, e.g. ADMIN_NAMES="Michael,Ama".
const ADMIN_NAMES = String(process.env.ADMIN_NAMES || '').split(',').map(n => n.trim().toLowerCase()).filter(Boolean);

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// ---------- queries ----------
const q = {
  userById: db.prepare('SELECT id, name, team_id, points, role, suspended_at FROM users WHERE id = ?'),
  userByName: db.prepare('SELECT * FROM users WHERE name = ?'),
  insertUser: db.prepare('INSERT INTO users (name, pass, created_at) VALUES (?, ?, ?)'),
  session: db.prepare(`SELECT u.id, u.name, u.team_id, u.points, u.role, u.suspended_at, s.created_at
                       FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`),
  insertSession: db.prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)'),
  deleteSession: db.prepare('DELETE FROM sessions WHERE token = ?'),
  teamById: db.prepare('SELECT * FROM teams WHERE id = ?'),
  teamByCode: db.prepare('SELECT * FROM teams WHERE code = ?'),
  insertTeam: db.prepare('INSERT INTO teams (name, code, created_at) VALUES (?, ?, ?)'),
  saveGame: db.prepare('UPDATE teams SET game = ? WHERE id = ?'),
  saveSeen: db.prepare('UPDATE teams SET seen = ? WHERE id = ?'),
  setTeam: db.prepare('UPDATE users SET team_id = ?, points = 0 WHERE id = ?'),
  addPoints: db.prepare('UPDATE users SET points = points + ? WHERE id = ?'),
  members: db.prepare('SELECT id, name, points FROM users WHERE team_id = ? AND suspended_at IS NULL ORDER BY points DESC, name'),
  touch: db.prepare('UPDATE users SET last_seen = ? WHERE id = ?'),
  makeAdmin: db.prepare("UPDATE users SET role = 'admin' WHERE name = ?"),
  setRole: db.prepare('UPDATE users SET role = ? WHERE id = ?'),
  suspend: db.prepare('UPDATE users SET suspended_at = ?, suspended_reason = ? WHERE id = ?'),
  restore: db.prepare('UPDATE users SET suspended_at = NULL, suspended_reason = NULL WHERE id = ?'),
  dropSessions: db.prepare('DELETE FROM sessions WHERE user_id = ?'),
  adminUsers: db.prepare(`SELECT u.id, u.name, u.role, u.points, u.created_at, u.last_seen, u.suspended_at, u.suspended_reason,
                                 t.id AS team_id, t.name AS team_name
                          FROM users u LEFT JOIN teams t ON t.id = u.team_id ORDER BY u.created_at DESC`),
  adminTeams: db.prepare(`SELECT t.id, t.name, t.code, t.created_at, t.game,
                                 (SELECT COUNT(*) FROM users WHERE team_id = t.id AND suspended_at IS NULL) AS members,
                                 (SELECT COUNT(*) FROM scores WHERE team_id = t.id) AS rounds
                          FROM teams t ORDER BY t.created_at DESC`),
  roundsByGame: db.prepare('SELECT game, COUNT(*) AS n FROM scores GROUP BY game'),
  chatCount: db.prepare("SELECT COUNT(*) AS n FROM chat WHERE kind = 'msg'"),
  accessFor: db.prepare(`SELECT a.game, a.status, a.requested_at, u.name AS requester
                         FROM game_access a LEFT JOIN users u ON u.id = a.requested_by WHERE a.team_id = ?`),
  accessRequest: db.prepare(`INSERT INTO game_access (team_id, game, status, requested_by, requested_at) VALUES (?, ?, 'pending', ?, ?)
                             ON CONFLICT (team_id, game) DO UPDATE SET status = 'pending', requested_by = excluded.requested_by,
                             requested_at = excluded.requested_at, decided_by = NULL, decided_at = NULL`),
  accessDecide: db.prepare(`INSERT INTO game_access (team_id, game, status, decided_by, decided_at) VALUES (?, ?, ?, ?, ?)
                            ON CONFLICT (team_id, game) DO UPDATE SET status = excluded.status, decided_by = excluded.decided_by,
                            decided_at = excluded.decided_at`),
  accessAll: db.prepare(`SELECT a.team_id, a.game, a.status, a.requested_at, a.decided_at, t.name AS team_name,
                                ru.name AS requester, du.name AS decider
                         FROM game_access a JOIN teams t ON t.id = a.team_id
                         LEFT JOIN users ru ON ru.id = a.requested_by LEFT JOIN users du ON du.id = a.decided_by
                         ORDER BY (a.status = 'pending') DESC, COALESCE(a.requested_at, a.decided_at) DESC`),
  clearGame: db.prepare('UPDATE teams SET game = NULL WHERE id = ?'),
  adminCount: db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND suspended_at IS NULL"),
  nameById: db.prepare('SELECT name FROM users WHERE id = ?'),
  insertScore: db.prepare(`INSERT INTO scores (team_id, team_name, game, lv, score, correct, total, at)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`),
  insertChat: db.prepare('INSERT INTO chat (team_id, user_id, name, kind, text, at, reply_to) VALUES (?, ?, ?, ?, ?, ?, ?)'),
  recentChat: db.prepare(`SELECT c.id, c.user_id, c.name, c.kind, c.text, c.at, c.reactions,
                                 p.id AS p_id, p.name AS p_name, p.kind AS p_kind, p.text AS p_text
                          FROM chat c LEFT JOIN chat p ON p.id = c.reply_to
                          WHERE c.team_id = ? ORDER BY c.id DESC LIMIT 80`),
  chatById: db.prepare('SELECT * FROM chat WHERE id = ? AND team_id = ?'),
  setReactions: db.prepare('UPDATE chat SET reactions = ? WHERE id = ?'),
  pruneChat: db.prepare(`DELETE FROM chat WHERE team_id = ? AND id <= (
                           SELECT id FROM chat WHERE team_id = ? ORDER BY id DESC LIMIT 1 OFFSET 300)`),
  leaderboard: db.prepare(`SELECT team_id, team_name, MAX(score) AS score, correct, total
                           FROM scores WHERE game = ? AND lv = ? GROUP BY team_id ORDER BY score DESC LIMIT 10`),
};

// ---------- sessions ----------
function userFromCookie(header) {
  const token = parseCookies(header)[COOKIE];
  if (!token) return null;
  const row = q.session.get(token);
  if (!row || row.suspended_at || Date.now() - row.created_at > SESSION_DAYS * 864e5) return null;
  return row;
}
function startSession(req, res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  q.insertSession.run(token, userId, Date.now());
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${req.secure ? '; Secure' : ''}`);
}
function requireUser(req, res, next) {
  const u = userFromCookie(req.headers.cookie);
  if (!u) return res.status(401).json({ error: 'Please log in first.' });
  req.user = u;
  next();
}
function requireAdmin(req, res, next) {
  const u = userFromCookie(req.headers.cookie);
  if (!u) return res.status(401).json({ error: 'Please log in first.' });
  if (u.role !== 'admin') return res.status(403).json({ error: 'Only admins can do that.' });
  q.touch.run(Date.now(), u.id);
  req.user = u;
  next();
}
const publicUser = u => ({ id: u.id, name: u.name, role: u.role || 'player' });
const teamSummary = t => t ? { id: t.id, name: t.name, code: t.code } : null;

// ---------- accounts ----------
const NAME_RE = /^[\p{L}\p{N} _.'-]{2,24}$/u;

app.post('/api/register', (req, res) => {
  if (tooManyAttempts('reg:' + req.ip, 20)) return res.status(429).json({ error: 'Too many attempts. Wait a few minutes and try again.' });
  const name = String(req.body.name || '').trim();
  const password = String(req.body.password || '');
  if (!NAME_RE.test(name)) return res.status(400).json({ error: 'Pick a name of 2 to 24 letters, numbers or spaces.' });
  if (password.length < 6) return res.status(400).json({ error: 'Use a password of at least 6 characters.' });
  if (q.userByName.get(name)) return res.status(409).json({ error: 'That name is taken. Try another one.' });
  const { lastInsertRowid } = q.insertUser.run(name, hashPassword(password), Date.now());
  if (ADMIN_NAMES.includes(name.toLowerCase())) q.makeAdmin.run(name);
  startSession(req, res, lastInsertRowid);
  res.json({ user: publicUser(q.userById.get(lastInsertRowid)), team: null });
});

app.post('/api/login', (req, res) => {
  if (tooManyAttempts('login:' + req.ip)) return res.status(429).json({ error: 'Too many attempts. Wait a few minutes and try again.' });
  const u = q.userByName.get(String(req.body.name || '').trim());
  if (!u || !verifyPassword(String(req.body.password || ''), u.pass)) {
    return res.status(401).json({ error: 'That name and password do not match.' });
  }
  if (u.suspended_at) return res.status(403).json({ error: 'This account is suspended. Talk to your admin to get it restored.' });
  startSession(req, res, u.id);
  res.json({ user: publicUser(u), team: teamSummary(u.team_id && q.teamById.get(u.team_id)) });
});

app.post('/api/logout', (req, res) => {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (token) q.deleteSession.run(token);
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  const u = userFromCookie(req.headers.cookie);
  if (!u) return res.json({ user: null, team: null });
  q.touch.run(Date.now(), u.id);
  res.json({ user: publicUser(u), team: teamSummary(u.team_id && q.teamById.get(u.team_id)) });
});

// ---------- teams ----------
function moveUser(user, teamId, created = false) {
  const old = user.team_id;
  q.setTeam.run(teamId, user.id);
  for (const s of userSockets(user.id)) s.disconnect(true); // the page reconnects into the new team room
  if (old && old !== teamId) { postChat(old, null, `${user.name} left the team`); broadcastTeam(old); }
  if (teamId && old !== teamId) postChat(teamId, null, created ? `${user.name} created the team. Share the code to invite colleagues.` : `${user.name} joined the team 👋`);
}

app.post('/api/teams', requireUser, (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 32);
  if (name.length < 2) return res.status(400).json({ error: 'Give your team a name of at least 2 characters.' });
  let code;
  do { code = Array.from({ length: 5 }, () => CODE_CHARS[crypto.randomInt(CODE_CHARS.length)]).join(''); }
  while (q.teamByCode.get(code));
  const { lastInsertRowid } = q.insertTeam.run(name, code, Date.now());
  moveUser(req.user, Number(lastInsertRowid), true);
  res.json({ team: { id: Number(lastInsertRowid), name, code } });
});

app.post('/api/teams/join', requireUser, (req, res) => {
  const code = String(req.body.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const team = q.teamByCode.get(code);
  if (!team) return res.status(404).json({ error: `No team uses the code ${code || '(empty)'}. Check it with your teammate.` });
  if (req.user.team_id !== team.id) moveUser(req.user, team.id);
  res.json({ team: teamSummary(team) });
});

app.post('/api/teams/leave', requireUser, (req, res) => {
  moveUser(req.user, null);
  res.json({ ok: true });
});

app.get('/api/leaderboard', (req, res) => {
  const game = G.GAMES[req.query.game] ? req.query.game : 'rebus';
  const lv = Math.max(0, Math.min(G.GAMES[game].levels.length - 1, Number(req.query.lv) || 0));
  res.json({ game, lv, rows: q.leaderboard.all(game, lv) });
});

app.get('/api/games', (req, res) => {
  res.json(Object.values(G.GAMES).map(g => ({
    id: g.id, name: g.name, tagline: g.tagline, locked: !!g.locked,
    levels: g.levels.map(l => ({ name: l.name, blurb: l.blurb, mult: l.mult, maxHints: l.maxHints, notes: Math.min(l.pool.length, 10) })),
  })));
});

// ---------- admin ----------
function onlineUserIds() {
  return new Set([...io.sockets.sockets.values()].map(s => s.data.userId).filter(Boolean));
}
app.get('/api/admin/overview', requireAdmin, (req, res) => {
  const online = onlineUserIds(), now = Date.now(), week = now - 7 * 864e5;
  const users = q.adminUsers.all().map(u => ({
    id: u.id, name: u.name, role: u.role, points: u.points, joined: u.created_at, lastSeen: online.has(u.id) ? now : u.last_seen,
    online: online.has(u.id), suspendedAt: u.suspended_at, suspendedReason: u.suspended_reason,
    team: u.team_id ? { id: u.team_id, name: u.team_name } : null,
  }));
  const teams = q.adminTeams.all().map(t => {
    const g = t.game ? JSON.parse(t.game) : null;
    const playing = g && g.status !== 'done' ? { game: G.GAMES[G.typeOf(g)].name, level: G.levelOf(g).name, at: g.i + 1, of: g.order.length } : null;
    return { id: t.id, name: t.name, code: t.code, created: t.created_at, members: t.members, rounds: t.rounds,
      online: users.filter(u => u.team && u.team.id === t.id && u.online).length, playing };
  });
  const rounds = Object.fromEntries(q.roundsByGame.all().map(r => [r.game, r.n]));
  const access = q.accessAll.all().map(a => ({
    teamId: a.team_id, team: a.team_name, game: a.game, gameName: (G.GAMES[a.game] || {}).name || a.game,
    status: a.status, requester: a.requester, requestedAt: a.requested_at, decider: a.decider, decidedAt: a.decided_at,
  }));
  res.json({
    access,
    lockedGames: LOCKED.map(id => ({ id, name: G.GAMES[id].name })),
    stats: {
      people: users.length,
      active: users.filter(u => !u.suspendedAt).length,
      suspended: users.filter(u => u.suspendedAt).length,
      admins: users.filter(u => u.role === 'admin').length,
      online: users.filter(u => u.online).length,
      activeWeek: users.filter(u => u.lastSeen && u.lastSeen >= week).length,
      teams: teams.length,
      teamsWithPlayers: teams.filter(t => t.members > 0).length,
      rounds: Object.values(rounds).reduce((a, b) => a + b, 0),
      roundsByGame: Object.fromEntries(Object.keys(G.GAMES).map(k => [k, rounds[k] || 0])),
      messages: q.chatCount.get().n,
      pendingRequests: access.filter(a => a.status === 'pending').length,
    },
    users, teams,
  });
});
function targetUser(req, res) {
  const t = q.userById.get(Number(req.params.id));
  if (!t) { res.status(404).json({ error: 'That person no longer exists.' }); return null; }
  return t;
}
app.post('/api/admin/users/:id/suspend', requireAdmin, (req, res) => {
  const t = targetUser(req, res); if (!t) return;
  if (t.id === req.user.id) return res.status(400).json({ error: 'You cannot suspend yourself.' });
  const reason = String(req.body.reason || '').trim().slice(0, 140) || null;
  q.suspend.run(Date.now(), reason, t.id);
  q.dropSessions.run(t.id);
  for (const s of userSockets(t.id)) { s.emit('suspended'); s.disconnect(true); }
  if (t.team_id) { broadcastTeam(t.team_id); }
  console.log(`[admin] ${req.user.name} suspended ${t.name}${reason ? ` (${reason})` : ''}`);
  res.json({ ok: true });
});
app.post('/api/admin/users/:id/restore', requireAdmin, (req, res) => {
  const t = targetUser(req, res); if (!t) return;
  q.restore.run(t.id);
  if (t.team_id) broadcastTeam(t.team_id);
  console.log(`[admin] ${req.user.name} restored ${t.name}`);
  res.json({ ok: true });
});
app.post('/api/admin/users/:id/role', requireAdmin, (req, res) => {
  const t = targetUser(req, res); if (!t) return;
  const role = req.body.role === 'admin' ? 'admin' : 'player';
  if (t.id === req.user.id && role !== 'admin') return res.status(400).json({ error: 'You cannot remove your own admin access.' });
  if (role === 'admin' && t.suspended_at) return res.status(400).json({ error: 'Restore this account before making it an admin.' });
  q.setRole.run(role, t.id);
  console.log(`[admin] ${req.user.name} set ${t.name} to ${role}`);
  res.json({ ok: true });
});

app.post('/api/access/request', requireUser, (req, res) => {
  const def = G.GAMES[req.body.game];
  if (!def || !def.locked) return res.status(400).json({ error: 'That game does not need unlocking.' });
  if (!req.user.team_id) return res.status(400).json({ error: 'Join a team first, then ask for access.' });
  const now = accessMap(req.user.team_id)[def.id].status;
  if (now === 'approved') return res.json({ status: 'approved' });
  if (now === 'pending') return res.json({ status: 'pending' });
  q.accessRequest.run(req.user.team_id, def.id, req.user.id, Date.now());
  const team = q.teamById.get(req.user.team_id);
  postChat(team.id, null, `🔒 ${req.user.name} asked an admin to unlock ${def.name}`);
  broadcastTeam(team.id);
  notifyAdmins('admin:request', { team: team.name, game: def.name, by: req.user.name });
  console.log(`[access] ${req.user.name} (${team.name}) requested ${def.name}`);
  res.json({ status: 'pending' });
});

app.post('/api/admin/access', requireAdmin, (req, res) => {
  const def = G.GAMES[req.body.game], team = q.teamById.get(Number(req.body.teamId));
  const action = req.body.action;
  if (!def || !def.locked) return res.status(400).json({ error: 'That game is not a locked game.' });
  if (!team) return res.status(404).json({ error: 'That team no longer exists.' });
  if (!['approve', 'decline', 'lock'].includes(action)) return res.status(400).json({ error: 'Unknown action.' });
  const status = { approve: 'approved', decline: 'declined', lock: 'locked' }[action];
  q.accessDecide.run(team.id, def.id, status, req.user.id, Date.now());
  if (action === 'lock') {
    const g = team.game ? JSON.parse(team.game) : null;
    if (g && G.typeOf(g) === def.id && g.status !== 'done') q.clearGame.run(team.id); // end a round in progress
  }
  postChat(team.id, null, {
    approve: `🔓 ${def.name} is unlocked for your team. Have fun! 💘`,
    decline: `${def.name} stays locked for now. You can ask again later.`,
    lock: `🔒 ${def.name} has been locked again by an admin.`,
  }[action]);
  broadcastTeam(team.id);
  console.log(`[access] ${req.user.name} ${status} ${def.name} for ${team.name}`);
  res.json({ ok: true, status });
});

app.get('/healthz', (req, res) => res.send('ok'));

// ---------- live play ----------
const server = http.createServer(app);
const io = new Server(server);

function userSockets(userId) {
  return [...io.sockets.sockets.values()].filter(s => s.data.userId === userId);
}
// Team chat. `user` is null for messages the game posts itself.
const REACTIONS = ['👍', '😂', '🔥', '👏', '🤯', '❤️'];
const snippet = t => (t.length > 90 ? t.slice(0, 90) + '…' : t);
// reactions are stored as {emoji: [userId, ...]}; players see names.
function reactionView(json) {
  const r = typeof json === 'string' ? JSON.parse(json || '{}') : json || {};
  const out = {};
  for (const [e, ids] of Object.entries(r)) if (ids.length) out[e] = ids.map(id => ({ id, name: nameOf(id) }));
  return out;
}
function chatView(row) {
  return {
    id: row.id, userId: row.user_id, name: row.name, kind: row.kind, text: row.text, at: row.at,
    reply: row.p_id ? { id: row.p_id, name: row.p_kind === 'event' ? 'Rebus Board' : row.p_name, text: snippet(row.p_text) } : null,
    reactions: reactionView(row.reactions),
  };
}
function postChat(teamId, user, text, parent = null) {
  const row = { user_id: user ? user.id : null, name: user ? user.name : null, kind: user ? 'msg' : 'event', text, at: Date.now() };
  const { lastInsertRowid } = q.insertChat.run(teamId, row.user_id, row.name, row.kind, text, row.at, parent ? parent.id : null);
  q.pruneChat.run(teamId, teamId);
  io.to('team:' + teamId).emit('chat', chatView({
    ...row, id: Number(lastInsertRowid), reactions: '{}',
    ...(parent ? { p_id: parent.id, p_name: parent.name, p_kind: parent.kind, p_text: parent.text } : {}),
  }));
}
const nameOf = id => (q.nameById.get(id) || {}).name || 'A former teammate';

// Players with the page open right now (their picks decide when a Bible question runs out of guesses).
function onlineIds(teamId) {
  const room = io.sockets.adapter.rooms.get('team:' + teamId) || new Set();
  return [...new Set([...room].map(sid => io.sockets.sockets.get(sid)?.data.userId).filter(Boolean))];
}

// ---------- locked games ----------
const LOCKED = Object.values(G.GAMES).filter(g => g.locked).map(g => g.id);
// { love: { status: 'locked' | 'pending' | 'approved' | 'declined', requester, requestedAt } }
function accessMap(teamId) {
  const rows = Object.fromEntries((teamId ? q.accessFor.all(teamId) : []).map(r => [r.game, r]));
  return Object.fromEntries(LOCKED.map(id => {
    const r = rows[id];
    return [id, r ? { status: r.status, requester: r.requester || null, requestedAt: r.requested_at || null } : { status: 'locked' }];
  }));
}
const canPlay = (teamId, type) => !G.GAMES[type].locked || accessMap(teamId)[type].status === 'approved';
function notifyAdmins(event, data) {
  for (const s of io.sockets.sockets.values()) {
    const u = s.data.userId && q.userById.get(s.data.userId);
    if (u && u.role === 'admin' && !u.suspended_at) s.emit(event, data);
  }
}

function broadcastTeam(teamId) {
  const team = q.teamById.get(teamId);
  if (!team) return;
  const room = io.sockets.adapter.rooms.get('team:' + teamId) || new Set();
  const online = new Set([...room].map(sid => io.sockets.sockets.get(sid)?.data.userId));
  const game = team.game ? JSON.parse(team.game) : null;
  io.to('team:' + teamId).emit('state', {
    team: teamSummary(team),
    members: q.members.all(teamId).map(m => ({ ...m, online: online.has(m.id) })),
    game: G.view(game, nameOf),
    access: accessMap(teamId),
  });
}

io.use((socket, next) => {
  const u = userFromCookie(socket.handshake.headers.cookie);
  if (!u) return next(new Error('Please log in first.'));
  socket.data.userId = u.id;
  socket.data.teamId = u.team_id;
  q.touch.run(Date.now(), u.id);
  next();
});

io.on('connection', socket => {
  const teamId = socket.data.teamId;
  if (!teamId) return;
  socket.join('team:' + teamId);
  broadcastTeam(teamId);
  socket.emit('chat:history', q.recentChat.all(teamId).reverse().map(chatView));

  let lastGuesses = [];
  // Every change runs synchronously against the database, so two players can never both win the same note.
  function act(fn) {
    const u = q.userById.get(socket.data.userId);
    if (!u || u.team_id !== teamId) { socket.emit('moved'); return; }
    const team = q.teamById.get(teamId);
    const game = team.game ? JSON.parse(team.game) : null;
    const out = fn(game, u, team);
    if (!out) return;
    db.transaction(() => {
      q.saveGame.run(JSON.stringify(out.game), teamId);
      if (out.seen) q.saveSeen.run(JSON.stringify(out.seen), teamId);
      if (out.points) q.addPoints.run(out.points, u.id);
      if (out.game.status === 'done' && game.status !== 'done') {
        const g = out.game;
        q.insertScore.run(teamId, team.name, G.typeOf(g), g.lv, g.score, g.results.filter(r => r.ok).length, g.results.length, Date.now());
      }
    })();
    broadcastTeam(teamId);
    if (out.event) postChat(teamId, null, out.event);
    if (out.game.status === 'done' && game.status !== 'done') {
      const g = out.game;
      postChat(teamId, null, `🏁 ${G.GAMES[G.typeOf(g)].name} round over: ${g.score} points, ${g.results.filter(r => r.ok).length} of ${g.results.length} right`);
      io.emit('scores');
    }
  }
  const atNote = (g, i) => g && Number.isInteger(i) && g.i === i;

  socket.on('start', ({ game: type = 'rebus', lv } = {}) => act((g, u, team) => {
    const def = G.GAMES[type], level = def && def.levels[lv];
    if (!level) return null;
    if (!canPlay(teamId, type)) { socket.emit('locked', { game: type }); return null; }
    const icon = { bible: '📖', love: '💘' }[type] || '🧩';
    // Remember what this team is about to see, so the next rounds bring new questions first.
    const seen = JSON.parse(team.seen || '{}'), bucket = `${type}:${lv}`;
    const round = G.make(type, lv, seen[bucket]);
    const now = Date.now();
    seen[bucket] = { ...(seen[bucket] || {}) };
    round.order.forEach(k => { seen[bucket][G.keyOf(level.pool[k])] = now; });
    return { game: round, seen, event: `${icon} ${u.name} started ${def.name} · ${level.name}${lv === def.levels.length - 1 ? ' 👑' : ''}` };
  }));

  socket.on('guess', ({ text, i } = {}) => {
    const now = Date.now();
    lastGuesses = lastGuesses.filter(t => now - t < 3000);
    if (lastGuesses.length >= 6) return; // ignore spam
    lastGuesses.push(now);
    text = String(text || '').trim().slice(0, 80);
    if (!text) return;
    act((g, u) => {
      if (!atNote(g, i) || g.status !== 'play' || G.typeOf(g) !== 'rebus') return null;
      if (matches(text, G.puzzleAt(g).a)) {
        const g2 = G.solve(g, u.id);
        const streak = g2.streak >= 3 ? ` · ${g2.streak} in a row 🔥` : '';
        return { game: g2, points: g2.lastPts, event: `🎉 ${u.name} solved “${G.answerOf(G.puzzleAt(g))}” +${g2.lastPts}${streak}` };
      }
      socket.emit('wrong', { text });
      socket.to('team:' + teamId).emit('guess', { name: u.name, text, gid: g.id, i: g.i });
      return null;
    });
  });

  // Quiz games (Bible, Love): pick one of the four answers.
  socket.on('choose', ({ i, pos } = {}) => act((g, u) => {
    if (!atNote(g, i) || g.status !== 'play' || !G.isQuiz(g) || ![0, 1, 2, 3].includes(pos)) return null;
    const label = G.optionsAt(g)[pos];
    const r = G.choose(g, u.id, pos, onlineIds(teamId));
    if (!r.game) { if (r.already) socket.emit('pick:locked'); return null; }
    if (r.ok) {
      const streak = r.game.streak >= 3 ? ` · ${r.game.streak} in a row 🔥` : '';
      return { game: r.game, points: r.game.lastPts, event: `🎉 ${u.name} got it: “${label}” +${r.game.lastPts}${streak}` };
    }
    socket.to('team:' + teamId).emit('guess', { name: u.name, text: label, gid: g.id, i: g.i });
    if (r.missed) return { game: r.game, event: `😬 Nobody got that one. It was “${G.answerOf(G.puzzleAt(g))}”` };
    return { game: r.game };
  }));

  socket.on('hint', ({ i } = {}) => act(g => atNote(g, i) && g.status === 'play' && g.hints < G.maxHints(g) ? { game: G.hint(g) } : null));
  socket.on('reveal', ({ i } = {}) => act((g, u) => atNote(g, i) && g.status === 'play'
    ? { game: G.reveal(g, u.id), event: `${u.name} gave up. It was “${G.answerOf(G.puzzleAt(g))}”` } : null));
  socket.on('next', ({ i } = {}) => act(g => atNote(g, i) && (g.status === 'solved' || g.status === 'revealed') ? { game: G.next(g) } : null));

  let lastChats = [];
  socket.on('chat', ({ text, replyTo } = {}) => {
    const now = Date.now();
    lastChats = lastChats.filter(t => now - t < 10000);
    if (lastChats.length >= 8) { socket.emit('chat:slow'); return; }
    text = String(text || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 300);
    if (!text) return;
    const u = q.userById.get(socket.data.userId);
    if (!u || u.team_id !== teamId) { socket.emit('moved'); return; }
    lastChats.push(now);
    const parent = Number.isInteger(replyTo) ? q.chatById.get(replyTo, teamId) : null;
    postChat(teamId, u, text, parent || null);
  });

  socket.on('react', ({ id, emoji } = {}) => {
    if (!REACTIONS.includes(emoji) || !Number.isInteger(id)) return;
    const u = q.userById.get(socket.data.userId);
    if (!u || u.team_id !== teamId) return;
    const row = q.chatById.get(id, teamId);
    if (!row) return;
    const r = JSON.parse(row.reactions || '{}');
    const ids = r[emoji] || [];
    r[emoji] = ids.includes(u.id) ? ids.filter(x => x !== u.id) : [...ids, u.id];
    if (!r[emoji].length) delete r[emoji];
    q.setReactions.run(JSON.stringify(r), id);
    io.to('team:' + teamId).emit('chat:react', { id, reactions: reactionView(r) });
  });

  let lastTyping = 0;
  socket.on('typing', () => {
    const now = Date.now();
    if (now - lastTyping < 1500) return;
    lastTyping = now;
    socket.to('team:' + teamId).emit('typing', { id: socket.data.userId, name: nameOf(socket.data.userId) });
  });

  socket.on('disconnect', () => broadcastTeam(teamId));
});

for (const n of ADMIN_NAMES) q.makeAdmin.run(n);

server.listen(PORT, () => console.log(`Rebus Board running on http://localhost:${PORT}`));

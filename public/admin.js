'use strict';
// Admin dashboard: totals, people (suspend / restore / make admin) and teams.
// Only shown to accounts with the admin role; the server checks the role on every admin call.

const Admin = (() => {
  let data = null, err = '', filter = 'all', pending = null, busy = false, timer = null;

  const ago = t => {
    if (!t) return 'Never';
    const s = Math.round((Date.now() - t) / 1000);
    if (s < 60) return 'Just now';
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    if (s < 86400) return `${Math.round(s / 3600)} h ago`;
    if (s < 86400 * 30) return `${Math.round(s / 86400)} d ago`;
    return new Date(t).toLocaleDateString();
  };
  const day = t => new Date(t).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });

  async function load() {
    try { data = await api('/api/admin/overview'); err = ''; }
    catch (e) { err = e.message; }
    render();
  }
  function start() { load(); clearInterval(timer); timer = setInterval(() => { if (MODE === 'admin' && !pending && !document.hidden) load(); }, 20000); }
  function stop() { clearInterval(timer); timer = null; }

  async function act(path, body, done) {
    busy = true; render();
    try { await api(path, body || {}); pending = null; toast(done); await load(); }
    catch (e) { toast(e.message); }
    busy = false; render();
  }

  function tile(label, value, note, tone = '') {
    return `<div class="tile ${tone}"><small class="lbl">${label}</small><b>${value}</b>${note ? `<span>${note}</span>` : ''}</div>`;
  }
  function statsHTML(s) {
    return `<div class="tiles">
      ${tile('People', s.people, `${s.active} active · ${s.admins} admin${s.admins === 1 ? '' : 's'}`)}
      ${tile('Teams', s.teams, `${s.teamsWithPlayers} with players`)}
      ${tile('Online now', s.online, 'Have the game open', s.online ? 'good' : '')}
      ${tile('Active this week', s.activeWeek, 'Seen in the last 7 days')}
      ${tile('Rounds played', s.rounds, `${s.roundsByGame.rebus || 0} Rebus · ${s.roundsByGame.bible || 0} Bible`)}
      ${tile('Suspended', s.suspended, s.suspended ? 'Cannot log in' : 'Nobody', s.suspended ? 'bad' : '')}
    </div>`;
  }
  function peopleHTML(users) {
    const q = (document.getElementById('admSearch')?.value || '').trim().toLowerCase();
    const counts = { all: users.length, online: users.filter(u => u.online).length, suspended: users.filter(u => u.suspendedAt).length, admins: users.filter(u => u.role === 'admin').length };
    const list = users.filter(u =>
      (filter === 'all' || (filter === 'online' && u.online) || (filter === 'suspended' && u.suspendedAt) || (filter === 'admins' && u.role === 'admin')) &&
      (!q || u.name.toLowerCase().includes(q) || (u.team && u.team.name.toLowerCase().includes(q))));
    const rows = list.map(u => {
      const me = u.id === ME.id, sus = !!u.suspendedAt;
      const status = sus ? `<span class="pill bad" title="${esc(u.suspendedReason || '')}">Suspended</span>` : u.online ? '<span class="pill good">Online</span>' : '<span class="pill">Active</span>';
      let actions;
      if (pending && pending.id === u.id && pending.kind === 'suspend') {
        actions = `<div class="confirmrow"><label class="sr" for="admReason">Reason</label><input id="admReason" maxlength="140" placeholder="Reason (optional, only admins see it)">
          <button class="btn small danger" data-adm="do-suspend" data-id="${u.id}" ${busy ? 'disabled' : ''}>Suspend ${esc(u.name)}</button>
          <button class="btn small ghost" data-adm="cancel">Cancel</button></div>`;
      } else if (pending && pending.id === u.id && pending.kind === 'role') {
        const to = u.role === 'admin' ? 'player' : 'admin';
        actions = `<div class="confirmrow"><span>${to === 'admin' ? `Give ${esc(u.name)} full admin access?` : `Remove admin access from ${esc(u.name)}?`}</span>
          <button class="btn small primary" data-adm="do-role" data-id="${u.id}" data-role="${to}" ${busy ? 'disabled' : ''}>${to === 'admin' ? 'Make admin' : 'Remove admin'}</button>
          <button class="btn small ghost" data-adm="cancel">Cancel</button></div>`;
      } else if (me) {
        actions = '<span class="muted">This is you</span>';
      } else {
        actions = `<div class="row">${sus
          ? `<button class="btn small" data-adm="restore" data-id="${u.id}" ${busy ? 'disabled' : ''}>Restore</button>`
          : `<button class="btn small danger-ghost" data-adm="suspend" data-id="${u.id}">Suspend</button>
             <button class="btn small ghost" data-adm="role" data-id="${u.id}">${u.role === 'admin' ? 'Remove admin' : 'Make admin'}</button>`}</div>`;
      }
      return `<tr class="${sus ? 'sus' : ''}">
        <td><div class="who">${avatar(u.name, u.online)}<div><b>${esc(u.name)}</b>${u.role === 'admin' ? ' <span class="pill admin">Admin</span>' : ''}${me ? ' <span class="muted">(you)</span>' : ''}
          ${sus && u.suspendedReason ? `<small class="reason">“${esc(u.suspendedReason)}” · ${ago(u.suspendedAt)}</small>` : sus ? `<small class="reason">Suspended ${ago(u.suspendedAt)}</small>` : ''}</div></div></td>
        <td>${u.team ? esc(u.team.name) : '<span class="muted">No team</span>'}</td>
        <td class="n">${u.points}</td>
        <td>${day(u.joined)}</td>
        <td>${u.online ? 'Now' : ago(u.lastSeen)}</td>
        <td>${status}</td>
        <td class="act">${actions}</td></tr>`;
    }).join('');
    return `<section class="card adm"><div class="row" style="justify-content:space-between"><h3>People</h3>
        <div class="row"><label class="sr" for="admSearch">Search people</label><input id="admSearch" class="search" placeholder="Search by name or team" autocomplete="off"></div></div>
      <div class="seg" role="group" aria-label="Filter people">${[['all', 'All'], ['online', 'Online'], ['suspended', 'Suspended'], ['admins', 'Admins']].map(([k, l]) =>
        `<button data-adm="filter" data-f="${k}" aria-pressed="${filter === k}">${l} <b>${counts[k]}</b></button>`).join('')}</div>
      <div class="tablewrap"><table><thead><tr><th>Person</th><th>Team</th><th class="n">Points</th><th>Joined</th><th>Last seen</th><th>Status</th><th></th></tr></thead>
        <tbody>${rows || `<tr><td colspan="7" class="muted">${q ? `Nobody matches “${esc(q)}”.` : 'Nobody here yet.'}</td></tr>`}</tbody></table></div></section>`;
  }
  function teamsHTML(teams) {
    const rows = teams.map(t => `<tr>
      <td><b>${esc(t.name)}</b></td><td><code>${esc(t.code)}</code></td>
      <td class="n">${t.members}</td><td class="n">${t.online ? `<span class="pill good">${t.online}</span>` : '0'}</td>
      <td>${t.playing ? `${esc(t.playing.game)} · ${esc(t.playing.level)} <span class="muted">(${t.playing.at}/${t.playing.of})</span>` : '<span class="muted">Not playing</span>'}</td>
      <td class="n">${t.rounds}</td><td>${day(t.created)}</td></tr>`).join('');
    return `<section class="card adm"><h3>Teams</h3>
      <div class="tablewrap"><table><thead><tr><th>Team</th><th>Code</th><th class="n">Members</th><th class="n">Online</th><th>Playing now</th><th class="n">Rounds</th><th>Created</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="7" class="muted">No teams yet.</td></tr>'}</tbody></table></div></section>`;
  }

  return {
    start, stop,
    html() {
      if (err && !data) return `<section class="card"><h2>Admin</h2><p class="msg no">${esc(err)}</p></section>`;
      if (!data) return '<p class="muted">Loading the dashboard…</p>';
      return `<div style="display:grid;gap:20px">
        <div class="row" style="justify-content:space-between"><div><h2>Admin dashboard</h2><p class="muted">Updates every 20 seconds.</p></div>
          <button class="btn small" data-adm="refresh">Refresh</button></div>
        ${statsHTML(data.stats)}${peopleHTML(data.users)}${teamsHTML(data.teams)}</div>`;
    },
    click(t) {
      const k = t.dataset.adm, id = Number(t.dataset.id);
      if (k === 'refresh') load();
      else if (k === 'filter') { filter = t.dataset.f; render(); }
      else if (k === 'suspend') { pending = { id, kind: 'suspend' }; render(); setTimeout(() => document.getElementById('admReason')?.focus(), 0); }
      else if (k === 'role') { pending = { id, kind: 'role' }; render(); }
      else if (k === 'cancel') { pending = null; render(); }
      else if (k === 'do-suspend') act(`/api/admin/users/${id}/suspend`, { reason: document.getElementById('admReason')?.value || '' }, 'Suspended. They have been logged out.');
      else if (k === 'restore') act(`/api/admin/users/${id}/restore`, {}, 'Restored. They can log in again.');
      else if (k === 'do-role') act(`/api/admin/users/${id}/role`, { role: t.dataset.role }, t.dataset.role === 'admin' ? 'They are now an admin.' : 'Admin access removed.');
    },
    search() { render(); },
  };
})();

'use strict';
// Team chat widget. It lives in the corner, outside the game area, so game updates never wipe what you are typing.
// Wide screens: docked open on the right. Smaller screens: a 💬 button that opens a panel (full screen on phones).

const Chat = (() => {
  const QUICK = ['😂', '🔥', '👏', '🤯', '🙈', '🧠'];       // one tap sends these as a message
  const REACTS = ['👍', '😂', '🔥', '👏', '🤯', '❤️'];     // reactions on a message (must match the server list)
  let socket = null, me = null, team = null, members = [];
  let msgs = [], replyTo = null, unread = 0, mentioned = false, open = null, lastTypingSent = 0;
  const typers = new Map();
  const $c = id => document.getElementById(id);
  const wideMQ = matchMedia('(min-width: 1240px)');

  const pref = { get() { try { const v = localStorage.getItem('rebus-chat-open'); return v == null ? null : v === '1'; } catch { return null; } },
                 set(v) { try { localStorage.setItem('rebus-chat-open', v ? '1' : '0'); } catch {} } };
  const isOpen = () => open ?? pref.get() ?? wideMQ.matches;
  const hhmm = t => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // ---------- DOM (built once) ----------
  function build() {
    const dock = $c('chatDock');
    dock.innerHTML = `
      <button class="chat-fab" id="chatFab" aria-label="Open team chat" aria-expanded="false">
        <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="currentColor" d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/></svg>
        <span class="badge" id="chatBadge" hidden></span></button>
      <section class="chat-panel" id="chatPanel" aria-label="Team chat" hidden>
        <header class="chat-head">
          <div class="chat-title"><b>Team chat</b><small id="chatSub"></small></div>
          <div class="chat-faces" id="chatFaces"></div>
          <button class="iconbtn" id="chatMin" aria-label="Minimise chat" title="Minimise">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 12h14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg></button>
        </header>
        <div class="chat-body">
          <div class="chatlist" id="chatList" role="log" aria-live="polite" aria-label="Messages"></div>
          <button class="btn small newmsg" id="chatJump" hidden>New messages ↓</button>
        </div>
        <div class="typing" id="chatTyping" aria-live="polite"></div>
        <div class="replybar" id="replyBar" hidden>
          <div class="replyinfo"><small>Replying to <b id="replyName"></b></small><span id="replyText"></span></div>
          <button class="iconbtn" id="replyCancel" aria-label="Cancel reply" title="Cancel reply">×</button>
        </div>
        <div class="reacts" role="group" aria-label="Quick emoji">${QUICK.map(e => `<button class="react" data-quick="${e}" aria-label="Send ${e}">${e}</button>`).join('')}</div>
        <form class="chat-form" id="chatF" autocomplete="off">
          <label class="sr" for="chatInput">Message</label>
          <input id="chatInput" maxlength="300" placeholder="Message your team… use @ to mention">
          <button class="btn primary" aria-label="Send">Send</button>
        </form>
      </section>`;

    $c('chatFab').onclick = () => setOpen(true, true);
    $c('chatMin').onclick = () => setOpen(false);
    $c('replyCancel').onclick = () => setReply(null);
    $c('chatJump').onclick = () => { unread = 0; paint({ bottom: true }); };
    $c('chatF').onsubmit = e => {
      e.preventDefault();
      const text = $c('chatInput').value.trim();
      if (!text || !socket) return;
      socket.emit('chat', { text, replyTo: replyTo ? replyTo.id : undefined });
      $c('chatInput').value = '';
      setReply(null);
    };
    $c('chatInput').addEventListener('input', () => {
      const now = Date.now();
      if (socket && now - lastTypingSent > 2000 && $c('chatInput').value.trim()) { lastTypingSent = now; socket.emit('typing'); }
    });
    $c('chatInput').addEventListener('keydown', e => {
      if (e.key === 'Escape') { if (replyTo) setReply(null); else if (!docked()) setOpen(false); }
    });
    $c('chatPanel').addEventListener('click', e => {
      const b = e.target.closest('button');
      if (b && b.dataset.quick) { socket && socket.emit('chat', { text: b.dataset.quick, replyTo: replyTo ? replyTo.id : undefined }); setReply(null); return; }
      if (b && b.dataset.reply) { const m = msgs.find(x => x.id === +b.dataset.reply); if (m) setReply(m); return; }
      if (b && b.dataset.emoji) { socket && socket.emit('react', { id: +b.dataset.msg, emoji: b.dataset.emoji }); closeTools(); return; }
      if (b && b.dataset.jump) { jumpTo(+b.dataset.jump); return; }
      // Tap a message to show its reply and reaction buttons (phones have no hover).
      const row = e.target.closest('.cmsg,.cev');
      if (row && !b) { const was = row.classList.contains('tools-open'); closeTools(); if (!was) row.classList.add('tools-open'); }
    });
    $c('chatList').addEventListener('scroll', () => {
      const el = $c('chatList');
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 40 && unread) { unread = 0; mentioned = false; badge(); }
    });
    wideMQ.addEventListener('change', layout);
  }
  const closeTools = () => document.querySelectorAll('#chatList .tools-open').forEach(r => r.classList.remove('tools-open'));

  // ---------- state changes ----------
  const docked = () => isOpen() && wideMQ.matches;
  function setOpen(v, focus) {
    open = v; pref.set(v);
    if (v) { unread = 0; mentioned = false; }
    layout();
    if (v) { paint({ bottom: true }); if (focus) $c('chatInput').focus(); }
  }
  function layout() {
    const show = !!(me && team), o = show && isOpen();
    $c('chatDock').hidden = !show;
    $c('chatPanel').hidden = !o;
    $c('chatFab').hidden = !show || docked();
    $c('chatFab').setAttribute('aria-expanded', String(o));
    document.body.classList.toggle('chat-docked', show && docked());
    document.body.classList.toggle('chat-floating', o && !wideMQ.matches);
    badge();
  }
  function badge() {
    const b = $c('chatBadge');
    const n = isOpen() ? 0 : unread;
    b.hidden = !n; b.textContent = mentioned ? '@' : n > 9 ? '9+' : String(n);
    b.classList.toggle('mention', mentioned);
    document.title = (n ? `(${n}) ` : '') + 'Rebus Board';
  }
  function setReply(m) {
    replyTo = m ? { id: m.id, userId: m.userId, name: m.kind === 'event' ? 'Rebus Board' : m.name, text: m.text } : null;
    $c('replyBar').hidden = !replyTo;
    if (replyTo) {
      $c('replyName').textContent = replyTo.userId === me?.id ? 'yourself' : replyTo.name;
      $c('replyText').textContent = replyTo.text.length > 80 ? replyTo.text.slice(0, 80) + '…' : replyTo.text;
      if (!isOpen()) setOpen(true);
      $c('chatInput').focus();
    }
  }
  function jumpTo(id) {
    const el = $c('m-' + id);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
  }

  // ---------- rendering ----------
  function withMentions(text) {
    let html = esc(text);
    const names = members.map(m => m.name).sort((a, b) => b.length - a.length);
    for (const n of names) {
      const at = esc('@' + n);
      html = html.split(at).join(`<span class="at${n === me?.name ? ' me' : ''}">${at}</span>`);
    }
    return html;
  }
  const mentionsMe = m => m.kind === 'msg' && me && m.userId !== me.id && m.text.toLowerCase().includes('@' + me.name.toLowerCase());
  function tools(m) {
    return `<div class="ctools" role="group" aria-label="Message actions">
      <button data-reply="${m.id}" aria-label="Reply" title="Reply"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M10 7 4 12l6 5M4 12h10a6 6 0 0 1 6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      ${REACTS.map(e => `<button data-msg="${m.id}" data-emoji="${e}" aria-label="React ${e}">${e}</button>`).join('')}</div>`;
  }
  function chips(m) {
    const r = m.reactions || {};
    const keys = Object.keys(r);
    if (!keys.length) return '';
    return `<div class="rchips">${keys.map(e => {
      const people = r[e], mine = people.some(p => p.id === me?.id);
      const who = people.map(p => (p.id === me?.id ? 'You' : p.name)).join(', ');
      return `<button class="rchip${mine ? ' mine' : ''}" data-msg="${m.id}" data-emoji="${e}" title="${esc(who)}" aria-label="${esc(e + ' by ' + who)}">${e} <b>${people.length}</b></button>`;
    }).join('')}</div>`;
  }
  function quote(m) {
    if (!m.reply) return '';
    return `<button class="cquote" data-jump="${m.reply.id}" title="Show the original message"><b>${esc(m.reply.name || 'Someone')}</b><span>${esc(m.reply.text)}</span></button>`;
  }
  function item(m, k) {
    if (m.kind === 'event') {
      return `<div class="cev" id="m-${m.id}"><div class="cevtext">${quote(m)}${esc(m.text)}</div>${chips(m)}${tools(m)}</div>`;
    }
    const prev = msgs[k - 1];
    const cont = prev && prev.kind === 'msg' && prev.userId === m.userId && m.at - prev.at < 120000 && !m.reply;
    const mine = m.userId === me?.id;
    const onlyEmoji = !m.reply && /^(\p{Extended_Pictographic}|️|‍|\s){1,12}$/u.test(m.text);
    return `<div class="cmsg${mine ? ' mine' : ''}${cont ? ' cont' : ''}${mentionsMe(m) ? ' mention' : ''}" id="m-${m.id}">
      ${cont ? '<span class="avgap"></span>' : avatar(m.name)}
      <div class="cbody">
        ${cont ? '' : `<div class="cmeta"><b>${esc(mine ? 'You' : m.name)}</b><time datetime="${new Date(m.at).toISOString()}">${hhmm(m.at)}</time></div>`}
        <div class="cbubble${onlyEmoji ? ' big' : ''}">${quote(m)}<div class="ctext">${withMentions(m.text)}</div></div>
        ${chips(m)}
      </div>${tools(m)}</div>`;
  }
  function paint(opt = {}) {
    const el = $c('chatList');
    if (!el || $c('chatPanel').hidden) { badge(); return; }
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    const top = el.scrollTop;
    el.innerHTML = msgs.length ? msgs.map(item).join('') : '<p class="chatempty">No messages yet.<br>Say hi to your team 👋</p>';
    if (opt.bottom || (opt.keep ? false : nearBottom)) { el.scrollTop = el.scrollHeight; unread = 0; mentioned = false; }
    else el.scrollTop = top;
    $c('chatJump').hidden = !unread || !isOpen();
    badge();
  }
  function paintTyping() {
    const now = Date.now();
    for (const [id, t] of typers) if (t.until < now) typers.delete(id);
    const names = [...typers.values()].map(t => t.name);
    $c('chatTyping').innerHTML = names.length
      ? `<span class="dots3"><i></i><i></i><i></i></span>${esc(names.length === 1 ? names[0] + ' is typing' : names.length === 2 ? names.join(' and ') + ' are typing' : 'Several people are typing')}`
      : '';
  }
  function header() {
    const on = members.filter(m => m.online);
    $c('chatSub').textContent = team ? `${team.name} · ${on.length} online` : '';
    $c('chatFaces').innerHTML = on.slice(0, 4).map(m => avatar(m.name)).join('') + (on.length > 4 ? `<span class="more">+${on.length - 4}</span>` : '');
  }

  // ---------- public ----------
  return {
    attach(s) {
      socket = s;
      s.on('chat:history', list => { msgs = list; unread = 0; paint({ bottom: true }); });
      s.on('chat', m => {
        msgs.push(m); if (msgs.length > 150) msgs = msgs.slice(-150);
        if (m.userId) typers.delete(m.userId), paintTyping();
        const el = $c('chatList');
        const atBottom = el && !$c('chatPanel').hidden && el.scrollHeight - el.scrollTop - el.clientHeight < 60;
        const mine = m.userId === me?.id;
        if (!mine && (!isOpen() || !atBottom)) { unread++; if (mentionsMe(m)) mentioned = true; }
        paint({ bottom: mine });
      });
      s.on('chat:react', ({ id, reactions }) => {
        const m = msgs.find(x => x.id === id); if (!m) return;
        m.reactions = reactions; paint({ keep: true });
      });
      s.on('typing', ({ id, name }) => {
        if (id === me?.id) return;
        typers.set(id, { name, until: Date.now() + 3500 }); paintTyping();
        setTimeout(paintTyping, 3600);
      });
      s.on('chat:slow', () => toast('Slow down a little. Try again in a few seconds.'));
    },
    update(state) {
      if (!$c('chatPanel')) build();
      const teamChanged = (state.team && state.team.id) !== (team && team.id);
      me = state.me; team = state.team; members = state.members || [];
      if (teamChanged) { msgs = []; unread = 0; mentioned = false; setReply(null); typers.clear(); paintTyping(); }
      layout(); header();
      if (teamChanged) paint({ bottom: true });
    },
  };
})();

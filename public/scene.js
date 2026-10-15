'use strict';
// Bible Quiz scene painter. Builds each illustration from a backdrop, weather/light effects and emoji,
// with a fresh random layout (clouds, stars, waves, rain, sun position, small wobbles) from the round's seed.

const SCENES = {
  sea:    { sky: ['#7CC6EE', '#DDF2FB'], ground: 'water', y: 178, g: ['#2F86C0', '#174E7C'] },
  storm:  { sky: ['#4B5A70', '#93A2B6'], ground: 'water', y: 178, g: ['#2B587E', '#112A44'], dark: true },
  desert: { sky: ['#F4BE7E', '#FCEBCB'], ground: 'dunes', y: 186, g: ['#E7B86C', '#C98F45'] },
  night:  { sky: ['#0B1534', '#2C3F75'], ground: 'hills', y: 206, g: ['#1D2A4F', '#10182F'], dark: true },
  garden: { sky: ['#9AD6F8', '#E8F7FF'], ground: 'hills', y: 190, g: ['#86C96F', '#4E9A45'] },
  field:  { sky: ['#A9DAF7', '#F1FAFF'], ground: 'field', y: 196, g: ['#E0C766', '#B49A3A'] },
  river:  { sky: ['#A6DCF6', '#EEF9FF'], ground: 'river', y: 184, g: ['#86C46C', '#4F9446'], w: '#3E8FCC' },
  cave:   { sky: ['#1E1713', '#3D2F26'], ground: 'cave', y: 214, g: ['#5C4A3D', '#2A201A'], dark: true },
  town:   { sky: ['#A3D2F1', '#EAF6FD'], ground: 'walls', y: 196, g: ['#DCC08D', '#B8955E'] },
  palace: { sky: ['#4A2342', '#874A6B'], ground: 'floor', y: 222, g: ['#D3AE57', '#8E6B25'], dark: true },
  feast:  { sky: ['#4E3220', '#86593A'], ground: 'table', y: 204, g: ['#AE7A43', '#6E4522'], dark: true },
  heaven: { sky: ['#FFE9A8', '#FFFDF4'], ground: null, radial: true },
  // Love Quiz backdrops
  sunset:     { sky: ['#FF8A80', '#FFD3A5'], ground: 'water', y: 192, g: ['#E0708A', '#6E2C55'] },
  rosegarden: { sky: ['#FFC9D6', '#FFF1F4'], ground: 'hedge', y: 196, g: ['#6FAE6E', '#3F7F44'] },
  dinner:     { sky: ['#2E1020', '#6A2840'], ground: 'table', y: 206, g: ['#8E3E58', '#4A1A2C'], dark: true },
  balcony:    { sky: ['#0E1238', '#3B2D6E'], ground: 'balustrade', y: 214, g: ['#E6DCD2', '#B9A999'], dark: true },
  wedding:    { sky: ['#FFE3EA', '#FFFFFF'], ground: 'aisle', y: 196, g: ['#F4E7DC', '#E2CDBB'] },
  city:       { sky: ['#160C2E', '#55306E'], ground: 'skyline', y: 214, g: ['#24163F', '#120A22'], dark: true },
};

function drawScene(sc) {
  const r = rng(sc.seed || 1), j = n => (r() * 2 - 1) * n, rr = (a, b) => a + r() * (b - a);
  const fx = new Set(sc.fx || []), id = 'sc' + (sc.seed || 1) % 1e6;
  let S = SCENES[sc.s] || SCENES.garden;
  // A moon over a daytime backdrop turns it to dusk.
  if (fx.has('moon') && !S.dark) { S = { ...S, sky: ['#1B2550', '#6B6A9A'], dark: true }; fx.add('stars'); }
  const defs = [], back = [], front = [];
  const grad = (name, a, b, x2 = 0, y2 = 1) => defs.push(`<linearGradient id="${id}${name}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`);

  // sky
  if (S.radial) defs.push(`<radialGradient id="${id}sky" cx="50%" cy="22%" r="85%"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".45" stop-color="${S.sky[1]}"/><stop offset="1" stop-color="${S.sky[0]}"/></radialGradient>`);
  else grad('sky', S.sky[0], S.sky[1]);
  back.push(`<rect width="300" height="300" fill="url(#${id}sky)"/>`);

  // effects that sit in the sky, behind the ground
  if (fx.has('light')) for (let k = 0; k < 6; k++) { const x = 150 + j(20), a = -60 + k * 24 + j(6); back.push(`<polygon points="${x},-10 ${x + Math.tan(a * Math.PI / 180) * 320 - 16},300 ${x + Math.tan(a * Math.PI / 180) * 320 + 16},300" fill="#FFF6C8" opacity="${rr(.18, .32).toFixed(2)}"/>`); }
  if (fx.has('stars') || S.dark && sc.s === 'night') for (let k = 0; k < 46; k++) back.push(`<circle cx="${rr(4, 296).toFixed(1)}" cy="${rr(4, (S.y || 200) - 20).toFixed(1)}" r="${rr(.6, 1.9).toFixed(1)}" fill="#FFF7D6" opacity="${rr(.45, 1).toFixed(2)}"/>`);
  if (fx.has('sun')) { const cx = r() < .5 ? rr(36, 70) : rr(230, 264), cy = rr(36, 62);
    for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6 + j(.1); back.push(`<line x1="${cx + Math.cos(a) * 26}" y1="${cy + Math.sin(a) * 26}" x2="${cx + Math.cos(a) * 38}" y2="${cy + Math.sin(a) * 38}" stroke="#FFC93C" stroke-width="4" stroke-linecap="round"/>`); }
    back.push(`<circle cx="${cx}" cy="${cy}" r="20" fill="#FFD54F"/>`); }
  if (fx.has('moon')) { const cx = r() < .5 ? rr(40, 70) : rr(230, 262), cy = rr(36, 58);
    defs.push(`<mask id="${id}moon"><rect width="300" height="300" fill="#fff"/><circle cx="${cx + 8}" cy="${cy - 5}" r="16" fill="#000"/></mask>`);
    back.push(`<circle cx="${cx}" cy="${cy}" r="18" fill="#FFF3C4" mask="url(#${id}moon)"/>`); }
  if (fx.has('clouds')) for (let k = 0; k < 3; k++) {
    const cx = 40 + k * 110 + j(20), cy = rr(30, 70), c = S.dark || sc.s === 'storm' ? '#6E7C90' : '#FFFFFF', o = S.dark ? .9 : .92;
    back.push(`<g opacity="${o}" fill="${c}"><ellipse cx="${cx}" cy="${cy}" rx="34" ry="14"/><ellipse cx="${cx - 16}" cy="${cy - 8}" rx="16" ry="13"/><ellipse cx="${cx + 12}" cy="${cy - 12}" rx="20" ry="16"/></g>`); }
  if (fx.has('glow')) { defs.push(`<radialGradient id="${id}glow"><stop offset="0" stop-color="#FFE38A" stop-opacity=".85"/><stop offset="1" stop-color="#FFE38A" stop-opacity="0"/></radialGradient>`);
    back.push(`<circle cx="150" cy="${(S.y || 200) - 50}" r="130" fill="url(#${id}glow)"/>`); }

  // ground
  const y = S.y || 300;
  if (S.ground) grad('gr', S.g[0], S.g[1]);
  const water = fx.has('redriver') ? ['#B23A3A', '#6E1515'] : S.g;
  switch (S.ground) {
    case 'water':
      grad('wa', water[0], water[1]);
      if (fx.has('split')) {
        back.push(`<rect y="${y}" width="300" height="${300 - y}" fill="#D9B77A"/>`);
        back.push(`<path d="M0 ${y - 70} Q30 ${y - 92} 60 ${y - 72} Q90 ${y - 90} 112 ${y - 66} L104 300 L0 300 Z" fill="url(#${id}wa)"/>`);
        back.push(`<path d="M300 ${y - 70} Q270 ${y - 92} 240 ${y - 72} Q210 ${y - 90} 188 ${y - 66} L196 300 L300 300 Z" fill="url(#${id}wa)"/>`);
        for (let k = 0; k < 6; k++) { const side = k % 2, x0 = side ? 230 : 10, yy = y - 50 + k * 22; back.push(`<path d="M${x0} ${yy} q15 -8 30 0 t30 0" stroke="#CFEAFF" stroke-width="2.5" fill="none" opacity=".7"/>`); }
      } else back.push(`<rect y="${y}" width="300" height="${300 - y}" fill="url(#${id}wa)"/>`);
      break;
    case 'dunes':
      back.push(`<path d="M0 ${y} Q${70 + j(20)} ${y - 26} 150 ${y - 4} T300 ${y - 10} V300 H0 Z" fill="${S.g[0]}"/>`);
      back.push(`<path d="M0 ${y + 30} Q${100 + j(20)} ${y + 6} 190 ${y + 26} T300 ${y + 22} V300 H0 Z" fill="${S.g[1]}" opacity=".9"/>`);
      break;
    case 'hills':
      back.push(`<path d="M0 ${y} Q${80 + j(20)} ${y - 40} 170 ${y - 6} T300 ${y - 18} V300 H0 Z" fill="${S.g[0]}"/>`);
      back.push(`<path d="M0 ${y + 34} Q${120 + j(20)} ${y + 6} 220 ${y + 30} T300 ${y + 26} V300 H0 Z" fill="${S.g[1]}"/>`);
      break;
    case 'field':
      back.push(`<rect y="${y}" width="300" height="${300 - y}" fill="url(#${id}gr)"/>`);
      for (let k = 0; k < 7; k++) back.push(`<line x1="${-40 + k * 60}" y1="300" x2="${120 + k * 12}" y2="${y}" stroke="${S.g[1]}" stroke-width="2" opacity=".5"/>`);
      break;
    case 'river':
      back.push(`<rect y="${y}" width="300" height="${300 - y}" fill="url(#${id}gr)"/>`);
      back.push(`<path d="M0 ${y + 40} C90 ${y + 20} 180 ${y + 70} 300 ${y + 44} L300 ${y + 86} C190 ${y + 106} 100 ${y + 60} 0 ${y + 84} Z" fill="${fx.has('redriver') ? '#A3242A' : S.w}"/>`);
      for (let k = 0; k < 4; k++) back.push(`<path d="M${30 + k * 70} ${y + 60 + j(6)} q10 -5 20 0" stroke="#FFFFFF" stroke-width="2" fill="none" opacity=".55"/>`);
      break;
    case 'cave':
      back.push(`<path d="M-10 300 L-10 ${y - 120} Q150 ${y - 260} 310 ${y - 120} L310 300 Z" fill="#000" opacity=".35"/>`);
      back.push(`<ellipse cx="150" cy="${y + 40}" rx="190" ry="70" fill="url(#${id}gr)"/>`);
      for (let k = 0; k < 5; k++) back.push(`<path d="M${20 + k * 64 + j(8)} 0 l8 ${rr(18, 34).toFixed(0)} l8 -${rr(18, 34).toFixed(0)} Z" fill="#14100D" opacity=".8"/>`);
      break;
    case 'walls':
      back.push(`<rect y="${y - 60}" width="300" height="${360 - y}" fill="url(#${id}gr)"/>`);
      for (let yy = y - 60; yy < 300; yy += 18) for (let x = ((yy / 18) % 2) * 20 - 20; x < 300; x += 40) back.push(`<rect x="${x}" y="${yy}" width="40" height="18" fill="none" stroke="#9C7A45" stroke-width="1.2" opacity=".55"/>`);
      for (let x = 0; x < 300; x += 30) back.push(`<rect x="${x}" y="${y - 74}" width="18" height="14" fill="${S.g[0]}"/>`);
      break;
    case 'floor':
      for (let x = 0; x < 300; x += 30) for (let yy = y; yy < 300; yy += 20) back.push(`<rect x="${x + ((yy - y) / 20 % 2) * 15 - 15}" y="${yy}" width="30" height="20" fill="${((x + yy) / 10) % 2 ? S.g[0] : S.g[1]}" opacity=".9"/>`);
      back.push(`<path d="M0 0 H54 Q40 120 62 ${y} H0 Z" fill="#7A1F3D"/><path d="M300 0 H246 Q260 120 238 ${y} H300 Z" fill="#7A1F3D"/>`);
      back.push(`<path d="M0 0 H300 V18 Q150 40 0 18 Z" fill="#8E2A4A"/>`);
      break;
    case 'hedge':
      back.push(`<rect y="${y}" width="300" height="${300 - y}" fill="url(#${id}gr)"/>`);
      for (let x = -10; x < 310; x += 26) back.push(`<circle cx="${x + j(4)}" cy="${y + j(3)}" r="${rr(16, 22)}" fill="${S.g[1]}"/>`);
      for (let k = 0; k < 16; k++) back.push(`<circle cx="${rr(4, 296)}" cy="${y + rr(-14, 30)}" r="${rr(3, 5)}" fill="${r() < .6 ? '#E2385B' : '#FF8FAB'}"/>`);
      break;
    case 'balustrade':
      back.push(`<rect y="${y}" width="300" height="${300 - y}" fill="${S.g[1]}"/>`);
      back.push(`<rect y="${y - 8}" width="300" height="12" rx="3" fill="${S.g[0]}"/>`);
      for (let x = 8; x < 300; x += 24) back.push(`<path d="M${x} ${y + 4} q-7 18 0 36 q7 18 0 36 h12 q-7 -18 0 -36 q7 -18 0 -36 Z" fill="${S.g[0]}" opacity=".95"/>`);
      break;
    case 'aisle':
      back.push(`<rect y="${y}" width="300" height="${300 - y}" fill="url(#${id}gr)"/>`);
      back.push(`<path d="M126 ${y} L174 ${y} L232 300 L68 300 Z" fill="#C2234B" opacity=".9"/>`);
      for (let k = 0; k < 4; k++) { const yy = y + 14 + k * 24; back.push(`<rect x="${10 - k * 6}" y="${yy}" width="${70 - k * 8 + k * 6}" height="10" rx="3" fill="#FFFFFF" opacity=".85"/><rect x="${220 + k * 2}" y="${yy}" width="${70 + k * 4}" height="10" rx="3" fill="#FFFFFF" opacity=".85"/>`); }
      break;
    case 'skyline':
      for (let x = -6, k = 0; x < 300; k++) { const w = rr(22, 40), h = rr(40, 110); back.push(`<rect x="${x}" y="${y - h}" width="${w}" height="${h + 300 - y}" fill="${k % 2 ? S.g[0] : S.g[1]}"/>`);
        for (let wy = y - h + 8; wy < y - 6; wy += 12) for (let wx = x + 5; wx < x + w - 6; wx += 9) if (r() < .45) back.push(`<rect x="${wx}" y="${wy}" width="4" height="5" fill="#FFD27A" opacity=".85"/>`);
        x += w + 2; }
      back.push(`<rect y="${y}" width="300" height="${300 - y}" fill="${S.g[1]}"/>`);
      break;
    case 'table':
      back.push(`<rect y="${y - 6}" width="300" height="${306 - y}" fill="url(#${id}gr)"/>`);
      back.push(`<rect y="${y - 10}" width="300" height="8" fill="#C99A63"/>`);
      for (let k = 0; k < 3; k++) back.push(`<circle cx="${50 + k * 100 + j(10)}" cy="${rr(26, 50)}" r="${rr(14, 22)}" fill="#FFCF7A" opacity=".25"/>`);
      break;
  }
  if (fx.has('waves') && S.ground === 'water') for (let k = 0; k < 4; k++) {
    const yy = y + 12 + k * 26 + j(4); let d = `M-10 ${yy}`;
    for (let x = -10; x < 310; x += 40) d += ` q10 ${-8 - j(3)} 20 0 t20 0`;
    back.push(`<path d="${d}" stroke="#FFFFFF" stroke-width="2.6" fill="none" opacity="${(.65 - k * .1).toFixed(2)}"/>`);
  }

  // fire burns along the horizon, behind the people
  if (fx.has('fire')) for (let k = 0; k < 9; k++) {
    const x = rr(-10, 310), h = rr(30, 70), b = Math.min(y, 290) + rr(-6, 10);
    back.push(`<path d="M${x - 14} ${b} Q${x - 18} ${b - h * .6} ${x} ${b - h} Q${x + 18} ${b - h * .6} ${x + 14} ${b} Z" fill="#FF7A1A" opacity=".85"/><path d="M${x - 7} ${b} Q${x - 9} ${b - h * .4} ${x} ${b - h * .65} Q${x + 9} ${b - h * .4} ${x + 7} ${b} Z" fill="#FFD23F"/>`);
  }
  // effects in front of the scene
  if (fx.has('rain')) for (let k = 0; k < 60; k++) { const x = rr(-20, 300), yy = rr(-10, 290); front.push(`<line x1="${x}" y1="${yy}" x2="${x - 6}" y2="${yy + 16}" stroke="#D6ECFF" stroke-width="1.6" opacity=".7"/>`); }
  if (fx.has('flakes')) for (let k = 0; k < 44; k++) front.push(`<circle cx="${rr(0, 300)}" cy="${rr(0, y)}" r="${rr(1.5, 3.2)}" fill="#FFFFFF" opacity=".9"/>`);
  const heart = (x, yy, sz, fill, o) => `<path transform="translate(${x.toFixed(1)} ${yy.toFixed(1)}) scale(${sz.toFixed(2)}) rotate(${j(18).toFixed(0)})" d="M0 -3 C-5 -11 -16 -4 -9 4 L0 12 L9 4 C16 -4 5 -11 0 -3 Z" fill="${fill}" opacity="${o}"/>`;
  if (fx.has('hearts')) for (let k = 0; k < 10; k++) front.push(heart(rr(10, 290), rr(10, (S.y || 240) - 10), rr(.7, 1.8), ['#FF4D6D', '#FF8FAB', '#E5383B', '#FFB3C6'][k % 4], rr(.55, .9).toFixed(2)));
  if (fx.has('petals')) for (let k = 0; k < 26; k++) { const cx = rr(0, 300), cy = rr(0, 300); front.push(`<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${rr(3, 6).toFixed(1)}" ry="${rr(1.6, 3).toFixed(1)}" transform="rotate(${rr(0, 180).toFixed(0)} ${cx.toFixed(1)} ${cy.toFixed(1)})" fill="${r() < .5 ? '#E2385B' : '#FF7A93'}" opacity="${rr(.6, .95).toFixed(2)}"/>`); }
  if (fx.has('sparkle')) for (let k = 0; k < 18; k++) { const x = rr(6, 294), yy = rr(6, 200), z = rr(3, 7); front.push(`<path d="M${x} ${yy - z} L${x + z * .3} ${yy - z * .3} L${x + z} ${yy} L${x + z * .3} ${yy + z * .3} L${x} ${yy + z} L${x - z * .3} ${yy + z * .3} L${x - z} ${yy} L${x - z * .3} ${yy - z * .3} Z" fill="#FFF3C4" opacity="${rr(.6, 1).toFixed(2)}"/>`); }
  if (fx.has('wind')) for (let k = 0; k < 4; k++) { const yy = rr(40, 160), x = rr(10, 160); front.push(`<path d="M${x} ${yy} q40 -14 80 0 q20 8 10 18" stroke="#FFFFFF" stroke-width="3" fill="none" stroke-linecap="round" opacity=".6"/>`); }

  // characters and objects
  const emoji = (sc.e || []).map(e => {
    if (e.k === 'p') return `<path d="${e.d}" stroke="${e.c}" stroke-width="${e.w}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    const x = e.x + j(3), yy = e.y + j(3), rot = (e.r || 0) + j(4), sx = e.flip ? -1 : 1;
    const label = !/\p{Extended_Pictographic}|️|⃣/u.test(e.t);
    const font = label ? `font-family='Kalam,"Comic Sans MS",cursive' font-weight="700" fill="${e.c || '#1C2230'}"` : `font-family='"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'`;
    return `<g transform="translate(${x.toFixed(1)} ${yy.toFixed(1)}) rotate(${rot.toFixed(1)}) scale(${sx} 1)"${e.o != null ? ` opacity="${e.o}"` : ''}><text font-size="${e.s}" text-anchor="middle" dominant-baseline="central" ${font}>${esc(e.t)}</text></g>`;
  }).join('');

  return `<svg viewBox="0 0 300 300" role="img" aria-label="Bible scene"><defs>${defs.join('')}</defs>${back.join('')}${emoji}${front.join('')}</svg>`;
}

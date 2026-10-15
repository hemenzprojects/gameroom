const NOTES=['#FFF1A1','#D6F2B0','#FFD3E2','#CDE6FF','#FFDDB5'];
const INKS=['#1C2230','#1C2230','#1D3E9A','#9C2A1E'];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const isEmoji=s=>/\p{Extended_Pictographic}/u.test(s);
// ---------- note renderer: a fresh look every time from the puzzle's seed ----------
function drawNote(p,seed){
  const r=rng(seed), pick=a=>a[Math.floor(r()*a.length)], j=n=>(r()*2-1)*n;
  const bg=pick(NOTES), ink=pick(INKS), tilt=j(2.5);
  let svg='';
  for(const e of p.e){
    if(e.k==='t'){
      const x=e.x+j(4),y=e.y+j(4),rot=(e.r||0)+j(isEmoji(e.t)?6:3);
      svg+=`<g transform="rotate(${rot.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})"><text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${e.s}" fill="${ink}" font-family='Kalam,"Comic Sans MS",cursive' font-weight="700" text-anchor="middle" dominant-baseline="central"${e.ls?` letter-spacing="${e.ls}"`:''}>${esc(e.t)}</text>`;
      if(e.deco){const w=e.s*.6*e.t.length/2+8,ly=e.deco==='u'?y+e.s*.5:y;svg+=`<line x1="${x-w}" y1="${ly}" x2="${x+w}" y2="${ly+j(3)}" stroke="${ink}" stroke-width="5" stroke-linecap="round"/>`}
      svg+='</g>';
    }else if(e.k==='l'){
      svg+=`<line x1="${e.x1+j(3)}" y1="${e.y1+j(3)}" x2="${e.x2+j(3)}" y2="${e.y2+j(3)}" stroke="${ink}" stroke-width="5" stroke-linecap="round"/>`;
    }else if(e.k==='r'){
      svg+=`<rect x="${e.x}" y="${e.y}" width="${e.w}" height="${e.h}" rx="6" fill="none" stroke="${ink}" stroke-width="5" transform="rotate(${j(2).toFixed(1)} ${e.x+e.w/2} ${e.y+e.h/2})"/>`;
    }else if(e.k==='p'){
      svg+=`<path d="${e.d}" fill="none" stroke="${ink}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
  }
  return {bg,tilt,svg:`<svg viewBox="0 0 300 300" role="img" aria-label="Rebus puzzle">${svg}</svg>`};
}


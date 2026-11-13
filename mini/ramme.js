// Rammen rundt minispillene: fullskjerm lerret, startkort, poeng, hjelpehånd, sluttskjerm med stjerner, lyd.
// Hvert minispill er en egen fil i mini/ som bare tegner og reagerer på pekeren. Se mini/LES.md.
// Ingen nettverk, ingen lenker ut, ingen tale. Unngår toppnivå-await, regex-lookbehind og structuredClone.

const STIL = `
#mRot { position: fixed; inset: 0; z-index: 40; background: #fdf3dc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; color: #2a1d10;
  user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; touch-action: none; overflow: hidden; }
#mRot canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; }
#mRot button { font-family: inherit; border: 0; cursor: pointer; -webkit-tap-highlight-color: transparent; touch-action: manipulation; color: #2a1d10; }
#mTopp { position: absolute; top: calc(10px + env(safe-area-inset-top, 0px)); left: calc(10px + env(safe-area-inset-left, 0px)); right: calc(10px + env(safe-area-inset-right, 0px));
  display: flex; gap: 10px; align-items: center; pointer-events: none; z-index: 5; }
#mTopp > * { pointer-events: auto; }
#mRot:not([data-fase="spill"]) #mPoeng, #mRot:not([data-fase="spill"]) #mStolpe { display: none; }
.mRund { width: 58px; height: 58px; border-radius: 50%; background: rgba(255,250,240,.94); box-shadow: 0 3px 10px rgba(0,0,0,.25); font-size: 28px; line-height: 58px; padding: 0; }
.mRund:active { transform: scale(.94); }
#mPoeng { background: rgba(255,250,240,.94); border-radius: 999px; padding: 0 16px 0 12px; height: 46px; display: flex; align-items: center; gap: 8px; font-size: 22px; font-weight: 700;
  box-shadow: 0 3px 10px rgba(0,0,0,.25); font-variant-numeric: tabular-nums; pointer-events: none; }
#mPoeng.hopp { animation: mHopp .3s; }
@keyframes mHopp { 50% { transform: scale(1.2); } }
#mStolpe { flex: 1; height: 14px; border-radius: 7px; background: rgba(255,250,240,.75); box-shadow: 0 2px 6px rgba(0,0,0,.2); overflow: hidden; visibility: hidden; pointer-events: none; }
#mStolpe i { display: block; height: 100%; width: 0; background: linear-gradient(90deg, #f5d33c, #f2a541); border-radius: 7px; transition: width .25s; }
#mKort, #mSlutt { position: absolute; inset: 0; display: none; flex-direction: column; align-items: center; justify-content: center; gap: 14px; text-align: center;
  background: radial-gradient(circle, rgba(255,246,222,.97), rgba(246,196,112,.97)); padding: 20px; z-index: 2; }
#mKort.vis, #mSlutt.vis { display: flex; }
#mKort .ikon { font-size: min(120px, 22vh); line-height: 1.1; animation: mInn .5s; }
@keyframes mInn { from { transform: scale(.3) rotate(-30deg); opacity: 0; } }
#mKort h2 { margin: 0; font-size: 30px; color: #6b4219; }
#mKort .hjelp { position: relative; width: 150px; height: 84px; border-radius: 18px; background: rgba(255,255,255,.55); }
#mKort .hjelp b { position: absolute; left: 50%; top: 50%; font-size: 44px; margin: -26px 0 0 -20px; }
#mKort .hjelp.trykk b { animation: mTrykk 1s infinite; }
#mKort .hjelp.hold b { animation: mHold 1.8s infinite; }
#mKort .hjelp.dra b { animation: mDra 1.6s infinite; }
#mKort .hjelp.sveip b { animation: mSveip 1.2s infinite; }
@keyframes mTrykk { 0%, 100% { transform: translateY(8px) scale(1); } 50% { transform: translateY(0) scale(.82); } }
@keyframes mHold { 0%, 100% { transform: scale(1); } 15%, 75% { transform: scale(.8); } }
@keyframes mDra { 0% { transform: translateX(-42px); } 60%, 100% { transform: translateX(42px); } }
@keyframes mSveip { 0% { transform: translateX(-36px); opacity: 1; } 70% { transform: translateX(36px); opacity: 1; } 100% { transform: translateX(36px); opacity: 0; } }
.mStor { width: 112px; height: 112px; border-radius: 50%; background: #3fb36b; color: #fff !important; font-size: 54px; box-shadow: 0 5px 16px rgba(0,0,0,.3); padding: 0; }
.mStor.grå { background: rgba(255,250,240,.95); color: #2a1d10 !important; width: 84px; height: 84px; font-size: 40px; }
.mStor:active { transform: scale(.94); }
#mSlutt .stj { font-size: min(84px, 20vw); letter-spacing: 6px; height: 1.2em; }
#mSlutt .stj span { display: inline-block; opacity: .22; filter: grayscale(1); transform: scale(.8); transition: all .3s cubic-bezier(.3,1.8,.5,1); }
#mSlutt .stj span.på { opacity: 1; filter: none; transform: scale(1); }
#mSlutt .tall { font-size: 34px; font-weight: 800; color: #6b4219; display: flex; gap: 18px; align-items: center; justify-content: center; font-variant-numeric: tabular-nums; }
#mSlutt .rad { display: flex; gap: 26px; align-items: center; }
.mMynt { display: inline-block; width: .85em; height: .85em; border-radius: 50%; vertical-align: -.1em; background: radial-gradient(circle at 35% 30%, #fff4b0, #f4c430 45%, #b8860b);
  box-shadow: inset 0 0 0 .07em #d9a520, 0 1px 2px rgba(0,0,0,.3); }
#mHånd { position: absolute; left: 0; top: 0; font-size: 46px; margin: -6px 0 0 -18px; pointer-events: none; display: none; filter: drop-shadow(0 2px 3px rgba(0,0,0,.35)); will-change: transform; }
.mKonf { position: absolute; top: -20px; width: 12px; height: 18px; border-radius: 3px; pointer-events: none; animation: mFall linear forwards; }
@keyframes mFall { to { transform: translateY(110vh) rotate(720deg); } }
`;

let stilLagt = false;
let aktiv = null;

// ---------------------------------------------------------------- lyd (WebAudio, ingen filer)
function lagLyd(på) {
  const AC = window.AudioContext || window.webkitAudioContext;
  let ac = window.HUS_LYD || null, master = null, støyBuf = null;
  function klar() {
    if (!på()) return false;
    try {
      if (!ac && AC) ac = window.HUS_LYD = new AC();
      if (!ac) return false;
      if (ac.state === 'suspended') ac.resume();
      if (!master) {
        master = ac.createGain(); master.gain.value = 0.5; master.connect(ac.destination);
        støyBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
        const d = støyBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      return true;
    } catch (e) { return false; }
  }
  function tone(f, t0, dur, o) {
    o = o || {};
    const t = ac.currentTime + t0, osc = ac.createOscillator(), g = ac.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(f, t);
    if (o.til) osc.frequency.exponentialRampToValueAtTime(o.til, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol === undefined ? 0.2 : o.vol, t + (o.inn || 0.012));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(master);
    osc.start(t); osc.stop(t + dur + 0.05);
  }
  function støy(t0, dur, o) {
    o = o || {};
    const t = ac.currentTime + t0, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = støyBuf; s.loop = true;
    f.type = o.type || 'bandpass'; f.Q.value = o.q || 1;
    f.frequency.setValueAtTime(o.f || 1000, t);
    if (o.til) f.frequency.exponentialRampToValueAtTime(o.til, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol || 0.2, t + (o.inn || 0.02));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t); s.stop(t + dur + 0.05);
  }
  const L = (fn) => function () { if (klar()) fn.apply(null, arguments); };
  return {
    klikk: L(() => tone(1200, 0, 0.04, { vol: 0.06 })),
    pling: L(() => [784, 988, 1175].forEach((f, i) => tone(f, i * 0.07, 0.3, { type: 'triangle', vol: 0.16 }))),
    mynt: L(() => { tone(988, 0, 0.12, { type: 'square', vol: 0.07 }); tone(1319, 0.08, 0.35, { type: 'square', vol: 0.07 }); }),
    pop: L(() => { støy(0, 0.12, { f: 1800, q: 0.7, vol: 0.45, inn: 0.003 }); tone(600, 0, 0.12, { til: 120, vol: 0.18 }); }),
    plopp: L(() => tone(320, 0, 0.14, { til: 760, vol: 0.2 })),
    hopp: L(() => tone(380, 0, 0.16, { til: 900, type: 'triangle', vol: 0.16 })),
    sprett: L(() => tone(520, 0, 0.09, { til: 260, type: 'triangle', vol: 0.16 })),
    dunk: L(() => { støy(0, 0.1, { f: 220, q: 0.8, vol: 0.5, type: 'lowpass', inn: 0.003 }); tone(160, 0, 0.12, { til: 70, vol: 0.25 }); }),
    sus: L(() => støy(0, 0.3, { f: 500, til: 2600, q: 2, vol: 0.2, inn: 0.08 })),
    plask: L(() => { støy(0, 0.25, { f: 700, til: 2400, q: 2, vol: 0.28 }); tone(900, 0.05, 0.08, { til: 1800, vol: 0.06 }); }),
    hmm: L(() => { tone(392, 0, 0.2, { type: 'triangle', vol: 0.13 }); tone(330, 0.18, 0.28, { type: 'triangle', vol: 0.13 }); }),
    bra: L(() => [659, 880].forEach((f, i) => tone(f, i * 0.09, 0.22, { type: 'triangle', vol: 0.17 }))),
    tone: L((n, vol) => tone(262 * Math.pow(2, (n || 0) / 12), 0, 0.22, { type: 'triangle', vol: vol || 0.16 })),      // n = halvtoner over C, til stigende rekker
    stjerne: L((n) => { for (let i = 0; i < n; i++) tone(1047 * Math.pow(1.26, i), i * 0.15, 0.3, { type: 'triangle', vol: 0.15 }); }),
    fanfare: L(() => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i * 0.13, i === 5 ? 0.7 : 0.18, { type: 'square', vol: 0.06 }))),
  };
}

// ---------------------------------------------------------------- selve rammen
// def = standardeksporten fra et minispill. o = { lydPå: () => bool, beste: tall, test: bool }
// Løser til { stjerner, poeng, runder } når barnet trykker ferdig, eller null hvis det lukker underveis.
export function startMini(def, o) {
  o = o || {};
  if (aktiv) aktiv.lukk(null);
  if (!stilLagt) { const s = document.createElement('style'); s.textContent = STIL; document.head.appendChild(s); stilLagt = true; }
  return new Promise((løs) => {
    const rot = document.createElement('div');
    rot.id = 'mRot'; rot.dataset.fase = 'kort';
    rot.style.background = def.bakgrunn || '#fdf3dc';
    rot.innerHTML = `<canvas></canvas>
      <div id="mTopp"><button class="mRund" id="mLukk" aria-label="Lukk spillet">✕</button><div id="mPoeng"><span>${def.poengIkon || '⭐'}</span><b>0</b></div><div id="mStolpe"><i></i></div></div>
      <div id="mHånd">👆</div><i id="mSikker" style="position:absolute;left:0;bottom:0;width:0;height:env(safe-area-inset-bottom,0px);pointer-events:none"></i>
      <div id="mKort"><div class="ikon">${def.ikon || '🎮'}</div><h2></h2><div class="hjelp ${def.hjelp || 'trykk'}"><b>👆</b></div><button class="mStor" id="mStart" aria-label="Start">▶</button></div>
      <div id="mSlutt"><div class="stj"><span>⭐</span><span>⭐</span><span>⭐</span></div><div class="tall"></div>
        <div class="rad"><button class="mStor grå" id="mIgjen" aria-label="En gang til">↻</button><button class="mStor" id="mFerdig" aria-label="Ferdig">✔</button></div></div>`;
    document.body.appendChild(rot);
    const $ = (id) => rot.querySelector('#' + id);
    $('mKort').querySelector('h2').textContent = def.navn || '';
    const canvas = rot.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const lyd = lagLyd(() => (o.lydPå ? o.lydPå() : true));
    let w = 0, h = 0, dpr = 1, fase = 'kort', spill = null, løkkeFn = null, pekerFn = null, størrelseFn = null, raf = 0, sist = 0, tid = 0;
    let poeng = 0, runder = 0, resultat = null, stille = 0, håndT = 0, lukket = false, mynterGitt = 0;
    const sprut = [];           // felles partikler, tegnes oppå spillet
    const sprites = new Map();

    function måle() {
      const r = rot.getBoundingClientRect();
      w = Math.max(200, Math.round(r.width)); h = Math.max(200, Math.round(r.height));
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (størrelseFn) størrelseFn(w, h);
    }
    function trygg() {
      const cs = getComputedStyle($('mTopp'));
      const topp = (parseFloat(cs.top) || 10) + 58 + 10;
      return { topp, bunn: 14 + ($('mSikker').offsetHeight || 0), venstre: parseFloat(cs.left) || 10, høyre: parseFloat(cs.right) || 10 };
    }
    // emoji tegnes én gang til et lite lerret og gjenbrukes: fillText med emoji hver ramme er tregt på telefon
    function sprite(tegn, px) {
      px = Math.max(8, Math.round(px));
      const k = tegn + '|' + px;
      let c = sprites.get(k);
      if (!c) {
        c = document.createElement('canvas');
        const s = Math.ceil(px * 1.4 * dpr);
        c.width = c.height = s;
        const x = c.getContext('2d');
        x.font = (px * dpr) + 'px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
        x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(tegn, s / 2, s / 2 + px * dpr * 0.06);
        c._s = s / dpr;
        if (sprites.size > 400) sprites.clear();
        sprites.set(k, c);
      }
      return c;
    }
    function emoji(tegn, x, y, px, rot_, alfa) {
      const c = sprite(tegn, px);
      if (alfa !== undefined) ctx.globalAlpha = alfa;
      if (rot_) { ctx.save(); ctx.translate(x, y); ctx.rotate(rot_); ctx.drawImage(c, -c._s / 2, -c._s / 2, c._s, c._s); ctx.restore(); }
      else ctx.drawImage(c, x - c._s / 2, y - c._s / 2, c._s, c._s);
      if (alfa !== undefined) ctx.globalAlpha = 1;
    }
    function rundRekt(x, y, bw, bh, r) {
      r = Math.min(r, bw / 2, bh / 2);
      ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + bw, y, x + bw, y + bh, r); ctx.arcTo(x + bw, y + bh, x, y + bh, r); ctx.arcTo(x, y + bh, x, y, r); ctx.arcTo(x, y, x + bw, y, r); ctx.closePath();
    }
    function settPoeng(n) {
      if (n === poeng) return;
      poeng = n; $('mPoeng').querySelector('b').textContent = n;
      const e = $('mPoeng'); e.classList.remove('hopp'); void e.offsetWidth; e.classList.add('hopp');
    }
    const api = {
      canvas, ctx, lyd, emoji, sprite, rundRekt,
      get w() { return w; }, get h() { return h; }, get trygg() { return trygg(); }, get tid() { return tid; },
      get beste() { return o.beste || 0; }, test: !!o.test,
      rnd: o.rnd || Math.random,
      løkke(fn) { løkkeFn = fn; },
      peker(fn) { pekerFn = fn; },
      vedStørrelse(fn) { størrelseFn = fn; },
      poeng(n) { settPoeng(Math.max(0, Math.round(n))); },
      framgang(k) { $('mStolpe').style.visibility = 'visible'; $('mStolpe').firstElementChild.style.width = Math.round(Math.max(0, Math.min(1, k)) * 100) + '%'; },
      sprut(x, y, hva, n) {            // hva = farge ('#f5d33c') eller emoji ('⭐')
        for (let i = 0; i < (n || 8) && sprut.length < 160; i++) {
          const a = Math.random() * Math.PI * 2, v = 90 + Math.random() * 220;
          sprut.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, t: 0, liv: 0.5 + Math.random() * 0.4, hva, s: 6 + Math.random() * 8 });
        }
      },
      ferdig(res) { if (fase === 'spill') slutt(res || {}); },
    };

    function tegnSprut(dt) {
      for (let i = sprut.length - 1; i >= 0; i--) {
        const p = sprut[i];
        p.t += dt; p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.t > p.liv) { sprut.splice(i, 1); continue; }
        const k = 1 - p.t / p.liv;
        if (p.hva && p.hva.charAt(0) === '#') { ctx.globalAlpha = k; ctx.fillStyle = p.hva; ctx.beginPath(); ctx.arc(p.x, p.y, p.s * k, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
        else emoji(p.hva || '✨', p.x, p.y, p.s * 2.4, 0, k);
      }
    }
    // hjelpehånda: har barnet ikke rørt skjermen på en stund, viser den et godt trekk (spillets hint())
    function hånd(dt) {
      const e = $('mHånd');
      if (fase !== 'spill' || !spill || !spill.hint || stille < (def.hjelpEtter || 5)) { if (e.style.display !== 'none') e.style.display = 'none'; return; }
      const hi = spill.hint();
      if (!hi) { e.style.display = 'none'; return; }
      håndT += dt;
      const k = (håndT % 1.6) / 1.6;
      let x = hi.x, y = hi.y, sk = 1;
      if (hi.x2 !== undefined) { const m = Math.min(1, k / 0.7); const mm = m * m * (3 - 2 * m); x = hi.x + (hi.x2 - hi.x) * mm; y = hi.y + (hi.y2 - hi.y) * mm; sk = k < 0.1 || k > 0.8 ? 1 : 0.85; }
      else sk = hi.hold ? (k > 0.15 && k < 0.8 ? 0.8 : 1) : 1 - 0.18 * Math.sin(k * Math.PI * 2) ** 2;
      e.style.display = 'block';
      e.style.transform = `translate(${x}px, ${y}px) scale(${sk})`;
    }
    function ramme(nå) {
      raf = requestAnimationFrame(ramme);
      const dt = Math.min(0.05, Math.max(0, (nå - sist) / 1000));
      sist = nå;
      if (fase !== 'spill') return;
      tid += dt; stille += dt;
      if (løkkeFn) { try { løkkeFn(dt, tid); } catch (e) { console.error('minispill ' + def.id + ':', e); } }
      tegnSprut(dt);
      hånd(dt);
    }
    function pos(e) { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, id: e.pointerId }; }
    function ned(e) { if (fase !== 'spill') return; e.preventDefault(); stille = 0; håndT = 0; try { canvas.setPointerCapture(e.pointerId); } catch (x) {} if (pekerFn) pekerFn(Object.assign({ type: 'ned' }, pos(e))); }
    function flytt(e) { if (fase !== 'spill') return; if (e.buttons || e.pointerType === 'touch') stille = 0; if (pekerFn) pekerFn(Object.assign({ type: 'flytt', nede: !!(e.buttons || e.pointerType === 'touch') }, pos(e))); }
    function opp(e) { if (fase !== 'spill') return; if (pekerFn) pekerFn(Object.assign({ type: 'opp' }, pos(e))); }
    canvas.addEventListener('pointerdown', ned);
    canvas.addEventListener('pointermove', flytt);
    canvas.addEventListener('pointerup', opp);
    canvas.addEventListener('pointercancel', opp);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    const vedResize = () => måle();
    window.addEventListener('resize', vedResize);

    function nyRunde() {
      if (spill && spill.stopp) { try { spill.stopp(); } catch (e) {} }
      løkkeFn = pekerFn = størrelseFn = null; sprut.length = 0;
      poeng = 0; $('mPoeng').querySelector('b').textContent = '0'; $('mStolpe').style.visibility = 'hidden';
      tid = 0; stille = 0; resultat = null; runder++;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      $('mKort').classList.remove('vis'); $('mSlutt').classList.remove('vis');
      fase = 'spill'; rot.dataset.fase = fase;
      try { spill = def.start(api) || {}; } catch (e) { console.error('minispill ' + def.id + ' start:', e); spill = {}; }
      oppdaterTest();
    }
    function slutt(res) {
      fase = 'slutt'; rot.dataset.fase = fase;
      const stj = Math.max(1, Math.min(3, Math.round(res.stjerner || 1)));
      resultat = { stjerner: stj, poeng: res.poeng === undefined ? poeng : res.poeng, runder };
      mynterGitt += stj;
      $('mHånd').style.display = 'none';
      const s = $('mSlutt');
      s.querySelector('.tall').innerHTML = `<span>${def.poengIkon || '⭐'} ${resultat.poeng}</span><span><i class="mMynt"></i> +${stj}</span>`;
      const spenn = s.querySelectorAll('.stj span');
      spenn.forEach((e) => e.classList.remove('på'));
      s.classList.add('vis');
      spenn.forEach((e, i) => { if (i < stj) setTimeout(() => { if (fase === 'slutt') e.classList.add('på'); }, 250 + i * 320); });
      setTimeout(() => { if (fase === 'slutt') { lyd.stjerne(stj); if (stj === 3) konfetti(26); } }, 250);
      if (o.vedRunde) o.vedRunde(resultat);
      oppdaterTest();
    }
    function konfetti(n) {
      const f = ['#f2a541', '#3fb36b', '#e8554e', '#4f9bd9', '#f5d33c', '#b06fd8'];
      for (let i = 0; i < n; i++) {
        const k = document.createElement('i');
        k.className = 'mKonf';
        k.style.left = (Math.random() * 100) + '%'; k.style.background = f[i % f.length];
        k.style.animationDuration = (1.6 + Math.random() * 1.6) + 's'; k.style.animationDelay = (Math.random() * 0.5) + 's';
        rot.appendChild(k);
        setTimeout(() => k.remove(), 4200);
      }
    }
    function lukk(res) {
      if (lukket) return;
      lukket = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', vedResize);
      if (spill && spill.stopp) { try { spill.stopp(); } catch (e) {} }
      rot.remove();
      aktiv = null;
      window.__mini = null;
      løs(res ? Object.assign({ mynter: mynterGitt }, res) : (mynterGitt ? { stjerner: 0, poeng: 0, runder, mynter: mynterGitt } : null));
    }
    function oppdaterTest() {
      window.__mini = { id: def.id, get fase() { return fase; }, get poeng() { return poeng; }, get resultat() { return resultat; }, get tid() { return tid; },
        hint: () => (spill && spill.hint ? spill.hint() : null), tilstand: () => (spill && spill.tilstand ? spill.tilstand() : null), størrelse: () => [w, h] };
    }
    $('mLukk').addEventListener('click', () => { lyd.klikk(); lukk(null); });
    $('mStart').addEventListener('click', () => { lyd.pling(); nyRunde(); });
    $('mIgjen').addEventListener('click', () => { lyd.klikk(); nyRunde(); });
    $('mFerdig').addEventListener('click', () => { lyd.klikk(); lukk(resultat); });
    aktiv = { lukk };
    måle();
    $('mKort').classList.add('vis');
    oppdaterTest();
    sist = performance.now();
    raf = requestAnimationFrame(ramme);
    if (o.rettPå) nyRunde();
  });
}

export function lukkMini() { if (aktiv) aktiv.lukk(null); }

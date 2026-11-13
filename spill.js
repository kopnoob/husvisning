// Skattejakten: spill for barn på 6 år oppå husvisningen. Lastes av app.js når «Spill» er valgt (window.HUS_SPILL).
// All styring er én finger: trykk på en ting for å ta den, trykk på gulvet for å gå, dra for å se rundt.
// Ekornet Nøtte viser vei og hjelper av seg selv hvis barnet står fast. Ingen tale: beskjeder vises som korte snakkebobler.
// Minispillene ligger i mini/ og åpnes fra kartet eller fra de runde merkene i rommene.
// Ingen nettverk, ingen lenker ut, ingen personopplysninger. Framgang i localStorage (nøkkel husspill.v1).
// Unngår toppnivå-await, regex-lookbehind og structuredClone, som app.js.

const LAGER = 'husspill.v1';
const MYNT = '<i class="smynt"></i>';

export function startSpill(A) {
  const { THREE, T, scene, camera, canvas } = A;
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const NED = V3(0, -1, 0);
  const smule = window.husSmule || (() => {});
  document.body.classList.add('spill');

  // ---------------------------------------------------------------- lagring
  function lesLager() { try { return JSON.parse(localStorage.getItem(LAGER) || 'null'); } catch (e) { return null; } }
  let data = lesLager() || {};
  data = { v: 1, ferdig: data.ferdig || {}, mynter: data.mynter || 0, lyd: data.lyd !== false, mini: data.mini || {} };
  function lagre() { try { localStorage.setItem(LAGER, JSON.stringify(data)); } catch (e) {} }

  // ---------------------------------------------------------------- lyd (WebAudio, ingen filer)
  const AC = window.AudioContext || window.webkitAudioContext;
  let ac = window.HUS_LYD || null;
  let master = null, støyBuf = null;
  function lydKlar() {
    if (!data.lyd) return false;
    try {
      if (!ac && AC) ac = window.HUS_LYD = new AC();
      if (!ac) return false;
      if (ac.state === 'suspended') ac.resume();
      if (!master) {
        master = ac.createGain(); master.gain.value = 0.55; master.connect(ac.destination);
        støyBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
        const d = støyBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      return true;
    } catch (e) { return false; }
  }
  function ut(pan) {
    if (pan && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); p.connect(master); return p; }
    return master;
  }
  function tone(f, t0, dur, o) {
    o = o || {};
    const t = ac.currentTime + t0;
    const osc = ac.createOscillator(), g = ac.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(f, t);
    if (o.til) osc.frequency.exponentialRampToValueAtTime(o.til, t + dur);
    const v = o.vol === undefined ? 0.25 : o.vol;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + (o.inn || 0.012));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(ut(o.pan));
    osc.start(t); osc.stop(t + dur + 0.05);
  }
  function støy(t0, dur, o) {
    o = o || {};
    const t = ac.currentTime + t0;
    const s = ac.createBufferSource(); s.buffer = støyBuf; s.loop = true;
    const f = ac.createBiquadFilter(); f.type = o.type || 'bandpass'; f.Q.value = o.q || 1;
    f.frequency.setValueAtTime(o.f || 1000, t);
    if (o.til) f.frequency.exponentialRampToValueAtTime(o.til, t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol || 0.2, t + (o.inn || 0.02));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(ut(o.pan));
    s.start(t); s.stop(t + dur + 0.05);
  }
  const lyd = {
    mynt() { if (!lydKlar()) return; tone(988, 0, 0.12, { type: 'square', vol: 0.08 }); tone(1319, 0.08, 0.35, { type: 'square', vol: 0.08 }); },
    pling() { if (!lydKlar()) return; [784, 988, 1175].forEach((f, i) => tone(f, i * 0.07, 0.3, { type: 'triangle', vol: 0.18 })); },
    pop() { if (!lydKlar()) return; støy(0, 0.12, { f: 1800, q: 0.7, vol: 0.5, inn: 0.003 }); tone(600, 0, 0.12, { til: 120, vol: 0.2 }); },
    sus() { if (!lydKlar()) return; støy(0, 0.9, { f: 300, til: 3000, q: 2, vol: 0.25, inn: 0.3 }); [1568, 1760, 2093, 2349].forEach((f, i) => tone(f, 0.25 + i * 0.09, 0.4, { vol: 0.05 })); },
    fnis(vol, pan) {
      if (!lydKlar()) return;
      const v = vol === undefined ? 0.15 : vol;
      for (let i = 0; i < 5; i++) tone(1300 + Math.random() * 300, i * 0.09, 0.08, { til: 1900 + Math.random() * 400, type: 'triangle', vol: v, pan });
    },
    hmm() { if (!lydKlar()) return; tone(392, 0, 0.22, { type: 'triangle', vol: 0.15 }); tone(330, 0.2, 0.3, { type: 'triangle', vol: 0.15 }); },
    fanfare() { if (!lydKlar()) return; [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i * 0.13, i === 5 ? 0.7 : 0.18, { type: 'square', vol: 0.07 })); },
    rør() { if (!lydKlar()) return; støy(0, 0.35, { f: 500, til: 900, q: 3, vol: 0.25 }); },
    tut() { if (!lydKlar()) return; [0, 0.35].forEach((t) => { tone(392, t, 0.25, { type: 'sawtooth', vol: 0.08 }); tone(494, t, 0.25, { type: 'sawtooth', vol: 0.06 }); }); },
    slag() { if (!lydKlar()) return; støy(0, 0.08, { f: 2500, q: 0.5, vol: 0.6, inn: 0.002 }); tone(1800, 0, 0.06, { vol: 0.2 }); støy(0.05, 0.6, { f: 1200, til: 300, q: 1, vol: 0.12 }); },
    smell() { if (!lydKlar()) return; støy(0, 1.2, { f: 400, til: 80, q: 0.5, vol: 0.5, inn: 0.005, type: 'lowpass' }); støy(0.1, 0.8, { f: 4000, q: 0.5, vol: 0.06 }); },
    plask() { if (!lydKlar()) return; støy(0, 0.25, { f: 700, til: 2400, q: 2, vol: 0.3 }); for (let i = 0; i < 3; i++) tone(900 + i * 400, 0.05 + i * 0.05, 0.08, { til: 1800 + i * 300, vol: 0.06 }); },
    grav() { if (!lydKlar()) return; støy(0, 0.25, { f: 250, q: 0.8, vol: 0.45, type: 'lowpass' }); },
    tygg() { if (!lydKlar()) return; for (let i = 0; i < 4; i++) støy(i * 0.16, 0.08, { f: 1500, q: 1.5, vol: 0.25 }); },
    stjerne(n) { if (!lydKlar()) return; for (let i = 0; i < n; i++) tone(1047 * Math.pow(1.26, i), i * 0.15, 0.3, { type: 'triangle', vol: 0.15 }); },
    klikk() { if (!lydKlar()) return; tone(1200, 0, 0.04, { vol: 0.05 }); },
  };

  // ---------------------------------------------------------------- grensesnitt (DOM)
  const stil = document.createElement('style');
  stil.textContent = `
  #sUI { position: fixed; inset: 0; z-index: 14; pointer-events: none; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; color: #2a1d10; }
  #sUI button { pointer-events: auto; font-family: inherit; border: 0; cursor: pointer; -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
  .sRund { width: 58px; height: 58px; border-radius: 50%; background: rgba(255,250,240,.92); box-shadow: 0 3px 10px rgba(0,0,0,.25); font-size: 28px; line-height: 58px; padding: 0; color: #2a1d10; }
  .sRund:active { transform: scale(.94); }
  #sTopp { position: absolute; top: calc(10px + var(--st)); left: calc(10px + var(--sl)); right: calc(10px + var(--sr)); display: flex; gap: 10px; align-items: center; }
  #sTopp .fyll { flex: 1; }
  #sMynter { background: rgba(255,250,240,.92); border-radius: 999px; padding: 0 16px 0 10px; height: 46px; display: flex; align-items: center; gap: 6px; font-size: 22px; font-weight: 700;
    box-shadow: 0 3px 10px rgba(0,0,0,.25); font-variant-numeric: tabular-nums; pointer-events: none; }
  #sMynter.hopp { animation: sHopp .4s; }
  @keyframes sHopp { 50% { transform: scale(1.25); } }
  #sLaas { position: relative; width: 46px; height: 46px; line-height: 46px; font-size: 20px; opacity: .8; }
  #sLaas i { position: absolute; inset: -4px; border-radius: 50%; pointer-events: none; }
  #sPrat { position: absolute; top: calc(78px + var(--st)); left: 50%; transform: translateX(-50%); width: min(560px, calc(100vw - 20px - var(--sl) - var(--sr)));
    background: rgba(255,250,240,.96); border-radius: 22px; padding: 10px 14px 10px 10px; display: none; gap: 10px; align-items: center; box-shadow: 0 4px 16px rgba(0,0,0,.28); }
  #sPrat.vis { display: flex; animation: sInn .25s; }
  @keyframes sInn { from { transform: translateX(-50%) translateY(-10px); opacity: 0; } }
  #sPrat .fjes { font-size: 40px; line-height: 1; flex: none; }
  #sPrat .tekst { font-size: 19px; line-height: 1.3; font-weight: 600; }
  #sPrat .ikon { font-size: 40px; line-height: 1; flex: none; margin-left: auto; }
  #sIkoner { position: absolute; top: calc(78px + var(--st)); left: 50%; transform: translateX(-50%); display: flex; gap: 6px; pointer-events: none; }
  #sIkoner { flex-wrap: wrap; justify-content: center; width: max-content; max-width: calc(100vw - 20px); }
  #sIkoner.mange { gap: 4px; }
  #sIkoner.mange span { width: 30px; height: 30px; line-height: 30px; font-size: 19px; border-radius: 9px; }
  #sPrat.vis ~ #sIkoner { opacity: .9; }
  .smynt { display: inline-block; width: .85em; height: .85em; border-radius: 50%; vertical-align: -.1em;
    background: radial-gradient(circle at 35% 30%, #fff4b0, #f4c430 45%, #b8860b); box-shadow: inset 0 0 0 .07em #d9a520, 0 1px 2px rgba(0,0,0,.3); }
  #sIkoner span { font-size: 24px; width: 38px; height: 38px; line-height: 38px; text-align: center; border-radius: 12px; background: rgba(255,250,240,.85); filter: grayscale(1); opacity: .5; }
  #sIkoner span.ok { filter: none; opacity: 1; animation: sHopp .4s; }
  #sBunn { position: absolute; bottom: calc(16px + var(--sb)); left: calc(10px + var(--sl)); right: calc(10px + var(--sr)); display: flex; justify-content: center; align-items: flex-end; gap: 22px; }
  #sBunn .snu { width: 74px; height: 74px; line-height: 74px; font-size: 34px; }
  #sNotte { width: 96px; height: 96px; border-radius: 50%; background: #f2a541; box-shadow: 0 4px 14px rgba(0,0,0,.35); font-size: 52px; line-height: 96px; padding: 0; }
  #sNotte.puls { animation: sPuls 1s infinite; }
  @keyframes sPuls { 50% { transform: scale(1.12); box-shadow: 0 0 0 12px rgba(242,165,65,.35); } }
  #sFerdig { position: absolute; right: calc(16px + var(--sr)); bottom: calc(18px + var(--sb)); width: 92px; height: 92px; border-radius: 50%; background: #3fb36b; color: #fff;
    font-size: 50px; line-height: 92px; padding: 0; display: none; box-shadow: 0 5px 16px rgba(0,0,0,.35); }
  #sHaand { position: absolute; bottom: calc(126px + var(--sb)); left: 50%; transform: translateX(-50%); background: rgba(255,250,240,.92); border-radius: 999px; padding: 4px 14px;
    font-size: 34px; display: none; box-shadow: 0 3px 10px rgba(0,0,0,.25); }
  #sMaaler { position: absolute; right: calc(16px + var(--sr)); top: 50%; width: 30px; height: 200px; margin-top: -100px; border-radius: 15px; display: none;
    background: linear-gradient(to top, #8fd16a, #f5d33c 60%, #ff7a3d); box-shadow: 0 3px 10px rgba(0,0,0,.3); border: 3px solid #fff; }
  #sMaaler i { position: absolute; left: -10px; right: -10px; height: 8px; background: #2a1d10; border-radius: 4px; }
  #sPil { position: absolute; left: 0; top: 0; width: 64px; height: 64px; margin: -32px; display: none; filter: drop-shadow(0 2px 4px rgba(0,0,0,.5)); }
  #sMerke { position: absolute; width: 40px; height: 40px; margin: -20px; border: 4px solid #fff; border-radius: 50%; opacity: 0; pointer-events: none; }
  #sMerke.vis { animation: sMerke .6s; }
  @keyframes sMerke { from { opacity: .9; transform: scale(.4); } to { opacity: 0; transform: scale(1.4); } }
  #sTryll { position: absolute; inset: 0; background: radial-gradient(circle, #fff8d8, #f7c96b); opacity: 0; pointer-events: none; transition: opacity .35s; }
  #sTryll.paa { opacity: 1; }
  #sKart, #sFeiring, #sVoksen { position: absolute; inset: 0; display: none; pointer-events: auto; overflow: auto;
    padding: calc(12px + var(--st)) calc(12px + var(--sr)) calc(12px + var(--sb)) calc(12px + var(--sl)); }
  #sKart { background: rgba(20,30,40,.35); }
  #sKart .ark { margin: 58px auto 0; width: min(460px, 100%); background: #f3e2b8; border-radius: 18px; padding: 14px; box-shadow: 0 8px 30px rgba(0,0,0,.4);
    background-image: radial-gradient(circle at 20% 10%, rgba(255,255,255,.4), transparent 40%), radial-gradient(circle at 80% 90%, rgba(150,100,40,.18), transparent 50%); }
  #sKart h2 { margin: 0 0 10px; text-align: center; font-size: 26px; color: #6b4219; display: flex; justify-content: center; gap: 8px; align-items: center; }
  #sRutenett { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  #sRutenett button { aspect-ratio: 1; min-height: 88px; border-radius: 16px; background: rgba(255,255,255,.35); border: 3px dashed rgba(107,66,25,.45) !important;
    font-size: 46px; position: relative; color: #2a1d10; padding: 0; }
  #sRutenett button.ferdig { background: #fff7e0; border: 3px solid #c9963f !important; }
  #sRutenett button.ferdig::after { content: "⭐"; position: absolute; right: 4px; top: 2px; font-size: 22px; }
  #sRutenett button.laast { opacity: .45; filter: grayscale(.8); }
  #sRutenett button.neste { animation: sPuls 1.2s infinite; background: rgba(255,255,255,.7); }
  #sRutenett button.skatt { background: rgba(200,60,40,.12); }
  #sRutenett button small { position: absolute; left: 0; right: 0; bottom: 4px; font-size: 12px; font-weight: 700; color: #6b4219; }
  #sFeiring { background: radial-gradient(circle, rgba(255,244,214,.98), rgba(242,165,65,.97)); z-index: 3; text-align: center; }
  #sFeiring .stor { font-size: 120px; margin-top: 18vh; animation: sSpinn 1s; }
  @keyframes sSpinn { from { transform: scale(.2) rotate(-200deg); } }
  #sFeiring .tekst { font-size: 26px; font-weight: 800; color: #6b4219; margin: 10px 20px; }
  #sFeiring .rad { font-size: 40px; margin: 10px; letter-spacing: 4px; }
  #sFeiring button { width: 110px; height: 110px; border-radius: 50%; background: #3fb36b; color: #fff; font-size: 54px; margin-top: 16px; box-shadow: 0 5px 16px rgba(0,0,0,.3); }
  .sKonfetti { position: fixed; top: -20px; width: 12px; height: 18px; border-radius: 3px; pointer-events: none; z-index: 16; animation: sFall linear forwards; }
  @keyframes sFall { to { transform: translateY(110vh) rotate(720deg); } }
  #sVoksen { background: rgba(10,9,8,.8); color: #f3efe8; }
  #sVoksen .boks { margin: 60px auto; width: min(380px, 100%); background: #1d1a17; border-radius: 14px; padding: 18px; }
  #sVoksen h3 { margin: 0 0 10px; }
  #sVoksen p { color: rgba(243,239,232,.7); font-size: 14px; }
  #sVoksen button { display: block; width: 100%; margin: 8px 0; padding: 12px; border-radius: 10px; background: #2c2824; color: #f3efe8; font-size: 16px; text-align: left; }
  #sVoksen button.fare { background: #6b2a1d; }
  #sKart .ark.spillark { margin-top: 14px; background-color: #e9f0d8; }
  #sMiniRute { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  #sMiniRute button { aspect-ratio: 1; min-height: 64px; border-radius: 14px; background: #fff; border: 3px solid #9bb66a !important; font-size: 34px; position: relative; color: #2a1d10; padding: 0 0 12px; }
  #sMiniRute button:active { transform: scale(.95); }
  #sMiniRute button small { position: absolute; left: 0; right: 0; bottom: 3px; font-size: 11px; line-height: 1; letter-spacing: 1px; filter: grayscale(1); opacity: .35; }
  #sMiniRute button small b { filter: none; }
  #sMiniRute button.gaa { background: #f2a541; border-color: #c9812a !important; }
  body.spill #sted, body.spill #hud { display: none !important; }
  `;
  document.head.appendChild(stil);

  const ui = document.createElement('div');
  ui.id = 'sUI';
  ui.innerHTML = `
    <div id="sTopp">
      <button id="sHjem" class="sRund" aria-label="Til skattekartet">🗺️</button>
      <div id="sMynter"><span>${MYNT}</span><b>0</b></div>
      <div class="fyll"></div>
      <button id="sGjenta" class="sRund" aria-label="Vis beskjeden igjen">💬</button>
      <button id="sLyd" class="sRund" aria-label="Lyd av eller på">🔊</button>
    </div>
    <div id="sPrat"><span class="fjes">🐿️</span><span class="tekst"></span><span class="ikon"></span></div>
    <div id="sIkoner"></div>
    <div id="sHaand"></div>
    <div id="sMaaler"><i></i></div>
    <svg id="sPil" viewBox="0 0 64 64"><path d="M32 4 L58 40 L42 40 L42 60 L22 60 L22 40 L6 40 Z" fill="#ffcf3f" stroke="#7a4a12" stroke-width="4" stroke-linejoin="round"/></svg>
    <div id="sMerke"></div>
    <div id="sBunn">
      <button class="sRund snu" id="sVenstre" aria-label="Snu til venstre">↶</button>
      <button id="sNotte" aria-label="Nøtte hjelper deg">🐿️</button>
      <button class="sRund snu" id="sHoyre" aria-label="Snu til høyre">↷</button>
    </div>
    <button id="sFerdig" aria-label="Ferdig med golf">✔</button>
    <div id="sTryll"></div>
    <div id="sKart"><div class="ark"><h2>🗺️ Skattekartet</h2><div id="sRutenett"></div></div>
      <div class="ark spillark"><h2>🎮 Spill</h2><div id="sMiniRute"></div></div>
      <div style="position:absolute;top:calc(12px + var(--st));right:calc(12px + var(--sr))"><button id="sLaas" class="sRund" aria-label="For voksne: hold inne">🔒<i></i></button></div>
      <div style="position:absolute;top:calc(12px + var(--st));left:calc(12px + var(--sl));display:flex;gap:10px"><button id="sGjenta2" class="sRund" aria-label="Vis beskjeden igjen">💬</button><button id="sLyd2" class="sRund" aria-label="Lyd">🔊</button></div>
    </div>
    <div id="sFeiring"><div class="stor"></div><div class="tekst"></div><div class="rad"></div><button id="sVidere" aria-label="Videre">▶</button></div>
    <div id="sVoksen"><div class="boks">
      <h3>For voksne</h3>
      <p>Framgangen ligger bare på denne enheten. Ingen data sendes noe sted.</p>
      <button id="vLyd"></button>
      <button id="vNull" class="fare">Nullstill framgang</button>
      <button id="vStart">Til startskjermen (Gå rundt fritt, moduser, diagnose)</button>
      <button id="vLukk">Lukk</button>
    </div></div>`;
  document.body.appendChild(ui);
  const $ = (id) => document.getElementById(id);
  const prat = $('sPrat');
  function settMynter() { $('sMynter').querySelector('b').textContent = data.mynter; }
  settMynter();
  function oppdaterLydKnapper() {
    $('sLyd').textContent = $('sLyd2').textContent = data.lyd ? '🔊' : '🔇';
    $('vLyd').textContent = 'Lydeffekter: ' + (data.lyd ? 'på (trykk for av)' : 'av (trykk for på)');
  }
  oppdaterLydKnapper();

  let sisteTale = null, pratTid = 0;
  function si(tekst, ikon, vent) {
    sisteTale = [tekst, ikon];
    prat.querySelector('.tekst').textContent = tekst;
    prat.querySelector('.ikon').innerHTML = ikon || '';
    prat.classList.remove('vis'); void prat.offsetWidth; prat.classList.add('vis');
    $('sIkoner').style.top = (prat.getBoundingClientRect().bottom + 8) + 'px';
    pratTid = performance.now() + Math.max(5000, tekst.length * 110);
    smule('si: ' + tekst.slice(0, 60));
    if (vent) return new Promise((r) => setTimeout(r, Math.max(1500, tekst.length * 65)));
  }
  function gjenta() { if (sisteTale) si(sisteTale[0], sisteTale[1]); }
  let ikonListe = [];
  function settIkoner(liste) {
    ikonListe = liste.map((i) => ({ ikon: i, ok: false }));
    tegnIkoner();
  }
  function ikonOk(i) { if (ikonListe[i]) { ikonListe[i].ok = true; tegnIkoner(); } }
  function tegnIkoner() { $('sIkoner').classList.toggle('mange', ikonListe.length > 6); $('sIkoner').innerHTML = ikonListe.map((x) => `<span class="${x.ok ? 'ok' : ''}">${x.ik || x.ikon}</span>`).join(''); }
  function konfetti(n) {
    const farger = ['#ff5a5f', '#ffcf3f', '#3fb36b', '#3f8cff', '#b45cff', '#ff9a3f'];
    for (let i = 0; i < (n || 50); i++) {
      const d = document.createElement('div');
      d.className = 'sKonfetti';
      d.style.left = Math.random() * 100 + 'vw';
      d.style.background = farger[i % farger.length];
      d.style.animationDuration = (1.6 + Math.random() * 1.8) + 's';
      d.style.animationDelay = (Math.random() * 0.5) + 's';
      document.body.appendChild(d);
      setTimeout(() => d.remove(), 4200);
    }
  }

  // ---------------------------------------------------------------- 3D: materialer og former (delt, ingen bildefiler unntatt ett lite glitterbilde)
  const matCache = {};
  function mat(farge, glød) {
    const k = farge + '/' + (glød || 0);
    if (!matCache[k]) matCache[k] = new THREE.MeshLambertMaterial({ color: farge, emissive: farge, emissiveIntensity: glød === undefined ? 0.25 : glød });
    return matCache[k];
  }
  const G = {
    kule: new THREE.SphereGeometry(1, 16, 12),
    liten: new THREE.SphereGeometry(1, 8, 6),
    boks: new THREE.BoxGeometry(1, 1, 1),
    syl: new THREE.CylinderGeometry(1, 1, 1, 20),
    kjegle: new THREE.ConeGeometry(1, 1, 12),
    ring: new THREE.TorusGeometry(1, 0.35, 10, 24),
  };
  function del(geo, farge, s, p, glød) {
    const m = new THREE.Mesh(geo, mat(farge, glød));
    if (Array.isArray(s)) m.scale.set(s[0], s[1], s[2]); else m.scale.setScalar(s);
    if (p) m.position.set(p[0], p[1], p[2]);
    return m;
  }
  function gruppe(...deler) { const g = new THREE.Group(); deler.forEach((d) => g.add(d)); return g; }

  // glitterstjerne (64 x 64 lerret)
  const glitterTeks = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,230,1)'); gr.addColorStop(0.25, 'rgba(255,230,120,.8)'); gr.addColorStop(1, 'rgba(255,200,80,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    x.fillStyle = 'rgba(255,255,255,.95)';
    x.beginPath(); x.moveTo(32, 2); x.lineTo(36, 28); x.lineTo(62, 32); x.lineTo(36, 36); x.lineTo(32, 62); x.lineTo(28, 36); x.lineTo(2, 32); x.lineTo(28, 28); x.closePath(); x.fill();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const glitterMat = new THREE.SpriteMaterial({ map: glitterTeks, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending });

  const lag = {
    mynt() {
      const g = gruppe(del(G.syl, 0xf4c430, [0.09, 0.022, 0.09], null, 0.45), del(G.syl, 0xd9a520, [0.065, 0.026, 0.065], null, 0.4));
      g.children.forEach((c) => { c.rotation.x = Math.PI / 2; });
      return g;
    },
    kartbit() {
      const g = gruppe(del(G.boks, 0xf0dcaa, [0.34, 0.26, 0.012], null, 0.5),
        del(G.boks, 0xd8342c, [0.16, 0.025, 0.02], [0.05, -0.03, 0.002], 0.4), del(G.boks, 0xd8342c, [0.16, 0.025, 0.02], [0.05, -0.03, 0.002], 0.4),
        del(G.boks, 0x8a5a2b, [0.2, 0.012, 0.016], [-0.06, 0.06, 0.002], 0.2));
      g.children[1].rotation.z = 0.78; g.children[2].rotation.z = -0.78;
      return g;
    },
    egg() { return gruppe(del(G.kule, 0xfaf3e6, [0.05, 0.068, 0.05], [0, 0.068, 0])); },
    melk() { return gruppe(del(G.boks, 0xffffff, [0.09, 0.2, 0.09], [0, 0.1, 0]), del(G.boks, 0x3f8cff, [0.092, 0.07, 0.092], [0, 0.08, 0]), del(G.kjegle, 0xffffff, [0.065, 0.05, 0.065], [0, 0.225, 0])); },
    mel() { return gruppe(del(G.boks, 0xe9dcc0, [0.14, 0.2, 0.08], [0, 0.1, 0]), del(G.kule, 0xd9a520, [0.035, 0.035, 0.01], [0, 0.11, 0.041])); },
    jordbær() { const k = del(G.kjegle, 0xe0312f, [0.05, 0.09, 0.05], [0, 0.05, 0]); k.rotation.x = Math.PI; return gruppe(k, del(G.kjegle, 0x3fa34d, [0.05, 0.03, 0.05], [0, 0.1, 0])); },
    sjokolade() { return gruppe(del(G.boks, 0x5b3417, [0.16, 0.025, 0.09], [0, 0.013, 0]), del(G.boks, 0xd8342c, [0.165, 0.028, 0.04], [0, 0.014, 0])); },
    bolle() {
      const g = new THREE.Group();
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.1, 0.13, 24, 1, true), mat(0x7fb7e6, 0.25)); b.material.side = THREE.DoubleSide; b.position.y = 0.065;
      const bunn = del(G.syl, 0x7fb7e6, [0.1, 0.01, 0.1], [0, 0.005, 0]);
      const deig = del(G.syl, 0xf3dfb0, [0.15, 0.02, 0.15], [0, 0.04, 0]); deig.name = 'deig';
      g.add(b, bunn, deig); return g;
    },
    kake() {
      const g = gruppe(del(G.syl, 0xf7a8c4, [0.2, 0.12, 0.2], [0, 0.06, 0]), del(G.syl, 0xfff3f6, [0.205, 0.03, 0.205], [0, 0.13, 0]),
        del(G.kule, 0xe0312f, 0.025, [0.1, 0.16, 0]), del(G.kule, 0xe0312f, 0.025, [-0.08, 0.16, 0.06]), del(G.kule, 0xe0312f, 0.025, [-0.03, 0.16, -0.11]));
      for (const [x, z] of [[0.05, 0.05], [-0.06, -0.02], [0.02, -0.08]]) { g.add(del(G.syl, 0x8fd16a, [0.01, 0.08, 0.01], [x, 0.185, z])); g.add(del(G.kule, 0xffc93f, [0.012, 0.022, 0.012], [x, 0.24, z], 1.2)); }
      return g;
    },
    notte() {
      const brun = 0xc0692b, lys = 0xf6e2c4;
      const g = new THREE.Group();
      g.add(del(G.kule, brun, [0.11, 0.13, 0.1], [0, 0.13, 0], 0.3));
      g.add(del(G.kule, lys, [0.07, 0.09, 0.05], [0, 0.12, 0.06], 0.3));
      g.add(del(G.kule, brun, 0.085, [0, 0.29, 0.02], 0.3));
      g.add(del(G.kule, lys, [0.045, 0.035, 0.04], [0, 0.265, 0.08], 0.3));
      g.add(del(G.kule, 0x2a1408, 0.014, [0, 0.285, 0.12], 0.1));
      for (const s of [-1, 1]) {
        g.add(del(G.kule, 0x111111, 0.017, [s * 0.035, 0.31, 0.085], 0));
        g.add(del(G.kule, 0xffffff, 0.006, [s * 0.031, 0.317, 0.1], 1));
        const ø = del(G.kjegle, brun, [0.025, 0.06, 0.02], [s * 0.05, 0.38, 0.0], 0.3); ø.rotation.z = -s * 0.3; g.add(ø);
        g.add(del(G.kule, brun, [0.03, 0.03, 0.04], [s * 0.06, 0.03, 0.04], 0.3));
      }
      const hale = [[0, 0.1, -0.13, 0.08], [0, 0.22, -0.19, 0.095], [0, 0.35, -0.17, 0.09], [0, 0.44, -0.1, 0.07]];
      for (const [x, y, z, r] of hale) g.add(del(G.kule, 0xd98a4a, r, [x, y, z], 0.3));
      return g;
    },
    leke(type, farge) {
      if (type === 'ball') return gruppe(del(G.kule, farge, 0.1, [0, 0.1, 0]), del(G.ring, 0xffffff, [0.1, 0.1, 0.03], [0, 0.1, 0]));
      if (type === 'bil') {
        const g = gruppe(del(G.boks, farge, [0.22, 0.07, 0.12], [0, 0.06, 0]), del(G.boks, farge, [0.11, 0.06, 0.1], [-0.02, 0.12, 0]));
        for (const [x, z] of [[0.07, 0.06], [-0.07, 0.06], [0.07, -0.06], [-0.07, -0.06]]) { const h = del(G.syl, 0x222222, [0.03, 0.02, 0.03], [x, 0.03, z]); h.rotation.x = Math.PI / 2; g.add(h); }
        return g;
      }
      if (type === 'bamse') {
        const g = gruppe(del(G.kule, farge, [0.08, 0.09, 0.07], [0, 0.09, 0]), del(G.kule, farge, 0.06, [0, 0.21, 0]),
          del(G.kule, farge, 0.025, [0.045, 0.26, 0]), del(G.kule, farge, 0.025, [-0.045, 0.26, 0]), del(G.kule, 0xfff1d0, 0.025, [0, 0.2, 0.05]), del(G.kule, 0x111111, 0.01, [0, 0.21, 0.075]));
        return g;
      }
      if (type === 'kloss') return gruppe(del(G.boks, farge, 0.15, [0, 0.075, 0]), del(G.syl, farge, [0.025, 0.02, 0.025], [0.04, 0.16, 0.04]), del(G.syl, farge, [0.025, 0.02, 0.025], [-0.04, 0.16, -0.04]));
      if (type === 'ring') { const r = del(G.ring, farge, [0.08, 0.08, 0.08], [0, 0.03, 0]); r.rotation.x = Math.PI / 2; return gruppe(r); }
      if (type === 'and') return gruppe(del(G.kule, farge, [0.08, 0.065, 0.1], [0, 0.065, 0]), del(G.kule, farge, 0.05, [0, 0.15, 0.06]), (() => { const k = del(G.kjegle, 0xff8a1f, [0.02, 0.05, 0.02], [0, 0.145, 0.12]); k.rotation.x = Math.PI / 2; return k; })());
      return gruppe(del(G.kule, farge, 0.1));
    },
    kiste(farge) {
      const g = gruppe(del(G.boks, farge, [0.5, 0.3, 0.36], [0, 0.15, 0], 0.3), del(G.boks, 0xffffff, [0.51, 0.04, 0.37], [0, 0.26, 0], 0.3));
      const lokk = del(G.boks, farge, [0.52, 0.06, 0.38], [0, 0.33, 0], 0.35); lokk.name = 'lokk'; g.add(lokk);
      return g;
    },
    ballong(farge, gull) {
      const g = gruppe(del(G.kule, farge, [0.17, 0.21, 0.17], [0, 0.6, 0], gull ? 0.7 : 0.35), del(G.kjegle, farge, [0.03, 0.04, 0.03], [0, 0.37, 0], 0.3), del(G.syl, 0xffffff, [0.003, 0.36, 0.003], [0, 0.18, 0], 0.5));
      return g;
    },
    blomst(farge) {
      const g = new THREE.Group();
      g.add(del(G.syl, 0x3fa34d, [0.012, 0.35, 0.012], [0, 0.175, 0]));
      g.add(del(G.kule, 0xffd23f, 0.04, [0, 0.36, 0], 0.4));
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.add(del(G.kule, farge, [0.05, 0.02, 0.035], [Math.cos(a) * 0.065, 0.36, Math.sin(a) * 0.065], 0.4)); }
      const b = del(G.kule, 0x3fa34d, [0.06, 0.01, 0.025], [0.04, 0.15, 0]); b.rotation.z = 0.5; g.add(b);
      return g;
    },
    flekk() {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.3, 32), new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
      m.rotation.x = -Math.PI / 2; m.position.y = 0.03;
      return gruppe(m, del(G.kule, 0x6b4219, [0.15, 0.03, 0.15], [0, 0.01, 0], 0.2));
    },
    pinnsvin() {
      const g = gruppe(del(G.kule, 0x7a6450, [0.16, 0.11, 0.2], [0, 0.08, 0], 0.25), del(G.kjegle, 0xd9c2a0, [0.06, 0.12, 0.06], [0, 0.07, 0.2], 0.25), del(G.kule, 0x111111, 0.018, [0, 0.07, 0.26]));
      g.children[1].rotation.x = Math.PI / 2;
      for (const s of [-1, 1]) g.add(del(G.kule, 0x111111, 0.012, [s * 0.03, 0.1, 0.19]));
      for (let i = 0; i < 16; i++) {
        const a = (i % 8) / 8 * Math.PI - Math.PI / 2, rad = i < 8 ? 0 : 1;
        const p = del(G.kjegle, 0x4a3a2c, [0.02, 0.09, 0.02], [Math.sin(a) * 0.12, 0.13 + rad * 0.02, -0.05 + rad * -0.08 + Math.cos(a) * 0.02]);
        p.rotation.z = -a * 0.8; p.rotation.x = -0.6; g.add(p);
      }
      return g;
    },
    eple() { return gruppe(del(G.kule, 0xd8342c, 0.07, [0, 0.07, 0], 0.35), del(G.syl, 0x5b3417, [0.006, 0.04, 0.006], [0, 0.15, 0]), del(G.kule, 0x3fa34d, [0.03, 0.008, 0.015], [0.02, 0.15, 0])); },
    golfball() { return gruppe(del(G.kule, 0xffffff, 0.045, [0, 0.045, 0], 0.6), del(G.syl, 0xffd23f, [0.012, 0.03, 0.012], [0, 0.0, 0])); },
    bil() {
      const g = new THREE.Group();
      g.add(del(G.boks, 0xd8342c, [0.8, 0.45, 1.7], [0, 0.42, 0], 0.25));
      g.add(del(G.boks, 0xd8342c, [0.74, 0.38, 0.9], [0, 0.82, -0.1], 0.25));
      g.add(del(G.boks, 0x9ed3f0, [0.76, 0.28, 0.82], [0, 0.84, -0.1], 0.4));
      for (const [x, z] of [[0.4, 0.55], [-0.4, 0.55], [0.4, -0.55], [-0.4, -0.55]]) { const h = del(G.syl, 0x222222, [0.2, 0.12, 0.2], [x, 0.2, z]); h.rotation.z = Math.PI / 2; g.add(h); }
      for (const s of [-1, 1]) { const l = del(G.kule, 0xfff3a0, [0.08, 0.06, 0.03], [s * 0.26, 0.48, 0.86], 0.5); l.name = 'lys'; g.add(l); }
      return g;
    },
    gjørme() { return gruppe(del(G.kule, 0x5a3b1e, [0.14, 0.11, 0.04], null, 0.15), del(G.kule, 0x6b4a28, [0.06, 0.05, 0.05], [0.07, 0.04, 0.01], 0.15)); },
    kryss() {
      const g = gruppe(del(G.boks, 0xd8342c, [0.9, 0.03, 0.16], [0, 0.03, 0], 0.5), del(G.boks, 0xd8342c, [0.9, 0.03, 0.16], [0, 0.031, 0], 0.5));
      g.children[0].rotation.y = 0.78; g.children[1].rotation.y = -0.78; return g;
    },
    skattekiste() {
      const g = new THREE.Group();
      g.add(del(G.boks, 0x8a5a2b, [0.7, 0.4, 0.45], [0, 0.2, 0], 0.25));
      for (const x of [-0.25, 0.25]) g.add(del(G.boks, 0xf4c430, [0.06, 0.41, 0.46], [x, 0.2, 0], 0.5));
      const lokk = new THREE.Group(); lokk.name = 'lokk'; lokk.position.set(0, 0.4, -0.225);
      const l = del(G.syl, 0x8a5a2b, [0.225, 0.7, 0.225], [0, 0, 0.225], 0.25); l.rotation.z = Math.PI / 2; l.scale.set(0.225, 0.7, 0.225);
      lokk.add(l);
      const lås = del(G.boks, 0xf4c430, [0.1, 0.12, 0.04], [0, 0.0, 0.46], 0.6); lokk.add(lås);
      g.add(lokk);
      const gull = del(G.kule, 0xf4c430, [0.3, 0.08, 0.18], [0, 0.38, 0], 0.7); gull.name = 'gull'; gull.visible = false; g.add(gull);
      return g;
    },
  };

  // ---------------------------------------------------------------- partikler (fast pool)
  const partikler = [];
  for (let i = 0; i < 70; i++) {
    const m = new THREE.Mesh(G.liten, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false }));
    m.visible = false; m.userData = { v: V3(0, 0, 0), liv: 0, maks: 1, g: 0 };
    scene.add(m); partikler.push(m);
  }
  let pNeste = 0;
  function sprut(pos, n, o) {
    o = o || {};
    const farger = o.farger || [0xffffff];
    for (let i = 0; i < n; i++) {
      const m = partikler[pNeste++ % partikler.length];
      m.visible = true; m.position.copy(pos);
      m.material.color.setHex(farger[i % farger.length]); m.material.opacity = 1;
      const s = o.str || 0.03; m.scale.setScalar(s * (0.6 + Math.random() * 0.8));
      const f = o.fart || 1.5, a = Math.random() * Math.PI * 2, e = (o.opp === undefined ? 0.5 : o.opp) + Math.random() * 0.8;
      m.userData.v.set(Math.cos(a) * f * (0.4 + Math.random() * 0.6), e * f, Math.sin(a) * f * (0.4 + Math.random() * 0.6));
      m.userData.liv = m.userData.maks = (o.liv || 1) * (0.7 + Math.random() * 0.6);
      m.userData.g = o.g === undefined ? 4 : o.g;
      m.userData.vokse = o.vokse || 0;
    }
  }
  function partikkelSteg(dt) {
    for (const m of partikler) {
      if (!m.visible) continue;
      const u = m.userData;
      u.liv -= dt;
      if (u.liv <= 0) { m.visible = false; continue; }
      u.v.y -= u.g * dt;
      m.position.addScaledVector(u.v, dt);
      if (u.vokse) m.scale.multiplyScalar(1 + u.vokse * dt);
      m.material.opacity = Math.min(1, u.liv / u.maks * 2);
    }
  }

  // ---------------------------------------------------------------- små animasjoner
  const anim = [];
  function animer(dur, fn, ferdig) { return new Promise((r) => anim.push({ t: 0, dur, fn, ferdig: () => { if (ferdig) ferdig(); r(); } })); }
  function animSteg(dt) {
    for (let i = anim.length - 1; i >= 0; i--) {
      const a = anim[i]; a.t += dt;
      const k = Math.min(1, a.t / a.dur);
      a.fn(k);
      if (k >= 1) { anim.splice(i, 1); a.ferdig(); }
    }
  }
  const myk = (k) => k * k * (3 - 2 * k);
  const pause = (ms) => new Promise((r) => oppdragTimer(r, ms));

  // ---------------------------------------------------------------- plassering i huset
  // Blender-mål (X øst, Y nord, Z gulvnivå) til et punkt på flaten under: gulv, eller møbel opptil 1,3 m over gulvet
  function påFlate(X, Y, Z, o) {
    o = o || {};
    const fra = T(X, Y, Z + (o.gulv ? 0.35 : 1.3));
    const d = A.stråle(fra, NED, 6);
    const y = d < 6 ? fra.y - d : T(X, Y, Z).y;
    return V3(fra.x, y + (o.h || 0), fra.z);
  }
  // ståsted med fri sikt til et punkt: prøver ringer rundt punktet
  function ståsted(p) {
    for (const r of [1.6, 2.2, 1.1, 2.9, 3.6]) {
      for (let a = 0; a < 16; a++) {
        const v = a / 16 * Math.PI * 2 + r;
        const x = p.x + Math.cos(v) * r, z = p.z + Math.sin(v) * r;
        const topp = V3(x, p.y + 1.0, z);
        const d = A.stråle(topp, NED, 4);
        if (d >= 4) continue;
        const fy = topp.y - d;
        if (fy > p.y + 0.05 || fy < p.y - 1.9) continue;
        const f = V3(x, fy, z);
        if (!A.fritt(f)) continue;
        const øye = V3(x, fy + A.OYE, z);
        const til = p.clone().sub(øye); const L = til.length(); til.normalize();
        if (A.stråle(øye, til, L) < L - 0.35) continue;
        return f;
      }
    }
    return null;
  }

  // ---------------------------------------------------------------- ting man kan trykke på
  let ting = [];
  let tingNr = 0;
  function lagTing(obj, pos, o) {
    o = o || {};
    const t = { id: ++tingNr, obj, pos: pos.clone(), r: o.r || 0.15, aktiv: true, ved: o.ved || null, navn: o.navn || '', hjelp: o.hjelp !== false,
      spinn: !!o.spinn, hopp: o.hopp !== false, fase: Math.random() * 6, data: o.data || {}, glitter: null };
    obj.position.copy(pos);
    if (o.glitter !== false) {
      const s = new THREE.Sprite(glitterMat); s.scale.setScalar(0.22); s.position.set(0, (o.glitterH || 0.28), 0); s.renderOrder = 5;
      obj.add(s); t.glitter = s;
    }
    scene.add(obj);
    ting.push(t);
    return t;
  }
  function fjernTing(t) {
    t.aktiv = false;
    scene.remove(t.obj);
    ting = ting.filter((x) => x !== t);
  }
  function tingSteg(dt, tid) {
    for (const t of ting) {
      if (!t.obj.parent) continue;
      if (t.hopp) t.obj.position.y = t.pos.y + Math.sin(tid * 2.4 + t.fase) * 0.025 + 0.02;
      if (t.spinn) t.obj.rotation.y += dt * 1.6;
      if (t.glitter) { const s = 0.18 + Math.sin(tid * 5 + t.fase) * 0.06; t.glitter.scale.setScalar(t.aktiv ? s : 0.0001); t.glitter.material.rotation = tid; }
    }
  }

  // ---------------------------------------------------------------- Nøtte i 3D
  const nøtte = { obj: lag.notte(), modus: 'borte', mål: V3(), visTil: 0 };
  nøtte.obj.scale.setScalar(0.85);
  nøtte.obj.visible = false;
  // egne materialer, så Nøtte kan tegnes oppå vegger og møbler mens han følger deg
  // tegnes bakfra og fram (halen først), siden dybdetesten er av mens han følger deg
  nøtte.obj.children.slice().sort((a, b) => a.position.z - b.position.z).forEach((m, i) => { m.material = m.material.clone(); m.renderOrder = 8 + i; });
  function nøtteOppå(på) { nøtte.obj.traverse((m) => { if (m.isMesh && m.material.depthTest === på) { m.material.depthTest = !på; } }); }
  scene.add(nøtte.obj);
  const _f = V3(), _h = V3(), _m = V3();
  function nøtteSteg(dt, tid) {
    const o = nøtte.obj;
    if (nøtte.modus === 'borte') { o.visible = false; return; }
    o.visible = true;
    nøtteOppå(nøtte.modus === 'følg');
    if (nøtte.modus === 'følg') {
      camera.getWorldDirection(_f); _f.y = 0; _f.normalize();
      _h.set(-_f.z, 0, _f.x);
      _m.copy(camera.position).addScaledVector(_f, 1.45).addScaledVector(_h, 0.5); _m.y -= 0.62;
      o.position.lerp(_m, 1 - Math.exp(-dt * 4));
    } else if (nøtte.modus === 'vis') {
      o.position.lerp(nøtte.mål, 1 - Math.exp(-dt * 2.2));
    } else if (nøtte.modus === 'gjemt') {
      o.position.copy(nøtte.mål);
    }
    if (nøtte.modus !== 'gjemt') o.position.y += Math.sin(tid * 3) * 0.004;
    const dx = camera.position.x - o.position.x, dz = camera.position.z - o.position.z;
    o.rotation.y = Math.atan2(dx, dz);
  }

  // ---------------------------------------------------------------- lyssøyle og pil (hjelp)
  const søyle = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 7, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  søyle.visible = false; søyle.renderOrder = 6; scene.add(søyle);
  const pil = $('sPil');

  // ---------------------------------------------------------------- oppdragsrammen
  let oppdrag = null;          // { def, hjelpMål(), avbryt[] }
  let travel = false;           // tryllereise pågår
  let opptatt = false;          // animasjon som ikke skal forstyrres
  let stille = 0, hjelpNivå = 0, visTid = -1e9;
  let øktFerdig = 0;
  const timere = [];
  function oppdragTimer(fn, ms) { const id = setTimeout(fn, ms); timere.push(id); return id; }
  function framgang() { stille = 0; hjelpNivå = 0; søyle.visible = false; $('sNotte').classList.remove('puls'); if (oppdrag && nøtte.modus === 'vis') nøtte.modus = oppdrag.nøtteModus || 'følg'; }
  function gimynt(n) { data.mynter += n || 1; settMynter(); const e = $('sMynter'); e.classList.remove('hopp'); void e.offsetWidth; e.classList.add('hopp'); lagre(); }

  function hjelpMål() {
    if (!oppdrag) return null;
    if (oppdrag.hjelpMål) { const t = oppdrag.hjelpMål(); if (t) return t; }
    // nærmeste aktive ting
    let best = null, bd = 1e9;
    for (const t of ting) { if (!t.aktiv || !t.hjelp) continue; const d = t.pos.distanceTo(camera.position) + Math.abs(t.pos.y - camera.position.y) * 4; if (d < bd) { bd = d; best = t; } }
    return best;
  }

  async function reis(fot, mot, stille2) {
    if (travel) return;
    travel = true;
    lyd.sus();
    $('sTryll').classList.add('paa');
    await new Promise((r) => setTimeout(r, 380));
    A.settFot(fot, mot);
    if (nøtte.modus === 'følg' || nøtte.modus === 'vis') { nøtte.obj.position.copy(camera.position); }
    await new Promise((r) => setTimeout(r, 120));
    $('sTryll').classList.remove('paa');
    await new Promise((r) => setTimeout(r, 300));
    travel = false;
    if (!stille2) sprut(camera.position.clone().add(V3(0, -0.3, 0)), 0, {});
  }
  // vis veien: Nøtte flyr til tingen og roper; andre trykk innen 20 s tryller deg dit
  function visVei(auto) {
    const t = hjelpMål();
    if (!t) return;
    const nå = performance.now();
    if (!auto && nå - visTid < 20000) { tryllTil(t); return; }
    visTid = nå;
    if (oppdrag && oppdrag.nøtteModus !== 'gjemt') { nøtte.modus = 'vis'; nøtte.mål.copy(t.pos).add(V3(0.25, 0.35, 0)); }
    søyle.position.set(t.pos.x, t.pos.y + 3.4, t.pos.z); søyle.visible = true;
    hjelpNivå = Math.max(hjelpNivå, 2);
    $('sNotte').classList.add('puls');
    lyd.fnis(0.2);
    si(t.hint || 'Se pila! Trykk på meg igjen, så tryller jeg deg dit.', '👉');
  }
  function tryllTil(t) {
    const f = t.ståsted || (t.ståsted = ståsted(t.pos));
    if (!f) {
      // reserve: tilbake til startstedet for oppdraget
      const [X, Y, Z, mx, my, mz] = oppdrag.def.start;
      reis(T(X, Y, Z), T(mx, my, mz === undefined ? Z + 1.0 : mz));
      return;
    }
    stille = 0;
    reis(f, t.pos);
  }

  function hjelpSteg(dt) {
    if (!oppdrag || travel || opptatt || modusSkjerm !== 'oppdrag') return;
    stille += dt;
    if (stille > 28 && hjelpNivå < 1) {
      hjelpNivå = 1;
      const t = hjelpMål();
      if (t) {
        if (oppdrag.nøtteModus !== 'gjemt') { nøtte.modus = 'vis'; nøtte.mål.copy(t.pos).add(V3(0.25, 0.35, 0)); }
        lyd.fnis(0.25);
        si(oppdrag.def.hint1 || 'Her borte! Se hvor jeg er.', '🐿️');
      }
    } else if (stille > 55 && hjelpNivå < 2) {
      visTid = -1e9; visVei(true); visTid = performance.now();
      si('Følg pila! Eller trykk på meg nederst, så tryller jeg deg dit.', '👇');
    } else if (stille > 90 && hjelpNivå < 3) {
      hjelpNivå = 3;
      const t = hjelpMål();
      si('Hokus pokus! Jeg tryller deg dit.', '✨');
      if (t) oppdragTimer(() => tryllTil(t), 1200);
    }
  }
  const _p = V3();
  function pilSteg() {
    const t = hjelpNivå >= 2 && oppdrag ? hjelpMål() : null;
    if (!t) { pil.style.display = 'none'; søyle.visible = false; return; }
    søyle.position.set(t.pos.x, t.pos.y + 3.4, t.pos.z); søyle.visible = true;
    _p.copy(t.pos).project(camera);
    const W = innerWidth, H = innerHeight;
    let x = (_p.x + 1) / 2 * W, y = (1 - _p.y) / 2 * H;
    const bak = _p.z > 1;
    const på = !bak && x > 40 && x < W - 40 && y > 140 && y < H - 150;
    let rot;
    if (på) { y -= 70 + Math.sin(performance.now() / 180) * 10; rot = 180; }
    else {
      if (bak) { x = W - x; y = H - y; }
      const cx = W / 2, cy = H / 2;
      let dx = x - cx, dy = y - cy; if (bak) { dx = -dx || 1; dy = Math.abs(dy) * 0.2; dx = (x < cx ? -1 : 1) * Math.max(Math.abs(dx), 1); }
      const sk = Math.min((W / 2 - 44) / Math.max(1, Math.abs(dx)), (H / 2 - 130) / Math.max(1, Math.abs(dy)));
      x = cx + dx * sk; y = cy + dy * sk;
      rot = Math.atan2(dy, dx) * 180 / Math.PI + 90;
    }
    pil.style.display = 'block';
    pil.style.transform = `translate(${x}px, ${y}px) rotate(${rot}deg)`;
  }

  // ---------------------------------------------------------------- styring: én finger
  const ray = new THREE.Raycaster();
  const peker = { id: null, x: 0, y: 0, x0: 0, y0: 0, t0: 0, drar: false };
  canvas.addEventListener('pointerdown', (e) => {
    lydKlar();
    if (peker.id !== null) return;
    peker.id = e.pointerId; peker.x = peker.x0 = e.clientX; peker.y = peker.y0 = e.clientY; peker.t0 = performance.now(); peker.drar = false;
    if (golf.aktiv) golfNed();
    try { canvas.setPointerCapture(e.pointerId); } catch (er) {}
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== peker.id) return;
    const dx = e.clientX - peker.x, dy = e.clientY - peker.y;
    if (!peker.drar && Math.hypot(e.clientX - peker.x0, e.clientY - peker.y0) > 14) peker.drar = true;
    if (peker.drar && modusSkjerm === 'oppdrag' && !golf.aktiv) {
      const k = e.pointerType === 'mouse' ? 0.004 : 0.0055;
      A.yaw += dx * k; A.pitch += dy * k * 0.8;
      framgangLett();
    }
    peker.x = e.clientX; peker.y = e.clientY;
  });
  const slipp = (e) => {
    if (e.pointerId !== peker.id) return;
    peker.id = null;
    if (golf.aktiv) { golfOpp(); return; }
    if (!peker.drar && performance.now() - peker.t0 < 900 && e.type === 'pointerup') trykk(e.clientX, e.clientY);
  };
  canvas.addEventListener('pointerup', slipp);
  canvas.addEventListener('pointercancel', slipp);
  function framgangLett() { /* å se rundt teller ikke som framgang, men hjelpen skal ikke mase mens barnet leter aktivt */ stille = Math.max(0, stille - 0.02); }

  function visMerke(x, y) { const m = $('sMerke'); m.style.left = x + 'px'; m.style.top = y + 'px'; m.classList.remove('vis'); void m.offsetWidth; m.classList.add('vis'); }

  function skjerm(p) {
    _p.copy(p).project(camera);
    return { x: (_p.x + 1) / 2 * innerWidth, y: (1 - _p.y) / 2 * innerHeight, foran: _p.z < 1 };
  }
  function synlig(t) {
    const øye = camera.position, til = t.pos.clone().sub(øye), L = til.length();
    til.normalize();
    return A.stråle(øye, til, L) >= L - 0.4;
  }
  function trykk(x, y) {
    if (travel || modusSkjerm !== 'oppdrag' || !oppdrag || golf.aktiv) return;
    // 1) Nøtte selv
    // 2) nærmeste ting innen romslig treffsone, med fri sikt
    let best = null, bd = 1e9;
    for (const t of ting) {
      if (!t.aktiv || !t.obj.parent) continue;
      const s = skjerm(t.pos);
      if (!s.foran) continue;
      const avst = t.pos.distanceTo(camera.position);
      const rPx = Math.max(64, t.r / Math.max(0.3, avst) * innerHeight * 0.9);
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < rPx && d < bd && synlig(t)) { bd = d; best = t; }
    }
    if (best) {
      const avst = best.pos.distanceTo(camera.position);
      if (avst > 9) { gåMot(best.pos, x, y); return; }
      visMerke(x, y);
      if (best.ved) best.ved(best);
      return;
    }
    let mBest = null, mBd = 1e9;
    for (const t of miniTing) {
      const s = skjerm(t.pos);
      if (!s.foran) continue;
      const avst = t.pos.distanceTo(camera.position);
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < Math.max(60, 0.3 / Math.max(0.3, avst) * innerHeight * 0.9) && d < mBd && synlig(t)) { mBd = d; mBest = t; }
    }
    if (mBest) {
      if (mBest.pos.distanceTo(camera.position) > 7) { gåMot(mBest.pos, x, y); return; }
      visMerke(x, y); åpneMini(mBest.m);
      return;
    }
    if (nøtte.obj.visible && nøtte.modus !== 'gjemt') {
      const s = skjerm(nøtte.obj.position.clone().add(V3(0, 0.25, 0)));
      if (s.foran && Math.hypot(s.x - x, s.y - y) < 70) { lyd.fnis(0.2); visVei(); return; }
    }
    if (oppdrag.bomTrykk && oppdrag.bomTrykk(x, y)) return;
    // 3) gulvet: gå dit
    ray.setFromCamera({ x: x / innerWidth * 2 - 1, y: -(y / innerHeight) * 2 + 1 }, camera);
    const d = A.stråle(ray.ray.origin, ray.ray.direction, 30);
    if (d >= 30) return;
    const P = ray.ray.origin.clone().addScaledVector(ray.ray.direction, d);
    gåMot(P, x, y);
  }
  function gåMot(P, x, y) {
    const øye = camera.position;
    const h = V3(P.x - øye.x, 0, P.z - øye.z);
    let L = h.length();
    if (L < 0.3) return;
    const gulv = P.y < øye.y - 0.7;
    L = Math.min(14, gulv ? L - 0.25 : L - 0.55);
    if (L < 0.2) return;
    h.normalize();
    visMerke(x, y);
    lyd.klikk();
    A.gåTil(V3(øye.x + h.x * L, P.y, øye.z + h.z * L));
  }

  // snu-knapper
  let snuTil = null;
  function snu(retning) {
    lyd.klikk();
    const fra = A.yaw, til = fra + retning * Math.PI / 4;
    snuTil = { fra, til, t: 0 };
  }
  $('sVenstre').addEventListener('click', () => snu(1));
  $('sHoyre').addEventListener('click', () => snu(-1));
  $('sNotte').addEventListener('click', () => { lydKlar(); if (modusSkjerm === 'oppdrag') visVei(); });
  $('sHjem').addEventListener('click', () => { lydKlar(); avsluttOppdrag(); visKart(); });
  $('sGjenta').addEventListener('click', () => { lydKlar(); gjenta(); });
  $('sGjenta2').addEventListener('click', () => { lydKlar(); gjenta(); });
  const lydKnapp = () => { data.lyd = !data.lyd; lagre(); oppdaterLydKnapper(); if (data.lyd) lyd.pling(); };
  $('sLyd').addEventListener('click', lydKnapp);
  $('sLyd2').addEventListener('click', lydKnapp);

  // ---------------------------------------------------------------- voksenpanel: hold hengelåsen i 3 sekunder
  (() => {
    const b = $('sLaas'), ring = b.querySelector('i');
    let start = 0, raf = 0;
    const tegn = () => {
      const k = Math.min(1, (performance.now() - start) / 3000);
      ring.style.background = `conic-gradient(rgba(242,165,65,.9) ${k * 360}deg, transparent 0)`;
      ring.style.webkitMask = ring.style.mask = 'radial-gradient(circle, transparent 60%, #000 61%)';
      if (k >= 1) { stopp(); visVoksen(); return; }
      raf = requestAnimationFrame(tegn);
    };
    const stopp = () => { cancelAnimationFrame(raf); start = 0; ring.style.background = ''; };
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); start = performance.now(); tegn(); });
    b.addEventListener('pointerup', stopp); b.addEventListener('pointerleave', stopp); b.addEventListener('pointercancel', stopp);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  })();
  let nullKlikk = 0;
  function visVoksen() { nullKlikk = 0; $('vNull').textContent = 'Nullstill framgang'; oppdaterLydKnapper(); $('sVoksen').style.display = 'block'; }
  $('vLukk').addEventListener('click', () => { $('sVoksen').style.display = 'none'; });
  $('vLyd').addEventListener('click', () => { data.lyd = !data.lyd; lagre(); oppdaterLydKnapper(); });
  $('vNull').addEventListener('click', () => {
    if (++nullKlikk < 2) { $('vNull').textContent = 'Trykk en gang til for å slette all framgang'; return; }
    data.ferdig = {}; data.mynter = 0; data.mini = {}; lagre(); settMynter();
    $('vNull').textContent = 'Framgangen er nullstilt';
    tegnKart();
  });
  $('vStart').addEventListener('click', () => { location.href = location.pathname; });

  // ---------------------------------------------------------------- felles avslutning: kartbiten
  function visKartbit(nær) {
    let p = nær;
    if (!p) {
      camera.getWorldDirection(_f); _f.y = 0; _f.normalize();
      p = camera.position.clone().addScaledVector(_f, 1.3); p.y -= 0.25;
    }
    lyd.fanfare();
    sprut(p, 24, { farger: [0xffcf3f, 0xff5a5f, 0x3fb36b, 0x3f8cff], fart: 1.6, str: 0.025 });
    const t = lagTing(lag.kartbit(), p, { r: 0.25, spinn: true, navn: 'kartbit', glitterH: 0.22,
      ved: (t) => {
        fjernTing(t); lyd.pling(); framgang();
        vinn();
      } });
    t.hint = 'Kartbiten! Trykk på den.';
    si('Se! En bit av skattekartet! Trykk på den.', '🗺️');
    framgang();
  }

  const OPPDRAG = [];
  function vinn() {
    const def = oppdrag.def;
    data.ferdig[def.id] = true; lagre();
    øktFerdig++;
    avsluttOppdrag(true);
    visFeiring(def);
  }

  function visFeiring(def) {
    modusSkjerm = 'feiring';
    const f = $('sFeiring');
    f.querySelector('.stor').innerHTML = def.merke;
    const antall = OPPDRAG.filter((d) => !d.finale && data.ferdig[d.id]).length;
    f.querySelector('.tekst').textContent = def.finale ? 'Du fant skatten!' : 'Kartbit ' + antall + ' av 8';
    f.querySelector('.rad').innerHTML = def.finale ? OPPDRAG.filter((d) => !d.finale).map((d) => d.merke).join('') : MYNT + ' ' + data.mynter;
    f.style.display = 'block';
    konfetti(def.finale ? 120 : 60);
    lyd.fanfare();
    si(def.finale ? 'Hurra! Du fant skatten! Du er en ekte skattejeger!' : `Hurra! Du har funnet ${antall} av åtte kartbiter. Trykk på den grønne knappen.`, def.merke);
  }
  $('sVidere').addEventListener('click', () => { lydKlar(); $('sFeiring').style.display = 'none'; visKart(); });

  // ---------------------------------------------------------------- skattekartet (velg oppdrag)
  let modusSkjerm = 'kart';
  function åpen(d) {
    if (d.id === 'm1') return true;
    if (!data.ferdig.m1) return false;
    if (d.finale) return OPPDRAG.filter((x) => !x.finale).every((x) => data.ferdig[x.id]);
    return true;
  }
  function tegnKart() {
    const r = $('sRutenett');
    r.innerHTML = '';
    const neste = OPPDRAG.find((d) => åpen(d) && !data.ferdig[d.id]);
    for (const d of KART_REKKE.map((id) => OPPDRAG.find((x) => x.id === id))) {
      const b = document.createElement('button');
      const ferdig = !!data.ferdig[d.id], ok = åpen(d);
      b.className = (ferdig ? 'ferdig ' : '') + (ok ? '' : 'laast ') + (neste === d ? 'neste ' : '') + (d.finale ? 'skatt' : '');
      b.innerHTML = (ferdig ? d.merke : ok ? d.ikon : (d.finale ? '🔒' : d.ikon)) + `<small>${d.kort}</small>`;
      b.setAttribute('aria-label', d.navn);
      b.dataset.id = d.id;
      b.addEventListener('click', () => {
        lydKlar();
        if (!ok) { lyd.hmm(); si(d.finale ? 'Skattekista åpnes når du har alle åtte kartbitene.' : 'Først må du finne den første kartbiten. Trykk på gullmynten!', d.finale ? '🗺️' : MYNT); return; }
        startOppdrag(d);
      });
      r.appendChild(b);
    }
  }
  const KART_REKKE = ['m2', 'm3', 'm5', 'm1', 'm9', 'm4', 'm6', 'm7', 'm8'];

  // ---------------------------------------------------------------- minispill (mini/*.js, lastes først når de åpnes)
  const miniV = '?v=' + (window.HUS_V || '6');
  let miniListe = [], miniTing = [], miniÅpen = false;
  const miniMat = {};
  import('./mini/liste.js' + miniV).then((m) => { miniListe = m.MINISPILL; tegnMiniRute(); if (oppdrag) leggMiniMerker(); }).catch((e) => smule('minispill-lista feilet: ' + (e && e.message)));
  // «Gå rundt»: ingen oppgave, bare huset og merkene for spillene. Nøtte viser vei til nærmeste spill som ikke er prøvd.
  const FRI = { id: 'fri', navn: 'Gå rundt', start: [8.6, 10.3, 0, 8.6, 7.0, 0.6],
    kjør(o) {
      o.hjelpMål = () => {
        let best = null, bd = 1e9;
        for (const t of miniTing) { const d = t.pos.distanceTo(camera.position) + (data.mini[t.m.id] ? 60 : 0); if (d < bd) { bd = d; best = t; } }
        return best;
      };
      si('Gå rundt i huset! Trykk på de runde merkene for å spille.', '🎮');
    } };
  function tegnMiniRute() {
    const r = $('sMiniRute');
    r.innerHTML = '';
    const g = document.createElement('button');
    g.className = 'gaa'; g.textContent = '🚶'; g.setAttribute('aria-label', 'Gå rundt i huset'); g.dataset.id = 'fri';
    g.addEventListener('click', () => { lydKlar(); startOppdrag(FRI); });
    r.appendChild(g);
    for (const m of miniListe) {
      const b = document.createElement('button');
      const stj = (data.mini[m.id] || {}).stj || 0;
      b.innerHTML = m.ikon + '<small>' + [0, 1, 2].map((i) => (i < stj ? '<b>⭐</b>' : '⭐')).join('') + '</small>';
      b.setAttribute('aria-label', m.navn + ' (' + m.rom + ')');
      b.dataset.id = m.id;
      b.addEventListener('click', () => åpneMini(m));
      r.appendChild(b);
    }
  }
  function åpneMini(m) {
    if (miniÅpen || travel) return;
    miniÅpen = true;
    lydKlar(); lyd.pling();
    A.gåTil(null);
    smule('minispill ' + m.id);
    Promise.all([import('./mini/ramme.js' + miniV), import('./mini/' + m.id + '.js' + miniV)]).then((mod) => {
      window.HUS_PAUSE = true;                        // huset tegnes ikke mens minispillet dekker skjermen
      return mod[0].startMini(Object.assign({}, m, mod[1].default), { lydPå: () => data.lyd, beste: (data.mini[m.id] || {}).beste || 0,
        vedRunde: (res) => {
          const d = data.mini[m.id] || (data.mini[m.id] = { stj: 0, beste: 0, n: 0 });
          d.stj = Math.max(d.stj, res.stjerner); d.beste = Math.max(d.beste, res.poeng || 0); d.n++;
          data.mynter += res.stjerner; lagre();
        } });
    }).then(() => { window.HUS_PAUSE = false; miniÅpen = false; stille = 0; settMynter(); tegnMiniRute(); })
      .catch((e) => { window.HUS_PAUSE = false; miniÅpen = false; smule('minispill feilet: ' + (e && e.message)); lyd.hmm(); });
  }
  // merket i rommet: en rund brikke med spillets ikon, alltid vendt mot barnet
  function miniMerke(m) {
    if (!miniMat[m.id]) {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const x = c.getContext('2d');
      x.fillStyle = '#f2a541'; x.beginPath(); x.arc(64, 64, 62, 0, 7); x.fill();
      x.fillStyle = '#fffaf0'; x.beginPath(); x.arc(64, 64, 52, 0, 7); x.fill();
      x.font = '68px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(m.ikon, 64, 69);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      miniMat[m.id] = new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false });
    }
    const s = new THREE.Sprite(miniMat[m.id]); s.scale.setScalar(0.36); s.renderOrder = 4;
    return s;
  }
  function fjernMiniMerker() { for (const t of miniTing) scene.remove(t.obj); miniTing = []; }
  function leggMiniMerker() {
    fjernMiniMerker();
    for (const m of miniListe) {
      const pos = påFlate(m.sted[0], m.sted[1], m.sted[2], { gulv: true, h: 0.95 });
      const obj = miniMerke(m);
      obj.position.copy(pos); scene.add(obj);
      miniTing.push({ m, obj, pos, fase: Math.random() * 6 });
    }
  }
  function miniSteg(tid) {
    for (const t of miniTing) { t.obj.position.y = t.pos.y + Math.sin(tid * 2 + t.fase) * 0.04; t.obj.scale.setScalar(0.36 + Math.sin(tid * 3 + t.fase) * 0.02); }
  }
  function visKart(førsteGang) {
    modusSkjerm = 'kart';
    oppdrag = null;
    nøtte.modus = 'borte';
    $('sBunn').style.display = 'none'; $('sTopp').style.display = 'none'; $('sIkoner').innerHTML = ''; $('sHaand').style.display = 'none'; $('sMaaler').style.display = 'none';
    pil.style.display = 'none'; søyle.visible = false;
    A.settFot(T(8.0, 19.5, -0.55), T(8.6, 7.0, 3.6));
    tegnKart();
    $('sKart').style.display = 'block';
    const antall = OPPDRAG.filter((d) => !d.finale && data.ferdig[d.id]).length;
    if (data.ferdig.m9) si('Du har funnet skatten! Du kan spille alt en gang til.', '👑');
    else if (øktFerdig >= 3 && øktFerdig % 3 === 0 && !førsteGang) si('Du har vært kjempeflink! Kanskje det er tid for en pause? Skatten venter på deg.', '😴');
    else if (!data.ferdig.m1) si(førsteGang ? 'Hei! Jeg er Nøtte. Skattekartet mitt har revnet i biter! Hjelper du meg å finne dem? Trykk på gullmynten.' : 'Trykk på gullmynten for å begynne.', MYNT);
    else if (antall === 8) si('Kartet er helt! Trykk på skattekista i midten!', '👑');
    else si(`Du har ${antall} av åtte kartbiter. Velg hvor du vil lete!`, '🗺️');
  }

  function startOppdrag(def) {
    avsluttOppdrag();
    $('sKart').style.display = 'none';
    $('sBunn').style.display = 'flex'; $('sTopp').style.display = 'flex';
    modusSkjerm = 'oppdrag';
    oppdrag = { def, nøtteModus: 'følg' };
    stille = 0; hjelpNivå = 0; visTid = -1e9;
    settIkoner([]);
    const [X, Y, Z, mx, my, mz] = def.start;
    reis(T(X, Y, Z), T(mx, my, mz === undefined ? Z + 1.0 : mz), true).then(() => {
      if (!oppdrag || oppdrag.def !== def) return;
      nøtte.modus = 'følg'; nøtte.obj.position.copy(camera.position);
      smule('oppdrag ' + def.id);
      def.kjør(oppdrag);
      leggMiniMerker();
    });
  }
  function avsluttOppdrag() {
    for (const id of timere) clearTimeout(id);
    timere.length = 0;
    for (const t of ting.slice()) fjernTing(t);
    fjernMiniMerker();
    for (const x of ekstra) scene.remove(x);
    ekstra.length = 0;
    anim.length = 0;
    A.gåTil(null);
    oppdrag = null; opptatt = false;
    hjelpNivå = 0; søyle.visible = false; pil.style.display = 'none';
    $('sNotte').classList.remove('puls'); $('sHaand').style.display = 'none'; $('sMaaler').style.display = 'none';
    nøtte.obj.scale.setScalar(0.85);
    if (golf.aktiv) stoppGolf();
    golf.etter = null; golf.anim = null; golfSkjerm.visible = false; $('sFerdig').style.display = 'none';
    if (golf.ball) { scene.remove(golf.ball); golf.ball = null; }
  }
  const ekstra = [];      // pynt uten trykk (kister, bil, kake) som fjernes når oppdraget slutter
  function pynt(obj, pos) { obj.position.copy(pos); scene.add(obj); ekstra.push(obj); return obj; }
  function flyTil(obj, fra, til, dur, bue) {
    return animer(dur, (k) => { const e = myk(k); obj.position.lerpVectors(fra, til, e); obj.position.y += Math.sin(k * Math.PI) * (bue || 0.4); });
  }
  function foran(avst, ned) {
    camera.getWorldDirection(_f); _f.y = 0; _f.normalize();
    const p = camera.position.clone().addScaledVector(_f, avst); p.y -= ned || 0; return p;
  }
  // samle: ta en ting med pling og la den fly mot kameraet
  function samle(t, o) {
    o = o || {};
    t.aktiv = false;
    lyd.mynt();
    sprut(t.pos, 12, { farger: [0xffcf3f, 0xffffff], fart: 1.2, str: 0.02 });
    const fra = t.obj.position.clone(), til = foran(0.5, 0.35);
    flyTil(t.obj, fra, til, 0.45, 0.2).then(() => fjernTing(t));
    if (o.mynt !== false) gimynt(1);
    framgang();
  }

  // ================================================================ GOLF-MINISPILLET
  // Starter i oppdrag 7, eller når man går bort til slagmatta i annekset. Ett grep: hold fingeren og slipp.
  // Banen tegnes på et lite lerret (256 x 160) foran simulatorskjermen i modellen.
  const golf = { aktiv: false, lader: false, ladT: 0, kraft: 0, slag: 0, hio: false, ball: null, o: null, mat: null, cooldown: 0, anim: null, baneFase: 0 };
  const GL = document.createElement('canvas'); GL.width = 256; GL.height = 160;
  const gx = GL.getContext('2d');
  const golfTeks = new THREE.CanvasTexture(GL); golfTeks.colorSpace = THREE.SRGBColorSpace;
  const golfSkjerm = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 1.8), new THREE.MeshBasicMaterial({ map: golfTeks, toneMapped: false }));
  golfSkjerm.position.copy(T(-6.45, -6.98, 0.9)); golfSkjerm.rotation.y = Math.PI; golfSkjerm.visible = false;
  scene.add(golfSkjerm);
  const GREEN = [128, 50];
  function tegnBane(sti, k, hio) {
    const g = gx;
    let gr = g.createLinearGradient(0, 0, 0, 70); gr.addColorStop(0, '#6fb7ff'); gr.addColorStop(1, '#cfe9ff');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 160);
    g.fillStyle = '#9fc7a0'; g.beginPath(); g.moveTo(0, 48); g.quadraticCurveTo(60, 20, 120, 42); g.quadraticCurveTo(190, 18, 256, 40); g.lineTo(256, 160); g.lineTo(0, 160); g.fill();
    g.fillStyle = '#4f9a3e'; g.fillRect(0, 44, 256, 116);
    g.fillStyle = '#6cc04f'; g.beginPath(); g.moveTo(96, 160); g.lineTo(160, 160); g.lineTo(150, 44); g.lineTo(106, 44); g.fill();
    g.fillStyle = '#e8d9a0'; g.beginPath(); g.ellipse(170, 66, 14, 5, 0, 0, 7); g.fill();
    g.fillStyle = '#8be06a'; g.beginPath(); g.ellipse(GREEN[0], GREEN[1], 26, 9, 0, 0, 7); g.fill();
    for (const [x, y, r] of [[30, 60, 14], [56, 54, 10], [220, 62, 15], [200, 52, 9], [14, 90, 18], [244, 96, 17]]) { g.fillStyle = '#2e6b2a'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.fillStyle = '#5b3a1e'; g.fillRect(x - 2, y + r - 3, 4, 7); }
    g.fillStyle = '#222'; g.beginPath(); g.ellipse(GREEN[0], GREEN[1], 3, 1.4, 0, 0, 7); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(GREEN[0], GREEN[1]); g.lineTo(GREEN[0], GREEN[1] - 26); g.stroke();
    g.fillStyle = '#ff3b30'; g.beginPath(); g.moveTo(GREEN[0], GREEN[1] - 26); g.lineTo(GREEN[0] + 14, GREEN[1] - 21); g.lineTo(GREEN[0], GREEN[1] - 16); g.fill();
    g.fillStyle = '#ffffff'; g.fillRect(118, 148, 20, 8);
    if (sti) {
      const [x0, y0, x1, y1, høyde] = sti;
      const pos = (t) => [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t - Math.sin(t * Math.PI) * høyde];
      g.fillStyle = 'rgba(255,255,255,.85)';
      for (let t = 0; t <= Math.min(1, k); t += 0.04) { const [x, y] = pos(t); g.beginPath(); g.arc(x, y, 1.3, 0, 7); g.fill(); }
      const [bx, by] = pos(Math.min(1, k));
      const r = 5 - Math.min(1, k) * 2.6;
      if (!(hio && k >= 1)) { g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(x0 + (x1 - x0) * Math.min(1, k), y0 + (y1 - y0) * Math.min(1, k) + 1, r, r * 0.4, 0, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(bx, by, r, 0, 7); g.fill(); }
      if (hio && k >= 1) {
        const s = 1 + Math.sin(golf.baneFase * 8) * 0.12;
        g.save(); g.translate(GREEN[0], 92); g.scale(s, s);
        g.fillStyle = '#ffd23f'; g.strokeStyle = '#b8860b'; g.lineWidth = 3; g.beginPath();
        for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? 16 : 36; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
        g.closePath(); g.fill(); g.stroke();
        g.fillStyle = '#7a3b00'; g.font = 'bold 26px -apple-system, Helvetica, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('1', 0, 2);
        g.restore();
      }
    }
    golfTeks.needsUpdate = true;
  }
  function golfMat() {
    if (!golf.mat) golf.mat = påFlate(-6.3, -4.1, -0.435, { gulv: true, h: 0.0 });
    return golf.mat;
  }
  function startGolf(o) {
    golf.o = o || {}; golf.aktiv = true; golf.slag = 0; golf.hio = false; golf.lader = false; golf.anim = null; golf.cooldown = 0;
    opptatt = true; framgang();
    const mat = golfMat();
    A.settFot(mat.clone().add(V3(0, 0, -0.55)), T(-6.45, -6.98, 0.75));     // stå litt bak (nord for) ballen og se på skjermen
    A.pitch = -0.12;
    golfSkjerm.visible = true; tegnBane(null, 0);
    $('sBunn').style.display = 'none'; $('sFerdig').style.display = 'block';
    $('sMaaler').style.display = 'block'; settMåler(0);
    nyGolfBall();
  }
  function stoppGolf() {
    golf.aktiv = false; golf.lader = false;
    $('sFerdig').style.display = 'none'; $('sMaaler').style.display = 'none';
    if (modusSkjerm === 'oppdrag') $('sBunn').style.display = 'flex';
    opptatt = false; golf.cooldown = 4;
  }
  function settMåler(k) { $('sMaaler').firstElementChild.style.bottom = (k * 92 + 2) + '%'; }
  function nyGolfBall() {
    if (golf.ball) scene.remove(golf.ball);
    golf.ball = lag.golfball(); golf.ball.scale.setScalar(1.4);
    golf.ball.position.copy(golfMat()).add(V3(0, 0.01, 0));
    scene.add(golf.ball);
    golf.klar = true;
  }
  function golfNed() { if (!golf.aktiv || !golf.klar) return; golf.lader = true; golf.ladT = 0; lyd.klikk(); }
  function golfOpp() {
    if (!golf.aktiv || !golf.lader) return;
    golf.lader = false; golf.klar = false;
    const p = golf.kraft;
    const søt = p >= 0.68 && p <= 0.94;
    const hio = søt && (Math.random() < 0.35 || (golf.o.iOppdrag && golf.slag === 3 && !golf.hio));
    const n = søt ? 3 : p > 0.4 ? 2 : 1;
    if (hio) golf.hio = true;
    lyd.slag(); framgang();
    const b = golf.ball, fra = b.position.clone(), til = golfSkjerm.position.clone().add(V3((Math.random() - 0.5) * 0.4, -0.1, -0.05));
    flyTil(b, fra, til, 0.42, 0.25 + p * 0.5).then(() => {
      scene.remove(b); if (golf.ball === b) golf.ball = null;
      // ballbanen på lerretet
      let x1, y1;
      if (hio) { x1 = GREEN[0]; y1 = GREEN[1]; }
      else if (søt) { x1 = GREEN[0] + (Math.random() - 0.5) * 30; y1 = GREEN[1] + (Math.random() - 0.5) * 8; }
      else { y1 = 150 - Math.max(0.12, p) * 115; x1 = 128 + (Math.random() - 0.5) * (60 + (1 - p) * 40); }
      golf.anim = { sti: [128, 150, x1, y1, 25 + p * 45], t: 0, hio, n };
    });
  }
  function golfLandet(hio, n) {
    golf.anim = null;
    const nr = golf.slag++;
    gimynt(hio ? 5 : n);
    const sp = golfSkjerm.position.clone().add(V3(0, 0, -0.1));
    if (hio) {
      lyd.fanfare(); lyd.stjerne(3); konfetti(90);
      for (let i = 0; i < 3; i++) oppdragTimer(() => sprut(sp.clone().add(V3((Math.random() - 0.5) * 1.6, Math.random() * 0.6, 0)), 18, { farger: [0xffcf3f, 0xff5a5f, 0x3fb36b, 0x3f8cff], fart: 2.2, str: 0.04, g: 2 }), i * 300);
      si('HULL I ETT! Ballen gikk rett i hullet! Utrolig!', '🏆');
    } else {
      lyd.stjerne(n);
      if (n === 3) konfetti(30);
      sprut(sp, 8 + n * 6, { farger: n === 3 ? [0xffcf3f, 0x3fb36b, 0x3f8cff] : [0xffcf3f, 0xffffff], fart: 1.4, str: 0.035, g: 1.5 });
      si([golf.kraft < 0.25 ? 'Et lite slag! Hold fingeren lenger, så flyr den langt.' : 'Fint slag! En stjerne!', 'Langt! To stjerner!', 'På greenen! Tre stjerner!'][n - 1], '⭐'.repeat(n));
    }
    let videre = true;
    if (golf.o.påSlag) videre = golf.o.påSlag(nr, hio ? 3 : n, hio) !== false;
    if (videre && golf.aktiv) oppdragTimer(() => { if (golf.aktiv) { tegnBane(null, 0); nyGolfBall(); } }, hio ? 3200 : 1900);
  }
  function golfSteg(dt) {
    if (golf.cooldown > 0) golf.cooldown -= dt;
    if (golf.aktiv && golf.lader) {
      golf.ladT += dt;
      golf.kraft = 1 - Math.abs(((golf.ladT / 1.3 + 1) % 2) - 1);     // fyller seg på 1,3 s, synker så tilbake, og opp igjen
      settMåler(golf.kraft);
      if (golf.ball) golf.ball.rotation.y += dt * 8;
    }
    if (golf.anim) {
      golf.anim.t += dt / 1.3;
      tegnBane(golf.anim.sti, golf.anim.t, golf.anim.hio);
      if (golf.anim.t >= 1) { const a = golf.anim; golf.baneFase = 0; golfLandet(a.hio, a.n); golf.etter = a; }
    } else if (golf.etter && golf.etter.hio && golfSkjerm.visible) { golf.baneFase += dt; tegnBane(golf.etter.sti, 1, true); }
    // nær slagmatta i et annet oppdrag: fri golf starter av seg selv
    if (!golf.aktiv && golf.cooldown <= 0 && oppdrag && oppdrag.def.id !== 'm7' && !travel && modusSkjerm === 'oppdrag') {
      const m = golfMat(), f = A.fot;
      if (Math.hypot(f.x - m.x, f.z - m.z) < 0.9 && Math.abs(f.y - m.y) < 0.4) {
        const tilbake = A.fot.clone();
        const forrigeMål = oppdrag.hjelpMål;
        A.gåTil(null);
        startGolf({ påFerdig: () => { golfSkjerm.visible = false; if (golf.ball) { scene.remove(golf.ball); golf.ball = null; } A.settFot(tilbake.add(V3(0, 0, -1.2))); oppdrag.hjelpMål = forrigeMål; } });
        si('Golfsimulatoren! Hold fingeren på skjermen og slipp for å slå. Trykk på den grønne haken når du er ferdig.', '⛳');
      }
    }
  }
  $('sFerdig').addEventListener('click', () => {
    lydKlar(); lyd.klikk();
    const f = golf.o && golf.o.påFerdig;
    stoppGolf(); golf.etter = null;
    golfSkjerm.visible = false; if (golf.ball) { scene.remove(golf.ball); golf.ball = null; }
    if (f) f();
  });

  // ================================================================ OPPDRAGENE
  // start: [X, Y, Z (gulv), se mot X, se mot Y, se mot Z (valgfri)] i Blender-mål

  // 1: lære å trykke og gå. Seks gullmynter i første etasje.
  OPPDRAG.push({ id: 'm1', navn: 'Kartbiten i gangen', kort: 'Gangen', ikon: MYNT, merke: '🧭', start: [8.6, 10.3, 0, 8.6, 7.0, 0.6],
    hint1: 'Her borte! Kom og se hva jeg fant.',
    kjør(o) {
      const plasser = [[8.6, 8.35, 0], [7.4, 5.0, 0], [6.2, 2.7, 0], [3.7, 5.0, 0], [4.5, 9.4, 0], [10.6, 10.3, 0]];
      let funnet = 0;
      settIkoner(plasser.map(() => MYNT));
      const ta = (t) => {
        samle(t); ikonOk(funnet); funnet++;
        if (funnet === 1) {
          si('Bra! Trykk på gulvet der du vil gå. Finn flere gullmynter!', '👆');
          for (let i = 1; i < plasser.length; i++) lagTing(lag.mynt(), påFlate(...plasser[i], { h: 0.1 }), { r: 0.14, spinn: true, ved: ta });
        } else if (funnet === 3) si('Supert! Dra fingeren for å snu deg. Eller trykk på pilene nederst.', '↔️');
        else if (funnet === plasser.length) oppdragTimer(() => visKartbit(), 700);
        else si(['Pling!', 'Enda en!', 'Du er flink!', 'Nesten alle!'][funnet % 4], MYNT);
      };
      lagTing(lag.mynt(), påFlate(...plasser[0], { h: 0.6, gulv: true }), { r: 0.14, spinn: true, ved: ta });
      si('Se, en gullmynt! Trykk på den.', MYNT);
    } });

  // 2: skattekaka. Fem ingredienser, røre, kartbiten er inni kaka.
  OPPDRAG.push({ id: 'm2', navn: 'Skattekaka', kort: 'Kjøkkenet', ikon: '🥚', merke: '🎂', start: [12.6, 6.7, -0.385, 14.4, 8.6, 0.2],
    kjør(o) {
      const ting5 = [['egg', '🥚', [12.5, 10.6, -0.385]], ['melk', '🥛', [10.7, 9.0, 0]], ['mel', '🌾', [15.6, 10.6, -0.385]], ['jordbær', '🍓', [13.5, 5.5, -0.385]], ['sjokolade', '🍫', [10.4, 4.6, 0]]];
      settIkoner(ting5.map((x) => x[1]));
      let har = 0, rørt = 0;
      const bolleP = påFlate(14.1, 8.4, -0.385);
      const bolle = lagTing(lag.bolle(), bolleP, { r: 0.22, hopp: false, glitter: false, hjelp: false, ved: () => {
        if (har < 5) { lyd.hmm(); si('Vi trenger alt på lista først. Se øverst!', '🥚'); return; }
        rørt++; lyd.rør(); framgang();
        const deig = bolle.obj.getObjectByName('deig'); deig.position.y = 0.04 + rørt * 0.014;
        animer(0.3, (k) => { bolle.obj.rotation.z = Math.sin(k * Math.PI * 4) * 0.12; });
        sprut(bolleP.clone().add(V3(0, 0.15, 0)), 5, { farger: [0xf3dfb0, 0xffffff], fart: 0.8, str: 0.015 });
        if (rørt < 5) { si(['Rør, rør!', 'Rør litt til!', 'Mmm!', 'En gang til!'][rørt - 1], '🥣'); return; }
        bolle.aktiv = false; opptatt = true;
        si('Nå steker vi kaka! Tre, to, en...', '🔥');
        oppdragTimer(() => {
          lyd.pop(); sprut(bolleP.clone().add(V3(0, 0.2, 0)), 30, { farger: [0xffffff, 0xf7a8c4], fart: 1.2, str: 0.03 });
          fjernTing(bolle); opptatt = false;
          const kake = lagTing(lag.kake(), bolleP, { r: 0.24, hopp: false, ved: (t) => {
            t.aktiv = false; lyd.pop();
            sprut(bolleP.clone().add(V3(0, 0.2, 0)), 20, { farger: [0xf7a8c4, 0xfff3f6], fart: 1.5 });
            visKartbit(bolleP.clone().add(V3(0, 0.45, 0)));
          } });
          kake.hint = 'Trykk på kaka!';
          si('Kaka er ferdig! Hmm, det er noe inni. Trykk på kaka!', '🎂');
          framgang();
        }, 2200);
      } });
      bolle.hint = 'Her er bollen. Trykk på den!';
      for (let i = 0; i < ting5.length; i++) {
        const [navn, ikon, p] = ting5[i];
        const t = lagTing(lag[navn](), påFlate(...p, { h: 0.01 }), { r: 0.14, ved: (t) => {
          samle(t); ikonOk(i); har++;
          if (har < 5) si(['Ett!', 'To!', 'Tre!', 'Fire! En til!'][har - 1] + ' ' + ikon, ikon);
          else { o.hjelpMål = () => (bolle.aktiv ? bolle : null); bolle.hjelp = true; si('Alt er funnet! Gå til den blå bollen på kjøkkenøya og trykk på den. Rør fem ganger!', '🥣'); }
        } });
        t.hint = 'Her er ' + navn + '!';
      }
      si('Vi skal bake en skattekake! Finn egg, melk, mel, jordbær og sjokolade.', '🎂');
    } });

  // 3: gjemsel i andre etasje. Nøtte fniser; lyden blir sterkere når du er nær.
  OPPDRAG.push({ id: 'm3', navn: 'Gjemsel med Nøtte', kort: 'Gjemsel', ikon: '🙈', merke: '🙈', start: [6.3, 6.6, 2.776, 3.0, 6.6, 3.6],
    hint1: 'Hi hi! Hør, jeg er her borte!',
    kjør(o) {
      const steder = [[2.6, 10.3], [3.0, 6.5], [9.2, 4.1], [10.6, 9.8], [15.6, 6.3], [11.5, 4.0], [8.8, 4.2], [15.6, 10.4]];
      const brukt = new Set();
      let runde = 0, gjemt = null;
      settIkoner(['🐿️', '🐿️', '🐿️']);
      const gjem = () => {
        // tilfeldig gjemmested som ikke er brukt, og som har et ståsted med fri sikt (så hjelpen alltid kan vise vei)
        const rekke = steder.map((x, i) => i).filter((i) => !brukt.has(i)).sort(() => Math.random() - 0.5);
        let p = null, f = null;
        for (const i of rekke) {
          const q = påFlate(steder[i][0], steder[i][1], 2.776, { h: 0 });
          const st = ståsted(q.clone().add(V3(0, 0.22, 0)));
          if (st) { brukt.add(i); p = q; f = st; break; }
          brukt.add(i);
        }
        if (!p) { p = påFlate(3.0, 6.5, 2.776); f = null; }
        lyd.sus();
        o.nøtteModus = 'gjemt'; nøtte.modus = 'gjemt'; nøtte.mål.copy(p);
        gjemt = lagTing(new THREE.Group(), p.clone().add(V3(0, 0.22, 0)), { r: 0.28, glitter: false, hopp: false, ved: (t) => {
          fjernTing(t); gjemt = null;
          lyd.fnis(0.3); lyd.pling(); ikonOk(runde); runde++; gimynt(2); framgang();
          sprut(p.clone().add(V3(0, 0.3, 0)), 20, { farger: [0xffcf3f, 0xff9a3f], fart: 1.4 });
          o.nøtteModus = 'følg'; nøtte.modus = 'følg';
          if (runde === 3) { si('Du fant meg igjen! Her, ta kartbiten!', '🎉'); oppdragTimer(() => visKartbit(), 1500); return; }
          si(['Du fant meg! Lukk øynene, jeg gjemmer meg igjen!', 'Hi hi! En gang til! Tell til tre!'][runde - 1], '🙈');
          oppdragTimer(gjem, 3200);
        } });
        gjemt.hint = 'Hør! Her er jeg!';
        gjemt.ståsted = f;
        si(runde === 0 ? 'Nå gjemmer jeg meg! Hør etter fnisingen, og finn meg!' : 'Klar, ferdig, finn meg!', '👂');
      };
      // fnis med jevne mellomrom: sterkere jo nærmere, og fra riktig side
      const fnisLøkke = () => {
        if (!oppdrag || oppdrag !== o) return;
        if (gjemt) {
          const d = gjemt.pos.distanceTo(camera.position);
          camera.getWorldDirection(_f); _h.set(-_f.z, 0, _f.x).normalize();
          const til = gjemt.pos.clone().sub(camera.position).normalize();
          lyd.fnis(Math.min(0.35, 0.5 / (1 + d / 2)) + (hjelpNivå ? 0.1 : 0), til.dot(_h));
        }
        oppdragTimer(fnisLøkke, 3600);
      };
      si('Nå leker vi gjemsel! Jeg gjemmer meg i andre etasje. Lukk øynene!', '🙈');
      oppdragTimer(gjem, 2600);
      oppdragTimer(fnisLøkke, 4500);
    } });

  // 4: rydd og sorter: leker i tre farger, kister i samme farge
  OPPDRAG.push({ id: 'm4', navn: 'Rydd i kistene', kort: 'Rydde', ikon: '🧸', merke: '🧸', start: [7.8, 5.4, 2.776, 7.8, 3.9, 3.1],
    kjør(o) {
      const FARGE = { rød: 0xe0312f, blå: 0x2f74e0, gul: 0xf5c518 };
      const kister = [['rød', [6.5, 4.3]], ['gul', [7.25, 3.95]], ['blå', [8.9, 4.2]]].map(([f, [X, Y]]) => {
        const p = påFlate(X, Y, 2.776, { gulv: true });
        const t = lagTing(lag.kiste(FARGE[f]), p, { r: 0.32, hopp: false, glitter: false, hjelp: false, data: { farge: f }, ved: (t) => slippI(t) });
        t.hint = 'Her er den ' + f + 'e kista!';
        return t;
      });
      const leker = [['ball', 'rød', '⚽', [3.0, 6.5]], ['bil', 'blå', '🚙', [3.5, 8.5]], ['bamse', 'gul', '🧸', [8.8, 10.0]], ['kloss', 'rød', '🧱', [9.3, 6.5]], ['ring', 'blå', '🔵', [13.8, 7.8]], ['and', 'gul', '🦆', [10.6, 9.8]]];
      let holder = null, ryddet = 0;
      settIkoner(leker.map((l) => l[2]));
      const lekeTing = leker.map(([type, farge, ikon, [X, Y]], i) => {
        const t = lagTing(lag.leke(type, FARGE[farge]), påFlate(X, Y, 2.776, { h: 0.005 }), { r: 0.16, data: { farge, ikon, i, hjem: null }, ved: (t) => {
          if (holder) { holder.obj.visible = true; holder.aktiv = true; }
          holder = t; t.aktiv = false; t.obj.visible = false;
          lyd.mynt(); framgang();
          $('sHaand').textContent = '🤲 ' + ikon; $('sHaand').style.display = 'block';
          si(`Du har ${t.data.farge === 'gul' ? 'en gul' : t.data.farge === 'rød' ? 'en rød' : 'en blå'} ${ikon}. Legg den i den ${farge}e kista!`, ikon);
        } });
        t.hint = 'Her er en leke!';
        return t;
      });
      function slippI(k) {
        if (!holder) { lyd.hmm(); si('Finn en leke først, så legger vi den i kista.', '🧸'); return; }
        if (k.data.farge !== holder.data.farge) {
          lyd.hmm(); framgang();
          animer(0.4, (e) => { k.obj.rotation.y = Math.sin(e * Math.PI * 4) * 0.15; });
          si(`Hmm, leken er ${holder.data.farge}. Finn den ${holder.data.farge}e kista!`, holder.data.ikon);
          return;
        }
        const t = holder; holder = null; $('sHaand').style.display = 'none';
        t.obj.visible = true;
        const lokk = k.obj.getObjectByName('lokk');
        animer(0.25, (e) => { lokk.position.y = 0.33 + e * 0.25; });
        flyTil(t.obj, foran(0.6, 0.4), k.pos.clone().add(V3(0, 0.2, 0)), 0.55, 0.5).then(() => {
          fjernTing(t);
          animer(0.25, (e) => { lokk.position.y = 0.58 - e * 0.25; });
          lyd.pling(); sprut(k.pos.clone().add(V3(0, 0.4, 0)), 14, { farger: [FARGE[k.data.farge], 0xffffff], fart: 1.2 });
        });
        ikonOk(t.data.i); ryddet++; gimynt(1); framgang();
        if (ryddet === leker.length) { si('Alt er ryddet! Hva er det som ligger der?', '✨'); oppdragTimer(() => visKartbit(kister[1].pos.clone().add(V3(0, 0.75, 0))), 1200); }
        else si(['Riktig!', 'Flott!', 'Ja, der hører den hjemme!', 'Bra jobba!', 'Bare en igjen!'][ryddet - 1], '⭐');
      }
      o.hjelpMål = () => {
        if (holder) return kister.find((k) => k.data.farge === holder.data.farge);
        return null;
      };
      si('Lekene ligger strødd i andre etasje! Finn dem, og legg hver leke i kista med samme farge.', '🧸');
    } });

  // 5: ballonger på loftet; den gylne har kartbiten
  OPPDRAG.push({ id: 'm5', navn: 'Ballonger på loftet', kort: 'Loftet', ikon: '🎈', merke: '🎈', start: [11.0, 7.1, 5.42, 15.0, 7.0, 6.3],
    kjør(o) {
      const FARGER = [0xff5a5f, 0x3f8cff, 0x3fb36b, 0xb45cff, 0xff9a3f, 0xff6fb5];
      let sprukket = 0, laget = 0;
      const MÅL = 10;
      settIkoner(['🎈', '🎈', '🎈', '🎈', '🎈', '🎈', '🎈', '🎈', '🎈', '🌟']);
      const gulvY = camera.position.y - A.OYE;
      function nyBallong() {
        if (!oppdrag || oppdrag !== o || laget >= MÅL) return;
        if (ting.filter((t) => t.aktiv).length >= 4) { oppdragTimer(nyBallong, 1000); return; }
        // et sted foran deg med fri sikt
        let p = null;
        for (let k = 0; k < 12 && !p; k++) {
          camera.getWorldDirection(_f); _f.y = 0; _f.normalize(); _h.set(-_f.z, 0, _f.x);
          const q = camera.position.clone().addScaledVector(_f, 1.6 + Math.random() * 2.2).addScaledVector(_h, (Math.random() - 0.5) * 2.2);
          const d = A.stråle(V3(q.x, gulvY + 1.0, q.z), NED, 3);
          if (d >= 3) continue;
          q.y = gulvY + 1.0 - d;
          if (Math.abs(q.y - gulvY) > 0.1) continue;
          const øye = camera.position, til = q.clone().add(V3(0, 0.6, 0)).sub(øye), L = til.length();
          if (A.stråle(øye, til.normalize(), L) < L - 0.3) continue;
          p = q;
        }
        if (!p) { oppdragTimer(nyBallong, 600); return; }
        laget++;
        const gull = laget === MÅL;
        const obj = lag.ballong(gull ? 0xf4c430 : FARGER[laget % FARGER.length], gull);
        const t = lagTing(obj, p, { r: 0.3, hopp: false, glitter: gull, glitterH: 0.85, ved: (t) => {
          t.aktiv = false; fjernTing(t);
          const sp = t.obj.position.clone().add(V3(0, 0.6, 0));
          lyd.pop(); sprut(sp, 18, { farger: gull ? [0xf4c430, 0xffffff] : [FARGER[sprukket % FARGER.length], 0xffffff, 0xffcf3f], fart: 2, g: 2 });
          ikonOk(sprukket); sprukket++; gimynt(1); framgang();
          if (gull) { si('Den gylne ballongen! Se hva som falt ut!', '🌟'); visKartbit(sp.clone().add(V3(0, -0.2, 0))); return; }
          si(['Pang!', 'Pop!', 'Hi hi!', 'Bom!', 'Pang pang!'][sprukket % 5], '🎈');
          oppdragTimer(nyBallong, 500);
        } });
        t.data.stig = 0;
        t.hint = 'Der er en ballong!';
        if (gull) si('Se, en gyllen ballong! Trykk på den!', '🌟');
        oppdragTimer(nyBallong, 1800);
      }
      o.steg = (dt, tid) => {
        for (const t of ting) {
          if (!t.aktiv || t.data.stig === undefined) continue;
          if (t.data.base === undefined) t.data.base = t.pos.y;
          t.data.stig = Math.min(1.1, t.data.stig + dt * 0.25);
          t.obj.position.y = t.data.base + t.data.stig + Math.sin(tid * 2 + t.fase) * 0.05;
          t.obj.rotation.z = Math.sin(tid * 1.3 + t.fase) * 0.1;
          t.pos.y = t.obj.position.y + 0.6;      // trykkpunktet er selve ballongen
        }
      };
      si('Ballonger på loftet! Trykk på dem så de smeller. Et sted er det en gyllen ballong!', '🎈');
      oppdragTimer(nyBallong, 1500);
    } });

  // 6: hagen: plant blomster, finn pinnsvinet, gi det et eple
  OPPDRAG.push({ id: 'm6', navn: 'Pinnsvinet i hagen', kort: 'Hagen', ikon: '🦔', merke: '🦔', start: [16.6, -0.75, -0.425, 12.0, -3.0, 0.0],
    kjør(o) {
      const flekker = [[12, -2], [14, -3.5], [10, -4], [8, -2.5]];
      const BLOMST = [0xff5a5f, 0xb45cff, 0xff9a3f, 0xff6fb5];
      let plantet = 0, harEple = false;
      settIkoner(['🌷', '🌷', '🌷', '🌷', '🦔', '🍎']);
      flekker.forEach(([X, Y], i) => {
        const p = påFlate(X, Y, -0.55, { gulv: true });
        const t = lagTing(lag.flekk(), p, { r: 0.3, hopp: false, glitter: true, glitterH: 0.2, ved: (t) => {
          fjernTing(t);
          const b = pynt(lag.blomst(BLOMST[i]), p); b.scale.setScalar(0.01);
          animer(0.8, (k) => b.scale.setScalar(0.01 + myk(k) * 1.4));
          lyd.pling(); sprut(p.clone().add(V3(0, 0.3, 0)), 12, { farger: [BLOMST[i], 0xffffff], fart: 1 });
          ikonOk(plantet); plantet++; gimynt(1); framgang();
          if (plantet < 4) si(['En blomst!', 'Så fin!', 'En til!'][plantet - 1], '🌷');
          else { si('Så fine blomster! Hør, noe rasler i hagen. Hvem er det?', '🦔'); oppdragTimer(visPinnsvin, 1500); }
        } });
        t.hint = 'Plant en blomst her!';
      });
      let pinnsvin = null, eple = null;
      function visPinnsvin() {
        const p = påFlate(6, -5, -0.55, { gulv: true });
        pinnsvin = lagTing(lag.pinnsvin(), p, { r: 0.25, ved: (t) => {
          if (!harEple) {
            if (!t.data.møtt) { t.data.møtt = true; ikonOk(4); lyd.fnis(0.15); framgang(); si('Et pinnsvin! Det er sultent. Kan du finne et eple til det?', '🍎'); visEple(); }
            else { lyd.hmm(); si('Pinnsvinet vil ha et eple. Finn eplet!', '🍎'); }
            return;
          }
          t.aktiv = false; lyd.tygg(); framgang(); $('sHaand').style.display = 'none';
          const e = pynt(lag.eple(), foran(0.6, 0.4));
          flyTil(e, e.position.clone(), p.clone().add(V3(0, 0.05, 0.25)), 0.6, 0.3).then(() => { scene.remove(e); });
          animer(1.2, (k) => { t.obj.position.y = t.pos.y + Math.abs(Math.sin(k * Math.PI * 4)) * 0.15; });
          si('Nam nam! Pinnsvinet er glad. Det har noe til deg!', '🦔');
          oppdragTimer(() => visKartbit(p.clone().add(V3(0, 0.5, 0))), 1600);
        } });
        pinnsvin.hint = 'Her er pinnsvinet!';
        o.hjelpMål = () => (harEple ? (pinnsvin && pinnsvin.aktiv ? pinnsvin : null) : (pinnsvin.data.møtt && eple && eple.aktiv ? eple : null));
      }
      function visEple() {
        const p = påFlate(17.5, -5, -0.55, { gulv: true });
        const t = eple = lagTing(lag.eple(), p, { r: 0.18, ved: (t) => {
          samle(t); harEple = true; ikonOk(5);
          $('sHaand').textContent = '🤲 🍎'; $('sHaand').style.display = 'block';
          si('Et eple! Gi det til pinnsvinet. Trykk på pinnsvinet!', '🦔');
        } });
        t.hint = 'Her er eplet!';
      }
      si('Velkommen til hagen! Trykk på de lysende flekkene for å plante blomster.', '🌷');
    } });

  // 7: golf i annekset: fem slag i golfsimulatoren gir kartbiten. Ferdig spilt: fri golf så lenge man vil.
  OPPDRAG.push({ id: 'm7', navn: 'Golf i annekset', kort: 'Golf', ikon: '⛳', merke: '⛳', start: [-6.3, -3.55, -0.435, -6.45, -7.0, 0.75],
    kjør(o) {
      o.nøtteModus = 'følg';
      if (data.ferdig.m7) {
        startGolf({ påFerdig: () => { avsluttOppdrag(); visKart(); } });
        si('Fri golf! Hold fingeren på skjermen og slipp for å slå. Trykk på den grønne haken når du er ferdig.', '⛳');
        return;
      }
      settIkoner(['⛳', '⛳', '⛳', '⛳', '⛳']);
      let stjerner = 0;
      startGolf({
        iOppdrag: true,
        påSlag(nr, n) {
          ikonListe[nr].ik = '⭐'.repeat(n); ikonOk(nr); stjerner += n;
          if (nr === 4) {
            stoppGolf();
            oppdragTimer(() => { si(`Du fikk ${stjerner} stjerner! Og se hva som kom ut av skjermen!`, '⛳'); visKartbit(golf.mat.clone().add(V3(0, 0.9, -0.7))); }, 1800);
            return false;
          }
          return true;
        },
        påFerdig: () => { avsluttOppdrag(); visKart(); },
      });
      si('Golf! Hold fingeren på skjermen, og slipp for å slå. Jo lenger du holder, jo lenger flyr ballen!', '⛳');
    } });

  // 8: gjørmebilen i garasjen
  OPPDRAG.push({ id: 'm8', navn: 'Gjørmebilen', kort: 'Garasjen', ikon: '🚗', merke: '🚗', start: [-2.0, 7.0, -0.516, -4.4, 9.4, 0.2],
    kjør(o) {
      const sentrum = påFlate(-4.4, 9.4, -0.516, { gulv: true });
      const bil = pynt(lag.bil(), sentrum);
      // flekker på østsida, panseret, taket og bak (bilen står nord–sør, fronten mot nord)
      const flekker = [[0.41, 0.45, 0.3, 'ø'], [0.41, 0.5, -0.4, 'ø'], [0.38, 0.85, -0.1, 'ø'], [0, 0.66, 0.6, 'opp'], [0, 1.0, -0.2, 'opp'], [-0.15, 0.45, -0.86, 'bak']];
      let rene = 0;
      settIkoner(flekker.map(() => '🟤'));
      flekker.forEach(([x, y, z, side], i) => {
        const g = lag.gjørme();
        const p = sentrum.clone().add(V3(x, y, -z));     // three.js: -z er nord
        if (side === 'ø') g.rotation.y = Math.PI / 2; else if (side === 'opp') g.rotation.x = -Math.PI / 2; else g.rotation.y = 0;
        const t = lagTing(g, p, { r: 0.2, hopp: false, glitter: false, ved: (t) => {
          t.aktiv = false; lyd.plask(); framgang();
          sprut(p, 14, { farger: [0xffffff, 0xd6f0ff], fart: 0.9, str: 0.035, g: -0.6, vokse: 0.4, liv: 1.4 });
          animer(0.4, (k) => t.obj.scale.setScalar(1 - k)).then(() => fjernTing(t));
          ikonListe[i].ik = '✨'; ikonOk(i); rene++; gimynt(1);
          if (rene < flekker.length) si(['Skrubb!', 'Plask!', 'Blank og fin!', 'Mer såpe!', 'En igjen!'][rene - 1], '🫧');
          else {
            si('Bilen er ren! Pip pip!', '🚗');
            lyd.tut();
            const lys = bil.children.filter((c) => c.name === 'lys');
            animer(1.5, (k) => { const på = Math.floor(k * 6) % 2 === 0; lys.forEach((l) => { l.material = mat(0xfff3a0, på ? 2 : 0.5); }); });
            oppdragTimer(() => visKartbit(sentrum.clone().add(V3(0.9, 0.9, 0.5))), 1700);
          }
        } });
        t.hint = 'Her er det gjørme!';
      });
      si('Å nei, bilen er full av gjørme! Trykk på flekkene for å vaske den.', '🚗');
    } });

  // 9: finalen: grav fram skattekista ved krysset
  OPPDRAG.push({ id: 'm9', navn: 'Skattekista', kort: 'Skatten', ikon: '👑', merke: '👑', finale: true, start: [16.6, -0.75, -0.425, 10.0, -4.0, 0.0],
    kjør(o) {
      const p = påFlate(9.5, -4.0, -0.55, { gulv: true });
      let grav = 0;
      settIkoner(['⛏️', '⛏️', '⛏️', '⛏️', '⛏️']);
      const kryss = lagTing(lag.kryss(), p, { r: 0.45, hopp: false, glitterH: 0.3, ved: (t) => {
        grav++; lyd.grav(); framgang();
        sprut(p.clone().add(V3(0, 0.1, 0)), 14, { farger: [0x6b4219, 0x8a5a2b, 0x4a3a2c], fart: 1.8, str: 0.04 });
        ikonOk(grav - 1);
        t.obj.position.y = t.pos.y - grav * 0.02;
        if (grav < 5) { si(['Grav!', 'Grav, grav!', 'Dypere!', 'Nesten!'][grav - 1], '⛏️'); return; }
        fjernTing(t);
        const kiste = lag.skattekiste();
        const k = lagTing(kiste, p.clone().add(V3(0, -0.5, 0)), { r: 0.45, hopp: false, glitterH: 0.7, ved: (k) => åpne(k) });
        k.aktiv = false;
        animer(1.2, (e) => { k.obj.position.y = p.y - 0.5 + myk(e) * 0.5; }).then(() => { k.pos.copy(p); k.aktiv = true; });
        lyd.fanfare();
        si('Skattekista! Trykk på den for å åpne!', '👑');
      } });
      kryss.hint = 'Krysset! Her er skatten!';
      function åpne(k) {
        k.aktiv = false; opptatt = true;
        const lokk = k.obj.getObjectByName('lokk');
        animer(0.9, (e) => { lokk.rotation.x = -myk(e) * 1.9; });
        k.obj.getObjectByName('gull').visible = true;
        lyd.pling(); gimynt(20);
        for (let i = 0; i < 4; i++) oppdragTimer(() => sprut(p.clone().add(V3(0, 0.5, 0)), 14, { farger: [0xf4c430, 0xffe27a], fart: 2.4, str: 0.035, g: 5 }), 300 + i * 350);
        for (let i = 0; i < 5; i++) oppdragTimer(() => {
          const høyt = p.clone().add(V3((Math.random() - 0.5) * 6, 5 + Math.random() * 2, (Math.random() - 0.5) * 3 - 2));
          lyd.smell(); sprut(høyt, 20, { farger: [[0xff5a5f, 0xffcf3f], [0x3f8cff, 0xffffff], [0x3fb36b, 0xb45cff]][i % 3], fart: 3.5, str: 0.08, g: 1, opp: -0.3, liv: 1.6 });
        }, 900 + i * 600);
        si('Gull! Masse gull! Og se, fyrverkeri!', '🎆');
        oppdragTimer(() => { opptatt = false; data.ferdig.m9 = true; lagre(); øktFerdig++; const def = oppdrag.def; avsluttOppdrag(); visFeiring(def); }, 5200);
      }
      si('Kartet er helt! Krysset viser hvor skatten er. Finn det røde krysset i hagen og grav!', '❌');
    } });

  // ---------------------------------------------------------------- hovedløkka (henger seg på app.js)
  let tid = 0;
  A.etterSteg.push((dt) => {
    tid += dt;
    if (snuTil) {
      snuTil.t = Math.min(1, snuTil.t + dt / 0.35);
      A.yaw = snuTil.fra + (snuTil.til - snuTil.fra) * myk(snuTil.t);
      if (snuTil.t >= 1) snuTil = null;
    }
    animSteg(dt);
    partikkelSteg(dt);
    tingSteg(dt, tid);
    miniSteg(tid);
    nøtteSteg(dt, tid);
    if (oppdrag && oppdrag.steg) oppdrag.steg(dt, tid);
    golfSteg(dt);
    hjelpSteg(dt);
    pilSteg();
    if (pratTid && performance.now() > pratTid) { prat.classList.remove('vis'); pratTid = 0; $('sIkoner').style.top = ''; }
  });

  // ---------------------------------------------------------------- testgrensesnitt (automatiske tester)
  window.spill = {
    data: () => JSON.parse(JSON.stringify(data)),
    skjerm: () => modusSkjerm,
    oppdrag: () => (oppdrag ? oppdrag.def.id : null),
    hjelpNivå: () => hjelpNivå,
    sisteTale: () => (sisteTale ? sisteTale[0] : null),
    ting: () => ting.filter((t) => t.aktiv && t.obj.parent).map((t) => { const s = skjerm(t.pos); return { id: t.id, x: Math.round(s.x), y: Math.round(s.y), foran: s.foran, synlig: synlig(t), avst: +t.pos.distanceTo(camera.position).toFixed(2) }; }),
    neste() {
      const t = hjelpMål(); if (!t) return null;
      const s = skjerm(t.pos);
      return { id: t.id, x: Math.round(s.x), y: Math.round(s.y), foran: s.foran, synlig: synlig(t), avst: +t.pos.distanceTo(camera.position).toFixed(2),
        påSkjerm: s.foran && s.x > 20 && s.x < innerWidth - 20 && s.y > 20 && s.y < innerHeight - 20 };
    },
    settStille(s) { stille = s; },
    mini: { liste: () => miniListe.map((m) => m.id), åpne: (id) => { const m = miniListe.find((x) => x.id === id); if (m) åpneMini(m); }, åpen: () => miniÅpen,
      merker: () => miniTing.map((t) => { const s = skjerm(t.pos); return { id: t.m.id, x: Math.round(s.x), y: Math.round(s.y), foran: s.foran, synlig: synlig(t), avst: +t.pos.distanceTo(camera.position).toFixed(2), ståsted: !!ståsted(t.pos) }; }),
      tryll: (id) => { const t = miniTing.find((x) => x.m.id === id); if (t) tryllTil(t); } },
    travel: () => travel,
    // sjekk av plasseringene: finnes ståsted med fri sikt for alle ting i hvert oppdrag?
    ståsted: (id) => { const t = ting.find((x) => x.id === id); if (!t) return null; const f = ståsted(t.pos); return f ? [+f.x.toFixed(2), +(-f.z).toFixed(2), +f.y.toFixed(2)] : null; },
  };

  visKart(true);
}

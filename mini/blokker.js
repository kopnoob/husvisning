// Blokkbrettet på loftet (sjanger: blokkpuslespill). Dra brikkene fra arbeidsbenken inn på brettet; fulle rader og kolonner forsvinner.
// Kan ikke tapes: brikkene som deles ut får alltid plass, og blir brettet for fullt, kommer kosten og feier bort to rader.
// Runden varer 90 s eller til 8 linjer er ryddet.
export default {
  id: 'blokker', navn: 'Blokkbrettet', ikon: '🟦', rom: 'Loftet', hjelp: 'dra', poengIkon: '⭐', bakgrunn: '#d9b88c',
  start(api) {
    const { ctx, lyd } = api;
    const N = 8, VARIGHET = 90, MÅL = 8;
    const FARGER = [['#4f9bd9', '#7dbdf0', '#2f6fa8'], ['#e8554e', '#f58b84', '#b23731'], ['#f5c533', '#ffe07a', '#c4921a'], ['#3fb36b', '#74d495', '#2a8049'],
      ['#b06fd8', '#cf9ef0', '#7f45a8'], ['#f2994a', '#f9bf87', '#c46a1f'], ['#2ec4c4', '#7ee3e3', '#1b8f8f']];
    const F = (s) => s.split(' ').map((p) => p.split(',').map(Number));
    const FORMER = [
      F('0,0'), F('0,0 0,1'), F('0,0 1,0'), F('0,0 0,1 0,2'), F('0,0 1,0 2,0'),
      F('0,0 1,0 1,1'), F('0,1 1,0 1,1'), F('0,0 0,1 1,0'), F('0,0 0,1 1,1'),
      F('0,0 0,1 1,0 1,1'), F('0,0 0,1 0,2 0,3'), F('0,0 1,0 2,0 3,0'),
      F('0,0 1,0 2,0 2,1'), F('0,1 1,1 2,1 2,0'), F('0,0 0,1 0,2 1,0'), F('0,0 0,1 0,2 1,2'),
      F('0,0 0,1 0,2 0,3 0,4'), F('0,0 1,0 2,0 3,0 4,0'),
      F('0,0 1,0 2,0 2,1 2,2'), F('0,0 0,1 0,2 1,0 2,0'), F('0,2 1,2 2,2 2,1 2,0'), F('0,0 0,1 0,2 1,2 2,2'),
    ];
    for (const f of FORMER) { f.h = Math.max(...f.map((p) => p[0])) + 1; f.w = Math.max(...f.map((p) => p[1])) + 1; }
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    const ri = (n) => Math.floor(api.rnd() * n);
    let L = null, bg = null, bgNøkkel = '', ruteBilder = [];
    const brett = [];
    for (let r = 0; r < N; r++) brett.push(new Array(N).fill(-1));
    const inn = [];                          // inn[r][c]: lite sprett når ruta nettopp er lagt
    for (let r = 0; r < N; r++) inn.push(new Array(N).fill(0));
    let brikker = [null, null, null];        // { f: form, farge, vis: { x, y, s } }
    let drag = null, linjer = 0, poeng = 0, fase = 'spill', faseT = 0, kost = null, hintBuf = null, hintNøkkel = '';
    const rydd = [];                         // ruter som blinker og forsvinner { r, c, farge, t }
    let lampeT = [];

    // ---------------------------------------------------------------- oppsett
    function oppsett() {
      const W = api.w, H = api.h, t = api.trygg, ligg = W > H;
      let c, bx, by, brett_ = null, benk;
      if (ligg) {
        const y0 = t.topp - 64, y1 = H - t.bunn;
        c = Math.floor(Math.min((y1 - y0) / 8.25, (W - t.venstre - t.høyre - 215 - 200) / 8.25));
        const bw = c * N;
        bx = Math.max(215, Math.round((W - bw) / 2 - 60)); by = Math.round(y0 + ((y1 - y0) - bw) / 2);
        benk = { x0: bx + bw + 18, y0: y0 + 4, x1: W - t.høyre, y1, rad: false };
        L = { ligg, ix: t.venstre + 6, iy: t.topp + 8, iw: bx - 22 - t.venstre - 6 };
      } else {
        const x0 = t.venstre, x1 = W - t.høyre, y0 = t.topp, y1 = H - t.bunn;
        c = Math.floor(Math.min((x1 - x0) / 8.2, (y1 - y0 - 200) / 8.25));
        const bw = c * N;
        bx = Math.round((W - bw) / 2); by = y0 + 6;
        const iy = by + bw + 16;               // måleren mellom brettet og benken
        benk = { x0, y0: iy + 58, x1, y1, rad: true };
        L = { ligg, ix: x0, iy, iw: x1 - x0 };
      }
      Object.assign(L, { W, H, c, bx, by, bw: c * N, benk });
      // tre plasser på arbeidsbenken
      L.plass = [];
      for (let i = 0; i < 3; i++) {
        if (benk.rad) { const w = (benk.x1 - benk.x0) / 3; L.plass.push({ x0: benk.x0 + i * w, y0: benk.y0, x1: benk.x0 + (i + 1) * w, y1: benk.y1 }); }
        else { const h = (benk.y1 - benk.y0) / 3; L.plass.push({ x0: benk.x0, y0: benk.y0 + i * h, x1: benk.x1, y1: benk.y0 + (i + 1) * h }); }
      }
      if (!ruteBilder.length || ruteBilder.c !== c) lagRuter();
    }
    // én ferdig tegnet rute per farge (med kant og glans), gjenbrukes overalt
    function lagRuter() {
      const c = L.c;
      ruteBilder = FARGER.map(([f, lys, mørk]) => {
        const k = document.createElement('canvas');
        k.width = k.height = Math.ceil(c * DPR);
        const g = k.getContext('2d');
        g.scale(DPR, DPR);
        const p = Math.max(1.5, c * 0.04), r = c * 0.18;
        g.fillStyle = mørk; rr(g, p, p, c - 2 * p, c - 2 * p, r); g.fill();
        g.fillStyle = f; rr(g, p, p, c - 2 * p, c - 2 * p - c * 0.08, r); g.fill();
        g.fillStyle = lys; rr(g, p + c * 0.1, p + c * 0.08, c - 2 * p - c * 0.2, c * 0.16, c * 0.08); g.fill();
        g.fillStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.arc(c * 0.3, c * 0.3, c * 0.07, 0, 7); g.fill();
        return k;
      });
      ruteBilder.c = c;
    }
    function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

    // loftet: skråtak med sperrer, takvindu, gulvplanker, hobbyting på hylla, brettet og arbeidsbenken
    function lagBakgrunn() {
      const { W, H, c, bx, by, bw, benk } = L;
      const k = document.createElement('canvas');
      k.width = Math.round(W * DPR); k.height = Math.round(H * DPR);
      const g = k.getContext('2d');
      g.setTransform(DPR, 0, 0, DPR, 0, 0);
      g.fillStyle = '#e6c99c'; g.fillRect(0, 0, W, H);
      for (let x = 0; x < W; x += 34) { g.fillStyle = 'rgba(120,70,20,.08)'; g.fillRect(x, 0, 2, H); }
      // skråtaket på begge sider
      const tak = Math.min(W, H) * 0.42;
      for (const side of [0, 1]) {
        g.save();
        if (side) { g.translate(W, 0); g.scale(-1, 1); }
        g.fillStyle = '#b98a57'; g.beginPath(); g.moveTo(0, 0); g.lineTo(tak * 1.4, 0); g.lineTo(0, tak * 1.2); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(80,45,15,.3)'; g.lineWidth = 3;
        for (let i = 1; i < 6; i++) { const q = i / 6; g.beginPath(); g.moveTo(tak * 1.4 * q, 0); g.lineTo(0, tak * 1.2 * q); g.stroke(); }
        g.fillStyle = '#8a5a2e'; g.beginPath(); g.moveTo(tak * 1.4, 0); g.lineTo(tak * 1.4 + 14, 0); g.lineTo(0, tak * 1.2 + 12); g.lineTo(0, tak * 1.2); g.closePath(); g.fill();
        g.restore();
      }
      // takvindu med himmel
      const vx = L.ligg ? L.ix + L.iw / 2 : W * 0.86, vy = L.ligg ? Math.max(L.iy + 190, H - 110) : H * 0.03 + 4, vr = L.ligg ? Math.min(42, L.iw * 0.28) : 0;
      if (vr > 0) {
        g.fillStyle = '#8a5a2e'; g.beginPath(); g.arc(vx, vy, vr + 6, 0, 7); g.fill();
        g.fillStyle = '#a9dcf5'; g.beginPath(); g.arc(vx, vy, vr, 0, 7); g.fill();
        g.fillStyle = '#fff'; g.beginPath(); g.ellipse(vx - vr * 0.3, vy + vr * 0.2, vr * 0.35, vr * 0.15, 0, 0, 7); g.fill();
        g.fillStyle = '#8a5a2e'; g.fillRect(vx - 2, vy - vr, 4, vr * 2); g.fillRect(vx - vr, vy - 2, vr * 2, 4);
      }
      // gulvplanker
      const gy = H - Math.min(46, H * 0.08);
      g.fillStyle = '#a7713f'; g.fillRect(0, gy, W, H - gy);
      g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, gy, W, 3);
      for (let x = 20; x < W; x += 70) g.fillRect(x, gy + 3, 2, H);
      // arbeidsbenken under brikkene
      g.fillStyle = 'rgba(60,30,10,.25)'; rr(g, benk.x0 + 4, benk.y0 + 6, benk.x1 - benk.x0, benk.y1 - benk.y0, 16); g.fill();
      g.fillStyle = '#c99561'; rr(g, benk.x0, benk.y0, benk.x1 - benk.x0, benk.y1 - benk.y0, 16); g.fill();
      g.fillStyle = 'rgba(255,240,210,.25)'; rr(g, benk.x0 + 6, benk.y0 + 6, benk.x1 - benk.x0 - 12, benk.y1 - benk.y0 - 12, 12); g.fill();
      g.strokeStyle = 'rgba(110,60,20,.25)'; g.lineWidth = 2;
      for (let i = 1; i < 3; i++) {
        const p = L.plass[i]; g.beginPath();
        if (benk.rad) { g.moveTo(p.x0, benk.y0 + 14); g.lineTo(p.x0, benk.y1 - 14); } else { g.moveTo(benk.x0 + 14, p.y0); g.lineTo(benk.x1 - 14, p.y0); }
        g.stroke();
      }
      // hobbyting i hjørnet av benken
      g.font = '22px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#000';
      // brettet: mørk ramme med innfelte ruter
      g.fillStyle = 'rgba(50,25,5,.3)'; rr(g, bx - 10 + 5, by - 10 + 7, bw + 20, bw + 20, 14); g.fill();
      g.fillStyle = '#6e4423'; rr(g, bx - 10, by - 10, bw + 20, bw + 20, 14); g.fill();
      g.fillStyle = '#4a2e18'; rr(g, bx - 2, by - 2, bw + 4, bw + 4, 8); g.fill();
      for (let r = 0; r < N; r++) for (let cc = 0; cc < N; cc++) {
        g.fillStyle = (r + cc) % 2 ? '#5b3b21' : '#61402a'; rr(g, bx + cc * c + 2, by + r * c + 2, c - 4, c - 4, c * 0.16); g.fill();
        g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(bx + cc * c + 4, by + r * c + 2, c - 8, 3);
      }
      bg = k; bgNøkkel = W + 'x' + H;
    }

    oppsett();
    api.vedStørrelse(() => { oppsett(); bg = null; });

    // ---------------------------------------------------------------- logikk
    const passerVed = (f, r, c) => f.every(([dr, dc]) => r + dr >= 0 && r + dr < N && c + dc >= 0 && c + dc < N && brett[r + dr][c + dc] < 0);
    function plasser(f) { const ut = []; for (let r = 0; r <= N - f.h; r++) for (let c = 0; c <= N - f.w; c++) if (passerVed(f, r, c)) ut.push([r, c]); return ut; }
    const passer = (f) => plasser(f).length > 0;
    function hvile(i) {                      // brikkens hvileplass og skala på benken
      const p = L.plass[i], f = brikker[i].f;
      const s = Math.min(L.c * 0.85, (p.x1 - p.x0 - 22) / f.w, (p.y1 - p.y0 - 22) / f.h);
      return { x: (p.x0 + p.x1) / 2, y: (p.y0 + p.y1) / 2, s };
    }
    function nyBrikke(i, maksStr) {
      let f = null;
      for (let forsøk = 0; forsøk < 40; forsøk++) {
        const kand = FORMER[ri(FORMER.length)];
        if (maksStr && kand.length > maksStr) continue;
        if (passer(kand)) { f = kand; break; }
      }
      if (!f) f = FORMER.filter((x) => x.length <= 2 && passer(x))[0] || FORMER[0];
      brikker[i] = { f, farge: ri(FARGER.length), vis: null };
      const h = hvile(i);
      brikker[i].vis = L.benk.rad ? { x: h.x, y: L.H + 80, s: h.s } : { x: L.W + 80, y: h.y, s: h.s };
    }
    function del() { for (let i = 0; i < 3; i++) nyBrikke(i); lyd.sus(); hintBuf = null; }
    function sikrePlass() {                   // får ingen av de gjenværende plass, byttes de mot mindre brikker
      const igjen = brikker.map((b, i) => (b ? i : -1)).filter((i) => i >= 0);
      if (!igjen.length) { del(); return; }
      if (igjen.some((i) => passer(brikker[i].f))) return;
      for (const i of igjen) nyBrikke(i, 2);
      lyd.plopp();
    }
    const fyllgrad = () => brett.reduce((s, rad) => s + rad.filter((v) => v >= 0).length, 0) / (N * N);
    // linjer som blir fulle hvis f legges i (r, c)
    function fulleLinjer(f, r, c) {
      const opptatt = (rr_, cc) => brett[rr_][cc] >= 0 || f.some(([dr, dc]) => r + dr === rr_ && c + dc === cc);
      const rader = [], kol = [];
      for (let i = 0; i < N; i++) {
        let a = true, b = true;
        for (let j = 0; j < N; j++) { if (!opptatt(i, j)) a = false; if (!opptatt(j, i)) b = false; }
        if (a) rader.push(i); if (b) kol.push(i);
      }
      return { rader, kol };
    }
    function legg(i, r, c) {
      const b = brikker[i];
      for (const [dr, dc] of b.f) { brett[r + dr][c + dc] = b.farge; inn[r + dr][c + dc] = 0.22; }
      brikker[i] = null; hintBuf = null;
      poeng += b.f.length;
      lyd.plopp();
      const { rader, kol } = fulleLinjer([], 0, 0);
      const n = rader.length + kol.length;
      if (n) {
        const fjern = new Set();
        for (const rr_ of rader) for (let j = 0; j < N; j++) fjern.add(rr_ * N + j);
        for (const cc of kol) for (let j = 0; j < N; j++) fjern.add(j * N + cc);
        let k = 0;
        for (const key of fjern) {
          const rr_ = Math.floor(key / N), cc = key % N;
          rydd.push({ r: rr_, c: cc, farge: brett[rr_][cc], t: 0, d: k++ * 0.012 });
          brett[rr_][cc] = -1;
        }
        for (let j = 0; j < n; j++) { if (linjer < MÅL) lampeT[linjer] = 0.0001; linjer++; }
        poeng += n * 10 * n;
        const noter = [0, 4, 7, 12, 16, 19];
        for (let j = 0; j < n; j++) setTimeout(() => lyd.tone(noter[Math.min(5, linjer - n + j)] + 0, 0.18), j * 110);
        lyd.pop();
        if (n > 1) setTimeout(() => lyd.bra(), 260);
      }
      api.poeng(poeng);
      if (linjer >= MÅL) { fase = 'mål'; faseT = 0; setTimeout(() => lyd.fanfare(), 350); return; }
      if (fyllgrad() > 0.7) startKost();
      else sikrePlass();
    }
    function startKost() {                   // vennlig kost feier bort de to fulleste radene
      const rader = brett.map((rad, i) => ({ i, n: rad.filter((v) => v >= 0).length + api.rnd() * 0.1 })).sort((a, b) => b.n - a.n).slice(0, 2).map((x) => x.i);
      kost = { rader, t: 0 };
      fase = 'kost'; lyd.sus();
    }

    // ---------------------------------------------------------------- dra og slipp
    function forskyv(f) {                    // brikken løftes vekk fra fingeren så den synes
      return L.ligg ? { dx: -(f.w * L.c / 2 + 34), dy: -12 } : { dx: 0, dy: -(f.h * L.c / 2 + 40) };
    }
    function landing(b, fx, fy) {            // nærmeste lovlige plass for brikken når fingeren er i (fx, fy)
      const o = forskyv(b.f);
      const cx = fx + o.dx - b.f.w * L.c / 2, cy = fy + o.dy - b.f.h * L.c / 2;
      const kr = (cy - L.by) / L.c, kc = (cx - L.bx) / L.c;
      let best = null, bd = 0.8;
      for (let r = Math.floor(kr) - 1; r <= Math.ceil(kr) + 1; r++) for (let c = Math.floor(kc) - 1; c <= Math.ceil(kc) + 1; c++) {
        const d = Math.hypot(r - kr, c - kc);
        if (d < bd && passerVed(b.f, r, c)) { bd = d; best = [r, c]; }
      }
      return best;
    }
    api.peker((e) => {
      if (fase !== 'spill') { if (e.type === 'opp') drag = null; return; }
      if (e.type === 'ned') {
        let valgt = -1, bd = 1e9;
        for (let i = 0; i < 3; i++) {
          if (!brikker[i]) continue;
          const p = L.plass[i], h = hvile(i);
          const inni = e.x > p.x0 - 12 && e.x < p.x1 + 12 && e.y > p.y0 - 12 && e.y < p.y1 + 12;
          const d = Math.hypot(e.x - h.x, e.y - h.y);
          if ((inni || d < 90) && d < bd) { bd = d; valgt = i; }
        }
        if (valgt >= 0) { drag = { i: valgt, x: e.x, y: e.y }; lyd.hopp(); }
        return;
      }
      if (!drag) return;
      if (e.type === 'flytt') { drag.x = e.x; drag.y = e.y; return; }
      if (e.type === 'opp') {
        const b = brikker[drag.i], pl = landing(b, e.x, e.y);
        if (pl) legg(drag.i, pl[0], pl[1]);
        else lyd.hmm();               // brikken glir tilbake av seg selv
        drag = null;
      }
    });

    // ---------------------------------------------------------------- tegning
    function tegnBrikke(b, x, y, s, alfa) {    // (x, y) = midten av brikken, s = rutestørrelse
      if (alfa !== undefined) ctx.globalAlpha = alfa;
      const x0 = x - b.f.w * s / 2, y0 = y - b.f.h * s / 2;
      for (const [dr, dc] of b.f) ctx.drawImage(ruteBilder[b.farge], x0 + dc * s, y0 + dr * s, s, s);
      if (alfa !== undefined) ctx.globalAlpha = 1;
    }
    function tegnMåler(t) {                  // åtte lamper for linjene og en liten klokke
      const { ix, iy, iw, ligg } = L;
      let r, pos = [];
      if (ligg) {
        r = Math.min(17, (iw - 30) / 8);
        for (let i = 0; i < MÅL; i++) pos.push([ix + iw / 2 + ((i % 4) - 1.5) * r * 2.5, iy + 46 + r + Math.floor(i / 4) * r * 2.6]);
      } else {
        r = Math.min(15, (iw - 60) / 18.5);
        const x0 = ix + (iw - Math.min(iw, 56 + r * 2.3 * MÅL)) / 2; L.mx0 = x0;
        for (let i = 0; i < MÅL; i++) pos.push([x0 + 50 + r + i * r * 2.3, iy + 24]);
      }
      const ur = ligg ? 20 : 19, ux = ligg ? ix + iw / 2 : L.mx0 + 26, uy = ligg ? iy + 12 : iy + 24;
      // bakplate
      ctx.fillStyle = 'rgba(255,248,232,.85)';
      if (ligg) api.rundRekt(ix + iw / 2 - r * 5.3, iy - 14, r * 10.6, 46 + r * 4.6 + 22, 16);
      else api.rundRekt(ix + (iw - Math.min(iw, 56 + r * 2.3 * MÅL)) / 2, iy, Math.min(iw, 56 + r * 2.3 * MÅL), 48, 24);
      if (!ligg) { ctx.fill(); } else { ctx.fill(); }
      // klokke
      const igjen = Math.max(0, 1 - api.tid / VARIGHET);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ux, uy, ur, 0, 7); ctx.fill();
      ctx.fillStyle = igjen < 0.2 ? '#f08a5d' : '#8fc9e8';
      ctx.beginPath(); ctx.moveTo(ux, uy); ctx.arc(ux, uy, ur - 3, -Math.PI / 2, -Math.PI / 2 + igjen * Math.PI * 2); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#8a5a2e'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(ux, uy, ur, 0, 7); ctx.stroke();
      for (let i = 0; i < MÅL; i++) {
        const [x, y] = pos[i], lt = lampeT[i] || 0;
        ctx.fillStyle = '#c9b18d'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
        if (lt) {
          const q = Math.min(1, lt / 0.3), s = q < 1 ? 0.5 + q * 0.7 : 1;
          ctx.fillStyle = '#f5c533'; ctx.beginPath(); ctx.arc(x, y, r * Math.min(1, s), 0, 7); ctx.fill();
          api.emoji('⭐', x, y, Math.round(r * 1.5 * s));
        }
      }
    }

    api.løkke((dt, t) => {
      if (!bg || bgNøkkel !== api.w + 'x' + api.h) { oppsett(); lagBakgrunn(); }
      faseT += dt;
      ctx.drawImage(bg, 0, 0, api.w, api.h);
      const { c, bx, by } = L;
      // lagte ruter
      for (let r = 0; r < N; r++) for (let cc = 0; cc < N; cc++) {
        const v = brett[r][cc];
        if (v < 0) continue;
        let s = c;
        if (inn[r][cc] > 0) { inn[r][cc] = Math.max(0, inn[r][cc] - dt); s = c * (1 + Math.sin((inn[r][cc] / 0.22) * Math.PI) * 0.12); }
        ctx.drawImage(ruteBilder[v], bx + (cc + 0.5) * c - s / 2, by + (r + 0.5) * c - s / 2, s, s);
      }
      // skygge der brikken vil lande, og linjene som da blir fulle
      if (drag && brikker[drag.i]) {
        const b = brikker[drag.i], pl = landing(b, drag.x, drag.y);
        if (pl) {
          const { rader, kol } = fulleLinjer(b.f, pl[0], pl[1]);
          ctx.fillStyle = 'rgba(255,240,170,.28)';
          for (const rr_ of rader) ctx.fillRect(bx, by + rr_ * c, L.bw, c);
          for (const k of kol) ctx.fillRect(bx + k * c, by, c, L.bw);
          ctx.fillStyle = 'rgba(110,230,130,.55)';
          for (const [dr, dc] of b.f) { api.rundRekt(bx + (pl[1] + dc) * c + 3, by + (pl[0] + dr) * c + 3, c - 6, c - 6, c * 0.16); ctx.fill(); }
          tegnBrikke(b, bx + (pl[1] + b.f.w / 2) * c, by + (pl[0] + b.f.h / 2) * c, c, 0.35);
        }
      }
      // linjer som blinker og forsvinner
      for (let i = rydd.length - 1; i >= 0; i--) {
        const q = rydd[i];
        q.t += dt;
        const tt = q.t - q.d;
        if (tt < 0) { ctx.drawImage(ruteBilder[q.farge], bx + q.c * c, by + q.r * c, c, c); continue; }
        if (tt > 0.42) { rydd.splice(i, 1); continue; }
        const x = bx + (q.c + 0.5) * c, y = by + (q.r + 0.5) * c;
        if (tt < 0.2) {
          ctx.drawImage(ruteBilder[q.farge], x - c / 2, y - c / 2, c, c);
          ctx.fillStyle = `rgba(255,255,255,${Math.floor(tt * 30) % 2 ? 0.75 : 0.25})`; api.rundRekt(x - c / 2 + 2, y - c / 2 + 2, c - 4, c - 4, c * 0.16); ctx.fill();
        } else {
          if (!q.sprut) { q.sprut = true; if (rydd.length < 40 || (q.r + q.c) % 2) api.sprut(x, y, FARGER[q.farge][0], 2); }
          const s = c * (1 - (tt - 0.2) / 0.22);
          ctx.globalAlpha = Math.max(0, s / c); ctx.drawImage(ruteBilder[q.farge], x - s / 2, y - s / 2, s, s); ctx.globalAlpha = 1;
        }
      }
      // kosten feier to rader
      if (kost) {
        kost.t += dt;
        const q = Math.min(1, kost.t / 1.1), kx = bx - c + q * (L.bw + 2 * c);
        for (const r of kost.rader) {
          const y = by + (r + 0.5) * c;
          for (let cc = 0; cc < N; cc++) if (brett[r][cc] >= 0 && bx + (cc + 0.5) * c < kx) { rydd.push({ r, c: cc, farge: brett[r][cc], t: 0.2, d: 0 }); brett[r][cc] = -1; api.sprut(bx + (cc + 0.5) * c, y, '#d8c3a5', 2); }
          api.emoji('🧹', kx, y - c * 0.15, Math.round(c * 1.25), -0.5 + Math.sin(kost.t * 18) * 0.15);
        }
        if (q >= 1) { kost = null; fase = 'spill'; sikrePlass(); }
      }
      // brikkene på benken (og den som dras)
      const k = 1 - Math.exp(-dt * 14);
      for (let i = 0; i < 3; i++) {
        const b = brikker[i];
        if (!b) continue;
        if (drag && drag.i === i) {
          const o = forskyv(b.f);
          b.vis.x += (drag.x + o.dx - b.vis.x) * Math.min(1, k * 2.2); b.vis.y += (drag.y + o.dy - b.vis.y) * Math.min(1, k * 2.2); b.vis.s += (c - b.vis.s) * k;
          continue;
        }
        const h = hvile(i), kan = passer(b.f);
        b.vis.x += (h.x - b.vis.x) * k; b.vis.y += (h.y - b.vis.y) * k; b.vis.s += (h.s - b.vis.s) * k;
        tegnBrikke(b, b.vis.x, b.vis.y + Math.sin(t * 2 + i) * 1.5, b.vis.s, kan ? 1 : 0.45);
      }
      if (drag && brikker[drag.i]) {
        const b = brikker[drag.i];
        ctx.fillStyle = 'rgba(40,20,5,.18)';
        for (const [dr, dc] of b.f) { api.rundRekt(b.vis.x - b.f.w * b.vis.s / 2 + dc * b.vis.s + 6, b.vis.y - b.f.h * b.vis.s / 2 + dr * b.vis.s + 10, b.vis.s - 4, b.vis.s - 4, 6); ctx.fill(); }
        tegnBrikke(b, b.vis.x, b.vis.y, b.vis.s * 1.04);
      }
      for (let i = 0; i < MÅL; i++) if (lampeT[i]) lampeT[i] += dt;
      tegnMåler(t);

      if (fase === 'mål' && faseT > 1.6) { fase = 'slutt'; api.ferdig({ stjerner: 3, poeng }); }
      if (fase !== 'mål' && fase !== 'slutt' && t >= VARIGHET && !drag) { fase = 'slutt'; api.ferdig({ stjerner: linjer >= MÅL ? 3 : linjer >= 3 ? 2 : 1, poeng }); }
    });

    del();

    return {
      hint() {
        if (fase !== 'spill' || drag) return null;
        const nøkkel = brett.map((r) => r.map((v) => (v < 0 ? 0 : 1)).join('')).join('') + brikker.map((b) => (b ? FORMER.indexOf(b.f) : '-')).join(',');
        if (nøkkel !== hintNøkkel) {
          hintNøkkel = nøkkel; hintBuf = null;
          let bs = -1;
          for (let i = 0; i < 3; i++) {
            const b = brikker[i];
            if (!b) continue;
            for (const [r, c] of plasser(b.f)) {
              const { rader, kol } = fulleLinjer(b.f, r, c);
              let naboer = 0;
              for (const [dr, dc] of b.f) for (const [a, d] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) { const y = r + dr + a, x = c + dc + d; if (y < 0 || y >= N || x < 0 || x >= N || brett[y][x] >= 0) naboer++; }
              const s = (rader.length + kol.length) * 100 + naboer + b.f.length * 0.5;
              if (s > bs) { bs = s; hintBuf = { i, r, c }; }
            }
          }
        }
        if (!hintBuf || !brikker[hintBuf.i]) return null;
        const b = brikker[hintBuf.i], h = hvile(hintBuf.i), o = forskyv(b.f);
        const mx = L.bx + (hintBuf.c + b.f.w / 2) * L.c, my = L.by + (hintBuf.r + b.f.h / 2) * L.c;
        return { x: h.x, y: h.y, x2: mx - o.dx, y2: my - o.dy, vent: 350 };
      },
      tilstand() { return { linjer, poeng, fylt: Math.round(fyllgrad() * 100), fase }; },
      stopp() { drag = null; },
    };
  },
};

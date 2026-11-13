// Sokkevasken i vaskerommet (sjanger: sorteringspuslespill). Sokkene ligger blandet i kurver på benken over vaskemaskinen.
// Trykk på en kurv for å løfte den øverste sokken, trykk på en annen for å legge den der: i en tom kurv eller oppå samme slags sokk.
// Kan ikke tapes og kan ikke låse seg: oppgavene lages baklengs fra løst tilstand, og angreknappen nede i hjørnet går alltid.
export default {
  id: 'sokker', navn: 'Sokkevasken', ikon: '🧦', rom: 'Vaskerommet', hjelp: 'trykk', poengIkon: '🎀', bakgrunn: '#e4eef2',
  start(api) {
    const { ctx, lyd } = api;
    const PLASS = 4;
    const OPPGAVER = [{ farger: 3, kurver: 4, min: 6, maks: 11 }, { farger: 4, kurver: 5, min: 8, maks: 15 }];
    // farge + mønster, så fargesvake også ser forskjell: striper, prikker, ruter, sikksakk
    const SOKK = [
      { f: '#e5484d', m: 'striper', mf: '#fff3e8', h: '#b8292e' },
      { f: '#3b82d6', m: 'prikker', mf: '#ffffff', h: '#245fa8' },
      { f: '#f5c533', m: 'ruter', mf: '#e08a1e', h: '#c98f10' },
      { f: '#3fb36b', m: 'sikksakk', mf: '#ffffff', h: '#2a8a4f' },
    ];
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    const ri = (n) => Math.floor(api.rnd() * n);
    let L = null, bg = null, bgNøkkel = '', sprites = [];
    let kurver = [], lukket = [], løftet = -1, angre = [], trekk = 0, optimalt = 0, sorterte = 0;
    let oppg = -1, fase = 'spill', faseT = 0, planBuf = null, planNøkkel = '', vrikk = [], angreT = 0;

    // ---------------------------------------------------------------- puslespillet (rene tabeller av fargenummer)
    const ferdigKurv = (k) => k.length === PLASS && k.every((f) => f === k[0]);
    const løst = (st) => st.every((k) => !k.length || ferdigKurv(k));
    const lovlig = (st, a, b) => a !== b && st[a].length && st[b].length < PLASS && !ferdigKurv(st[b]) && (!st[b].length || st[b][st[b].length - 1] === st[a][st[a].length - 1]);
    // bredde-først-søk: korteste vei til løst tilstand, som liste av [fra, til]
    function løsning(start) {
      if (løst(start)) return [];
      const nøkkel = (st) => st.map((k) => k.join('')).sort().join('|');
      const sett = new Set([nøkkel(start)]);
      let kø = [{ st: start, vei: [] }];
      while (kø.length && sett.size < 60000) {
        const neste = [];
        for (const { st, vei } of kø) {
          for (let a = 0; a < st.length; a++) {
            if (!st[a].length || ferdigKurv(st[a])) continue;
            const ensfarget = st[a].every((f) => f === st[a][0]);
            for (let b = 0; b < st.length; b++) {
              if (!lovlig(st, a, b)) continue;
              if (ensfarget && !st[b].length) continue;          // meningsløst: flytte en ren bunke til tom kurv
              const ny = st.map((k) => k.slice());
              ny[b].push(ny[a].pop());
              const v = vei.concat([[a, b]]);
              if (løst(ny)) return v;
              const n = nøkkel(ny);
              if (sett.has(n)) continue;
              sett.add(n); neste.push({ st: ny, vei: v });
            }
          }
        }
        kø = neste;
      }
      return null;
    }
    // baklengs blanding: start løst og gjør trekk som kan gjøres om igjen med et lovlig trekk forlengs
    function lagOppgave(o) {
      let best = null;
      for (let forsøk = 0; forsøk < 40; forsøk++) {
        const st = [];
        for (let i = 0; i < o.kurver; i++) st.push(i < o.farger ? [i, i, i, i] : []);
        let sist = null;
        for (let s = 0; s < 160; s++) {
          const kand = [];
          for (let a = 0; a < st.length; a++) {
            if (!st[a].length) continue;
            const f = st[a][st[a].length - 1], under = st[a].length > 1 ? st[a][st[a].length - 2] : -1;
            if (under !== -1 && under !== f) continue;                 // forlengs tilbake må være lovlig
            for (let b = 0; b < st.length; b++) if (b !== a && st[b].length < PLASS && !(sist && sist[0] === b && sist[1] === a)) kand.push([a, b]);
          }
          if (!kand.length) break;
          const [a, b] = kand[ri(kand.length)];
          st[b].push(st[a].pop()); sist = [a, b];
        }
        if (st.some(ferdigKurv)) continue;
        const v = løsning(st);
        if (!v) continue;
        if (v.length >= o.min && v.length <= o.maks) return { st, len: v.length };
        if (!best || Math.abs(v.length - o.min) < Math.abs(best.len - o.min)) best = { st, len: v.length };
      }
      return best;
    }
    function nesteOppgave() {
      oppg++;
      const o = OPPGAVER[oppg], p = lagOppgave(o);
      optimalt += p.len;
      kurver = p.st.map((k, i) => k.map((f, j) => ({ f, x: 0, y: -200 - j * 60 - i * 30, vei: null, rist: 0, ny: true })));
      lukket = kurver.map(() => 0); vrikk = kurver.map(() => 0);
      løftet = -1; angre = []; planBuf = null; fase = 'spill'; faseT = 0;
      oppsett(); bg = null;
      for (const k of kurver) k.forEach((s) => { s.x = 0; });
      for (let i = 0; i < kurver.length; i++) kurver[i].forEach((s) => { s.x = L.kx[i]; });
      lyd.sus();
    }
    const tilstand = () => kurver.map((k) => k.map((s) => s.f));

    // ---------------------------------------------------------------- oppsett
    function oppsett() {
      const W = api.w, H = api.h, t = api.trygg, ligg = W > H, n = kurver.length || 4;
      let x0 = t.venstre, x1 = W - t.høyre;
      const y0 = t.topp, y1 = H - t.bunn;
      if (ligg) { x0 += 88; x1 -= Math.min(170, W * 0.18); }
      const kolW = (x1 - x0) / n;
      const høyde = (b) => { const sh = b * 0.84 * 0.6; return sh * 1.7 + PLASS * sh * 0.96 + b * 0.3; };
      const maksH = ligg ? y1 - y0 - 4 : (y1 - y0) * 0.58;
      let b = Math.min(kolW * 0.86, 130);
      while (høyde(b) > maksH && b > 40) b -= 1;
      const sw = b * 0.84, sh = sw * 0.6, slot = sh * 0.96, kh = PLASS * slot + b * 0.3;
      const bunn = ligg ? y1 - 4 : y0 + Math.max(høyde(b) + 6, (y1 - y0) * 0.5);
      const kx = [];
      for (let i = 0; i < n; i++) kx.push(x0 + (i + 0.5) * kolW);
      L = { W, H, ligg, x0, x1, y0, y1, kolW, b, sw, sh, slot, kh, bunn, topp: bunn - kh, kx, løftY: bunn - kh - sh * 0.95,
        ax: t.venstre + 40, ay: y1 - 40, ar: 36 };
      if (!sprites.length || Math.abs(sprites[0]._sw - sw) > 0.5) lagSprites();
    }
    // sokkene tegnes én gang per størrelse til egne små lerreter
    function lagSprites() {
      const sw = L.sw, sh = L.sh;
      sprites = SOKK.map((d) => {
        const c = document.createElement('canvas');
        c.width = Math.ceil(sw * DPR); c.height = Math.ceil(sh * DPR);
        const g = c.getContext('2d');
        g.scale(DPR, DPR);
        const form = () => {          // sokk som ligger: skaftet mot venstre, foten bøyd ned til høyre
          g.beginPath();
          rr(g, sw * 0.04, sh * 0.08, sw * 0.7, sh * 0.5, sh * 0.16);
          rr(g, sw * 0.5, sh * 0.08, sw * 0.44, sh * 0.84, sh * 0.3);
        };
        g.lineJoin = 'round';
        g.strokeStyle = 'rgba(40,30,30,.55)'; g.lineWidth = 3; form(); g.stroke();
        g.fillStyle = d.f; form(); g.fill();
        g.save(); form(); g.clip();
        g.fillStyle = d.mf; g.strokeStyle = d.mf;
        if (d.m === 'striper') for (let x = sw * 0.2; x < sw; x += sw * 0.13) g.fillRect(x, 0, sw * 0.05, sh);
        else if (d.m === 'prikker') { for (let y = sh * 0.2, r = 0; y < sh; y += sh * 0.24, r++) for (let x = sw * 0.2 + (r % 2) * sw * 0.06; x < sw; x += sw * 0.12) { g.beginPath(); g.arc(x, y, sh * 0.065, 0, 7); g.fill(); } }
        else if (d.m === 'ruter') { g.globalAlpha = 0.55; for (let x = sw * 0.18; x < sw; x += sw * 0.12) g.fillRect(x, 0, sw * 0.045, sh); for (let y = sh * 0.14; y < sh; y += sh * 0.2) g.fillRect(0, y, sw, sh * 0.07); g.globalAlpha = 1; }
        else { g.lineWidth = sh * 0.07; for (let y = sh * 0.24; y < sh; y += sh * 0.26) { g.beginPath(); for (let x = sw * 0.18, i = 0; x < sw + 10; x += sw * 0.06, i++) g.lineTo(x, y + (i % 2 ? -1 : 1) * sh * 0.06); g.stroke(); } }
        // vrist og tå i mørkere farge, ribbet kant ved åpningen
        g.fillStyle = d.h;
        g.beginPath(); g.arc(sw * 0.56, sh * 0.62, sh * 0.2, 0, 7); g.fill();
        g.beginPath(); g.ellipse(sw * 0.72, sh * 0.92, sw * 0.24, sh * 0.16, 0, 0, 7); g.fill();
        g.fillStyle = '#fbf6ee'; g.fillRect(0, 0, sw * 0.17, sh);
        g.fillStyle = 'rgba(0,0,0,.1)'; for (let x = sw * 0.05; x < sw * 0.17; x += sw * 0.035) g.fillRect(x, 0, sw * 0.012, sh);
        g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(0, sh * 0.1, sw, sh * 0.1);
        g.restore();
        c._sw = sw; c._sh = sh;
        return c;
      });
    }
    function rr(g, x, y, w, h, r) { g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

    // vaskerommet: flislagt vegg, benk, vaskemaskin og tørketrommel
    function lagBakgrunn() {
      const { W, H, bunn, ligg } = L;
      const k = document.createElement('canvas');
      k.width = Math.round(W * DPR); k.height = Math.round(H * DPR);
      const g = k.getContext('2d');
      g.setTransform(DPR, 0, 0, DPR, 0, 0);
      g.fillStyle = '#e9f2f5'; g.fillRect(0, 0, W, H);
      const fs = 38;
      g.fillStyle = '#d3e3ea';
      for (let y = 0; y < H; y += fs) g.fillRect(0, y, W, 2);
      for (let y = 0, r = 0; y < H; y += fs, r++) for (let x = (r % 2) * fs / 2; x < W; x += fs) g.fillRect(x, y, 2, fs);
      g.fillStyle = 'rgba(255,255,255,.5)';
      for (let y = 3; y < H; y += fs * 3) g.fillRect(0, y, W, 1);
      // tørkesnor med klesklyper og klær øverst
      const sy = 30, sx0 = 220;
      g.strokeStyle = '#8a7a6a'; g.lineWidth = 2; g.beginPath(); g.moveTo(sx0, sy); g.quadraticCurveTo((sx0 + W) / 2, sy + 16, W - 10, sy); g.stroke();
      g.font = '30px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'top';
      const klær = ['👕', '👗', '🩳', '👕'];
      for (let i = 0; i < 4; i++) {
        if (i > 1 && W - sx0 < 300) break;
        const x = sx0 + 40 + i * Math.min(90, (W - sx0 - 60) / (W - sx0 < 300 ? 2 : 4)), q = (x - sx0) / (W - 10 - sx0);
        g.fillStyle = '#000'; g.fillText(klær[i], x, sy - 2 + Math.sin(q * Math.PI) * 8);
      }
      // benken som kurvene står på
      const bh = 16;
      g.fillStyle = 'rgba(30,50,60,.18)'; g.fillRect(0, bunn + bh, W, 10);
      g.fillStyle = '#c99b6a'; g.fillRect(0, bunn, W, bh);
      g.fillStyle = '#e2b986'; g.fillRect(0, bunn, W, 4);
      // under benken: maskinene (bare der det er plass)
      const top = bunn + bh + 4, hh = H - top;
      g.fillStyle = '#b9ccd6'; g.fillRect(0, top, W, hh);
      if (hh > 120) {
        const mw = Math.min((W - 30) / 2, hh * 0.95);
        for (let i = 0; i < 2; i++) {
          const mx = W - 10 - (2 - i) * (mw + 6) + 6, my = top + 6, mh = hh - 6;
          maskin(g, mx, my, mw, mh, i);
        }
      } else if (ligg) {
        const mw = Math.min(150, W * 0.17) - 10, mx = W - L.x0 * 0 - mw - 10;
        maskin(g, mx, Math.max(L.y0 - 20, bunn - mw * 1.25), mw, mw * 1.25, 0);
      }
      bg = k; bgNøkkel = W + 'x' + H;
    }
    function maskin(g, x, y, w, h, i) {
      g.fillStyle = 'rgba(30,50,60,.2)'; g.beginPath(); rr(g, x + 4, y + 6, w, h, 12); g.fill();
      g.fillStyle = '#fbfdfe'; g.beginPath(); rr(g, x, y, w, h, 12); g.fill();
      g.strokeStyle = '#a9bcc6'; g.lineWidth = 2; g.stroke();
      const ph = Math.min(h * 0.16, 34);
      g.fillStyle = '#e6eef2'; g.fillRect(x + 6, y + 6, w - 12, ph);
      g.fillStyle = '#6d8796'; g.beginPath(); g.arc(x + w - 22, y + 6 + ph / 2, ph * 0.3, 0, 7); g.fill();
      g.fillStyle = i ? '#f2a541' : '#3fb36b'; g.beginPath(); g.arc(x + 20, y + 6 + ph / 2, 5, 0, 7); g.fill();
      const r = Math.min(w * 0.36, (h - ph - 20) * 0.42), cx = x + w / 2, cy = y + ph + 10 + (h - ph - 10) / 2;
      g.fillStyle = '#c8d6dd'; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
      g.fillStyle = '#7d99a8'; g.beginPath(); g.arc(cx, cy, r * 0.82, 0, 7); g.fill();
      g.fillStyle = i ? '#9fc6db' : '#8cc0de'; g.beginPath(); g.arc(cx, cy, r * 0.72, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.ellipse(cx - r * 0.25, cy - r * 0.3, r * 0.3, r * 0.14, -0.6, 0, 7); g.fill();
      if (!i) { g.fillStyle = 'rgba(255,255,255,.6)'; for (let j = 0; j < 5; j++) { g.beginPath(); g.arc(cx + Math.cos(j * 1.3) * r * 0.4, cy + r * 0.3 + Math.sin(j * 2) * r * 0.15, r * 0.08, 0, 7); g.fill(); } }
    }

    nesteOppgave();
    api.vedStørrelse(() => { oppsett(); bg = null; });

    // ---------------------------------------------------------------- trekk
    function mål(i, j) { return { x: L.kx[i], y: L.bunn - L.b * 0.12 - (j + 0.5) * L.slot }; }
    function løft(i) {
      const k = kurver[i];
      if (!k.length || lukket[i]) { vrikk[i] = 0.35; lyd.hmm(); return; }
      løftet = i; lyd.hopp();
    }
    function legg(til) {
      const fra = løftet;
      løftet = -1;
      const st = tilstand();
      if (!lovlig(st, fra, til)) {
        const s = kurver[fra][kurver[fra].length - 1];
        s.rist = 0.4; lyd.hmm(); return;
      }
      const s = kurver[fra].pop();
      kurver[til].push(s);
      s.vei = [{ k: til }];
      trekk++; angre.push([fra, til]); planBuf = null;
      lyd.tone([0, 2, 4, 5, 7, 9, 11, 12][Math.min(7, kurver[til].length * 2 - 1)]);
      sjekkFerdig(til);
    }
    function sjekkFerdig(i) {
      if (!ferdigKurv(tilstand()[i]) || lukket[i]) return;
      lukket[i] = 0.0001; sorterte++; api.poeng(sorterte);
      setTimeout(() => { if (lukket[i]) { lyd.pling(); api.sprut(L.kx[i], L.topp, '✨', 10); api.sprut(L.kx[i], L.topp, SOKK[kurver[i][0].f].f, 8); } }, 250);
      if (løst(tilstand())) { fase = 'løst'; faseT = 0; }
    }
    function angreTrekk() {
      angreT = 0.3;
      if (løftet >= 0) { løftet = -1; lyd.sprett(); return; }
      const a = angre.pop();
      if (!a) { lyd.hmm(); return; }
      const [fra, til] = a;
      if (lukket[til]) { lukket[til] = 0; sorterte--; api.poeng(sorterte); }
      const s = kurver[til].pop();
      kurver[fra].push(s);
      s.vei = [{ k: fra }];
      planBuf = null; lyd.sus();
    }
    function kurvVed(x, y) {
      if (x < L.x0 - 24 || x > L.x1 + 24 || y < L.løftY - L.sh * 1.4 || y > L.bunn + 40) return -1;
      return Math.max(0, Math.min(kurver.length - 1, Math.floor((x - L.x0) / L.kolW)));
    }
    api.peker((e) => {
      if (e.type !== 'ned' || fase !== 'spill') return;
      if (Math.hypot(e.x - L.ax, e.y - L.ay) < L.ar + 14) { angreTrekk(); return; }
      const i = kurvVed(e.x, e.y);
      if (i < 0) return;
      if (løftet < 0) løft(i);
      else if (løftet === i) { løftet = -1; lyd.sprett(); }
      else legg(i);
    });

    // ---------------------------------------------------------------- tegning
    function tegnKurv(i, t) {
      const x = L.kx[i], b = L.b, top = L.topp, kh = L.kh;
      const v = vrikk[i] > 0 ? Math.sin(vrikk[i] * 40) * 0.03 * vrikk[i] / 0.35 : 0;
      ctx.save(); ctx.translate(x, L.bunn); ctx.rotate(v); ctx.translate(-x, -L.bunn);
      // bakvegg
      ctx.fillStyle = '#b07d4a'; api.rundRekt(x - b / 2, top, b, kh, b * 0.14); ctx.fill();
      ctx.fillStyle = 'rgba(70,40,15,.35)'; api.rundRekt(x - b / 2 + 5, top + 6, b - 10, kh - 12, b * 0.1); ctx.fill();
      ctx.restore();
      return v;
    }
    function tegnKurvForan(i, v, t) {
      const x = L.kx[i], b = L.b, top = L.topp, kh = L.kh;
      ctx.save(); ctx.translate(x, L.bunn); ctx.rotate(v); ctx.translate(-x, -L.bunn);
      // flettet ramme: sider, bunn og kant
      ctx.fillStyle = '#d29a5c';
      ctx.fillRect(x - b / 2, top + 4, b * 0.08, kh - 8); ctx.fillRect(x + b / 2 - b * 0.08, top + 4, b * 0.08, kh - 8);
      api.rundRekt(x - b / 2, L.bunn - b * 0.12, b, b * 0.12, b * 0.05); ctx.fill();
      ctx.fillStyle = '#e8b97d'; api.rundRekt(x - b / 2 - 3, top - 3, b + 6, b * 0.1, b * 0.05); ctx.fill();
      ctx.fillStyle = 'rgba(120,70,25,.35)';
      for (let y = top + b * 0.16; y < L.bunn - b * 0.14; y += b * 0.12) { ctx.fillRect(x - b / 2, y, b * 0.08, 2); ctx.fillRect(x + b / 2 - b * 0.08, y, b * 0.08, 2); }
      // lokket med sløyfe når kurven er ferdig
      if (lukket[i]) {
        const q = Math.min(1, lukket[i] / 0.35), e = 1 - (1 - q) * (1 - q);
        const ly = top - b * 0.5 + e * b * 0.42;
        ctx.globalAlpha = e;
        ctx.fillStyle = SOKK[kurver[i][0].f].f; api.rundRekt(x - b / 2 - 5, ly, b + 10, b * 0.2, b * 0.08); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.35)'; api.rundRekt(x - b / 2, ly + 3, b, b * 0.05, b * 0.03); ctx.fill();
        ctx.globalAlpha = 1;
        const bq = Math.max(0, Math.min(1, (lukket[i] - 0.25) / 0.3));
        if (bq > 0) {
          const s = bq < 1 ? 0.4 + bq * 0.8 : 1 + Math.sin(t * 3 + i) * 0.04;
          api.emoji('🎀', x, ly + b * 0.05, Math.round(b * 0.5), Math.sin(t * 2 + i) * 0.08, 1);
          if (bq < 1) { ctx.fillStyle = 'rgba(255,255,255,' + (1 - bq) * 0.6 + ')'; ctx.beginPath(); ctx.arc(x, ly, b * 0.4 * s, 0, 7); ctx.fill(); }
        }
        if (Math.floor(t * 3 + i) % 4 === 0) api.emoji('✨', x + Math.sin(t * 5 + i) * b * 0.35, top + kh * 0.3 + Math.cos(t * 4 + i) * kh * 0.25, 16);
      }
      ctx.restore();
    }
    function tegnSokk(s, x, y, rot) {
      const sp = sprites[s.f];
      if (rot) { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.drawImage(sp, -sp._sw / 2, -sp._sh / 2, sp._sw, sp._sh); ctx.restore(); }
      else ctx.drawImage(sp, x - sp._sw / 2, y - sp._sh / 2, sp._sw, sp._sh);
    }
    function tegnAngre(t) {
      const { ax, ay, ar } = L, aktiv = angre.length > 0 || løftet >= 0;
      const s = angreT > 0 ? 1 - Math.sin((angreT / 0.3) * Math.PI) * 0.12 : 1;
      ctx.fillStyle = 'rgba(30,50,60,.25)'; ctx.beginPath(); ctx.arc(ax + 2, ay + 4, ar * s, 0, 7); ctx.fill();
      ctx.fillStyle = aktiv ? '#fffaf0' : 'rgba(255,250,240,.6)'; ctx.beginPath(); ctx.arc(ax, ay, ar * s, 0, 7); ctx.fill();
      ctx.strokeStyle = aktiv ? '#f2a541' : 'rgba(150,150,150,.5)'; ctx.lineWidth = 4; ctx.stroke();
      api.emoji('↩️', ax, ay, Math.round(ar * 1.15), 0, aktiv ? 1 : 0.35);
    }

    api.løkke((dt, t) => {
      if (!bg || bgNøkkel !== api.w + 'x' + api.h) { oppsett(); lagBakgrunn(); }
      faseT += dt;
      if (angreT > 0) angreT = Math.max(0, angreT - dt);
      for (let i = 0; i < kurver.length; i++) { if (vrikk[i] > 0) vrikk[i] = Math.max(0, vrikk[i] - dt); if (lukket[i]) lukket[i] += dt; }
      ctx.drawImage(bg, 0, 0, api.w, api.h);
      const k = 1 - Math.exp(-dt * 13);
      for (let i = 0; i < kurver.length; i++) {
        const v = tegnKurv(i, t);
        ctx.save(); ctx.beginPath(); ctx.rect(0, -1000, L.W, L.bunn - L.b * 0.1 + 1000); ctx.clip();
        for (let j = 0; j < kurver[i].length; j++) {
          const s = kurver[i][j];
          if (løftet === i && j === kurver[i].length - 1) continue;
          let m = mål(i, j);
          if (s.vei && s.vei.length) {           // over målkurven først, så ned i den
            const via = { x: L.kx[s.vei[0].k], y: L.løftY };
            if (Math.abs(s.x - via.x) > 4) m = via; else s.vei = null;
          }
          s.x += (m.x - s.x) * k; s.y += (m.y - s.y) * k;
          if (s.rist > 0) s.rist = Math.max(0, s.rist - dt);
          tegnSokk(s, s.x + (s.rist ? Math.sin(s.rist * 45) * 7 * s.rist / 0.4 : 0), s.y, 0);
        }
        ctx.restore();
        tegnKurvForan(i, v, t);
      }
      // den løftede sokken svever over kurven sin
      if (løftet >= 0) {
        const s = kurver[løftet][kurver[løftet].length - 1];
        const m = { x: L.kx[løftet], y: L.løftY + Math.sin(t * 5) * 4 };
        s.x += (m.x - s.x) * k; s.y += (m.y - s.y) * k;
        ctx.fillStyle = 'rgba(30,50,60,.15)'; ctx.beginPath(); ctx.ellipse(m.x, L.topp - 6, L.sw * 0.35, 5, 0, 0, 7); ctx.fill();
        tegnSokk(s, s.x, s.y, Math.sin(t * 4) * 0.08);
      }
      tegnAngre(t);
      if (fase === 'løst' && faseT > 0.6 && faseT - dt <= 0.6) { lyd.fanfare(); for (let i = 0; i < kurver.length; i++) api.sprut(L.kx[i], L.topp - L.b * 0.3, '⭐', 3); }
      if (fase === 'løst' && faseT > 2.2) {
        if (oppg + 1 < OPPGAVER.length) nesteOppgave();
        else {
          fase = 'slutt';
          const r = trekk / Math.max(1, optimalt);
          api.ferdig({ stjerner: r <= 1.35 ? 3 : r <= 2 ? 2 : 1, poeng: sorterte });
        }
      }
    });

    return {
      hint() {
        if (fase !== 'spill') return null;
        const st = tilstand(), n = st.map((k) => k.join('')).join('|');
        if (n !== planNøkkel) { planNøkkel = n; planBuf = løsning(st); }
        const pos = (i) => ({ x: L.kx[i], y: mål(i, Math.max(0, Math.min(PLASS - 1, kurver[i].length - (løftet < 0 || løftet === i ? 1 : 0)))).y, vent: 450 });
        if (!planBuf) return løftet >= 0 ? pos(løftet) : { x: L.ax, y: L.ay, vent: 450 };     // låst: angre
        if (!planBuf.length) return null;
        const [fra, til] = planBuf[0];
        if (løftet < 0) return pos(fra);
        return løftet === fra ? pos(til) : pos(løftet);
      },
      tilstand() { return { oppg, trekk, optimalt, sorterte, løftet, kurver: tilstand().map((k) => k.join('')).join('|') }; },
    };
  },
};

// Tre på rad i matboden (sjanger: bytt to naboer og få tre like på rad). Matvarer står på hyller i et skap.
// Dra en vare mot naboen (eller trykk to naboer) for å bytte. Tre eller flere like forsvinner ned i handlekurven.
// Kan ikke tapes: runden slutter når kurven er full eller etter 90 s. Fire eller fem på rad rydder hele raden.
export default {
  id: 'syltetoy', navn: 'Tre på rad', ikon: '🍯', rom: 'Matboden', hjelp: 'dra', poengIkon: '🍯', bakgrunn: '#e8d2a6',
  start(api) {
    const { ctx, lyd } = api;
    const N = 6, SLAG = ['🍯', '🍓', '🧀', '🥕', '🍎'], FARGE = ['#f2a93b', '#e8414f', '#f7d046', '#f08a24', '#c9302c'];
    const VARIGHET = 90, MÅL = 90, POP = 0.3;
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    const ri = (n) => Math.floor(api.rnd() * n);
    let L = null, bg = null, bgNøkkel = '';
    let brett = [];                         // brett[r][c] = { s, x, y, v, fall, pop, land } (x, y = visuell kolonne/rad)
    let fase = 'fall', faseT = 0, kjede = 0, samlet = 0, valgt = null, trykk = null, byttet = null, ristT = 0;
    let trekkBuf = null, sluttT = -1, kurvHopp = 0;
    const flyvere = [], stråler = [], iKurven = [];

    // ---------------------------------------------------------------- oppsett (regnes ut på nytt ved ny størrelse)
    function oppsett() {
      const W = api.w, H = api.h, t = api.trygg, ligg = W > H;
      let c, bx, by, panel;
      if (ligg) {
        let y0 = t.topp - 64, y1 = H - t.bunn;
        c = Math.floor(Math.min((y1 - y0) / 6.3, (W - t.venstre - t.høyre) * 0.62 / 6.3));
        let rm = c * 0.15;
        bx = W - t.høyre - rm - c * N - 4;
        if (bx - rm < 215) {                 // brettet ville gått inn under knappene: start under dem
          y0 = t.topp; c = Math.floor(Math.min((y1 - y0) / 6.3, (W - t.venstre - t.høyre) * 0.62 / 6.3)); rm = c * 0.15;
          bx = W - t.høyre - rm - c * N - 4;
        }
        by = y0 + rm + Math.max(0, ((y1 - y0) - c * N - 2 * rm) / 2);
        panel = { x0: t.venstre, y0: t.topp, x1: bx - rm - 10, y1 };
      } else {
        const x0 = t.venstre, x1 = W - t.høyre, y0 = t.topp, y1 = H - t.bunn;
        c = Math.floor(Math.min((x1 - x0) / 6.3, (y1 - y0 - 170) / 6.3));
        const rm = c * 0.15;
        bx = Math.round((W - c * N) / 2); by = y0 + rm;
        panel = { x0, y0: by + c * N + rm + 6, x1, y1 };
      }
      L = { W, H, c, bx, by, bw: c * N, rm: c * 0.15, panel, ligg };
      const pw = panel.x1 - panel.x0, ph = panel.y1 - panel.y0;
      // kurven (med hank) midt i panelet, klokka til høyre for den
      L.ur = 26;
      L.kw = Math.min(pw - 2 * L.ur - 40, (ph - 10) / 1.15, 250);
      const kh = L.kw * 0.62, bredde = L.kw + 2 * L.ur + 26;
      L.kx = panel.x0 + (pw - bredde) / 2 + L.kw / 2;
      const y0 = panel.y0 + (ph - kh * 1.8) / 2 + kh * 0.8;
      L.ky = y0 + kh * 0.1;
      L.ux = L.kx + L.kw / 2 + 26 + L.ur; L.uy = y0 - kh * 0.2;
    }

    // bakgrunnen tegnes én gang per størrelse: veggpanel, hyller med krukker, skapet med hyllene brikkene står på
    function lagBakgrunn() {
      const { W, H, c, bx, by, bw, rm } = L;
      const k = document.createElement('canvas');
      k.width = Math.round(W * DPR); k.height = Math.round(H * DPR);
      const g = k.getContext('2d');
      g.setTransform(DPR, 0, 0, DPR, 0, 0);
      g.fillStyle = '#ecd6aa'; g.fillRect(0, 0, W, H);
      for (let x = 0; x < W; x += 44) { g.fillStyle = 'rgba(120,80,30,.07)'; g.fillRect(x, 0, 2, H); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x + 2, 0, 1, H); }
      // gulv
      const gy = H - Math.min(60, H * 0.09);
      g.fillStyle = '#a8703f'; g.fillRect(0, gy, W, H - gy);
      g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, gy, W, 4);
      for (let x = -30; x < W; x += 90) { g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(x, gy + 4, 2, H); }
      // veggyller med krukker i panelet
      // sekker og krukker står på gulvet ved siden av kurven
      const p = L.panel;
      const pynt = ['🥫', '🧅', '🍞', '🥔', '🧂', '🥫'];
      g.font = '34px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'bottom';
      let i = 0;
      for (let x = p.x0 + 22; x < p.x1 - 14; x += 44) {
        if (Math.abs(x - L.kx) < L.kw * 0.5 + 26) continue;
        g.fillStyle = 'rgba(60,30,10,.18)'; g.beginPath(); g.ellipse(x, gy + 6, 17, 5, 0, 0, 7); g.fill();
        g.fillStyle = '#000'; g.fillText(pynt[i++ % pynt.length], x, gy + 8);
      }
      // skapet
      g.fillStyle = 'rgba(60,30,10,.22)'; rr(g, bx - rm + 5, by - rm + 7, bw + rm * 2, bw + rm * 2, 12); g.fill();
      g.fillStyle = '#7a4a24'; rr(g, bx - rm, by - rm, bw + rm * 2, bw + rm * 2, 12); g.fill();
      g.fillStyle = '#d6aa72'; rr(g, bx - 2, by - 2, bw + 4, bw + 4, 6); g.fill();
      for (let i = 0; i < N; i++) { g.fillStyle = i % 2 ? 'rgba(255,255,255,.06)' : 'rgba(120,70,20,.05)'; g.fillRect(bx + i * c, by, c, bw); }
      for (let r = 0; r < N; r++) {
        const y = by + (r + 1) * c - c * 0.11;
        g.fillStyle = 'rgba(80,40,10,.18)'; g.fillRect(bx, y - c * 0.06, bw, c * 0.06);
        g.fillStyle = '#93602f'; g.fillRect(bx - 2, y, bw + 4, c * 0.11);
        g.fillStyle = '#c38a4f'; g.fillRect(bx - 2, y, bw + 4, c * 0.035);
      }
      g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 2; rr(g, bx - rm + 3, by - rm + 3, bw + rm * 2 - 6, bw + rm * 2 - 6, 10); g.stroke();
      bg = k; bgNøkkel = W + 'x' + H;
    }
    function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

    oppsett();
    api.vedStørrelse(() => { oppsett(); bg = null; trykk = null; });

    // ---------------------------------------------------------------- brettlogikk
    const ny = (s, c, y) => ({ s, x: c, y, v: 0, fall: true, pop: 0, land: 0 });
    function rekkeVed(r, c) {
      const s = brett[r][c].s;
      let a = 1;
      for (let k = c - 1; k >= 0 && brett[r][k].s === s; k--) a++;
      for (let k = c + 1; k < N && brett[r][k].s === s; k++) a++;
      if (a >= 3) return true;
      a = 1;
      for (let k = r - 1; k >= 0 && brett[k][c].s === s; k--) a++;
      for (let k = r + 1; k < N && brett[k][c].s === s; k++) a++;
      return a >= 3;
    }
    function byttObj(r, c, r2, c2) { const p = brett[r][c]; brett[r][c] = brett[r2][c2]; brett[r2][c2] = p; }
    function finnTrekk() {                  // alle bytter som gir tre på rad: [r, c, r2, c2]
      const ut = [];
      for (let r = N - 1; r >= 0; r--) for (let c = 0; c < N; c++) {
        for (const [dr, dc] of [[0, 1], [1, 0]]) {
          const r2 = r + dr, c2 = c + dc;
          if (r2 >= N || c2 >= N || brett[r][c].s === brett[r2][c2].s) continue;
          byttObj(r, c, r2, c2);
          if (rekkeVed(r, c) || rekkeVed(r2, c2)) ut.push([r, c, r2, c2]);
          byttObj(r, c, r2, c2);
        }
      }
      return ut;
    }
    function finnRekker() {
      const ut = [];
      for (let r = 0; r < N; r++) for (let c = 0; c < N;) {
        let e = c + 1; while (e < N && brett[r][e].s === brett[r][c].s) e++;
        if (e - c >= 3) ut.push({ h: true, i: r, a: c, n: e - c });
        c = e;
      }
      for (let c = 0; c < N; c++) for (let r = 0; r < N;) {
        let e = r + 1; while (e < N && brett[e][c].s === brett[r][c].s) e++;
        if (e - r >= 3) ut.push({ h: false, i: c, a: r, n: e - r });
        r = e;
      }
      return ut;
    }
    function fyll() {
      for (let forsøk = 0; forsøk < 60; forsøk++) {
        brett = [];
        for (let r = 0; r < N; r++) {
          const rad = [];
          brett.push(rad);
          for (let c = 0; c < N; c++) {
            let s;
            do { s = ri(SLAG.length); } while ((c >= 2 && rad[c - 1].s === s && rad[c - 2].s === s) || (r >= 2 && brett[r - 1][c].s === s && brett[r - 2][c].s === s));
            rad.push(ny(s, c, r - N - 1.5 - c * 0.35));
          }
        }
        if (finnTrekk().length >= 3) return;
      }
    }
    fyll();

    function bytt(r, c, r2, c2) {
      if (fase !== 'klar') return;
      byttObj(r, c, r2, c2);
      byttet = [r, c, r2, c2]; fase = 'bytt'; faseT = 0; valgt = null; trekkBuf = null;
      lyd.klikk();
    }
    function løs() {
      const rekker = finnRekker();
      trekkBuf = null;
      if (rekker.length) { kjede++; pop(rekker); fase = 'pop'; faseT = 0; return; }
      kjede = 0;
      if (samlet >= MÅL) { fase = 'mål'; faseT = 0; lyd.fanfare(); for (let i = 0; i < 6; i++) api.sprut(L.kx + (i - 2.5) * 16, L.ky - L.kw * 0.3, '⭐', 2); return; }
      if (!finnTrekk().length) { stokk(); return; }
      fase = 'klar';
    }
    function pop(rekker) {
      const sett = new Set();
      let ekstra = false;
      for (const k of rekker) {
        for (let j = 0; j < k.n; j++) sett.add(k.h ? k.i * N + k.a + j : (k.a + j) * N + k.i);
        if (k.n >= 4) {                      // fire eller fem på rad: hele raden (eller søylen) ryddes
          ekstra = true;
          for (let j = 0; j < N; j++) sett.add(k.h ? k.i * N + j : j * N + k.i);
          stråler.push({ h: k.h, i: k.i, t: 0 });
        }
      }
      let n = 0;
      for (const key of sett) {
        const r = Math.floor(key / N), c = key % N, p = brett[r][c];
        p.pop = 0.0001; samlet++;
        const x = L.bx + (c + 0.5) * L.c, y = L.by + (r + 0.45) * L.c;
        api.sprut(x, y, FARGE[p.s], ekstra ? 3 : 4);
        if (n++ % (sett.size > 8 ? 2 : 1) === 0 && flyvere.length < 26) flyvere.push({ s: p.s, x0: x, y0: y, t: -n * 0.03 });
      }
      const noter = [0, 4, 7, 12, 16, 19, 24];
      lyd.tone(noter[Math.min(noter.length - 1, kjede - 1)]);
      if (kjede > 1) lyd.pop();
      if (ekstra) { lyd.sus(); lyd.bra(); }
      api.poeng(samlet);
    }
    function fjernOgFall() {
      for (let c = 0; c < N; c++) {
        const kol = [];
        for (let r = N - 1; r >= 0; r--) if (!brett[r][c].pop) kol.push(brett[r][c]);
        const m = N - kol.length;
        for (let r = N - 1; r >= 0; r--) {
          const i = N - 1 - r;
          if (i < kol.length) { const p = kol[i]; brett[r][c] = p; if (p.y < r - 0.001) p.fall = true; }
          else brett[r][c] = ny(ri(SLAG.length), c, r - m - 0.4);
        }
      }
    }
    function stokk() {                       // ingen trekk igjen: varene glir til nye plasser
      const alle = [];
      for (const rad of brett) for (const p of rad) alle.push(p);
      for (let forsøk = 0; forsøk < 200; forsøk++) {
        for (let i = alle.length - 1; i > 0; i--) { const j = ri(i + 1); const t = alle[i]; alle[i] = alle[j]; alle[j] = t; }
        for (let i = 0; i < alle.length; i++) brett[Math.floor(i / N)][i % N] = alle[i];
        if (forsøk > 150) for (const p of alle) p.s = ri(SLAG.length);
        if (!finnRekker().length && finnTrekk().length) break;
      }
      fase = 'stokk'; faseT = 0; lyd.sus();
    }
    // flytter brikkene mot plassen sin; true når alle står stille
    function flyttBrikker(dt) {
      let ro = true;
      const k = 1 - Math.exp(-dt * 16);
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const p = brett[r][c];
        if (p.pop) p.pop += dt;
        if (p.land > 0) p.land = Math.max(0, p.land - dt);
        p.x += (c - p.x) * k;
        if (Math.abs(c - p.x) < 0.01) p.x = c; else ro = false;
        if (p.fall) {
          p.v = Math.min(20, p.v + 55 * dt); p.y += p.v * dt;
          if (p.y >= r) { p.y = r; p.v = 0; p.fall = false; p.land = 0.16; } else ro = false;
        } else {
          p.y += (r - p.y) * k;
          if (Math.abs(r - p.y) < 0.01) p.y = r; else ro = false;
        }
      }
      return ro;
    }

    // ---------------------------------------------------------------- peker: dra mot naboen, eller trykk to naboer
    function celleVed(x, y) {
      const m = L.c * 0.45;
      if (x < L.bx - m || x > L.bx + L.bw + m || y < L.by - m || y > L.by + L.bw + m) return null;
      return [Math.max(0, Math.min(N - 1, Math.floor((y - L.by) / L.c))), Math.max(0, Math.min(N - 1, Math.floor((x - L.bx) / L.c)))];
    }
    api.peker((e) => {
      if (e.type === 'ned') {
        const cl = celleVed(e.x, e.y);
        trykk = cl ? { r: cl[0], c: cl[1], x: e.x, y: e.y, brukt: false } : null;
        if (!cl) valgt = null;
        return;
      }
      if (!trykk || trykk.brukt) { if (e.type === 'opp') trykk = null; return; }
      if (e.type === 'flytt') {
        const dx = e.x - trykk.x, dy = e.y - trykk.y;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < L.c * 0.32) return;
        const [dr, dc] = Math.abs(dx) > Math.abs(dy) ? [0, Math.sign(dx)] : [Math.sign(dy), 0];
        const r2 = trykk.r + dr, c2 = trykk.c + dc;
        trykk.brukt = true;
        if (r2 >= 0 && r2 < N && c2 >= 0 && c2 < N && fase === 'klar') bytt(trykk.r, trykk.c, r2, c2);
        return;
      }
      if (e.type === 'opp') {
        const { r, c } = trykk;
        trykk = null;
        if (fase !== 'klar') return;
        if (valgt && Math.abs(valgt[0] - r) + Math.abs(valgt[1] - c) === 1) { bytt(valgt[0], valgt[1], r, c); return; }
        if (valgt && valgt[0] === r && valgt[1] === c) { valgt = null; return; }
        valgt = [r, c]; lyd.sprett();
      }
    });

    // ---------------------------------------------------------------- tegning
    function tegnKurv(t) {
      const { kx, ky, kw } = L;
      const hopp = kurvHopp > 0 ? Math.sin((kurvHopp / 0.25) * Math.PI) * 0.06 : 0;
      const kh = kw * 0.62;
      ctx.save(); ctx.translate(kx, ky + kh * 0.5); ctx.scale(1 + hopp, 1 - hopp); ctx.translate(-kx, -(ky + kh * 0.5));
      const x0 = kx - kw / 2, y0 = ky - kh * 0.1;
      // hank
      ctx.strokeStyle = '#8a5424'; ctx.lineWidth = Math.max(5, kw * 0.045);
      ctx.beginPath(); ctx.ellipse(kx, y0, kw * 0.38, kh * 0.75, 0, Math.PI, 0); ctx.stroke();
      ctx.strokeStyle = '#c7894a'; ctx.lineWidth = Math.max(2, kw * 0.015); ctx.stroke();
      // bakkant
      ctx.fillStyle = '#7a4520'; ctx.beginPath(); ctx.ellipse(kx, y0, kw * 0.5, kh * 0.13, 0, 0, 7); ctx.fill();
      // innholdet: varer som hoper seg opp etter hvert som kurven fylles
      const k = Math.min(1, samlet / MÅL), plasser = 14, fylt = Math.round(k * plasser);
      const ps = Math.round(kw * 0.2);
      for (let i = 0; i < fylt; i++) {
        const rad = Math.floor(i / 5), kol = i % 5;
        const x = kx + (kol - 2 + (rad % 2) * 0.5) * kw * 0.17, y = y0 + kh * 0.06 - rad * kw * 0.1;
        api.emoji(SLAG[iKurven.length ? iKurven[i % iKurven.length] : i % SLAG.length], x, y, ps, (kol - 2) * 0.12);
      }
      // forkant med fletting
      ctx.fillStyle = '#c47f3c';
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + kw, y0); ctx.lineTo(x0 + kw * 0.88, y0 + kh); ctx.lineTo(x0 + kw * 0.12, y0 + kh); ctx.closePath(); ctx.fill();
      ctx.save(); ctx.clip();
      ctx.fillStyle = 'rgba(90,45,10,.22)';
      for (let y = y0 + kh * 0.16; y < y0 + kh; y += kh * 0.2) ctx.fillRect(x0, y, kw, kh * 0.05);
      for (let x = x0 + kw * 0.06, i = 0; x < x0 + kw; x += kw * 0.1, i++) { ctx.fillStyle = i % 2 ? 'rgba(255,220,160,.18)' : 'rgba(90,45,10,.12)'; ctx.fillRect(x, y0, kw * 0.05, kh); }
      // fyllestripe på forkanten
      const sy = y0 + kh * 0.42, sh = kh * 0.24;
      ctx.fillStyle = 'rgba(70,35,10,.45)'; api.rundRekt(x0 + kw * 0.14, sy, kw * 0.72, sh, sh / 2); ctx.fill();
      if (k > 0) { ctx.fillStyle = k >= 1 ? '#7fd36b' : '#f5c33c'; api.rundRekt(x0 + kw * 0.14, sy, Math.max(sh, kw * 0.72 * k), sh, sh / 2); ctx.fill(); }
      ctx.fillStyle = 'rgba(255,255,255,.35)'; if (k > 0) { api.rundRekt(x0 + kw * 0.16, sy + sh * 0.12, Math.max(sh * 0.6, kw * 0.7 * k - kw * 0.02), sh * 0.28, sh * 0.14); ctx.fill(); }
      ctx.restore();
      ctx.fillStyle = '#9a5a26'; ctx.beginPath(); ctx.ellipse(kx, y0, kw * 0.5, kh * 0.07, 0, 0, Math.PI); ctx.lineTo(x0, y0); ctx.fill();
      if (k >= 1) api.emoji('⭐', kx, y0 - kh * 0.9 + Math.sin(t * 4) * 4, kw * 0.22);
      ctx.restore();
    }
    function tegnUr(t) {                     // lite klokkeur: kaken av gjenstående tid krymper
      const { ux, uy, ur } = L, igjen = Math.max(0, 1 - t / VARIGHET);
      ctx.fillStyle = 'rgba(80,40,10,.25)'; ctx.beginPath(); ctx.arc(ux + 2, uy + 3, ur + 4, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff8e8'; ctx.beginPath(); ctx.arc(ux, uy, ur + 4, 0, 7); ctx.fill();
      ctx.fillStyle = igjen < 0.2 ? '#f08a5d' : '#8fc9e8';
      ctx.beginPath(); ctx.moveTo(ux, uy); ctx.arc(ux, uy, ur, -Math.PI / 2, -Math.PI / 2 + igjen * Math.PI * 2); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#7a4a24'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(ux, uy, ur + 3, 0, 7); ctx.stroke();
    }
    function tegnBrikker(t) {
      const { c, bx, by, bw } = L;
      ctx.save(); ctx.beginPath(); ctx.rect(bx - 4, by, bw + 8, bw); ctx.clip();
      if (valgt) {
        const [r, cc] = valgt, puls = 0.75 + Math.sin(t * 7) * 0.15;
        ctx.fillStyle = `rgba(255,236,150,${puls})`; api.rundRekt(bx + cc * c + 3, by + r * c + 3, c - 6, c - c * 0.12 - 4, c * 0.18); ctx.fill();
      }
      for (const st of stråler) {
        const a = Math.max(0, 1 - st.t / 0.45);
        ctx.fillStyle = `rgba(255,250,210,${a * 0.85})`;
        if (st.h) ctx.fillRect(bx, by + st.i * c + c * (0.5 - 0.5 * a), bw, c * a); else ctx.fillRect(bx + st.i * c + c * (0.5 - 0.5 * a), by, c * a, bw);
      }
      const px = Math.round(c * 0.76);
      for (let r = 0; r < N; r++) for (let cc = 0; cc < N; cc++) {
        const p = brett[r][cc];
        const sp = api.sprite(SLAG[p.s], px);
        let sx = 1, sy = 1, a = 1, løft = 0;
        if (p.land > 0) { const q = Math.sin((p.land / 0.16) * Math.PI) * 0.1; sx = 1 + q; sy = 1 - q; }
        if (p.pop) {
          const q = p.pop / POP;
          const s = q < 0.35 ? 1 + q * 0.7 : 1.25 * Math.max(0, 1 - (q - 0.35) / 0.65);
          sx = sy = s; a = Math.max(0, 1 - Math.max(0, q - 0.5) * 2);
        }
        if (valgt && valgt[0] === r && valgt[1] === cc) løft = Math.abs(Math.sin(t * 6)) * c * 0.06;
        if (fase === 'tilbake' && byttet && ((byttet[0] === r && byttet[1] === cc) || (byttet[2] === r && byttet[3] === cc))) sx *= 1 + Math.sin(faseT * 30) * 0.04;
        const x = bx + (p.x + 0.5) * c, yb = by + (p.y + 1) * c - c * 0.11 - løft;     // står på hylla
        const w = sp._s * sx, h = sp._s * sy;
        if (a < 1) ctx.globalAlpha = a;
        ctx.drawImage(sp, x - w / 2, yb - h * 0.86, w, h);
        if (a < 1) ctx.globalAlpha = 1;
      }
      ctx.restore();
    }

    api.løkke((dt, t) => {
      if (!bg || bgNøkkel !== api.w + 'x' + api.h) { oppsett(); lagBakgrunn(); }
      faseT += dt;
      const ro = flyttBrikker(dt);
      if (fase === 'bytt' && ro && faseT > 0.1) {
        const [r, c, r2, c2] = byttet;
        if (rekkeVed(r, c) || rekkeVed(r2, c2)) { kjede = 0; løs(); }
        else { byttObj(r, c, r2, c2); fase = 'tilbake'; faseT = 0; lyd.hmm(); }
      } else if (fase === 'tilbake' && ro && faseT > 0.15) fase = 'klar';
      else if (fase === 'pop' && faseT >= POP) { fjernOgFall(); fase = 'fall'; faseT = 0; }
      else if ((fase === 'fall' || fase === 'stokk') && ro && faseT > 0.05) løs();
      for (let i = stråler.length - 1; i >= 0; i--) { stråler[i].t += dt; if (stråler[i].t > 0.45) stråler.splice(i, 1); }
      if (kurvHopp > 0) kurvHopp = Math.max(0, kurvHopp - dt);

      ctx.drawImage(bg, 0, 0, api.w, api.h);
      tegnBrikker(t);
      tegnUr(t);
      tegnKurv(t);
      // varer som flyr ned i kurven
      for (let i = flyvere.length - 1; i >= 0; i--) {
        const f = flyvere[i];
        f.t += dt;
        if (f.t < 0) continue;
        const q = Math.min(1, f.t / 0.55), e = q * q * (3 - 2 * q);
        const x = f.x0 + (L.kx - f.x0) * e, y = f.y0 + (L.ky - L.kw * 0.1 - f.y0) * e - Math.sin(q * Math.PI) * 70;
        api.emoji(SLAG[f.s], x, y, Math.round(L.c * 0.5), q * 3, 1 - q * 0.3);
        if (q >= 1) { flyvere.splice(i, 1); kurvHopp = 0.25; iKurven.push(f.s); if (iKurven.length > 30) iKurven.shift(); }
      }

      api.poeng(samlet);
      if (fase === 'mål' && faseT > 1.4) api.ferdig({ stjerner: 3, poeng: samlet });
      if (t >= VARIGHET && (fase === 'klar' || t >= VARIGHET + 4) && fase !== 'mål') {
        api.ferdig({ stjerner: samlet >= MÅL ? 3 : samlet >= MÅL * 0.5 ? 2 : 1, poeng: samlet });
      }
    });

    return {
      hint() {
        if (fase !== 'klar') return null;
        if (!trekkBuf) {
          const alle = finnTrekk();
          trekkBuf = alle.length ? alle[0] : null;
        }
        if (!trekkBuf) return null;
        const [r, c, r2, c2] = trekkBuf;
        return { x: L.bx + (c + 0.5) * L.c, y: L.by + (r + 0.5) * L.c, x2: L.bx + (c2 + 0.5) * L.c, y2: L.by + (r2 + 0.5) * L.c, vent: 150 };
      },
      tilstand() { return { fase, samlet, kjede }; },
    };
  },
};

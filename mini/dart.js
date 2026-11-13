// Pilkast (sjanger: sikt med timing og kast). Siktet går i en åttetallsbane over skiva; trykk hvor som helst for å kaste en sugekoppil.
// Kan ikke tapes: bom fester pila i veggen og gir ett poeng. Ti piler per runde. Ballonger på skiva smeller med konfetti.
export default {
  id: 'dart', navn: 'Pilkast', ikon: '🎯', rom: 'Tenåringsrommet', hjelp: 'trykk', poengIkon: '⭐', bakgrunn: '#34405e', hjelpEtter: 5,
  start(api) {
    const { ctx, lyd } = api;
    const PILER = 10, MAKSTID = 90;
    const RING = [{ r: 1, p: 1, f: '#4f9bd9' }, { r: 0.75, p: 2, f: '#3fb36b' }, { r: 0.5, p: 3, f: '#e8554e' }, { r: 0.24, p: 5, f: '#f5d33c' }];
    const PILFARGE = ['#e8554e', '#4f9bd9', '#3fb36b', '#b06fd8', '#f2a541'];
    let kastet = 0, poeng = 0, rekke = 0, fase = 'spill', sluttT = 0, ferdig = false;
    let φ = 0.6, fly = null, støtT = 9, ballong = null, nesteBallong = 2 + Math.floor(api.rnd() * 2);
    const fast = [];                     // piler som sitter: { rx, ry, farge, t, vegg }
    const spor = [];                     // siktets hale
    let bak = null, bakNøkkel = '', skive = null, skiveNøkkel = '';
    const dpr = () => Math.max(1, Math.min(2, api.canvas.width / api.w));
    const klem = (v) => Math.max(0, Math.min(1, v));

    function oppsett() {
      const t = api.trygg, ligg = api.w > api.h;
      const x0 = t.venstre + 6, x1 = api.w - t.høyre - 6 - (ligg ? 64 : 0), y0 = t.topp + 6, y1 = api.h - t.bunn - (ligg ? 6 : 60);
      const R = Math.floor(Math.min(x1 - x0, y1 - y0) / 2 * 0.9);
      return { R, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, ligg };
    }
    // siktet: en åttetallsbane (Lissajous) i skivemål, R = 1
    function sikt() { return { rx: Math.sin(φ) * 0.92, ry: Math.sin(2 * φ) * 0.55 + Math.sin(φ * 0.37) * 0.08 }; }
    const fart = () => 1.0 + 0.55 * (kastet / PILER);        // litt raskere utover runden

    // ---------------------------------------------------------------- bakgrunn: tenåringsrommet (lages én gang per størrelse)
    function lerret(w, h) { const k = dpr(), c = document.createElement('canvas'); c.width = Math.ceil(w * k); c.height = Math.ceil(h * k); const g = c.getContext('2d'); g.scale(k, k); return { c, g }; }
    function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
    function lagRom(L) {
      const W = api.w, H = api.h, { c, g } = lerret(W, H);
      // vegg med striper
      g.fillStyle = '#34405e'; g.fillRect(0, 0, W, H);
      for (let x = 0; x < W; x += 36) { g.fillStyle = 'rgba(255,255,255,.035)'; g.fillRect(x, 0, 18, H); }
      // plakater
      const plakat = (x, y, w, h, bunn, fjell) => {
        g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x + 4, y + 6, w, h);
        g.fillStyle = '#fdf6e8'; g.fillRect(x, y, w, h);
        g.fillStyle = bunn; g.fillRect(x + 5, y + 5, w - 10, h - 10);
        g.fillStyle = fjell; g.beginPath(); g.moveTo(x + 5, y + h - 5); g.lineTo(x + w * 0.35, y + h * 0.45); g.lineTo(x + w * 0.55, y + h * 0.7); g.lineTo(x + w * 0.75, y + h * 0.35); g.lineTo(x + w - 5, y + h - 5); g.closePath(); g.fill();
        g.fillStyle = '#f5d33c'; g.beginPath(); g.arc(x + w * 0.72, y + h * 0.22, w * 0.09, 0, 7); g.fill();
        g.fillStyle = '#c9c3b0'; g.beginPath(); g.arc(x + w / 2, y + 3, 2.5, 0, 7); g.fill();
      };
      const venstre = L.cx - L.R * 1.12, høyre = W - (L.cx + L.R * 1.12);
      if (venstre > 70) { plakat(Math.max(8, venstre * 0.5 - 40), L.cy - L.R * 0.8, Math.min(80, venstre - 20), Math.min(110, L.R * 0.9), '#f2a5a0', '#b06fd8'); }
      if (høyre > 120) { plakat(W - høyre * 0.5 - 40, L.cy - L.R * 0.9, Math.min(80, høyre - 70), Math.min(100, L.R * 0.8), '#8fcfbe', '#3d7fd9'); }
      // gulv og fotlist nederst, aldri bak skiva
      const gulv = Math.max(H - Math.max(36, H * 0.07), L.cy + L.R * 1.16);
      g.fillStyle = '#f2ecdf'; g.fillRect(0, gulv - 10, W, 10);
      g.fillStyle = '#a7754a'; g.fillRect(0, gulv, W, H - gulv);
      for (let x = 0; x < W; x += 70) { g.fillStyle = 'rgba(60,30,10,.25)'; g.fillRect(x, gulv, 2, H - gulv); }
      // hylle med ting i hjørnet når det er plass
      const under = gulv - (L.cy + L.R * 1.12);
      if (høyre > 120 || (venstre <= 70 && under > 80)) {               // hylle ved siden av eller under skiva
        const hx = høyre > 120 ? W - høyre * 0.5 - 50 : W - 124, hy = høyre > 120 ? L.cy + L.R * 0.5 : L.cy + L.R * 1.12 + under * 0.62;
        g.fillStyle = '#8a5a35'; g.fillRect(hx, hy, 100, 9);
        ['🎧', '🏀', '🎮'].forEach((e, i) => { const s = api.sprite(e, 30); g.drawImage(s, hx + 6 + i * 32, hy - s._s * 0.8, s._s, s._s); });
      }
      // skygge bak skiva
      g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.arc(L.cx + 6, L.cy + 10, L.R * 1.1, 0, 7); g.fill();
      return c;
    }
    function lagSkive(R) {
      const S = R * 2.3, { c, g } = lerret(S, S), m = S / 2;
      // korkramme
      g.fillStyle = '#6b4a2b'; g.beginPath(); g.arc(m, m, R * 1.1, 0, 7); g.fill();
      g.fillStyle = '#c99a62'; g.beginPath(); g.arc(m, m, R * 1.06, 0, 7); g.fill();
      for (let i = 0; i < 260; i++) { const a = i * 2.39996, d = R * (1.0 + 0.05 * ((i * 37) % 10) / 10); g.fillStyle = i % 2 ? 'rgba(120,80,40,.35)' : 'rgba(255,230,190,.3)'; g.fillRect(m + Math.cos(a) * d, m + Math.sin(a) * d, 1.6, 1.6); }
      RING.forEach((ri, i) => {
        g.fillStyle = '#fdf6e8'; g.beginPath(); g.arc(m, m, R * ri.r, 0, 7); g.fill();
        g.fillStyle = ri.f; g.beginPath(); g.arc(m, m, R * ri.r - Math.max(2, R * 0.015), 0, 7); g.fill();
        // lysere halvdel øverst gir litt volum
        g.fillStyle = 'rgba(255,255,255,.1)'; g.beginPath(); g.arc(m, m, R * ri.r - 3, Math.PI, Math.PI * 2); g.fill();
      });
      // stjerner viser hvor mye ringen er verdt: flere innover
      const stjerne = (x, y, r, f) => { g.fillStyle = f; g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr_ = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr_, y + Math.sin(a) * rr_); } g.closePath(); g.fill(); };
      RING.slice(0, 3).forEach((ri, i) => {
        const mid = (ri.r + RING[i + 1].r) / 2 * R, n = i + 1, sr = Math.max(4, R * 0.045);
        for (const side of [0, Math.PI, -Math.PI / 2]) for (let k = 0; k < n; k++) {
          const a = side + (k - (n - 1) / 2) * (sr * 2.6 / mid);
          stjerne(m + Math.cos(a) * mid, m + Math.sin(a) * mid, sr, 'rgba(255,255,255,.88)');
        }
      });
      stjerne(m, m, R * 0.13, '#fff8d6');
      stjerne(m, m, R * 0.08, '#f2a541');
      return c;
    }

    // ---------------------------------------------------------------- pila
    function tegnPil(x, y, ang, sk, farge, kort) {
      // (x, y) = sugekoppen. ang = retningen pila peker. kort = sett forfra (sitter i skiva)
      const len = (kort ? 30 : 64) * sk, dx = Math.cos(ang), dy = Math.sin(ang);
      const hx = x - dx * len, hy = y - dy * len;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#efe9dc'; ctx.lineWidth = 6 * sk; ctx.beginPath(); ctx.moveTo(x - dx * 6 * sk, y - dy * 6 * sk); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,.15)'; ctx.lineWidth = 2 * sk; ctx.beginPath(); ctx.moveTo(x - dx * 6 * sk - dy * 1.5 * sk, y - dy * 6 * sk + dx * 1.5 * sk); ctx.lineTo(hx - dy * 1.5 * sk, hy + dx * 1.5 * sk); ctx.stroke();
      // fjærer bak
      const px = -dy, py = dx, fl = 13 * sk, fb = 16 * sk;
      ctx.fillStyle = farge;
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(hx + dx * fb, hy + dy * fb); ctx.lineTo(hx + px * fl * s - dx * 2 * sk, hy + py * fl * s - dy * 2 * sk); ctx.lineTo(hx, hy); ctx.closePath(); ctx.fill(); }
      // sugekopp
      ctx.fillStyle = '#e8554e'; ctx.beginPath(); ctx.ellipse(x - dx * 3 * sk, y - dy * 3 * sk, 5 * sk, 9 * sk, ang, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.ellipse(x - dx * 4 * sk - px * 2 * sk, y - dy * 4 * sk - py * 2 * sk, 1.6 * sk, 3.5 * sk, ang, 0, 7); ctx.fill();
    }

    // ---------------------------------------------------------------- kast
    api.peker((e) => {
      if (e.type !== 'ned' || fase !== 'spill' || fly || kastet >= PILER) return;
      const s = sikt();
      const a = api.rnd() * Math.PI * 2, sp = api.rnd() * 0.05;
      fly = { rx: s.rx + Math.cos(a) * sp, ry: s.ry + Math.sin(a) * sp, t: 0, farge: PILFARGE[kastet % PILFARGE.length] };
      kastet++;
      lyd.sus();
    });
    function lander(f) {
      const L = oppsett(), d = Math.hypot(f.rx, f.ry);
      const x = L.cx + f.rx * L.R, y = L.cy + f.ry * L.R;
      let p = 1, vegg = d > 1;
      if (!vegg) for (const ri of RING) if (d <= ri.r) p = ri.p;
      fast.push({ rx: f.rx, ry: f.ry, farge: f.farge, t: 0, vegg });
      lyd.dunk();
      if (vegg) {
        rekke = 0;
        api.sprut(x, y, '#c9c3b0', 6);
      } else {
        støtT = 0;
        if (p === 5) {
          rekke++;
          lyd.tone(7 + Math.min(rekke - 1, 4) * 3); setTimeout(() => lyd.tone(12 + Math.min(rekke - 1, 4) * 3), 90);
          api.sprut(x, y, '✨', 8); api.sprut(x, y, '#f5d33c', 12); api.sprut(x, y, '⭐', 3);
        } else {
          rekke = 0;
          lyd.tone([0, 0, 2, 4][p]);
          api.sprut(x, y, RING.find((r) => r.p === p).f, 4 + p * 2);
          if (p >= 2) api.sprut(x, y, '⭐', p - 1);
        }
      }
      // ballong
      if (ballong && !ballong.smelt) {
        const b = ballongPos(ballong);
        if (Math.hypot(f.rx - b.rx, f.ry - b.ry) < 0.22) {
          ballong.smelt = 0.001; p += 3;
          const bx = L.cx + b.rx * L.R, by = L.cy + b.ry * L.R;
          lyd.pop(); setTimeout(() => lyd.fanfare(), 120);
          for (const c of ['#e8554e', '#4f9bd9', '#3fb36b', '#f5d33c', '#b06fd8']) api.sprut(bx, by, c, 7);
          api.sprut(bx, by, '🎉', 3);
        }
      }
      poeng += p;
      api.poeng(poeng);
      if (!ballong && kastet < PILER - 1 && --nesteBallong <= 0) {
        const a = api.rnd() * Math.PI * 2, d2 = 0.25 + api.rnd() * 0.45;
        ballong = { rx: Math.cos(a) * d2, ry: Math.sin(a) * d2, t: 0, liv: 9, farge: ['🎈'][0] };
        nesteBallong = 2 + Math.floor(api.rnd() * 2);
        setTimeout(() => lyd.plopp(), 200);
      }
    }
    function ballongPos(b) { return { rx: b.rx + Math.sin(b.t * 1.3) * 0.05, ry: b.ry + Math.sin(b.t * 2.1) * 0.04 - (b.t > b.liv ? (b.t - b.liv) * 0.8 : 0) }; }

    api.løkke((dt, t) => {
      const L = oppsett();
      const nøkkel = api.w + 'x' + api.h;
      if (!bak || bakNøkkel !== nøkkel) { bak = lagRom(L); bakNøkkel = nøkkel; }
      if (!skive || skiveNøkkel !== L.R + '@' + dpr()) { skive = lagSkive(L.R); skiveNøkkel = L.R + '@' + dpr(); }
      ctx.drawImage(bak, 0, 0, api.w, api.h);

      // lysslynge langs taket som blinker rolig
      const n = Math.max(6, Math.floor(api.w / 46));
      ctx.strokeStyle = 'rgba(30,30,30,.5)'; ctx.lineWidth = 1.5; ctx.beginPath();
      for (let i = 0; i <= n; i++) { const x = (i + 0.5) * api.w / n, y = api.trygg.topp - 6 + Math.sin(i * 1.7) * 3 + ((i % 2) ? 7 : 0); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
      for (let i = 0; i < n; i++) {
        const x = (i + 0.5) * api.w / n, y = api.trygg.topp - 6 + Math.sin(i * 1.7) * 3 + ((i % 2) ? 7 : 0) + 6, a = 0.55 + 0.45 * Math.sin(t * 2 + i * 1.3);
        const f = ['#f5d33c', '#e8554e', '#4f9bd9', '#3fb36b', '#f3a7c0'][i % 5];
        ctx.globalAlpha = a * 0.3; ctx.fillStyle = f; ctx.beginPath(); ctx.arc(x, y, 10, 0, 7); ctx.fill();
        ctx.globalAlpha = 0.6 + a * 0.4; ctx.beginPath(); ctx.arc(x, y, 4.5, 0, 7); ctx.fill();
        ctx.globalAlpha = 1;
      }

      // skiva, med et lite sprett når en pil treffer
      støtT += dt;
      const sprett = Math.exp(-støtT * 7) * Math.cos(støtT * 32);
      const sk = 1 + 0.03 * sprett, oy = -4 * sprett;
      ctx.save(); ctx.translate(L.cx, L.cy + oy); ctx.scale(sk, sk);
      ctx.drawImage(skive, -skive.width / dpr() / 2, -skive.height / dpr() / 2, skive.width / dpr(), skive.height / dpr());
      ctx.restore();
      const tilSkjerm = (rx, ry, påSkiva) => ({ x: L.cx + rx * L.R * (påSkiva ? sk : 1), y: L.cy + ry * L.R * (påSkiva ? sk : 1) + (påSkiva ? oy : 0) });

      // ballongen
      if (ballong) {
        const b = ballong; b.t += dt;
        const bp = ballongPos(b), p = tilSkjerm(bp.rx, bp.ry, true);
        if (b.smelt) b.smelt += dt;
        if (!b.smelt) {
          const inn = klem(b.t / 0.35), st = L.R * 0.42 * (inn < 1 ? Math.sin(inn * Math.PI * 0.7) / Math.sin(Math.PI * 0.7) : 1);
          const alfa = b.t > b.liv ? klem(1 - (b.t - b.liv) / 1.2) : 1;
          ctx.globalAlpha = alfa;
          ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(p.x, p.y + st * 0.42);
          ctx.quadraticCurveTo(p.x + Math.sin(t * 3) * 8, p.y + st * 0.8, p.x, p.y + st * 1.1); ctx.stroke();
          ctx.globalAlpha = 1;
          api.emoji('🎈', p.x, p.y, st, Math.sin(b.t * 2) * 0.12, alfa);
          if (b.t > b.liv + 1.2) ballong = null;
        } else if (b.smelt > 0.05) ballong = null;
      }

      // pilene som sitter
      for (const f of fast) {
        f.t += dt;
        const p = tilSkjerm(f.rx, f.ry, !f.vegg);
        const vrikk = Math.exp(-f.t * 6) * Math.sin(f.t * 40) * 0.35;
        ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(p.x + 6, p.y + 14, 6, 3, 0.6, 0, 7); ctx.fill();
        tegnPil(p.x, p.y, -Math.PI / 2 - 0.35 + vrikk, Math.max(0.75, L.R / 190), f.farge, true);
      }

      // siktet
      if (fase === 'spill') φ += dt * fart();
      const s = sikt(), sp = tilSkjerm(s.rx, s.ry, false);
      spor.push({ x: sp.x, y: sp.y }); if (spor.length > 10) spor.shift();
      if (fase === 'spill' && kastet < PILER) {
        for (let i = 0; i < spor.length - 1; i++) { ctx.globalAlpha = i / spor.length * 0.35; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(spor[i].x, spor[i].y, 3 + i * 0.4, 0, 7); ctx.fill(); }
        ctx.globalAlpha = 1;
        const r = Math.max(20, L.R * 0.13) * (1 + Math.sin(t * 8) * 0.06), nær = Math.hypot(s.rx, s.ry) < 0.24;
        ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(20,20,40,.45)'; ctx.beginPath(); ctx.arc(sp.x, sp.y, r, 0, 7); ctx.stroke();
        ctx.lineWidth = 3.5; ctx.strokeStyle = nær ? '#fff6a8' : '#ffffff'; ctx.beginPath(); ctx.arc(sp.x, sp.y, r, 0, 7); ctx.stroke();
        ctx.beginPath();
        for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.moveTo(sp.x + a * r * 0.45, sp.y + b * r * 0.45); ctx.lineTo(sp.x + a * r * 1.3, sp.y + b * r * 1.3); }
        ctx.stroke();
        ctx.fillStyle = nær ? '#fff6a8' : '#ffffff'; ctx.beginPath(); ctx.arc(sp.x, sp.y, 3.5, 0, 7); ctx.fill();
      }

      // pila i lufta: fra nederst på skjermen og inn i skiva
      if (fly) {
        fly.t += dt;
        const k = klem(fly.t / 0.34), e = 1 - (1 - k) * (1 - k);
        const mål = tilSkjerm(fly.rx, fly.ry, true), sx = api.w / 2 + (mål.x - api.w / 2) * 0.15, sy = api.h + 30;
        const x = sx + (mål.x - sx) * e, y = sy + (mål.y - sy) * e - Math.sin(k * Math.PI) * api.h * 0.08;
        const k2 = Math.min(1, k + 0.05), e2 = 1 - (1 - k2) * (1 - k2);
        const x2 = sx + (mål.x - sx) * e2, y2 = sy + (mål.y - sy) * e2 - Math.sin(k2 * Math.PI) * api.h * 0.08;
        tegnPil(x, y, Math.atan2(y2 - y, x2 - x), 1.9 - 0.9 * e, fly.farge, false);
        if (k >= 1) { const f = fly; fly = null; lander(f); }
      }

      // pilene som er igjen
      const igjen = PILER - kastet;
      for (let i = 0; i < igjen; i++) {
        const først = i === 0 && !fly;
        let x, y;
        if (L.ligg) { x = api.w - api.trygg.høyre - 44 + (i % 2) * 26; y = api.trygg.topp + 8 + Math.floor(i / 2) * Math.min(48, (api.h - api.trygg.topp - api.trygg.bunn - 40) / 5); }
        else { x = api.w / 2 + (i - (igjen - 1) / 2) * Math.min(30, (api.w - 40) / PILER); y = api.h - api.trygg.bunn - 40; }
        const hopp = først ? Math.abs(Math.sin(t * 4)) * 4 : 0;
        tegnPil(x, y - hopp, -Math.PI / 2, først ? 0.62 : 0.5, PILFARGE[(kastet + i) % PILFARGE.length], false);
      }

      if (fase === 'spill') {
        api.framgang(kastet / PILER);
        if ((kastet >= PILER && !fly) || t >= MAKSTID) { fase = 'slutt'; sluttT = 0; }
      } else {
        sluttT += dt;
        if (sluttT > 1.4 && !ferdig) { ferdig = true; api.ferdig({ stjerner: poeng >= 28 ? 3 : poeng >= 16 ? 2 : 1, poeng }); }
      }
    });

    return {
      // trykk når siktet er nær midten
      hint() {
        if (fase !== 'spill' || fly || kastet >= PILER) return null;
        const s = sikt();
        if (Math.hypot(s.rx, s.ry) > 0.12) return null;
        const L = oppsett();
        return { x: L.cx + s.rx * L.R, y: L.cy + s.ry * L.R, vent: 450 };
      },
      tilstand() { return { kastet, poeng, ballong: !!ballong }; },
    };
  },
};

// Minigolf (sjanger: sikt og skyt sett ovenfra). Dra bakover fra ballen og slipp; lengre drag gir hardere slag.
// Kan ikke tapes: etter seks slag triller ballen selv i hullet. Fem korte hull; runden slutter når det femte er spilt.
export default {
  id: 'minigolf', navn: 'Minigolf', ikon: '⛳', rom: 'Annekset', hjelp: 'dra', poengIkon: '⭐', bakgrunn: '#34425a', hjelpEtter: 5,
  start(api) {
    const { ctx, lyd } = api;
    // banene i verdensmål: 10 bred, 16 lang, utslag nederst. blokk = [x0, y0, x1, y1], sand = [x, y, r]
    const HULL = [
      { poly: [[2, 1], [8, 1], [8, 15], [2, 15]], tee: [5, 13.4], kopp: [5, 3.2], par: 2, sand: [], blokk: [] },
      { poly: [[1, 1], [9, 1], [9, 15], [1, 15]], tee: [2.8, 13.4], kopp: [7.2, 3], par: 2, sand: [[5, 8.2, 1.7], [7.6, 11.6, 1]], blokk: [[1, 5.6, 3.4, 6.2]] },
      { poly: [[2, 1], [8, 1], [8, 15], [2, 15]], tee: [5, 13.4], kopp: [5, 3], par: 3, sand: [], blokk: [[2, 7.7, 4.05, 8.3], [5.95, 7.7, 8, 8.3]], mølle: [5, 8, 1.75] },
      { poly: [[1, 1], [9, 1], [9, 5.6], [4.6, 5.6], [4.6, 15], [1, 15]], tee: [2.8, 13.4], kopp: [7.4, 3.2], par: 3, sand: [[2.2, 2.4, 0.9]], blokk: [] },
      { poly: [[1, 1], [6.8, 1], [9, 3.2], [9, 15], [1, 15]], tee: [2.8, 13.4], kopp: [2.6, 3.2], par: 3, sand: [[7.7, 11.2, 0.85]], blokk: [[1, 7.7, 6.5, 8.3]] },
    ];
    const BR = 0.28, KR = 0.5, MAKS = 14, K = 3.6, MAKSSLAG = 6;
    let hi = 0, hull = null, vegger = [], ball = null, slag = 0, poeng = 0, totalSlag = 0, fase = 'drop', faseT = 0, hullStj = 0;
    let drag = null, mølleV = 0, sisteRo = null, hintMinne = null, ferdig = false, sistDunk = 0;
    let bg = null, bgKey = '', ballSpr = null, ballKey = 0;

    function lagVegger(h) {
      const v = [];
      for (let i = 0; i < h.poly.length; i++) { const a = h.poly[i], b = h.poly[(i + 1) % h.poly.length]; v.push([a[0], a[1], b[0], b[1]]); }
      for (const [x0, y0, x1, y1] of h.blokk) v.push([x0, y0, x1, y0], [x1, y0, x1, y1], [x1, y1, x0, y1], [x0, y1, x0, y0]);
      return v;
    }
    function nyttHull(i) {
      hi = i; hull = HULL[i]; vegger = lagVegger(hull); slag = 0; hintMinne = null;
      ball = { x: hull.tee[0], y: hull.tee[1], vx: 0, vy: 0, inne: false, auto: false, sk: 0 };
      sisteRo = { x: ball.x, y: ball.y };
      fase = 'drop'; faseT = 0; bgKey = '';
      api.framgang(i / HULL.length);
    }
    nyttHull(0);

    // ---------------------------------------------------------------- fysikk, felles for spill og hint
    function iSand(x, y) { for (const [sx_, sy_, r] of hull.sand) if ((x - sx_) ** 2 + (y - sy_) ** 2 < r * r) return true; return false; }
    function blader(t) {                                                   // vindmøllas fire blader som linjestykker
      if (!hull.mølle) return [];
      const [mx, my, l] = hull.mølle, a0 = t * 1.5, ut = [];
      for (let i = 0; i < 4; i++) { const a = a0 + i * Math.PI / 2; ut.push([mx, my, mx + Math.cos(a) * l, my + Math.sin(a) * l]); }
      return ut;
    }
    function kollider(b, s, tykk, mx, my, ω) {                              // ball mot ett linjestykke; mx, my, ω for bladene som går rundt
      const [x0, y0, x1, y1] = s, dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy;
      let k = ((b.x - x0) * dx + (b.y - y0) * dy) / l2; k = Math.max(0, Math.min(1, k));
      const px = x0 + dx * k, py = y0 + dy * k, ex = b.x - px, ey = b.y - py, d = Math.hypot(ex, ey), r = BR + tykk;
      if (d >= r || d === 0) return 0;
      const nx = ex / d, ny = ey / d;
      b.x = px + nx * r; b.y = py + ny * r;
      let wx = 0, wy = 0;
      if (ω) { wx = -ω * (py - my); wy = ω * (px - mx); }                    // fart til bladet der ballen treffer
      const vn = (b.vx - wx) * nx + (b.vy - wy) * ny;
      if (vn < 0) { b.vx -= 1.75 * vn * nx; b.vy -= 1.75 * vn * ny; return -vn; }
      return 0;
    }
    function steg(b, dt, t, still) {                                       // ett tidssteg; gir tilbake treffstyrke mot vegg
      let treff = 0;
      const v0 = Math.hypot(b.vx, b.vy);
      const n = Math.max(1, Math.ceil(v0 * dt / 0.08));
      const h = dt / n;
      const kx = hull.kopp[0], ky = hull.kopp[1];
      for (let i = 0; i < n; i++) {
        const v = Math.hypot(b.vx, b.vy);
        if (v > 0) {
          const brems = (iSand(b.x, b.y) ? 9 : 1.5) + 0.32 * v;
          const nv = Math.max(0, v - brems * h);
          b.vx *= nv / v; b.vy *= nv / v;
        }
        // tilgivende hull: nær og ikke for fort trekkes ballen inn
        const dkx = kx - b.x, dky = ky - b.y, dk = Math.hypot(dkx, dky);
        if (dk < 0.85 && v < 3) { b.vx += dkx / dk * 7 * h; b.vy += dky / dk * 7 * h; }
        b.x += b.vx * h; b.y += b.vy * h;
        if (dk < KR && Math.hypot(b.vx, b.vy) < 6.5) { b.inne = true; return treff; }
        for (const s of vegger) treff = Math.max(treff, kollider(b, s, 0, 0, 0, 0));
        if (hull.mølle) for (const s of blader(t + i * h)) treff = Math.max(treff, kollider(b, s, 0.12, hull.mølle[0], hull.mølle[1], 1.5));
      }
      return treff;
    }
    function simuler(vx, vy, t0) {                                         // spill et slag til ballen ligger stille
      const b = { x: ball.x, y: ball.y, vx, vy, inne: false };
      const dt = 1 / 30;
      for (let i = 0; i < 240; i++) {
        steg(b, dt, t0 + i * dt);
        if (b.inne) return { inne: true, x: b.x, y: b.y, tid: i * dt };
        if (Math.hypot(b.vx, b.vy) < 0.05) break;
      }
      return { inne: false, x: b.x, y: b.y, tid: 8 };
    }
    function innenfor(x, y) {                                              // punkt-i-mangekant, mot at ballen havner utenfor
      let inn = false;
      const p = hull.poly;
      for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
        if ((p[i][1] > y) !== (p[j][1] > y) && x < (p[j][0] - p[i][0]) * (y - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) inn = !inn;
      }
      for (const [x0, y0, x1, y1] of hull.blokk) if (x > x0 && x < x1 && y > y0 && y < y1) return false;
      return inn;
    }

    // ---------------------------------------------------------------- skjerm: liggende telefon viser banen på tvers
    function geo() {
      const t = api.trygg, liggende = api.w > api.h;
      const x0 = t.venstre + 4, x1 = api.w - t.høyre - 4, y0 = t.topp - 4, y1 = api.h - t.bunn + 6;
      const BX = 11.2, BY = 17.4;                                          // verden -0.6..10.6 og -0.6..16.8
      const s = liggende ? Math.min((x1 - x0) / BY, (y1 - y0) / BX) : Math.min((x1 - x0) / BX, (y1 - y0) / BY);
      const ox = liggende ? (x0 + x1) / 2 - (BY / 2) * s : (x0 + x1) / 2 - (BX / 2) * s;
      const oy = liggende ? (y0 + y1) / 2 - (BX / 2) * s : (y0 + y1) / 2 - (BY / 2) * s;
      return { s, ox, oy, liggende };
    }
    function tilS(g, x, y) { return g.liggende ? [g.ox + (16.8 - y) * g.s, g.oy + (x + 0.6) * g.s] : [g.ox + (x + 0.6) * g.s, g.oy + (y + 0.6) * g.s]; }
    function tilV(g, X, Y) { return g.liggende ? [(Y - g.oy) / g.s - 0.6, 16.8 - (X - g.ox) / g.s] : [(X - g.ox) / g.s - 0.6, (Y - g.oy) / g.s - 0.6]; }

    // ---------------------------------------------------------------- slaget
    function slå(vx, vy) {
      ball.vx = vx; ball.vy = vy; slag++; totalSlag++; fase = 'rull'; hintMinne = null;
      lyd.dunk(); ball.sk = 1;
    }
    api.peker((e) => {
      const g = geo();
      const [wx, wy] = tilV(g, e.x, e.y);
      if (e.type === 'ned') { if (fase === 'klar') drag = { x: wx, y: wy, cx: wx, cy: wy }; }
      else if (e.type === 'flytt' && drag) { drag.cx = wx; drag.cy = wy; }
      else if (e.type === 'opp' && drag) {
        drag.cx = wx; drag.cy = wy;
        const dx = drag.x - drag.cx, dy = drag.y - drag.cy, l = Math.hypot(dx, dy);
        drag = null;
        if (l > 0.35 && fase === 'klar') { const v = Math.min(MAKS, l * K); slå(dx / l * v, dy / l * v); }
      }
    });

    // ---------------------------------------------------------------- tegning
    function bane(g, pts) { ctx.beginPath(); pts.forEach((p, i) => { const [X, Y] = tilS(g, p[0], p[1]); if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }); ctx.closePath(); }
    function lagBg(g) {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const c = document.createElement('canvas'); c.width = Math.round(api.w * dpr); c.height = Math.round(api.h * dpr);
      const x = c.getContext('2d'); x.scale(dpr, dpr);
      const gml = ctx;                                                      // tegn bakgrunnen med de samme hjelperne
      const W = api.w, H = api.h, s = g.s;
      // gulvet i annekset: mørkt teppe med striper
      x.fillStyle = '#34425a'; x.fillRect(0, 0, W, H);
      x.fillStyle = '#3a4a64'; for (let i = -H; i < W; i += 26) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 12, 0); x.lineTo(i + 12 + H, H); x.lineTo(i + H, H); x.fill(); }
      // liggende: golfsimulatoren i annekset på den ene siden, en golfer på den andre
      const [venstreKant] = tilS(g, 0, 16.8), [høyreKant] = tilS(g, 0, -0.6);
      const friV = Math.min(venstreKant, høyreKant) - api.trygg.venstre, friH = W - Math.max(venstreKant, høyreKant) - api.trygg.høyre;
      if (g.liggende && friH > 150) {
        const sw = Math.min(friH - 40, 230), sh = sw * 0.62, sx0 = W - api.trygg.høyre - friH / 2 - sw / 2, sy0 = (api.trygg.topp + H) / 2 - sh / 2 - 10;
        x.fillStyle = '#1b2230'; x.fillRect(sx0 - 8, sy0 - 8, sw + 16, sh + 16);
        const gr = x.createLinearGradient(0, sy0, 0, sy0 + sh); gr.addColorStop(0, '#7cc4f0'); gr.addColorStop(0.55, '#cdeefc'); gr.addColorStop(0.56, '#5fb35a'); gr.addColorStop(1, '#3f8f3e');
        x.fillStyle = gr; x.fillRect(sx0, sy0, sw, sh);
        x.save(); x.beginPath(); x.rect(sx0, sy0, sw, sh); x.clip();
        x.fillStyle = '#4fa24c'; x.beginPath(); x.ellipse(sx0 + sw * 0.7, sy0 + sh * 0.58, sw * 0.4, sh * 0.1, 0, 0, 7); x.fill();
        x.restore();
        x.strokeStyle = '#ffffff'; x.lineWidth = 2; x.setLineDash([3, 5]); x.beginPath(); x.moveTo(sx0 + sw * 0.15, sy0 + sh * 0.95); x.quadraticCurveTo(sx0 + sw * 0.45, sy0 + sh * 0.05, sx0 + sw * 0.72, sy0 + sh * 0.5); x.stroke(); x.setLineDash([]);
        x.fillStyle = '#f2f2f2'; x.fillRect(sx0 + sw * 0.72, sy0 + sh * 0.36, 2, sh * 0.2);
        x.fillStyle = '#e8414e'; x.beginPath(); x.moveTo(sx0 + sw * 0.72 + 2, sy0 + sh * 0.36); x.lineTo(sx0 + sw * 0.8, sy0 + sh * 0.4); x.lineTo(sx0 + sw * 0.72 + 2, sy0 + sh * 0.44); x.fill();
        x.fillStyle = '#2a3446'; x.fillRect(sx0 + sw * 0.2, sy0 + sh + 8, sw * 0.6, 14);
        x.fillStyle = '#4c9a50'; x.fillRect(sx0 + sw * 0.25, sy0 + sh + 30, sw * 0.5, 40);
        x.fillStyle = '#ffffff'; x.beginPath(); x.arc(sx0 + sw * 0.5, sy0 + sh + 50, 4, 0, 7); x.fill();
      }
      if (g.liggende && friV > 130) {
        const sp = api.sprite('🏌️', Math.min(110, friV * 0.6));
        x.drawImage(sp, api.trygg.venstre + friV / 2 - sp._s / 2, (api.trygg.topp + H) / 2 - sp._s / 2, sp._s, sp._s);
      }
      const sti = (pts) => { x.beginPath(); pts.forEach((p, i) => { const [X, Y] = tilS(g, p[0], p[1]); if (i) x.lineTo(X, Y); else x.moveTo(X, Y); }); x.closePath(); };
      // skygge og trekant rundt banen
      x.save(); x.translate(4, 6); sti(hull.poly); x.lineWidth = s * 0.9; x.lineJoin = 'round'; x.strokeStyle = 'rgba(0,0,0,.28)'; x.stroke(); x.fillStyle = 'rgba(0,0,0,.28)'; x.fill(); x.restore();
      // filt med klippestriper
      sti(hull.poly); x.fillStyle = '#3f9e4d'; x.fill();
      x.save(); sti(hull.poly); x.clip();
      x.fillStyle = '#48aa56';
      for (let yy = -1; yy < 17; yy += 2) { const a = tilS(g, -1, yy), b = tilS(g, 11, yy + 1); x.fillRect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])); }
      // sand
      for (const [sx_, sy_, r] of hull.sand) {
        const [X, Y] = tilS(g, sx_, sy_);
        x.fillStyle = '#d9bf7a'; x.beginPath(); x.arc(X, Y, r * s + 3, 0, 7); x.fill();
        x.fillStyle = '#ecd79c'; x.beginPath(); x.arc(X, Y, r * s, 0, 7); x.fill();
        x.fillStyle = 'rgba(180,140,70,.35)';
        for (let i = 0; i < 26; i++) { const a = i * 2.4, rr = r * s * Math.sqrt((i * 0.37) % 1) * 0.92; x.beginPath(); x.arc(X + Math.cos(a) * rr, Y + Math.sin(a) * rr, 1.6, 0, 7); x.fill(); }
      }
      // utslagsmatte
      const [tX, tY] = tilS(g, hull.tee[0], hull.tee[1]);
      x.fillStyle = '#2f7f3d'; x.beginPath(); x.arc(tX, tY, s * 0.75, 0, 7); x.fill();
      x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 2; x.setLineDash([4, 5]); x.beginPath(); x.arc(tX, tY, s * 0.75, 0, 7); x.stroke(); x.setLineDash([]);
      // hullet
      const [kX, kY] = tilS(g, hull.kopp[0], hull.kopp[1]);
      x.fillStyle = '#2f7f3d'; x.beginPath(); x.arc(kX, kY, KR * s * 1.9, 0, 7); x.fill();
      x.fillStyle = '#ffffff'; x.beginPath(); x.arc(kX, kY, KR * s + 2.5, 0, 7); x.fill();
      x.fillStyle = '#15241a'; x.beginPath(); x.arc(kX, kY, KR * s, 0, 7); x.fill();
      x.fillStyle = '#0a130d'; x.beginPath(); x.arc(kX + 1.5, kY + 2, KR * s * 0.8, 0, 7); x.fill();
      x.restore();
      // trekanter: kantlister i eik
      sti(hull.poly); x.lineJoin = 'round'; x.lineWidth = s * 0.56; x.strokeStyle = '#9c6a3a'; x.stroke();
      x.lineWidth = s * 0.2; x.strokeStyle = '#c8955c'; x.stroke();
      for (const [x0, y0, x1, y1] of hull.blokk) {
        const a = tilS(g, x0, y0), b = tilS(g, x1, y1);
        const rx = Math.min(a[0], b[0]), ry = Math.min(a[1], b[1]), rw = Math.abs(b[0] - a[0]), rh = Math.abs(b[1] - a[1]);
        x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(rx + 3, ry + 4, rw, rh);
        x.fillStyle = '#9c6a3a'; x.fillRect(rx, ry, rw, rh);
        x.fillStyle = '#c8955c'; x.fillRect(rx + 2, ry + 2, rw - 4, Math.max(2, rh * 0.35));
      }
      if (hull.mølle) {                                                     // vindmøllas hus (bladene tegnes hver ramme)
        const [mX, mY] = tilS(g, hull.mølle[0], hull.mølle[1]);
        x.fillStyle = 'rgba(0,0,0,.25)'; x.beginPath(); x.arc(mX + 3, mY + 4, s * 0.62, 0, 7); x.fill();
      }
      void gml;
      return c;
    }
    function lagBall(r) {
      const dpr = Math.min(2, window.devicePixelRatio || 1), side = Math.ceil(r * 2 + 4);
      const c = document.createElement('canvas'); c.width = c.height = Math.ceil(side * dpr);
      const x = c.getContext('2d'); x.scale(dpr, dpr);
      const m = side / 2, gr = x.createRadialGradient(m - r * 0.35, m - r * 0.4, r * 0.1, m, m, r);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.7, '#f1f1ee'); gr.addColorStop(1, '#c9cbc6');
      x.fillStyle = gr; x.beginPath(); x.arc(m, m, r, 0, 7); x.fill();
      x.fillStyle = 'rgba(0,0,0,.08)';
      for (let i = 0; i < 7; i++) { const a = i * 0.9; x.beginPath(); x.arc(m + Math.cos(a) * r * 0.5, m + Math.sin(a) * r * 0.5, r * 0.12, 0, 7); x.fill(); }
      c._s = side;
      return c;
    }
    function tegnFlagg(g, t, løft) {
      const [kX, kY] = tilS(g, hull.kopp[0], hull.kopp[1]);
      const s = g.s, l = s * 1.9, topp = kY - l - løft;
      ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(kX, kY); ctx.lineTo(kX + l * 0.5, kY + l * 0.25 - løft * 0.3); ctx.stroke();
      ctx.strokeStyle = '#f2f2f2'; ctx.lineWidth = Math.max(2.5, s * 0.1); ctx.beginPath(); ctx.moveTo(kX, kY - løft); ctx.lineTo(kX, topp); ctx.stroke();
      const v = Math.sin(t * 5) * s * 0.12;
      ctx.fillStyle = '#e8414e'; ctx.beginPath(); ctx.moveTo(kX, topp); ctx.quadraticCurveTo(kX + s * 0.6, topp + s * 0.2 + v, kX + s * 1.15, topp + s * 0.35 + v); ctx.lineTo(kX, topp + s * 0.75); ctx.closePath(); ctx.fill();
    }

    api.løkke((dt, t) => {
      const g = geo(), s = g.s;
      const key = hi + '|' + api.w + 'x' + api.h;
      if (key !== bgKey) { bg = lagBg(g); bgKey = key; }
      if (Math.abs(ballKey - s) > 0.01) { ballSpr = lagBall(BR * s); ballKey = s; }
      mølleV = t * 1.5;
      faseT += dt;

      // ---- tilstander: drop (ballen kommer), klar, rull, auto (triller selv), inne (feiring), bytt
      if (fase === 'drop' && faseT > 0.45) { fase = 'klar'; lyd.plopp(); }
      if (fase === 'rull' || fase === 'auto') {
        if (fase === 'auto') {
          const dx = hull.kopp[0] - ball.x, dy = hull.kopp[1] - ball.y, d = Math.hypot(dx, dy);
          ball.x += dx / d * Math.min(d, 3.2 * dt); ball.y += dy / d * Math.min(d, 3.2 * dt);
          if (d < 0.08) ball.inne = true;
        } else {
          const treff = steg(ball, dt, t);
          if (treff > 1.2 && t - sistDunk > 0.08) { lyd.sprett(); sistDunk = t; const [X, Y] = tilS(g, ball.x, ball.y); api.sprut(X, Y, '#e7c48d', 3); }
          if (!innenfor(ball.x, ball.y) && !ball.inne) { ball.x = sisteRo.x; ball.y = sisteRo.y; ball.vx = ball.vy = 0; }
        }
        if (ball.inne) {
          fase = 'inne'; faseT = 0;
          hullStj = slag <= hull.par ? 3 : slag <= hull.par + 1 ? 2 : 1;
          poeng += hullStj; api.poeng(poeng);
          const [kX, kY] = tilS(g, hull.kopp[0], hull.kopp[1]);
          lyd.plopp(); setTimeout(() => lyd.stjerne(hullStj), 180);
          for (const f of ['#f5d33c', '#e8414e', '#4f9bd9', '#ffffff', '#b06fd8']) api.sprut(kX, kY, f, 6);
          api.sprut(kX, kY, '⭐', hullStj * 2);
        } else if (fase === 'rull' && Math.hypot(ball.vx, ball.vy) < 0.05) {
          ball.vx = ball.vy = 0; sisteRo = { x: ball.x, y: ball.y };
          if (slag >= MAKSSLAG) { fase = 'auto'; lyd.sus(); } else { fase = 'klar'; if (slag >= 2) lyd.hmm(); }
        }
      }
      if (fase === 'inne' && faseT > 1.6) {
        if (hi + 1 < HULL.length) { fase = 'bytt'; faseT = 0; }
        else if (!ferdig) {
          ferdig = true; api.framgang(1);
          const over = totalSlag - HULL.reduce((a, h) => a + h.par, 0);
          api.ferdig({ stjerner: over <= 2 ? 3 : over <= 7 ? 2 : 1, poeng });
        }
      }
      if (fase === 'bytt' && faseT > 0.35) { nyttHull(hi + 1); lyd.sus(); }

      // ---- tegning
      ctx.drawImage(bg, 0, 0, api.w, api.h);
      // vindmølla
      if (hull.mølle) {
        const [mX, mY] = tilS(g, hull.mølle[0], hull.mølle[1]);
        ctx.lineCap = 'round';
        for (const b of blader(t)) {
          const [aX, aY] = tilS(g, b[0], b[1]), [bX, bY] = tilS(g, b[2], b[3]);
          ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = s * 0.3; ctx.beginPath(); ctx.moveTo(aX + 3, aY + 4); ctx.lineTo(bX + 3, bY + 4); ctx.stroke();
          ctx.strokeStyle = '#f4efe2'; ctx.lineWidth = s * 0.26; ctx.beginPath(); ctx.moveTo(aX, aY); ctx.lineTo(bX, bY); ctx.stroke();
          ctx.strokeStyle = '#d24b3c'; ctx.lineWidth = s * 0.08; ctx.beginPath(); ctx.moveTo(aX + (bX - aX) * 0.35, aY + (bY - aY) * 0.35); ctx.lineTo(bX, bY); ctx.stroke();
        }
        ctx.lineCap = 'butt';
        ctx.fillStyle = '#b5523f'; ctx.beginPath();
        for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + Math.PI / 8; ctx.lineTo(mX + Math.cos(a) * s * 0.62, mY + Math.sin(a) * s * 0.62); }
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#d9735c'; ctx.beginPath(); ctx.arc(mX, mY, s * 0.36, 0, 7); ctx.fill();
        ctx.fillStyle = '#5a3a2a'; ctx.beginPath(); ctx.arc(mX, mY, s * 0.12, 0, 7); ctx.fill();
      }
      // siktepil mens fingeren drar
      const [bX, bY] = tilS(g, ball.x, ball.y);
      if (drag && fase === 'klar') {
        const dx = drag.x - drag.cx, dy = drag.y - drag.cy, l = Math.hypot(dx, dy);
        if (l > 0.2) {
          const k = Math.min(1, l * K / MAKS), lengde = 0.9 + k * 3.4;
          const [fX, fY] = tilS(g, drag.cx, drag.cy);
          ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(bX, bY); ctx.lineTo(bX + (fX - tilS(g, drag.x, drag.y)[0]), bY + (fY - tilS(g, drag.x, drag.y)[1])); ctx.stroke();
          const [eX, eY] = tilS(g, ball.x + dx / l * lengde, ball.y + dy / l * lengde);
          const farge = k < 0.45 ? '#7fe07a' : k < 0.8 ? '#f5d33c' : '#f2764b';
          ctx.fillStyle = farge;
          const n = 6;
          for (let i = 1; i < n; i++) { const q = i / n; ctx.beginPath(); ctx.arc(bX + (eX - bX) * q, bY + (eY - bY) * q, 2.5 + q * 3, 0, 7); ctx.fill(); }
          const ang = Math.atan2(eY - bY, eX - bX), hs = 10 + k * 8;
          ctx.beginPath(); ctx.moveTo(eX + Math.cos(ang) * hs, eY + Math.sin(ang) * hs);
          ctx.lineTo(eX + Math.cos(ang + 2.5) * hs, eY + Math.sin(ang + 2.5) * hs); ctx.lineTo(eX + Math.cos(ang - 2.5) * hs, eY + Math.sin(ang - 2.5) * hs); ctx.closePath(); ctx.fill();
        }
      }
      // ballen
      ball.sk = Math.max(0, ball.sk - dt * 4);
      if (fase !== 'inne' && fase !== 'bytt') {
        let sk = 1 + ball.sk * 0.15, dy = 0;
        if (fase === 'drop') { const k = Math.min(1, faseT / 0.45); dy = -(1 - k) * (1 - k) * 60; sk = 1 + (1 - k) * 0.5; }
        if (fase === 'auto') { const d = Math.hypot(hull.kopp[0] - ball.x, hull.kopp[1] - ball.y); sk *= Math.min(1, 0.6 + d); }
        ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(bX + 2, bY + 3, BR * s, BR * s * 0.8, 0, 0, 7); ctx.fill();
        const d = ballSpr._s * sk;
        ctx.drawImage(ballSpr, bX - d / 2, bY + dy - d / 2, d, d);
        // pulserende ring rundt ballen når den venter på slag
        if (fase === 'klar' && !drag) { const p = (t * 1.2) % 1; ctx.strokeStyle = 'rgba(255,255,255,' + (0.6 - p * 0.6) + ')'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(bX, bY, BR * s * (1.4 + p * 1.6), 0, 7); ctx.stroke(); }
      }
      // flagget løftes når ballen er i hullet
      tegnFlagg(g, t, fase === 'inne' ? Math.min(1, faseT * 3) * s * 0.5 : 0);
      // stjerner over hullet
      if (fase === 'inne') {
        const [kX, kY] = tilS(g, hull.kopp[0], hull.kopp[1]);
        for (let i = 0; i < hullStj; i++) {
          const k = Math.max(0, Math.min(1, (faseT - i * 0.15) / 0.3));
          if (!k) continue;
          const sk = k < 1 ? 1.3 - 0.3 * k : 1;
          api.emoji('⭐', kX + (i - (hullStj - 1) / 2) * s * 1.1, kY - s * 2.6 - Math.sin(k * Math.PI) * 8, Math.round(s * 0.9 * sk), 0, k);
        }
      }
      // slagteller: seks små baller ved utslaget (brukte er grå)
      for (let i = 0; i < MAKSSLAG; i++) {
        const [pX, pY] = tilS(g, 0.2 + i * 0.62 + (hull.poly[0][0] > 1.5 ? 1 : 0), 15.95);
        ctx.fillStyle = i < slag ? 'rgba(255,255,255,.25)' : '#ffffff';
        ctx.beginPath(); ctx.arc(pX, pY, Math.max(4, s * 0.18), 0, 7); ctx.fill();
      }
      // hvilket hull: fem små flagg i rekke
      for (let i = 0; i < HULL.length; i++) {
        const [pX, pY] = tilS(g, 10.2 - (HULL.length - 1 - i) * 0.75 - (hull.poly[1][0] < 8.5 ? 0 : 0), 15.95);
        ctx.fillStyle = i < hi ? '#f5d33c' : i === hi ? '#e8414e' : 'rgba(255,255,255,.3)';
        ctx.beginPath(); ctx.arc(pX, pY, Math.max(4, s * 0.2) * (i === hi ? 1.3 : 1), 0, 7); ctx.fill();
      }
      // overgang til neste hull
      if (fase === 'bytt' || (fase === 'drop' && faseT < 0.3)) {
        const a = fase === 'bytt' ? faseT / 0.35 : 1 - faseT / 0.3;
        ctx.fillStyle = 'rgba(52,66,90,' + Math.max(0, Math.min(1, a)) + ')'; ctx.fillRect(0, 0, api.w, api.h);
      }
    });

    return {
      hint() {
        if (fase !== 'klar' || drag) return null;
        const g = geo();
        if (hintMinne && hintMinne.x === ball.x && hintMinne.y === ball.y && hintMinne.w === api.w) return hintMinne.h;
        // prøv mange retninger og krefter i en rask simulering; ta et som går i hullet (helst mykt), ellers det som kommer nærmest
        let best = null, bv = -1e9;
        const t0 = api.tid + 0.9;
        const [bX, bY] = tilS(g, ball.x, ball.y);
        for (let i = 0; i < 96; i++) {
          const a = i / 96 * Math.PI * 2, cx = Math.cos(a), cy = Math.sin(a);
          for (const v of [3, 4.5, 6, 7.5, 9, 10.5, 12, 13.5]) {
            const l = v / K;
            const [eX, eY] = tilS(g, ball.x - cx * l, ball.y - cy * l);
            if (eX < 8 || eY < 8 || eX > api.w - 8 || eY > api.h - 8) continue;   // draget må være på skjermen
            // med vindmølle: prøv flere starttider, så slaget virker uansett når barnet slipper
            let score = 0;
            for (const dt0 of (hull.mølle ? [-0.5, 0, 0.5] : [0])) {
              const r = simuler(cx * v, cy * v, t0 + dt0);
              score += r.inne ? 1000 - v * 3 - r.tid * 4 : -Math.hypot(r.x - hull.kopp[0], r.y - hull.kopp[1]) - (iSand(r.x, r.y) ? 1.5 : 0);
            }
            if (score > bv) { bv = score; best = { x: bX, y: bY, x2: eX, y2: eY, vent: 300 }; }
          }
        }
        hintMinne = { x: ball.x, y: ball.y, w: api.w, h: best };
        return best;
      },
      tilstand() { return { hull: hi + 1, slag, totalSlag, poeng, fase }; },
    };
  },
};

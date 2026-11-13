// Boblebadet (sjanger: boblekanon). Badeanda skyter såpebobler opp i feltet; tre like som henger sammen sprekker.
// Kan ikke tapes: feltet synker aldri. Bommer barnet mange ganger, kommer en regnbueboble som passer alt. Runden: 80 s eller tomt felt.
export default {
  id: 'bobler', navn: 'Boblebadet', ikon: '🫧', rom: 'Badet', hjelp: 'trykk', poengIkon: '🫧', bakgrunn: '#dcecf2', hjelpEtter: 5,
  start(api) {
    const { ctx, lyd } = api;
    // fire farger med hvert sitt symbol, så de skilles også uten fargesyn
    const FARGE = ['#e8475a', '#f6c22c', '#3a86df', '#3bb46a'];
    const LYS = ['#ff9aa5', '#fff0a8', '#a8d2ff', '#a6ecbf'];
    const MØRK = ['#a82535', '#c28d0b', '#1d5aa6', '#1f7d43'];
    const KOL = 8, W = 16, H = 21, KAR = 1.7, RH = Math.sqrt(3), MAKSRAD = 8, VARIGHET = 80, FART = 42;
    const L = { x: W / 2, y: H - 3.3 };                                     // der boblen skytes fra (over anda)
    const nett = new Map();                                                 // nøkkel r*16+c -> { f, sk }
    let poeng = 0, bom = 0, start = 0, borte = 0, skudd = null, lastet = 0, neste = 0, sikter = null, ferdigT = 0, avsluttet = false;
    let versjon = 0, hintMinne = null, andV = -Math.PI / 2, andRist = 0, sistPlask = 0;
    const spreng = [], fall = [], bølge = [];
    let sprites = null, spriteS = 0, bg = null, bgKey = '';

    // ---------------------------------------------------------------- rutenettet
    const antKol = (r) => (r % 2 ? KOL - 1 : KOL);
    const nøkkel = (r, c) => r * 16 + c;
    const pos = (r, c) => ({ x: 1 + 2 * c + (r % 2 ? 1 : 0), y: 1 + r * RH });
    function naboer(r, c) {
      const d = r % 2 ? [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, 0], [1, 1]] : [[0, -1], [0, 1], [-1, -1], [-1, 0], [1, -1], [1, 0]];
      const ut = [];
      for (const [dr, dc] of d) { const rr = r + dr, cc = c + dc; if (rr >= 0 && cc >= 0 && cc < antKol(rr)) ut.push([rr, cc]); }
      return ut;
    }
    // fyll startfeltet med klynger, så det finnes grupper å skyte på
    for (let r = 0; r < 7; r++) for (let c = 0; c < antKol(r); c++) {
      let f = Math.floor(api.rnd() * 4);
      const nb = naboer(r, c).map(([a, b]) => nett.get(nøkkel(a, b))).filter(Boolean);
      if (nb.length && api.rnd() < 0.45) f = nb[Math.floor(api.rnd() * nb.length)].f;
      nett.set(nøkkel(r, c), { f, sk: 0 });
    }
    start = nett.size;
    function gruppe(r, c, f, ekstra) {                                     // alle like som henger sammen med (r, c)
      const sett = new Set([nøkkel(r, c)]), kø = [[r, c]], ut = [[r, c]];
      while (kø.length) {
        const [a, b] = kø.shift();
        for (const [rr, cc] of naboer(a, b)) {
          const k = nøkkel(rr, cc);
          if (sett.has(k)) continue;
          const n = nett.get(k);
          if (n && n.f === f) { sett.add(k); kø.push([rr, cc]); ut.push([rr, cc]); }
        }
      }
      return ut;
    }
    function løse() {                                                      // bobler som ikke henger fast i toppen
      const fast = new Set(), kø = [];
      for (let c = 0; c < KOL; c++) if (nett.has(nøkkel(0, c))) { fast.add(nøkkel(0, c)); kø.push([0, c]); }
      while (kø.length) {
        const [a, b] = kø.shift();
        for (const [rr, cc] of naboer(a, b)) { const k = nøkkel(rr, cc); if (!fast.has(k) && nett.has(k)) { fast.add(k); kø.push([rr, cc]); } }
      }
      const ut = [];
      for (const k of nett.keys()) if (!fast.has(k)) ut.push(k);
      return ut;
    }
    function fargerIgjen() { const s = new Set(); for (const n of nett.values()) s.add(n.f); return [...s]; }
    function trekkFarge() {
      const f = fargerIgjen();
      if (!f.length) return Math.floor(api.rnd() * 4);
      return f[Math.floor(api.rnd() * f.length)];
    }
    lastet = trekkFarge(); neste = trekkFarge();

    // ---------------------------------------------------------------- bane: samme regning for sikte, hint og skudd
    function bane(vinkel) {
      let x = L.x, y = L.y, dx = Math.cos(vinkel), dy = Math.sin(vinkel);
      const pkt = [{ x, y }], steg = 0.2;
      for (let i = 0; i < 600; i++) {
        x += dx * steg; y += dy * steg;
        if (x < 1) { x = 2 - x; dx = -dx; pkt.push({ x: 1, y }); }
        if (x > W - 1) { x = 2 * (W - 1) - x; dx = -dx; pkt.push({ x: W - 1, y }); }
        let treff = y <= 1;
        if (!treff) for (const [k] of nett) { const p = pos(Math.floor(k / 16), k % 16); if ((p.x - x) ** 2 + (p.y - y) ** 2 < 1.7 * 1.7) { treff = true; break; } }
        if (treff) { pkt.push({ x, y }); return { pkt, celle: fest(x, y) }; }
      }
      return { pkt, celle: null };
    }
    function fest(x, y) {                                                  // nærmeste ledige plass som henger fast
      const r0 = Math.round((y - 1) / RH);
      let best = null, bd = 1e9;
      for (let r = Math.max(0, r0 - 1); r <= r0 + 1; r++) for (let c = 0; c < antKol(r); c++) {
        if (nett.has(nøkkel(r, c))) continue;
        if (r > 0 && !naboer(r, c).some(([a, b]) => nett.has(nøkkel(a, b)))) continue;
        const p = pos(r, c), d = (p.x - x) ** 2 + (p.y - y) ** 2;
        if (d < bd) { bd = d; best = [r, c]; }
      }
      return best;
    }
    function vinkelTil(wx, wy) {                                           // retning fra anda, aldri for flat
      let v = Math.atan2(wy - L.y, wx - L.x);
      if (v > 0) v = wx < L.x ? -Math.PI + 0.14 : -0.14;
      return Math.max(-Math.PI + 0.14, Math.min(-0.14, v));
    }
    function regnbueFarge(r, c) {                                          // regnbueboblen blir den fargen som gir størst gruppe
      let best = lastet, bn = 0;
      for (let f = 0; f < 4; f++) {
        if (!naboer(r, c).some(([a, b]) => { const n = nett.get(nøkkel(a, b)); return n && n.f === f; })) continue;
        nett.set(nøkkel(r, c), { f, sk: 0 });
        const n = gruppe(r, c, f).length;
        nett.delete(nøkkel(r, c));
        if (n > bn) { bn = n; best = f; }
      }
      return best;
    }
    function verdi(celle, farge) {                                         // hvor mange som sprekker om boblen lander her
      if (!celle) return -1;
      const [r, c] = celle;
      if (r > MAKSRAD) return -1;
      const f = farge === 4 ? regnbueFarge(r, c) : farge;
      nett.set(nøkkel(r, c), { f, sk: 0 });
      const n = gruppe(r, c, f).length;
      nett.delete(nøkkel(r, c));
      return n;
    }

    // ---------------------------------------------------------------- skyting
    function skyt(vinkel) {
      if (skudd || ferdigT || api.tid > VARIGHET - 0.6) return;
      const b = bane(vinkel);
      skudd = { pkt: b.pkt, celle: b.celle, f: lastet, i: 0, x: L.x, y: L.y, igjen: 0 };
      lastet = neste; neste = trekkFarge(); versjon++;
      if (bom >= 3) { lastet = 4; bom = 0; }
      andRist = 1; andV = vinkel;
      lyd.sus();
    }
    function land() {
      const s = skudd; skudd = null; versjon++;
      if (!s.celle || s.celle[0] > MAKSRAD) {                               // for langt ned: boblen brister stille
        const g = geo(); api.sprut(sx(g, s.x), sy(g, s.y), '#ffffff', 6); lyd.hmm(); bom++; return;
      }
      const [r, c] = s.celle;
      const f = s.f === 4 ? regnbueFarge(r, c) : s.f;
      nett.set(nøkkel(r, c), { f, sk: 0.5 });
      for (const [a, b] of naboer(r, c)) { const n = nett.get(nøkkel(a, b)); if (n) n.sk = Math.max(n.sk, 0.3); }
      const gr = gruppe(r, c, f);
      const g = geo();
      if (gr.length >= 3) {
        bom = 0;
        gr.forEach(([a, b], i) => { const p = pos(a, b); nett.delete(nøkkel(a, b)); spreng.push({ x: p.x, y: p.y, f, t: -i * 0.055, lyd: i }); });
        const løs = løse();
        løs.forEach((k, i) => { const p = pos(Math.floor(k / 16), k % 16); const n = nett.get(k); nett.delete(k); fall.push({ x: p.x, y: p.y, f: n.f, vx: (api.rnd() - 0.5) * 6, vy: -2 - api.rnd() * 3, t: -0.1 - i * 0.03, rot: 0 }); });
        borte += gr.length + løs.length;
        poeng += gr.length + løs.length * 2; api.poeng(poeng);
        if (løs.length) setTimeout(() => lyd.bra(), 250);
      } else {
        bom++;
        lyd.sprett();
        api.sprut(sx(g, pos(r, c).x), sy(g, pos(r, c).y), LYS[f], 4);
      }
    }
    api.peker((e) => {
      const g = geo();
      const wx = (e.x - g.ox) / g.s, wy = (e.y - g.oy) / g.s;
      if (e.type === 'ned' || (e.type === 'flytt' && e.nede)) sikter = vinkelTil(wx, wy);
      else if (e.type === 'opp') { const v = vinkelTil(wx, wy); sikter = null; skyt(v); }
    });

    // ---------------------------------------------------------------- tegning
    function geo() {
      const t = api.trygg;
      const x0 = t.venstre + 4, x1 = api.w - t.høyre - 4, y0 = t.topp, y1 = api.h - t.bunn;
      const s = Math.min((x1 - x0) / (W + 0.8), (y1 - y0) / (H + KAR));
      const ox = (x0 + x1) / 2 - W / 2 * s, oy = y1 - (H + KAR) * s;
      return { s, ox, oy, x0, x1, y0, y1 };
    }
    const sx = (g, x) => g.ox + x * g.s, sy = (g, y) => g.oy + y * g.s;
    function symbol(x, f, cx, cy, r) {                                     // hvitt symbol inni boblen
      x.fillStyle = 'rgba(255,255,255,.88)'; x.strokeStyle = 'rgba(255,255,255,.88)'; x.lineWidth = r * 0.16;
      x.beginPath();
      if (f === 0) {                                                         // hjerte
        const k = r * 0.42;
        x.moveTo(cx, cy + k * 0.95);
        x.bezierCurveTo(cx - k * 1.5, cy - k * 0.1, cx - k * 0.7, cy - k * 1.2, cx, cy - k * 0.45);
        x.bezierCurveTo(cx + k * 0.7, cy - k * 1.2, cx + k * 1.5, cy - k * 0.1, cx, cy + k * 0.95);
        x.fill();
      } else if (f === 1) {                                                  // stjerne
        for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.2 : r * 0.47; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
        x.closePath(); x.fill();
      } else if (f === 2) {                                                  // dråpe
        const k = r * 0.42;
        x.moveTo(cx, cy - k * 1.1);
        x.bezierCurveTo(cx + k * 0.3, cy - k * 0.5, cx + k * 0.85, cy, cx + k * 0.8, cy + k * 0.35);
        x.arc(cx, cy + k * 0.35, k * 0.8, 0, Math.PI);
        x.bezierCurveTo(cx - k * 0.85, cy, cx - k * 0.3, cy - k * 0.5, cx, cy - k * 1.1);
        x.fill();
      } else {                                                               // trekant
        const k = r * 0.48;
        x.moveTo(cx, cy - k); x.lineTo(cx + k * 0.95, cy + k * 0.65); x.lineTo(cx - k * 0.95, cy + k * 0.65); x.closePath(); x.fill();
      }
    }
    function lagSprites(s) {                                               // én ferdig tegnet boble per farge, lages ved ny størrelse
      const dpr = Math.min(2, window.devicePixelRatio || 1), r = s, side = Math.ceil(2 * r + 4);
      const ut = [];
      for (let f = 0; f < 5; f++) {
        const c = document.createElement('canvas'); c.width = c.height = Math.ceil(side * dpr);
        const x = c.getContext('2d'); x.scale(dpr, dpr);
        const m = side / 2;
        if (f < 4) {
          const gr = x.createRadialGradient(m - r * 0.35, m - r * 0.4, r * 0.1, m, m, r);
          gr.addColorStop(0, LYS[f]); gr.addColorStop(0.55, FARGE[f]); gr.addColorStop(1, MØRK[f]);
          x.fillStyle = gr; x.beginPath(); x.arc(m, m, r * 0.97, 0, 7); x.fill();
          symbol(x, f, m, m + r * 0.04, r);
        } else {                                                             // regnbueboble
          const rf = ['#e8475a', '#f39a2c', '#f6c22c', '#3bb46a', '#3a86df', '#9b5fd6'];
          for (let i = 0; i < 6; i++) { x.fillStyle = rf[i]; x.beginPath(); x.moveTo(m, m); x.arc(m, m, r * 0.97, i * Math.PI / 3, (i + 1) * Math.PI / 3 + 0.02); x.fill(); }
          const gr = x.createRadialGradient(m, m, 0, m, m, r); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(0.45, 'rgba(255,255,255,.15)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
          x.fillStyle = gr; x.beginPath(); x.arc(m, m, r, 0, 7); x.fill();
        }
        // såpeglans
        x.fillStyle = 'rgba(255,255,255,.75)'; x.beginPath(); x.ellipse(m - r * 0.42, m - r * 0.45, r * 0.22, r * 0.13, -0.7, 0, 7); x.fill();
        x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = Math.max(1, r * 0.07); x.beginPath(); x.arc(m, m, r * 0.9, Math.PI * 0.1, Math.PI * 0.45); x.stroke();
        c._s = side;
        ut.push(c);
      }
      ut.and = lagAnd(s * 3.4);
      return ut;
    }
    function lagAnd(px) {                                                  // gul badeand, ser mot venstre
      const dpr = Math.min(2, window.devicePixelRatio || 1), c = document.createElement('canvas');
      c.width = c.height = Math.ceil(px * dpr);
      const x = c.getContext('2d'); x.scale(dpr, dpr);
      const u = px / 10;
      x.fillStyle = '#f4b41a';                                               // skygge under kroppen
      x.beginPath(); x.ellipse(5.4 * u, 7 * u, 3.9 * u, 2.2 * u, 0, 0, 7); x.fill();
      x.fillStyle = '#ffd43b';
      x.beginPath(); x.ellipse(5.4 * u, 6.6 * u, 3.9 * u, 2.3 * u, 0, 0, 7); x.fill();      // kropp
      x.beginPath(); x.moveTo(8.4 * u, 6 * u); x.quadraticCurveTo(9.8 * u, 4.2 * u, 9.6 * u, 4.6 * u); x.lineTo(8.9 * u, 6.8 * u); x.fill();   // hale
      x.beginPath(); x.arc(3.6 * u, 3.6 * u, 2.1 * u, 0, 7); x.fill();                      // hode
      x.fillStyle = '#ffe680'; x.beginPath(); x.ellipse(3 * u, 2.9 * u, 0.8 * u, 0.5 * u, -0.5, 0, 7); x.fill();
      x.fillStyle = '#f4b41a'; x.beginPath(); x.ellipse(6 * u, 6.3 * u, 1.9 * u, 1 * u, 0.25, 0, 7); x.fill();   // vinge
      x.fillStyle = '#ff7a1a'; x.beginPath(); x.ellipse(1.5 * u, 4.2 * u, 1.05 * u, 0.5 * u, 0.15, 0, 7); x.fill();   // nebb
      x.fillStyle = '#e25d0c'; x.beginPath(); x.ellipse(1.6 * u, 4.5 * u, 0.8 * u, 0.22 * u, 0.15, 0, 7); x.fill();
      x.fillStyle = '#2a1d10'; x.beginPath(); x.arc(3.1 * u, 3.2 * u, 0.42 * u, 0, 7); x.fill();                      // øye
      x.fillStyle = '#fff'; x.beginPath(); x.arc(2.95 * u, 3.05 * u, 0.15 * u, 0, 7); x.fill();
      c._s = px;
      return c;
    }
    function boble(f, x, y, sk, alfa) {
      const c = sprites[f], d = c._s * (sk || 1);
      if (alfa !== undefined) ctx.globalAlpha = Math.max(0, alfa);
      ctx.drawImage(c, x - d / 2, y - d / 2, d, d);
      if (alfa !== undefined) ctx.globalAlpha = 1;
    }
    function lagBg(g) {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const c = document.createElement('canvas'); c.width = Math.round(api.w * dpr); c.height = Math.round(api.h * dpr);
      const x = c.getContext('2d'); x.scale(dpr, dpr);
      const Wd = api.w, Hd = api.h;
      const spr = (tegn, px, cx, cy) => { const sp = api.sprite(tegn, px); x.drawImage(sp, cx - sp._s / 2, cy - sp._s / 2, sp._s, sp._s); };
      // flislagt vegg
      x.fillStyle = '#c9dfe8'; x.fillRect(0, 0, Wd, Hd);
      const fl = Math.max(28, Math.round(g.s * 2.2));
      for (let yy = 0; yy < Hd; yy += fl) for (let xx = 0; xx < Wd; xx += fl) {
        x.fillStyle = ((xx / fl + yy / fl) % 7 === 3) ? '#d3e9f1' : '#eaf5f8';
        x.fillRect(xx + 1.5, yy + 1.5, fl - 3, fl - 3);
      }
      // badekaret nederst
      const vann = sy(g, H - 0.95), kL = Math.max(-20, sx(g, -4)), kR = Math.min(Wd + 20, sx(g, W + 4));
      const gulv = sy(g, H + KAR * 0.55);
      x.fillStyle = '#d8c3a0'; x.fillRect(0, gulv, Wd, Hd - gulv);
      x.fillStyle = '#c9b08a'; for (let xx = 0; xx < Wd; xx += 46) x.fillRect(xx, gulv, 2, Hd - gulv);
      x.fillStyle = '#b39a74'; x.fillRect(0, gulv, Wd, 3);
      // dusjen over feltet når det er plass
      const over = sy(g, -0.3) - g.y0;
      if (over > 70) {
        const dx = sx(g, W - 2.5);
        x.fillStyle = '#b8c4ca'; x.fillRect(dx - 3, 0, 6, sy(g, -0.3) - Math.min(70, over * 0.5));
        spr('🚿', Math.min(90, over * 0.8), dx - Math.min(90, over * 0.8) * 0.15, sy(g, -0.3) - Math.min(70, over * 0.5) + Math.min(90, over * 0.8) * 0.2);
      }
      // sidene: speil og håndkle når det er plass
      const fri = sx(g, -0.4) - g.x0;
      if (fri > 130) {
        const mw = Math.min(fri - 50, 170), mh = Math.min(mw * 1.25, vann - g.y0 - 50), mx = g.x0 + (fri - mw) / 2, my = g.y0 + 10;
        if (mh > 60) {
          x.fillStyle = '#ffffff';
          x.beginPath(); x.ellipse(mx + mw / 2, my + mh / 2, mw / 2 + 7, mh / 2 + 7, 0, 0, 7); x.fill();
          const gr = x.createLinearGradient(mx, my, mx + mw, my + mh); gr.addColorStop(0, '#d8f0fb'); gr.addColorStop(1, '#9ccbe0');
          x.fillStyle = gr; x.beginPath(); x.ellipse(mx + mw / 2, my + mh / 2, mw / 2, mh / 2, 0, 0, 7); x.fill();
          x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 5; x.beginPath(); x.moveTo(mx + mw * 0.28, my + mh * 0.3); x.lineTo(mx + mw * 0.45, my + mh * 0.18); x.stroke();
          const hy = my + mh + 22;
          x.fillStyle = '#f1f4f5'; x.fillRect(mx - 10, hy, mw + 20, 8);
          spr('🪥', 34, mx + mw * 0.25, hy - 16); spr('🧼', 34, mx + mw * 0.72, hy - 12);
        }
        const hR = sx(g, W + 0.4), rx = hR + (g.x1 - hR) / 2;
        x.fillStyle = '#9aa7ad'; x.fillRect(rx - 60, g.y0 + 30, 120, 7);
        x.fillStyle = '#f39a8c'; x.fillRect(rx - 48, g.y0 + 34, 96, Math.min(150, vann - g.y0 - 70));
        x.fillStyle = '#fbc6bd'; for (let i = 0; i < 3; i++) x.fillRect(rx - 48, g.y0 + 34 + Math.min(150, vann - g.y0 - 70) - 22 + i * 7, 96, 3);
        spr('🧴', 46, rx + 40, vann - 30); spr('🧽', 40, rx - 34, vann - 22);
      }
      // feltet: et lysere panel med en stang øverst som boblene henger i
      x.fillStyle = 'rgba(255,255,255,.42)';
      x.beginPath(); x.roundRect ? x.roundRect(sx(g, -0.3), sy(g, -0.3), (W + 0.6) * g.s, (H - 0.5) * g.s, 14) : x.rect(sx(g, -0.3), sy(g, -0.3), (W + 0.6) * g.s, (H - 0.5) * g.s); x.fill();
      x.fillStyle = '#a9b8bf'; x.fillRect(sx(g, -0.4), sy(g, -0.25), (W + 0.8) * g.s, 5);
      x.fillStyle = '#d7e0e4'; x.fillRect(sx(g, -0.4), sy(g, -0.25), (W + 0.8) * g.s, 2);
      return c;
    }
    function tegnKar(g, t) {                                               // vann og karkant foran anda
      const vann = sy(g, H - 0.95), kL = Math.max(-20, sx(g, -4)), kR = Math.min(api.w + 20, sx(g, W + 4));
      ctx.fillStyle = '#8fd0ee';
      ctx.beginPath(); ctx.moveTo(kL, vann);
      for (let x = kL; x <= kR + 8; x += 8) ctx.lineTo(x, vann + Math.sin(x * 0.05 + t * 2.4) * 2.2);
      ctx.lineTo(kR, sy(g, H) + 4); ctx.lineTo(kL, sy(g, H) + 4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.85)';                              // skum
      for (let i = 0; i < 14; i++) { const x = kL + (kR - kL) * ((i * 0.137 + 0.05) % 1), r = 5 + (i % 4) * 3; ctx.beginPath(); ctx.arc(x, vann + 2 + Math.sin(t * 2 + i) * 1.5, r, 0, 7); ctx.fill(); }
    }
    function tegnKarFront(g) {
      const kL = Math.max(-20, sx(g, -4)), kR = Math.min(api.w + 20, sx(g, W + 4));
      const kant = sy(g, H - 0.35), bunn = sy(g, H + KAR * 0.75), r = Math.min(40, (bunn - kant) * 0.5);
      ctx.fillStyle = '#d6a93e';                                             // føtter
      for (const fx of [kL + 40, kR - 40]) { ctx.beginPath(); ctx.ellipse(fx, bunn, 9, Math.max(6, (sy(g, H + KAR) - bunn) * 0.9 + 4), 0, 0, Math.PI); ctx.fill(); }
      ctx.fillStyle = '#ffffff'; api.rundRekt(kL - 6, kant, kR - kL + 12, bunn - kant, r); ctx.fill();
      ctx.fillStyle = '#e4eef2'; api.rundRekt(kL + 4, kant + 14, kR - kL - 8, bunn - kant - 20, r * 0.8); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(kL + 4, kant + 14, kR - kL - 8, 6);
    }

    api.løkke((dt, t) => {
      const g = geo();
      if (!sprites || Math.abs(spriteS - g.s) > 0.01) { sprites = lagSprites(g.s); spriteS = g.s; }
      const key = api.w + 'x' + api.h;
      if (key !== bgKey) { bg = lagBg(g); bgKey = key; }
      ctx.drawImage(bg, 0, 0, api.w, api.h);
      const s = g.s;
      // feltet
      for (const [k, n] of nett) {
        const p = pos(Math.floor(k / 16), k % 16);
        n.sk = Math.max(0, n.sk - dt * 2.2);
        const sk = 1 + Math.sin(n.sk * 12) * n.sk * 0.25;
        boble(n.f, sx(g, p.x), sy(g, p.y + Math.sin(t * 1.6 + p.x * 0.7) * 0.04), sk);
      }
      // siktelinje mens fingeren er nede
      if (sikter !== null && !skudd) {
        const b = bane(sikter);
        ctx.fillStyle = 'rgba(255,255,255,.95)';
        let igjen = 0.4 + ((t * 2) % 0.8);
        for (let i = 1; i < b.pkt.length; i++) {
          const a = b.pkt[i - 1], c = b.pkt[i], l = Math.hypot(c.x - a.x, c.y - a.y);
          while (igjen < l) { const k = igjen / l; ctx.beginPath(); ctx.arc(sx(g, a.x + (c.x - a.x) * k), sy(g, a.y + (c.y - a.y) * k), Math.max(2.5, s * 0.17), 0, 7); ctx.fill(); igjen += 0.8; }
          igjen -= l;
        }
        if (b.celle && b.celle[0] <= MAKSRAD) { const p = pos(b.celle[0], b.celle[1]); boble(lastet, sx(g, p.x), sy(g, p.y), 1, 0.35); }
      }
      // skuddet i lufta, langs den utregnede banen
      if (skudd) {
        let rest = FART * dt;
        while (rest > 0 && skudd) {
          const mål = skudd.pkt[skudd.i + 1];
          if (!mål) { land(); break; }
          const l = Math.hypot(mål.x - skudd.x, mål.y - skudd.y);
          if (l <= rest) { skudd.x = mål.x; skudd.y = mål.y; skudd.i++; rest -= l; if (skudd.pkt[skudd.i + 1] && (mål.x === 1 || mål.x === W - 1)) lyd.klikk(); }
          else { skudd.x += (mål.x - skudd.x) / l * rest; skudd.y += (mål.y - skudd.y) / l * rest; rest = 0; }
        }
        if (skudd) boble(skudd.f, sx(g, skudd.x), sy(g, skudd.y), 1);
      }
      // bobler som sprekker
      for (let i = spreng.length - 1; i >= 0; i--) {
        const p = spreng[i]; p.t += dt;
        if (p.t < 0) { boble(p.f, sx(g, p.x), sy(g, p.y), 1); continue; }
        if (!p.sagt) { p.sagt = 1; lyd.pop(); lyd.tone(Math.min(24, 4 + p.lyd * 2)); api.sprut(sx(g, p.x), sy(g, p.y), FARGE[p.f], 7); if (p.lyd % 2 === 0) api.sprut(sx(g, p.x), sy(g, p.y), '🫧', 1); }
        const k = p.t / 0.16;
        if (k >= 1) { spreng.splice(i, 1); continue; }
        boble(p.f, sx(g, p.x), sy(g, p.y), 1 + k * 0.5, 1 - k);
      }
      // bobler som mistet festet faller ned i karet
      for (let i = fall.length - 1; i >= 0; i--) {
        const p = fall[i]; p.t += dt;
        if (p.t < 0) { boble(p.f, sx(g, p.x), sy(g, p.y), 1); continue; }
        p.vy += 40 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.y > H - 0.9) {
          fall.splice(i, 1);
          api.sprut(sx(g, p.x), sy(g, H - 0.9), '#bfe8ff', 6);
          bølge.push({ x: p.x, t: 0 });
          if (t - sistPlask > 0.12) { lyd.plask(); sistPlask = t; }
          continue;
        }
        boble(p.f, sx(g, p.x), sy(g, p.y), 1);
      }
      // anda og karet
      tegnKar(g, t);
      for (let i = bølge.length - 1; i >= 0; i--) {
        const b = bølge[i]; b.t += dt;
        if (b.t > 0.6) { bølge.splice(i, 1); continue; }
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.8 - b.t * 1.3) + ')'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.ellipse(sx(g, b.x), sy(g, H - 0.75), 6 + b.t * 50, 2 + b.t * 10, 0, 0, 7); ctx.stroke();
      }
      andRist = Math.max(0, andRist - dt * 4);
      const retning = sikter !== null ? sikter : andV;
      const høyre = Math.cos(retning) > 0;
      const ay = sy(g, H - 1.55) + Math.sin(t * 2.2) * 2 + andRist * 4;
      ctx.save(); ctx.translate(sx(g, L.x), ay); if (høyre) ctx.scale(-1, 1); ctx.rotate(Math.sin(t * 1.7) * 0.05 - andRist * 0.15);
      const and = sprites.and;
      ctx.drawImage(and, -and._s / 2, -and._s / 2, and._s, and._s);
      ctx.restore();
      tegnKarFront(g);
      // boblen som er ladd, og den neste
      if (!skudd && !ferdigT) boble(lastet, sx(g, L.x), sy(g, L.y) + Math.sin(t * 3) * 1.5, 1 + (lastet === 4 ? Math.sin(t * 8) * 0.05 : 0));
      boble(neste, sx(g, L.x + 3), sy(g, H - 1.1), 0.62);

      // slutt: tomt felt eller tida ute
      if (!nett.size && !skudd && !spreng.length && !fall.length && !ferdigT) { ferdigT = 1.6; lyd.fanfare(); api.sprut(api.w / 2, api.h * 0.35, '⭐', 14); }
      api.framgang(Math.min(1, t / VARIGHET));
      if (ferdigT) { ferdigT -= dt; if (ferdigT <= 0) avslutt(); }
      else if (t >= VARIGHET && !skudd && !spreng.length) avslutt();
    });
    function avslutt() {
      if (avsluttet) return; avsluttet = true;
      const k = 1 - nett.size / start;
      api.ferdig({ stjerner: k >= 0.85 ? 3 : k >= 0.45 ? 2 : 1, poeng });
    }

    return {
      hint() {
        if (skudd || ferdigT || spreng.length || api.tid > VARIGHET - 1) return null;
        const g = geo(), nøkkelH = versjon + '|' + api.w + 'x' + api.h;
        if (hintMinne && hintMinne.k === nøkkelH) return hintMinne.h;       // banene regnes bare på nytt når noe har endret seg
        const h = lagHint(g);
        hintMinne = { k: nøkkelH, h };
        return h;
      },
      tilstand() { return { poeng, igjen: nett.size, borte, start, bom }; },
    };
    function lagHint(g) {
      {
        let best = null, bv = -1;
        const N = 110;
        for (let i = 0; i < N; i++) {
          const v = -Math.PI + 0.14 + (Math.PI - 0.28) * (i + 0.5) / N;
          const b = bane(v);
          let n = verdi(b.celle, lastet);
          if (n < 0) continue;
          // foretrekk vinkler der naboene lander på samme sted (tåler unøyaktig trykk)
          const nb = bane(v + 0.015).celle, nb2 = bane(v - 0.015).celle;
          const stødig = nb && nb2 && nb[0] === b.celle[0] && nb[1] === b.celle[1] && nb2[0] === b.celle[0] && nb2[1] === b.celle[1];
          const score = (n >= 3 ? 100 + n * 3 : n) + (stødig ? 1.5 : 0) - b.celle[0] * 0.01;
          if (score > bv) { bv = score; best = v; }
        }
        if (best === null) best = -Math.PI / 2;
        // trykkpunkt langt ut i retningen (inne i feltet)
        let d = 0;
        const dx = Math.cos(best), dy = Math.sin(best);
        while (d < 30) { const x = L.x + dx * (d + 0.3), y = L.y + dy * (d + 0.3); if (x < 0.6 || x > W - 0.6 || y < 1.4) break; d += 0.3; }
        d = Math.max(3, Math.min(d, 14));
        return { x: sx(g, L.x + dx * d), y: sy(g, L.y + dy * d), vent: 250 };
      }
    }
  },
};

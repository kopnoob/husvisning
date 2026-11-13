// Larven (sjanger: slange som vokser). En blid larve kryper på det runde teppet på barnerommet og spiser epler, blader og jordbær.
// Kan ikke tapes: kantene går rundt, og krysser larven seg selv, kiler den seg og ler. Etter 15 ting eller 75 s blir den en sommerfugl.
export default {
  id: 'slange', navn: 'Larven', ikon: '🐛', rom: 'Barnerommet', hjelp: 'dra', poengIkon: '🍎', bakgrunn: '#e9cfa3', hjelpEtter: 5,
  start(api) {
    const { ctx, lyd } = api;
    const MAT = ['🍎', '🍃', '🍓'];
    const MÅL = 15, VARIGHET = 75;
    let kol = 8, rad = 12, liggende = false;
    let kropp = [], fra = [], dir = { x: 0, y: -1 }, ønsket = null, vokse = 2, klokke = 0;
    let mat = [], nyMatT = 0.6, spist = 0, gape = 0, mett = [], rist = 0, kiletT = 0, vinkel = -Math.PI / 2;
    let fase = 'spill', sluttT = 0, ferdig = false, sommerfugl = null, gnistT = 0;
    let holdt = null, sveip = null, bak = null, bakNøkkel = '';
    const latter = [];                    // planlagte lyder { t, fn }
    const klem = (v) => Math.max(0, Math.min(1, v));
    const dpr = () => Math.max(1, Math.min(2, api.canvas.width / api.w));

    // startlarve midt på teppet, på vei oppover
    function nullstill() {
      liggende = api.w > api.h; kol = liggende ? 12 : 8; rad = liggende ? 8 : 12;
      const cx = Math.floor(kol / 2), cy = Math.floor(rad / 2) + 1;
      dir = liggende ? { x: 1, y: 0 } : { x: 0, y: -1 };
      kropp = [0, 1, 2].map((i) => ({ x: cx - dir.x * i, y: cy - dir.y * i }));
      fra = kropp.map((p) => ({ x: p.x, y: p.y }));
      vinkel = Math.atan2(dir.y, dir.x);
    }
    nullstill();
    // snus telefonen, speiles rutenettet om diagonalen: naboer forblir naboer
    function sjekkRetning() {
      const l = api.w > api.h;
      if (l === liggende) return;
      liggende = l;
      const t = kol; kol = rad; rad = t;
      const sw = (p) => { const x = p.x; p.x = p.y; p.y = x; };
      kropp.forEach(sw); fra.forEach(sw); mat.forEach(sw); sw(dir); if (ønsket) sw(ønsket);
      vinkel = Math.atan2(dir.y, dir.x);
    }
    function oppsett() {
      const t = api.trygg;
      const x0 = t.venstre + 6, x1 = api.w - t.høyre - 6, y0 = t.topp + 4, y1 = api.h - t.bunn - 4;
      const s = Math.floor(Math.min((x1 - x0) / (kol + 0.4), (y1 - y0) / (rad + 0.4)));
      return { s, gx: x0 + (x1 - x0 - kol * s) / 2, gy: y0 + (y1 - y0 - rad * s) / 2 };
    }

    // ---------------------------------------------------------------- bakgrunn: gulv, rundt flettet teppe, leker (lages én gang per størrelse)
    function superellipse(g, cx, cy, a, b, n) {
      g.beginPath();
      for (let i = 0; i <= 96; i++) {
        const v = i / 96 * Math.PI * 2, c = Math.cos(v), s = Math.sin(v);
        g.lineTo(cx + a * Math.sign(c) * Math.pow(Math.abs(c), 2 / n), cy + b * Math.sign(s) * Math.pow(Math.abs(s), 2 / n));
      }
      g.closePath();
    }
    function lagBakgrunn(L) {
      const W = api.w, H = api.h, k = dpr(), c = document.createElement('canvas');
      c.width = Math.ceil(W * k); c.height = Math.ceil(H * k);
      const g = c.getContext('2d'); g.scale(k, k);
      let frø = 5;
      const r = () => (frø = (frø * 16807) % 2147483647) / 2147483647;
      // lyst eikegulv, bord på langs
      const bw = Math.max(56, Math.min(W, H) / 5);
      const toner = ['#e2c08f', '#dcb884', '#e8c899', '#d9b37e'];
      for (let x = 0, i = 0; x < W; x += bw, i++) {
        g.fillStyle = toner[i % 4]; g.fillRect(x, 0, bw, H);
        for (let j = 0; j < 10; j++) {
          const xx = x + r() * bw, amp = 1 + r() * 3, ph = r() * 6;
          g.strokeStyle = 'rgba(140,90,40,' + (0.05 + r() * 0.08) + ')'; g.lineWidth = 0.8 + r() * 1.4;
          g.beginPath(); g.moveTo(xx, 0);
          for (let y = 0; y <= H + 30; y += 30) g.lineTo(xx + Math.sin(y * 0.01 + ph) * amp, y);
          g.stroke();
        }
        g.fillStyle = 'rgba(110,70,30,.25)'; g.fillRect(x, 0, 1.5, H);
        g.fillRect(x, (0.15 + r() * 0.7) * H, bw, 1.5);
      }
      // teppet: et stort rundt flettet teppe i dempede farger, rutenettet sydd inn i midten
      const cx = L.gx + kol * L.s / 2, cy = L.gy + rad * L.s / 2, a = (kol * L.s / 2) * 1.45 + L.s * 0.3, b = (rad * L.s / 2) * 1.45 + L.s * 0.3;
      g.fillStyle = 'rgba(80,50,20,.2)'; g.beginPath(); g.ellipse(cx + 3, cy + 7, a, b, 0, 0, 7); g.fill();
      const ringer = ['#e7a596', '#f3dcae', '#a9d3c5', '#f6e6c6', '#c9c3ea', '#f3dcae', '#efb9c4', '#f6e6c6', '#a9d3c5', '#f3dcae', '#f6e6c6', '#f3dcae'];
      for (let i = 0; i < ringer.length; i++) {
        const f = 1 - i / ringer.length * 0.92;
        g.fillStyle = ringer[i]; g.beginPath(); g.ellipse(cx, cy, a * f, b * f, 0, 0, 7); g.fill();
        g.strokeStyle = 'rgba(120,80,40,.12)'; g.lineWidth = 1.2; g.setLineDash([3, 4]); g.stroke(); g.setLineDash([]);
      }
      // rutene: svakt sjakkmønster så barnet ser stegene, og en sydd kant rundt
      g.fillStyle = 'rgba(255,250,235,.45)'; g.fillRect(L.gx, L.gy, kol * L.s, rad * L.s);
      for (let y = 0; y < rad; y++) for (let x = 0; x < kol; x++) {
        if ((x + y) % 2) continue;
        g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(L.gx + x * L.s, L.gy + y * L.s, L.s, L.s);
      }
      g.strokeStyle = 'rgba(150,100,60,.45)'; g.lineWidth = 2; g.setLineDash([6, 5]);
      g.strokeRect(L.gx - 3, L.gy - 3, kol * L.s + 6, rad * L.s + 6); g.setLineDash([]);
      // leker på gulvet der det er plass
      const leker = ['🧸', '🚂', '⚽', '🪀', '🎨', '🧩'];
      const fri = [];
      const vx = cx - a - 10, hx = W - (cx + a) - 10, oy = cy - b - api.trygg.topp, ny = H - (cy + b);
      if (vx > 54) fri.push([vx / 2 + 4, H * 0.42], [vx / 2 + 4, H * 0.78]);
      if (hx > 54) fri.push([W - hx / 2 - 4, H * 0.38], [W - hx / 2 - 4, H * 0.76]);
      if (ny > 50) fri.push([W * 0.2, H - ny / 2], [W * 0.8, H - ny / 2]);
      if (oy > 50 && !fri.length) fri.push([W * 0.85, cy - b - oy / 2 + 4]);
      fri.forEach((p, i) => {
        const px = Math.min(70, Math.max(vx, hx, ny, 50) * 0.8), sp = api.sprite(leker[i % leker.length], px);
        g.fillStyle = 'rgba(80,50,20,.18)'; g.beginPath(); g.ellipse(p[0] + 3, p[1] + px * 0.42, px * 0.42, px * 0.12, 0, 0, 7); g.fill();
        g.save(); g.translate(p[0], p[1]); g.rotate((i % 2 ? 1 : -1) * 0.15); g.drawImage(sp, -sp._s / 2, -sp._s / 2, sp._s, sp._s); g.restore();
      });
      return c;
    }

    // ---------------------------------------------------------------- styring
    function hodePos(L) {
      const k = klem(klokke / stegTid());
      const p = flytt_(fra[0], kropp[0], k);
      return { x: L.gx + (p.x + 0.5) * L.s, y: L.gy + (p.y + 0.5) * L.s };
    }
    function flytt_(a, b, k) {             // fra a til b, også over kanten
      let dx = b.x - a.x, dy = b.y - a.y;
      if (dx > 1) dx -= kol; if (dx < -1) dx += kol; if (dy > 1) dy -= rad; if (dy < -1) dy += rad;
      return { x: a.x + dx * k, y: a.y + dy * k };
    }
    const motsatt = (a) => a.x === -dir.x && a.y === -dir.y;
    function retningMot(px, py) {
      const L = oppsett(), h = hodePos(L), dx = px - h.x, dy = py - h.y;
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return null;
      let r = Math.abs(dx) >= Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) };
      if (motsatt(r)) {                    // ingen helomvending: sving til den andre siden i stedet
        r = Math.abs(dx) >= Math.abs(dy) ? (Math.abs(dy) > 4 ? { x: 0, y: Math.sign(dy) } : null) : (Math.abs(dx) > 4 ? { x: Math.sign(dx), y: 0 } : null);
      }
      return r;
    }
    function ønsk(r) {
      if (!r || motsatt(r)) return;
      if (!ønsket || ønsket.x !== r.x || ønsket.y !== r.y) { ønsket = r; if (r.x !== dir.x || r.y !== dir.y) lyd.klikk(); }
    }
    api.peker((e) => {
      if (fase !== 'spill') return;
      if (e.type === 'ned') { holdt = { x: e.x, y: e.y }; sveip = { x: e.x, y: e.y, t: api.tid }; ønsk(retningMot(e.x, e.y)); }
      else if (e.type === 'flytt' && e.nede && holdt) { holdt.x = e.x; holdt.y = e.y; if (!sveip || Math.hypot(e.x - sveip.x, e.y - sveip.y) < 30) ønsk(retningMot(e.x, e.y)); }
      else if (e.type === 'opp') {
        if (sveip) {                     // raskt sveip: retningen på sveipet vinner
          const dx = e.x - sveip.x, dy = e.y - sveip.y;
          if (Math.hypot(dx, dy) > 30 && api.tid - sveip.t < 0.45) ønsk(Math.abs(dx) > Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) });
        }
        holdt = null; sveip = null;
      }
    });

    // ---------------------------------------------------------------- spillets gang
    const stegTid = () => Math.max(0.27, 0.36 - api.tid * 0.0011);         // svært forsiktig raskere
    function fri(x, y) { return !kropp.some((p) => p.x === x && p.y === y) && !mat.some((m) => m.x === x && m.y === y); }
    function nyMat() {
      const h = kropp[0];
      for (let n = 0; n < 60; n++) {
        const x = Math.floor(api.rnd() * kol), y = Math.floor(api.rnd() * rad);
        if (!fri(x, y) || Math.abs(x - h.x) + Math.abs(y - h.y) < 3) continue;
        mat.push({ x, y, tegn: MAT[Math.floor(api.rnd() * MAT.length)], t: 0 });
        lyd.plopp();
        return;
      }
    }
    function steg() {
      if (holdt && (!sveip || Math.hypot(holdt.x - sveip.x, holdt.y - sveip.y) < 30)) ønsk(retningMot(holdt.x, holdt.y));   // holder fingeren: larven følger den
      if (ønsket && !motsatt(ønsket)) dir = ønsket;
      ønsket = null;
      fra = kropp.map((p) => ({ x: p.x, y: p.y }));
      const h = kropp[0], n = { x: (h.x + dir.x + kol) % kol, y: (h.y + dir.y + rad) % rad };
      kropp.unshift(n);
      if (vokse > 0) { vokse--; fra.push({ x: fra[fra.length - 1].x, y: fra[fra.length - 1].y }); } else kropp.pop();
      for (let i = 0; i < mett.length; i++) mett[i] += 1;
      while (mett.length && mett[0] > kropp.length + 1) mett.shift();
      const m = mat.findIndex((f) => f.x === n.x && f.y === n.y);
      if (m >= 0) spis(mat.splice(m, 1)[0]);
      else if (kropp.slice(1).some((p) => p.x === n.x && p.y === n.y) && kiletT <= 0) kile();
    }
    function spis(f) {
      spist++; vokse++; gape = 0.35; mett.push(0);
      api.poeng(spist);
      const L = oppsett(), x = L.gx + (f.x + 0.5) * L.s, y = L.gy + (f.y + 0.5) * L.s;
      lyd.tone([0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23, 24][Math.min(spist - 1, 14)]);
      api.sprut(x, y, f.tegn === '🍃' ? '#7cc95a' : '#e8554e', 8);
      api.sprut(x, y, '✨', 3);
      nyMatT = 0.5;
      if (spist >= MÅL) blinkSommerfugl();
    }
    function kile() {                    // krysser seg selv: kiler, ler, risting, ingen fare
      rist = 0.6; kiletT = 1.2;
      [12, 16, 12, 17, 13].forEach((n, i) => latter.push({ t: i * 0.08, fn: () => lyd.tone(n, 0.1) }));
      const L = oppsett(), h = kropp[0];
      api.sprut(L.gx + (h.x + 0.5) * L.s, L.gy + (h.y + 0.5) * L.s, '💛', 4);
    }
    function blinkSommerfugl() {
      if (fase !== 'spill') return;
      fase = 'puppe'; sluttT = 0; holdt = null;
      lyd.pling();
      const L = oppsett();               // maten som er igjen, blir til glitter
      for (const m of mat) api.sprut(L.gx + (m.x + 0.5) * L.s, L.gy + (m.y + 0.5) * L.s, '✨', 3);
      mat = [];
    }

    // ---------------------------------------------------------------- tegning av larven
    function tegnLarve(L, t, k) {
      const s = L.s, n = kropp.length;
      const pos = [];
      for (let i = 0; i < n; i++) {
        const p = flytt_(fra[i] || kropp[i], kropp[i], k);
        // liten bølge på tvers av fartsretningen, så den ser ut til å krype
        const nb = flytt_(fra[Math.max(0, i - 1)] || kropp[i], kropp[Math.max(0, i - 1)], k);
        let tx = nb.x - p.x, ty = nb.y - p.y;
        const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
        const bølge = Math.sin(t * 7 - i * 0.9) * 0.06;
        let x = L.gx + (p.x + 0.5 - ty * bølge) * s, y = L.gy + (p.y + 0.5 + tx * bølge) * s;
        if (rist > 0) { x += Math.sin(t * 60 + i) * rist * s * 0.08; y += Math.cos(t * 55 + i * 2) * rist * s * 0.08; }
        let rr = s * (i === 0 ? 0.56 : 0.45 - Math.max(0, i - n + 4) * 0.045) * (1 + Math.sin(t * 7 - i * 0.9) * 0.04);
        for (const m of mett) rr += s * 0.14 * Math.exp(-((i - m - k) ** 2));     // maten glir bakover i magen
        if (fase === 'puppe') rr *= 1 - klem((sluttT - (n - 1 - i) * 0.05) / 0.3);
        pos.push({ x, y, r: Math.max(0, rr) });
      }
      // skygge, så kropp fra halen og fram
      ctx.fillStyle = 'rgba(70,40,20,.13)';
      for (let i = n - 1; i >= 0; i--) { const p = pos[i]; if (p.r < 1) continue; ctx.beginPath(); ctx.arc(p.x + 2, p.y + 5, p.r, 0, 7); ctx.fill(); }
      // en myk rygg under leddene, så kroppen henger sammen
      ctx.strokeStyle = '#5fae44'; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.lineWidth = s * 0.62;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const p = pos[i];
        if (p.r < 1) break;
        if (i && Math.hypot(p.x - pos[i - 1].x, p.y - pos[i - 1].y) < s * 1.5) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
      }
      ctx.stroke();
      for (let i = n - 1; i >= 1; i--) {
        const p = pos[i]; if (p.r < 1) continue;
        // små bein
        ctx.fillStyle = '#4c8f35';
        const fx = Math.cos(t * 9 - i) * p.r * 0.15;
        ctx.beginPath(); ctx.arc(p.x - p.r * 0.55 + fx, p.y + p.r * 0.75, p.r * 0.17, 0, 7); ctx.arc(p.x + p.r * 0.55 - fx, p.y + p.r * 0.75, p.r * 0.17, 0, 7); ctx.fill();
        ctx.fillStyle = i % 2 ? '#78c656' : '#8ad466';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.beginPath(); ctx.arc(p.x - p.r * 0.3, p.y - p.r * 0.35, p.r * 0.35, 0, 7); ctx.fill();
        if (i % 3 === 1) { ctx.fillStyle = '#f2c94c'; ctx.beginPath(); ctx.arc(p.x + p.r * 0.2, p.y + p.r * 0.1, p.r * 0.14, 0, 7); ctx.fill(); }
      }
      const h = pos[0];
      if (h.r < 1) return h;
      // hodet: følehorn, ansikt, øyne som ser framover
      const mål = Math.atan2(dir.y, dir.x);
      let dv = mål - vinkel; while (dv > Math.PI) dv -= Math.PI * 2; while (dv < -Math.PI) dv += Math.PI * 2;
      vinkel += dv * 0.25;
      const fx = Math.cos(vinkel), fy = Math.sin(vinkel), r = h.r;
      ctx.strokeStyle = '#4c8f35'; ctx.lineWidth = Math.max(2, r * 0.1); ctx.lineCap = 'round';
      for (const sd of [-1, 1]) {
        const bx = h.x + (fx * 0.3 - fy * sd * 0.45) * r, by = h.y + (fy * 0.3 + fx * sd * 0.45) * r;
        const vi = Math.sin(t * 6 + sd) * 0.15;
        const ex = h.x + (fx * 1.05 - fy * sd * 0.85 + vi) * r, ey = h.y + (fy * 1.05 + fx * sd * 0.85 - vi) * r - r * 0.25;
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo((bx + ex) / 2 + fx * r * 0.2, (by + ey) / 2 - r * 0.3, ex, ey); ctx.stroke();
        ctx.fillStyle = '#f2994a'; ctx.beginPath(); ctx.arc(ex, ey, r * 0.17, 0, 7); ctx.fill();
      }
      ctx.fillStyle = '#9be070'; ctx.beginPath(); ctx.arc(h.x, h.y, r, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.arc(h.x - r * 0.3, h.y - r * 0.4, r * 0.32, 0, 7); ctx.fill();
      // kinn
      ctx.fillStyle = 'rgba(240,120,130,.55)';
      for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(h.x + (fx * 0.35 - fy * sd * 0.62) * r, h.y + (fy * 0.35 + fx * sd * 0.62) * r + r * 0.18, r * 0.16, 0, 7); ctx.fill(); }
      // øyne
      const ler = rist > 0;
      for (const sd of [-1, 1]) {
        const ex = h.x + (fx * 0.38 - fy * sd * 0.36) * r, ey = h.y + (fy * 0.38 + fx * sd * 0.36) * r - r * 0.12;
        if (ler) {                       // lukkede, glade øyne
          ctx.strokeStyle = '#2a1d10'; ctx.lineWidth = Math.max(2, r * 0.09);
          ctx.beginPath(); ctx.arc(ex, ey + r * 0.06, r * 0.15, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
        } else {
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, ey, r * 0.22, 0, 7); ctx.fill();
          const blunk = (t % 3.7) < 0.12;
          ctx.fillStyle = '#2a1d10';
          if (blunk) ctx.fillRect(ex - r * 0.15, ey - r * 0.02, r * 0.3, r * 0.05);
          else { ctx.beginPath(); ctx.arc(ex + fx * r * 0.08, ey + fy * r * 0.08, r * 0.12, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + fx * r * 0.08 - r * 0.04, ey + fy * r * 0.08 - r * 0.05, r * 0.045, 0, 7); ctx.fill(); }
        }
      }
      // munn: smil, eller åpen når den spiser og ler
      const mx = h.x + fx * r * 0.62, my = h.y + fy * r * 0.62 + r * 0.12;
      ctx.fillStyle = '#7a2d2d';
      if (gape > 0 || ler) { ctx.beginPath(); ctx.ellipse(mx, my, r * 0.2, r * (0.1 + 0.14 * Math.sin(Math.max(gape, rist) * 18) ** 2), vinkel, 0, 7); ctx.fill(); }
      else { ctx.strokeStyle = '#7a2d2d'; ctx.lineWidth = Math.max(2, r * 0.08); ctx.beginPath(); ctx.arc(h.x + fx * r * 0.35, h.y + fy * r * 0.35, r * 0.32, vinkel - 0.6, vinkel + 0.6); ctx.stroke(); }
      return h;
    }

    api.løkke((dt, t) => {
      sjekkRetning();
      const L = oppsett();
      const nøkkel = api.w + 'x' + api.h + 'x' + kol;
      if (!bak || bakNøkkel !== nøkkel) { bak = lagBakgrunn(L); bakNøkkel = nøkkel; }
      ctx.drawImage(bak, 0, 0, api.w, api.h);
      for (let i = latter.length - 1; i >= 0; i--) { latter[i].t -= dt; if (latter[i].t <= 0) { latter[i].fn(); latter.splice(i, 1); } }
      if (gape > 0) gape -= dt;
      if (rist > 0) rist = Math.max(0, rist - dt);
      if (kiletT > 0) kiletT -= dt;

      if (fase === 'spill') {
        klokke += dt;
        const st = stegTid();
        while (klokke >= st) { klokke -= st; steg(); if (fase !== 'spill') break; }
        nyMatT -= dt;
        if (nyMatT <= 0 && mat.length < 2) { nyMat(); nyMatT = mat.length < 2 ? 0.9 : 0; }
        if (t >= VARIGHET) blinkSommerfugl();
        api.framgang(Math.max(spist / MÅL, t / VARIGHET));
      } else sluttT += dt;

      // maten vugger litt
      for (const m of mat) {
        m.t += dt;
        const inn = Math.min(1, m.t / 0.3), sk = inn < 1 ? Math.sin(inn * Math.PI * 0.75) / Math.sin(Math.PI * 0.75) : 1 + Math.sin(m.t * 4) * 0.05;
        const x = L.gx + (m.x + 0.5) * L.s, y = L.gy + (m.y + 0.5) * L.s;
        ctx.fillStyle = 'rgba(70,40,20,.15)'; ctx.beginPath(); ctx.ellipse(x + 2, y + L.s * 0.32, L.s * 0.3 * sk, L.s * 0.1 * sk, 0, 0, 7); ctx.fill();
        api.emoji(m.tegn, x, y - Math.sin(m.t * 3) * L.s * 0.05, L.s * 0.78 * sk, Math.sin(m.t * 2) * 0.1);
      }
      // larven, klippet til teppet så den kan gå ut på én side og inn på den andre
      const k = fase === 'spill' ? klem(klokke / stegTid()) : 1;
      ctx.save();
      ctx.beginPath(); ctx.rect(L.gx - L.s * 0.45, L.gy - L.s * 0.45, kol * L.s + L.s * 0.9, rad * L.s + L.s * 0.9); ctx.clip();
      let hode = null;
      const kopier = [[0, 0]];            // kopier ved kanten, så den glir ut på én side og inn på den andre
      if (kropp.some((p) => p.x === 0)) kopier.push([kol, 0]);
      if (kropp.some((p) => p.x === kol - 1)) kopier.push([-kol, 0]);
      if (kropp.some((p) => p.y === 0)) kopier.push([0, rad]);
      if (kropp.some((p) => p.y === rad - 1)) kopier.push([0, -rad]);
      for (const [ox, oy] of kopier) {
        if (ox || oy) { ctx.save(); ctx.beginPath(); ctx.rect(L.gx, L.gy, kol * L.s, rad * L.s); ctx.clip(); }
        const L2 = { s: L.s, gx: L.gx + ox * L.s, gy: L.gy + oy * L.s };
        const h = tegnLarve(L2, t, k);
        if (!ox && !oy) hode = h; else ctx.restore();
      }
      ctx.restore();

      // slutten: larven trekker seg sammen, og en sommerfugl flyr opp
      if (fase === 'puppe' && hode) {
        const n = kropp.length, tOmform = n * 0.05 + 0.35;
        if (sluttT > tOmform && !sommerfugl) {
          sommerfugl = { x: hode.x, y: hode.y, t: 0 };
          api.sprut(hode.x, hode.y, '✨', 10); api.sprut(hode.x, hode.y, '#f3a7c0', 10);
          lyd.hopp(); latter.push({ t: 0.25, fn: () => lyd.sus() });
        }
      }
      if (sommerfugl) {
        const b = sommerfugl; b.t += dt;
        const k2 = b.t, størr = L.s * (0.6 + Math.min(1, k2 / 0.4) * 1.6);
        const x = b.x + Math.sin(k2 * 3) * L.s * 1.2, y = b.y - Math.pow(Math.max(0, k2 - 0.4), 1.5) * api.h * 0.32;
        gnistT -= dt;
        if (gnistT <= 0) { gnistT = 0.12; api.sprut(x, y + størr * 0.3, ['#f3a7c0', '#f6c86a', '#8fcfbe', '#a9a3e3'][Math.floor(k2 * 8) % 4], 2); }
        ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(k2 * 3) * 0.25); ctx.scale(0.55 + 0.45 * Math.abs(Math.sin(k2 * 13)), 1);
        api.emoji('🦋', 0, 0, størr);
        ctx.restore();
        if (k2 > 2.6 && !ferdig) { ferdig = true; api.ferdig({ stjerner: spist >= 13 ? 3 : spist >= 7 ? 2 : 1, poeng: spist }); }
      }
    });

    return {
      // trykk i retningen mot nærmeste mat, eller null når larven er på vei dit
      hint() {
        if (fase !== 'spill' || !mat.length) return null;
        const h = kropp[0];
        let best = null, bd = 1e9;
        for (const m of mat) {
          let dx = m.x - h.x, dy = m.y - h.y;
          if (dx > kol / 2) dx -= kol; if (dx < -kol / 2) dx += kol; if (dy > rad / 2) dy -= rad; if (dy < -rad / 2) dy += rad;
          const d = Math.abs(dx) + Math.abs(dy);
          if (d < bd) { bd = d; best = { dx, dy }; }
        }
        const { dx, dy } = best;
        const v = ønsket || dir;
        if ((v.x && Math.sign(dx) === v.x) || (v.y && Math.sign(dy) === v.y)) return null;
        let r;
        if (dir.x) r = dy ? { x: 0, y: Math.sign(dy) } : { x: 0, y: h.y < rad / 2 ? 1 : -1 };   // maten ligger rett bak: sving rundt
        else r = dx ? { x: Math.sign(dx), y: 0 } : { x: h.x < kol / 2 ? 1 : -1, y: 0 };
        if (ønsket && ønsket.x === r.x && ønsket.y === r.y) return null;
        const L = oppsett(), p = hodePos(L), tr = api.trygg;
        const rom = r.x > 0 ? api.w - tr.høyre - 4 - p.x : r.x < 0 ? p.x - tr.venstre - 4 : r.y > 0 ? api.h - tr.bunn - 4 - p.y : p.y - tr.topp - 4;
        const a = Math.max(8, Math.min(L.s * 2.5, rom));
        return { x: p.x + r.x * a, y: p.y + r.y * a, vent: 150 };
      },
      tilstand() { return { spist, lengde: kropp.length, fase, kol, rad }; },
      stopp() { latter.length = 0; },
    };
  },
};

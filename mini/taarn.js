// Klossetårnet (sjanger: stabling med timing). En kloss glir fram og tilbake; trykk for å slippe den på tårnet.
// Det som stikker utenfor faller av. Nesten perfekt treff beholder bredden. Kan ikke tapes: bom gir en ny kloss i full bredde.
export default {
  id: 'taarn', navn: 'Klossetårnet', ikon: '🧱', rom: 'Barnerommet', hjelp: 'trykk', poengIkon: '⭐', bakgrunn: '#cfe6f5', hjelpEtter: 4,
  start(api) {
    const { ctx, lyd } = api;
    const ANTALL = 20, MAKS_TID = 85;
    const W0 = 4.2;                      // full bredde i klossehøyder
    const PERFEKT = 0.3;                 // så nær midten (i klossehøyder) gir perfekt treff
    const FARGER = [['#ef6b5e', '#f8a39a', '#c04d42'], ['#f7c844', '#fbe08f', '#c99a1c'], ['#5cb85c', '#9bdc9b', '#3e8e3e'],
      ['#4f9bd9', '#9cc8ef', '#336fa3'], ['#b06fd8', '#d3a9ef', '#7f48a6'], ['#f2924a', '#f8c093', '#c26a28']];
    const tårn = [];                     // { x, b, f, pynt, sq }
    const biter = [];                    // avkappede biter som faller
    let kloss = null;                    // den som glir eller faller
    let slipp = 0, gode = 0, rekke = 0, poeng = 0, kamY = 0, ristT = 0, ferdigT = -1, sidenNy = 0, nøtteT = -1;
    let bredde = W0;
    // bunnen av tårnet: en bred trekasse som står på teppet
    tårn.push({ x: 0, b: W0 + 0.6, f: -1, pynt: 0, sq: 0 });

    function mål() {
      const t = api.trygg;
      const BH = Math.max(26, Math.min(50, Math.min(api.h * 0.085, api.w * 0.11)));
      const base = api.h - t.bunn - 0.6 * BH;            // gulvet i skjermpunkter når kamY = 0
      return { BH, base, cx: api.w / 2 };
    }
    const skjermY = (m, wy) => m.base - (wy - kamY) * m.BH;     // verdens-y (klossehøyder opp fra gulvet) til skjerm

    function nyKloss() {
      const n = slipp;
      kloss = { x: -3.4, b: bredde, f: (n + 1) % FARGER.length, pynt: n % 4, fart: Math.min(5.2, 3.0 + n * 0.12), retn: 1, y: 0, vy: 0, fase: 'glir', sq: 0 };
      if (n % 2) { kloss.x = 3.4; kloss.retn = -1; }
      sidenNy = 0;
    }
    nyKloss();

    function toppY() { return tårn.length; }            // neste kloss lander på denne høyden (bunnkassa er nr 0)
    function slippKloss() {
      if (!kloss || kloss.fase !== 'glir' || ferdigT >= 0) return;
      kloss.fase = 'faller'; kloss.y = toppY() + 1.6; kloss.vy = 0;
      lyd.klikk();
    }
    function lande(m) {
      const k = kloss, topp = tårn[tårn.length - 1];
      const off = k.x - topp.x;
      slipp++;
      const venstre = Math.max(k.x - k.b / 2, topp.x - topp.b / 2), høyre = Math.min(k.x + k.b / 2, topp.x + topp.b / 2);
      const sy = skjermY(m, toppY() + 0.5);
      if (Math.abs(off) <= PERFEKT) {                    // nesten perfekt: legges rett over, beholder bredden
        k.x = topp.x;
        const nb = topp.f < 0 ? k.b : Math.min(k.b, topp.b + 1.0);   // aldri mye bredere enn klossen under
        if (nb < k.b - 0.05) { for (const sd of [-1, 1]) biter.push({ x: k.x + sd * (nb / 2 + (k.b - nb) / 4), y: toppY() + 0.5, b: (k.b - nb) / 2, f: k.f, vx: sd * 1.5, vy: 2, rot: 0, vr: sd * 2.5 }); }
        tårn.push({ x: k.x, b: nb, f: k.f, pynt: k.pynt, sq: 1 }); bredde = nb;
        gode++; poeng++; api.poeng(poeng);
        lyd.tone([0, 2, 4, 5, 7, 9, 11, 12, 14, 16][Math.min(9, rekke++)]);
        api.sprut(m.cx, sy, '✨', 7); api.sprut(m.cx - k.b * m.BH / 2, sy, '#fff6b0', 5); api.sprut(m.cx + k.b * m.BH / 2, sy, '#fff6b0', 5);
      } else if (høyre - venstre > 0.15) {               // delvis treff: det som stikker ut faller av
        const nb = høyre - venstre, nx = (venstre + høyre) / 2;
        const bitB = k.b - nb, bitX = off > 0 ? høyre + bitB / 2 : venstre - bitB / 2;
        biter.push({ x: bitX, y: toppY() + 0.5, b: bitB, f: k.f, vx: off > 0 ? 1.5 : -1.5, vy: 2, rot: 0, vr: off > 0 ? 2.5 : -2.5 });
        tårn.push({ x: nx, b: nb, f: k.f, pynt: k.pynt, sq: 1 });
        bredde = nb; rekke = 0;
        lyd.dunk();
        api.sprut(m.cx + (nx - kamX()) * m.BH, sy + 0.4 * m.BH, '#ffffff', 5);
      } else {                                           // bom: klossen detter ned, tårnet står
        biter.push({ x: k.x, y: toppY() + 0.5, b: k.b, f: k.f, vx: off > 0 ? 2 : -2, vy: 1, rot: 0, vr: off > 0 ? 3 : -3 });
        rekke = 0; ristT = 0.4; bredde = W0;
        lyd.hmm();
      }
      // hver 5. kloss blir neste litt bredere igjen
      if (slipp % 5 === 0 && bredde < W0) { bredde = Math.min(W0, bredde + 0.9); lyd.pling(); }
      kloss = null;
      api.framgang(slipp / ANTALL);
      if (slipp >= ANTALL) { ferdigT = 0; return; }
      setTimeout(() => { if (ferdigT < 0) nyKloss(); }, 260);
    }
    // tårnet kan stå litt skjevt; kameraet følger midten av toppen
    let kx = 0;
    function kamX() { return kx; }

    api.peker((e) => { if (e.type === 'ned') slippKloss(); });

    // ---------------------------------------------------------------- bakgrunn: barnerommet, taket og himmelen
    // himmelfarger i jevne bånd, laget én gang
    const HF0 = [159, 214, 245], HF1 = [52, 70, 140], HIMMELFARGE = [];
    for (let i = 0; i < 16; i++) { const k = i / 15; HIMMELFARGE.push('rgb(' + HF0.map((v, j) => Math.round(v + (HF1[j] - v) * k)).join(',') + ')'); }
    let TAK = 11.5, HIMMEL = 13.6;
    function tegnBakgrunn(m) {
      const { BH, cx } = m, w = api.w, h = api.h;
      // rommet er minst så høyt som skjermen, så man ser at tårnet vokser forbi hylla, vinduet og taket
      TAK = Math.max(11, Math.min(15, (h - api.trygg.bunn) / BH * 0.8 + 1.5)); HIMMEL = TAK + 2.1;
      const yv = (wy) => skjermY(m, wy);
      const halv = w / 2 / BH;
      const xv = (wx) => cx + (wx - kx * 0.4) * BH;      // bakgrunnen følger tårnets skjevhet bare litt
      const V = -Math.min(9.6, halv), H = Math.min(9.6, halv);   // venstre og høyre vegg-kant i klossehøyder
      // himmel i bånd
      const sTop = yv(HIMMEL);
      if (sTop > 0) {
        for (let i = 0; i < HIMMELFARGE.length; i++) {
          const y0 = yv(HIMMEL + i * 1.4 + 1.4), y1 = yv(HIMMEL + i * 1.4);
          if (y1 < 0 || y0 > h) continue;
          ctx.fillStyle = HIMMELFARGE[i]; ctx.fillRect(0, Math.max(0, y0), w, y1 - Math.max(0, y0) + 1);
        }
        const øverst = yv(HIMMEL + HIMMELFARGE.length * 1.4);
        if (øverst > 0) { ctx.fillStyle = HIMMELFARGE[HIMMELFARGE.length - 1]; ctx.fillRect(0, 0, w, øverst + 1); }
        // skyer, fugler, sol, stjerner og måne høyt oppe
        for (let i = 0; i < 6; i++) {
          const sx = ((i * 197 + api.tid * (8 + i * 3)) % (w + 240)) - 120, sy = yv(HIMMEL + 1.5 + i * 2.6);
          if (sy < -60 || sy > h + 60) continue;
          ctx.fillStyle = 'rgba(255,255,255,.9)';
          ctx.beginPath(); ctx.ellipse(sx, sy, 1.3 * BH, 0.45 * BH, 0, 0, 7); ctx.ellipse(sx + 0.6 * BH, sy - 0.3 * BH, 0.8 * BH, 0.45 * BH, 0, 0, 7); ctx.ellipse(sx - 0.6 * BH, sy - 0.15 * BH, 0.6 * BH, 0.35 * BH, 0, 0, 7); ctx.fill();
        }
        api.emoji('🐦', ((api.tid * 40) % (w + 100)) - 50, yv(HIMMEL + 4.5) + Math.sin(api.tid * 6) * 4, 0.9 * BH);
        api.emoji('🎈', xv(V + 1.2), yv(HIMMEL + 9.5) + Math.sin(api.tid * 1.5) * 6, 1.2 * BH);
        api.emoji('🌙', xv(H - 1.4), yv(HIMMEL + 13), 1.5 * BH);
        for (let i = 0; i < 18; i++) {
          const sy = yv(HIMMEL + 12 + (i * 37 % 11) * 0.8), sx = ((i * 131) % 997) / 997 * w;
          if (sy < 0 || sy > h) continue;
          ctx.fillStyle = 'rgba(255,255,230,' + (0.5 + 0.5 * Math.sin(api.tid * 3 + i)) + ')'; ctx.fillRect(sx, sy, 3, 3);
        }
      }
      // taket utenfra: takstein
      const t0 = yv(HIMMEL), t1 = yv(TAK);
      if (t1 > 0 && t0 < h) {
        ctx.fillStyle = '#b5523b'; ctx.fillRect(0, t0, w, t1 - t0);
        const rh = (t1 - t0) / 4;
        for (let r = 0; r < 4; r++) {
          ctx.fillStyle = r % 2 ? '#a3462f' : '#c25e45'; ctx.fillRect(0, t0 + r * rh, w, rh - 2);
          ctx.fillStyle = 'rgba(0,0,0,.18)';
          for (let x = (r % 2) * 0.6 * BH; x < w; x += 1.2 * BH) ctx.fillRect(x, t0 + r * rh, 2, rh);
        }
        ctx.fillStyle = '#7a3524'; ctx.fillRect(0, t0 - 0.2 * BH, w, 0.25 * BH);
        // takvindu med lys og en pipe
        api.emoji('🪟', xv(V + 1.3), t0 + (t1 - t0) * 0.5, 1.3 * BH);
        ctx.fillStyle = '#8c3a2a'; ctx.fillRect(xv(H - 1.6), t0 - 1.6 * BH, 0.9 * BH, 1.6 * BH);
        ctx.fillStyle = '#6e2c20'; ctx.fillRect(xv(H - 1.7), t0 - 1.75 * BH, 1.1 * BH, 0.25 * BH);
      }
      // veggen i barnerommet
      const v0 = yv(TAK), v1 = yv(0);
      if (v1 > 0 && v0 < h) {
        ctx.fillStyle = '#cfe6f5'; ctx.fillRect(0, v0, w, v1 - v0);
        // tapet med små stjerner og prikker
        ctx.fillStyle = 'rgba(255,255,255,.55)';
        for (let ry = 0; ry < TAK - 0.8; ry += 1.3) for (let i = -8; i <= 8; i++) {
          const px = xv(i * 1.6 + (Math.round(ry / 1.3) % 2) * 0.8), py = yv(ry + 0.6);
          if (px < -10 || px > w + 10 || py < v0 || py > v1) continue;
          ctx.beginPath(); ctx.arc(px, py, 0.1 * BH, 0, 7); ctx.fill();
        }
        // taklist
        ctx.fillStyle = '#fffaf0'; ctx.fillRect(0, v0, w, 0.3 * BH);
        // vindu
        const ww = Math.min(3.2, halv * 0.6) * BH, wh = 3.6 * BH, wx0 = xv(V + 0.7), wy0 = yv(TAK * 0.72);
        ctx.fillStyle = '#fffaf0'; api.rundRekt(wx0 - 0.2 * BH, wy0 - 0.2 * BH, ww + 0.4 * BH, wh + 0.4 * BH, 6); ctx.fill();
        ctx.fillStyle = '#a9dcf5'; ctx.fillRect(wx0, wy0, ww, wh);
        ctx.fillStyle = '#7cc46a'; ctx.beginPath(); ctx.ellipse(wx0 + ww * 0.4, wy0 + wh, ww * 0.7, wh * 0.25, 0, Math.PI, 0); ctx.fill();
        api.emoji('🌳', wx0 + ww * 0.7, wy0 + wh * 0.62, 1.6 * BH);
        ctx.fillStyle = '#fffaf0'; ctx.fillRect(wx0 + ww / 2 - 0.08 * BH, wy0, 0.16 * BH, wh); ctx.fillRect(wx0, wy0 + wh / 2 - 0.08 * BH, ww, 0.16 * BH);
        ctx.fillStyle = '#f4a6c0'; ctx.fillRect(wx0 - 0.6 * BH, wy0 - 0.4 * BH, 0.7 * BH, wh + 0.9 * BH); ctx.fillRect(wx0 + ww - 0.1 * BH, wy0 - 0.4 * BH, 0.7 * BH, wh + 0.9 * BH);
        // hylle med leker
        const hx = xv(H - 4.3), hy = yv(TAK * 0.47);
        ctx.fillStyle = '#c08a58'; ctx.fillRect(hx, hy, 4 * BH, 0.25 * BH);
        ctx.fillStyle = '#9b6b43'; ctx.fillRect(hx + 0.4 * BH, hy + 0.25 * BH, 0.15 * BH, 0.5 * BH); ctx.fillRect(hx + 3.45 * BH, hy + 0.25 * BH, 0.15 * BH, 0.5 * BH);
        api.emoji('🧸', hx + 0.8 * BH, hy - 0.55 * BH, 1.1 * BH); api.emoji('🚀', hx + 2 * BH, hy - 0.55 * BH, 1.0 * BH); api.emoji('🦕', hx + 3.2 * BH, hy - 0.55 * BH, 1.1 * BH);
        // bilde og hengende stjerneuro
        const bx = V + (halv > 7 ? 2.6 : 0.5), by = TAK * 0.42;
        ctx.fillStyle = '#f7c844'; api.rundRekt(xv(bx), yv(by), 2 * BH, 1.5 * BH, 6); ctx.fill();
        ctx.fillStyle = '#fffaf0'; ctx.fillRect(xv(bx + 0.15), yv(by - 0.15), 1.7 * BH, 1.2 * BH);
        api.emoji('🌈', xv(bx + 1), yv(by - 0.75), 1.0 * BH);
        ctx.strokeStyle = '#8a6a4a'; ctx.lineWidth = 1.5; ctx.beginPath(); const ux = H - 1.6, uy = TAK - 2.2;
        ctx.moveTo(xv(ux), v0); ctx.lineTo(xv(ux), yv(uy)); ctx.moveTo(xv(ux - 1), yv(uy)); ctx.lineTo(xv(ux + 1), yv(uy)); ctx.stroke();
        api.emoji('⭐', xv(ux - 1), yv(uy - 0.6) + Math.sin(api.tid * 2) * 3, 0.7 * BH); api.emoji('🌙', xv(ux + 1), yv(uy - 0.6) + Math.sin(api.tid * 2 + 1) * 3, 0.7 * BH);
        // seng nederst til venstre
        const sx = xv(V - 0.6), sy = yv(0);
        ctx.fillStyle = '#9b6b43'; ctx.fillRect(sx, sy - 2.2 * BH, 0.4 * BH, 2.2 * BH);
        ctx.fillStyle = '#7cb7e6'; api.rundRekt(sx + 0.3 * BH, sy - 1.4 * BH, 4.2 * BH, 1.0 * BH, 8); ctx.fill();
        ctx.fillStyle = '#fffaf0'; api.rundRekt(sx + 0.5 * BH, sy - 1.75 * BH, 1.4 * BH, 0.6 * BH, 8); ctx.fill();
        ctx.fillStyle = '#9b6b43'; ctx.fillRect(sx + 0.3 * BH, sy - 0.45 * BH, 4.2 * BH, 0.45 * BH);
        // kommode til høyre
        const kx0 = xv(H - 3.2);
        ctx.fillStyle = '#f2d2a9'; api.rundRekt(kx0, sy - 2.2 * BH, 3 * BH, 2.2 * BH, 6); ctx.fill();
        ctx.fillStyle = '#e8bf8a'; for (let i = 0; i < 3; i++) api.rundRekt(kx0 + 0.25 * BH, sy - 2.0 * BH + i * 0.68 * BH, 2.5 * BH, 0.55 * BH, 4), ctx.fill();
        ctx.fillStyle = '#9b6b43'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(kx0 + 1.5 * BH, sy - 1.72 * BH + i * 0.68 * BH, 0.08 * BH, 0, 7); ctx.fill(); }
        api.emoji('🪀', kx0 + 0.7 * BH, sy - 2.6 * BH, 0.8 * BH); api.emoji('📚', kx0 + 2.1 * BH, sy - 2.6 * BH, 0.9 * BH);
      }
      // gulv med rundt teppe
      if (v1 < h) {
        ctx.fillStyle = '#d7a86e'; ctx.fillRect(0, v1, w, h - v1);
        ctx.fillStyle = 'rgba(120,70,30,.15)'; for (let y = v1 + 0.5 * BH; y < h; y += 0.5 * BH) ctx.fillRect(0, y, w, 1.5);
        ctx.fillStyle = '#e58fa8'; ctx.beginPath(); ctx.ellipse(cx, v1 + 0.35 * BH, 4.8 * BH, 0.55 * BH, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#f7c6d4'; ctx.beginPath(); ctx.ellipse(cx, v1 + 0.35 * BH, 3.6 * BH, 0.38 * BH, 0, 0, 7); ctx.fill();
      }
    }
    // ---------------------------------------------------------------- klossene
    function tegnKloss(m, x, yTopp, b, f, pynt, sq, rot) {
      const { BH } = m;
      const pw = b * BH, ph = BH;
      ctx.save();
      ctx.translate(x, yTopp + ph);                       // nederst på midten, så klem skjer mot underlaget
      if (rot) ctx.rotate(rot);
      if (sq) ctx.scale(1 + sq * 0.12, 1 - sq * 0.18);
      if (f < 0) {                                         // bunnkassa
        ctx.fillStyle = '#a8743f'; api.rundRekt(-pw / 2, -ph, pw, ph, 6); ctx.fill();
        ctx.fillStyle = '#c08a58'; ctx.fillRect(-pw / 2 + 4, -ph + 4, pw - 8, ph * 0.3);
        ctx.fillStyle = '#7a5032'; for (let i = -2; i <= 2; i++) ctx.fillRect(i * pw / 5 - 1, -ph + 4, 2, ph - 8);
        ctx.restore(); return;
      }
      const F = FARGER[f];
      ctx.fillStyle = F[2]; api.rundRekt(-pw / 2, -ph, pw, ph, Math.min(8, ph * 0.22)); ctx.fill();
      ctx.fillStyle = F[0]; api.rundRekt(-pw / 2, -ph, pw, ph * 0.86, Math.min(8, ph * 0.22)); ctx.fill();
      ctx.fillStyle = F[1]; api.rundRekt(-pw / 2 + 3, -ph + 3, pw - 6, ph * 0.22, 4); ctx.fill();
      const midt = -ph * 0.45;
      if (pynt === 0 && pw > ph * 1.1) {                   // fjes
        ctx.fillStyle = '#2a1d10';
        ctx.beginPath(); ctx.arc(-ph * 0.28, midt - ph * 0.05, ph * 0.08, 0, 7); ctx.arc(ph * 0.28, midt - ph * 0.05, ph * 0.08, 0, 7); ctx.fill();
        ctx.strokeStyle = '#2a1d10'; ctx.lineWidth = Math.max(1.5, ph * 0.06); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(0, midt + ph * 0.02, ph * 0.16, 0.2, Math.PI - 0.2); ctx.stroke();
        ctx.fillStyle = 'rgba(255,120,120,.5)'; ctx.beginPath(); ctx.arc(-ph * 0.48, midt + ph * 0.08, ph * 0.08, 0, 7); ctx.arc(ph * 0.48, midt + ph * 0.08, ph * 0.08, 0, 7); ctx.fill();
      } else if (pynt === 1) {                             // prikker
        ctx.fillStyle = 'rgba(255,255,255,.6)';
        for (let px = -pw / 2 + ph * 0.4; px < pw / 2 - ph * 0.2; px += ph * 0.55) { ctx.beginPath(); ctx.arc(px, midt + ph * 0.05, ph * 0.1, 0, 7); ctx.fill(); }
      } else if (pynt === 2) {                             // striper
        ctx.fillStyle = 'rgba(255,255,255,.35)';
        for (let px = -pw / 2 + ph * 0.3; px < pw / 2 - ph * 0.15; px += ph * 0.5) ctx.fillRect(px, -ph * 0.7, ph * 0.18, ph * 0.5);
      } else if (pw > ph * 0.9) api.emoji(['⭐', '❤️', '🌼'][f % 3], 0, midt + ph * 0.03, ph * 0.55);
      ctx.restore();
    }

    api.løkke((dt, t) => {
      const m = mål(), { BH } = m;
      sidenNy += dt;
      // klossen glir eller faller
      if (kloss) {
        if (kloss.fase === 'glir') {
          const ytre = Math.max(1.6, Math.min(3.6, api.w / 2 / BH - kloss.b / 2 - 0.15));   // holder seg inne på skjermen
          kloss.x += kloss.fart * kloss.retn * dt;
          if (kloss.x > kx + ytre) { kloss.x = kx + ytre; kloss.retn = -1; }
          if (kloss.x < kx - ytre) { kloss.x = kx - ytre; kloss.retn = 1; }
        } else {
          kloss.vy -= 60 * dt; kloss.y += kloss.vy * dt;
          if (kloss.y <= toppY()) { kloss.y = toppY(); lande(m); }
        }
      }
      // kamera: toppen av tårnet ligger rundt midten av skjermen
      const mål_ = Math.max(0, toppY() + 1 - (api.h * 0.52) / BH + (ferdigT >= 0 ? 1.5 : 0));
      kamY += (mål_ - kamY) * Math.min(1, dt * 3);
      const toppX = tårn[tårn.length - 1].x;
      kx += (toppX * 0.6 - kx) * Math.min(1, dt * 2);
      for (const k of tårn) if (k.sq > 0) k.sq = Math.max(0, k.sq - dt * 5);
      if (ristT > 0) ristT -= dt;

      tegnBakgrunn(m);
      const rist = ristT > 0 ? Math.sin(ristT * 60) * ristT * 8 : 0;
      const sx = (wx) => m.cx + (wx - kx) * BH + rist;
      // skygge under tårnet
      ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.beginPath(); ctx.ellipse(sx(0), skjermY(m, 0), (W0 / 2 + 0.6) * BH, 0.18 * BH, 0, 0, 7); ctx.fill();
      // tårnet (bare det som synes), med en liten vugging når det er ferdig
      const vugg = ferdigT >= 0 ? Math.sin(ferdigT * 6) * 0.012 * Math.max(0, 1 - ferdigT / 2) : 0;
      for (let i = 0; i < tårn.length; i++) {
        const yTopp = skjermY(m, i + 1);
        if (yTopp > api.h + BH || yTopp < -BH) continue;
        const k = tårn[i];
        tegnKloss(m, sx(k.x) + vugg * i * BH, yTopp, k.b, k.f, k.pynt, k.sq, 0);
      }
      // avkappede biter
      for (let i = biter.length - 1; i >= 0; i--) {
        const b = biter[i];
        b.vy -= 30 * dt; b.y += b.vy * dt; b.x += b.vx * dt; b.rot += b.vr * dt;
        const yy = skjermY(m, b.y + 1);
        if (yy > api.h + 2 * BH) { biter.splice(i, 1); continue; }
        tegnKloss(m, sx(b.x), yy, b.b, b.f, 3, 0, b.rot);
      }
      // klossen som glir: med en stiplet sikte-skygge rett ned på tårnet
      if (kloss) {
        const ky = kloss.fase === 'glir' ? toppY() + 1.6 + Math.sin(t * 5) * 0.06 : kloss.y;
        const topp = tårn[tårn.length - 1];
        if (kloss.fase === 'glir') {
          const over = Math.abs(kloss.x - topp.x) <= PERFEKT;
          ctx.fillStyle = over ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.25)';
          ctx.fillRect(sx(kloss.x) - kloss.b * BH / 2, skjermY(m, toppY() + 1.6), kloss.b * BH, 1.6 * BH - 0.05 * BH);
        }
        tegnKloss(m, sx(kloss.x), skjermY(m, ky + 1), kloss.b, kloss.f, kloss.pynt, 0, 0);
      }
      // ferdig: Nøtte klatrer opp på toppen og jubler
      if (ferdigT >= 0) {
        ferdigT += dt;
        const k = Math.min(1, ferdigT / 0.6);
        const topp = tårn[tårn.length - 1];
        const ny = skjermY(m, toppY()) - 0.8 * BH - Math.sin(Math.PI * k) * 2 * BH - (k >= 1 ? Math.abs(Math.sin(ferdigT * 7)) * 0.4 * BH : 0);
        api.emoji('🐿️', sx(topp.x) + (1 - k) * 3 * BH, ny, 1.7 * BH);
        if (ferdigT > 0.6 && ferdigT - dt <= 0.6) { lyd.fanfare(); api.sprut(sx(topp.x), ny, '⭐', 8); api.sprut(sx(topp.x), ny, '#f5d33c', 10); }
        if (ferdigT > 2.6) api.ferdig({ stjerner: gode >= 12 ? 3 : gode >= 6 ? 2 : 1, poeng });
      } else if (t > MAKS_TID) { ferdigT = 0; kloss = null; }   // ingen trykk lenge: runden slutter pent likevel
    });

    return {
      hint() {
        if (!kloss || kloss.fase !== 'glir' || ferdigT >= 0) return null;
        const topp = tårn[tårn.length - 1];
        const om = kloss.x + kloss.fart * kloss.retn * 0.07;     // der klossen er når trykket kommer fram
        if (Math.abs(om - topp.x) > PERFEKT * 0.6) return null;
        const m = mål();
        return { x: api.w / 2, y: Math.min(api.h - api.trygg.bunn - 40, skjermY(m, toppY() + 0.5)), vent: 350 };
      },
      tilstand() { return { slipp, gode, bredde: +bredde.toFixed(2), høyde: tårn.length - 1 }; },
    };
  },
};

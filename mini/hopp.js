// Opp i eika (sjanger: hopp oppover fra plattform til plattform). Nøtte spretter av seg selv fra grein til grein;
// barnet styrer sidelengs ved å holde eller dra fingeren (Nøtte følger fingerens x). Kan ikke tapes: faller Nøtte, tar en fugl den.
export default {
  id: 'hopp', navn: 'Opp i eika', ikon: '🌳', rom: 'Terrassen', hjelp: 'dra', poengIkon: '🌰', bakgrunn: '#9fd3f2', hjelpEtter: 3,
  start(api) {
    const { ctx, lyd } = api;
    const KB = 7;                    // spillsøylens bredde i U
    const TOPP = 120;               // toppen av treet i U
    const G = 30, V0 = 15.6;         // sprett ca. 4 U høyt
    const MAKS_TID = 78;             // etter dette hjelper fuglen Nøtte helt opp
    const greiner = [], nøtter = [];
    let x = KB / 2, y = 0, vy = V0 * 0.8, mål = null, kamY = 0, sqX = 1, sqY = 1, retning = 1;
    let poeng = 0, rekke = 0, høyestGrein = 0, sistY = 0, redning = null, slutt = false, sluttT = 0, heis = false;
    // ---- bygg treet: bakken (terrassen), greiner oppover, krona øverst
    greiner.push({ x: KB / 2, y: 0, b: KB + 2, type: 'bakke' });
    let gx = KB / 2, gy = 0, nr = 0;
    while (gy < TOPP - 4) {
      gy += 2.2 + api.rnd() * 0.8;
      let nx = gx + (api.rnd() * 2 - 1) * 2.8;
      if (nx < 1.3 || nx > KB - 1.3) nx = gx - (nx - gx);
      nx = Math.max(1.3, Math.min(KB - 1.3, nx));
      nr++;
      const svinger = gy > 25 && api.rnd() < 0.22;
      const kasse = !svinger && nr % 7 === 0;
      greiner.push({ x: nx, x0: nx, y: gy, b: svinger ? 1.9 : 2.1 + api.rnd() * 0.6, type: svinger ? 'huske' : 'grein', kasse, fase: api.rnd() * 6, side: nx < KB / 2 ? -1 : 1 });
      // nøtter: én midt mellom greinene, iblant en liten søyle over greina
      if (gy < 6.5) { gx = nx; continue; }                    // ingen nøtter helt nede (runden starter med 0)
      if (api.rnd() < 0.45) { nøtter.push({ x: nx, y: gy + 1.5, tatt: 0 }); nøtter.push({ x: nx, y: gy + 2.4, tatt: 0 }); }
      else nøtter.push({ x: (gx + nx) / 2, y: gy - 1.1, tatt: 0 });
      gx = nx;
    }
    greiner.push({ x: KB / 2, y: TOPP, b: KB + 2, type: 'krone' });
    const muligeNøtter = nøtter.length;

    function mål_() {                // skjermmål, regnes hver ramme
      const C = Math.min(api.w, Math.max(api.h * 0.95, 340));
      const U = C / KB, x0 = (api.w - C) / 2;
      const bunn = api.h - api.trygg.bunn;
      const synH = (bunn - api.trygg.topp) / U;
      return { U, C, x0, bunn, synH };
    }
    const sx = (m, wx) => m.x0 + wx * m.U;
    const sy = (m, wy) => m.bunn - (wy - kamY) * m.U;

    api.peker((e) => {
      if (slutt || heis) return;
      if (e.type === 'ned' || (e.type === 'flytt' && e.nede)) { const m = mål_(); mål = (e.x - m.x0) / m.U; }
      else if (e.type === 'opp') mål = null;
    });

    function landPå(g, m) {
      const boost = g.kasse ? 1.35 : 1; sistY = g.y;
      vy = V0 * boost; y = g.y;
      sqX = 1.35; sqY = 0.68;
      if (g.y > høyestGrein + 0.1) { høyestGrein = g.y; lyd.tone([0, 2, 4, 5, 7, 9, 11, 12][rekke++ % 8]); }
      else lyd.sprett();
      if (g.kasse) { lyd.pling(); api.sprut(sx(m, x), sy(m, y), '🪶', 4); }
      api.sprut(sx(m, x), sy(m, y), g.type === 'bakke' ? '#c8a27a' : '#7fbf5a', 5);
      if (g.type === 'krone') { slutt = true; sluttT = 0; lyd.fanfare(); api.sprut(sx(m, x), sy(m, y) - m.U, '⭐', 8); }
    }
    function støttePunkt() {         // greina Nøtte sist sto på (eller nærmeste under)
      let best = greiner[0];
      for (const g of greiner) if (g.y <= y + 0.05 && g.y > best.y) best = g;
      return best;
    }
    function nesteGrein() {          // en grein over som kan nås med neste sprett
      const fraY = sistY;                                    // greina Nøtte sist spratt fra
      let best = null;
      for (const g of greiner) {
        if (g.y <= fraY + 0.6 || g.y > fraY + 3.6) continue;
        const verdi = g.y - (g.type === 'huske' ? 3 : 0);      // så høyt som mulig, men helst ikke en huske som flytter seg
        if (!best || verdi > best.verdi) best = { g, verdi };
      }
      return best && best.g;
    }

    // ---------------------------------------------------------------- bakgrunnen: himmel, åser, huset, terrassen
    let himmel = null, himmelH = 0;
    function lagHimmel() {
      himmel = ctx.createLinearGradient(0, 0, 0, api.h);
      himmel.addColorStop(0, '#6fb8ea'); himmel.addColorStop(0.7, '#b9e2f7'); himmel.addColorStop(1, '#e6f5fb');
      himmelH = api.h;
    }
    function tegnBakgrunn(m) {
      const { U } = m, w = api.w, h = api.h;
      if (!himmel || himmelH !== h) lagHimmel();
      ctx.fillStyle = himmel; ctx.fillRect(0, 0, w, h);
      // fjerne åser og skog (beveger seg nesten ikke)
      const ay = (wy) => m.bunn - (wy - 10.6 + m.synH * 0.6 - kamY * 0.02) * U;     // horisonten står nesten stille
      ctx.fillStyle = '#8fbf8a'; ctx.beginPath(); ctx.moveTo(0, h);
      for (let i = 0; i <= 12; i++) ctx.lineTo(i * w / 12, ay(12.5 + Math.sin(i * 1.7) * 0.9 + Math.sin(i * 0.6) * 0.8));
      ctx.lineTo(w, h); ctx.fill();
      ctx.fillStyle = '#6aa56b'; ctx.beginPath(); ctx.moveTo(0, h);
      for (let i = 0; i <= 16; i++) ctx.lineTo(i * w / 16, ay(11.4 + Math.sin(i * 2.3 + 1) * 0.5));
      ctx.lineTo(w, h); ctx.fill();
      ctx.fillStyle = '#7fb7d8'; ctx.fillRect(0, ay(10.6), w, ay(9.8) - ay(10.6) + 1);       // fjorden
      ctx.fillStyle = '#a7cf86'; ctx.fillRect(0, ay(9.8), w, Math.max(0, h - ay(9.8)));         // jorder og hager
      ctx.fillStyle = '#5f9a55';
      for (let i = 0; i < 14; i++) { const tx = (i * 0.137 % 1) * w, ty = ay(9.6 - (i % 4) * 0.9); ctx.beginPath(); ctx.arc(tx, ty, 0.5 * U, 0, 7); ctx.arc(tx + 0.4 * U, ty + 0.15 * U, 0.4 * U, 0, 7); ctx.fill(); }
      // huset (sakte parallakse): vegg med vinduer, så taket
      const hy = (wy) => m.bunn - (wy - kamY * 0.16) * U;
      const hr = m.x0 + m.C * 0.42;                      // husets høyre hjørne
      const vegg = hy(14), bakke = hy(0);
      if (hy(22) < h) {
        ctx.fillStyle = '#e9e1d3'; ctx.fillRect(-2, vegg, hr + 2, bakke - vegg);
        ctx.fillStyle = 'rgba(120,100,80,.18)'; for (let px = hr - 0.35 * U; px > 0; px -= 0.35 * U) ctx.fillRect(px, vegg, 1.5, bakke - vegg);
        for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) {
          const wx = hr - 1.6 * U - k * 2.4 * U, wy = hy(3 + r * 4);
          if (wx < -2 * U) continue;
          ctx.fillStyle = '#fffaf0'; ctx.fillRect(wx - 0.1 * U, wy - 0.1 * U, 1.2 * U, 1.7 * U);
          ctx.fillStyle = '#8ec9ea'; ctx.fillRect(wx, wy, U, 1.5 * U);
          ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(wx + 0.1 * U, wy + 0.1 * U, 0.25 * U, 1.3 * U);
        }
        // tak: skråner opp mot venstre, med pipe
        ctx.fillStyle = '#4b4f58'; ctx.beginPath(); ctx.moveTo(hr + 0.6 * U, vegg); ctx.lineTo(-2, hy(21)); ctx.lineTo(-2, vegg); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 2;
        for (let i = 1; i < 6; i++) { const k = i / 6; ctx.beginPath(); ctx.moveTo(hr + 0.6 * U - k * (hr + 0.6 * U), vegg + (hy(21) - vegg) * k); ctx.lineTo(-2, vegg + (hy(21) - vegg) * k); ctx.stroke(); }
        ctx.fillStyle = '#7a4b3a'; const px = hr * 0.35; ctx.fillRect(px, hy(19.6) , 0.9 * U, hy(17.2) - hy(19.6) + 0.5 * U);
        ctx.fillStyle = '#3a3d44'; ctx.fillRect(hr - 0.2, vegg - 0.15 * U, 0.8 * U, 0.3 * U);
      }
      // terrassen nederst (følger kameraet fullt)
      const ty = sy(m, 0);
      if (ty < h + U) {
        ctx.fillStyle = '#b07c4f'; ctx.fillRect(0, ty, w, h - ty + 2);
        ctx.fillStyle = 'rgba(70,40,20,.25)'; for (let py = ty + 0.35 * U; py < h; py += 0.35 * U) ctx.fillRect(0, py, w, 1.5);
        // rekkverk
        ctx.fillStyle = '#9a6a42'; ctx.fillRect(0, ty - 1.3 * U, w, 0.18 * U);
        for (let px = 0.2 * U; px < w; px += 0.55 * U) ctx.fillRect(px, ty - 1.3 * U, 0.12 * U, 1.3 * U);
        api.emoji('🪴', sx(m, KB - 0.6), ty - 0.55 * U, 1.1 * U);
      }
    }
    // stammen, greinene og krona
    function tegnTre(m, t) {
      const { U } = m, h = api.h;
      const tx = sx(m, KB / 2);
      const bølge = (wy) => Math.sin(wy * 0.23) * 0.22 * U + Math.sin(wy * 0.071 + 1) * 0.15 * U;
      const topp = Math.max(-10, sy(m, TOPP - 1)), bunn = Math.min(h + 10, sy(m, 0));
      if (bunn > topp) {
        const bw = 1.3 * U;
        // stammen svinger litt og er tykkest nederst
        const tykk = (wy) => bw * (1 + Math.max(0, 1.6 - wy) * 0.35) * (1 - wy / TOPP * 0.35);
        const fraY = Math.max(0, kamY - 1), tilY = Math.min(TOPP - 1, kamY + h / U + 1);
        ctx.fillStyle = '#6b4a2f'; ctx.beginPath();
        for (let wy = fraY; wy <= tilY + 0.01; wy += 0.5) ctx.lineTo(tx + bølge(wy) - tykk(wy) / 2, sy(m, wy));
        for (let wy = tilY; wy >= fraY - 0.01; wy -= 0.5) ctx.lineTo(tx + bølge(wy) + tykk(wy) / 2, sy(m, wy));
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#5a3d26';
        const s0 = Math.floor(kamY / 1.1) - 1;
        for (let i = s0; i < s0 + 14 + h / U; i++) { const yy = sy(m, i * 1.1); if (yy < topp || yy > bunn) continue; const bx = tx + bølge(i * 1.1); ctx.fillRect(bx - bw * 0.3 + ((i * 37) % 5) * 2, yy, 3, 0.7 * U); ctx.fillRect(bx + bw * 0.1 - ((i * 13) % 4) * 2, yy + 0.4 * U, 3, 0.6 * U); }
              }
      for (const g of greiner) {
        const gy = sy(m, g.y);
        if (gy < -2 * U || gy > h + 2 * U) continue;
        if (g.type === 'bakke') continue;
        if (g.type === 'krone') { tegnKrone(m, gy, t); continue; }
        const gx = sx(m, g.x), bw = g.b * U;
        if (g.type === 'huske') {                         // huske i tau fra greina over
          ctx.strokeStyle = '#8a6a4a'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(gx - bw * 0.4, gy); ctx.lineTo(sx(m, g.x0) - bw * 0.3, gy - 2.2 * U); ctx.moveTo(gx + bw * 0.4, gy); ctx.lineTo(sx(m, g.x0) + bw * 0.3, gy - 2.2 * U); ctx.stroke();
          ctx.fillStyle = '#c0864f'; api.rundRekt(gx - bw / 2, gy - 0.05 * U, bw, 0.28 * U, 5); ctx.fill();
          ctx.fillStyle = '#e0a86e'; ctx.fillRect(gx - bw / 2 + 4, gy, bw - 8, 0.07 * U);
          continue;
        }
        // lem fra stammen ut til greina
        const inn = g.side < 0 ? gx + bw * 0.45 : gx - bw * 0.45;
        ctx.strokeStyle = '#6b4a2f'; ctx.lineCap = 'round';
        ctx.lineWidth = 0.32 * U; ctx.beginPath(); const lx = tx + bølge(g.y - 0.9); ctx.moveTo(lx, gy + 0.9 * U); ctx.quadraticCurveTo((lx + inn) / 2, gy + 0.2 * U, inn, gy + 0.08 * U); ctx.stroke();
        // selve greina med blader
        ctx.fillStyle = '#7a5434'; api.rundRekt(gx - bw / 2, gy - 0.02 * U, bw, 0.24 * U, 0.12 * U); ctx.fill();
        ctx.fillStyle = '#5c9e45';
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(gx - bw / 2 + (i + 0.5) * bw / 4, gy + 0.22 * U, 0.38 * U, 0.2 * U, (i - 1.5) * 0.3, 0, 7); ctx.fill(); }
        ctx.fillStyle = '#79bd57';
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(gx - bw / 2 + (i + 1) * bw / 4, gy + 0.05 * U, 0.3 * U, 0.15 * U, (i - 1) * 0.4, 0, 7); ctx.fill(); }
        if (g.kasse) {                                   // fuglekasse: gir ekstra sprett
          const kx = gx, ky = gy - 0.62 * U, bob = Math.sin(t * 6 + g.fase) * 0.03 * U;
          ctx.fillStyle = '#e8554e'; ctx.beginPath(); ctx.moveTo(kx - 0.55 * U, ky - 0.3 * U + bob); ctx.lineTo(kx, ky - 0.75 * U + bob); ctx.lineTo(kx + 0.55 * U, ky - 0.3 * U + bob); ctx.fill();
          ctx.fillStyle = '#f2d2a9'; ctx.fillRect(kx - 0.42 * U, ky - 0.32 * U + bob, 0.84 * U, 0.88 * U);
          ctx.fillStyle = '#4a3423'; ctx.beginPath(); ctx.arc(kx, ky + 0.05 * U + bob, 0.17 * U, 0, 7); ctx.fill();
          api.emoji('🐤', kx, ky + 0.05 * U + bob, 0.3 * U);
          ctx.fillStyle = '#f5d33c'; api.rundRekt(kx - 0.5 * U, ky + 0.5 * U, U, 0.1 * U, 3); ctx.fill();
        }
      }
    }
    function tegnKrone(m, gy, t) {
      const { U } = m, cx = sx(m, KB / 2);
      ctx.fillStyle = '#4f8f3c';
      for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(cx + (i - 4) * 0.9 * U, gy + 0.6 * U + Math.abs(i - 4) * 0.25 * U, 1.0 * U, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#6fb04f';
      for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.arc(cx + (i - 3) * 0.95 * U, gy + 0.15 * U + Math.abs(i - 3) * 0.2 * U, 0.7 * U, 0, 7); ctx.fill(); }
      // reir med eikenøtter øverst
      ctx.fillStyle = '#8a5a32'; ctx.beginPath(); ctx.ellipse(cx, gy - 0.05 * U, 1.3 * U, 0.4 * U, 0, 0, 7); ctx.fill();
      for (let i = 0; i < 5; i++) api.emoji('🌰', cx + (i - 2) * 0.45 * U, gy - 0.3 * U - (i % 2) * 0.15 * U, 0.55 * U, (i - 2) * 0.3);
      api.emoji('⭐', cx, gy - 1.6 * U - Math.sin(t * 3) * 0.15 * U, 0.9 * U, Math.sin(t * 2) * 0.2);
    }
    function tegnNøtte(m, t) {
      const { U } = m;
      let px = sx(m, x);
      const py = sy(m, y);
      ctx.save(); ctx.translate(px, py);
      const strekk = vy > 0 ? Math.min(0.15, vy * 0.012) : 0;
      ctx.scale(-retning * sqX * (1 - strekk * 0.5), sqY * (1 + strekk));
      api.emoji('🐿️', 0, -0.62 * U, 1.3 * U);
      ctx.restore();
      // går rundt i sidene: tegn også på andre siden når Nøtte er ved kanten
      if (x < 0.6) { ctx.save(); ctx.translate(px + m.C, py); ctx.scale(-retning, 1); api.emoji('🐿️', 0, -0.62 * U, 1.3 * U); ctx.restore(); }
      if (x > KB - 0.6) { ctx.save(); ctx.translate(px - m.C, py); ctx.scale(-retning, 1); api.emoji('🐿️', 0, -0.62 * U, 1.3 * U); ctx.restore(); }
    }

    // ---------------------------------------------------------------- løkka
    api.vedStørrelse(() => { himmel = null; });
    api.løkke((dt, t) => {
      const m = mål_(), { U } = m;
      for (const g of greiner) if (g.type === 'huske') g.x = g.x0 + Math.sin(t * 1.3 + g.fase) * 1.0;
      if (!slutt && !heis && t > MAKS_TID) { heis = true; redning = { fase: 'inn', t: 0, mot: TOPP, x0: x, y0: y }; lyd.plopp(); }
      if (slutt) {
        sluttT += dt;
        y = TOPP + Math.abs(Math.sin(sluttT * 6)) * 0.6; x += (KB / 2 - x) * Math.min(1, dt * 4);
        if (sluttT > 2.6) api.ferdig({ stjerner: poeng >= muligeNøtter * 0.55 ? 3 : poeng >= muligeNøtter * 0.3 ? 2 : 1, poeng });
      } else if (redning) {
        // en vennlig fugl henter Nøtte og løfter den opp til en grein
        redning.t += dt;
        if (redning.fase === 'inn') {
          y = Math.max(y, kamY + 0.4); vy = 0;
          if (redning.t > 0.55) { redning.fase = 'løft'; redning.t = 0; redning.x0 = x; redning.y0 = y; if (!heis) { const g = målGrein(); redning.mot = g.y; redning.mx = g.x; } else redning.mx = KB / 2; lyd.hopp(); }
        } else {
          const varighet = heis ? 3.2 : 0.9;
          const k = Math.min(1, redning.t / varighet), e = k * k * (3 - 2 * k);
          x = redning.x0 + (redning.mx - redning.x0) * e; y = redning.y0 + (redning.mot + 0.5 - redning.y0) * e;
          if (k >= 1) { const g = støttePunkt(); redning = null; heis = false; vy = -1; y = g.y + 0.3; if (g.type === 'krone') { y = TOPP; landPå(g, m); } }
        }
      } else {
        // styring: Nøtte følger fingeren mykt
        if (mål !== null) {
          const d = mål - x, v = Math.max(-11, Math.min(11, d * 7));
          x += v * dt; if (Math.abs(d) > 0.1) retning = d > 0 ? 1 : -1;
        }
        if (x < 0) x += KB; if (x > KB) x -= KB;
        const før = y;
        vy -= G * dt; y += vy * dt;
        if (vy < 0) {
          for (const g of greiner) {
            if (før >= g.y && y <= g.y && Math.abs(x - g.x) <= g.b / 2 + 0.45) { landPå(g, m); break; }
          }
        }
        if (y < kamY - 1.2) { redning = { fase: 'inn', t: 0 }; rekke = 0; lyd.hmm(); }
      }
      sqX += (1 - sqX) * Math.min(1, dt * 9); sqY += (1 - sqY) * Math.min(1, dt * 9);
      // kameraet går bare oppover
      const ønsket = Math.min(TOPP - m.synH * 0.62, y - m.synH * 0.38, redning ? 1e9 : sistY - 0.8);   // greina Nøtte sist sto på forsvinner aldri under kanten
      if (ønsket > kamY) kamY += (ønsket - kamY) * Math.min(1, dt * (heis ? 8 : 4));
      // nøtter
      for (const n of nøtter) {
        if (n.tatt) { n.tatt += dt; continue; }
        if (!redning && Math.abs(n.x - x) < 0.65 && Math.abs(n.y - (y + 0.6)) < 0.75) {
          n.tatt = 0.001; poeng++; api.poeng(poeng); lyd.mynt();
          api.sprut(sx(m, n.x), sy(m, n.y), '#f5d33c', 5);
        }
      }
      // tegning
      tegnBakgrunn(m);
      tegnTre(m, t);
      for (const n of nøtter) {
        const py = sy(m, n.y);
        if (py < -U || py > api.h + U) continue;
        if (n.tatt) { if (n.tatt < 0.3) api.emoji('🌰', sx(m, n.x), py - n.tatt * 3 * U, 0.65 * U, 0, 1 - n.tatt / 0.3); continue; }
        api.emoji('🌰', sx(m, n.x), py + Math.sin(t * 3 + n.y) * 0.06 * U, 0.65 * U, Math.sin(t * 2 + n.x) * 0.25);
      }
      tegnNøtte(m, t);
      if (redning) {
        const bx = redning.fase === 'inn' ? sx(m, x) + (1 - redning.t / 0.55) * api.w * 0.6 : sx(m, x);
        const by = sy(m, y) - 1.55 * U - (redning.fase === 'inn' ? (1 - redning.t / 0.55) * 2 * U : 0);
        ctx.save(); ctx.translate(bx, by + Math.sin(t * 18) * 3); ctx.scale(1, 1);
        api.emoji('🕊️', 0, 0, 1.4 * U); ctx.restore();
      }
      // blader som daler i forgrunnen
      for (let i = 0; i < 4; i++) {
        const lx = ((i * 211 + t * (14 + i * 5)) % (api.w + 80)) - 40, ly = ((i * 157 + t * (30 + i * 8)) % (api.h + 80)) - 40;
        api.emoji('🍂', lx + Math.sin(t * 2 + i) * 18, ly, 0.45 * U, Math.sin(t * 3 + i));
      }
      api.framgang(Math.max(0, Math.min(1, høyestGrein / TOPP)));
    });
    function målGrein() {            // nærmeste grein som synes over bunnen av skjermen
      let best = null, bd = 1e9;
      for (const g of greiner) {
        if (g.type === 'krone' || g.y < kamY + 1.0) continue;
        const d = (g.y - kamY) + Math.abs(g.x - x) * 0.3;
        if (d < bd) { bd = d; best = g; }
      }
      return best || greiner[greiner.length - 1];
    }

    return {
      hint() {
        if (slutt || redning || heis) return null;
        const g = nesteGrein();
        if (!g) return null;
        const m = mål_();
        const gx = sx(m, g.x), yy = Math.max(api.trygg.topp + 40, Math.min(api.h - api.trygg.bunn - 40, sy(m, g.y) + 0.6 * m.U));
        if (Math.abs(g.x - x) < 0.35) return null;      // står allerede rett under
        return { x: gx, y: yy, hold: 650, vent: 40 };
      },
      tilstand() { return { poeng, muligeNøtter, høyde: +høyestGrein.toFixed(1), y: +y.toFixed(1), redning: !!redning }; },
    };
  },
};

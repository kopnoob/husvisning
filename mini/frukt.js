// Fruktbollen (sjanger: slipp og slå sammen). Sikt sidelengs og slipp frukt i bollen; to like som møtes blir én større.
// Kan ikke tapes: blir bollen full, triller de øverste fruktene over kanten og forsvinner. Runden: 75 s eller til vannmelonen er laget.
export default {
  id: 'frukt', navn: 'Fruktbollen', ikon: '🍓', rom: 'Kjøkkenet', hjelp: 'dra', poengIkon: '🍓', bakgrunn: '#f4e7cf', hjelpEtter: 4,
  start(api) {
    const { ctx, lyd } = api;
    const FRUKT = ['🫐', '🍓', '🍋', '🍊', '🍎', '🍐', '🍍', '🍉'];
    const R = [5, 6.6, 8.3, 10, 12, 14.2, 17, 20.5];                 // radius i bolle-enheter (bollen er 120 bred)
    const FARGE = ['#5867d8', '#e8344e', '#f5d33c', '#f28c28', '#d9302c', '#b5cf3a', '#e9b23a', '#3fae49'];
    const POENG = [0, 2, 4, 7, 11, 16, 24, 40];
    const BW = 120, BH = 88, RAD = BW / 2, MX = BW / 2, CY = BH - RAD, T = 4.5;            // bollen: loddrette sider ned til CY, så en halvsirkel
    const TOPP = 30;                                                        // plass over bollen til frukten som henger
    const VARIGHET = 75;
    const frukter = [];                                                     // { k, x, y, vx, vy, r, rot, alder, pop, ut, over }
    let poeng = 0, størst = 0, neste = 0, etter = 1, siktX = 60, klar = 0.3, sluttT = 0, kjede = 0, kjedeT = 0, slipp = 0, glimt = 0;
    let bg = null, bgKey = '';

    function trekk() {                                                      // de fire minste fruktene, små oftest
      const u = api.rnd();
      return u < 0.36 ? 0 : u < 0.67 ? 1 : u < 0.88 ? 2 : 3;
    }
    neste = trekk() > 1 ? 0 : trekk(); etter = trekk();

    function geo() {                                                        // skjermplassering, regnes ut på nytt hver gang
      const t = api.trygg;
      const x0 = t.venstre + 6, x1 = api.w - t.høyre - 6, y0 = t.topp, y1 = api.h - t.bunn;
      const høyde = TOPP + BH + T + 14;
      const s = Math.min((x1 - x0) / (BW + 2 * T + 8), (y1 - y0) / høyde);
      const ox = (x0 + x1) / 2 - BW / 2 * s;
      const oy = y1 - (BH + T + 14) * s;
      return { s, ox, oy, slippY: oy - (TOPP - 13) * s, benk: oy + (BH + T + 7) * s, x0, x1 };
    }
    const sx = (g, x) => g.ox + x * g.s, sy = (g, y) => g.oy + y * g.s;

    // ---------------------------------------------------------------- bakgrunn (lages én gang per skjermstørrelse)
    function lagBg(g) {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const c = document.createElement('canvas');
      c.width = Math.round(api.w * dpr); c.height = Math.round(api.h * dpr);
      const x = c.getContext('2d'); x.scale(dpr, dpr);
      const W = api.w, H = api.h, benk = g.benk;
      // flislagt vegg
      x.fillStyle = '#f4e7cf'; x.fillRect(0, 0, W, benk);
      const fh = Math.max(16, Math.round(g.s * 6.5)), fw = fh * 2;
      x.fillStyle = '#fbf3e3';
      for (let r = 0, y = benk - fh; y > -fh; r++, y -= fh) {
        for (let xx = (r % 2 ? -fw / 2 : 0); xx < W; xx += fw) { x.beginPath(); x.roundRect ? x.roundRect(xx + 1.5, y + 1.5, fw - 3, fh - 3, 3) : x.rect(xx + 1.5, y + 1.5, fw - 3, fh - 3); x.fill(); }
      }
      // vindu med eika ute (bare når det er plass ved siden av bollen)
      const venstreLedig = g.ox - T * g.s - g.x0, høyreLedig = g.x1 - (g.ox + (BW + T) * g.s);
      const spr = (tegn, px, cx, cy) => { const sp = api.sprite(tegn, px); x.drawImage(sp, cx - sp._s / 2, cy - sp._s / 2, sp._s, sp._s); };
      function vindu(vx, vy, vw, vh) {
        x.fillStyle = '#fff'; x.fillRect(vx - 8, vy - 8, vw + 16, vh + 16);
        const gr = x.createLinearGradient(0, vy, 0, vy + vh); gr.addColorStop(0, '#8fd0f2'); gr.addColorStop(1, '#d9f1fb');
        x.fillStyle = gr; x.fillRect(vx, vy, vw, vh);
        x.fillStyle = '#86c66a'; x.fillRect(vx, vy + vh * 0.72, vw, vh * 0.28);
        spr('🌳', vh * 0.6, vx + vw * 0.3, vy + vh * 0.5);
        spr('☁️', vh * 0.24, vx + vw * 0.72, vy + vh * 0.2);
        x.fillStyle = '#fff'; x.fillRect(vx + vw / 2 - 3, vy, 6, vh); x.fillRect(vx, vy + vh / 2 - 3, vw, 6);
        x.fillStyle = '#e8d6b4'; x.fillRect(vx - 14, vy + vh + 8, vw + 28, 8);
      }
      const høyreKant = g.ox + (BW + T) * g.s;
      if (høyreLedig > 190) {                                             // liggende: vinduet til høyre for bollen
        const vx = høyreKant + 80, vw = Math.min(g.x1 - vx - 30, 240), vh = Math.min(benk - api.trygg.topp - 70, vw * 0.85);
        if (vw > 90 && vh > 70) vindu(vx, Math.max(api.trygg.topp + 10, benk - vh - 60), vw, vh);
      } else {                                                             // stående: vinduet over bollen
        const y0 = api.trygg.topp + 14, fri = g.slippY - 50 - y0, vh = Math.min(fri, 240), vw = Math.min(vh * 1.25, (g.x1 - g.x0) - 120);
        if (vh > 70) vindu(api.w / 2 - vw / 2, y0 + (fri - vh) * 0.45, vw, vh);
      }
      // benkeplate i eik og skapdører
      x.fillStyle = '#c99a62'; x.fillRect(0, benk, W, H - benk);
      x.fillStyle = '#b5864f'; x.fillRect(0, benk + 9, W, 3);
      x.fillStyle = '#ddb37a'; x.fillRect(0, benk, W, 4);
      const dør = benk + 16;
      if (H - dør > 20) {
        x.fillStyle = '#9fb59a'; x.fillRect(0, dør, W, H - dør);
        const dw = Math.max(110, W / Math.round(W / 160));
        for (let xx = 0; xx < W; xx += dw) {
          x.fillStyle = '#b3c7ae'; x.fillRect(xx + 5, dør + 6, dw - 10, H - dør);
          x.fillStyle = '#e6d3a8'; x.fillRect(xx + dw / 2 - 18, dør + 16, 36, 6);
        }
      }
      // ting på benken på sidene
      const fot = benk + 2;
      if (venstreLedig > 120) {
        x.fillStyle = '#b07a43'; x.beginPath(); x.ellipse(g.x0 + venstreLedig * 0.42, fot - 4, Math.min(80, venstreLedig * 0.34), 9, 0, 0, 7); x.fill();
        spr('🥖', Math.min(70, venstreLedig * 0.3), g.x0 + venstreLedig * 0.42, fot - 18);
        spr('🫖', Math.min(76, venstreLedig * 0.3), g.x0 + venstreLedig * 0.82, fot - Math.min(76, venstreLedig * 0.3) * 0.36);
      }
      if (høyreLedig > 120) {
        spr('🪴', Math.min(80, høyreLedig * 0.3), g.x1 - høyreLedig * 0.2, fot - Math.min(80, høyreLedig * 0.3) * 0.4);
        spr('🧂', Math.min(44, høyreLedig * 0.18), g.x1 - høyreLedig * 0.56, fot - Math.min(44, høyreLedig * 0.18) * 0.38);
      }
      // bollens skygge på benken
      x.fillStyle = 'rgba(80,50,20,.18)';
      x.beginPath(); x.ellipse(sx(g, MX), benk + 2, (RAD + T) * g.s * 0.8, 6 + g.s, 0, 0, 7); x.fill();
      return c;
    }

    function bollebane(g, r, ytre) {                                       // U-formen, innvendig (r = RAD) eller utvendig
      const k = r - RAD;
      ctx.moveTo(sx(g, -k), sy(g, ytre ? -1.5 : 0));
      ctx.lineTo(sx(g, -k), sy(g, CY));
      ctx.arc(sx(g, MX), sy(g, CY), r * g.s, Math.PI, 0, true);
      ctx.lineTo(sx(g, BW + k), sy(g, ytre ? -1.5 : 0));
    }

    // ---------------------------------------------------------------- fysikk i bolle-enheter
    function nyFrukt(k, x, y, vx, vy, pop) {
      const f = { k, x, y, vx: vx || 0, vy: vy || 0, r: R[k], rot: (api.rnd() - 0.5) * 0.6, alder: 0, pop: pop ? 0 : 1, ut: 0, over: 0, død: false };
      frukter.push(f);
      return f;
    }
    function slå(a, b) {
      a.død = b.død = true;
      const k = a.k + 1;
      const f = nyFrukt(k, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.vx + b.vx) / 2, Math.min(a.vy, b.vy) * 0.5 - 30, true);
      f.r = (R[a.k] + R[k]) / 2;
      poeng += POENG[k]; api.poeng(poeng);
      kjede = kjedeT > 0 ? kjede + 1 : 0; kjedeT = 1.1;
      if (k > størst) { størst = k; glimt = 1; }
      const g = geo();
      api.sprut(sx(g, f.x), sy(g, f.y), FARGE[k], 8 + k);
      api.sprut(sx(g, f.x), sy(g, f.y), '✨', 2 + (k >> 1));
      lyd.pop();
      lyd.tone(Math.min(24, k * 2 + kjede * 2 + 2));
      if (k === 7) { sluttT = 2.2; lyd.fanfare(); api.sprut(sx(g, f.x), sy(g, f.y), '⭐', 12); }
    }
    function fysikk(dt) {
      const N = 4, h = dt / N, G = 280, E = 0.12;
      for (let st = 0; st < N; st++) {
        for (const f of frukter) {
          if (f.ut) { f.vy += G * h; f.x += f.vx * h; f.y += f.vy * h; f.rot += f.vx * 0.02 * h; continue; }
          f.vy += G * h; f.vx *= 0.997; f.vy *= 0.997;
          f.x += f.vx * h; f.y += f.vy * h;
          f.rot += f.vx / f.r * h;
          if (f.pop < 1) f.r = R[f.k] * (0.82 + 0.18 * Math.min(1, f.pop / 0.12));
        }
        for (let it = 0; it < 2; it++) {
          for (let i = 0; i < frukter.length; i++) {
            const a = frukter[i];
            if (a.ut || a.død) continue;
            for (let j = i + 1; j < frukter.length; j++) {
              const b = frukter[j];
              if (b.ut || b.død) continue;
              const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r;
              if (dx * dx + dy * dy >= rr * rr) continue;
              const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
              if (a.k === b.k && a.k < 7 && a.alder > 0.04 && b.alder > 0.04 && !sluttT) { slå(a, b); break; }
              const nx = dx / d, ny = dy / d, ov = rr - d;
              const ma = a.r * a.r, mb = b.r * b.r, sum = ma + mb;
              a.x -= nx * ov * mb / sum; a.y -= ny * ov * mb / sum;
              b.x += nx * ov * ma / sum; b.y += ny * ov * ma / sum;
              const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
              if (vn < 0) {
                const j2 = -(1 + E) * vn / (1 / ma + 1 / mb);
                a.vx -= j2 * nx / ma; a.vy -= j2 * ny / ma; b.vx += j2 * nx / mb; b.vy += j2 * ny / mb;
                // litt friksjon langs berøringen så haugen roer seg
                const tx = -ny, ty = nx, vt = (b.vx - a.vx) * tx + (b.vy - a.vy) * ty;
                const jt = vt * 0.08 / (1 / ma + 1 / mb);
                a.vx += jt * tx / ma; a.vy += jt * ty / ma; b.vx -= jt * tx / mb; b.vy -= jt * ty / mb;
              }
            }
          }
          for (const f of frukter) if (!f.ut && !f.død) vegg(f, E);
        }
        for (let i = frukter.length - 1; i >= 0; i--) if (frukter[i].død) frukter.splice(i, 1);
      }
    }
    function vegg(f, E) {
      if (f.x < 0 || f.x > BW) {                                            // utenfor kanten: renner over
        if (f.y < CY) { f.ut = 0.0001; f.vx += f.x < 0 ? -25 : 25; lyd.sus(); }
        return;
      }
      if (f.y > CY) {
        const dx = f.x - MX, dy = f.y - CY, d = Math.hypot(dx, dy) || 0.01;
        if (d + f.r > RAD) {
          const nx = dx / d, ny = dy / d;
          f.x = MX + nx * (RAD - f.r); f.y = CY + ny * (RAD - f.r);
          const vn = f.vx * nx + f.vy * ny;
          if (vn > 0) { f.vx -= (1 + E) * vn * nx; f.vy -= (1 + E) * vn * ny; f.vx *= 0.985; f.vy *= 0.985; }
        }
      } else if (f.y >= 0) {
        if (f.x - f.r < 0) { f.x = f.r; if (f.vx < 0) f.vx = -f.vx * E; f.vy *= 0.99; }
        if (f.x + f.r > BW) { f.x = BW - f.r; if (f.vx > 0) f.vx = -f.vx * E; f.vy *= 0.99; }
      }
      if (f.y < 0.5) {                                                       // kanten på bollen er to små avrundinger
        for (const kx of [0, BW]) {
          const dx = f.x - kx, dy = f.y, d = Math.hypot(dx, dy) || 0.01, rr = f.r + 1.2;
          if (d < rr) {
            const nx = dx / d, ny = dy / d;
            f.x = kx + nx * rr; f.y = ny * rr;
            const vn = f.vx * nx + f.vy * ny;
            if (vn < 0) { f.vx -= (1 + E) * vn * nx; f.vy -= (1 + E) * vn * ny; }
          }
        }
      }
    }

    function slippFrukt() {
      if (klar > 0 || sluttT || api.tid > VARIGHET - 1.2) return;
      const k = neste;
      nyFrukt(k, Math.max(R[k], Math.min(BW - R[k], siktX)), -R[k] - 3, 0, 40);
      neste = etter; etter = trekk(); klar = 0.45; slipp = 1;
      lyd.plopp();
    }
    function sikt(e) {
      const g = geo();
      const k = neste;
      siktX = Math.max(R[k], Math.min(BW - R[k], (e.x - g.ox) / g.s));
    }
    api.peker((e) => {
      if (e.type === 'ned') sikt(e);
      else if (e.type === 'flytt' && e.nede) sikt(e);
      else if (e.type === 'opp') { sikt(e); slippFrukt(); }
    });

    // ---------------------------------------------------------------- tegning
    function tegnFrukt(g, k, x, y, d, rot, alfa) {                          // d = diameter i skjermpunkter
      const px = Math.round(R[k] * 2 * g.s * 1.12);
      const sp = api.sprite(FRUKT[k], px), side = sp._s * d / px;
      if (alfa !== undefined) ctx.globalAlpha = alfa;
      ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot);
      ctx.drawImage(sp, -side / 2, -side / 2, side, side);
      ctx.restore();
      if (alfa !== undefined) ctx.globalAlpha = 1;
    }

    api.løkke((dt, t) => {
      const g = geo();
      const key = api.w + 'x' + api.h + 'x' + g.s.toFixed(3);
      if (key !== bgKey) { bg = lagBg(g); bgKey = key; }
      klar -= dt; kjedeT -= dt; slipp = Math.max(0, slipp - dt * 4); glimt = Math.max(0, glimt - dt * 1.5);
      fysikk(dt);
      for (const f of frukter) {
        f.alder += dt; if (f.pop < 1) f.pop += dt;
        if (f.ut) f.ut += dt;
        // ligger frukten over kanten og står stille: dytt den forsiktig over kanten
        if (!f.ut && f.alder > 1 && f.y - f.r < -1.5) {
          f.over += dt;
          if (f.over > 1.8) f.vx += (f.x < MX ? -1 : 1) * 70 * dt;
        } else f.over = Math.max(0, f.over - dt);
      }
      for (let i = frukter.length - 1; i >= 0; i--) if (frukter[i].ut > 1.3 || frukter[i].y > 400) frukter.splice(i, 1);

      ctx.drawImage(bg, 0, 0, api.w, api.h);
      const s = g.s;
      // bollens fot
      ctx.fillStyle = '#356f9c';
      api.rundRekt(sx(g, MX) - 22 * s, sy(g, BH + T - 1), 44 * s, 8 * s, 2 * s); ctx.fill();
      // innsiden av bollen (bak fruktene)
      ctx.fillStyle = '#e7f1f8';
      ctx.beginPath(); bollebane(g, RAD, false); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#d6e6f1';
      ctx.beginPath(); ctx.arc(sx(g, MX), sy(g, CY), (RAD - 6) * s, Math.PI * 0.15, Math.PI * 0.85); ctx.arc(sx(g, MX), sy(g, CY), RAD * s, Math.PI * 0.85, Math.PI * 0.15, true); ctx.fill();
      // siktelinje og frukten som henger
      const k = neste, tom = klar > 0 || sluttT;
      const hx = sx(g, Math.max(R[k], Math.min(BW - R[k], siktX)));
      if (!tom) {
        ctx.fillStyle = 'rgba(255,255,255,.75)';
        const bunn = sy(g, Math.min(CY + RAD, flate(siktX, R[k])));
        for (let y = g.slippY + R[k] * s + 6; y < bunn - 4; y += 11) { ctx.beginPath(); ctx.arc(hx, y, 2.2, 0, 7); ctx.fill(); }
      }
      // alle fruktene
      for (const f of frukter) {
        let sk = 1;
        if (f.pop < 1) { const p = Math.min(1, f.pop / 0.35); sk = 1 + Math.sin(p * Math.PI) * 0.28 * (1 - p * 0.5); }
        tegnFrukt(g, f.k, sx(g, f.x), sy(g, f.y), f.r * 2.16 * s * sk, f.rot, f.ut ? Math.max(0, 1 - f.ut / 1.2) : undefined);
      }
      // bollen foran: skall med glasurstripe og blanke kanter
      ctx.fillStyle = '#4f8fc0';
      ctx.beginPath(); bollebane(g, RAD + T, true); ctx.lineTo(sx(g, BW), sy(g, -1.5));
      ctx.lineTo(sx(g, BW), sy(g, CY)); ctx.arc(sx(g, MX), sy(g, CY), RAD * s, 0, Math.PI); ctx.lineTo(sx(g, 0), sy(g, -1.5)); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#f6f0dc'; ctx.lineWidth = Math.max(2, s * 1.1);
      ctx.beginPath(); ctx.arc(sx(g, MX), sy(g, CY), (RAD + T / 2) * s, Math.PI * 0.2, Math.PI * 0.8); ctx.stroke();
      ctx.fillStyle = '#f6f0dc';
      for (let i = 0; i < 7; i++) { const a = Math.PI * (0.27 + i * 0.077); ctx.beginPath(); ctx.arc(sx(g, MX) + Math.cos(a) * (RAD + T / 2) * s, sy(g, CY) + Math.sin(a) * (RAD + T / 2) * s, s * 0.9, 0, 7); ctx.fill(); }
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      ctx.fillRect(sx(g, -T) + s * 1.2, sy(g, 2), s * 1.2, (CY - 4) * s);
      ctx.fillStyle = '#6aa7d4';
      for (const kx of [-T / 2, BW + T / 2]) { ctx.beginPath(); ctx.arc(sx(g, kx), sy(g, -1.2), T / 2 * s + 1, 0, 7); ctx.fill(); }
      // neste frukt henger over bollen
      if (!tom) {
        const bob = Math.sin(t * 3) * 1.5 - slipp * 6;
        tegnFrukt(g, k, hx, g.slippY + bob, R[k] * 2.16 * s, Math.sin(t * 2) * 0.08);
      }
      // den etter: liten på et fat oppe til høyre
      const fx = Math.min(g.x1 - 30, sx(g, BW + T) + 4 * s + 26), fy = g.slippY;
      ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.arc(fx, fy, 24, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(79,143,192,.6)'; ctx.lineWidth = 2.5; ctx.stroke();
      tegnFrukt(g, etter, fx, fy, Math.min(34, R[etter] * 2 * s * 0.7), 0);
      // største frukt så langt, øverst til venstre over bollen
      if (størst > 0) {
        const gx = Math.max(g.x0 + 30, sx(g, -T) - 4 * s - 26);
        ctx.fillStyle = 'rgba(255,248,225,.85)'; ctx.beginPath(); ctx.arc(gx, fy, 26 + glimt * 6, 0, 7); ctx.fill();
        ctx.strokeStyle = '#f2b632'; ctx.lineWidth = 3; ctx.stroke();
        tegnFrukt(g, størst, gx, fy, 36 * (1 + glimt * 0.3), 0);
      }

      api.framgang(Math.min(1, t / VARIGHET));
      if (sluttT) { sluttT -= dt; if (sluttT <= 0) { sluttT = 0; avslutt(); } }
      else if (t >= VARIGHET) avslutt();
    });
    let ferdig = false;
    function avslutt() {
      if (ferdig) return; ferdig = true;
      api.ferdig({ stjerner: størst >= 6 ? 3 : størst >= 4 ? 2 : 1, poeng });
    }

    // høyden der en frukt med radius r som slippes ved x blir liggende (bolle-enheter)
    function flate(x, r) {
      let y = Math.abs(x - MX) < RAD - r ? CY + Math.sqrt((RAD - r) ** 2 - (x - MX) ** 2) : CY;
      for (const f of frukter) {
        if (f.ut) continue;
        const dx = f.x - x, rr = f.r + r;
        if (Math.abs(dx) < rr) y = Math.min(y, f.y - Math.sqrt(rr * rr - dx * dx));
      }
      return y;
    }

    return {
      hint() {
        if (klar > 0 || sluttT || api.tid > VARIGHET - 1.5) return null;
        const g = geo(), k = neste, rk = R[k];
        let mål = null, best = 1e9;
        for (const f of frukter) {
          if (f.ut || f.k !== k) continue;
          // er frukten fri ovenfra (ingen annen frukt rett over)?
          const fri = !frukter.some((o) => o !== f && !o.ut && o.y < f.y - 1 && Math.abs(o.x - f.x) < o.r + rk * 0.6);
          if (fri && f.y < best) { best = f.y; mål = f.x; }
        }
        if (mål === null) {                                                 // ledig plass: der det ligger lavest
          let dyp = -1e9;
          for (let i = 0; i <= 12; i++) { const x = rk + (BW - 2 * rk) * i / 12, y = flate(x, rk); if (y > dyp + 0.5) { dyp = y; mål = x; } }
        }
        mål = Math.max(rk, Math.min(BW - rk, mål));
        const x = sx(g, Math.max(rk, Math.min(BW - rk, siktX)));
        return { x, y: g.slippY, x2: sx(g, mål), y2: g.slippY, vent: 420 };
      },
      tilstand() { return { poeng, størst, antall: frukter.length }; },
    };
  },
};

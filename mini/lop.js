// Nøtteløpet (sjanger: løpespill med ett trykk). Nøtte løper bortover gulvet i TV-stua; trykk = hopp, hold = høyere hopp.
// Kan ikke tapes: treffer Nøtte et hinder, snubler den og mister litt fart. Runden varer 60 s og ender ved en stor nøtthaug.
export default {
  id: 'lop', navn: 'Nøtteløpet', ikon: '🐿️', rom: 'TV-stua', hjelp: 'trykk', poengIkon: '🌰', bakgrunn: '#f3e3c7', hjelpEtter: 4,
  start(api) {
    const { ctx, lyd } = api;
    const VARIGHET = 60;
    const G = 40, V0 = 11, HOLD_G = 14, HOLD_MAKS = 0.28;   // tyngde, hoppfart og svakere tyngde mens man holder (i U per s)
    const NX = 0.26;                                          // Nøttes plass på skjermen (andel av bredden)
    // ---- tilstand, alle lengder i U (omtrent Nøttes størrelse)
    let x = 0, y = 0, vy = 0, påBakken = true, holder = false, holdT = 0, kø = 0, bakkeT = 0;
    let topp = 0, hoppX = 0, startX = 0, snubleT = 0, fartK = 1, sqX = 1, sqY = 1, løpFase = 0;
    let poeng = 0, muligeNøtter = 0, rekke = 0, nesteHinder = 9, ferdigFase = 0, haugX = null, slutt = false;
    const hindre = [], nøtter = [], treffLogg = [];
    const TYPER = [
      { navn: 'pute', b: 1.1, h: 0.75, høy: false },
      { navn: 'bil', b: 1.1, h: 0.7, høy: false },
      { navn: 'bamse', b: 0.9, h: 1.0, høy: false },
      { navn: 'katt', b: 1.9, h: 0.95, høy: true },
      { navn: 'stabel', b: 1.2, h: 1.4, høy: true },
    ];
    function mål() {                                          // skjermmål, regnes hver ramme (tåler at telefonen snus)
      const t = api.trygg;
      const U = Math.max(40, Math.min(78, Math.min(api.w * 0.15, api.h * 0.13)));
      const gulv = api.h - t.bunn - Math.max(U * 0.9, api.h * 0.1);
      return { U, gulv, nx: api.w * NX };
    }
    const fart = () => (5.6 + Math.min(VARIGHET, api.tid) * 0.045) * fartK;
    const hash = (i) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

    function lagHinder(px) {
      const tidlig = api.tid < 12;
      const valg = tidlig ? TYPER.filter((k) => !k.høy) : TYPER;
      const T = valg[Math.floor(api.rnd() * valg.length)];
      const o = { x: px, b: T.b, h: T.h, navn: T.navn, høy: T.høy, truffet: 0, farge: Math.floor(api.rnd() * 4), vipp: 0, vx: 0, vy: 0, dy: 0 };
      hindre.push(o);
      // nøtter i en bue over hinderet (der hoppet går), og en liten rad på gulvet foran
      const topp = T.høy ? 3.3 : 2.0;
      for (let i = -1; i <= 1; i++) nøtter.push({ x: px + T.b / 2 + i * 1.0, y: topp - Math.abs(i) * 0.55, tatt: 0 });
      muligeNøtter += 3;
      if (api.rnd() < 0.7) { const n = 2 + Math.floor(api.rnd() * 2); for (let i = 0; i < n; i++) nøtter.push({ x: px - 4.2 + i * 0.9, y: 0.5, tatt: 0 }); muligeNøtter += n; }
    }

    function hopp() {
      vy = V0; påBakken = false; holdT = 0; kø = 0; topp = 0; hoppX = x;
      sqX = 0.75; sqY = 1.3;
      lyd.hopp();
      const m = mål();
      api.sprut(m.nx, m.gulv, '#d8b48c', 4);
    }
    api.peker((e) => {
      if (slutt) return;
      if (e.type === 'ned') {
        holder = true;
        if (påBakken || bakkeT < 0.1) hopp(); else kø = 0.14;  // et trykk like før landing teller
      } else if (e.type === 'opp') holder = false;
    });

    // ---------------------------------------------------------------- tegning av stua
    const VEGG = '#f3e3c7', LIST = '#fffaf0';
    function tegnVegg(m, kam) {
      const { U, gulv } = m, w = api.w;
      const bak = gulv - 0.7 * U;                              // der veggen møter gulvet
      ctx.fillStyle = VEGG; ctx.fillRect(0, 0, w, bak);
      // tapetstriper (rolig parallakse)
      const sb = 0.9 * U, off = -((kam * 0.25 * U) % (sb * 2));
      ctx.fillStyle = 'rgba(214,180,130,.18)';
      for (let sx = off; sx < w; sx += sb * 2) ctx.fillRect(sx, 0, sb, bak);
      // vimpelsnor høyt oppe
      const vt = 1.6 * U, vo = -((kam * 0.32 * U) % vt), vy0 = Math.max(api.trygg.topp - 2, bak - 7.2 * U);
      ctx.strokeStyle = '#b08a5a'; ctx.lineWidth = 1.5; ctx.beginPath();
      for (let sx = vo - vt; sx < w + vt; sx += vt) { ctx.moveTo(sx, vy0); ctx.quadraticCurveTo(sx + vt / 2, vy0 + 0.25 * U, sx + vt, vy0); }
      ctx.stroke();
      const VF = ['#e8554e', '#f5d33c', '#4f9bd9', '#3fb36b', '#f2a541', '#b06fd8'];
      for (let sx = vo - vt, i = Math.floor((kam * 0.32 * U) / vt); sx < w + vt; sx += vt, i++) {
        ctx.fillStyle = VF[((i % 6) + 6) % 6];
        const mx = sx + vt / 2, my = vy0 + 0.19 * U;
        ctx.beginPath(); ctx.moveTo(mx - 0.32 * U, my - 0.05 * U); ctx.lineTo(mx + 0.32 * U, my - 0.05 * U); ctx.lineTo(mx, my + 0.55 * U); ctx.closePath(); ctx.fill();
      }
      // bakre lag: vinduer, bilder og klokke (beveger seg sakte)
      const TB = 6.5, k = 0.3, s0 = Math.floor((kam * k - 2) / TB);
      const vTopp = api.trygg.topp + 0.95 * U;                 // under vimpelsnora og knappene
      for (let i = s0; i < s0 + Math.ceil(w / (TB * U)) + 3; i++) {
        const sx = (i * TB - kam * k) * U, r = hash(i), r2 = hash(i + 50);
        if (r < 0.42) { const y0 = Math.max(vTopp, bak - 5.3 * U); tegnVindu(sx + 0.6 * U, y0, 3.0 * U, Math.max(1.6 * U, Math.min(3.4 * U, bak - 0.9 * U - y0)), r2, U); }
        else if (r < 0.8) { const bh = Math.min((1.3 + r2 * 0.5) * U, Math.max(1.1 * U, bak - 1.9 * U - vTopp)); tegnBilde(sx + 1.2 * U, Math.max(vTopp, bak - 4.6 * U - r2 * 0.8 * U), bh * (1.6 + r2) / (1.3 + r2 * 0.5), bh, i, U); }
        else { // klokke
          const rr = 0.7 * U, cx = sx + 2 * U, cy = Math.max(vTopp + rr, bak - 4.6 * U);
          ctx.fillStyle = '#8a5a32'; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, 7); ctx.fill();
          ctx.fillStyle = '#fffaf0'; ctx.beginPath(); ctx.arc(cx, cy, rr * 0.8, 0, 7); ctx.fill();
          ctx.strokeStyle = '#4a3423'; ctx.lineWidth = 3; ctx.lineCap = 'round'; const a = api.tid * 0.6;
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * rr * 0.55, cy + Math.sin(a) * rr * 0.55); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - rr * 0.38); ctx.stroke();
        }
        // et lite ekstra: vegghylle med en ting på, eller et lite bilde høyere opp
        const r3 = hash(i + 77);
        if (r3 < 0.45) {
          const hx = sx + 4.5 * U, hy = Math.max(vTopp + 1.1 * U, bak - 3.0 * U);
          ctx.fillStyle = '#9b6b43'; ctx.fillRect(hx - 0.2 * U, hy, 1.6 * U, 0.16 * U);
          ctx.fillStyle = '#7a5032'; ctx.fillRect(hx, hy + 0.16 * U, 0.1 * U, 0.3 * U); ctx.fillRect(hx + 1.1 * U, hy + 0.16 * U, 0.1 * U, 0.3 * U);
          api.emoji(['🧸', '🪀', '🏺', '📚', '🕯️'][Math.floor(hash(i + 3) * 5)], hx + 0.6 * U, hy - 0.45 * U, 0.9 * U);
        } else if (r3 < 0.8 && bak - 6.2 * U > vTopp) tegnBilde(sx + 4.4 * U, bak - 6.2 * U, 1.3 * U, 1.6 * U, i + 3, U);
        else if (bak - 4.0 * U > vTopp) { // vegglampe
          const lx = sx + 5 * U, ly = bak - 3.6 * U;
          ctx.fillStyle = '#4a3423'; ctx.fillRect(lx - 0.05 * U, ly, 0.1 * U, 0.5 * U);
          ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.moveTo(lx - 0.45 * U, ly + 0.1 * U); ctx.lineTo(lx + 0.45 * U, ly + 0.1 * U); ctx.lineTo(lx + 0.25 * U, ly - 0.5 * U); ctx.lineTo(lx - 0.25 * U, ly - 0.5 * U); ctx.fill();
          ctx.fillStyle = 'rgba(255,230,140,.25)'; ctx.beginPath(); ctx.moveTo(lx - 0.45 * U, ly + 0.1 * U); ctx.lineTo(lx + 0.45 * U, ly + 0.1 * U); ctx.lineTo(lx + 0.9 * U, ly + 1.4 * U); ctx.lineTo(lx - 0.9 * U, ly + 1.4 * U); ctx.fill();
        }
      }
      // fotlist
      ctx.fillStyle = LIST; ctx.fillRect(0, bak - 0.28 * U, w, 0.28 * U);
      ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.fillRect(0, bak - 0.04 * U, w, 0.04 * U);
      return bak;
    }
    function tegnVindu(x0, y0, bw, bh, r, U) {
      ctx.fillStyle = '#fffaf0'; api.rundRekt(x0 - 0.18 * U, y0 - 0.18 * U, bw + 0.36 * U, bh + 0.36 * U, 6); ctx.fill();
      ctx.fillStyle = '#a9dcf5'; ctx.fillRect(x0, y0, bw, bh);
      ctx.fillStyle = '#d4effa'; ctx.fillRect(x0, y0, bw, bh * 0.35);
      ctx.fillStyle = '#8fcf6e'; ctx.beginPath(); ctx.ellipse(x0 + bw * 0.3, y0 + bh, bw * 0.6, bh * 0.28, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#6fb552'; ctx.beginPath(); ctx.ellipse(x0 + bw * 0.85, y0 + bh, bw * 0.5, bh * 0.2, 0, Math.PI, 0); ctx.fill();
      if (r < 0.5) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x0 + bw * 0.62, y0 + bh * 0.25, bw * 0.16, bh * 0.06, 0, 0, 7); ctx.ellipse(x0 + bw * 0.72, y0 + bh * 0.22, bw * 0.12, bh * 0.06, 0, 0, 7); ctx.fill(); }
      else { ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.arc(x0 + bw * 0.75, y0 + bh * 0.25, bw * 0.1, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#fffaf0'; ctx.fillRect(x0 + bw / 2 - 0.07 * U, y0, 0.14 * U, bh); ctx.fillRect(x0, y0 + bh * 0.48, bw, 0.12 * U);
      // gardiner
      ctx.fillStyle = '#e07a5f';
      ctx.beginPath(); ctx.moveTo(x0 - 0.35 * U, y0 - 0.3 * U); ctx.lineTo(x0 + 0.55 * U, y0 - 0.3 * U); ctx.quadraticCurveTo(x0 + 0.1 * U, y0 + bh * 0.6, x0 + 0.25 * U, y0 + bh + 0.3 * U); ctx.lineTo(x0 - 0.35 * U, y0 + bh + 0.3 * U); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x0 + bw + 0.35 * U, y0 - 0.3 * U); ctx.lineTo(x0 + bw - 0.55 * U, y0 - 0.3 * U); ctx.quadraticCurveTo(x0 + bw - 0.1 * U, y0 + bh * 0.6, x0 + bw - 0.25 * U, y0 + bh + 0.3 * U); ctx.lineTo(x0 + bw + 0.35 * U, y0 + bh + 0.3 * U); ctx.fill();
      ctx.fillStyle = '#8a5a32'; ctx.fillRect(x0 - 0.5 * U, y0 - 0.38 * U, bw + U, 0.12 * U);
    }
    const BILDEFARGE = ['#e9a23b', '#4f9bd9', '#3fb36b', '#e8554e'];
    const MOTIV = ['🌳', '🐿️', '🌻', '⛵', '🏡', '🦉'];
    function tegnBilde(x0, y0, bw, bh, i, U) {
      ctx.fillStyle = '#8a5a32'; api.rundRekt(x0, y0, bw, bh, 4); ctx.fill();
      ctx.fillStyle = BILDEFARGE[((i % 4) + 4) % 4]; ctx.fillRect(x0 + 0.14 * U, y0 + 0.14 * U, bw - 0.28 * U, bh - 0.28 * U);
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x0 + 0.14 * U, y0 + bh * 0.62, bw - 0.28 * U, bh * 0.38 - 0.14 * U);
      api.emoji(MOTIV[((i % 6) + 6) % 6], x0 + bw / 2, y0 + bh / 2, Math.min(bw, bh) * 0.55);
    }
    // midtlaget: møbler langs veggen
    function tegnMøbler(m, kam, bak) {
      const { U } = m, w = api.w, k = 0.6, TB = 9, s0 = Math.floor((kam * k - 6) / TB);
      for (let i = s0; i < s0 + Math.ceil(w / (TB * U)) + 3; i++) {
        const sx = (i * TB - kam * k) * U, r = hash(i + 900), r2 = hash(i + 1300);
        const fot = bak + 0.12 * U;
        if (r < 0.3) { // sofa
          const sw = 4.4 * U, sh = 1.7 * U, f = ['#5b8dbf', '#c0605a', '#6aa36f'][Math.floor(r2 * 3)];
          ctx.fillStyle = 'rgba(0,0,0,.1)'; ctx.beginPath(); ctx.ellipse(sx + sw / 2, fot, sw * 0.55, 0.18 * U, 0, 0, 7); ctx.fill();
          ctx.fillStyle = f; api.rundRekt(sx, fot - sh, sw, sh * 0.7, 0.3 * U); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,.15)'; api.rundRekt(sx + 0.3 * U, fot - sh + 0.15 * U, sw / 2 - 0.4 * U, sh * 0.42, 0.25 * U); ctx.fill(); api.rundRekt(sx + sw / 2 + 0.1 * U, fot - sh + 0.15 * U, sw / 2 - 0.4 * U, sh * 0.42, 0.25 * U); ctx.fill();
          ctx.fillStyle = f; api.rundRekt(sx - 0.1 * U, fot - sh * 0.48, sw + 0.2 * U, sh * 0.38, 0.2 * U); ctx.fill();
          ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(sx, fot - sh * 0.14, sw, 0.06 * U);
          ctx.fillStyle = '#4a3423'; ctx.fillRect(sx + 0.3 * U, fot - 0.14 * U, 0.15 * U, 0.14 * U); ctx.fillRect(sx + sw - 0.45 * U, fot - 0.14 * U, 0.15 * U, 0.14 * U);
          ctx.fillStyle = '#f5d33c'; api.rundRekt(sx + 0.35 * U, fot - sh * 0.95, 0.8 * U, 0.7 * U, 0.2 * U); ctx.fill();
        } else if (r < 0.52) { // TV-benk med TV
          const bw = 3.6 * U;
          ctx.fillStyle = '#9b6b43'; api.rundRekt(sx, fot - 0.9 * U, bw, 0.9 * U, 6); ctx.fill();
          ctx.fillStyle = '#b5845a'; ctx.fillRect(sx + 0.2 * U, fot - 0.75 * U, bw / 2 - 0.3 * U, 0.55 * U); ctx.fillRect(sx + bw / 2 + 0.1 * U, fot - 0.75 * U, bw / 2 - 0.3 * U, 0.55 * U);
          ctx.fillStyle = '#2b2b33'; api.rundRekt(sx + 0.4 * U, fot - 2.9 * U, bw - 0.8 * U, 1.75 * U, 6); ctx.fill();
          ctx.fillStyle = ['#7ec8e8', '#ffcf6b', '#9be08a'][Math.floor(r2 * 3)]; ctx.fillRect(sx + 0.55 * U, fot - 2.75 * U, bw - 1.1 * U, 1.45 * U);
          api.emoji(['🐠', '🦊', '🐢'][Math.floor(r2 * 3)], sx + bw / 2 + Math.sin(api.tid * 1.5 + i) * 0.5 * U, fot - 2.05 * U, 0.8 * U);
          ctx.fillStyle = '#2b2b33'; ctx.fillRect(sx + bw / 2 - 0.1 * U, fot - 1.15 * U, 0.2 * U, 0.25 * U);
        } else if (r < 0.72) { // bokhylle
          const bw = 2.4 * U, bh = 3.6 * U;
          ctx.fillStyle = '#8a5a32'; ctx.fillRect(sx, fot - bh, bw, bh);
          ctx.fillStyle = '#6e4526';
          const BF = ['#e8554e', '#4f9bd9', '#f5d33c', '#3fb36b', '#b06fd8', '#f2a541'];
          for (let h = 0; h < 3; h++) {
            const hy = fot - bh + 0.2 * U + h * 1.15 * U;
            ctx.fillStyle = '#6e4526'; ctx.fillRect(sx + 0.15 * U, hy, bw - 0.3 * U, 0.95 * U);
            let bx = sx + 0.22 * U;
            for (let b = 0; b < 6; b++) { const bb = (0.2 + hash(i * 7 + h * 3 + b) * 0.14) * U, bh2 = (0.6 + hash(i + h + b * 5) * 0.3) * U; if (bx + bb > sx + bw - 0.2 * U) break; ctx.fillStyle = BF[(b + h + i) % 6]; ctx.fillRect(bx, hy + 0.95 * U - bh2, bb, bh2); bx += bb + 0.04 * U; }
          }
        } else if (r < 0.86) { // stålampe og potteplante
          ctx.fillStyle = '#4a3423'; ctx.fillRect(sx + 0.95 * U, fot - 3.4 * U, 0.1 * U, 3.3 * U); ctx.beginPath(); ctx.ellipse(sx + U, fot - 0.06 * U, 0.45 * U, 0.12 * U, 0, 0, 7); ctx.fill();
          ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.moveTo(sx + 0.45 * U, fot - 3.2 * U); ctx.lineTo(sx + 1.55 * U, fot - 3.2 * U); ctx.lineTo(sx + 1.25 * U, fot - 4.0 * U); ctx.lineTo(sx + 0.75 * U, fot - 4.0 * U); ctx.fill();
          api.emoji('🪴', sx + 2.6 * U, fot - 0.85 * U, 1.9 * U);
        } else api.emoji('🪴', sx + 1.4 * U, fot - 0.9 * U, 2.1 * U);
      }
    }
    function tegnGulv(m, kam, bak) {
      const { U, gulv } = m, w = api.w, h = api.h;
      ctx.fillStyle = '#c88d56'; ctx.fillRect(0, bak, w, h - bak);
      // plankerader med fuger, som forskyves med farten
      const rader = 5, rh = (h - bak) / rader;
      for (let r = 0; r < rader; r++) {
        const ry = bak + r * rh, pl = 3.2 * U, off = -((kam * U + r * 1.1 * U) % pl);
        ctx.fillStyle = r % 2 ? '#c4884f' : '#cd955e'; ctx.fillRect(0, ry, w, rh);
        ctx.fillStyle = 'rgba(90,50,20,.22)'; ctx.fillRect(0, ry, w, 1.5);
        for (let px = off; px < w; px += pl) ctx.fillRect(px, ry, 1.5, rh);
      }
      // teppe der Nøtte løper
      ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.fillRect(0, gulv + 0.05 * U, w, 0.12 * U);
    }
    function tegnHinder(o, sx, m) {
      const { U, gulv } = m;
      const bw = o.b * U, bh = o.h * U, fy = gulv + o.dy * U;
      ctx.save(); ctx.translate(sx + bw / 2, fy); ctx.rotate(o.vipp);
      if (o.navn !== 'katt' || !o.truffet) { ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.beginPath(); ctx.ellipse(0, 0, bw * 0.55, 0.12 * U, 0, 0, 7); ctx.fill(); }
      const PF = [['#e8554e', '#f7a49f'], ['#4f9bd9', '#a6cff1'], ['#f5d33c', '#fbeaa0'], ['#3fb36b', '#9edcb3']];
      const pute = (py, f, ph) => {
        ctx.fillStyle = f[0]; api.rundRekt(-bw / 2, py - ph, bw, ph, ph * 0.42); ctx.fill();
        ctx.fillStyle = f[1]; api.rundRekt(-bw / 2 + 0.12 * U, py - ph + 0.1 * U, bw - 0.24 * U, ph * 0.38, ph * 0.18); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.arc(0, py - ph / 2, 0.07 * U, 0, 7); ctx.fill();
      };
      if (o.navn === 'pute') pute(0, PF[o.farge], bh);
      else if (o.navn === 'stabel') { pute(0, PF[o.farge], bh * 0.5); pute(-bh * 0.48, PF[(o.farge + 1) % 4], bh * 0.52); }
      else if (o.navn === 'bil') { ctx.scale(-1, 1); api.emoji('🚗', 0, -bh * 0.5, bh * 1.35); }
      else if (o.navn === 'bamse') api.emoji('🧸', 0, -bh * 0.5, bh * 1.15);
      else if (o.navn === 'katt') {
        if (!o.truffet) {
          ctx.fillStyle = '#7a5bb5'; api.rundRekt(-bw / 2 - 0.1 * U, -0.25 * U, bw + 0.2 * U, 0.3 * U, 0.15 * U); ctx.fill(); // kattepute
          ctx.save(); ctx.scale(1, 1 + Math.sin(api.tid * 2.2) * 0.04); api.emoji('🐈', 0, -bh * 0.48, bh * 1.3); ctx.restore();
          const zt = (api.tid * 0.7) % 1;
          api.emoji('💤', bw * 0.25 + zt * 0.4 * U, -bh * 1.05 - zt * 0.6 * U, 0.55 * U, 0, 1 - zt);
        } else { ctx.scale(-1, 1); api.emoji('🐈', 0, -bh * 0.48, bh * 1.3); }
      }
      ctx.restore();
    }
    function tegnNøtte(m) {
      const { U, gulv, nx } = m;
      const fy = gulv - y * U;
      // skygge krymper når Nøtte er høyt oppe
      const sk = Math.max(0.35, 1 - y * 0.18);
      ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(nx, gulv + 0.02 * U, 0.55 * U * sk, 0.13 * U * sk, 0, 0, 7); ctx.fill();
      if (snubleT > 0 && Math.floor(snubleT * 14) % 2 === 0) return;      // blinker etter snubling
      const bob = påBakken ? Math.abs(Math.sin(løpFase)) * 0.12 * U : 0;
      const rot = snubleT > 0.6 ? 0.5 * Math.sin((snubleT - 0.6) * 8) : påBakken ? Math.sin(løpFase * 2) * 0.05 : Math.max(-0.3, Math.min(0.35, -vy * 0.03));
      ctx.save();
      ctx.translate(nx, fy - bob);
      ctx.rotate(rot);
      ctx.scale(-sqX, sqY);                                   // emojien ser mot venstre, speiles så den løper mot høyre
      api.emoji('🐿️', 0, -0.62 * U, 1.35 * U);
      ctx.restore();
    }
    function tegnHaug(sx, m) {
      const { U, gulv } = m;
      ctx.fillStyle = '#8a5a32'; ctx.beginPath(); ctx.ellipse(sx + 2.2 * U, gulv, 2.6 * U, 1.9 * U, 0, Math.PI, 0); ctx.fill();
      const rader = [7, 6, 5, 4, 3, 2, 1];
      let n = 0;
      for (let r = 0; r < rader.length; r++) for (let i = 0; i < rader[r]; i++) {
        const px = sx + 2.2 * U + (i - (rader[r] - 1) / 2) * 0.62 * U, py = gulv - 0.3 * U - r * 0.5 * U;
        api.emoji('🌰', px, py - (r === rader.length - 1 ? Math.abs(Math.sin(api.tid * 4)) * 0.2 * U : 0), 0.75 * U, (hash(n++) - 0.5) * 0.8);
      }
      api.emoji('⭐', sx + 2.2 * U, gulv - 4.2 * U - Math.sin(api.tid * 3) * 0.15 * U, 1.0 * U, Math.sin(api.tid * 2) * 0.2);
    }

    // ---------------------------------------------------------------- spilllogikk
    function oppdater(dt, m) {
      const v = slutt ? 0 : fart();
      x += v * dt;
      løpFase += dt * v * 1.6;
      // hopp med variabel høyde
      if (!påBakken) {
        let g = G;
        if (holder && vy > 0 && holdT < HOLD_MAKS) { g = HOLD_G; holdT += dt; }
        vy -= g * dt; y += vy * dt; topp = Math.max(topp, y);
        if (y <= 0) {
          y = 0; vy = 0; påBakken = true; bakkeT = 0; rekke = 0;
          sqX = 1.3; sqY = 0.72;
          lyd.sprett();
          api.sprut(m.nx, m.gulv, '#d8b48c', 5);
          if (kø > 0) hopp();
        }
      } else bakkeT += dt;
      if (kø > 0) kø -= dt;
      sqX += (1 - sqX) * Math.min(1, dt * 10); sqY += (1 - sqY) * Math.min(1, dt * 10);
      if (snubleT > 0) snubleT -= dt;
      fartK += (1 - fartK) * Math.min(1, dt * 1.2);

      // nye hindre ut fra hvor langt fram man ser
      const syn = x + (api.w - m.nx) / m.U + 2;
      if (haugX === null && api.tid < VARIGHET - 3.2) {
        while (nesteHinder < syn) { lagHinder(nesteHinder); nesteHinder += 7.2 + fart() * 0.45 + api.rnd() * 3.5; }
      } else if (haugX === null) haugX = Math.max(syn, nesteHinder - 2);

      // treff mot hindre (litt tilgivende boks)
      for (const o of hindre) {
        if (o.truffet) {
          o.truffet += dt; o.x += o.vx * dt;
          if (o.navn === 'katt') { o.dy = -Math.abs(Math.sin(o.truffet * 12)) * 0.25; o.vipp = 0; }
          else { o.vy -= 30 * dt; o.dy -= o.vy * dt; o.vipp += o.vx * 0.4 * dt; }
          continue;
        }
        const venstre = x - 0.25, høyre = x + 0.3;
        if (høyre > o.x + 0.18 && venstre < o.x + o.b - 0.18 && y < o.h - 0.25) {
          o.truffet = 0.001; snubleT = 1.0; fartK = 0.45; rekke = 0;
          o.vx = o.navn === 'katt' ? -7 : 3.5; treffLogg.push(o.navn + ':' + y.toFixed(2) + '/' + topp.toFixed(2) + '/' + holdT.toFixed(2) + '/' + (o.x - hoppX).toFixed(2)); o.vy = o.navn === 'katt' ? 0 : 7;
          if (o.navn === 'katt') { lyd.plopp(); api.sprut(m.nx + 0.6 * m.U, m.gulv - 0.8 * m.U, '💨', 3); }
          else { lyd.dunk(); api.sprut(m.nx + 0.5 * m.U, m.gulv - 0.6 * m.U, '#ffffff', 6); }
          setTimeout(() => { if (!slutt) lyd.hmm(); }, 120);
          sqX = 1.25; sqY = 0.8;
        }
      }
      for (let i = hindre.length - 1; i >= 0; i--) if (hindre[i].x < x - 12 || hindre[i].x > x + 60) hindre.splice(i, 1);
      // nøtter
      for (const n of nøtter) {
        if (n.tatt) { n.tatt += dt; continue; }
        if (Math.abs(n.x - x) < 0.7 && Math.abs(n.y - (y + 0.6)) < 0.8) {
          n.tatt = 0.001; poeng++; api.poeng(poeng);
          lyd.tone([0, 2, 4, 7, 9, 12, 14][Math.min(6, rekke++)]);
          api.sprut(m.nx + (n.x - x) * m.U, m.gulv - n.y * m.U, '#f5d33c', 5);
        }
      }
      while (nøtter.length && nøtter[0].x < x - 12) nøtter.shift();
      // målet: nøtthaugen
      if (haugX !== null && !slutt && x >= haugX - 0.2) {
        slutt = true; ferdigFase = 0; startX = x;
        vy = 9; påBakken = false; holder = false;
        lyd.fanfare();
        poeng += 5; api.poeng(poeng);
        for (let i = 0; i < 3; i++) api.sprut(m.nx + 2 * m.U, m.gulv - 2 * m.U, i ? '🌰' : '⭐', 6);
      }
    }

    api.vedStørrelse(() => {});
    api.løkke((dt, t) => {
      const m = mål();
      if (slutt) {
        ferdigFase += dt;
        // Nøtte hopper opp på haugen og gleder seg
        const k = Math.min(1, ferdigFase / 0.7);              // bue opp på toppen av haugen
        if (k < 1) { x = startX + (haugX + 2.2 - startX) * k; y = 3.5 * k + 2.6 * Math.sin(Math.PI * k); }
        else { if (!påBakken) { påBakken = true; sqX = 1.3; sqY = 0.7; lyd.sprett(); } y = 3.5 + Math.abs(Math.sin((ferdigFase - 0.7) * 7)) * 0.5; }
        sqX += (1 - sqX) * Math.min(1, dt * 10); sqY += (1 - sqY) * Math.min(1, dt * 10);
        if (ferdigFase > 0.6 && ferdigFase - dt <= 0.6) api.sprut(m.nx, m.gulv - 2.5 * m.U, '🌰', 8);
      } else oppdater(dt, m);
      const kam = x - m.nx / m.U;                         // verdens-x ved venstre skjermkant
      const bak = tegnVegg(m, kam);
      tegnMøbler(m, kam, bak);
      tegnGulv(m, kam, bak);
      const sx = (wx) => m.nx + (wx - x) * m.U;
      if (haugX !== null) tegnHaug(sx(haugX), m);
      for (const o of hindre) { const px = sx(o.x); if (px > -3 * m.U && px < api.w + 3 * m.U) tegnHinder(o, px, m); }
      for (const n of nøtter) {
        const px = sx(n.x);
        if (px < -m.U || px > api.w + m.U) continue;
        if (n.tatt) { if (n.tatt < 0.3) api.emoji('🌰', px, m.gulv - n.y * m.U - n.tatt * 3 * m.U, 0.7 * m.U * (1 + n.tatt * 2), 0, 1 - n.tatt / 0.3); continue; }
        api.emoji('🌰', px, m.gulv - n.y * m.U - Math.sin(t * 4 + n.x) * 0.08 * m.U, 0.7 * m.U, Math.sin(t * 3 + n.x) * 0.2);
      }
      tegnNøtte(m);
      api.framgang(Math.min(1, t / VARIGHET));
      if (slutt && ferdigFase > 2.2) {
        const andel = muligeNøtter ? (poeng - 5) / muligeNøtter : 0;
        api.ferdig({ stjerner: andel >= 0.62 ? 3 : andel >= 0.42 ? 2 : 1, poeng });
      }
    });

    // hint: simulerer et hopp som starter litt senere og sjekker at det klarer neste hinder
    function klarer(o, venteS, holdS) {
      const v = fart();
      let py = 0, pv = V0, ht = 0, px = x + v * venteS;
      for (let i = 0; i < 200; i++) {
        const d = 1 / 120;
        const g = ht < holdS && pv > 0 ? HOLD_G : G;
        if (g === HOLD_G) ht += d;
        pv -= g * d; py += pv * d; px += v * d;
        if (px + 0.3 > o.x + 0.18 && px - 0.25 < o.x + o.b - 0.18 && py < o.h - 0.25) return false;
        if (py <= 0 && i > 4) return px - 0.25 >= o.x + o.b - 0.18;
      }
      return true;
    }
    return {
      hint() {
        if (slutt || !påBakken) return null;
        const o = hindre.find((k) => !k.truffet && k.x + k.b - 0.18 > x - 0.25 + 0.05);   // første hinder som ikke er passert
        if (!o || o.x - x > 6) return null;
        const m = mål();
        for (const holdS of o.høy ? [HOLD_MAKS] : [0, 0.14, HOLD_MAKS]) {
          if (klarer(o, 0.05, holdS) && klarer(o, 0.18, holdS)) {
            return holdS ? { x: api.w * 0.6, y: m.gulv - 2.6 * m.U, hold: Math.round(holdS * 1000) + 60, vent: 60 } : { x: api.w * 0.6, y: m.gulv - 2.6 * m.U, vent: 60 };
          }
        }
        return null;
      },
      tilstand() { return { poeng, muligeNøtter, x: +x.toFixed(1), hindre: hindre.length, treff: treffLogg.join(' ') }; },
    };
  },
};

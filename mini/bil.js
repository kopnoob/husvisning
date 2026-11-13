// Bilturen (sjanger: bytt fil og unngå hindre, sett ovenfra). En liten rød bil kjører av seg selv oppover en vei med tre filer.
// Trykk på venstre eller høyre halvdel (eller sveip) for å bytte fil. Kan ikke tapes: treffer bilen noe, tuter den og bremser litt.
export default {
  id: 'bil', navn: 'Bilturen', ikon: '🚗', rom: 'Garasjen', hjelp: 'trykk', poengIkon: '⭐', bakgrunn: '#8cc46e', hjelpEtter: 4,
  start(api) {
    const { ctx, lyd } = api;
    const VARIGHET = 60;
    let fil = 1, bilX = 1, d = 0, fartK = 1, ristT = 0, tilt = 0, bump = 0;
    let poeng = 0, mulige = 0, rekke = 0, nesteRad = 4.5, garasjeD = null, inne = false, inneT = 0;
    let trykkX = 0, trykkRetn = 0;
    const ting = [];        // { fil, d, type: 'kjegle'|'dunk'|'pytt'|'mynt', truffet, ... }

    function mål() {
      const t = api.trygg;
      const L = Math.max(58, Math.min(130, Math.min(api.w * 0.25, api.h * 0.19)));      // filbredde
      const bilY = api.h - t.bunn - 1.25 * L;
      return { L, bilY, cx: api.w / 2 };
    }
    // fart i filbredder per sekund: tiden fra toppen av skjermen ned til bilen går fra 1,8 s til 1,25 s
    function fart(m) { const T = 1.8 - Math.min(1, api.tid / VARIGHET) * 0.55; return (m.bilY / m.L) / T * fartK; }
    const filX = (m, f) => m.cx + (f - 1) * m.L;
    const skjY = (m, wd) => m.bilY - (wd - d) * m.L;
    const hash = (i) => { const s = Math.sin(i * 91.7 + 17.3) * 43758.5453; return s - Math.floor(s); };

    function lagRad(m) {
      // én eller to filer sperres, aldri alle tre; mynter i en fri fil
      const typer = ['kjegle', 'dunk', 'pytt'];
      const n = api.tid > 15 && api.rnd() < 0.35 ? 2 : 1;
      const filer = [0, 1, 2].sort(() => api.rnd() - 0.5);
      for (let i = 0; i < n; i++) ting.push({ fil: filer[i], d: nesteRad, type: typer[Math.floor(api.rnd() * 3)], truffet: 0, fx: 0, fy: 0, rot: 0 });
      if (api.rnd() < 0.8) {
        const mf = filer[n];
        const ant = 3;
        for (let k = 0; k < ant; k++) ting.push({ fil: mf, d: nesteRad + 0.9 + k * 0.75, type: 'mynt', truffet: 0 });
        mulige += ant;
      }
      nesteRad += 3.6 + api.rnd() * 1.6;
    }

    function bytt(r) {
      const ny = Math.max(0, Math.min(2, fil + r));
      if (ny === fil) { bump = 0.3; lyd.klikk(); return false; }
      fil = ny; lyd.sus(); return true;
    }
    const innkjøring = () => garasjeD !== null && d > garasjeD - 3.5;    // svinger selv inn på plassen sin
    api.peker((e) => {
      if (inne || innkjøring()) return;
      if (e.type === 'ned') {
        trykkX = e.x; trykkRetn = e.x < api.w / 2 ? -1 : 1;
        if (!bytt(trykkRetn)) trykkRetn = 0;
      } else if (e.type === 'opp') {
        const dx = e.x - trykkX;
        if (Math.abs(dx) > 40 && Math.sign(dx) !== trykkRetn) { if (trykkRetn) bytt(-trykkRetn); bytt(Math.sign(dx)); }   // sveip veier tyngst
      }
    });
    function tut() { lyd.tone(16, 0.12); setTimeout(() => lyd.tone(16, 0.12), 140); }

    // ---------------------------------------------------------------- tegning
    function tegnSide(m, side) {      // gress, hekk, trær, hus og postkasser langs veien
      const { L, cx } = m, w = api.w, h = api.h;
      const kant = cx + side * 1.5 * L;
      const steg = 1.7, i0 = Math.floor(d / steg) - 2, i1 = i0 + Math.ceil(h / (steg * L)) + 4;
      for (let i = i0; i <= i1; i++) {
        const wd = i * steg, y = skjY(m, wd), r = hash(i * 2 + (side > 0 ? 1 : 0)), r2 = hash(i * 5 + side * 3);
        if (wd < 2) continue;
        const nx = kant + side * (0.55 + r2 * 0.25) * L;   // nær veien
        if (r < 0.3) { // hekk
          ctx.fillStyle = '#3f7d3a'; api.rundRekt(nx - 0.42 * L, y - 0.8 * L, 0.84 * L, 1.6 * L, 0.3 * L); ctx.fill();
          ctx.fillStyle = '#58a04e'; api.rundRekt(nx - 0.32 * L, y - 0.72 * L, 0.5 * L, 1.4 * L, 0.25 * L); ctx.fill();
        } else if (r < 0.55) { // tre sett ovenfra
          ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.beginPath(); ctx.arc(nx + 0.12 * L, y + 0.12 * L, 0.6 * L, 0, 7); ctx.fill();
          ctx.fillStyle = r2 < 0.5 ? '#3f8a3c' : '#5aa04a'; ctx.beginPath(); ctx.arc(nx, y, 0.6 * L, 0, 7); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.beginPath(); ctx.arc(nx - 0.15 * L, y - 0.15 * L, 0.3 * L, 0, 7); ctx.fill();
          if (r2 > 0.7) api.emoji('🍎', nx + 0.2 * L, y + 0.1 * L, 0.3 * L);
        } else if (r < 0.7) { // postkasse og blomster
          api.emoji('📮', nx, y, 0.6 * L);
          api.emoji('🌷', nx + side * 0.45 * L, y + 0.3 * L, 0.42 * L); api.emoji('🌼', nx + side * 0.3 * L, y - 0.35 * L, 0.38 * L);
        } else if (r < 0.82) { // lyktestolpe
          ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(nx, y - 0.05 * L, side * 0.8 * L, 0.1 * L);
          ctx.fillStyle = '#5b5f68'; ctx.beginPath(); ctx.arc(nx, y, 0.14 * L, 0, 7); ctx.fill();
          ctx.fillStyle = '#ffe28a'; ctx.beginPath(); ctx.arc(nx - side * 0.25 * L, y, 0.12 * L, 0, 7); ctx.fill();
        }
        // lenger ute: hus med tak sett ovenfra (bare der det er plass)
        if (i % 3 === 0) {
          const hx = kant + side * (2.2 + hash(i + 40) * 0.6) * L;
          if (side < 0 ? hx + 0.9 * L > 0 : hx - 0.9 * L < w) {
            const tf = ['#c0503c', '#4b5563', '#8a5a3c', '#3d6b8c'][Math.floor(hash(i + 7) * 4)];
            ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(hx - 0.85 * L + 6, y - 1.1 * L + 6, 1.7 * L, 2.2 * L);
            ctx.fillStyle = tf; ctx.fillRect(hx - 0.85 * L, y - 1.1 * L, 1.7 * L, 2.2 * L);
            ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(hx - 0.85 * L, y - 1.1 * L, 0.85 * L, 2.2 * L);
            ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(hx - 0.03 * L, y - 1.1 * L, 0.06 * L, 2.2 * L);
            ctx.fillStyle = '#7a4b3a'; ctx.fillRect(hx + 0.3 * L, y - 0.6 * L, 0.3 * L, 0.3 * L);
          }
        }
      }
    }
    function tegnVei(m) {
      const { L, cx } = m, w = api.w, h = api.h;
      // gress med striper
      ctx.fillStyle = '#8cc46e'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,255,255,.07)';
      const sh = 1.2 * L, off = (d * L) % (sh * 2);
      for (let y = -sh * 2 + off; y < h; y += sh * 2) ctx.fillRect(0, y, w, sh);
      // fortau
      ctx.fillStyle = '#d9d2c4'; ctx.fillRect(cx - 1.75 * L, 0, 3.5 * L, h);
      ctx.fillStyle = 'rgba(0,0,0,.08)'; const fo = (d * L) % (0.5 * L);
      for (let y = -0.5 * L + fo; y < h; y += 0.5 * L) { ctx.fillRect(cx - 1.75 * L, y, 0.25 * L, 1.5); ctx.fillRect(cx + 1.5 * L, y, 0.25 * L, 1.5); }
      // veien: grus i innkjørselen, så asfalt
      const grusY = skjY(m, 5);
      ctx.fillStyle = '#5e6168'; ctx.fillRect(cx - 1.5 * L, 0, 3 * L, Math.min(h, grusY));
      if (grusY < h) {
        ctx.fillStyle = '#cdb994'; ctx.fillRect(cx - 1.5 * L, grusY, 3 * L, h - grusY);
        ctx.fillStyle = 'rgba(120,90,50,.25)';
        for (let i = 0; i < 40; i++) { const gy = grusY + (i * 37 % 100) / 100 * (h - grusY); ctx.fillRect(cx - 1.4 * L + (i * 61 % 100) / 100 * 2.8 * L, gy, 3, 3); }
      }
      // stiplede fillinjer og kantlinjer
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      const sl = 0.9 * L, so = (d * L) % (sl * 2);
      for (let y = -sl * 2 + so; y < Math.min(h, grusY); y += sl * 2) { const yy = Math.min(y + sl, grusY) - y; if (yy > 0) { ctx.fillRect(cx - 0.5 * L - 2, y, 4, yy); ctx.fillRect(cx + 0.5 * L - 2, y, 4, yy); } }
      ctx.fillStyle = '#f5d33c'; ctx.fillRect(cx - 1.5 * L + 3, 0, 3, Math.min(h, grusY)); ctx.fillRect(cx + 1.5 * L - 6, 0, 3, Math.min(h, grusY));
      tegnSide(m, -1); tegnSide(m, 1);
      // huset bak oss ved start
      const hy = skjY(m, -0.6);
      if (hy - 3 * L < h) {
        ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(cx - 2.6 * L + 8, hy + 8, 5.2 * L, 3 * L);
        ctx.fillStyle = '#4b4f58'; ctx.fillRect(cx - 2.6 * L, hy, 5.2 * L, 3 * L);
        ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(cx - 2.6 * L, hy, 5.2 * L, 1.5 * L);
        ctx.fillStyle = '#7a4b3a'; ctx.fillRect(cx + 1.2 * L, hy + 0.4 * L, 0.45 * L, 0.45 * L);
      }
    }
    function tegnKjegle(x, y, L, rot) {
      ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot);
      ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(4, 0.28 * L, 0.32 * L, 0.12 * L, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#e9672b'; ctx.fillRect(-0.32 * L, 0.18 * L, 0.64 * L, 0.12 * L);
      ctx.beginPath(); ctx.moveTo(-0.24 * L, 0.2 * L); ctx.lineTo(0, -0.42 * L); ctx.lineTo(0.24 * L, 0.2 * L); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-0.15 * L, -0.02 * L); ctx.lineTo(0.15 * L, -0.02 * L); ctx.lineTo(0.12 * L, -0.12 * L); ctx.lineTo(-0.12 * L, -0.12 * L); ctx.fill();
      ctx.restore();
    }
    function tegnDunk(x, y, L, rot) {
      ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot);
      ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(-0.3 * L + 5, -0.3 * L + 5, 0.6 * L, 0.66 * L);
      ctx.fillStyle = '#2f7d4a'; api.rundRekt(-0.3 * L, -0.34 * L, 0.6 * L, 0.68 * L, 6); ctx.fill();
      ctx.fillStyle = '#3f9b5d'; api.rundRekt(-0.33 * L, -0.38 * L, 0.66 * L, 0.24 * L, 5); ctx.fill();
      ctx.fillStyle = '#1f5a34'; ctx.fillRect(-0.12 * L, -0.33 * L, 0.24 * L, 0.06 * L);
      ctx.fillStyle = '#222'; ctx.fillRect(-0.36 * L, 0.18 * L, 0.08 * L, 0.18 * L); ctx.fillRect(0.28 * L, 0.18 * L, 0.08 * L, 0.18 * L);
      ctx.restore();
    }
    function tegnPytt(x, y, L) {
      ctx.fillStyle = '#5b9fd0'; ctx.beginPath(); ctx.ellipse(x, y, 0.42 * L, 0.3 * L, 0.2, 0, 7); ctx.ellipse(x + 0.18 * L, y + 0.1 * L, 0.3 * L, 0.22 * L, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.ellipse(x - 0.12 * L, y - 0.08 * L, 0.16 * L, 0.06 * L, 0.2, 0, 7); ctx.fill();
    }
    function tegnMynt(x, y, L, t, k) {            // stjerner å samle
      const s = 1 + Math.sin(t * 6 + k) * 0.08;
      ctx.fillStyle = 'rgba(255,240,150,.35)'; ctx.beginPath(); ctx.arc(x, y, 0.3 * L * s, 0, 7); ctx.fill();
      api.emoji('⭐', x, y, 0.5 * L, Math.sin(t * 3 + k) * 0.25);
    }
    function tegnBil(m, t) {
      const { L } = m;
      const x = filX(m, bilX) + (ristT > 0 ? Math.sin(ristT * 50) * 4 : 0), y = m.bilY;
      const bw = 0.62 * L, bl = 1.0 * L;
      ctx.save(); ctx.translate(x, y); ctx.rotate(tilt);
      const sq = 1 + bump * 0.15;
      ctx.scale(sq, 1 / sq);
      ctx.fillStyle = 'rgba(0,0,0,.22)'; api.rundRekt(-bw / 2 + 5, -bl / 2 + 7, bw, bl, 0.2 * L); ctx.fill();
      ctx.fillStyle = '#222'; for (const [hx, hy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) api.rundRekt(hx * bw / 2 - 0.07 * L, hy * bl * 0.3 - 0.11 * L, 0.14 * L, 0.22 * L, 3), ctx.fill();
      ctx.fillStyle = '#d93a32'; api.rundRekt(-bw / 2, -bl / 2, bw, bl, 0.2 * L); ctx.fill();
      ctx.fillStyle = '#f0564c'; api.rundRekt(-bw / 2 + 4, -bl / 2 + 4, bw * 0.35, bl - 8, 0.15 * L); ctx.fill();
      ctx.fillStyle = '#9fd6f2'; api.rundRekt(-bw / 2 + 0.08 * L, -bl * 0.22, bw - 0.16 * L, 0.2 * L, 5); ctx.fill();      // frontrute
      ctx.fillStyle = '#b8282a'; api.rundRekt(-bw / 2 + 0.1 * L, -bl * 0.02, bw - 0.2 * L, 0.32 * L, 6); ctx.fill();       // tak
      ctx.fillStyle = '#9fd6f2'; api.rundRekt(-bw / 2 + 0.1 * L, bl * 0.32, bw - 0.2 * L, 0.1 * L, 4); ctx.fill();         // bakrute
      ctx.fillStyle = '#fff6b0'; ctx.beginPath(); ctx.arc(-bw * 0.3, -bl / 2 + 0.05 * L, 0.06 * L, 0, 7); ctx.arc(bw * 0.3, -bl / 2 + 0.05 * L, 0.06 * L, 0, 7); ctx.fill();
      // lyskjegle forover
      if (!inne) { ctx.fillStyle = 'rgba(255,250,200,.18)'; ctx.beginPath(); ctx.moveTo(-bw * 0.35, -bl / 2); ctx.lineTo(bw * 0.35, -bl / 2); ctx.lineTo(bw * 0.6, -bl / 2 - 0.7 * L); ctx.lineTo(-bw * 0.6, -bl / 2 - 0.7 * L); ctx.fill(); }
      ctx.restore();
      api.emoji('🐿️', x, y + 0.08 * L, 0.32 * L);          // Nøtte kjører
    }
    function tegnGarasje(m, t, tak) {           // garasjen sett ovenfra med taket skåret bort; tak = tegn bare vegger og port
      const { L, cx } = m;
      const gy = skjY(m, garasjeD);                         // åpningen
      const bw = 3.4 * L, dyp = 2.6 * L, vt = 0.22 * L;
      if (!tak) {
        ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(cx - bw / 2 + 10, gy - dyp + 10, bw, dyp);
        ctx.fillStyle = '#d6d0c4'; ctx.fillRect(cx - bw / 2, gy - dyp, bw, dyp);           // betonggulv
        ctx.fillStyle = 'rgba(0,0,0,.06)'; for (let i = 1; i < 4; i++) ctx.fillRect(cx - bw / 2, gy - dyp + i * dyp / 4, bw, 2);
        ctx.fillStyle = '#9b6b43'; ctx.fillRect(cx - bw / 2 + vt, gy - dyp + vt, bw - 2 * vt, 0.35 * L);   // arbeidsbenk innerst
        api.emoji('🧰', cx - 0.9 * L, gy - dyp + vt + 0.15 * L, 0.42 * L); api.emoji('🪴', cx + 0.9 * L, gy - dyp + vt + 0.1 * L, 0.42 * L);
        api.emoji('🚲', cx - bw / 2 + 0.55 * L, gy - dyp * 0.45, 0.6 * L, -1.57); api.emoji('⚽', cx + bw / 2 - 0.45 * L, gy - 0.6 * L, 0.38 * L);
        // parkeringsplassen er merket
        ctx.strokeStyle = '#f5d33c'; ctx.lineWidth = 3; ctx.strokeRect(cx - 0.45 * L, gy - dyp + 0.55 * L, 0.9 * L, 1.4 * L);
        return;
      }
      // bak garasjen: plenen og huset vårt, veien slutter her
      const bak = gy - dyp;
      if (bak > 0) {
        ctx.fillStyle = '#8cc46e'; ctx.fillRect(0, 0, api.w, bak);
        ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(cx - 4.2 * L + 10, bak - 3.2 * L + 10, 8.4 * L, 3.2 * L);
        ctx.fillStyle = '#4b4f58'; ctx.fillRect(cx - 4.2 * L, bak - 3.2 * L, 8.4 * L, 3.2 * L);
        ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(cx - 4.2 * L, bak - 3.2 * L, 8.4 * L, 1.6 * L);
        ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(cx - 4.2 * L, bak - 1.62 * L, 8.4 * L, 0.06 * L);
        ctx.fillStyle = '#7a4b3a'; ctx.fillRect(cx + 2.4 * L, bak - 2.6 * L, 0.5 * L, 0.5 * L);
        api.emoji('🌳', cx - 4.9 * L, bak - 1.2 * L, 1.4 * L); api.emoji('🌳', cx + 4.9 * L, bak - 1.6 * L, 1.4 * L);
      }
      // vegger og takkant
      ctx.fillStyle = '#4b4f58';
      ctx.fillRect(cx - bw / 2, gy - dyp, bw, vt); ctx.fillRect(cx - bw / 2, gy - dyp, vt, dyp); ctx.fillRect(cx + bw / 2 - vt, gy - dyp, vt, dyp);
      ctx.fillRect(cx - bw / 2, gy - vt, 0.75 * L, vt); ctx.fillRect(cx + bw / 2 - 0.75 * L, gy - vt, 0.75 * L, vt);
      // porten ruller ned når bilen er inne
      const lukk = inne ? Math.min(1, Math.max(0, (inneT - 0.5) / 0.6)) : 0;
      if (lukk > 0) { ctx.fillStyle = '#f2f2f2'; ctx.fillRect(cx - bw / 2 + 0.75 * L, gy - vt, (bw - 1.5 * L) * lukk, vt); }
      ctx.fillStyle = '#e8554e'; ctx.beginPath(); ctx.arc(cx + bw / 2 - 0.4 * L, gy - dyp - 0.05 * L, 0.12 * L, 0, 7); ctx.fill();
    }

    // ---------------------------------------------------------------- løkka
    api.løkke((dt, t) => {
      const m = mål(), { L } = m;
      if (!inne) {
        const v = fart(m);
        d += v * dt;
        fartK += (1 - fartK) * Math.min(1, dt * 1.3);
        // nye rader ut fra hvor langt fram man ser
        const syn = d + m.bilY / L + 2;
        if (api.tid < VARIGHET - 4.5) { while (nesteRad < syn) lagRad(m); }
        else if (garasjeD === null) garasjeD = Math.max(syn, nesteRad + 0.5);
        // treff
        for (const o of ting) {
          if (o.truffet) continue;
          if (Math.abs(o.d - d) < (o.type === 'mynt' ? 0.45 : 0.42) && Math.abs(o.fil - bilX) < 0.55) {
            o.truffet = 0.001;
            const ox = filX(m, o.fil), oy = skjY(m, o.d);
            if (o.type === 'mynt') { poeng++; api.poeng(poeng); lyd.mynt(); lyd.tone([0, 4, 7, 12, 16, 19][Math.min(5, rekke++)], 0.08); api.sprut(ox, oy, '#f4c430', 6); }
            else if (o.type === 'pytt') { lyd.plask(); fartK = Math.min(fartK, 0.75); api.sprut(ox, oy, '#5b9fd0', 14); api.sprut(ox, oy, '💧', 4); }
            else { tut(); lyd.dunk(); fartK = 0.45; ristT = 0.4; rekke = 0; o.fx = (o.fil - bilX >= 0 ? 1 : -1) * (api.rnd() < 0.5 ? 1 : -1) * 3; o.fy = 4; api.sprut(ox, oy, '#ffffff', 6); }
          }
        }
        for (let i = ting.length - 1; i >= 0; i--) if (ting[i].d < d - 3) ting.splice(i, 1);
        if (innkjøring()) fil = 1;
        if (garasjeD !== null && d >= garasjeD + 0.9) { inne = true; inneT = 0; lyd.bra(); }
      } else {
        inneT += dt;
        d += (garasjeD + 1.35 - d) * Math.min(1, dt * 5);
        if (inneT > 1.1 && inneT - dt <= 1.1) { lyd.fanfare(); api.sprut(m.cx, m.bilY - 0.5 * L, '⭐', 8); api.sprut(m.cx, m.bilY - 0.5 * L, '#f4c430', 12); }
        if (inneT > 2.6) api.ferdig({ stjerner: poeng >= mulige * 0.58 ? 3 : poeng >= mulige * 0.4 ? 2 : 1, poeng });
      }
      // myk filbytte med krenging og fjæring
      const før = bilX;
      bilX += (fil - bilX) * Math.min(1, dt * 11);
      tilt = Math.max(-0.35, Math.min(0.35, (bilX - før) / Math.max(dt, 0.001) * 0.05));
      bump = Math.max(0, bump - dt * 3);
      if (ristT > 0) ristT -= dt;

      tegnVei(m);
      for (const o of ting) {
        let y = skjY(m, o.d), x = filX(m, o.fil);
        if (y < -L || y > api.h + L) continue;
        if (o.truffet) {
          if (o.type === 'mynt') { if (o.truffet < 0.3) { o.truffet += dt; api.emoji('✨', x, y - o.truffet * 2 * L, 0.5 * L, 0, 1 - o.truffet / 0.3); } continue; }
          if (o.type !== 'pytt') { o.truffet += dt; x += o.fx * o.truffet * L; y -= (o.fy * o.truffet - 6 * o.truffet * o.truffet) * L * 0.4; o.rot += dt * 8 * Math.sign(o.fx || 1); }
        }
        if (o.type === 'kjegle') tegnKjegle(x, y, L, o.rot);
        else if (o.type === 'dunk') tegnDunk(x, y, L, o.rot);
        else if (o.type === 'pytt') tegnPytt(x, y, L);
        else tegnMynt(x, y, L, t, o.d);
      }
      if (garasjeD !== null) tegnGarasje(m, t, false);
      tegnBil(m, t);
      if (garasjeD !== null) tegnGarasje(m, t, true);
      api.framgang(Math.min(1, t / VARIGHET));
    });

    return {
      hint() {
        if (inne || innkjøring()) return null;
        const m = mål(), v = fart(m);
        const fare = (f, til) => ting.some((o) => !o.truffet && o.type !== 'mynt' && o.fil === f && o.d > d - 0.3 && o.d - d < til);
        const mynt = (f) => ting.some((o) => !o.truffet && o.type === 'mynt' && o.fil === f && o.d > d && (o.d - d) / v < 1.6);
        const trykk = (r) => ({ x: r < 0 ? api.w * 0.22 : api.w * 0.78, y: api.h * 0.62, vent: 250 });
        if (Math.abs(bilX - fil) > 0.3) return null;       // venter til filbyttet er ferdig
        const nær = v * 1.3;
        if (fare(fil, nær)) {
          const valg = [fil - 1, fil + 1].filter((f) => f >= 0 && f <= 2 && !fare(f, nær));
          if (!valg.length) return null;
          valg.sort((a, b) => (mynt(b) ? 1 : 0) - (mynt(a) ? 1 : 0));
          return trykk(valg[0] - fil);
        }
        // ingen fare: hent mynter i fila ved siden av hvis den er trygg
        if (!mynt(fil)) for (const r of [-1, 1]) { const f = fil + r; if (f >= 0 && f <= 2 && mynt(f) && !fare(f, v * 1.8)) return trykk(r); }
        return null;
      },
      tilstand() { return { poeng, mulige, fil, d: +d.toFixed(1), treff: ting.filter((o) => o.truffet && o.type !== 'mynt').length }; },
    };
  },
};

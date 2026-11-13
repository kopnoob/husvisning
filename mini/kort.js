// Vendekort (sjanger: memory). Kortene ligger med baksiden opp på stuebordet; vend to og finn like par.
// Kan ikke tapes: ingen tid, ingen straff. Tre brett per runde (6, 8 og 12 kort). Stjerner etter antall forsøk.
export default {
  id: 'kort', navn: 'Vendekort', ikon: '🃏', rom: 'Stua', hjelp: 'trykk', poengIkon: '🃏', bakgrunn: '#a8703f', hjelpEtter: 6,
  start(api) {
    const { ctx, lyd } = api;
    const MOTIV = ['🐿️', '🌰', '🏡', '🌳', '🚗', '⛳', '🛁', '🎈', '🐰', '🍰', '🌻', '🦔', '🍎', '🐞', '🧸', '🦋'];
    const BRETT = [6, 8, 12];
    const VEND = 0.3;                      // sekunder for én vending
    let brettNr = 0, kort = [], valgt = [], sjekkT = 0, lukkT = 0, forsøk = 0, par = 0, rekke = 0, feilRad = 0, blinkTegn = null;
    let fase = 'inn', faseT = 0, ferdig = false, bord = null, bordNøkkel = '';
    const flater = new Map();
    const dpr = () => Math.max(1, Math.min(2, api.canvas.width / api.w));
    const klem = (v) => Math.max(0, Math.min(1, v));
    const myk = (k) => k * k * (3 - 2 * k);
    const ut2 = (k) => { const c = 1.6; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };   // litt over mål, så tilbake

    function stokk(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(api.rnd() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
    function nyttBrett() {
      const n = BRETT[brettNr];
      const valgte = stokk(MOTIV.slice()).slice(0, n / 2);
      kort = stokk(valgte.concat(valgte)).map((tegn, i) => ({ tegn, i, åpen: false, f: 0, sett: false, tatt: false, hopp: -1, d: 0, landet: false,
        inn: 0.1 + i * 0.07, rot: (api.rnd() - 0.5) * 1.2, vrikk: 0, ut: 0 }));
      valgt = []; feilRad = 0; blinkTegn = null; rekke = 0; sjekkT = 0; lukkT = 0;
      fase = 'inn'; faseT = 0;
    }
    nyttBrett();

    // rutenettet: velg kolonner og rader som gir størst kort, stående eller liggende
    function oppsett() {
      const n = kort.length, t = api.trygg;
      const x0 = t.venstre + 10, x1 = api.w - t.høyre - 10, y0 = t.topp + 4, y1 = api.h - t.bunn - 6;
      const W = x1 - x0, H = y1 - y0;
      const gap = Math.max(10, Math.min(18, Math.min(W, H) * 0.035));
      let b = null;
      for (let kol = 1; kol <= n; kol++) {
        if (n % kol) continue;
        const rad = n / kol;
        let cw = (W - gap * (kol - 1)) / kol, ch = (H - gap * (rad - 1)) / rad;
        cw = Math.min(cw, ch * 0.8, 210); ch = Math.min(ch, cw / 0.68);
        if (!b || cw * ch > b.cw * b.ch) b = { kol, rad, cw, ch };
      }
      b.gap = gap;
      b.gw = b.kol * b.cw + (b.kol - 1) * gap; b.gh = b.rad * b.ch + (b.rad - 1) * gap;
      b.ox = x0 + (W - b.gw) / 2; b.oy = y0 + (H - b.gh) / 2;
      return b;
    }
    function plass(c, L) { return { x: L.ox + (c.i % L.kol) * (L.cw + L.gap) + L.cw / 2, y: L.oy + Math.floor(c.i / L.kol) * (L.ch + L.gap) + L.ch / 2 }; }

    // ---------------------------------------------------------------- tegnede flater, lages én gang per størrelse
    function rr(g, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
    function nyttLerret(w, h) { const s = dpr(), c = document.createElement('canvas'); c.width = Math.ceil(w * s); c.height = Math.ceil(h * s); const g = c.getContext('2d'); g.scale(s, s); return { c, g }; }
    function stjerne(g, x, y, r, tagger) { g.beginPath(); for (let i = 0; i < tagger * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / tagger, rr_ = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr_, y + Math.sin(a) * rr_); } g.closePath(); }
    function kortFlater(cw, ch) {
      const k = Math.round(cw) + 'x' + Math.round(ch) + '@' + dpr();
      let f = flater.get(k);
      if (f) return f;
      const r = cw * 0.12, m = Math.max(5, cw * 0.06);
      // baksiden: rød med rutemønster og en gul stjerne
      const b = nyttLerret(cw, ch), g = b.g;
      rr(g, 0, 0, cw, ch, r); g.fillStyle = '#fdf4e3'; g.fill();
      rr(g, m, m, cw - 2 * m, ch - 2 * m, r - m * 0.6); g.fillStyle = '#c4473a'; g.fill();
      g.save(); g.clip();
      g.strokeStyle = '#d65c4c'; g.lineWidth = Math.max(3, cw * 0.035);
      const st = cw * 0.16;
      for (let x = -ch; x < cw + ch; x += st) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + ch, ch); g.stroke(); g.beginPath(); g.moveTo(x + ch, 0); g.lineTo(x, ch); g.stroke(); }
      g.restore();
      rr(g, m * 1.9, m * 1.9, cw - 3.8 * m, ch - 3.8 * m, r * 0.6); g.strokeStyle = 'rgba(253,244,227,.55)'; g.lineWidth = 2; g.stroke();
      g.fillStyle = '#fdf4e3'; g.beginPath(); g.arc(cw / 2, ch / 2, cw * 0.2, 0, 7); g.fill();
      g.fillStyle = '#f2b632'; stjerne(g, cw / 2, ch / 2, cw * 0.15, 5); g.fill();
      // forsiden: lys papp med en tynn ramme
      const fr = nyttLerret(cw, ch), h2 = fr.g;
      rr(h2, 0, 0, cw, ch, r); h2.fillStyle = '#fffaf0'; h2.fill();
      rr(h2, m, m, cw - 2 * m, ch - 2 * m, r - m * 0.6); h2.fillStyle = '#fbefd6'; h2.fill();
      h2.strokeStyle = '#ead7b0'; h2.lineWidth = 2; h2.stroke();
      // forsiden med gullkant (funnet par)
      const gu = nyttLerret(cw, ch), h3 = gu.g;
      h3.drawImage(fr.c, 0, 0, cw, ch);
      rr(h3, 2, 2, cw - 4, ch - 4, r - 1); h3.strokeStyle = '#f2c230'; h3.lineWidth = 4; h3.stroke();
      f = { bak: b.c, fram: fr.c, gull: gu.c };
      if (flater.size > 12) flater.clear();
      flater.set(k, f);
      return f;
    }
    // stuebordet: planker med årer, kvister og et lysskjær fra vinduet
    function lagBord() {
      const W = api.w, H = api.h, { c, g } = nyttLerret(W, H);
      let frø = 11;
      const r = () => (frø = (frø * 16807) % 2147483647) / 2147483647;
      const planke = Math.max(64, Math.min(W, H) / 4.2);
      const toner = ['#b5793f', '#a96f39', '#bd8549', '#ad733d', '#b37a43'];
      for (let y = -planke * 0.3, i = 0; y < H; y += planke, i++) {
        g.fillStyle = toner[i % toner.length]; g.fillRect(0, y, W, planke);
        for (let k = 0; k < 16; k++) {
          const yy = y + r() * planke, amp = 1 + r() * 4, fr = 0.004 + r() * 0.01, ph = r() * 6;
          g.strokeStyle = r() < 0.5 ? 'rgba(90,45,15,' + (0.06 + r() * 0.1) + ')' : 'rgba(255,215,160,' + (0.05 + r() * 0.07) + ')';
          g.lineWidth = 0.8 + r() * 1.8;
          g.beginPath(); g.moveTo(0, yy);
          for (let x = 0; x <= W + 30; x += 30) g.lineTo(x, yy + Math.sin(x * fr + ph) * amp);
          g.stroke();
        }
        if (r() < 0.7) {
          const kx = r() * W, ky = y + planke * (0.3 + r() * 0.4);
          g.fillStyle = 'rgba(95,50,20,.35)'; g.beginPath(); g.ellipse(kx, ky, 9 + r() * 6, 4 + r() * 2, 0, 0, 7); g.fill();
          g.strokeStyle = 'rgba(95,50,20,.18)'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(kx, ky, 20, 8, 0, 0, 7); g.stroke();
        }
        g.fillStyle = 'rgba(60,28,8,.4)'; g.fillRect(0, y, W, 2);
        g.fillStyle = 'rgba(255,225,180,.14)'; g.fillRect(0, y + 2, W, 1.5);
        const skjøt = (0.2 + r() * 0.6) * W;
        g.fillStyle = 'rgba(60,28,8,.3)'; g.fillRect(skjøt, y, 2, planke);
      }
      let gr = g.createRadialGradient(W * 0.2, H * 0.1, 10, W * 0.2, H * 0.1, Math.max(W, H) * 0.8);
      gr.addColorStop(0, 'rgba(255,240,200,.22)'); gr.addColorStop(1, 'rgba(255,240,200,0)');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      gr = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
      gr.addColorStop(0, 'rgba(40,18,4,0)'); gr.addColorStop(1, 'rgba(40,18,4,.35)');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      return c;
    }
    function tegnBord() {
      const k = api.w + 'x' + api.h;
      if (!bord || bordNøkkel !== k) { bord = lagBord(); bordNøkkel = k; }
      ctx.drawImage(bord, 0, 0, api.w, api.h);
    }
    api.vedStørrelse(() => { bord = null; });

    // ---------------------------------------------------------------- spillets gang
    function lukkÅpne() { for (const c of valgt) c.åpen = false; valgt = []; lukkT = 0; lyd.klikk(); }
    function trykk(c) {
      if (fase !== 'spill' || !c) return;
      if (c.tatt || c.åpen) { if (!c.tatt) c.vrikk = 0.25; return; }
      if (sjekkT > 0) return;                    // venter på at to kort skal sjekkes
      if (valgt.length === 2) lukkÅpne();        // to ulike ligger åpne: trykk snur dem straks
      c.åpen = true; c.sett = true;
      lyd.sprett();
      valgt.push(c);
      if (valgt.length === 2) { forsøk++; sjekkT = VEND + 0.15; }
    }
    function sjekk() {
      const [a, b] = valgt;
      if (a.tegn === b.tegn) {
        a.tatt = b.tatt = true; a.hopp = b.hopp = 0;
        par++; rekke++; feilRad = 0;
        if (blinkTegn === a.tegn) blinkTegn = null;
        api.poeng(par);
        lyd.tone([0, 4, 7, 12, 16, 19][Math.min(rekke - 1, 5)]);
        const L = oppsett();
        for (const c of [a, b]) { const p = plass(c, L); api.sprut(p.x, p.y, '✨', 6); api.sprut(p.x, p.y, '#f5d33c', 8); }
        valgt = [];
        if (kort.every((c) => c.tatt)) { fase = 'feiring'; faseT = 0; }
      } else {
        rekke = 0; feilRad++;
        a.vrikk = b.vrikk = 0.35;
        lyd.hmm();
        lukkT = 1.0;
        if (feilRad >= 3 && !blinkTegn) {           // mange bom på rad: ett riktig par blinker svakt
          const igjen = kort.filter((c) => !c.tatt);
          blinkTegn = igjen[Math.floor(api.rnd() * igjen.length)].tegn;
        }
      }
    }
    api.peker((e) => {
      if (e.type !== 'ned' || fase !== 'spill') return;
      const L = oppsett();
      let best = null, bd = 1e9;
      for (const c of kort) {
        const p = plass(c, L);
        const dx = Math.max(0, Math.abs(e.x - p.x) - L.cw / 2), dy = Math.max(0, Math.abs(e.y - p.y) - L.ch / 2);
        const d = Math.hypot(dx, dy);
        if (d < L.gap + 14 && d < bd) { best = c; bd = d; }
      }
      trykk(best);
    });

    // ---------------------------------------------------------------- tegning
    function tegnKort(c, L, t) {
      const p = plass(c, L), cw = L.cw, ch = L.ch;
      let x = p.x, y = p.y, sk = 1, rot = 0, alfa = 1;
      if (c.d < 1) {                             // deles ut fra bunken nederst
        const e = ut2(myk(c.d) * 0.6 + c.d * 0.4);
        x = api.w / 2 + (x - api.w / 2) * e; y = api.h + ch + (y - api.h - ch) * e; rot = c.rot * (1 - c.d);
      }
      if (c.hopp >= 0 && c.hopp < 0.6) { const k = klem(c.hopp / 0.55); y -= Math.sin(k * Math.PI) * ch * 0.16; sk *= 1 + Math.sin(k * Math.PI) * 0.08; }
      if (c.vrikk > 0) rot += Math.sin(c.vrikk * 45) * 0.07 * (c.vrikk / 0.35);
      if (fase === 'feiring') { const k = klem((faseT - 0.15 - c.i * 0.06) / 0.45); y -= Math.sin(k * Math.PI) * ch * 0.22; rot += Math.sin(k * Math.PI) * 0.12 * (c.i % 2 ? 1 : -1); }
      if (fase === 'ut') { const k = myk(klem((faseT - c.i * 0.04) / 0.5)); y -= k * (p.y + ch); sk *= 1 - k * 0.4; rot += k * (c.i % 2 ? 0.5 : -0.5); alfa = 1 - k; }
      if (alfa <= 0.01) return;
      const e = myk(klem(c.f)), sx = Math.max(0.02, Math.abs(Math.cos(e * Math.PI))), løft = Math.sin(e * Math.PI);
      sk *= 1 + løft * 0.1;
      const fl = kortFlater(cw, ch);
      ctx.globalAlpha = alfa;
      // skygge på bordet, lenger unna når kortet løftes
      ctx.save(); ctx.translate(x + 3 + løft * 10, y + 6 + løft * 14); ctx.rotate(rot); ctx.scale(sx * sk, sk);
      ctx.fillStyle = 'rgba(40,18,4,.32)'; api.rundRekt(-cw / 2, -ch / 2, cw, ch, cw * 0.12); ctx.fill();
      ctx.restore();
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sx * sk, sk);
      if (e < 0.5) {
        ctx.drawImage(fl.bak, -cw / 2, -ch / 2, cw, ch);
        if (c.tegn === blinkTegn && !c.åpen) {     // svakt hint: kanten lyser opp og ned
          ctx.globalAlpha = alfa * (0.25 + 0.3 * Math.sin(t * 5) ** 2);
          ctx.strokeStyle = '#fff3a8'; ctx.lineWidth = 7; api.rundRekt(-cw / 2 + 3, -ch / 2 + 3, cw - 6, ch - 6, cw * 0.1); ctx.stroke();
          ctx.globalAlpha = alfa;
        }
      } else {
        ctx.drawImage(c.tatt && c.f >= 1 ? fl.gull : fl.fram, -cw / 2, -ch / 2, cw, ch);
        api.emoji(c.tegn, 0, 0, Math.min(cw * 0.62, ch * 0.5));
        if (c.tatt && c.f >= 1) {                   // små glimt på funnede par
          const k = (t * 0.7 + c.i * 0.37) % 1.6;
          if (k < 1) api.emoji('✨', cw * 0.3, -ch * 0.32, cw * 0.22, 0, Math.sin(k * Math.PI) * 0.9);
        }
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }
    function tegnDuk(L) {
      const pad = Math.max(12, L.gap * 1.2), x = L.ox - pad, y = L.oy - pad, w = L.gw + pad * 2, h = L.gh + pad * 2;
      ctx.fillStyle = 'rgba(40,18,4,.3)'; api.rundRekt(x + 4, y + 7, w, h, 22); ctx.fill();
      ctx.fillStyle = '#2f6b4f'; api.rundRekt(x, y, w, h, 22); ctx.fill();
      ctx.fillStyle = '#367a5a'; api.rundRekt(x + 5, y + 5, w - 10, h - 10, 18); ctx.fill();
      ctx.setLineDash([7, 6]); ctx.strokeStyle = 'rgba(255,240,200,.4)'; ctx.lineWidth = 2;
      api.rundRekt(x + 9, y + 9, w - 18, h - 18, 15); ctx.stroke(); ctx.setLineDash([]);
    }

    api.løkke((dt, t) => {
      faseT += dt;
      // vendinger
      for (const c of kort) {
        const mål = c.åpen || c.tatt ? 1 : 0;
        if (c.f < mål) c.f = Math.min(mål, c.f + dt / VEND); else if (c.f > mål) c.f = Math.max(mål, c.f - dt / VEND);
        if (c.hopp >= 0) c.hopp += dt;
        if (c.vrikk > 0) c.vrikk = Math.max(0, c.vrikk - dt);
      }
      if (fase === 'inn') {
        let alle = true;
        for (const c of kort) {
          c.d = klem((faseT - c.inn) / 0.45);
          if (c.d >= 1 && !c.landet) { c.landet = true; lyd.klikk(); }
          if (c.d < 1) alle = false;
        }
        if (alle) { fase = 'spill'; faseT = 0; }
      } else if (fase === 'spill') {
        if (sjekkT > 0) { sjekkT -= dt; if (sjekkT <= 0 && valgt.length === 2) sjekk(); }
        if (lukkT > 0) { lukkT -= dt; if (lukkT <= 0 && valgt.length === 2) lukkÅpne(); }
      } else if (fase === 'feiring') {
        if (faseT - dt <= 0.15 && faseT > 0.15) { lyd.bra(); const L = oppsett(); api.sprut(L.ox + L.gw / 2, L.oy + L.gh / 2, '⭐', 10); }
        if (faseT > 1.5) { fase = 'ut'; faseT = 0; lyd.sus(); }
      } else if (fase === 'ut') {
        if (faseT > 0.5 + kort.length * 0.04) {
          brettNr++;
          if (brettNr >= BRETT.length) {
            fase = 'slutt'; kort = [];
            if (!ferdig) { ferdig = true; api.ferdig({ stjerner: forsøk <= 21 ? 3 : forsøk <= 30 ? 2 : 1, poeng: par }); }
          } else nyttBrett();
        }
      }
      tegnBord();
      if (!kort.length) return;
      const L = oppsett();
      tegnDuk(L);
      const oppå = (c) => (c.hopp >= 0 && c.hopp < 0.6) || (c.f > 0 && c.f < 1);
      for (const c of kort) if (!oppå(c)) tegnKort(c, L, t);
      for (const c of kort) if (oppå(c)) tegnKort(c, L, t);       // kort som vendes eller hopper, ligger oppå
      const iBrett = kort.filter((c) => c.tatt).length / kort.length;
      api.framgang((Math.min(brettNr, BRETT.length) + (fase === 'ut' || fase === 'slutt' ? 1 : iBrett)) / BRETT.length);
    });

    return {
      // god hukommelse, ikke gjennomsyn: bare kort barnet har sett, regnes som kjent
      hint() {
        if (fase !== 'spill' || sjekkT > 0 || valgt.length === 2) return null;
        if (kort.some((c) => c.f > 0 && c.f < 1)) return null;
        const usett = kort.filter((c) => !c.sett && !c.tatt && !c.åpen);
        let mål = null;
        if (valgt.length === 1) {
          const a = valgt[0], make = kort.find((c) => c !== a && c.tegn === a.tegn);
          mål = make.sett ? make : usett[0];
        } else {
          const kjent = kort.find((c) => !c.tatt && c.sett && kort.some((d) => d !== c && d.tegn === c.tegn && d.sett && !d.tatt));
          mål = kjent || usett[0];
        }
        if (!mål) return null;
        const p = plass(mål, oppsett());
        return { x: p.x, y: p.y, vent: 380 };
      },
      tilstand() { return { brett: brettNr, forsøk, par, fase }; },
    };
  },
};

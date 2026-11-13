// Kikk-titt i plenen (sjanger: trykk-på-det-som-dukker-opp). Dyr titter opp av hull i plenen; trykk for å gi dem en nøtt.
// Kan ikke tapes: runden varer 45 s, og alle treff gir poeng. Eksempelspill og mal for de andre minispillene.
export default {
  id: 'titt', navn: 'Kikk-titt i plenen', ikon: '🐰', rom: 'Hagen', hjelp: 'trykk', poengIkon: '🌰', bakgrunn: '#7ec26a',
  start(api) {
    const { ctx, lyd } = api;
    const DYR = ['🐰', '🦔', '🐭', '🐸', '🐿️'];
    const VARIGHET = 45;
    const hull = [];                       // { kx, ky } i 0..1 av spillflaten, { dyr, t, liv, tatt }
    let poeng = 0, nesteT = 0.6, treff = 0;
    function flate() {                     // spillflaten under toppknappene, i skjermpunkter
      const t = api.trygg, liggende = api.w > api.h;
      const x0 = t.venstre + 6, x1 = api.w - t.høyre - 6, y0 = t.topp + 8, y1 = api.h - t.bunn - 8;
      const kol = liggende ? 4 : 3, rad = liggende ? 2 : 4;
      return { x0, y0, bw: (x1 - x0) / kol, bh: (y1 - y0) / rad, kol, rad };
    }
    function plasser() {                   // hullene følger rutenettet, også etter at skjermen snus
      const f = flate();
      hull.length = Math.min(hull.length, f.kol * f.rad);
      for (let i = 0; i < f.kol * f.rad; i++) {
        const h = hull[i] || (hull[i] = { dyr: null, t: 0, liv: 0, tatt: 0 });
        h.x = f.x0 + (i % f.kol + 0.5) * f.bw;
        h.y = f.y0 + (Math.floor(i / f.kol) + 0.62) * f.bh;
        h.r = Math.min(f.bw, f.bh) * 0.36;
      }
    }
    plasser();
    api.vedStørrelse(plasser);
    function nyttDyr() {
      const ledige = hull.filter((h) => !h.dyr);
      if (!ledige.length) return;
      const h = ledige[Math.floor(api.rnd() * ledige.length)];
      h.dyr = DYR[Math.floor(api.rnd() * DYR.length)];
      h.t = 0; h.tatt = 0;
      h.liv = Math.max(1.5, 2.8 - api.tid * 0.025);        // blir litt raskere, men aldri stressende
      lyd.plopp();
    }
    api.peker((e) => {
      if (e.type !== 'ned') return;
      let best = null, bd = 1e9;
      for (const h of hull) {
        if (!h.dyr || h.tatt) continue;
        const d = Math.hypot(e.x - h.x, e.y - (h.y - h.r * 0.5));
        if (d < h.r * 1.5 && d < bd) { best = h; bd = d; }
      }
      if (!best) return;
      best.tatt = 0.0001; treff++; poeng++;
      api.poeng(poeng);
      api.sprut(best.x, best.y - best.r * 0.6, '🌰', 5);
      lyd.tone([0, 4, 7, 12][treff % 4]);
    });
    api.løkke((dt, t) => {
      nesteT -= dt;
      if (nesteT <= 0 && t < VARIGHET - 1) { nyttDyr(); nesteT = Math.max(0.45, 1.1 - t * 0.012); }
      // plen
      ctx.fillStyle = '#7ec26a'; ctx.fillRect(0, 0, api.w, api.h);
      ctx.fillStyle = 'rgba(255,255,255,.07)';
      for (let i = 0; i < 9; i++) ctx.fillRect(0, (i * 2 + 1) * api.h / 18, api.w, api.h / 18);
      for (const h of hull) {
        // hullet
        ctx.fillStyle = '#4a3423'; ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r, h.r * 0.42, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#2f2015'; ctx.beginPath(); ctx.ellipse(h.x, h.y + h.r * 0.05, h.r * 0.82, h.r * 0.3, 0, 0, 7); ctx.fill();
        if (!h.dyr) continue;
        h.t += dt;
        if (h.tatt) h.tatt += dt;
        // opp, bli, ned. Etter treff: hopper glad og forsvinner
        let opp = Math.min(1, h.t / 0.18);
        if (!h.tatt && h.t > h.liv - 0.2) opp = Math.max(0, (h.liv - h.t) / 0.2);
        if (h.tatt) opp = 1 + Math.sin(Math.min(1, h.tatt / 0.35) * Math.PI) * 0.35;
        ctx.save();
        ctx.beginPath(); ctx.rect(h.x - h.r * 1.6, h.y - h.r * 3.2, h.r * 3.2, h.r * 3.2); ctx.clip();      // dyret er skjult under bakken
        api.emoji(h.dyr, h.x, h.y + h.r * 0.75 - opp * h.r * 1.35, h.r * 1.5, 0, h.tatt ? Math.max(0, 1 - h.tatt / 0.45) : 1);
        ctx.restore();
        if ((h.tatt && h.tatt > 0.45) || (!h.tatt && h.t > h.liv)) h.dyr = null;
      }
      api.framgang(t / VARIGHET);
      if (t >= VARIGHET) api.ferdig({ stjerner: poeng >= 22 ? 3 : poeng >= 10 ? 2 : 1, poeng });
    });
    return {
      hint() { const h = hull.find((x) => x.dyr && !x.tatt && x.t > 0.25 && x.t < x.liv - 0.4); return h ? { x: h.x, y: h.y - h.r * 0.5 } : null; },
      tilstand() { return { poeng, oppe: hull.filter((h) => h.dyr && !h.tatt).length }; },
    };
  },
};

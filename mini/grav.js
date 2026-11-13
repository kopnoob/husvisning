// Gullgraving i hagen (sjanger: skattejakt med varmt og kaldt, i slekt med minesveiper og metalldetektor-spill).
// Gullet ligger gjemt under én rute i plenen. Hvert hull viser hvor nær gullet er: ❄️ kaldt, 🌤️ lunkent, ☀️ varmt, 🔥 rett ved siden av.
// Steiner må knuses med tre slag, nøtter som Nøtte har gjemt viser en pil mot gullet, og gullet ligger dypt: når det glitrer, må man grave to ganger til.
// Tre gullklumper per runde, ny plen for hver. Det er litt vanskelig med vilje: stjernene teller hvor mange hull man trengte.
// Kan ikke tapes: etter mange hull uten funn begynner gullet å glimte svakt.
export default {
  id: 'grav', navn: 'Gullgraving', ikon: '💰', rom: 'Hagen', hjelp: 'trykk', poengIkon: '💰', bakgrunn: '#7fbf5c', hjelpEtter: 14,
  start(api) {
    const { ctx, lyd } = api;
    const N = 7, MÅL = 3;
    const BÅND = [
      { f: '#ff4b2b', e: '🔥', tone: 14 },      // rett ved siden av
      { f: '#ff9c2a', e: '☀️', tone: 9 },
      { f: '#f3d43c', e: '🌤️', tone: 5 },
      { f: '#5aa6e8', e: '❄️', tone: 0 },       // fire ruter eller mer unna
    ];
    const SKROT = ['🪱', '🦴', '👢', '🐌', '🥫', '🐞', '🔑', '🧦'];
    let fliser = [], gull = 0, stikk = 0, stikkDenne = 0, lås = 0, pil = null, ferdigT = -1, nyT = -1, sistHint = null;
    const anim = [];        // spade som stikker ned, og gull som flyr til kurven
    const funnet = [];      // gull som er hentet opp, for kurven

    function bånd(a, b) { const d = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)); return d <= 1 ? 0 : d === 2 ? 1 : d === 3 ? 2 : 3; }
    function nyPlen() {
      fliser = [];
      for (let i = 0; i < N * N; i++) fliser.push({ i, x: i % N, y: Math.floor(i / N), stein: 0, gravd: 0, gull: false, nøtt: false, skrot: null, nyans: api.rnd(), t: 9, rist: 0 });
      const ledig = () => { for (;;) { const f = fliser[Math.floor(api.rnd() * fliser.length)]; if (!f.gull && !f.stein && !f.nøtt) return f; } };
      ledig().gull = true;
      const g = fliser.find((f) => f.gull);
      for (let k = 0; k < 4 + gull * 2; k++) { const f = ledig(); if (bånd(f, g) > 0 || api.rnd() < 0.4) f.stein = 3; }        // steiner, sjelden helt inntil gullet
      // Nøttes gjemmested: aldri rett ved gullet, ellers ville pila vært bortkastet
      for (let k = 0; k < 20; k++) { const f = ledig(); if (bånd(f, g) >= 2) { f.nøtt = true; break; } }
      for (const f of fliser) if (!f.gull && !f.nøtt && api.rnd() < 0.28) f.skrot = SKROT[Math.floor(api.rnd() * SKROT.length)];
      stikkDenne = 0; pil = null; sistHint = null;
    }
    nyPlen();

    // ---------------------------------------------------------------- oppsett: plenen er kvadratisk, kurv og termometer ved siden av eller under
    function oppsett() {
      const t = api.trygg, ligg = api.w > api.h * 1.15;
      const x0 = t.venstre + 6, x1 = api.w - t.høyre - 6, y1 = api.h - t.bunn - 4;
      if (ligg) {
        const iw = Math.min(210, (x1 - x0) * 0.3), yt = Math.max(8, t.topp - 64);
        const side = Math.min(x1 - x0 - iw - 14, y1 - yt);
        const bx = x0 + iw + 14 + (x1 - x0 - iw - 14 - side) / 2, by = yt + (y1 - yt - side) / 2;
        return { bx, by, side, s: side / N, info: { x: x0, y: t.topp + 6, w: iw, h: y1 - t.topp - 6, ligg: true } };
      }
      const y0 = t.topp + 2;
      const side = Math.min(x1 - x0, (y1 - y0) * 0.74);
      const bx = x0 + (x1 - x0 - side) / 2, by = y0;
      return { bx, by, side, s: side / N, info: { x: x0, y: by + side + 10, w: x1 - x0, h: y1 - (by + side + 10), ligg: false } };
    }
    const midt = (L, f) => ({ x: L.bx + (f.x + 0.5) * L.s, y: L.by + (f.y + 0.5) * L.s });

    // ---------------------------------------------------------------- grave
    function grav(f) {
      const L = oppsett(), c = midt(L, f);
      if (f.stein > 0) {                                   // steinen sprekker litt for hvert slag
        f.stein--; f.rist = 0.25;
        lyd.dunk(); api.sprut(c.x, c.y, '#8d8d86', 6);
        if (f.stein === 0) { lyd.pop(); api.sprut(c.x, c.y, '#b9b9b1', 12); }
        lås = 0.18; return;
      }
      if (f.gull) {
        anim.push({ f, t: 0, type: 'spade' });
        if (!f.gravd) { stikk++; stikkDenne++; api.poeng(gull); }
        f.gravd++; f.t = 0; lås = 0.3;
        lyd.dunk(); api.sprut(c.x, c.y, '#7a4f2a', 10);
        if (f.gravd < 3) { lyd.tone(14 + f.gravd * 3); api.sprut(c.x, c.y, '✨', 4); }
        else hentGull(f, c);
        return;
      }
      if (f.gravd) { f.rist = 0.2; lyd.hmm(); return; }  // allerede gravd: bare en mild risting
      f.gravd = 1; f.t = 0; stikk++; stikkDenne++; lås = 0.28;
      anim.push({ f, t: 0, type: 'spade' });
      lyd.dunk(); api.sprut(c.x, c.y, '#7a4f2a', 10);
      const g = fliser.find((x) => x.gull), b = bånd(f, g);
      setTimeout(() => { if (!dødt) lyd.tone(BÅND[b].tone); }, 160);
      if (f.nøtt) {                                         // Nøttes nøtt: pila peker mot gullet
        pil = { f, til: g, t: 0 };
        setTimeout(() => { if (!dødt) { lyd.pling(); api.sprut(c.x, c.y, '🌰', 6); } }, 220);
      } else if (f.skrot) setTimeout(() => { if (!dødt) lyd.plopp(); }, 220);
    }
    function hentGull(f, c) {
      gull++; api.poeng(gull);
      lyd.fanfare(); api.sprut(c.x, c.y, '#f5c518', 24); api.sprut(c.x, c.y, '✨', 10);
      anim.push({ f, t: 0, type: 'gull', x: c.x, y: c.y });
      lås = 1.9;
      if (gull >= MÅL) ferdigT = 2.2; else nyT = 1.9;
    }

    api.peker((e) => {
      if (e.type !== 'ned' || lås > 0 || ferdigT >= 0 || nyT >= 0) return;
      const L = oppsett();
      let best = null, bd = L.s * 0.75;
      for (const f of fliser) { const c = midt(L, f), d = Math.max(Math.abs(c.x - e.x), Math.abs(c.y - e.y)); if (d < bd) { bd = d; best = f; } }
      if (best) grav(best);
    });

    // ---------------------------------------------------------------- tegning
    function gullklump(x, y, r, glans) {
      const P = [[-1, 0.15], [-0.75, -0.45], [-0.2, -0.7], [0.35, -0.6], [0.9, -0.25], [1, 0.25], [0.55, 0.62], [-0.1, 0.7], [-0.7, 0.55]];
      ctx.beginPath(); P.forEach(([a, b], i) => (i ? ctx.lineTo(x + a * r, y + b * r) : ctx.moveTo(x + a * r, y + b * r))); ctx.closePath();
      ctx.fillStyle = '#e2ad1c'; ctx.fill(); ctx.lineWidth = Math.max(1.5, r * 0.09); ctx.strokeStyle = '#9c6b06'; ctx.stroke();
      ctx.fillStyle = '#f6cf45'; ctx.beginPath(); ctx.ellipse(x - r * 0.2, y - r * 0.15, r * 0.5, r * 0.32, -0.3, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff6c4'; ctx.beginPath(); ctx.ellipse(x - r * 0.35, y - r * 0.3, r * 0.18, r * 0.1, -0.4, 0, 7); ctx.fill();
      if (glans) { ctx.globalAlpha = glans; api.emoji('✨', x + r * 0.6, y - r * 0.6, r * 0.9); ctx.globalAlpha = 1; }
    }
    function tegnFlis(L, f, t) {
      const s = L.s, x = L.bx + f.x * s, y = L.by + f.y * s;
      let ox = 0;
      if (f.rist > 0) ox = Math.sin(f.rist * 70) * s * 0.05;
      const rute = (f.x + f.y) % 2 === 0;
      if (!f.gravd) {
        ctx.fillStyle = rute ? '#6fb84c' : '#64ad43'; ctx.fillRect(x, y, s, s);
        ctx.strokeStyle = 'rgba(40,90,25,.55)'; ctx.lineWidth = Math.max(1, s * 0.035);
        for (let k = 0; k < 3; k++) {                       // gresstuster
          const gx = x + s * (0.2 + ((f.nyans * 7 + k * 0.31) % 0.6)), gy = y + s * (0.3 + ((f.nyans * 13 + k * 0.27) % 0.5));
          ctx.beginPath(); ctx.moveTo(gx - s * 0.05, gy); ctx.lineTo(gx - s * 0.08, gy - s * 0.1); ctx.moveTo(gx, gy); ctx.lineTo(gx, gy - s * 0.13); ctx.moveTo(gx + s * 0.05, gy); ctx.lineTo(gx + s * 0.09, gy - s * 0.1); ctx.stroke();
        }
        if (f.stein > 0) {
          const cx = x + s / 2 + ox, cy = y + s * 0.54, r = s * 0.36;
          ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(cx + 2, cy + r * 0.55, r, r * 0.35, 0, 0, 7); ctx.fill();
          ctx.fillStyle = '#9d9c95'; ctx.beginPath(); ctx.moveTo(cx - r, cy + r * 0.4); ctx.lineTo(cx - r * 0.85, cy - r * 0.35); ctx.lineTo(cx - r * 0.2, cy - r * 0.75); ctx.lineTo(cx + r * 0.6, cy - r * 0.55); ctx.lineTo(cx + r, cy + 0.05 * r); ctx.lineTo(cx + r * 0.75, cy + r * 0.55); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#b7b6ae'; ctx.beginPath(); ctx.moveTo(cx - r * 0.7, cy - r * 0.25); ctx.lineTo(cx - r * 0.15, cy - r * 0.6); ctx.lineTo(cx + r * 0.4, cy - r * 0.45); ctx.lineTo(cx - r * 0.1, cy - r * 0.1); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = '#4d4c47'; ctx.lineWidth = Math.max(1.5, s * 0.04); ctx.beginPath();          // sprekker etter slag
          if (f.stein <= 2) { ctx.moveTo(cx - r * 0.1, cy - r * 0.6); ctx.lineTo(cx + r * 0.05, cy - r * 0.1); ctx.lineTo(cx - r * 0.2, cy + r * 0.3); }
          if (f.stein <= 1) { ctx.moveTo(cx + r * 0.05, cy - r * 0.1); ctx.lineTo(cx + r * 0.6, cy + r * 0.1); ctx.moveTo(cx - r * 0.2, cy + r * 0.3); ctx.lineTo(cx - r * 0.65, cy + r * 0.2); }
          ctx.stroke();
        }
        // gullet glimter svakt etter mange hull, så runden alltid tar slutt
        if (f.gull && stikkDenne >= 10) { const k = (Math.sin(t * 3 + f.i) + 1) / 2; api.emoji('✨', x + s * 0.5, y + s * 0.45, s * (0.3 + 0.2 * k), 0, 0.25 + 0.5 * k); }
        return;
      }
      // gravd rute: jord, og fargen viser hvor varmt det er
      ctx.fillStyle = '#8b5d36'; ctx.fillRect(x, y, s, s);
      const inn = Math.min(1, f.t / 0.3);
      if (f.gull) {
        const r = s * (0.24 + f.gravd * 0.06);
        ctx.fillStyle = '#3d2614'; ctx.beginPath(); ctx.ellipse(x + s / 2 + ox, y + s * 0.55, r, r * 0.62, 0, 0, 7); ctx.fill();
        if (f.gravd < 3) {
          ctx.fillStyle = 'rgba(255,214,64,.35)'; ctx.fillRect(x, y, s, s);
          const k = (Math.sin(t * 6) + 1) / 2;
          api.emoji('✨', x + s * 0.5, y + s * 0.5, s * (0.38 + 0.12 * k)); api.emoji('✨', x + s * 0.25, y + s * 0.28, s * 0.2, 0, k);
        }
        return;
      }
      const b = bånd(f, fliser.find((g) => g.gull));
      ctx.globalAlpha = 0.5 * inn; ctx.fillStyle = BÅND[b].f; ctx.fillRect(x, y, s, s); ctx.globalAlpha = 1;
      ctx.fillStyle = '#4a2f19'; ctx.beginPath(); ctx.ellipse(x + s / 2 + ox, y + s * 0.56, s * 0.32, s * 0.22, 0, 0, 7); ctx.fill();
      ctx.lineWidth = Math.max(2, s * 0.07); ctx.strokeStyle = BÅND[b].f; ctx.stroke();
      if (f.nøtt) api.emoji('🌰', x + s * 0.5 + ox, y + s * (0.62 - 0.25 * inn), s * 0.42);
      else {
        api.emoji(BÅND[b].e, x + s * 0.5 + ox, y + s * 0.5, s * 0.42 * (0.6 + 0.4 * inn));
        if (f.skrot) api.emoji(f.skrot, x + s * 0.8, y + s * (0.3 - 0.1 * inn), s * 0.26, 0.4, inn);
      }
    }
    function tegnPil(L, t) {
      if (!pil) return;
      pil.t += 0;
      const a = midt(L, pil.f), b = midt(L, pil.til);
      const ang = Math.round(Math.atan2(b.y - a.y, b.x - a.x) / (Math.PI / 4)) * (Math.PI / 4);   // åtte retninger, ikke helt nøyaktig
      const k = Math.min(1, (t - pil.start) / 0.4), len = L.s * 1.25 * k;
      const ex = a.x + Math.cos(ang) * len, ey = a.y + Math.sin(ang) * len;
      const puls = t - pil.start < 3 ? 0.6 + 0.4 * Math.sin(t * 9) : 0.75;
      ctx.globalAlpha = puls;
      ctx.lineCap = 'round'; ctx.strokeStyle = '#fff4b0'; ctx.lineWidth = L.s * 0.2;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.strokeStyle = '#f2a541'; ctx.lineWidth = L.s * 0.11; ctx.stroke();
      ctx.fillStyle = '#f2a541'; ctx.beginPath();
      ctx.moveTo(ex + Math.cos(ang) * L.s * 0.28, ey + Math.sin(ang) * L.s * 0.28);
      ctx.lineTo(ex + Math.cos(ang + 2.4) * L.s * 0.24, ey + Math.sin(ang + 2.4) * L.s * 0.24);
      ctx.lineTo(ex + Math.cos(ang - 2.4) * L.s * 0.24, ey + Math.sin(ang - 2.4) * L.s * 0.24); ctx.closePath(); ctx.fill();
      ctx.lineCap = 'butt'; ctx.globalAlpha = 1;
    }
    // plassene til gullet (midt over termometeret)
    function plass(L, k) {
      const I = L.info, kr = Math.min(I.ligg ? I.w / 7 : I.w / 10, 30);
      return { x: I.x + I.w / 2 + (k - 1) * kr * 2.3, y: I.y + kr * 1.15, kr };
    }
    // kurven med gullet og termometeret som forklarer fargene uten ord
    function tegnInfo(L, t) {
      const I = L.info, ligg = I.ligg;
      const kr = plass(L, 0).kr;
      for (let k = 0; k < MÅL; k++) {
        const { x: cx, y: cy } = plass(L, k);
        ctx.fillStyle = 'rgba(70,40,15,.25)'; ctx.beginPath(); ctx.arc(cx, cy, kr, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(255,250,235,.8)'; ctx.lineWidth = 3; ctx.setLineDash([5, 5]); ctx.stroke(); ctx.setLineDash([]);
        if (k < funnet.length) gullklump(cx, cy, kr * 0.72, 0);
      }
      // termometer: kaldt til varmt til gull
      const rad = ['❄️', '🌤️', '☀️', '🔥'];
      const th = Math.min(46, kr * 1.5), tx = ligg ? I.x + 6 : I.x + 4, ty = I.y + kr * 2.55 + 8, tw = ligg ? I.w - 12 : I.w - 140;
      const gr = ctx.createLinearGradient(tx, 0, tx + tw, 0);
      gr.addColorStop(0, BÅND[3].f); gr.addColorStop(0.4, BÅND[2].f); gr.addColorStop(0.7, BÅND[1].f); gr.addColorStop(1, BÅND[0].f);
      ctx.fillStyle = 'rgba(255,250,235,.85)'; api.rundRekt(tx - 4, ty - 4, tw + 8, th + 8, (th + 8) / 2); ctx.fill();
      ctx.fillStyle = gr; api.rundRekt(tx, ty, tw, th, th / 2); ctx.fill();
      rad.forEach((e, k) => api.emoji(e, tx + th * 0.5 + k * (tw - th * 1.6) / 3, ty + th / 2, th * 0.62));
      gullklump(tx + tw - th * 0.42, ty + th / 2, th * 0.3, 0);
      // spadestikk så langt
      const sy = ligg ? ty + th + 30 : ty + th / 2, sx = ligg ? I.x + I.w / 2 : I.x + I.w - 62;
      ctx.fillStyle = 'rgba(255,250,235,.9)'; api.rundRekt(sx - 52, sy - 22, 104, 44, 22); ctx.fill();
      api.emoji('🪏', sx - 24, sy, 28);
      ctx.fillStyle = '#4a2f19'; ctx.font = '700 24px -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(stikk), sx + 18, sy + 1);
    }

    api.løkke((dt, t) => {
      if (lås > 0) lås -= dt;
      for (const f of fliser) { f.t += dt; if (f.rist > 0) f.rist = Math.max(0, f.rist - dt); }
      if (pil && pil.start === undefined) pil.start = t;
      if (nyT >= 0) { nyT -= dt; if (nyT < 0) { nyT = -1; nyPlen(); lyd.sus(); } }
      if (ferdigT >= 0) { ferdigT -= dt; if (ferdigT < 0) { ferdigT = -1e9; api.ferdig({ stjerner: stikk <= 15 ? 3 : stikk <= 24 ? 2 : 1, poeng: gull }); } }
      const L = oppsett();
      // hage rundt plenen: hekk i bakgrunnen og gressstriper
      ctx.fillStyle = '#7fbf5c'; ctx.fillRect(0, 0, api.w, api.h);
      ctx.fillStyle = '#78b655'; for (let i = 0; i < 12; i++) if (i % 2) ctx.fillRect(0, i * api.h / 12, api.w, api.h / 12);
      ctx.fillStyle = 'rgba(0,0,0,.16)'; api.rundRekt(L.bx - 4, L.by - 2, L.side + 12, L.side + 12, 12); ctx.fill();
      ctx.fillStyle = '#5e3b1f'; api.rundRekt(L.bx - 8, L.by - 8, L.side + 16, L.side + 16, 14); ctx.fill();
      ctx.save(); api.rundRekt(L.bx, L.by, L.side, L.side, 8); ctx.clip();
      for (const f of fliser) tegnFlis(L, f, t);
      ctx.restore();
      tegnPil(L, t);
      // spaden som stikker ned, og gullet som flyr opp i kurven
      for (let i = anim.length - 1; i >= 0; i--) {
        const a = anim[i]; a.t += dt;
        if (a.type === 'spade') {
          const c = midt(L, a.f), k = Math.min(1, a.t / 0.25);
          api.emoji('🪏', c.x + L.s * 0.22, c.y - L.s * (0.7 - 0.45 * k), L.s * 0.75, -0.5 + 0.3 * k, 1 - Math.max(0, (a.t - 0.25) / 0.15));
          if (a.t > 0.4) anim.splice(i, 1);
        } else {
          const { x: mx, y: my, kr } = plass(L, funnet.length);
          const c = midt(L, a.f);
          if (a.t < 0.9) { const k = Math.min(1, a.t / 0.35); gullklump(c.x, c.y - L.s * 0.3 * k, L.s * (0.25 + 0.3 * k), 1); }
          else {
            const k = Math.min(1, (a.t - 0.9) / 0.6), e = k * k * (3 - 2 * k);
            gullklump(c.x + (mx - c.x) * e, c.y - L.s * 0.3 + (my - c.y + L.s * 0.3) * e - Math.sin(k * Math.PI) * 60, L.s * 0.55 + (kr * 0.72 - L.s * 0.55) * e, 1 - k);
          }
          if (a.t >= 1.5) { anim.splice(i, 1); funnet.push(1); lyd.mynt(); }
        }
      }
      tegnInfo(L, t);
    });

    let dødt = false;
    return {
      // godt trekk: en rute som stemmer med alle ledetrådene så langt (midt i de som er igjen), eller rett på gullet når det glitrer
      hint() {
        if (lås > 0 || ferdigT >= 0 || nyT >= 0 || anim.some((a) => a.type === 'gull')) return null;
        const L = oppsett();
        const glitrer = fliser.find((f) => f.gull && f.gravd > 0);
        if (glitrer) { const c = midt(L, glitrer); return { x: c.x, y: c.y, vent: 380 }; }
        const nøkkel = stikk + ':' + fliser.filter((f) => f.stein).length;
        if (!sistHint || sistHint.k !== nøkkel) {
          const hull = fliser.filter((f) => f.gravd && !f.gull);
          const g = fliser.find((f) => f.gull);
          const kand = fliser.filter((f) => !f.gravd && !f.stein && hull.every((h) => bånd(h, f) === bånd(h, g)) &&
            (!pil || (() => { const a = Math.atan2(f.y - pil.f.y, f.x - pil.f.x), b = Math.atan2(g.y - pil.f.y, g.x - pil.f.x); return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) < 0.8; })()));
          const mx = kand.reduce((a, f) => a + f.x, 0) / Math.max(1, kand.length), my = kand.reduce((a, f) => a + f.y, 0) / Math.max(1, kand.length);
          kand.sort((a, b) => Math.hypot(a.x - mx, a.y - my) - Math.hypot(b.x - mx, b.y - my));
          sistHint = { k: nøkkel, f: kand[0] || g };
        }
        const c = midt(L, sistHint.f);
        return { x: c.x, y: c.y, vent: 380 };
      },
      tilstand() { return { gull, stikk, stikkDenne, steiner: fliser.filter((f) => f.stein).length }; },
      stopp() { dødt = true; },
    };
  },
};

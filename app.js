// Selve 3D-visningen. Lastes av oppstartsskriptet i index.html først når modusen er valgt (window.HUS_MODUS).
// Moduser: full (Mac), lett (dagens mobilmodus) og enkel (forsiktigst mulig for telefoner som ikke tåler lett).
// Unngår toppnivå-await, OffscreenCanvas, regex-lookbehind og structuredClone, så koden går fra iOS 15.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Octree } from 'three/addons/math/Octree.js';
import { Capsule } from 'three/addons/math/Capsule.js';

const smule = window.husSmule || (() => {});
smule('three.js lastet');
const V = '?v=' + (window.HUS_V || '5');           // på egne filer, så telefonen ikke bruker gamle kopier
const $ = (id) => document.getElementById(id);
const PARAM = new URLSearchParams(location.search);
const iPadSomMac = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
const mobil = matchMedia('(pointer: coarse)').matches || /iPhone|iPad|Android/i.test(navigator.userAgent) || iPadSomMac;
if (mobil) document.body.classList.add('mobil');
const MODUS = window.HUS_MODUS || 'full';
const ENKEL = MODUS === 'enkel';
const LETT = MODUS !== 'full';          // enkel er også lett
const SPILL = !!window.HUS_SPILL;       // skattejakten (spill.js) styrer berøring, mus og grensesnitt

function visFeil(tittel, tekst) {
  smule('feilmelding: ' + tittel);
  const lenke = (q, t) => `<a href="${location.pathname}${q}">${t}</a>`;
  $('feil').innerHTML = `<div class="boks"><h2>${tittel}</h2><p>${tekst}</p>${lenke('', 'Til startskjermen')}${ENKEL ? '' : lenke('?enkel', 'Prøv enkel versjon')}</div>`;
  $('feil').style.display = 'grid';
  $('last').style.display = 'none';
}
const nesteBilde = () => new Promise((r) => requestAnimationFrame(() => r()));

// ---------- koordinater: modellen er i Blender-mål (X øst, Y nord, Z opp). three.js: x = X, y = Z, z = -Y
const T = (X, Y, Z) => new THREE.Vector3(X, Z, -Y);

// hoppesteder: [navn, tast, føtter (X, Y, Z), ser mot (X, Y)]
const STEDER = [
  ['Entré', '1', [8.6, 10.3, 0.0], [8.6, 7.0]],
  ['Kjøkken', '2', [12.6, 6.7, -0.385], [14.4, 8.6]],
  ['Stue', '3', [9.0, 6.4, 0.0], [6.6, 3.2]],
  ['2. etasje', '4', [8.7, 8.45, 2.776], [12.0, 8.3]],
  ['Loft', '5', [6.6, 6.5, 5.42], [12.0, 6.9]],
  ['Terrasse', '6', [16.6, -0.75, -0.425], [13.2, 3.0]],
  ['Anneks', '7', [-6.0, -2.2, -0.435], [-6.5, -6.5]],
  ['Garasje', '8', [-3.3, 11.0, -0.516], [-6.8, 7.4]],
  ['Foran huset', '9', [8.0, 18.5, -0.55], [8.6, 11.0]],
];

// rom der man er «inne» (Blender X0, X1, Y0, Y1): styrer lysnivå og eksponering
const INNE = [[1.51, 16.49, 3.02, 11.27], [5.74, 9.31, 2.21, 3.02], [2.845, 5.19, 11.27, 13.055], [-7.75, -1.0, 5.81, 13.01], [-9.0, -4.0, -7.4, 0.6]];

// ---------- renderer og scene
let renderer;
try {
  smule('lager renderer');
  renderer = new THREE.WebGLRenderer({ antialias: !ENKEL, powerPreference: ENKEL ? 'default' : 'high-performance' });
  smule('renderer opprettet (WebGL' + (renderer.capabilities.isWebGL2 ? '2' : '1') + ')');
} catch (e) {
  visFeil('3D-visningen kan ikke starte', 'Nettleseren fikk ikke tilgang til WebGL-grafikk. Prøv en annen nettleser, eller slå på maskinvareakselerasjon.');
  throw e;
}
let pikselratio = ENKEL ? 1 : Math.min(devicePixelRatio, LETT ? 1.25 : 1.5);
renderer.setPixelRatio(pikselratio);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = !ENKEL;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
document.body.prepend(renderer.domElement);
renderer.info.autoReset = false;
let kontekstTapt = false;
renderer.domElement.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  kontekstTapt = true;
  smule('WebGL-konteksten gikk tapt');
  visFeil('Grafikken stoppet', 'Enheten gikk tom for grafikkminne eller satte 3D-visningen på pause. Last siden på nytt for å fortsette.');
});

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fb6cc);
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 400);
// synsfelt: 72° loddrett som før, men aldri smalere enn ca. 64° vannrett (stående telefon får da høyere loddrett synsfelt)
const VANNRETT_MIN = 64;
function settSynsfelt() {
  const a = innerWidth / innerHeight;
  const v = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(VANNRETT_MIN / 2)) / a);
  camera.fov = Math.min(110, Math.max(72, THREE.MathUtils.radToDeg(v)));
  camera.aspect = a;
  camera.updateProjectionMatrix();
}
settSynsfelt();
camera.rotation.order = 'YXZ';

const sol = new THREE.DirectionalLight(0xfff1df, 3.2);
sol.castShadow = !ENKEL;
const SKYGGE = LETT ? 1024 : mobil ? 2048 : 4096;
sol.shadow.mapSize.set(SKYGGE, SKYGGE);
sol.shadow.bias = -0.0004;
sol.shadow.normalBias = 0.025;
scene.add(sol, sol.target);
let himmelLys = null;
if (ENKEL) {
  // enkel: ingen HDR-himmel eller omgivelseskart, bare himmel/bakke-lys og sola
  himmelLys = new THREE.HemisphereLight(0xdfeaf5, 0xb3aa9c, 2.2);
  scene.add(himmelLys);
}

const lamper = [];          // pool av punktlys som flyttes til de nærmeste lampene
const LAMPER = ENKEL ? 2 : LETT ? 4 : mobil ? 6 : 10;
for (let i = 0; i < LAMPER; i++) {
  const l = new THREE.PointLight(0xffdcb8, 0, 9, 2);
  l.userData.mål = 0;
  scene.add(l);
  lamper.push(l);
}

// ---------- skyggelegging i krokene (N8AO, skjermrom). Slås av på mobil og hvis maskinen sliter
// i lettmodus lages ikke etterbehandlingen i det hele tatt (den har egne skjermbuffere)
let aoPaa = false;
let composer = null, ao = null;
async function lagEtterbehandling() {
  const [{ EffectComposer }, { OutputPass }, { N8AOPass }] = await Promise.all([
    import('three/addons/postprocessing/EffectComposer.js'), import('three/addons/postprocessing/OutputPass.js'), import('n8ao')]);
  composer = new EffectComposer(renderer);
  ao = new N8AOPass(scene, camera, innerWidth, innerHeight);
  ao.configuration.aoRadius = 1.2;
  ao.configuration.distanceFalloff = 0.8;
  ao.configuration.intensity = 3.2;
  ao.configuration.aoSamples = 12;
  ao.configuration.denoiseSamples = 6;
  ao.configuration.denoiseRadius = 8;
  ao.configuration.halfRes = true;
  ao.configuration.gammaCorrection = false;
  ao.beautyRenderTarget.samples = 4;
  composer.addPass(ao);
  composer.addPass(new OutputPass());
  composer.setPixelRatio(pikselratio);
  composer.setSize(innerWidth, innerHeight);
  aoPaa = !mobil && !PARAM.has('utenao');
}

// ---------- lasting (rekkefølgen og brødsmulene er laget for å finne ut hvor en telefon eventuelt stopper)
const manager = new THREE.LoadingManager();
const gltf = new GLTFLoader(manager);
const fremdrift = {};
function vis(navn, del) {
  fremdrift[navn] = del;
  const v = Object.values(fremdrift);
  const p = v.reduce((a, b) => a + b, 0) / (ENKEL ? 3 : 4);
  $('lastStolpe').style.width = Math.round(Math.min(1, p) * 100) + '%';
}
const tekst = (t) => { $('lastTekst').textContent = t; };
const mb = (n) => (n / 1e6).toFixed(1).replace('.', ',');

function hentBuffer(url, navn) {
  return new Promise((ok, feil) => new THREE.FileLoader(manager).setResponseType('arraybuffer')
    .load(url + V, ok, (e) => e.total && vis(navn, 0.9 * e.loaded / e.total), feil));
}
async function lastGlb(url, navn, etikett) {
  smule(etikett + ': laster ned');
  let buf = await hentBuffer(url, navn);
  const str = buf.byteLength;
  smule(`${etikett}: lastet ned (${mb(str)} MB)`);
  await nesteBilde();
  const res = await new Promise((ok, feil) => gltf.parse(buf, '', ok, feil));
  buf = null;
  vis(navn, 1);
  smule(etikett + ': tolket');
  return res;
}

let worldOctree = null;
let lysListe = [];

async function last() {
  if (!LETT) await lagEtterbehandling();
  if (!ENKEL) {
    const { DRACOLoader } = await import('three/addons/loaders/DRACOLoader.js');
    const draco = new DRACOLoader(manager).setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/gltf/');
    if (LETT) draco.setWorkerLimit(1);
    gltf.setDRACOLoader(draco);
  }
  const lysData = await fetch('lys.json' + V).then((r) => r.json());
  const info = await fetch('info.json' + V).then((r) => r.json());

  // kollisjon først (liten), så modellen, så himmelen: én ting om gangen gir lavere topp i minnet
  tekst('Laster kollisjon');
  const kol = await lastGlb(ENKEL ? 'kollisjon-enkel.glb' : 'kollisjon.glb', 'kol', 'kollisjon');
  worldOctree = new Rutenett(1.0).fraNode(kol.scene);
  smule(`kollisjon klar (${worldOctree.antall} trekanter, ${worldOctree.refs} ruteoppføringer)`);
  lysListe = lysData.map((l) => ({ p: new THREE.Vector3(...l.p), w: l.w, c: new THREE.Color(...l.c), t: l.t }));

  tekst('Laster modellen');
  const modell = await lastGlb(ENKEL ? 'eikhus-enkel.glb' : LETT ? 'eikhus-lett.glb' : 'eikhus.glb', 'modell', 'modell');

  if (!ENKEL) {
    tekst('Laster himmelen');
    smule('himmel: laster');
    const { RGBELoader } = await import('three/addons/loaders/RGBELoader.js');
    const himmel = await new Promise((ok, feil) => new RGBELoader(manager).load((LETT ? 'himmel-lett.hdr' : 'himmel.hdr') + V, (t) => { vis('him', 1); ok(t); }, undefined, feil));
    himmel.mapping = THREE.EquirectangularReflectionMapping;
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromEquirectangular(himmel).texture;
    pmrem.dispose();
    scene.background = himmel;
    scene.backgroundIntensity = 1.0;
    smule('himmel klar');
  }
  tekst('Gjør klar lys og materialer');
  await nesteBilde();

  // sol fra samme retning som i HDRI-en (dreid som i filmen)
  const sd = new THREE.Vector3(...info.sol).normalize();
  const midt = T(4.5, 4.5, 0);
  sol.position.copy(midt).addScaledVector(sd, 60);
  sol.target.position.copy(midt);
  if (ENKEL) sol.intensity = 2.4;
  const sc = sol.shadow.camera;
  sc.left = -30; sc.right = 30; sc.top = 30; sc.bottom = -30; sc.near = 1; sc.far = 140;
  sc.updateProjectionMatrix();

  // materialer: glass, gjennomskinnelig og lysende
  let tris = 0;
  const enkelMat = new Map();
  modell.scene.traverse((o) => {
    if (!o.isMesh) return;
    let m = o.material;
    const navn = (m.name || '').toLowerCase();
    tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
    o.castShadow = !ENKEL;
    o.receiveShadow = !ENKEL;
    if (ENKEL) {
      // enkle Lambert-materialer uten ekstra kart
      if (!enkelMat.has(m)) {
        const l = new THREE.MeshLambertMaterial({ name: m.name, color: m.color, emissive: m.emissive, emissiveIntensity: m.emissiveIntensity,
          transparent: m.transparent, opacity: m.opacity, side: m.side, alphaTest: m.alphaTest, depthWrite: m.depthWrite });
        m.dispose();
        enkelMat.set(m, l);
      }
      m = o.material = enkelMat.get(m);
    }
    if (m.transmission > 0 || navn.includes('glass') || navn === 'vann') {
      m.transmission = 0;
      m.transparent = true;
      m.depthWrite = false;
      m.opacity = navn.includes('rav') ? 0.75 : navn === 'gardin' ? 0.92 : ENKEL ? 0.15 : 0.1;
      if (navn.includes('vindusglass')) { m.color.setRGB(0.85, 0.92, 0.95); m.roughness = 0.02; m.metalness = 0.0; m.envMapIntensity = 0.6; }
      o.castShadow = navn === 'gardin' && !ENKEL;
      o.renderOrder = 2;
    }
    if (navn === 'w gress.001' || navn === 'w asfalt.001' || navn === 'w grus.001') o.castShadow = false;
    if (m.emissiveIntensity > 0 && m.emissive && (m.emissive.r + m.emissive.g + m.emissive.b) > 0) {
      o.castShadow = false;
      m.emissiveIntensity = Math.min(m.emissiveIntensity, navn.startsWith('led') ? 6 : 3);
    }
    if (m.map) m.map.anisotropy = LETT ? 4 : 8;
    o.matrixAutoUpdate = false;
    o.updateMatrix();
    if (LETT) frigjorEtterOpplasting(o.geometry, m);
  });
  scene.add(modell.scene);
  renderer.shadowMap.needsUpdate = true;
  smule('materialer klare');

  if (ENKEL) await enkleTeksturer(enkelMat);
  else await lastOppTeksturer();

  window.eik.info = { ...info, trekanterLastet: Math.round(tris), modus: MODUS };
  return true;
}

// lett og full: teksturene er dekodet av lasteren; last dem opp til grafikkortet én og én med pusterom mellom
async function lastOppTeksturer() {
  const alle = new Set();
  scene.traverse((o) => { if (o.material) for (const k in o.material) { const t = o.material[k]; if (t && t.isTexture) alle.add(t); } });
  let k = 0;
  for (const t of alle) {
    renderer.initTexture(t);
    k++;
    if (k % 10 === 0 || k === alle.size) { smule(`teksturer lastet opp ${k}/${alle.size}`); tekst(`Laster opp bilder ${k}/${alle.size}`); }
    await nesteBilde();
  }
}

// enkel: teksturene ligger som små egne filer; hent, dekod og last opp én og én
async function enkleTeksturer(enkelMat) {
  const liste = await fetch('enkel/tekstur.json' + V).then((r) => r.json());
  const perNavn = new Map();
  for (const m of enkelMat.values()) perNavn.set(m.name, m);
  const jobber = Object.entries(liste).filter(([n]) => perNavn.has(n));
  const filer = new Map();
  let k = 0;
  smule(`teksturer: 0/${jobber.length}`);
  for (const [navn, d] of jobber) {
    const m = perNavn.get(navn);
    let t = filer.get(d.fil);
    if (!t) {
      const img = new Image();
      img.src = 'enkel/' + d.fil + V;
      try { await img.decode(); } catch (e) { await new Promise((ok) => { if (img.complete) ok(); else { img.onload = ok; img.onerror = ok; } }); }
      if (!img.naturalWidth) { smule('tekstur feilet: ' + d.fil); continue; }
      t = new THREE.Texture(img);
      t.flipY = false;
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 2;
      t.userData.str = [img.naturalWidth, img.naturalHeight];
      t.needsUpdate = true;
      renderer.initTexture(t);
      t.image = null;                         // lastet opp; JavaScript-kopien trengs ikke lenger
      filer.set(d.fil, t);
    }
    if (d.emit) m.emissiveMap = t; else { m.map = t; m.color.setRGB(1, 1, 1); }
    if (d.alfa) { m.alphaTest = 0.5; m.side = THREE.DoubleSide; }
    m.needsUpdate = true;
    k++;
    if (k % 10 === 0 || k === jobber.length) { smule(`teksturer lastet opp ${k}/${jobber.length}`); tekst(`Laster bilder ${k}/${jobber.length}`); }
    await nesteBilde();
  }
}

// lettmodus: når en tekstur eller et nett er lastet opp til grafikkortet, trengs ikke kopien i JavaScript lenger
const _frigjort = new Set();
function frigjorEtterOpplasting(geo, m) {
  if (!_frigjort.has(geo)) {
    _frigjort.add(geo);
    geo.computeBoundingSphere();      // trengs til synsfeltutvelgelse, så de må regnes ut før tallene slippes
    geo.computeBoundingBox();
    const slipp = function () { this.array = null; };
    for (const a of Object.values(geo.attributes)) a.onUpload(slipp);
    if (geo.index) geo.index.onUpload(slipp);
  }
  for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap', 'alphaMap']) {
    const t = m[k];
    if (!t || _frigjort.has(t)) continue;
    _frigjort.add(t);
    t.onUpdate = () => {
      const img = t.image;
      if (img) t.userData.str = [img.width, img.height];          // til målinger
      if (img && typeof img.close === 'function') img.close();     // ImageBitmap
      t.onUpdate = null;
    };
  }
}

// ---------- kollisjon: rutenett i grunnplanet (X, Z) i stedet for three.js-Octree.
// Octree delte seg ned til nivå 16 rundt store trekanter (bakken, vegger) og laget 5,6 millioner blader og over 3 GB
// i JavaScript-minnet. Her ligger hver trekant i rutene dens omsluttende boks dekker; kapseltesten er den samme som i Octree.
const _tcap = Octree.prototype.triangleCapsuleIntersect;
class Rutenett {
  constructor(rute) { this.rute = rute; this.celler = new Map(); this.tri = []; this.bokser = []; this.merke = null; this.stempel = 0; this.antall = 0; this.refs = 0; }
  nokkel(i, k) { return i * 100003 + k; }
  fraNode(node) {
    node.updateMatrixWorld(true);
    node.traverse((o) => {
      if (!o.isMesh) return;
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i += 3) {
        const t = new THREE.Triangle(
          new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld),
          new THREE.Vector3().fromBufferAttribute(pos, i + 1).applyMatrix4(o.matrixWorld),
          new THREE.Vector3().fromBufferAttribute(pos, i + 2).applyMatrix4(o.matrixWorld));
        this.legg(t);
      }
      if (g !== o.geometry) g.dispose();
      o.geometry.dispose();
    });
    this.merke = new Uint32Array(this.tri.length);
    return this;
  }
  legg(t) {
    const id = this.tri.length;
    const b = new THREE.Box3().setFromPoints([t.a, t.b, t.c]);
    this.tri.push(t); this.bokser.push(b); this.antall++;
    const r = this.rute;
    for (let i = Math.floor(b.min.x / r); i <= Math.floor(b.max.x / r); i++) {
      for (let k = Math.floor(b.min.z / r); k <= Math.floor(b.max.z / r); k++) {
        const n = this.nokkel(i, k);
        let c = this.celler.get(n);
        if (!c) { c = []; this.celler.set(n, c); }
        c.push(id); this.refs++;
      }
    }
  }
  // trekanter i rutene en stråle går gjennom (Amanatides og Woo i grunnplanet), opptil maks meter
  getRayTriangles(ray, ut, maks = 60) {
    const r = this.rute, o = ray.origin, d = ray.direction;
    const st = ++this.stempel;
    let i = Math.floor(o.x / r), k = Math.floor(o.z / r);
    const si = d.x > 0 ? 1 : -1, sk = d.z > 0 ? 1 : -1;
    const dx = Math.abs(d.x) < 1e-9 ? Infinity : r / Math.abs(d.x), dz = Math.abs(d.z) < 1e-9 ? Infinity : r / Math.abs(d.z);
    let tx = Math.abs(d.x) < 1e-9 ? Infinity : ((d.x > 0 ? (i + 1) * r - o.x : o.x - i * r) / Math.abs(d.x));
    let tz = Math.abs(d.z) < 1e-9 ? Infinity : ((d.z > 0 ? (k + 1) * r - o.z : o.z - k * r) / Math.abs(d.z));
    for (let steg = 0; steg < 2000; steg++) {
      const c = this.celler.get(this.nokkel(i, k));
      if (c) for (const id of c) if (this.merke[id] !== st) { this.merke[id] = st; ut.push(this.tri[id]); }
      if (Math.min(tx, tz) > maks) break;
      if (tx < tz) { i += si; tx += dx; } else { k += sk; tz += dz; }
    }
    return ut;
  }
  getCapsuleTriangles(cap, ut) {
    const r = this.rute, R = cap.radius, st = ++this.stempel;
    const x0 = Math.min(cap.start.x, cap.end.x) - R, x1 = Math.max(cap.start.x, cap.end.x) + R;
    const y0 = Math.min(cap.start.y, cap.end.y) - R, y1 = Math.max(cap.start.y, cap.end.y) + R;
    const z0 = Math.min(cap.start.z, cap.end.z) - R, z1 = Math.max(cap.start.z, cap.end.z) + R;
    for (let i = Math.floor(x0 / r); i <= Math.floor(x1 / r); i++) {
      for (let k = Math.floor(z0 / r); k <= Math.floor(z1 / r); k++) {
        const c = this.celler.get(this.nokkel(i, k));
        if (!c) continue;
        for (const id of c) {
          if (this.merke[id] === st) continue;
          this.merke[id] = st;
          const b = this.bokser[id];
          if (b.max.x < x0 || b.min.x > x1 || b.max.y < y0 || b.min.y > y1 || b.max.z < z0 || b.min.z > z1) continue;
          ut.push(this.tri[id]);
        }
      }
    }
    return ut;
  }
  triangleCapsuleIntersect(cap, t) { return _tcap.call(this, cap, t); }
  capsuleIntersect(capsule) {
    const cap = this._cap || (this._cap = new Capsule());
    cap.copy(capsule);
    const tris = this._tris || (this._tris = []);
    tris.length = 0;
    this.getCapsuleTriangles(cap, tris);
    let treff = false, res;
    for (const t of tris) {
      if ((res = this.triangleCapsuleIntersect(cap, t))) { treff = true; cap.translate(res.normal.multiplyScalar(res.depth)); }
    }
    if (!treff) return false;
    const v = cap.getCenter(new THREE.Vector3()).sub(capsule.getCenter(new THREE.Vector3()));
    const depth = v.length();
    return { normal: v.normalize(), depth };
  }
}

// ---------- spiller
const RAD = 0.22, OYE = SPILL ? 1.2 : 1.6, TOPP = 1.5, STEG = 0.32;   // spillet ser huset i barnehøyde
// autogang (spillet): gå i rett linje mot et punkt; stopper ved målet eller når veggen tar imot
const autogang = { mål: null, fart: 1.7, ferdig: null, sjekkTid: 0, sjekkPos: new THREE.Vector3() };
function gåTil(p, ferdig) {
  if (autogang.ferdig) { const f = autogang.ferdig; autogang.ferdig = null; f(false); }
  autogang.mål = p ? p.clone() : null; autogang.ferdig = ferdig || null; autogang.sjekkTid = 0; autogang.sjekkPos.copy(fot);
}
function avsluttGang(ok) { const f = autogang.ferdig; autogang.mål = null; autogang.ferdig = null; if (f) f(ok); }
const fot = new THREE.Vector3();
const kapsel = new Capsule(new THREE.Vector3(), new THREE.Vector3(), RAD);
let yaw = 0, pitch = 0, vy = 0, paaBakken = true, oyeY = 0;
const taster = {};
let lopKnapp = false;
const stikke = { aktiv: false, id: null, x0: 0, y0: 0, dx: 0, dy: 0 };

function plasser(i) {
  const [navn, , f, mot] = STEDER[i];
  fot.copy(T(...f));
  const m = T(mot[0], mot[1], f[2]);
  yaw = Math.atan2(-(m.x - fot.x), -(m.z - fot.z));
  pitch = -0.05;
  vy = 0; paaBakken = true; oyeY = fot.y + OYE;
  oppdaterKapsel();
  visSted(navn);
}

function oppdaterKapsel() {
  kapsel.start.set(fot.x, fot.y + STEG + RAD, fot.z);
  kapsel.end.set(fot.x, fot.y + TOPP - RAD, fot.z);
}

const _ray = new THREE.Ray();
const _tris = [];
const _hit = new THREE.Vector3();
function stråle(origin, dir, maks) {
  // som Octree.rayIntersect, men treffer begge sider av trianglene
  _ray.set(origin, dir);
  _tris.length = 0;
  worldOctree.getRayTriangles(_ray, _tris, maks);
  let best = maks;
  for (const t of _tris) {
    if (_ray.intersectTriangle(t.a, t.b, t.c, false, _hit)) {
      const d = _hit.distanceTo(origin);
      if (d < best) best = d;
    }
  }
  return best;
}

const NED = new THREE.Vector3(0, -1, 0);
const _o = new THREE.Vector3();
const PROBER = [[0, 0], [0.6, 0], [-0.6, 0], [0, 0.6], [0, -0.6]];
function bakkehoyde() {
  // høyeste gulv under føttene, opptil STEG over dem
  let best = -Infinity;
  for (const [dx, dz] of PROBER) {
    _o.set(fot.x + dx * RAD, fot.y + STEG + 0.05, fot.z + dz * RAD);
    const d = stråle(_o, NED, 50);
    if (d < 50) best = Math.max(best, _o.y - d);
  }
  return best;
}

const _flytt = new THREE.Vector3();
function steg(dt) {
  // ønsket bevegelse
  let fx = 0, fz = 0;
  if (taster.KeyW || taster.ArrowUp) fz -= 1;
  if (taster.KeyS || taster.ArrowDown) fz += 1;
  if (taster.KeyA || taster.ArrowLeft) fx -= 1;
  if (taster.KeyD || taster.ArrowRight) fx += 1;
  if (stikke.aktiv) { fx += stikke.dx; fz += stikke.dy; }
  const len = Math.hypot(fx, fz);
  if (len > 1) { fx /= len; fz /= len; }
  const lop = taster.ShiftLeft || taster.ShiftRight || lopKnapp;
  const fart = lop ? 3.6 : 1.45;
  const s = Math.sin(yaw), c = Math.cos(yaw);
  _flytt.set(fx * c + fz * s, 0, -fx * s + fz * c).multiplyScalar(fart * dt);
  if (autogang.mål) {
    if (len > 0.1) avsluttGang(false);          // tastene tar over
    else {
      const dx = autogang.mål.x - fot.x, dz = autogang.mål.z - fot.z, d = Math.hypot(dx, dz);
      if (d < 0.1) avsluttGang(true);
      else { const v = Math.min(autogang.fart * dt, d); _flytt.set(dx / d * v, 0, dz / d * v); }
    }
  }

  // vannrett: flytt og skyv ut av vegger og møbler
  fot.add(_flytt);
  oppdaterKapsel();
  for (let k = 0; k < 3; k++) {
    const r = worldOctree.capsuleIntersect(kapsel);
    if (!r) break;
    const n = r.normal;
    const h = Math.hypot(n.x, n.z);
    if (h < 0.05) break;
    fot.x += n.x * r.depth; fot.z += n.z * r.depth;
    oppdaterKapsel();
  }

  // loddrett: følg gulv og trinn, fall ellers
  const g = bakkehoyde();
  if (paaBakken && g > -Infinity && g >= fot.y - 0.42) {
    fot.y += (g - fot.y) * Math.min(1, dt * 18);
    if (Math.abs(g - fot.y) < 0.002) fot.y = g;
    vy = 0;
  } else {
    vy -= 9.8 * dt;
    fot.y += vy * dt;
    paaBakken = false;
    if (g > -Infinity && fot.y <= g) { fot.y = g; vy = 0; paaBakken = true; }
  }
  if (fot.y < -30) plasser(0);
  oppdaterKapsel();
}

// ---------- lys inne og eksponering
let inneGrad = 1;
function erInne(p) {
  const X = p.x, Y = -p.z;
  return INNE.some(([x0, x1, y0, y1]) => X > x0 && X < x1 && Y > y0 && Y < y1);
}

const _blikk = new THREE.Vector3();
let lampeTid = 0;
function velgLamper() {
  const oye = camera.position;
  const kand = [];
  for (const l of lysListe) {
    const d = l.p.distanceTo(oye);
    if (d > 11) continue;
    kand.push([d, l]);
  }
  kand.sort((a, b) => a[0] - b[0]);
  const valgt = [];
  for (const [d, l] of kand) {
    if (valgt.length >= LAMPER) break;
    _blikk.subVectors(l.p, oye).normalize();
    const hit = stråle(oye, _blikk, d);
    if (hit < d - 0.7) continue;                 // vegg mellom oss og lampa
    valgt.push(l);
  }
  // behold lys som allerede står på samme lampe, så de ikke blinker
  const ledig = lamper.filter((p) => !valgt.includes(p.userData.lampe));
  for (const p of lamper) if (!valgt.includes(p.userData.lampe)) { p.userData.mål = 0; }
  for (const l of valgt) {
    let p = lamper.find((q) => q.userData.lampe === l);
    if (!p) {
      p = ledig.find((q) => q.intensity < 0.02) || ledig.sort((a, b) => a.intensity - b.intensity)[0];
      if (!p) continue;
      ledig.splice(ledig.indexOf(p), 1);
      p.userData.lampe = l;
      p.position.copy(l.p);
      if (l.t === 's' || l.t === 'a') p.position.y -= 0.06;
      p.color.copy(l.c);
      p.intensity = 0;
    }
    p.userData.mål = Math.min(10, l.w * (l.t === 'a' ? 0.08 : 0.15));
  }
}

// ---------- styring: tastatur og mus
const sted = $('sted');
let stedTid = 0;
function visSted(t) { sted.textContent = t; sted.style.opacity = 1; stedTid = performance.now(); }

addEventListener('keydown', (e) => {
  taster[e.code] = true;
  if (SPILL) { if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault(); return; }
  if (e.code === 'KeyM') veksleMeny();
  if (e.code === 'KeyF') $('hud').hidden = !$('hud').hidden;
  if (e.code === 'KeyO' && composer) aoPaa = !aoPaa;
  const i = STEDER.findIndex((s) => s[1] === e.key);
  if (i >= 0) plasser(i);
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', (e) => { taster[e.code] = false; });
addEventListener('blur', () => { for (const k in taster) taster[k] = false; });

const canvas = renderer.domElement;
document.addEventListener('pointerlockchange', () => {
  const l = document.pointerLockElement === canvas;
  document.body.classList.toggle('låst', l);
  if (!l && !mobil && klar && !SPILL) $('start').style.display = 'grid';
});
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== canvas) return;
  yaw -= e.movementX * 0.0022;
  pitch = Math.max(-1.45, Math.min(1.45, pitch - e.movementY * 0.0022));
});

// ---------- berøring: venstre halvdel går, høyre ser rundt
const se = { id: null, x: 0, y: 0 };
const stikkeEl = $('stikke');
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (SPILL) return;                 // spillet bruker pekerhendelser (pointer events) i spill.js
  for (const t of e.changedTouches) {
    if (t.clientX < innerWidth / 2 && stikke.id === null) {
      stikke.id = t.identifier; stikke.x0 = t.clientX; stikke.y0 = t.clientY; stikke.aktiv = true; stikke.dx = stikke.dy = 0;
      stikkeEl.style.display = 'block';
      stikkeEl.style.left = (t.clientX - 60) + 'px'; stikkeEl.style.top = (t.clientY - 60) + 'px';
      stikkeEl.firstElementChild.style.transform = '';
    } else if (se.id === null) {
      se.id = t.identifier; se.x = t.clientX; se.y = t.clientY;
    }
  }
  e.preventDefault();
}, { passive: false });
canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (SPILL) return;
  for (const t of e.changedTouches) {
    if (t.identifier === stikke.id) {
      let dx = t.clientX - stikke.x0, dy = t.clientY - stikke.y0;
      const l = Math.hypot(dx, dy), maks = 50;
      if (l > maks) { dx *= maks / l; dy *= maks / l; }
      stikke.dx = dx / maks; stikke.dy = dy / maks;
      stikkeEl.firstElementChild.style.transform = `translate(${dx}px, ${dy}px)`;
    } else if (t.identifier === se.id) {
      yaw -= (t.clientX - se.x) * 0.005;
      pitch = Math.max(-1.45, Math.min(1.45, pitch - (t.clientY - se.y) * 0.005));
      se.x = t.clientX; se.y = t.clientY;
    }
  }
  e.preventDefault();
}, { passive: false });
const slipp = (e) => {
  for (const t of e.changedTouches) {
    if (t.identifier === stikke.id) { stikke.id = null; stikke.aktiv = false; stikke.dx = stikke.dy = 0; stikkeEl.style.display = 'none'; }
    if (t.identifier === se.id) se.id = null;
  }
};
canvas.addEventListener('touchend', slipp);
canvas.addEventListener('touchcancel', slipp);
$('lop').addEventListener('click', () => { lopKnapp = !lopKnapp; $('lop').classList.toggle('paa', lopKnapp); });

// ---------- meny
const meny = $('meny');
STEDER.forEach(([navn, tast], i) => {
  const b = document.createElement('button');
  b.innerHTML = `<span>${navn}</span><kbd class="kun-mac">${tast}</kbd>`;
  b.addEventListener('click', (e) => { e.stopPropagation(); plasser(i); meny.classList.remove('apen'); if (!mobil) canvas.requestPointerLock(); });
  meny.appendChild(b);
});
function veksleMeny() {
  const apen = meny.classList.toggle('apen');
  if (apen && document.pointerLockElement) document.exitPointerLock();
}
$('menyKnapp').addEventListener('click', (e) => { e.stopPropagation(); veksleMeny(); });

let klar = false;
$('start').addEventListener('click', () => {
  $('start').style.display = 'none';
  meny.classList.remove('apen');
  if (!mobil) canvas.requestPointerLock();
});
canvas.addEventListener('click', () => { if (!SPILL && !mobil && klar && document.pointerLockElement !== canvas) canvas.requestPointerLock(); });

// størrelse: følger vinduet når adresselinja i Safari skjules/vises og ved rotasjon
let sistW = 0, sistH = 0;
function tilpass() {
  const w = innerWidth, h = innerHeight;
  if (w === sistW && h === sistH) return;
  sistW = w; sistH = h;
  settSynsfelt();
  renderer.setSize(w, h);
  if (composer) composer.setSize(w, h);
}
addEventListener('resize', tilpass);
addEventListener('orientationchange', () => { tilpass(); setTimeout(tilpass, 250); setTimeout(tilpass, 700); });
if (window.visualViewport) visualViewport.addEventListener('resize', tilpass);

// ---------- løkka
const etterSteg = [];      // spillet henger seg på her (kalles hvert bilde etter bevegelsen, før tegning)
const klokke = new THREE.Clock();
let fpsTid = 0, fpsN = 0, fps = 0, tregTid = 0, autoFra = Infinity;
const auto = !PARAM.has('fast');
const SUB = 5;
let forsteBilde = false;
function loop() {
  const dt = Math.min(0.05, klokke.getDelta());
  if (klar) {
    for (let i = 0; i < SUB; i++) steg(dt / SUB);
    if (autogang.mål) {
      // snu blikket mykt mot gangretningen, og gi opp hvis vi står fast
      const dx = autogang.mål.x - fot.x, dz = autogang.mål.z - fot.z;
      if (Math.hypot(dx, dz) > 0.6) {
        let d = Math.atan2(-dx, -dz) - yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        yaw += d * Math.min(1, dt * 4);
      }
      autogang.sjekkTid += dt;
      if (autogang.sjekkTid > 0.5) {
        const flyttet = Math.hypot(fot.x - autogang.sjekkPos.x, fot.z - autogang.sjekkPos.z);
        autogang.sjekkTid = 0; autogang.sjekkPos.copy(fot);
        if (flyttet < 0.12) avsluttGang(false);
      }
    }
    for (const f of etterSteg) f(dt);
    // øyehøyde dempes litt så trapper ikke rister
    const mål = fot.y + OYE;
    oyeY += (mål - oyeY) * Math.min(1, dt * 14);
    if (Math.abs(mål - oyeY) > 0.6) oyeY = mål;
    camera.position.set(fot.x, oyeY, fot.z);
    camera.rotation.set(pitch, yaw, 0);

    const inne = erInne(fot) ? 1 : 0;
    inneGrad += (inne - inneGrad) * Math.min(1, dt * 2.5);
    scene.environmentIntensity = THREE.MathUtils.lerp(1.0, 0.5, inneGrad);
    renderer.toneMappingExposure = THREE.MathUtils.lerp(1.0, 1.2, inneGrad);

    lampeTid -= dt;
    if (lampeTid <= 0) { velgLamper(); lampeTid = 0.2; }
    for (const p of lamper) {
      p.intensity += (p.userData.mål - p.intensity) * Math.min(1, dt * 5);
      p.visible = p.intensity > 0.01;
    }
    if (performance.now() - stedTid > 2200) sted.style.opacity = 0;
  }
  if (kontekstTapt) return;
  renderer.info.reset();
  if (aoPaa && composer) composer.render(dt); else renderer.render(scene, camera);
  if (forsteBilde) { forsteBilde = false; smule('første bilde tegnet'); setTimeout(() => smule('levd 5 s'), 5000); setTimeout(() => smule('levd 30 s'), 30000); setTimeout(() => smule('levd 2 min'), 120000); }

  fpsN++; fpsTid += dt;
  if (fpsTid >= 0.5) {
    fps = fpsN / fpsTid; fpsN = 0; fpsTid = 0;
    const inf = renderer.info.render;
    $('hud').textContent = `${fps.toFixed(0)} bilder/s   ${(inf.triangles / 1e6).toFixed(2)} mill. trekanter   ${inf.calls} tegnekall\n`
      + `${MODUS}  ${aoPaa ? 'AO på' : 'AO av'}  oppløsning ${pikselratio}\n` + `X ${fot.x.toFixed(2)}  Y ${(-fot.z).toFixed(2)}  Z ${fot.y.toFixed(2)}`;
    window.eik.fps = fps;
    // senk oppløsningen litt hvis maskinen ikke klarer 60
    if (klar && fps < 55 && performance.now() > autoFra) {
      tregTid += 0.5;
      if (tregTid > 3) {
        if (pikselratio > 1) { pikselratio = Math.max(1, pikselratio - 0.25); renderer.setPixelRatio(pikselratio); if (composer) { composer.setPixelRatio(pikselratio); composer.setSize(innerWidth, innerHeight); } }
        else if (aoPaa) aoPaa = false;
        tregTid = 0;
      }
    } else tregTid = 0;
  }
  requestAnimationFrame(loop);
}

// testgrensesnitt (brukes til automatiske turer og målinger)
window.eik = {
  plasser, steder: STEDER.map((s) => s[0]),
  pos: () => ({ X: +fot.x.toFixed(3), Y: +(-fot.z).toFixed(3), Z: +fot.y.toFixed(3), yaw: +yaw.toFixed(3), pitch: +pitch.toFixed(3), inne: erInne(fot) }),
  sett(X, Y, Z, motX, motY) { fot.copy(T(X, Y, Z)); const m = T(motX, motY, Z); yaw = Math.atan2(-(m.x - fot.x), -(m.z - fot.z)); oyeY = fot.y + OYE; vy = 0; paaBakken = true; oppdaterKapsel(); },
  se(p, y) { if (p !== undefined) pitch = p; if (y !== undefined) yaw = y; },
  taster,
  // går mot punktene (X, Y) i rekkefølge med vanlig styring; svarer med sluttposisjon
  async gå(punkter, lop = false) {
    for (const [X, Y] of punkter) {
      const start = performance.now();
      while (performance.now() - start < 25000) {
        const dx = X - fot.x, dz = -Y - fot.z;
        if (Math.hypot(dx, dz) < 0.12) break;
        yaw = Math.atan2(-dx, -dz);
        taster.KeyW = true; taster.ShiftLeft = lop;
        await new Promise((r) => requestAnimationFrame(r));
      }
      taster.KeyW = false; taster.ShiftLeft = false;
    }
    return this.pos();
  },
  get octree() { return worldOctree; }, Octree,
  // til spill.js: alt i three.js-koordinater
  spill: {
    THREE, T, scene, camera, canvas, renderer, mobil, ENKEL, OYE, RAD, fot, kapsel,
    stråle, gåTil, etterSteg, oppdaterKapsel,
    get går() { return !!autogang.mål; },
    get yaw() { return yaw; }, set yaw(v) { yaw = v; },
    get pitch() { return pitch; }, set pitch(v) { pitch = Math.max(-1.45, Math.min(1.45, v)); },
    // flytt føttene direkte (three.js-punkt), se mot et punkt
    settFot(p, mot) {
      gåTil(null); fot.copy(p); vy = 0; paaBakken = true; oyeY = fot.y + OYE; oppdaterKapsel();
      if (mot) { yaw = Math.atan2(-(mot.x - fot.x), -(mot.z - fot.z)); pitch = Math.max(-0.6, Math.min(0.4, Math.atan2(mot.y - oyeY, Math.hypot(mot.x - fot.x, mot.z - fot.z)))); }
    },
    // står kapselen fritt i et punkt (føtter)?
    fritt(p) {
      const k = new Capsule(new THREE.Vector3(p.x, p.y + STEG + RAD, p.z), new THREE.Vector3(p.x, p.y + TOPP - RAD, p.z), RAD);
      return !worldOctree.capsuleIntersect(k);
    },
  },
  rendrer: renderer, scene, sol, camera, THREE, get ao() { return ao; }, lett: LETT, modus: MODUS,
  get aoPaa() { return aoPaa; }, set aoPaa(v) { aoPaa = v && !!composer; },
  kolTest() {
    oppdaterKapsel();
    const tr = []; worldOctree.getCapsuleTriangles(kapsel, tr);
    const bl = (v) => [+v.x.toFixed(3), +(-v.z).toFixed(3), +v.y.toFixed(3)];
    return tr.map((t) => [t, worldOctree.triangleCapsuleIntersect(kapsel, t)]).filter((x) => x[1])
      .map(([t, r]) => ({ tri: [bl(t.a), bl(t.b), bl(t.c)], n: bl(r.normal), d: +r.depth.toFixed(3) }));
  },
  // feilsøking: avstand til nærmeste kollisjonsflate fra et punkt (Blender-mål) i en retning
  probe(X, Y, Z, dX, dY, dZ) {
    const o = T(X, Y, Z), d = T(dX, dY, dZ).normalize();
    _ray.set(o, d); _tris.length = 0; worldOctree.getRayTriangles(_ray, _tris);
    let best = 1e9, tri = null;
    for (const t of _tris) if (_ray.intersectTriangle(t.a, t.b, t.c, false, _hit)) { const dd = _hit.distanceTo(o); if (dd < best) { best = dd; tri = t; } }
    const bl = (v) => [+v.x.toFixed(3), +(-v.z).toFixed(3), +v.y.toFixed(3)];
    return tri ? { d: +best.toFixed(3), tri: [bl(tri.a), bl(tri.b), bl(tri.c)] } : null;
  },
};

smule('starter lasting');
last().then(() => {
  smule('tegner første bilde');
  forsteBilde = true;
  klar = true;
  plasser(0);
  // skyggekartet tegnes bare på nytt ved behov (scenen står stille); gjør det et par ganger etter lasting for sikkerhets skyld
  for (const ms of [300, 1500, 4000]) setTimeout(() => { renderer.shadowMap.needsUpdate = true; }, ms);
  document.addEventListener('visibilitychange', () => { renderer.shadowMap.needsUpdate = true; });
  $('last').style.opacity = 0;
  setTimeout(() => { $('last').style.display = 'none'; }, 650);
  if (auto) autoFra = performance.now() + 4000;
  if (PARAM.has('fps')) $('hud').hidden = false;
  if (SPILL) {
    smule('laster spillet');
    return import('./spill.js' + V).then((m) => { m.startSpill(window.eik.spill); smule('spillet startet'); });
  }
  $('menyKnapp').hidden = false;
  $('start').style.display = 'grid';
}).catch((e) => {
  console.error(e);
  smule('lasting feilet: ' + (e && e.message ? e.message : e));
  const fil = location.protocol === 'file:';
  visFeil('Klarte ikke å laste modellen', fil
    ? 'Siden må åpnes via en webserver, ikke som fil.'
    : 'Sjekk nettforbindelsen og prøv igjen. Feilen var: ' + String(e && e.message ? e.message : e).replace(/[<>&]/g, ''));
});
loop();

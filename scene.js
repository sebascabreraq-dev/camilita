import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const canvas = document.getElementById("scene");
const reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;
const small = innerWidth < 800;

let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" }); }
catch { canvas.remove(); throw new Error("WebGL no disponible"); }

renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.5 : 2));
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.z = 7;

// ---------- Silueta de corazón (curva paramétrica clásica) ----------
const heartXY = t => [16 * Math.sin(t) ** 3,
  13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)];
const S = 0.08;

// ---------- Corazón de cristal ----------
const shape = new THREE.Shape();
for (let i = 0; i <= 120; i++) {
  const [x, y] = heartXY((i / 120) * Math.PI * 2);
  i ? shape.lineTo(x, y) : shape.moveTo(x, y);
}
const geo = new THREE.ExtrudeGeometry(shape, { depth: 3, bevelEnabled: true, bevelSegments: 14, steps: 2, bevelSize: 2.6, bevelThickness: 3.2, curveSegments: 64 });
geo.center(); geo.scale(S, S, S);
const glass = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({
  color: 0xd4505f, roughness: 0.12, metalness: 0, transmission: 1, thickness: 2.4, ior: 1.45,
  attenuationColor: new THREE.Color(0xa81f33), attenuationDistance: 2.4, clearcoat: 1, envMapIntensity: 1.5
}));
const rim = new THREE.PointLight(0xe4c27a, 30, 20); rim.position.set(-4, 3, 4);
const fill = new THREE.PointLight(0xe0556a, 12, 20); fill.position.set(4, -2, 3);
scene.add(glass, rim, fill);

// ---------- Nube de partículas (shader propio) ----------
const N = reduce ? 3000 : small ? 7000 : 16000;
const pos = new Float32Array(N * 3), tgt = new Float32Array(N * 3), rnd = new Float32Array(N);
for (let i = 0; i < N; i++) {
  const [x, y] = heartXY(Math.random() * Math.PI * 2), r = 0.72 + Math.random() * 0.28;
  pos.set([x * r, y * r + 2.5, (Math.random() - 0.5) * 9 * Math.sqrt(1 - Math.abs(x / 17) ** 2)], i * 3);
  tgt.set([(Math.random() - 0.5) * 22, (Math.random() - 0.5) * 13, (Math.random() - 0.5) * 9 - 2], i * 3);
  rnd[i] = Math.random();
}
const pg = new THREE.BufferGeometry();
pg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
pg.setAttribute("aTarget", new THREE.BufferAttribute(tgt, 3));
pg.setAttribute("aRand", new THREE.BufferAttribute(rnd, 1));
const U = { uTime: { value: 0 }, uDisperse: { value: 0 }, uBurst: { value: 0 }, uPx: { value: renderer.getPixelRatio() },
  uHS: { value: S }, uHP: { value: new THREE.Vector3() } };
const points = new THREE.Points(pg, new THREE.ShaderMaterial({
  uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `attribute vec3 aTarget; attribute float aRand;
    uniform float uTime,uDisperse,uBurst,uPx,uHS; uniform vec3 uHP; varying float vR;
    void main(){ vR=aRand;
      vec3 p=mix(position*uHS+uHP, aTarget, uDisperse);
      p+=vec3(sin(uTime*.6+aRand*40.),cos(uTime*.5+aRand*30.),sin(uTime*.4+aRand*20.))*(.03+.22*uDisperse);
      p*=1.+uBurst*(.5+aRand);
      vec4 mv=modelViewMatrix*vec4(p,1.);
      gl_PointSize=(1.4+aRand*3.2)*uPx*(6./-mv.z); gl_Position=projectionMatrix*mv; }`,
  fragmentShader: `varying float vR;
    void main(){ float d=length(gl_PointCoord-.5); if(d>.5) discard;
      vec3 c=mix(vec3(1.,.45,.6),vec3(.9,.76,.48),step(.82,vR));
      gl_FragColor=vec4(c,smoothstep(.5,0.,d)*.85); }`
}));
scene.add(points);

// ---------- Rosas procedurales (pétalos deformados, fusionados en una sola malla) ----------
function veinTexture() {
  const c = document.createElement("canvas"); c.width = 128; c.height = 256;
  const x = c.getContext("2d"); x.fillStyle = "#808080"; x.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 52; i++) {
    const px = Math.random() * 128;
    x.strokeStyle = Math.random() > 0.5 ? "rgba(255,255,255,.2)" : "rgba(0,0,0,.24)"; x.lineWidth = 0.8 + Math.random() * 1.6;
    x.beginPath(); x.moveTo(64 + (px - 64) * 0.12, 256); x.quadraticCurveTo(px, 150, 64 + (px - 64) * 1.25, 6 + Math.random() * 60); x.stroke();
  }
  return new THREE.CanvasTexture(c);
}
// Pétalo: ancho en campana, copa hacia el eje, borde ondulado y punta enrollada hacia afuera
function petalGeo({ w, h, cup, curl = 0, tilt, rad, ang, y0 = 0, c0, c1 }) {
  const g = new THREE.PlaneGeometry(1, 1, 12, 14), p = g.attributes.position, col = new Float32Array(p.count * 3);
  const a = new THREE.Color(c0), b = new THREE.Color(c1), tmp = new THREE.Color(), j = Math.random();
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) * 2, v = p.getY(i) + 0.5;
    const width = w * Math.pow(Math.sin(Math.PI * Math.pow(v, 0.7)), 0.65) * (1 + 0.22 * v);
    const wave = 0.035 * h * Math.sin(u * 5 + v * 4 + j * 6) * v * Math.abs(u);
    const z = -cup * u * u * (0.55 + 0.45 * v) + curl * h * 3.2 * Math.pow(Math.max(0, v - 0.55), 2) * (0.5 + 0.5 * Math.abs(u)) + wave;
    p.setXYZ(i, u * width * 0.5, v * h, z);
    tmp.copy(a).lerp(b, Math.min(1, Math.pow(v, 1.3) * 0.8 + Math.abs(u) * 0.25)); col.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.rotateX(tilt + (Math.random() - 0.5) * 0.08); g.translate(0, y0, rad); g.rotateY(ang + (Math.random() - 0.5) * 0.12);
  g.computeVertexNormals(); return g;
}
function leafGeo() {
  const g = new THREE.PlaneGeometry(1, 1, 6, 14), p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) * 2, v = p.getY(i) + 0.5;
    const width = 0.2 * Math.sin(Math.PI * Math.pow(v, 0.8)) * (1 + 0.07 * Math.sin(v * 70));   // borde dentado
    p.setXYZ(i, u * width * 0.5, v * 0.62, Math.abs(u) * width * 0.35 - 0.05 * v * v);
    c.setHex(0x14452a).lerp(new THREE.Color(0x3f8a52), (1 - Math.abs(u)) * 0.5 + v * 0.2); col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
}
function buildRose() {
  const body = new THREE.Group(), geos = [], vein = veinTexture();
  // [pétalos, ancho, alto, copa, enrollado, apertura, radio, color base, color borde]
  [[3, 0.2, 0.36, 0.18, 0, 0.0, 0.025, 0x3a0510, 0x7a0c27], [5, 0.3, 0.46, 0.14, 0, 0.1, 0.06, 0x560814, 0xa8142f],
   [7, 0.4, 0.5, 0.11, 0.04, 0.26, 0.1, 0x6e0a1c, 0xc9223f], [9, 0.5, 0.53, 0.08, 0.1, 0.46, 0.15, 0x7d0d22, 0xe0395e],
   [11, 0.62, 0.5, 0.06, 0.18, 0.74, 0.21, 0x8b1228, 0xff7f9c]].forEach(([n, w, h, cup, curl, tilt, rad, c0, c1], k) => {
    for (let i = 0; i < n; i++) geos.push(petalGeo({ w, h, cup, curl, tilt, rad, ang: (i / n) * Math.PI * 2 + k * 0.9, c0, c1 }));
  });
  for (let i = 0; i < 5; i++) geos.push(petalGeo({ w: 0.15, h: 0.36, cup: 0.02, curl: 0.2, tilt: 2.1, rad: 0.07, ang: (i / 5) * Math.PI * 2, y0: -0.08, c0: 0x1a4a2a, c1: 0x3b8350 }));
  body.add(new THREE.Mesh(mergeGeometries(geos), new THREE.MeshPhysicalMaterial({
    vertexColors: true, side: THREE.DoubleSide, roughness: 0.52, sheen: 1, sheenColor: new THREE.Color(0xff9fb5), sheenRoughness: 0.35,
    bumpMap: vein, bumpScale: 1.4, clearcoat: 0.2, clearcoatRoughness: 0.5, envMapIntensity: 1.1 })));
  const green = new THREE.MeshStandardMaterial({ color: 0x1f5a35, roughness: 0.55, metalness: 0.05 });
  const curve = new THREE.CatmullRomCurve3([[0, -0.12, 0], [0.05, -0.5, 0.03], [-0.04, -0.95, -0.03], [0, -1.5, 0.02]].map(a => new THREE.Vector3(...a)));
  body.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 28, 0.022, 10), green));
  const thorns = [0.25, 0.45, 0.62, 0.8].map((t, i) => {            // espinas a lo largo del tallo
    const th = new THREE.ConeGeometry(0.018, 0.075, 6); th.translate(0, 0.0375, 0); th.rotateZ(-1.2); th.rotateY(i * 2.2);
    const pt = curve.getPoint(t); th.translate(pt.x, pt.y, pt.z); return th;
  });
  body.add(new THREE.Mesh(mergeGeometries(thorns), green));
  const leafMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.4, clearcoat: 0.3, envMapIntensity: 1 });
  [[0.35, 1.15, 0.5], [0.62, -1.15, -2.4]].forEach(([t, rz, ry]) => {
    const l = new THREE.Mesh(leafGeo(), leafMat), pt = curve.getPoint(t);
    l.position.copy(pt); l.rotation.set(0, ry, rz); body.add(l);
  });
  return body;
}
const roseTemplate = buildRose();
const roses = [
  { x: -0.42, y: 0.12, z: -0.5, s: 1.1, sp: 0.6 }, { x: 0.41, y: -0.3, z: -1, s: 0.8, sp: -0.5 },
  { x: -0.3, y: -0.46, z: 0.5, s: 1.25, sp: 0.45 }, { x: 0.45, y: 0.4, z: 0.2, s: 0.9, sp: -0.7 }
].map(cfg => {
  const g = new THREE.Group(), spin = new THREE.Group();
  spin.add(roseTemplate.clone()); g.add(spin); scene.add(g);
  return { cfg, g, spin };
});

// ---------- Anillos dorados alrededor del corazón ----------
const halo = new THREE.Group();
const gold = new THREE.MeshStandardMaterial({ color: 0xe4c27a, metalness: 1, roughness: 0.25, envMapIntensity: 1.6 });
const rings = [[1.55, 0.012, 0.4, 0], [1.85, 0.008, 1.2, 0.8], [2.15, 0.006, 0, 1.9]].map(([R, w, rx, rz]) => {
  const m = new THREE.Mesh(new THREE.TorusGeometry(R, w, 16, 200), gold);
  m.rotation.set(rx, 0, rz); halo.add(m); return m;
});
scene.add(halo);

// ---------- Estado, scroll y puntero ----------
const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
addEventListener("pointermove", e => { mouse.x = e.clientX / innerWidth * 2 - 1; mouse.y = e.clientY / innerHeight * 2 - 1; });
let burst = 0;
addEventListener("proposal-yes", () => { burst = 1; });

const st = { p: 0, x: 0, y: 0, s: 1 };
const smooth = t => t * t * (3 - 2 * t);
let VW = innerWidth, VH = innerHeight;
function resize(force) {   // ignora los cambios de altura de la barra de Safari
  if (!force && innerWidth === VW && Math.abs(innerHeight - VH) < 160) return;
  VW = innerWidth; VH = innerHeight;
  renderer.setSize(VW, VH, false); camera.aspect = VW / VH; camera.updateProjectionMatrix();
}
addEventListener("resize", () => resize()); resize(true);

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime();
  const p = smooth(Math.min(scrollY / (VH * 0.9), 1));
  const visH = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(22.5)), visW = visH * camera.aspect;
  const wide = innerWidth > 900;
  // Destino del corazón: centrado en el hero, luego se desplaza a un lado y se encoge
  const tx = wide ? visW * 0.3 * p : 0, ty = THREE.MathUtils.lerp(0.55, wide ? 0 : visH * 0.34, p);
  const ts = THREE.MathUtils.lerp(wide ? 1 : 0.8, wide ? 0.55 : 0.4, p) * (1 + burst * 0.5);
  st.x += (tx - st.x) * 0.07; st.y += (ty - st.y) * 0.07; st.s += (ts - st.s) * 0.07; st.p += (p - st.p) * 0.06;

  mouse.sx += (mouse.x - mouse.sx) * 0.05; mouse.sy += (mouse.y - mouse.sy) * 0.05;
  glass.position.set(st.x, st.y + Math.sin(t * 1.2) * 0.07, 0);
  glass.scale.setScalar(st.s * (1 + Math.sin(t * 2.6) ** 8 * 0.045));   // latido
  glass.rotation.set(mouse.sy * 0.35, t * 0.5 + mouse.sx * 0.6, Math.sin(t * 0.7) * 0.05);


  halo.position.copy(glass.position); halo.scale.setScalar(st.s * (1 - st.p * 0.35));
  rings.forEach((r, i) => { r.rotation.y = t * (0.25 + i * 0.12) * (i % 2 ? -1 : 1); r.rotation.x += 0.0008 * (i + 1); });
  roses.forEach(({ cfg, g, spin }, i) => {
    const span = visH + 3;
    let y = cfg.y * visH + Math.sin(t * 0.8 + i * 2) * 0.12 + scrollY * 0.0016 * (0.6 + i * 0.2);
    y = (((y + visH / 2 + 1.5) % span) + span) % span - visH / 2 - 1.5;   // sube con el scroll y reaparece abajo
    g.position.set(cfg.x * visW * (wide ? 1 : 1.15), y, cfg.z);
    g.scale.setScalar((wide ? 1 : 0.65) * cfg.s * (1 + burst * 0.6));
    g.rotation.set(0.55 + Math.sin(t * 0.6 + i) * 0.12, 0, cfg.x < 0 ? -0.4 : 0.4);
    spin.rotation.y = t * cfg.sp;
  });

  U.uTime.value = t;
  U.uDisperse.value = st.p * 0.9 + (reduce ? 0 : Math.sin(t * 0.4) * 0.02);
  U.uHS.value = S * st.s; U.uHP.value.set(st.x, st.y, 0);
  U.uBurst.value = burst;
  burst *= 0.965;
  points.rotation.y = mouse.sx * 0.12; points.rotation.x = mouse.sy * 0.08;
  camera.position.x = mouse.sx * 0.25; camera.position.y = -mouse.sy * 0.15; camera.lookAt(0, 0, 0);
  renderer.render(scene, camera);
});
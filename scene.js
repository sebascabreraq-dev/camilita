import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const canvas = document.getElementById("scene");
const reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;
const small = innerWidth < 800;

let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" }); }
catch { canvas.remove(); throw new Error("WebGL no disponible"); }

renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

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
  color: 0xff6f8f, roughness: 0.1, metalness: 0, transmission: 1, thickness: 2.4, ior: 1.45,
  attenuationColor: new THREE.Color(0xff2d5c), attenuationDistance: 1.5, clearcoat: 1, envMapIntensity: 1.5
}));
const rim = new THREE.PointLight(0xe4c27a, 30, 20); rim.position.set(-4, 3, 4);
const fill = new THREE.PointLight(0xff4d7a, 22, 20); fill.position.set(4, -2, 3);
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

// ---------- Rosas procedurales ----------
// Cada pétalo es un casquete de esfera; se rotan con el ángulo áureo para formar la espiral de la flor
function buildRose() {
  const body = new THREE.Group(), PETALS = 24, GOLDEN = 2.39996;
  const inner = new THREE.Color(0x6e0a20), outer = new THREE.Color(0xe0345c);
  for (let i = 0; i < PETALS; i++) {
    const t = i / (PETALS - 1);
    const g = new THREE.SphereGeometry(1, 24, 14, 0, Math.PI * (0.8 + 0.25 * t), 0.08, Math.PI * (0.42 + 0.3 * t));
    const m = new THREE.MeshPhysicalMaterial({ color: inner.clone().lerp(outer, t ** 0.8), roughness: 0.5, side: THREE.DoubleSide,
      sheen: 1, sheenColor: new THREE.Color(0xff9fb5), sheenRoughness: 0.4, clearcoat: 0.15 });
    const p = new THREE.Mesh(g, m), r = 0.07 + 0.3 * t ** 0.85;
    p.scale.set(r, r * (1.25 - 0.55 * t), r * 0.9);
    p.rotation.set(-0.12 * t * 2.2, i * GOLDEN, 0);
    p.position.y = 0.02 * (1 - t);
    body.add(p);
  }
  const green = new THREE.MeshStandardMaterial({ color: 0x1f5a35, roughness: 0.6 });
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.026, 1.3, 10), green); stem.position.y = -0.7;
  const cup = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.2, 12), green); cup.position.y = -0.18; cup.rotation.x = Math.PI;
  body.add(stem, cup);
  for (const [y, a] of [[-0.75, 0.6], [-1.05, -2.5]]) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8), green);
    leaf.scale.set(0.2, 0.012, 0.075); leaf.position.set(Math.cos(a) * 0.19, y, Math.sin(a) * 0.19); leaf.rotation.set(0, -a, 0.5);
    body.add(leaf);
  }
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
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
}
addEventListener("resize", resize); resize();

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime();
  const p = smooth(Math.min(scrollY / (innerHeight * 0.9), 1));
  const visH = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(22.5)), visW = visH * camera.aspect;
  const wide = innerWidth > 900;
  // Destino del corazón: centrado en el hero, luego se desplaza a un lado y se encoge
  const tx = wide ? visW * 0.3 * p : 0, ty = THREE.MathUtils.lerp(0.55, wide ? 0 : visH * 0.34, p);
  const ts = THREE.MathUtils.lerp(1, wide ? 0.55 : 0.4, p) * (1 + burst * 0.5);
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
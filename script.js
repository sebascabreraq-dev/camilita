let loaded = false;
function entrar() {
  if (loaded) return; loaded = true;
  const loader = document.getElementById("loader-screen");
  loader.style.opacity = "0";
  setTimeout(() => {
    loader.style.display = "none";
    document.getElementById("app-container").classList.remove("hidden");
    document.getElementById("bottom-dock").classList.remove("hidden");
    cargarComponente("home");
  }, 800);
}

document.addEventListener("DOMContentLoaded", () => {
  const countdownEl = document.getElementById("countdown");
  let t = 15;
  const iv = setInterval(() => { countdownEl.textContent = --t; if (t <= 0) clearInterval(iv); }, 1000);
  setTimeout(entrar, 15000);
  // Corazoncitos (ionicons) flotando por toda la pantalla, detrás de las tarjetas
  const bg = document.getElementById("background-icons"), total = innerWidth < 800 ? 22 : 42;
  for (let i = 0; i < total; i++) {
    const ic = document.createElement("ion-icon");
    ic.setAttribute("name", Math.random() > 0.35 ? "heart" : "heart-outline");
    ic.className = "floating-icon";
    ic.style.cssText = `left:${Math.random() * 100}%;font-size:${0.7 + Math.random() * 1.1}rem;--o:${0.18 + Math.random() * 0.42};--sw:${Math.random() * 90 - 45}px;` +
      `animation-duration:${14 + Math.random() * 18}s;animation-delay:-${Math.random() * 30}s;color:${["#ff8fa3", "#ff6b8a", "#e4c27a", "#ffb3c1"][i % 4]}`;
    bg.appendChild(ic);
  }
  document.getElementById("skip-btn").addEventListener("click", entrar);

});

// ---------- Ruteador ----------
async function cargarComponente(vista) {
  try {
    const res = await fetch(`${vista}.html`);
    document.getElementById("app-container").innerHTML = await res.text();
    actualizarDock(vista);
    generarFotos();
    window.scrollTo({ top: 0, behavior: "smooth" });
    reiniciarAnimaciones();
    inicializarLightbox();
    mejorasUI();
    if (vista === "home") activarBotonNo();
  } catch (e) { console.error("Error al cargar el componente:", e); }
}

function actualizarDock(activa) {
  const mapa = { home: ["btn-principal", "home"], metaforas: ["btn-metaforas", "rose"], galeria: ["btn-galeria", "images"] };
  for (const [vista, [id, icono]] of Object.entries(mapa)) {
    const btn = document.getElementById(id), on = vista === activa;
    btn.classList.toggle("active", on);
    btn.querySelector("ion-icon").setAttribute("name", on ? icono : icono + "-outline");
  }
}

// Crea las fotos a partir de data-fotos / data-total (foto1.jpg…, galeria1.jpg…)
// El texto de cada foto sale del nombre del archivo: "01 Primer cafe.jpg" -> "Primer cafe"
const textoDe = n => n.replace(/\.[^.]+$/, "").replace(/^\d+[\s._-]+/, "").replace(/_/g, " ").trim();
const esc = t => t.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const enc = n => encodeURIComponent(n).replace(/'/g, "%27");

function generarFotos() {
  document.querySelectorAll("[data-fotos]").forEach(box => {
    const clave = box.dataset.fotos, lista = (window.FOTOS && window.FOTOS[clave]) || [];
    if (!lista.length) {
      box.innerHTML = `<p class="vacio">Aún no hay fotos. Cópialas en <b>fotos/${clave}</b> y escribe sus nombres en <b>fotos.js</b>.</p>`;
      return;
    }
    lista.forEach((nombre, i) => {
      const src = `fotos/${clave}/${enc(nombre)}`;
      box.insertAdjacentHTML("beforeend", `<figure class="polaroid" style="--d:${(i % 6) * 220}ms">
        <div class="photo-placeholder view-img" data-src="${src}"><ion-icon name="scan-outline"></ion-icon></div>
        <p>${esc(textoDe(nombre))}</p></figure>`);
    });
  });
}

// ---------- Animaciones y botones ----------
let observer;
function reiniciarAnimaciones() {
  if (observer) observer.disconnect();
  observer = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add("visible");
    const f = e.target.querySelector(".view-img");   // carga la imagen solo al acercarse
    if (f && !f.style.backgroundImage) f.style.backgroundImage = `url('${f.dataset.src}')`;
  }), { threshold: 0.15 });
  document.querySelectorAll(".fade-in, .polaroid").forEach(el => observer.observe(el));
}

function activarBotonNo() {
  const no = document.getElementById("btn-no");
  if (!no) return;
  const huir = () => {
    no.style.transform = `translate(${Math.random() * 160 - 80}px, ${Math.random() * 70 - 35}px)`;
  };
  no.addEventListener("mouseover", huir);
  no.addEventListener("click", huir);
  no.addEventListener("touchstart", e => { e.preventDefault(); huir(); }, { passive: false });
}

function acceptProposal() {
  document.getElementById("pregunta").classList.add("hidden");
  document.getElementById("success-msg").classList.remove("hidden");
  confeti();
  window.dispatchEvent(new Event("proposal-yes"));
}

function confeti() {
  for (let i = 0; i < 40; i++) {
    const h = document.createElement("ion-icon");
    h.setAttribute("name", "heart");
    Object.assign(h.style, { position: "fixed", left: Math.random() * 100 + "vw", bottom: "-30px", zIndex: 9998,
      color: ["#ff8fa3", "#e4c27a", "#e04e72"][i % 3], fontSize: Math.random() * 1.6 + 0.8 + "rem",
      transition: `transform ${3 + Math.random() * 3}s ease-out, opacity 5s`, pointerEvents: "none" });
    document.body.appendChild(h);
    requestAnimationFrame(() => { h.style.transform = `translateY(-${80 + Math.random() * 30}vh) rotate(${Math.random() * 360}deg)`; h.style.opacity = 0; });
    setTimeout(() => h.remove(), 7000);
  }
}

// ---------- Visor de fotos ----------
let galeria = [], idx = 0;
function inicializarLightbox() {
  const imgs = document.querySelectorAll(".view-img");
  imgs.forEach((el, i) => el.addEventListener("click", () => {
    galeria = Array.from(imgs).map(e => e.dataset.src);
    idx = i; abrirLightbox();
  }));
}
function mostrar() {
  const img = document.getElementById("lightbox-img");
  img.src = galeria[idx];
  document.getElementById("lightbox-count").textContent = `${idx + 1} / ${galeria.length}`;
  img.style.animation = "none"; img.offsetHeight; img.style.animation = "zoomIn .3s ease";
}
function abrirLightbox() {
  mostrar();
  document.getElementById("lightbox-modal").classList.remove("hidden");
  document.body.style.overflow = "hidden";
}
function changeImage(d) { idx = (idx + d + galeria.length) % galeria.length; mostrar(); }
function closeLightbox() {
  document.getElementById("lightbox-modal").classList.add("hidden");
  document.body.style.overflow = "auto";
}
document.addEventListener("keydown", e => {
  if (document.getElementById("lightbox-modal").classList.contains("hidden")) return;
  if (e.key === "ArrowRight") changeImage(1);
  if (e.key === "ArrowLeft") changeImage(-1);
  if (e.key === "Escape") closeLightbox();
});

// ---------- Detalles de interfaz ----------
const fino = matchMedia("(pointer:fine)").matches;

function mejorasUI() {
  // Titular con entrada letra por letra (las palabras no se parten en móvil)
  document.querySelectorAll(".hero h1").forEach(h1 => {
    let n = 0;
    const wrap = node => [...node.childNodes].forEach(c => {
      if (c.nodeType !== 3) return wrap(c);
      const f = document.createDocumentFragment();
      c.textContent.split(/(\s+)/).forEach(w => {
        if (!w) return;
        if (/^\s+$/.test(w)) return f.append(" ");
        const word = document.createElement("span"); word.className = "w";
        [...w].forEach(ch => { const s = document.createElement("span"); s.className = "ch"; s.textContent = ch; s.style.animationDelay = 0.25 + n++ * 0.05 + "s"; word.append(s); });
        f.append(word);
      });
      c.replaceWith(f);
    });
    wrap(h1);
  });
  if (!fino) return;
  // Inclinación 3D con brillo que sigue al puntero
  document.querySelectorAll(".glass-item").forEach(el => {
    el.classList.add("tilt");
    el.addEventListener("pointermove", e => {
      const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      el.style.setProperty("--ry", (x - 0.5) * 12 + "deg");
      el.style.setProperty("--rx", (0.5 - y) * 12 + "deg");
      el.style.setProperty("--mx", x * 100 + "%"); el.style.setProperty("--my", y * 100 + "%");
    });
    el.addEventListener("pointerleave", () => { el.style.setProperty("--rx", "0deg"); el.style.setProperty("--ry", "0deg"); });
  });
}

// Luz que sigue al cursor (con inercia)
(() => {
  const glow = document.getElementById("cursor-glow");
  if (!glow || !fino) return;
  let tx = innerWidth / 2, ty = innerHeight / 2, x = tx, y = ty;
  addEventListener("pointermove", e => { tx = e.clientX; ty = e.clientY; });
  (function tick() { x += (tx - x) * 0.08; y += (ty - y) * 0.08; glow.style.transform = `translate(${x}px,${y}px)`; requestAnimationFrame(tick); })();
})();

// Deslizar para cambiar de foto (iPhone / Android)
(() => {
  const lb = document.getElementById("lightbox-modal"); let x0 = null;
  lb.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener("touchend", e => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) changeImage(dx < 0 ? 1 : -1); x0 = null;
  }, { passive: true });
})();
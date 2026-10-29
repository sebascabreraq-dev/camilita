document.addEventListener("DOMContentLoaded", () => {
    const loaderScreen = document.getElementById("loader-screen");
    const bottomDock = document.getElementById("bottom-dock");
    const countdownEl = document.getElementById("countdown");
    const appContainer = document.getElementById("app-container");
    
    // --- LÓGICA DE CARGA INICIAL ---
    let timeLeft = 15;
    const timerInterval = setInterval(() => {
        timeLeft--;
        countdownEl.textContent = timeLeft;
        if (timeLeft <= 0) clearInterval(timerInterval);
    }, 1000);

    setTimeout(() => {
        loaderScreen.style.opacity = '0';
        setTimeout(() => {
            loaderScreen.style.display = 'none';
            appContainer.classList.remove('hidden');
            bottomDock.classList.remove('hidden'); 
            
            // Cargar el componente principal por defecto
            cargarComponente('home');
            
        }, 1000); 
    }, 15000); 

    // --- GENERAR FONDO DE ICONOS ---
    const bgContainer = document.getElementById("background-icons");
    const iconsToUse = ["heart", "sparkles", "star", "heart-half"];
    for (let i = 0; i < 35; i++) {
        const icon = document.createElement("ion-icon");
        icon.setAttribute("name", iconsToUse[Math.floor(Math.random() * iconsToUse.length)]);
        icon.classList.add("floating-icon");
        icon.style.left = `${Math.random() * 100}vw`;
        icon.style.fontSize = `${Math.random() * 2 + 0.5}rem`;
        icon.style.animationDuration = `${Math.random() * 15 + 15}s`;
        icon.style.animationDelay = `-${Math.random() * 20}s`;
        icon.style.opacity = Math.random() * 0.06 + 0.02; 
        bgContainer.appendChild(icon);
    }
});

// ==========================================
// RUTEADOR: CARGAR COMPONENTES EXTERNOS
// ==========================================
async function cargarComponente(vista) {
    try {
        // Carga el archivo HTML correspondiente (home.html o galeria.html)
        const response = await fetch(`${vista}.html`);
        const html = await response.text();
        
        // Inyecta el HTML en el contenedor principal
        document.getElementById('app-container').innerHTML = html;
        
        // Actualiza la estética del Dock inferior
        actualizarDock(vista);

        // Reiniciar funcionalidades para los elementos recién cargados
        window.scrollTo({ top: 0, behavior: 'smooth' });
        reiniciarAnimaciones();
        inicializarLightbox();
        
        // Si estamos en 'home', reactivar el botón "No" juguetón
        if(vista === 'home') {
            activarBotonNo();
        }

    } catch (error) {
        console.error("Error al cargar el componente:", error);
    }
}

function actualizarDock(vistaActiva) {
    const btnPrincipal = document.getElementById("btn-principal");
    const btnGaleria = document.getElementById("btn-galeria");
    const btnMetaforas = document.getElementById("btn-metaforas");

    // 1. Apagamos todos los botones primero y ponemos sus iconos en "outline"
    [btnPrincipal, btnGaleria, btnMetaforas].forEach(btn => {
        btn.classList.remove("active");
    });
    btnPrincipal.querySelector("ion-icon").setAttribute("name", "home-outline");
    btnGaleria.querySelector("ion-icon").setAttribute("name", "images-outline");
    btnMetaforas.querySelector("ion-icon").setAttribute("name", "rose-outline");

    // 2. Encendemos solo el botón de la vista activa y rellenamos su icono
    if (vistaActiva === 'home') {
        btnPrincipal.classList.add("active");
        btnPrincipal.querySelector("ion-icon").setAttribute("name", "home"); 
    } else if (vistaActiva === 'galeria') {
        btnGaleria.classList.add("active");
        btnGaleria.querySelector("ion-icon").setAttribute("name", "images"); 
    } else if (vistaActiva === 'metaforas') {
        btnMetaforas.classList.add("active");
        btnMetaforas.querySelector("ion-icon").setAttribute("name", "rose"); 
    }
}

// ==========================================
// FUNCIONES REUSABLES (Animaciones, Botones, Visor)
// ==========================================
let observer;
function reiniciarAnimaciones() {
    if(observer) observer.disconnect();
    const observerOptions = { root: null, rootMargin: "0px", threshold: 0.15 };
    observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) entry.target.classList.add("visible");
        });
    }, observerOptions);
    const fadeElements = document.querySelectorAll(".fade-in");
    fadeElements.forEach(el => observer.observe(el));
}

function activarBotonNo() {
    const btnNo = document.getElementById("btn-no");
    if(btnNo) {
        btnNo.addEventListener("mouseover", () => {
            const x = Math.random() * (window.innerWidth / 2) - (window.innerWidth / 4);
            const y = Math.random() * 100 - 50;
            btnNo.style.transform = `translate(${x}px, ${y}px)`;
        });
    }
}

function acceptProposal() {
    const successMsg = document.getElementById("success-msg");
    const buttonsContainer = document.querySelector(".buttons-container");
    buttonsContainer.style.display = "none";
    successMsg.classList.remove("hidden");
    successMsg.style.color = "#ff758c";
    successMsg.style.fontSize = "1.8rem";
    successMsg.style.marginTop = "2rem";
    successMsg.style.fontFamily = "'Playfair Display', serif";
}

// ==========================================
// LÓGICA DEL VISOR DE FOTOS
// ==========================================
let currentGalleryArray = []; 
let currentPhotoIndex = 0;    

function inicializarLightbox() {
    const images = document.querySelectorAll('.view-img');
    images.forEach((imgEl, index) => {
        imgEl.addEventListener('click', () => {
            currentGalleryArray = Array.from(images).map(el => el.getAttribute('data-src'));
            currentPhotoIndex = index;
            abrirLightbox();
        });
    });
}

function abrirLightbox() {
    const lightboxModal = document.getElementById('lightbox-modal');
    const lightboxImg = document.getElementById('lightbox-img');
    lightboxImg.src = currentGalleryArray[currentPhotoIndex];
    lightboxModal.classList.remove('hidden');
    document.body.style.overflow = "hidden";
}

function changeImage(direction) {
    currentPhotoIndex += direction;
    if (currentPhotoIndex < 0) currentPhotoIndex = currentGalleryArray.length - 1;
    else if (currentPhotoIndex >= currentGalleryArray.length) currentPhotoIndex = 0;

    const lightboxImg = document.getElementById('lightbox-img');
    lightboxImg.src = currentGalleryArray[currentPhotoIndex];
    
    lightboxImg.style.animation = 'none';
    lightboxImg.offsetHeight; 
    lightboxImg.style.animation = 'zoomIn 0.3s ease';
}

function closeLightbox() {
    document.getElementById('lightbox-modal').classList.add('hidden');
    document.body.style.overflow = "auto"; 
}

document.addEventListener('keydown', (e) => {
    const modal = document.getElementById('lightbox-modal');
    if (!modal.classList.contains('hidden')) {
        if (e.key === 'ArrowRight') changeImage(1);
        if (e.key === 'ArrowLeft') changeImage(-1);
        if (e.key === 'Escape') closeLightbox();
    }
});
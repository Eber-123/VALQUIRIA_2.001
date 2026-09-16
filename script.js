// ==========================================
// 1. PARTICLE SATURN 3D (ROJO INTENSO CON GLOW)
// ==========================================
const PERSPECTIVE = 0.15;
const VIEW_SPAN = 6.4;
const CORE_RADIUS = 1;
const MAX_MOTES = 90000;
const RING_THICKNESS = 0.012;
const RING_MOTE_FACTOR = 1.4;

const DEFAULTS_SATURN = {
  coreColor: "#FF0055",
  ringColor: "#FF6699",
  density: 20,
  particleSize: 16,
  glow: 30,
  tilt: 26, 
  roll: 7,
  spinSpeed: 6,
  ringOptions: { innerRadius: 138, outerRadius: 262, gaps: 2, orbitSpeed: 9 },
  dragSensitivity: 2,
  sizePercent: 130,
};

function clamp(v, lo, hi, fallback) {
  const n = typeof v === "number" && isFinite(v) ? v : fallback;
  return Math.max(lo, Math.min(hi, n));
}

function settingsForSaturn(cfg) {
  const ring = cfg.ringOptions || DEFAULTS_SATURN.ringOptions;
  const density = clamp(cfg.density, 1, 20, DEFAULTS_SATURN.density);
  const baseMotes = 600 + density * density * 95;
  const coreMotes = Math.min(MAX_MOTES, Math.round(baseMotes));
  const ringMotes = Math.min(MAX_MOTES, Math.round(baseMotes * RING_MOTE_FACTOR));
  const innerFraction = clamp(ring.innerRadius, 105, 200, DEFAULTS_SATURN.ringOptions.innerRadius) / 100;
  const outerFraction = clamp(ring.outerRadius, 110, 300, DEFAULTS_SATURN.ringOptions.outerRadius) / 100;

  return {
    coreMotes,
    ringMotes,
    moteSize: 0.5 + clamp(cfg.particleSize, 1, 20, DEFAULTS_SATURN.particleSize) * 0.13,
    glow: 0.15 + clamp(cfg.glow, 1, 20, DEFAULTS_SATURN.glow) * 0.055,
    tiltRadians: (clamp(cfg.tilt, -80, 80, DEFAULTS_SATURN.tilt) * Math.PI) / 180,
    rollRadians: (clamp(cfg.roll, -90, 90, DEFAULTS_SATURN.roll) * Math.PI) / 180,
    spinRate: clamp(cfg.spinSpeed, 0, 20, DEFAULTS_SATURN.spinSpeed) * 0.05,
    innerRadius: innerFraction * CORE_RADIUS,
    outerRadius: Math.max(innerFraction + 0.08, outerFraction) * CORE_RADIUS,
    gapCount: Math.round(clamp(ring.gaps, 0, 4, DEFAULTS_SATURN.ringOptions.gaps)),
    ringThickness: RING_THICKNESS,
    orbitRate: clamp(ring.orbitSpeed, 0, 20, DEFAULTS_SATURN.ringOptions.orbitSpeed) * 0.11,
  };
}

function insideGap(S, radius, span) {
  for (let g = 0; g < S.gapCount; g++) {
    const centre = S.innerRadius + span * ((g + 1) / (S.gapCount + 1));
    const halfWidth = span * (0.075 - g * 0.011);
    if (Math.abs(radius - centre) < halfWidth) return true;
  }
  return false;
}

function pickRingRadius(S, span) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const u = Math.sqrt(Math.random());
    const radius = S.innerRadius + u * span;
    if (!insideGap(S, radius, span)) return radius;
  }
  return S.outerRadius;
}

function buildCloud(S) {
  const count = S.coreMotes + S.ringMotes;
  const position = new Float32Array(count * 3);
  const kind = new Float32Array(count);
  const along = new Float32Array(count);
  const seed = new Float32Array(count);
  const radius = new Float32Array(count);

  for (let i = 0; i < S.coreMotes; i++) {
    kind[i] = 0;
    along[i] = (i + 0.5) / S.coreMotes;
    seed[i] = Math.random();
    radius[i] = 0;
  }
  const span = S.outerRadius - S.innerRadius;
  for (let i = 0; i < S.ringMotes; i++) {
    const k = S.coreMotes + i;
    kind[k] = 1;
    along[k] = i / Math.max(1, S.ringMotes - 1);
    seed[k] = Math.random();
    radius[k] = pickRingRadius(S, span);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
  geometry.setAttribute("aKind", new THREE.BufferAttribute(kind, 1));
  geometry.setAttribute("aAlong", new THREE.BufferAttribute(along, 1));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  geometry.setAttribute("aRadius", new THREE.BufferAttribute(radius, 1));
  return geometry;
}

const SATURN_VERTEX = `
  attribute float aKind;
  attribute float aAlong;
  attribute float aSeed;
  attribute float aRadius;
  uniform float uTime;
  uniform float uMoteSize;
  uniform float uOrbitRate;
  uniform float uRingThickness;
  uniform float uCoreRadius;
  uniform float uPixelRatio;
  varying float vKind;
  varying float vBright;
  const float TAU = 6.28318530718;
  float hash11(float n) { return fract(sin(n * 78.233) * 43758.5453); }
  void main() {
      vec3 modelPos;
      float bright = 1.0;
      if (aKind < 0.5) {
          float y = 1.0 - aAlong * 2.0;
          float ringRadius = sqrt(max(0.0, 1.0 - y * y));
          float theta = aAlong * 2399.96;
          modelPos = vec3(cos(theta) * ringRadius, y, sin(theta) * ringRadius) * uCoreRadius;
          modelPos *= 1.0 + (hash11(aSeed * 91.7) - 0.5) * 0.012;
          bright = 0.55 + hash11(aSeed * 13.1) * 0.6;
      } else {
          float orbitRadius = aRadius;
          float rate = uOrbitRate / pow(max(orbitRadius, 0.2), 1.5);
          float theta = aSeed * TAU + uTime * rate;
          float lift = (hash11(aSeed * 37.9) - 0.5) * 2.0 * uRingThickness;
          modelPos = vec3(cos(theta) * orbitRadius, lift, sin(theta) * orbitRadius);
          float lane = hash11(floor(orbitRadius * 46.0));
          bright = (0.35 + lane * 0.95) * (0.6 + hash11(aSeed * 5.3) * 0.7);
      }
      vec4 viewPos = modelViewMatrix * vec4(modelPos, 1.0);
      vec3 modelCentre = modelViewMatrix[3].xyz;
      vec3 fromCamera = viewPos.xyz;
      float rayLength = max(length(fromCamera), 1e-5);
      vec3 rayDir = fromCamera / rayLength;
      float alongRay = dot(modelCentre, rayDir);
      float offAxis = length(modelCentre - rayDir * alongRay);
      bool occluded;
      if (aKind < 0.5) {
          occluded = dot(viewPos.xyz - modelCentre, rayDir) > 0.0;
      } else {
          float inside = uCoreRadius * uCoreRadius - offAxis * offAxis;
          float nearHit = alongRay - sqrt(max(inside, 0.0));
          occluded = inside > 0.0 && rayLength > nearHit;
      }
      if (occluded) {
          gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
          gl_PointSize = 0.0;
          vKind = aKind;
          vBright = 0.0;
          return;
      }
      gl_Position = projectionMatrix * viewPos;
      gl_PointSize = uMoteSize * uPixelRatio * (9.0 / max(0.001, -viewPos.z));
      vKind = aKind;
      vBright = bright;
  }
`;

const SATURN_FRAGMENT = `
  precision highp float;
  uniform vec3 uCoreColor;
  uniform vec3 uRingColor;
  uniform float uGlow;
  varying float vKind;
  varying float vBright;
  void main() {
      float d = length(gl_PointCoord - 0.5) * 2.0;
      if (d > 1.0) discard;
      float fall = 1.0 - d;
      float shape = pow(fall, 5.0) + pow(fall, 1.6) * 0.3;
      vec3 col = vKind < 0.5 ? uCoreColor : uRingColor;
      float a = shape * vBright * (0.35 + uGlow);
      gl_FragColor = vec4(col * a, a);
  }
`;

class ParticleSaturnComponent extends HTMLElement {
  connectedCallback() {
    this.cfg = {
      coreColor: this.getAttribute("core-color") || DEFAULTS_SATURN.coreColor,
      ringColor: this.getAttribute("ring-color") || DEFAULTS_SATURN.ringColor,
      density: parseFloat(this.getAttribute("density")) || DEFAULTS_SATURN.density,
      particleSize: parseFloat(this.getAttribute("particle-size")) || DEFAULTS_SATURN.particleSize,
      glow: parseFloat(this.getAttribute("glow")) || DEFAULTS_SATURN.glow,
      tilt: parseFloat(this.getAttribute("tilt")) || DEFAULTS_SATURN.tilt,
      roll: parseFloat(this.getAttribute("roll")) || DEFAULTS_SATURN.roll,
      spinSpeed: parseFloat(this.getAttribute("spin-speed")) || DEFAULTS_SATURN.spinSpeed,
      dragSensitivity: parseFloat(this.getAttribute("drag-sensitivity")) || DEFAULTS_SATURN.dragSensitivity,
      sizePercent: parseFloat(this.getAttribute("size-percent")) || DEFAULTS_SATURN.sizePercent,
      ringOptions: DEFAULTS_SATURN.ringOptions
    };

    const S = settingsForSaturn(this.cfg);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setClearColor(0x000000, 0);

    const el = this.renderer.domElement;
    el.style.position = "absolute";
    el.style.inset = "0";
    el.style.width = "100%";
    el.style.height = "100%";
    el.style.cursor = "grab";
    el.style.touchAction = "none";
    this.appendChild(el);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 2000);
    this.group = new THREE.Group();
    this.material = new THREE.ShaderMaterial({
      vertexShader: SATURN_VERTEX,
      fragmentShader: SATURN_FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uMoteSize: { value: S.moteSize },
        uOrbitRate: { value: S.orbitRate },
        uRingThickness: { value: S.ringThickness },
        uCoreRadius: { value: CORE_RADIUS },
        uPixelRatio: { value: dpr },
        uCoreColor: { value: new THREE.Color(this.cfg.coreColor) },
        uRingColor: { value: new THREE.Color(this.cfg.ringColor) },
        uGlow: { value: S.glow },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });
    this.cloudGeometry = buildCloud(S);
    this.cloud = new THREE.Points(this.cloudGeometry, this.material);
    this.cloud.frustumCulled = false;
    this.group.add(this.cloud);
    this.group.rotation.order = "ZXY";
    this.scene.add(this.group);

    this.time = 0;
    this.spinAngle = 0;
    this.dragYaw = 0;
    this.dragPitch = 0;
    this.velocityYaw = 0;
    this.velocityPitch = 0;
    this.isDragging = false;

    this.bindEvents();
    this.setSize(this.clientWidth, this.clientHeight);
    this.start();

    this.ro = new ResizeObserver(() => this.setSize(this.clientWidth, this.clientHeight));
    this.ro.observe(this);
  }

  bindEvents() {
    const el = this.renderer.domElement;
    const down = (e) => {
      this.isDragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.velocityYaw = 0;
      this.velocityPitch = 0;
      el.style.cursor = "grabbing";
    };
    const move = (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      const s = clamp(this.cfg.dragSensitivity, 0, 10, 3) * 0.007;
      this.dragYaw += dx * s;
      this.dragPitch += dy * s;
      this.velocityYaw = dx * s;
      this.velocityPitch = dy * s;
    };
    const up = () => { this.isDragging = false; el.style.cursor = "grab"; };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  setSize(width, height) {
    if (width <= 0 || height <= 0) return;
    this.width = width;
    this.height = height;
    this.renderer.setSize(width, height, false);
    const aspect = width / height;
    const distance = 1 / PERSPECTIVE;
    const sizePct = clamp(this.cfg.sizePercent, 20, 200, 90);
    const span = VIEW_SPAN * (100 / sizePct);
    const visibleHeight = aspect < 1 ? span / aspect : span;
    this.camera.aspect = aspect;
    this.camera.position.set(0, 0, distance);
    this.camera.lookAt(0, 0, 0);
    this.camera.fov = 2 * Math.atan(visibleHeight / 2 / distance) * (180 / Math.PI);
    this.camera.near = Math.max(0.1, distance - 20);
    this.camera.far = distance + 20;
    this.camera.updateProjectionMatrix();
  }

  start() {
    this.lastT = performance.now();
    const loop = () => {
      this.frameId = requestAnimationFrame(loop);
      this.step();
    };
    loop();
  }

  step() {
    const now = performance.now();
    let dt = (now - this.lastT) / 1000;
    this.lastT = now;
    if (!isFinite(dt) || dt < 0) dt = 0;
    if (dt > 0.05) dt = 0.05;

    const S = settingsForSaturn(this.cfg);
    this.time += dt;

    if (!this.isDragging) {
      const decay = Math.exp(-dt * 3);
      this.dragYaw += this.velocityYaw;
      this.dragPitch += this.velocityPitch;
      this.velocityYaw *= decay;
      this.velocityPitch *= decay;
      this.spinAngle += S.spinRate * dt;
    }

    const pitch = Math.max(-1.2, Math.min(1.2, this.dragPitch));
    this.group.rotation.set(S.tiltRadians + pitch, this.dragYaw + this.spinAngle, S.rollRadians);
    this.material.uniforms.uTime.value = this.time;
    this.renderer.render(this.scene, this.camera);
  }
}

customElements.define("particle-saturn", ParticleSaturnComponent);


// ==========================================
// 2. TEXTO CONTINUO FLUIDO (GSAP TYPEWRITER)
// ==========================================

const TEXT_TOP_CONTENT = "ERES_LA_PERSONA_QUE_ALEGRA_MIS_DIAS";
const TEXT_BOTTOM_CONTENT = "ERES_ESE_PERSONAS_QUE_A_PESAR_DE_MIS_MIL_DEFECTOS_SIEMPRE_ESTÁ_AHI_PARA_AYUDARME, TE_QUIEROOOOOO!!!! ❤️";

function animateTextStream(targetId, text) {
  const container = document.getElementById(targetId);
  if (!container) return;

  container.innerHTML = "";
  const chars = text.split("");

  chars.forEach((char) => {
    const span = document.createElement("span");
    span.textContent = char;
    span.style.opacity = "0";
    span.style.display = "inline-block";
    container.appendChild(span);
  });

  gsap.to(`#${targetId} span`, {
    opacity: 1,
    y: 0,
    duration: 0.05,
    stagger: 0.04,
    ease: "power1.inOut",
    repeat: -1,
    repeatDelay: 4,
    yoyo: true
  });
}


// ==========================================
// 3. CARROUSEL CON IMÁGENES LOCALES
// ==========================================

// Rutas locales apuntando a tu carpeta imagenes/
const LOCAL_IMAGES = [
  "imagenes/images (1).jpg",
  "imagenes/images (2).jpg",
  "imagenes/images (3).jpg",
  "imagenes/images (4).jpg",
  "imagenes/images (5).jpg"
];

const STICKERS = ["💖", "🌹", "🥰", "🌸", "💌"];

class RoundCarouselVanilla {
  constructor(container, options = {}) {
    this.container = container;
    this.images = options.images || LOCAL_IMAGES;
    this.imageWidth = options.imageWidth || 170;
    this.imageHeight = options.imageHeight || 170;
    this.spacing = options.spacing || 2.8;
    this.speed = options.speed || 5;
    this.tilt = options.tilt || -5;
    this.perspective = options.perspective || 1800;
    this.rotY = 0;
    this.vel = 0;
    this.lastTime = 0;
    this.isDragging = false;
    this.startX = 0;
    this.init();
  }

  init() {
    const count = this.images.length;
    const angle = 360 / count;
    const factor = 1 + this.spacing * 0.15;
    const radius = (this.imageWidth * factor) / (2 * Math.tan(Math.PI / count));

    this.container.style.perspective = `${this.perspective}px`;
    this.container.style.display = "flex";
    this.container.style.alignItems = "center";
    this.container.style.justifyContent = "center";
    this.container.style.cursor = "grab";

    const tiltGroup = document.createElement("div");
    tiltGroup.style.transformStyle = "preserve-3d";
    tiltGroup.style.transform = `rotateX(${this.tilt}deg)`;

    this.ring = document.createElement("div");
    this.ring.style.position = "relative";
    this.ring.style.width = `${this.imageWidth}px`;
    this.ring.style.height = `${this.imageHeight}px`;
    this.ring.style.transformStyle = "preserve-3d";

    this.images.forEach((src, i) => {
      const item = document.createElement("div");
      Object.assign(item.style, { 
        position: "absolute", 
        inset: "0", 
        transform: `rotateY(${i * angle}deg) translateZ(${radius}px)`, 
        transformStyle: "preserve-3d" 
      });

      const face = document.createElement("div");
      Object.assign(face.style, { 
        position: "absolute", 
        inset: "0", 
        borderRadius: "18px", 
        overflow: "hidden", 
        backfaceVisibility: "hidden", 
        backgroundImage: `url('${src}')`, 
        backgroundSize: "cover", 
        backgroundPosition: "center", 
        boxShadow: "0 10px 30px rgba(255,0,85,0.4)",
        border: "2px solid rgba(255,102,153,0.6)"
      });

      const sticker1 = document.createElement("div");
      sticker1.className = "love-sticker sticker-1";
      sticker1.textContent = STICKERS[i % STICKERS.length];

      const sticker2 = document.createElement("div");
      sticker2.className = "love-sticker sticker-2";
      sticker2.textContent = STICKERS[(i + 2) % STICKERS.length];

      face.appendChild(sticker1);
      face.appendChild(sticker2);
      item.appendChild(face);
      this.ring.appendChild(item);
    });

    tiltGroup.appendChild(this.ring);
    this.container.appendChild(tiltGroup);
    this.bindEvents();
    this.animate();
  }

  bindEvents() {
    const down = (e) => { 
      this.isDragging = true; 
      this.startX = e.clientX; 
      this.vel = 0; 
      this.container.style.cursor = "grabbing"; 
    };
    const move = (e) => { 
      if (!this.isDragging) return; 
      const dx = e.clientX - this.startX; 
      this.startX = e.clientX; 
      this.rotY += dx * 1.2; 
      this.vel = dx * 30; 
    };
    const up = () => { 
      this.isDragging = false; 
      this.container.style.cursor = "grab"; 
    };
    this.container.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  animate(now = 0) {
    const dt = this.lastTime ? (now - this.lastTime) / 1000 : 0;
    this.lastTime = now;
    const f = Math.min(dt, 0.1);

    if (!this.isDragging) {
      if (Math.abs(this.vel) > 0.01) { 
        this.rotY += this.vel * f; 
        this.vel *= 0.94; 
      } else { 
        this.rotY += this.speed * 6 * f; 
      }
    }

    const count = this.images.length;
    const factor = 1 + this.spacing * 0.15;
    const radius = (this.imageWidth * factor) / (2 * Math.tan(Math.PI / count));
    this.ring.style.transform = `translateZ(${-radius}px) rotateY(${this.rotY}deg)`;
    requestAnimationFrame((t) => this.animate(t));
  }
}


// ==========================================
// 4. LLUVIA LENTA DE CORAZONES EN ESPIRAL
// ==========================================
function createSlowSpiralHearts() {
  const container = document.getElementById("hearts-container");
  if (!container) return;

  const heartTypes = ["💖", "❤️", "💕", "💗", "🌹", "✨"];

  setInterval(() => {
    const heart = document.createElement("div");
    heart.className = "falling-heart";
    heart.textContent = heartTypes[Math.floor(Math.random() * heartTypes.length)];
    heart.style.left = `${Math.random() * 95}vw`;
    heart.style.animationDuration = `${7 + Math.random() * 5}s`;
    heart.style.fontSize = `${18 + Math.random() * 18}px`;

    container.appendChild(heart);

    setTimeout(() => { heart.remove(); }, 12000);
  }, 280);
}


// ==========================================
// 5. INICIALIZACIÓN
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  // Animación del texto fluido
  animateTextStream("text-top", TEXT_TOP_CONTENT);
  animateTextStream("text-bottom", TEXT_BOTTOM_CONTENT);

  // Inicializar Carrusel lateral
  const carouselContainer = document.getElementById("round-carousel-container");
  if (carouselContainer) {
    new RoundCarouselVanilla(carouselContainer);
  }

  // Lluvia suave de corazones
  createSlowSpiralHearts();
});
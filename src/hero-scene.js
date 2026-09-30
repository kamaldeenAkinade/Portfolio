// Hero particle palm.
// Source file: bundled into js/hero-scene.js with `npm run build`.
//
// The hero photo is sampled into a cloud of GPU particles. All motion (intro
// assembly, wind, cursor repulsion, click ripples, scroll dispersal) runs in
// the vertex shader, so the CPU only updates a handful of uniforms per frame.

import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, BufferGeometry, BufferAttribute,
  ShaderMaterial, Points, AdditiveBlending, Vector2, Vector3, Color,
} from 'three';

const noiseGLSL = /* glsl */ `
  // 3D simplex noise, Ashima Arts / Stefan Gustavson (MIT)
  vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
  float snoise(vec3 v){
    const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
    vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
    vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
    vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
    i=mod289(i);
    vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
    float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;
    vec4 j=p-49.0*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);
    vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);
    vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
    vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));
    vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
    vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
    vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
    vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
    return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }
`;

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uIntro;
  uniform float uScroll;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform vec3  uMouse;
  uniform float uMouseForce;
  uniform vec2  uRippleOrigin;
  uniform float uRippleAge;
  uniform vec3  uAccent;

  attribute vec3 aColor;
  attribute vec3 aScatter;
  attribute vec4 aRand;   // x: intro delay, y: size, z: phase, w: 1 = ambient dust

  varying vec3  vColor;
  varying float vAlpha;

  ${noiseGLSL}

  void main() {
    vec3 p = position;
    float dust = aRand.w;

    // Living motion: slow noise drift + wind that grows toward the leaf tips
    float t = uTime * 0.22;
    vec3 q = p * 0.45;
    p += vec3(snoise(q + vec3(t, 0.0, 0.0)), snoise(q + vec3(0.0, t, 4.0)), snoise(q + vec3(8.0, 0.0, t))) * (0.05 + dust * 0.5);
    p.x += sin(uTime * 0.9 + p.y * 0.7 + aRand.z) * 0.035 * abs(p.x) * (1.0 - dust);

    // Cursor: particles part around the pointer and lift toward the viewer
    vec2 toP = p.xy - uMouse.xy;
    float d = length(toP);
    float push = smoothstep(1.1, 0.0, d) * uMouseForce;
    p.xy += normalize(toP + 1e-5) * push * 0.75;
    p.z += push * 1.4 * (0.5 + aRand.y);

    // Click / tap shockwave
    float rd = length(p.xy - uRippleOrigin);
    float ring = exp(-pow((rd - uRippleAge * 4.2) * 2.2, 2.0)) * exp(-uRippleAge * 1.3);
    p.z += ring * 1.5;
    p.xy += normalize(p.xy - uRippleOrigin + 1e-5) * ring * 0.35;

    // Intro: every particle flies in from its scatter point on its own delay
    float k = clamp(uIntro * 1.7 - aRand.x * 0.7, 0.0, 1.0);
    k = 1.0 - pow(1.0 - k, 4.0);
    p = mix(aScatter, p, dust > 0.5 ? 1.0 : k);

    // Scroll: the palm bursts outward and drifts up as you leave the hero
    float s = uScroll * uScroll;
    p += normalize(aScatter + 1e-5) * s * (1.5 + aRand.y * 5.0);
    p.y += s * aRand.z * 0.4;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;

    float energy = clamp(push * 1.2 + ring * 2.0, 0.0, 1.0);
    gl_PointSize = uSize * (0.45 + aRand.y * 0.9) * (1.0 + energy * 0.9) * uPixelRatio / -mv.z;

    vColor = mix(aColor, uAccent, energy);
    float intro = dust > 0.5 ? smoothstep(0.3, 1.0, uIntro) : (0.15 + 0.85 * k);
    vAlpha = intro * (1.0 - s * 0.8) * (dust > 0.5 ? 0.5 + 0.5 * sin(uTime * 1.5 + aRand.z * 6.0) : 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3  vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float a = pow(1.0 - d * 2.0, 1.6);
    gl_FragColor = vec4(vColor, a * vAlpha);
  }
`;

const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

function sampleImage(img, sampleWidth) {
  const sw = sampleWidth;
  const sh = Math.round(sw * (img.naturalHeight / img.naturalWidth));
  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, sw, sh);
  return { data: ctx.getImageData(0, 0, sw, sh).data, sw, sh };
}

function buildGeometry(img, { sampleWidth, dustCount }) {
  const { data, sw, sh } = sampleImage(img, sampleWidth);
  const worldH = 6;
  const worldW = worldH * (sw / sh);
  const cell = worldW / sw;

  const pos = [], col = [], scatter = [], rand = [];
  const push = (x, y, z, r, g, b, dust) => {
    pos.push(x, y, z);
    col.push(r, g, b);
    // Scatter origin: a random point on a large shell
    const u = Math.random() * Math.PI * 2, v = Math.acos(2 * Math.random() - 1), rad = 7 + Math.random() * 6;
    scatter.push(rad * Math.sin(v) * Math.cos(u), rad * Math.sin(v) * Math.sin(u), rad * Math.cos(v) * 0.6);
    rand.push(Math.random(), Math.random(), Math.random(), dust);
  };

  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const i = (y * sw + x) * 4;
      const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
      const bright = Math.max(r, g, b);
      // Dissolve the rectangular photo edge into an organic oval
      const nx = (x / sw - 0.5) * 2, ny = (y / sh - 0.5) * 2;
      const edge = 1 - smoothstep(0.7, 1.05, Math.hypot(nx * 0.95, ny * 0.8));
      if (Math.random() > smoothstep(0.08, 0.4, bright) * edge) continue;

      const px = (x / sw - 0.5) * worldW + (Math.random() - 0.5) * cell;
      const py = -(y / sh - 0.5) * worldH + (Math.random() - 0.5) * cell;
      // Brighter leaves float forward; the frond bows away at the sides
      const pz = (bright - 0.5) * 1.1 - px * px * 0.12 + (Math.random() - 0.5) * 0.25;
      push(px, py, pz, Math.min(1, r * 1.15), g * 0.9, b * 0.9, 0);
    }
  }

  // Sparse ambient dust around the palm, in the site's lime and paper tones
  const lime = new Color('#d8ff4f'), paper = new Color('#e9e8df');
  for (let n = 0; n < dustCount; n++) {
    const c = Math.random() < 0.6 ? lime : paper;
    const k = 0.35 + Math.random() * 0.4;
    push((Math.random() - 0.5) * 11, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 5, c.r * k, c.g * k, c.b * k, 1);
  }

  // Shuffle so drawRange can cheaply thin the cloud on slow devices
  const count = pos.length / 3;
  const order = Array.from({ length: count }, (_, i) => i);
  for (let i = count - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [order[i], order[j]] = [order[j], order[i]]; }
  const pick = (src, size) => {
    const out = new Float32Array(count * size);
    order.forEach((from, to) => { for (let s = 0; s < size; s++) out[to * size + s] = src[from * size + s]; });
    return out;
  };

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(pick(pos, 3), 3));
  geometry.setAttribute('aColor', new BufferAttribute(pick(col, 3), 3));
  geometry.setAttribute('aScatter', new BufferAttribute(pick(scatter, 3), 3));
  geometry.setAttribute('aRand', new BufferAttribute(pick(rand, 4), 4));
  return { geometry, count, worldW, worldH };
}

export async function initHeroScene({ container, image, section }) {
  if (!image.complete || !image.naturalWidth) await image.decode();

  const small = innerWidth < 800;
  const { geometry, count, worldW, worldH } = buildGeometry(image, {
    sampleWidth: small ? 135 : 210,
    dustCount: small ? 220 : 450,
  });

  const canvas = document.createElement('canvas');
  canvas.className = 'hero-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  container.prepend(canvas);

  const renderer = new WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
  let pixelRatio = Math.min(devicePixelRatio || 1, small ? 1.75 : 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.setClearColor(0x000000, 0);

  const scene = new Scene();
  const camera = new PerspectiveCamera(35, 1, 0.1, 100);
  const group = new Group();
  scene.add(group);

  const uniforms = {
    uTime: { value: 0 },
    uIntro: { value: 0 },
    uScroll: { value: 0 },
    uSize: { value: 30 },
    uPixelRatio: { value: pixelRatio },
    uMouse: { value: new Vector3(99, 99, 0) },
    uMouseForce: { value: 0 },
    uRippleOrigin: { value: new Vector2(99, 99) },
    uRippleAge: { value: 10 },
    uAccent: { value: new Color('#d8ff4f') },
  };
  const material = new ShaderMaterial({
    uniforms, vertexShader, fragmentShader,
    transparent: true, depthWrite: false, blending: AdditiveBlending,
  });
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  group.add(points);

  /* Sizing */
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const halfFov = (camera.fov * Math.PI) / 360;
    const fitH = (worldH / 0.8) / 2 / Math.tan(halfFov);
    const fitW = (worldW / 0.8) / 2 / Math.tan(halfFov) / camera.aspect;
    camera.position.set(0, 0, Math.max(fitH, fitW));
    camera.updateProjectionMatrix();
    uniforms.uSize.value = 36 * (h / 720);
  }
  new ResizeObserver(resize).observe(container);
  resize();

  /* Pointer: tracked over the whole hero so the text side also stirs it */
  const pointer = { ndc: new Vector2(), target: new Vector3(99, 99, 0), active: false, lastMove: 0 };
  const tmp = new Vector3(), dir = new Vector3();
  function toLocal(clientX, clientY, out) {
    const r = canvas.getBoundingClientRect();
    pointer.ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    tmp.set(pointer.ndc.x, pointer.ndc.y, 0.5).unproject(camera);
    dir.copy(tmp).sub(camera.position).normalize();
    out.copy(camera.position).addScaledVector(dir, -camera.position.z / dir.z);
    return group.worldToLocal(out);
  }
  section.addEventListener('pointermove', (e) => {
    toLocal(e.clientX, e.clientY, pointer.target);
    pointer.active = true;
    pointer.lastMove = performance.now();
  }, { passive: true });
  section.addEventListener('pointerleave', () => { pointer.active = false; }, { passive: true });
  section.addEventListener('pointerdown', (e) => {
    if (e.target.closest('a, button')) return;
    const p = toLocal(e.clientX, e.clientY, new Vector3());
    uniforms.uRippleOrigin.value.set(p.x, p.y);
    uniforms.uRippleAge.value = 0;
    if (e.pointerType !== 'mouse') { pointer.target.copy(p); pointer.active = true; pointer.lastMove = performance.now(); }
  }, { passive: true });

  /* Scroll dispersal */
  let scrollAmount = 0;
  const readScroll = () => {
    const r = container.getBoundingClientRect();
    scrollAmount = Math.min(1, Math.max(0, -r.top / (r.height * 0.9)));
  };
  addEventListener('scroll', readScroll, { passive: true });
  readScroll();

  /* Loop: runs only while the hero is on screen and the tab is visible */
  let visible = true, running = false, raf = 0, last = performance.now();
  let introStart = -1, inView = false, frames = 0, slowFrames = 0, degraded = false;
  // The assembly intro waits until the palm itself is on screen
  new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; }, { threshold: 0.35 }).observe(container);

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (introStart < 0 && inView) introStart = now;

    uniforms.uTime.value += dt;
    uniforms.uIntro.value = introStart < 0 ? 0 : Math.min(1, (now - introStart) / 2800);
    uniforms.uScroll.value = lerp(uniforms.uScroll.value, scrollAmount, 0.12);
    uniforms.uRippleAge.value += dt;

    const engaged = pointer.active && now - pointer.lastMove < 1600;
    uniforms.uMouseForce.value = lerp(uniforms.uMouseForce.value, engaged ? 1 : 0, engaged ? 0.08 : 0.03);
    uniforms.uMouse.value.lerp(pointer.target, 0.14);

    const t = uniforms.uTime.value;
    const px = pointer.active ? pointer.ndc.x : 0, py = pointer.active ? pointer.ndc.y : 0;
    group.rotation.y = lerp(group.rotation.y, px * 0.3 + Math.sin(t * 0.25) * 0.22, 0.04);
    group.rotation.x = lerp(group.rotation.x, -py * 0.12 + Math.sin(t * 0.18) * 0.05, 0.04);

    renderer.render(scene, camera);

    // Adaptive quality: if the device struggles early on, render fewer, cheaper pixels
    if (!degraded && frames < 120) {
      frames++;
      if (dt > 1 / 38) slowFrames++;
      if (frames === 120 && slowFrames > 45) {
        degraded = true;
        pixelRatio = 1;
        renderer.setPixelRatio(1);
        uniforms.uPixelRatio.value = 1;
        geometry.setDrawRange(0, Math.floor(count * 0.6));
        resize();
      }
    }
  }
  function update() {
    const should = visible && !document.hidden;
    if (should && !running) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
    if (!should && running) { running = false; cancelAnimationFrame(raf); }
  }
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); }, { threshold: 0 }).observe(section);
  document.addEventListener('visibilitychange', update);

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    container.classList.remove('is-3d');
    running = false;
    cancelAnimationFrame(raf);
  });

  renderer.render(scene, camera);
  container.classList.add('is-3d');
  update();
}

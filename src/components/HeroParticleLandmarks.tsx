import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const PARTICLE_COUNT = 3000;

interface LandmarkShape {
  id: string;
  label: string;
  yearTag: string;
  coords: string;
  positions: Float32Array;
  colors: Float32Array;
}

function createGlowTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2
    );
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.28, 'rgba(255,255,255,0.85)');
    grad.addColorStop(0.65, 'rgba(255,255,255,0.2)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function setPt(
  pos: Float32Array,
  col: Float32Array,
  i: number,
  x: number,
  y: number,
  z: number,
  isAmber: boolean
) {
  const bronze = new THREE.Color('#cd9b76');
  const apricot = new THREE.Color('#ebcaa1');
  pos[i * 3] = x;
  pos[i * 3 + 1] = y;
  pos[i * 3 + 2] = z;
  const c = isAmber ? apricot : bronze;
  col[i * 3] = c.r;
  col[i * 3 + 1] = c.g;
  col[i * 3 + 2] = c.b;
}

// 1. Charminar (4 corner minarets, grand arches, upper gallery)
function makeCharminar(): { positions: Float32Array; colors: Float32Array } {
  const pos = new Float32Array(PARTICLE_COUNT * 3);
  const col = new Float32Array(PARTICLE_COUNT * 3);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const t = i / PARTICLE_COUNT;
    let x = 0;
    let y = 0;
    let z = 0;
    let isAmber = false;

    if (t < 0.44) {
      const corner = i % 4;
      const cx = corner === 0 || corner === 1 ? -1.4 : 1.4;
      const cz = corner === 0 || corner === 2 ? -1.4 : 1.4;
      const angle = (i * 2.399) % (Math.PI * 2);
      const h = ((i * 7) % 100) / 100;
      const yVal = -1.8 + h * 4.2;
      const isBalcony = Math.abs(yVal - 0.35) < 0.12 || Math.abs(yVal - 1.15) < 0.12;
      const radius = isBalcony ? 0.36 : yVal > 1.85 ? 0.25 * (1 - (yVal - 1.85) / 0.65) : 0.27;
      x = cx + Math.cos(angle) * Math.max(0.03, radius);
      z = cz + Math.sin(angle) * Math.max(0.03, radius);
      y = yVal;
      isAmber = isBalcony || yVal > 1.8;
    } else if (t < 0.8) {
      const side = i % 4;
      const u = (((i * 13) % 200) / 100 - 1) * 1.32;
      const v = -1.8 + (((i * 17) % 100) / 100) * 2.25;
      const inArch = Math.abs(u) < 0.56 && v < -0.25 && v > -1.8;
      const vy = inArch ? -0.25 + Math.sqrt(Math.max(0, 0.32 - u * u)) * 0.42 : v;
      if (side === 0) { x = u; z = 1.32; }
      else if (side === 1) { x = u; z = -1.32; }
      else if (side === 2) { x = 1.32; z = u; }
      else { x = -1.32; z = u; }
      y = vy;
      isAmber = vy > 0.15;
    } else {
      x = (((i * 19) % 200) / 100 - 1) * 1.25;
      z = (((i * 23) % 200) / 100 - 1) * 1.25;
      y = 0.48 + (i % 3) * 0.12;
      isAmber = true;
    }
    setPt(pos, col, i, x, y, z, isAmber);
  }
  return { positions: pos, colors: col };
}

// 2. Cyber Towers, HITEC City (Twin curved diagrid wings + central glass atrium)
function makeCyberTowers(): { positions: Float32Array; colors: Float32Array } {
  const pos = new Float32Array(PARTICLE_COUNT * 3);
  const col = new Float32Array(PARTICLE_COUNT * 3);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const t = i / PARTICLE_COUNT;
    let x = 0;
    let y = 0;
    let z = 0;
    let isAmber = false;

    if (t < 0.68) {
      // Twin curved outer wings
      const wing = i % 2 === 0 ? -1 : 1;
      const u = ((i * 13) % 100) / 100; // 0..1 along arc
      const h = ((i * 17) % 100) / 100;
      const angle = wing === -1
        ? Math.PI * 0.58 + u * Math.PI * 0.84
        : -Math.PI * 0.42 + u * Math.PI * 0.84;
      const r = 1.75;
      x = Math.cos(angle) * r + wing * 0.32;
      z = Math.sin(angle) * r * 0.72;
      y = -1.7 + h * 3.1;
      // Diagrid pattern highlight
      const diag = Math.abs(((u * 8 + h * 6) % 1) - 0.5) < 0.1 || Math.abs(((u * 8 - h * 6 + 6) % 1) - 0.5) < 0.1;
      isAmber = diag || h > 0.94;
    } else if (t < 0.88) {
      // Central recessed glass atrium
      const u = (((i * 19) % 200) / 100 - 1) * 0.78;
      const h = ((i * 23) % 100) / 100;
      x = u;
      z = -0.55 + Math.cos(u * 1.4) * 0.25;
      y = -1.7 + h * 2.85;
      isAmber = false;
    } else {
      // Circular rooftop pergola ring
      const angle = (i * 2.399) % (Math.PI * 2);
      const r = 1.72 + (i % 3) * 0.12;
      x = Math.cos(angle) * r;
      z = Math.sin(angle) * r * 0.72;
      y = 1.48;
      isAmber = true;
    }
    setPt(pos, col, i, x, y, z, isAmber);
  }
  return { positions: pos, colors: col };
}

// 3. Buddha Statue, Hussain Sagar (Monolith + raised right hand + lotus pedestal)
function makeBuddhaStatue(): { positions: Float32Array; colors: Float32Array } {
  const pos = new Float32Array(PARTICLE_COUNT * 3);
  const col = new Float32Array(PARTICLE_COUNT * 3);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const t = i / PARTICLE_COUNT;
    const angle = (i * 2.39996) % (Math.PI * 2);
    let x = 0;
    let y = 0;
    let z = 0;
    let isAmber = false;

    if (t < 0.28) {
      // Stepped square plinth & lotus base
      const tier = i % 3;
      if (tier < 2) {
        const side = i % 4;
        const u = (((i * 11) % 200) / 100 - 1) * 1.35;
        const h = ((i * 7) % 100) / 100;
        if (side === 0) { x = u; z = 1.1; }
        else if (side === 1) { x = u; z = -1.1; }
        else if (side === 2) { x = 1.1; z = u * 0.8; }
        else { x = -1.1; z = u * 0.8; }
        y = -1.85 + h * 0.55;
      } else {
        const r = 0.95 * (1 + 0.08 * Math.cos(angle * 12));
        x = Math.cos(angle) * r;
        z = Math.sin(angle) * r * 0.75;
        y = -1.25 + ((i * 5) % 100) / 100 * 0.3;
        isAmber = true;
      }
    } else if (t < 0.78) {
      // Standing draped body
      const h = ((i * 13) % 100) / 100;
      const bodyY = -0.95 + h * 2.35;
      const width = 0.42 + 0.14 * Math.sin(h * Math.PI * 0.85);
      x = Math.cos(angle) * width;
      z = Math.sin(angle) * width * 0.55;
      y = bodyY;
      isAmber = h > 0.88;
    } else if (t < 0.9) {
      // Raised right arm (Abhaya Mudra) & left arm
      const rightArm = i % 2 === 0;
      const s = ((i * 19) % 100) / 100;
      if (rightArm) {
        x = -0.58 - Math.sin(s * 1.2) * 0.12 + Math.cos(angle) * 0.09;
        y = 0.55 + s * 1.15;
        z = Math.sin(angle) * 0.09;
        isAmber = s > 0.75;
      } else {
        x = 0.48 + Math.cos(angle) * 0.09;
        y = 0.25 + s * 0.95;
        z = 0.12 + Math.sin(angle) * 0.09;
      }
    } else {
      // Head & Ushnisha crown
      const phi = Math.acos(1 - 2 * (((i * 29) % 100) / 100));
      const r = 0.34;
      x = r * Math.sin(phi) * Math.cos(angle);
      y = 1.72 + r * Math.cos(phi) * 1.2;
      z = r * Math.sin(phi) * Math.sin(angle);
      isAmber = y > 1.92;
    }
    setPt(pos, col, i, x, y, z, isAmber);
  }
  return { positions: pos, colors: col };
}

// 4. Birla Mandir (Shikhara spire, tiered mandapam, gopuram, dhvajastambham)
function makeBirlaMandir(): { positions: Float32Array; colors: Float32Array } {
  const pos = new Float32Array(PARTICLE_COUNT * 3);
  const col = new Float32Array(PARTICLE_COUNT * 3);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const t = i / PARTICLE_COUNT;
    const angle = (i * 2.39996) % (Math.PI * 2);
    let x = 0;
    let y = 0;
    let z = 0;
    let isAmber = false;

    if (t < 0.38) {
      // Main curved Shikhara tower on right
      const h = ((i * 11) % 100) / 100;
      const r = 0.85 * Math.pow(1 - h * 0.82, 0.75);
      x = 0.75 + Math.cos(angle) * r;
      z = Math.sin(angle) * r;
      y = -0.35 + h * 2.55;
      isAmber = h > 0.85;
    } else if (t < 0.65) {
      // Stepped terraced base & mandapam
      const u = (((i * 13) % 200) / 100 - 1) * 1.95;
      const v = -1.75 + (((i * 17) % 100) / 100) * 1.4;
      const zOff = (((i * 7) % 200) / 100 - 1) * 0.85;
      x = u;
      y = v;
      z = zOff;
      isAmber = v > -0.5;
    } else if (t < 0.88) {
      // Left Gopuram entrance tower
      const h = ((i * 19) % 100) / 100;
      const w = 0.62 * (1 - h * 0.55);
      const side = i % 4;
      const u = (((i * 23) % 200) / 100 - 1) * w;
      x = -1.35 + (side < 2 ? u : side === 2 ? w : -w);
      z = side >= 2 ? u * 0.7 : side === 0 ? w * 0.7 : -w * 0.7;
      y = -1.35 + h * 2.05;
      isAmber = h > 0.85;
    } else {
      // Tall golden Dhvajastambham flagstaff
      const h = ((i * 29) % 100) / 100;
      x = -0.42 + Math.cos(angle) * 0.05;
      z = 0.4 + Math.sin(angle) * 0.05;
      y = -0.55 + h * 2.4;
      isAmber = true;
    }
    setPt(pos, col, i, x, y, z, isAmber);
  }
  return { positions: pos, colors: col };
}

// 5. Telangana State Secretariat (Symmetrical wings + grand central dome + corner cupolas)
function makeSecretariat(): { positions: Float32Array; colors: Float32Array } {
  const pos = new Float32Array(PARTICLE_COUNT * 3);
  const col = new Float32Array(PARTICLE_COUNT * 3);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const t = i / PARTICLE_COUNT;
    const angle = (i * 2.39996) % (Math.PI * 2);
    let x = 0;
    let y = 0;
    let z = 0;
    let isAmber = false;

    if (t < 0.52) {
      // Wide symmetrical 6-story palace wings
      const u = (((i * 11) % 200) / 100 - 1) * 2.45;
      const h = ((i * 13) % 100) / 100;
      const zSide = i % 2 === 0 ? 0.55 : -0.55;
      x = u;
      z = zSide + (Math.abs(u) < 0.75 ? 0.25 : 0);
      y = -1.65 + h * (Math.abs(u) < 0.7 ? 2.2 : 1.55);
      isAmber = Math.abs((h * 6) % 1 - 0.5) < 0.08;
    } else if (t < 0.78) {
      // Grand central dome & drum
      const h = ((i * 17) % 100) / 100;
      const phi = h * (Math.PI / 2);
      const r = 0.68 * Math.cos(phi);
      x = Math.cos(angle) * r;
      z = Math.sin(angle) * r;
      y = 0.65 + Math.sin(phi) * 1.25;
      isAmber = true;
    } else {
      // Corner rooftop cupolas (4 domes)
      const cxList = [-2.25, -1.55, 1.55, 2.25];
      const cx = cxList[i % 4];
      const h = ((i * 19) % 100) / 100;
      const r = 0.28 * Math.cos(h * (Math.PI / 2));
      x = cx + Math.cos(angle) * r;
      z = Math.sin(angle) * r;
      y = -0.08 + Math.sin(h * (Math.PI / 2)) * 0.55;
      isAmber = true;
    }
    setPt(pos, col, i, x, y, z, isAmber);
  }
  return { positions: pos, colors: col };
}

// 6. 125-ft Dr. B. R. Ambedkar Statue (Circular colonnaded rotunda + tall bronze figure)
function makeAmbedkarStatue(): { positions: Float32Array; colors: Float32Array } {
  const pos = new Float32Array(PARTICLE_COUNT * 3);
  const col = new Float32Array(PARTICLE_COUNT * 3);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const t = i / PARTICLE_COUNT;
    const angle = (i * 2.39996) % (Math.PI * 2);
    let x = 0;
    let y = 0;
    let z = 0;
    let isAmber = false;

    if (t < 0.42) {
      // Circular colonnaded rotunda base
      const ring = i % 3;
      if (ring === 0) {
        // Outer columns ring
        const colIdx = i % 24;
        const cAng = (colIdx / 24) * Math.PI * 2;
        const h = ((i * 7) % 100) / 100;
        x = Math.cos(cAng) * 1.85;
        z = Math.sin(cAng) * 1.85;
        y = -1.8 + h * 0.75;
      } else if (ring === 1) {
        // Rotunda upper cornice ring
        x = Math.cos(angle) * (1.7 + (i % 4) * 0.06);
        z = Math.sin(angle) * (1.7 + (i % 4) * 0.06);
        y = -1.02;
        isAmber = true;
      } else {
        // Tapered central pedestal cone
        const h = ((i * 11) % 100) / 100;
        const r = 1.05 * (1 - h * 0.42);
        x = Math.cos(angle) * r;
        z = Math.sin(angle) * r;
        y = -1.05 + h * 0.72;
        isAmber = h > 0.85;
      }
    } else if (t < 0.82) {
      // Standing suit torso & legs
      const h = ((i * 13) % 100) / 100;
      const bodyY = -0.32 + h * 2.15;
      const width = h < 0.45 ? 0.34 : 0.44;
      x = Math.cos(angle) * width;
      z = Math.sin(angle) * width * 0.55;
      y = bodyY;
      isAmber = h > 0.85;
    } else if (t < 0.92) {
      // Raised pointing right arm + book in left arm
      const isRight = i % 2 === 0;
      const s = ((i * 17) % 100) / 100;
      if (isRight) {
        x = -0.45 - s * 0.62;
        y = 1.25 + s * 0.92;
        z = Math.sin(angle) * 0.08;
        isAmber = true;
      } else {
        x = 0.42 + Math.cos(angle) * 0.14;
        y = 1.05 + (s - 0.5) * 0.42;
        z = 0.15 + Math.sin(angle) * 0.08;
      }
    } else {
      // Head
      const phi = Math.acos(1 - 2 * (((i * 23) % 100) / 100));
      const r = 0.28;
      x = r * Math.sin(phi) * Math.cos(angle);
      y = 2.12 + r * Math.cos(phi) * 1.15;
      z = r * Math.sin(phi) * Math.sin(angle);
      isAmber = true;
    }
    setPt(pos, col, i, x, y, z, isAmber);
  }
  return { positions: pos, colors: col };
}

export function HeroParticleLandmarks() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const activeIdxRef = useRef(0);

  const shapesMeta = [
    {
      id: 'charminar',
      label: 'Charminar',
      yearTag: '1591 • Old City Core',
      coords: '17.3616° N, 78.4747° E',
    },
    {
      id: 'cyber-towers',
      label: 'Cyber Towers • HITEC City',
      yearTag: '1998 • Western Growth Axis',
      coords: '17.4504° N, 78.3816° E',
    },
    {
      id: 'buddha',
      label: 'Buddha Statue • Hussain Sagar',
      yearTag: '1992 • Hydrological Heart',
      coords: '17.4156° N, 78.4750° E',
    },
    {
      id: 'birla-mandir',
      label: 'Birla Mandir • Naubat Pahad',
      yearTag: '1976 • Granite Ridge',
      coords: '17.4062° N, 78.4691° E',
    },
    {
      id: 'secretariat',
      label: 'Telangana State Secretariat',
      yearTag: '2023 • Civic Core',
      coords: '17.4081° N, 78.4697° E',
    },
    {
      id: 'ambedkar',
      label: '125-ft Ambedkar Statue',
      yearTag: '2023 • Hussain Sagar Shore',
      coords: '17.4112° N, 78.4675° E',
    },
  ];

  useEffect(() => {
    activeIdxRef.current = activeIdx;
  }, [activeIdx]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % 6);
    }, 4200);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      return;
    }

    const width = container.clientWidth || 480;
    const height = container.clientHeight || 440;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(44, width / height, 0.1, 50);
    camera.position.set(0, 0.85, 7.1);
    camera.lookAt(0, 0, 0);

    const shapes: LandmarkShape[] = [
      { ...shapesMeta[0], ...makeCharminar() },
      { ...shapesMeta[1], ...makeCyberTowers() },
      { ...shapesMeta[2], ...makeBuddhaStatue() },
      { ...shapesMeta[3], ...makeBirlaMandir() },
      { ...shapesMeta[4], ...makeSecretariat() },
      { ...shapesMeta[5], ...makeAmbedkarStatue() },
    ];

    const currentPos = new Float32Array(shapes[0].positions);
    const currentCol = new Float32Array(shapes[0].colors);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(currentPos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(currentCol, 3));

    const glowTex = createGlowTexture();
    const mat = new THREE.PointsMaterial({
      size: 0.105,
      map: glowTex,
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const points = new THREE.Points(geo, mat);
    scene.add(points);

    const ringGeo = new THREE.RingGeometry(2.25, 2.28, 72);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: '#cd9b76',
      transparent: true,
      opacity: 0.26,
      side: THREE.DoubleSide,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.y = -1.9;
    scene.add(ringMesh);

    const onResize = () => {
      if (!container || !renderer) return;
      const w = container.clientWidth || 480;
      const h = container.clientHeight || 440;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    let rafId = 0;
    const animate = () => {
      rafId = window.requestAnimationFrame(animate);
      const target = shapes[activeIdxRef.current];
      const posArr = geo.attributes.position.array as Float32Array;
      const colArr = geo.attributes.color.array as Float32Array;

      for (let i = 0; i < posArr.length; i++) {
        posArr[i] += (target.positions[i] - posArr[i]) * 0.068;
        colArr[i] += (target.colors[i] - colArr[i]) * 0.068;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;

      points.rotation.y += 0.0055;
      ringMesh.rotation.z -= 0.002;
      renderer?.render(scene, camera);
    };
    animate();

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      geo.dispose();
      mat.dispose();
      glowTex.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      if (renderer) {
        renderer.dispose();
        renderer.domElement.remove();
      }
    };
  }, []);

  const currentMeta = shapesMeta[activeIdx];

  return (
    <div className="relative flex flex-col items-center">
      <div
        ref={mountRef}
        className="h-[340px] w-full max-w-[480px] sm:h-[430px]"
        aria-label={`3D Particle Model: ${currentMeta.label}`}
      />

      {/* Landmark Morph Selector Pill */}
      <div className="gis-glass mt-2 flex w-full max-w-[440px] items-center justify-between gap-3 rounded-xl px-4 py-2.5">
        <div className="min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-wider text-amber-300">
            0{activeIdx + 1} / {currentMeta.yearTag}
          </div>
          <div className="truncate font-serif text-lg text-slate-100">
            {currentMeta.label}
          </div>
          <div className="font-mono text-[10px] text-cyan-300">
            {currentMeta.coords}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {shapesMeta.map((m, idx) => (
            <button
              key={m.id}
              type="button"
              aria-label={`Show ${m.label}`}
              onClick={() => setActiveIdx(idx)}
              className={`h-2 rounded-full transition-all ${idx === activeIdx
                ? 'w-5 bg-cyan-400'
                : 'w-2 bg-slate-600 hover:bg-slate-400'
                }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

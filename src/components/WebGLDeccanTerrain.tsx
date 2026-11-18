import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Real-time Three.js / WebGL Deccan Plateau topographic wireframe & elevation
 * particle field rendered behind the documentary hero.
 */
export function WebGLDeccanTerrain() {
  const mountRef = useRef<HTMLDivElement>(null);

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

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0c0503, 0.042);

    const camera = new THREE.PerspectiveCamera(52, width / height, 0.1, 150);
    camera.position.set(0, 7.5, 19);
    camera.lookAt(0, 0, -4);

    // Topographic Terrain Mesh (Deccan granite batholith undulations)
    const segX = 96;
    const segZ = 64;
    const planeGeo = new THREE.PlaneGeometry(46, 32, segX, segZ);
    planeGeo.rotateX(-Math.PI / 2);

    const posAttr = planeGeo.attributes.position as THREE.BufferAttribute;
    const baseHeights = new Float32Array(posAttr.count);
    const colors = new Float32Array(posAttr.count * 3);

    const lowColor = new THREE.Color('#641600');
    const midColor = new THREE.Color('#98472b');
    const peakColor = new THREE.Color('#ebcaa1');
    const tmpColor = new THREE.Color();

    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const z = posAttr.getZ(i);
      const ridge1 = Math.sin(x * 0.24) * Math.cos(z * 0.22) * 1.45;
      const ridge2 = Math.sin(x * 0.55 + z * 0.35) * 0.55;
      const basin = -Math.exp(-(x * x + z * z) * 0.018) * 1.1;
      const y = ridge1 + ridge2 + basin;
      baseHeights[i] = y;
      posAttr.setY(i, y);

      const norm = THREE.MathUtils.clamp((y + 1.8) / 3.6, 0, 1);
      if (norm < 0.72) {
        tmpColor.copy(lowColor).lerp(midColor, norm / 0.72);
      } else {
        tmpColor.copy(midColor).lerp(peakColor, (norm - 0.72) / 0.28);
      }
      colors[i * 3] = tmpColor.r;
      colors[i * 3 + 1] = tmpColor.g;
      colors[i * 3 + 2] = tmpColor.b;
    }

    planeGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const wireframeMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      wireframe: true,
      transparent: true,
      opacity: 0.58,
    });
    const terrainMesh = new THREE.Mesh(planeGeo, wireframeMat);
    terrainMesh.position.set(0, -1.2, -2);
    scene.add(terrainMesh);

    // Elevation Survey Particles
    const particleGeo = new THREE.BufferGeometry();
    const particleCount = 520;
    const pPositions = new Float32Array(particleCount * 3);
    const pColors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const idx = Math.floor((i / particleCount) * posAttr.count);
      pPositions[i * 3] = posAttr.getX(idx);
      pPositions[i * 3 + 1] = baseHeights[idx] - 1.1;
      pPositions[i * 3 + 2] = posAttr.getZ(idx) - 2;

      const isAmber = i % 6 === 0;
      const c = isAmber ? peakColor : midColor;
      pColors[i * 3] = c.r;
      pColors[i * 3 + 1] = c.g;
      pColors[i * 3 + 2] = c.b;
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
    particleGeo.setAttribute('color', new THREE.BufferAttribute(pColors, 3));

    const particleMat = new THREE.PointsMaterial({
      size: 0.22,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    let targetMouseX = 0;
    let targetMouseY = 0;
    const onPointerMove = (e: PointerEvent) => {
      targetMouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      targetMouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('pointermove', onPointerMove);

    const onResize = () => {
      if (!container || !renderer) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    const clock = new THREE.Clock();
    let rafId = 0;

    const animate = () => {
      rafId = window.requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      // Subtle living topographic wave
      for (let i = 0; i < posAttr.count; i++) {
        const x = posAttr.getX(i);
        const z = posAttr.getZ(i);
        const wave = Math.sin(x * 0.18 + t * 0.45) * Math.cos(z * 0.18 + t * 0.35) * 0.18;
        posAttr.setY(i, baseHeights[i] + wave);
      }
      posAttr.needsUpdate = true;

      camera.position.x += (targetMouseX * 1.4 - camera.position.x) * 0.03;
      camera.position.y += (7.5 - targetMouseY * 0.7 - camera.position.y) * 0.03;
      camera.lookAt(0, -0.4, -4);

      renderer?.render(scene, camera);
    };
    animate();

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('resize', onResize);
      planeGeo.dispose();
      wireframeMat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      if (renderer) {
        renderer.dispose();
        renderer.domElement.remove();
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-[2] opacity-100"
    />
  );
}

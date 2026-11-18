import { useEffect, useRef } from 'react';

/**
 * Smooth, GPU-accelerated pointer-tracking ambient gradient aura.
 * Renders behind interactive controls with zero layout shift.
 */
export function InteractiveCursorGlow() {
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = layerRef.current;
    if (!el) return;

    let targetX = window.innerWidth * 0.5;
    let targetY = window.innerHeight * 0.35;
    let curX = targetX;
    let curY = targetY;
    let rafId = 0;

    const onPointerMove = (e: PointerEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });

    const tick = () => {
      curX += (targetX - curX) * 0.09;
      curY += (targetY - curY) * 0.09;
      el.style.background = `
        radial-gradient(620px circle at ${curX}px ${curY}px, rgba(205, 155, 118, 0.15), transparent 65%),
        radial-gradient(400px circle at ${curX + 90}px ${curY - 60}px, rgba(152, 71, 43, 0.14), transparent 60%)
      `;
      rafId = window.requestAnimationFrame(tick);
    };
    tick();

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', onPointerMove);
    };
  }, []);

  return (
    <div
      ref={layerRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[1] transition-opacity duration-500"
    />
  );
}

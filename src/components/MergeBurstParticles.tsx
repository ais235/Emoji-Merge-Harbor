/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Particle = {
  id: number;
  left: number;
  top: number;
  angle: number;
  color: string;
  size: number;
  tx: number;
  ty: number;
};

const COLORS = ["#FFD700", "#FF6B6B", "#4CAF50", "#64B5F6", "#FF9800", "#E040FB"];

export default function MergeBurstParticles({ cellIndex }: { cellIndex: number | null }) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (cellIndex == null) {
      setParticles([]);
      return;
    }
    const el = document.querySelector(`[data-grid-cell-index="${cellIndex}"]`) as HTMLElement | null;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const count = 12;
    const next: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * 360;
      const rad = (angle * Math.PI) / 180;
      const dist = 40 + Math.random() * 28;
      next.push({
        id: Date.now() + i,
        left: cx,
        top: cy,
        angle,
        color: COLORS[i % COLORS.length],
        size: 4 + Math.random() * 5,
        tx: Math.cos(rad) * dist,
        ty: Math.sin(rad) * dist,
      });
    }
    setParticles(next);
    const t = window.setTimeout(() => setParticles([]), 520);
    return () => window.clearTimeout(t);
  }, [cellIndex]);

  if (typeof document === "undefined" || particles.length === 0) return null;

  return createPortal(
    <>
      {particles.map((p) => (
        <ParticleDot key={p.id} {...p} />
      ))}
    </>,
    document.body
  );
}

function ParticleDot({ left, top, tx, ty, color, size }: Particle) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const id = requestAnimationFrame(() => {
      el.style.transition = "transform 0.48s ease-out, opacity 0.48s ease-out";
      el.style.transform = `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(0)`;
      el.style.opacity = "0";
    });
    return () => cancelAnimationFrame(id);
  }, [tx, ty]);

  return (
    <div
      ref={ref}
      className="pointer-events-none fixed z-[9998]"
      style={{
        left,
        top,
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        boxShadow: `0 0 4px ${color}`,
        transform: "translate(-50%, -50%)",
        opacity: 1,
        transition: "none",
      }}
      aria-hidden
    />
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import type { FurnitureLayer, RoomVisual } from "../story/roomData";

const CANVAS_HEIGHT_PX = 220;

/** Пути из `public/` (`/rooms/...`) с учётом `base` в vite.config */
function publicAssetUrl(path: string): string {
  const trimmed = path.trim();
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("data:")) return trimmed;
  const rel = trimmed.replace(/^\/+/, "");
  return `${import.meta.env.BASE_URL}${rel}`.replace(/\/{2,}/g, "/");
}

export type RoomCanvasEditorApi = {
  selectedUpgradeId: string | null;
  onSelectUpgradeId: (id: string | null) => void;
  onLayerPatch: (upgradeId: string, patch: Partial<FurnitureLayer>) => void;
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

type DragState = {
  upgradeId: string;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
};

export type RoomCanvasProps = {
  roomVisual: RoomVisual;
  layers: FurnitureLayer[];
  purchasedUpgrades: string[];
  sparkleNonce: number;
  /** Режим редактора: drag/selection, все слои видны как купленные */
  editor?: RoomCanvasEditorApi | undefined;
};

export default function RoomCanvas({
  roomVisual,
  layers,
  purchasedUpgrades,
  sparkleNonce,
  editor,
}: RoomCanvasProps) {
  const [justBoughtId, setJustBoughtId] = useState<string | null>(null);
  const [sparkles, setSparkles] = useState<{ id: string; tx: string; ty: string }[]>([]);
  const prevPurchasedRef = useRef<string[] | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => {
    const prev = prevPurchasedRef.current;
    const now = purchasedUpgrades;
    if (prev === null) {
      prevPurchasedRef.current = [...now];
      return;
    }
    const layerIds = new Set(layers.map((l) => l.upgradeId));
    const newly = now.filter((id) => !prev.includes(id) && layerIds.has(id));
    prevPurchasedRef.current = [...now];
    if (editor) return;
    if (!newly.length) return;
    const id = newly[newly.length - 1];
    setJustBoughtId(id);
    const t = window.setTimeout(() => setJustBoughtId(null), 600);
    return () => window.clearTimeout(t);
  }, [purchasedUpgrades, layers, editor]);

  useEffect(() => {
    if (sparkleNonce <= 0) return;
    const next = Array.from({ length: 5 }, (_, i) => ({
      id: `${sparkleNonce}-${i}`,
      tx: `${Math.round(Math.random() * 120 - 60)}px`,
      ty: `${Math.round(Math.random() * 120 - 60)}px`,
    }));
    setSparkles(next);
    const t = window.setTimeout(() => setSparkles([]), 600);
    return () => window.clearTimeout(t);
  }, [sparkleNonce]);

  const endDrag = () => {
    dragRef.current = null;
  };

  const handleLayerPointerDown = (e: React.PointerEvent, layer: FurnitureLayer) => {
    if (!editor) return;
    if (e.button !== 0 && e.pointerType !== "touch") return;
    e.preventDefault();
    e.stopPropagation();
    editor.onSelectUpgradeId(layer.upgradeId);
    dragRef.current = {
      upgradeId: layer.upgradeId,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: layer.x,
      startY: layer.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleLayerPointerMove = (e: React.PointerEvent, layer: FurnitureLayer) => {
    if (!editor || !dragRef.current || dragRef.current.upgradeId !== layer.upgradeId) return;
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const dxPct = ((e.clientX - dragRef.current.startClientX) / rect.width) * 100;
    const dyPct = ((e.clientY - dragRef.current.startClientY) / rect.height) * 100;
    editor.onLayerPatch(layer.upgradeId, {
      x: clamp(dragRef.current.startX + dxPct, 0, 100),
      y: clamp(dragRef.current.startY + dyPct, 0, 100),
    });
  };

  const handleLayerPointerUp = (e: React.PointerEvent, layer: FurnitureLayer) => {
    if (!editor || !dragRef.current || dragRef.current.upgradeId !== layer.upgradeId) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    endDrag();
  };

  const handleLayerPointerCancel = (e: React.PointerEvent, layer: FurnitureLayer) => {
    if (!editor || !dragRef.current || dragRef.current.upgradeId !== layer.upgradeId) return;
    endDrag();
  };

  return (
    <div
      ref={containerRef}
      className="room-canvas relative w-full overflow-hidden rounded-2xl"
      style={{
        height: CANVAS_HEIGHT_PX,
        backgroundColor: roomVisual.bgColor,
        touchAction: editor ? "none" : undefined,
      }}
    >
      {roomVisual.bgImage ? (
        <img
          src={publicAssetUrl(roomVisual.bgImage)}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
      ) : null}

      {!roomVisual.bgImage ? (
        <span
          className="pointer-events-none absolute left-1/2 top-1/2 z-[1] -translate-x-1/2 -translate-y-1/2 select-none leading-none"
          style={{
            fontSize: 80,
            opacity: 0.04,
          }}
          aria-hidden
        >
          {roomVisual.bgEmoji}
        </span>
      ) : null}

      {sparkles.length > 0 ? (
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2"
          aria-hidden
        >
          {sparkles.map((s) => (
            <span
              key={s.id}
              className="sparkle-particle absolute left-0 top-0 select-none leading-none"
              style={
                {
                  fontSize: 16,
                  "--tx": s.tx,
                  "--ty": s.ty,
                } as React.CSSProperties
              }
            >
              ✨
            </span>
          ))}
        </div>
      ) : null}

      {layers.map((layer) => {
        const owned = editor || purchasedUpgrades.includes(layer.upgradeId);
        const justBought = !editor && justBoughtId === layer.upgradeId;
        const isSelected = Boolean(editor && editor.selectedUpgradeId === layer.upgradeId);

        const wrapClass = owned
          ? `room-layer-owned absolute flex flex-col items-center ${justBought ? "just-bought" : ""} ${editor && isSelected ? "rounded-lg ring-2 ring-blue-500 ring-offset-1" : ""}`
          : "room-layer-ghost absolute flex cursor-pointer flex-col items-center";

        const wrapStyle: React.CSSProperties = {
          left: `${layer.x}%`,
          top: `${layer.y}%`,
          transform: "translate(-50%, -50%)",
          fontSize: layer.imageSrc ? undefined : layer.size,
          ...(owned ? { opacity: 1 } : { opacity: 0.2, filter: "grayscale(100%)" }),
          ...(editor ? { zIndex: isSelected ? 45 : 6, cursor: "grab" } : {}),
        };

        return (
          <div
            key={layer.upgradeId}
            className={wrapClass}
            style={wrapStyle}
            aria-label={!editor ? layer.label : undefined}
            title={
              editor
                ? "Тащите или выберите и двигайте стрелками"
                : owned
                  ? undefined
                  : "Купить в магазине ниже"
            }
            onPointerDown={(e) => handleLayerPointerDown(e, layer)}
            onPointerMove={(e) => handleLayerPointerMove(e, layer)}
            onPointerUp={(e) => handleLayerPointerUp(e, layer)}
            onPointerCancel={(e) => handleLayerPointerCancel(e, layer)}
          >
            {layer.imageSrc ? (
              <img
                src={publicAssetUrl(layer.imageSrc)}
                alt=""
                draggable={false}
                className="max-w-none select-none"
                style={{ width: layer.size, height: "auto", display: "block" }}
              />
            ) : (
              <span className="select-none leading-none" aria-hidden>
                {layer.emoji}
              </span>
            )}
            {editor ? (
              <span
                className={`mt-0.5 max-w-[72px] text-center text-[10px] leading-tight ${
                  roomVisual.zoneId === "lounge" ? "text-amber-200/85" : "text-[#888]"
                }`}
                style={{ fontSize: 10 }}
              >
                {layer.label}
              </span>
            ) : null}
          </div>
        );
      })}

      <style>{`
        .room-layer-ghost { transition: opacity 0.2s ease; }
        .room-layer-ghost:hover { opacity: 0.4 !important; }
        .room-layer-owned { transition: opacity 0.4s ease, transform 0.4s ease; }
        .room-layer-owned.just-bought {
          animation: room-layer-pop 0.6s ease forwards;
        }
        @keyframes room-layer-pop {
          0% { transform: translate(-50%, -50%) scale(1.3); }
          100% { transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes sparkle {
          0% { transform: translate(0, 0) scale(1); opacity: 1; }
          100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; }
        }
        .sparkle-particle {
          animation: sparkle 0.6s ease-out forwards;
        }
      `}</style>
    </div>
  );
}

export { CANVAS_HEIGHT_PX };

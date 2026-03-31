/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { UPGRADES } from "../progressionData";
import type { ActiveZone, ProgressionState } from "../types";
import { progressZoneId } from "../types";
import { getRoomVisual, type RoomVisual } from "../story/roomData";

const ZONE_TITLES: Record<ActiveZone, string> = {
  hall: "Основной зал",
  kitchen: "Кухня",
  terrace: "Терраса",
  secret: "Тайная комната",
};

function RoomCanvas({
  roomVisual,
  purchasedUpgrades,
  sparkleNonce,
}: {
  roomVisual: RoomVisual;
  purchasedUpgrades: string[];
  sparkleNonce: number;
}) {
  const { layers } = roomVisual;
  const [justBoughtId, setJustBoughtId] = useState<string | null>(null);
  const [sparkles, setSparkles] = useState<{ id: string; tx: string; ty: string }[]>([]);
  const prevPurchasedRef = useRef<string[] | null>(null);

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
    if (!newly.length) return;
    const id = newly[newly.length - 1];
    setJustBoughtId(id);
    const t = window.setTimeout(() => setJustBoughtId(null), 600);
    return () => window.clearTimeout(t);
  }, [purchasedUpgrades, layers]);

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

  return (
    <div
      className="room-canvas relative w-full overflow-hidden rounded-2xl"
      style={{
        height: 220,
        backgroundColor: roomVisual.bgColor,
      }}
    >
      <span
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none leading-none"
        style={{
          fontSize: 80,
          opacity: 0.04,
        }}
        aria-hidden
      >
        {roomVisual.bgEmoji}
      </span>

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
        const owned = purchasedUpgrades.includes(layer.upgradeId);
        const justBought = justBoughtId === layer.upgradeId;
        const wrapClass = owned
          ? `room-layer-owned absolute flex flex-col items-center ${justBought ? "just-bought" : ""}`
          : "room-layer-ghost absolute flex cursor-pointer flex-col items-center";
        const wrapStyle: React.CSSProperties = {
          left: `${layer.x}%`,
          top: `${layer.y}%`,
          transform: "translate(-50%, -50%)",
          fontSize: layer.size,
          ...(owned ? { opacity: 1 } : { opacity: 0.2, filter: "grayscale(100%)" }),
        };
        return (
          <div
            key={layer.upgradeId}
            className={wrapClass}
            style={wrapStyle}
            title={owned ? undefined : "Купить в магазине ниже"}
          >
            <span className="select-none leading-none" aria-hidden>
              {layer.emoji}
            </span>
            <span
              className="mt-0.5 max-w-[72px] text-center text-[10px] leading-tight text-[#888]"
              style={{ fontSize: 10 }}
            >
              {layer.label}
            </span>
          </div>
        );
      })}

      <style>{`
        .room-layer-ghost { transition: opacity 0.2s ease; }
        .room-layer-ghost:hover { opacity: 0.4 !important; }
        .room-layer-owned { transition: opacity 0.4s ease, transform 0.4s ease; }
        @keyframes room-layer-pop {
          0% { transform: translate(-50%, -50%) scale(1.3); }
          100% { transform: translate(-50%, -50%) scale(1); }
        }
        .room-layer-owned.just-bought {
          animation: room-layer-pop 0.6s ease forwards;
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

export interface RoomScreenProps {
  activeZone: ActiveZone;
  progState: ProgressionState;
  onBack: () => void;
  onPurchaseUpgrade: (upgradeId: string) => void;
  purchaseSparkleNonce: number;
}

export default function RoomScreen({
  activeZone,
  progState,
  onBack,
  onPurchaseUpgrade,
  purchaseSparkleNonce,
}: RoomScreenProps) {
  const pid = progressZoneId(activeZone);
  const inZone = UPGRADES.filter((u) => u.zone === pid);
  const availableHere = inZone.filter((u) => !progState.purchasedUpgrades.includes(u.id));

  const roomVisual = getRoomVisual(activeZone);
  const layers = roomVisual?.layers ?? [];
  const placedCount = layers.filter((l) =>
    progState.purchasedUpgrades.includes(l.upgradeId)
  ).length;
  const totalLayers = layers.length;

  return (
    <div className="mx-auto flex h-[100dvh] w-full max-w-[360px] flex-col overflow-hidden bg-[#F8F9FA] p-2 font-sans select-none">
      <div className="mb-2 flex flex-shrink-0 items-center">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-blue-600 shadow-sm"
        >
          ← Назад
        </button>
      </div>

      <h1 className="mb-3 text-xl font-black text-gray-900">
        {ZONE_TITLES[activeZone]}
      </h1>

      {totalLayers > 0 ? (
        <>
          <p className="mb-1.5 text-center text-[12px] text-gray-500">
            Обустроено: {placedCount} из {totalLayers} предметов
          </p>
          <div className="mb-3 w-full flex-shrink-0">
            <RoomCanvas
              roomVisual={roomVisual!}
              purchasedUpgrades={progState.purchasedUpgrades}
              sparkleNonce={purchaseSparkleNonce}
            />
          </div>
        </>
      ) : (
        <div className="mb-3 flex h-[220px] w-full flex-shrink-0 items-center justify-center rounded-2xl border border-gray-200 bg-gray-100 text-sm text-gray-500">
          Нет сцены для этой зоны
        </div>
      )}

      <div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-2">
        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
            Доступно
          </h2>
          {availableHere.length === 0 ? (
            <p className="text-xs text-gray-400">Все улучшения этой зоны уже куплены.</p>
          ) : (
            <ul className="space-y-2">
              {availableHere.map((u) => {
                const isUnlocked = progState.level >= u.requiredLevel;
                const canAfford = progState.coins >= u.cost;
                const zoneUnlocked = progState.unlockedZones.includes(u.zone);
                const canBuy = isUnlocked && canAfford && zoneUnlocked;

                return (
                  <li
                    key={u.id}
                    className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm"
                  >
                    <div className="mb-1 font-bold text-gray-900">{u.name}</div>
                    <p className="mb-2 text-[11px] text-gray-500">{u.description}</p>
                    <div className="mb-2 text-xs font-bold text-gray-700">
                      🍪 {u.cost}
                    </div>
                    <button
                      type="button"
                      disabled={!canBuy}
                      onClick={() => onPurchaseUpgrade(u.id)}
                      className={`w-full rounded-lg py-2 text-xs font-bold uppercase ${
                        canBuy
                          ? "bg-blue-500 text-white shadow-sm active:bg-blue-600"
                          : "cursor-not-allowed bg-gray-100 text-gray-400"
                      }`}
                    >
                      {!zoneUnlocked
                        ? `Нужна зона: ${u.zone}`
                        : !isUnlocked
                          ? `Нужен ур. ${u.requiredLevel}`
                          : "Купить"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}

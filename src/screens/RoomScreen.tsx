/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useLayoutEffect, useState } from "react";
import RoomCanvas from "../components/RoomCanvas";
import RoomLayoutEditorPanel from "../components/RoomLayoutEditorPanel";
import { HUB_ZONES, UPGRADES } from "../progressionData";
import type { FurnitureLayer } from "../story/roomData";
import { getRoomVisual } from "../story/roomData";
import type { ActiveZone, ProgressionState } from "../types";
import { progressZoneId } from "../types";

function zoneTitle(z: ActiveZone): string {
  return HUB_ZONES.find((h) => h.id === z)?.displayName ?? "Комната";
}

function isRoomLayoutEditorEnabled(): boolean {
  if (import.meta.env.DEV) return true;
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("roomEditor") === "1";
}

export interface RoomScreenProps {
  activeZone: ActiveZone;
  progState: ProgressionState;
  onBack: () => void;
  onPurchaseUpgrade: (upgradeId: string) => void;
  purchaseSparkleNonce: number;
  /** Реплика после покупки в этой комнате (сбрасывается из App). */
  purchaseToast?: string | null;
}

export default function RoomScreen({
  activeZone,
  progState,
  onBack,
  onPurchaseUpgrade,
  purchaseSparkleNonce,
  purchaseToast,
}: RoomScreenProps) {
  const pid = progressZoneId(activeZone);
  const inZone = UPGRADES.filter((u) => u.zone === pid);
  const availableHere = inZone.filter((u) => !progState.purchasedUpgrades.includes(u.id));
  const purchasedHere = inZone
    .filter((u) => progState.purchasedUpgrades.includes(u.id))
    .sort((a, b) => a.requiredLevel - b.requiredLevel || a.name.localeCompare(b.name));

  const roomVisual = getRoomVisual(activeZone);
  const layers = roomVisual?.layers ?? [];
  const placedCount = layers.filter((l) =>
    progState.purchasedUpgrades.includes(l.upgradeId)
  ).length;
  const totalLayers = layers.length;

  const roomEditorAllowed = isRoomLayoutEditorEnabled();
  const [roomEditorOpen, setRoomEditorOpen] = useState(false);
  const [draftLayers, setDraftLayers] = useState<FurnitureLayer[] | null>(null);
  const [draftBgImage, setDraftBgImage] = useState("");
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);

  const syncDraftFromZone = useCallback(() => {
    const v = getRoomVisual(activeZone);
    if (!v) return;
    setDraftLayers(v.layers.map((l) => ({ ...l })));
    setDraftBgImage(v.bgImage ?? "");
    setSelectedLayerId(v.layers[0]?.upgradeId ?? null);
  }, [activeZone]);

  useLayoutEffect(() => {
    if (!roomEditorOpen) return;
    syncDraftFromZone();
  }, [activeZone, roomEditorOpen, syncDraftFromZone]);

  const toggleRoomEditor = () => {
    setRoomEditorOpen((prev) => {
      if (prev) setDraftLayers(null);
      return !prev;
    });
  };

  const onLayersReplace = useCallback((next: FurnitureLayer[]) => {
    setDraftLayers(next);
  }, []);

  const effectiveVisual =
    roomEditorOpen && roomVisual
      ? {
          ...roomVisual,
          bgImage: draftBgImage.trim() ? draftBgImage.trim() : undefined,
        }
      : roomVisual;

  const displayLayers =
    roomEditorOpen && draftLayers ? draftLayers : (roomVisual?.layers ?? []);

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

      <h1 className="mb-2 text-xl font-black text-gray-900">{zoneTitle(activeZone)}</h1>

      {purchaseToast ? (
        <p
          className="mb-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] font-medium leading-snug text-amber-950 shadow-sm"
          role="status"
        >
          {purchaseToast}
        </p>
      ) : null}

      {totalLayers > 0 ? (
        <>
          <p className="mb-1.5 text-center text-[12px] text-gray-500">
            Обустроено: {placedCount} из {totalLayers} предметов
          </p>

          {roomEditorAllowed ? (
            <div className="mb-2 flex justify-center">
              <button
                type="button"
                onClick={toggleRoomEditor}
                className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-[11px] font-bold text-violet-900 shadow-sm"
              >
                {roomEditorOpen ? "Скрыть редактор раскладки" : "Редактор раскладки"}
              </button>
            </div>
          ) : null}

          {roomEditorOpen && roomVisual && draftLayers ? (
            <RoomLayoutEditorPanel
              roomVisual={roomVisual}
              draftLayers={draftLayers}
              onLayersReplace={onLayersReplace}
              draftBgImage={draftBgImage}
              onDraftBgImageChange={setDraftBgImage}
              selectedUpgradeId={selectedLayerId}
              onSelectUpgradeId={setSelectedLayerId}
            />
          ) : null}

          <div className="mb-3 w-full flex-shrink-0">
            {effectiveVisual ? (
              <RoomCanvas
                roomVisual={effectiveVisual}
                layers={displayLayers}
                purchasedUpgrades={progState.purchasedUpgrades}
                sparkleNonce={purchaseSparkleNonce}
                editor={
                  roomEditorOpen && draftLayers
                    ? {
                        selectedUpgradeId: selectedLayerId,
                        onSelectUpgradeId: setSelectedLayerId,
                        onLayerPatch: (upgradeId, patch) => {
                          setDraftLayers((prev) =>
                            prev
                              ? prev.map((l) =>
                                  l.upgradeId === upgradeId ? { ...l, ...patch } : l
                                )
                              : prev
                          );
                        },
                      }
                    : undefined
                }
              />
            ) : null}
          </div>
        </>
      ) : (
        <div className="mb-3 flex h-[220px] w-full flex-shrink-0 items-center justify-center rounded-2xl border border-gray-200 bg-gray-100 text-sm text-gray-500">
          Нет сцены для этой зоны
        </div>
      )}

      <div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-2">
        {purchasedHere.length > 0 ? (
          <section>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
              Уже в комнате
            </h2>
            <ul className="flex flex-wrap gap-1.5">
              {purchasedHere.map((u) => (
                <li
                  key={u.id}
                  className="rounded-lg border border-green-100 bg-green-50/90 px-2 py-1 text-[10px] font-semibold text-green-900"
                >
                  ✓ {u.name}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
            Купить
          </h2>
          {availableHere.length === 0 ? (
            <p className="text-xs text-gray-400">Все улучшения этой зоны уже куплены.</p>
          ) : (
            <ul className="space-y-2">
              {availableHere.map((u) => {
                const isUnlocked = progState.level >= u.requiredLevel;
                const canAfford = progState.coins >= u.cost;
                const zoneUnlocked =
                  u.zone === "meta" || progState.unlockedZones.includes(u.zone);
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

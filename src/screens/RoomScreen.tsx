/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useLayoutEffect, useState } from "react";
import { Home, Coins } from "lucide-react";
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
  onWatchAdCoins: () => void;
  adCoinsReward: number;
  adCoinsCooldownMs: number;
  purchaseSparkleNonce: number;
  purchaseToast?: string | null;
}

export default function RoomScreen({
  activeZone,
  progState,
  onBack,
  onPurchaseUpgrade,
  onWatchAdCoins,
  adCoinsReward,
  adCoinsCooldownMs,
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
  const placedCount = layers.filter((l) => progState.purchasedUpgrades.includes(l.upgradeId)).length;
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
  const adCooldownSec = Math.ceil(adCoinsCooldownMs / 1000);
  const adCooldownLabel =
    adCooldownSec > 0
      ? `${Math.floor(adCooldownSec / 60)}:${String(adCooldownSec % 60).padStart(2, "0")}`
      : null;

  return (
    <div className="ds-screen ds-screen-hub ds-screen-fill-viewport flex min-h-0 flex-col overflow-hidden p-2">
      <header className="ds-topbar -mx-2 -mt-2 mb-2 rounded-none px-2">
        <button type="button" onClick={onBack} className="ds-pill-home shrink-0 gap-1.5">
          <Home className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
          Дом
        </button>
        <h1 className="ds-topbar-title">{zoneTitle(activeZone)}</h1>
        <div className="ds-stat-pill shrink-0" title="Монеты">
          <Coins className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--c-golddark)" }} aria-hidden />
          <span className="truncate font-medium tabular-nums">{progState.coins}</span>
        </div>
      </header>

      {purchaseToast ? (
        <p
          className="ds-card mb-2 text-[11px] font-medium leading-snug"
          style={{ color: "var(--c-browndark)" }}
          role="status"
        >
          {purchaseToast}
        </p>
      ) : null}

      <section className="ds-card mb-2 p-3">
        <div className="mb-2 text-[12px] font-medium" style={{ color: "var(--c-brown)" }}>
          Реклама
        </div>
        <button
          type="button"
          onClick={onWatchAdCoins}
          disabled={adCoinsCooldownMs > 0}
          className={`w-full py-2.5 text-[12px] font-bold ${
            adCoinsCooldownMs > 0 ? "ds-btn-secondary ds-btn-disabled" : "ds-btn-primary"
          }`}
        >
          {adCooldownLabel ? `Доступно через ${adCooldownLabel}` : `Получить +${adCoinsReward} монет`}
        </button>
      </section>

      {totalLayers > 0 ? (
        <>
          <p className="mb-2 text-center text-[11px] font-medium" style={{ color: "var(--c-brown)" }}>
            Обустроено: {placedCount} из {totalLayers} предметов
          </p>

          {roomEditorAllowed ? (
            <div className="mb-2 flex justify-center">
              <button type="button" onClick={toggleRoomEditor} className="ds-btn-secondary min-h-0 py-2 text-[11px]">
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

          <div
            className="mb-3 w-full shrink-0 overflow-hidden rounded-[var(--ds-radius-card)] border p-1.5"
            style={{ background: "var(--c-peach)", borderColor: "var(--c-peach2)" }}
          >
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
        <div
          className="mb-3 flex h-[220px] w-full shrink-0 items-center justify-center rounded-[var(--ds-radius-card)] border text-[12px] font-medium"
          style={{ background: "var(--c-peach)", borderColor: "var(--c-peach2)", color: "var(--c-muted)" }}
        >
          Нет сцены для этой зоны
        </div>
      )}

      <div className="scroll-touch-y flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-2">
        {purchasedHere.length > 0 ? (
          <section>
            <h2 className="mb-2 text-[11px] font-medium" style={{ color: "var(--c-muted)" }}>
              Уже в комнате
            </h2>
            <ul className="flex flex-wrap gap-1.5">
              {purchasedHere.map((u) => (
                <li
                  key={u.id}
                  className="rounded-[var(--ds-radius-btn)] border px-2 py-1.5 text-[10px] font-medium"
                  style={{
                    background: "var(--c-peach)",
                    borderColor: "var(--c-peach2)",
                    color: "var(--c-browndark)",
                  }}
                >
                  <span style={{ color: "var(--c-green)" }}>✓</span> {u.name}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section>
          <h2 className="mb-2 text-[11px] font-medium" style={{ color: "var(--c-muted)" }}>
            Купить
          </h2>
          {availableHere.length === 0 ? (
            <p className="text-[12px] font-medium" style={{ color: "var(--c-muted)" }}>
              Все улучшения этой зоны уже куплены.
            </p>
          ) : (
            <ul className="space-y-2">
              {availableHere.map((u) => {
                const isUnlocked = progState.level >= u.requiredLevel;
                const canAfford = progState.coins >= u.cost;
                const zoneUnlocked = u.zone === "meta" || progState.unlockedZones.includes(u.zone);
                const canBuy = isUnlocked && canAfford && zoneUnlocked;

                return (
                  <li key={u.id} className="ds-card p-4">
                    <div className="mb-2 text-[15px] font-bold" style={{ color: "var(--c-browndark)" }}>
                      {u.name}
                    </div>
                    <p className="mb-3 text-[13px] font-medium leading-relaxed" style={{ color: "var(--c-brown)" }}>
                      {u.description}
                    </p>
                    <div className="mb-3 flex items-center gap-1.5 text-[14px] font-bold">
                      <span style={{ color: "var(--c-gold)" }} aria-hidden>
                        💰
                      </span>
                      <span style={{ color: "var(--c-golddark)" }}>{u.cost}</span>
                    </div>
                    <button
                      type="button"
                      disabled={!canBuy}
                      onClick={() => onPurchaseUpgrade(u.id)}
                      className={`w-full py-3.5 text-[13px] font-bold ${canBuy ? "ds-btn-primary h-12" : "ds-btn-secondary ds-btn-disabled h-12"}`}
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

    </div>
  );
}

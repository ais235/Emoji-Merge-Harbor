/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Coins, X } from "lucide-react";
import { META_COIN_UPGRADES, UPGRADES } from "../progressionData";
import type { Upgrade } from "../types";

const SHOP_UPGRADES: Upgrade[] = META_COIN_UPGRADES.map((id) => UPGRADES.find((u) => u.id === id)).filter(
  (u): u is Upgrade => u != null
);

function effectLabel(u: Upgrade): string {
  const pct = Math.round(u.effectValue * 100);
  switch (u.effectType) {
    case "energy_max":
      return `+${u.effectValue} к макс. энергии`;
    case "box_loot_chance":
      return `+${pct}% к шансу находки в ящике`;
    case "free_spawn_chance":
      return `+${pct}% бесплатного спавна`;
    case "income_bonus":
      return `+${pct}% монет за заказ`;
    case "bonus_chance":
      return `+${pct}% к шансу двойных монет`;
    default:
      return u.description;
  }
}

function groupLabel(u: Upgrade): string {
  switch (u.effectType) {
    case "energy_max":
      return "Энергия";
    case "box_loot_chance":
      return "Находки";
    case "free_spawn_chance":
      return "Бесплатный спавн";
    case "income_bonus":
      return "Доход";
    case "bonus_chance":
      return "Чаевые";
    default:
      return "Бонус";
  }
}

export interface CoinShopModalProps {
  open: boolean;
  onClose: () => void;
  coins: number;
  level: number;
  purchasedUpgrades: string[];
  onPurchaseUpgrade: (upgradeId: string) => void;
}

export default function CoinShopModal({
  open,
  onClose,
  coins,
  level,
  purchasedUpgrades,
  onPurchaseUpgrade,
}: CoinShopModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-2 sm:items-center"
      style={{ background: "rgba(92, 61, 34, 0.4)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="coin-shop-title"
    >
      <div
        className="max-h-[85dvh] w-full max-w-[min(100%,var(--app-content-max))] overflow-hidden rounded-t-[var(--ds-radius-card)] border sm:rounded-[var(--ds-radius-card)]"
        style={{ background: "var(--c-cream)", borderColor: "var(--c-peach2)" }}
      >
        <div
          className="flex items-center justify-between border-b px-3 py-2.5"
          style={{ borderColor: "var(--c-peach2)", background: "var(--c-peach)" }}
        >
          <h2 id="coin-shop-title" className="flex items-center gap-1 text-[13px] font-medium" style={{ color: "var(--c-browndark)" }}>
            Улучшения за <Coins className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--c-golddark)" }} aria-hidden />
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-[var(--ds-radius-btn)] border transition-transform active:scale-[0.97]"
            style={{ borderColor: "var(--c-peach2)", color: "var(--c-brown)" }}
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="no-scrollbar scroll-touch-y max-h-[min(70dvh,520px)] overflow-y-auto p-2">
          <div
            className="mb-2 flex items-center justify-center gap-1.5 rounded-[var(--ds-radius-card)] border py-2"
            style={{ background: "var(--c-peach)", borderColor: "var(--c-peach2)" }}
          >
            <Coins className="h-4 w-4 shrink-0" style={{ color: "var(--c-golddark)" }} aria-hidden />
            <span className="text-[13px] font-medium tabular-nums" style={{ color: "var(--c-golddark)" }}>
              {coins}
            </span>
          </div>
          <ul className="space-y-2">
            {SHOP_UPGRADES.map((u) => {
              const owned = purchasedUpgrades.includes(u.id);
              const isUnlocked = level >= u.requiredLevel;
              const canAfford = coins >= u.cost;
              const canBuy = !owned && isUnlocked && canAfford;
              return (
                <li key={u.id} className="ds-card">
                  <div className="mb-1 text-[13px] font-medium" style={{ color: "var(--c-browndark)" }}>
                    {u.name}
                  </div>
                  <div className="mb-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold" style={{ borderColor: "var(--c-peach2)", color: "var(--c-brown)", background: "var(--c-peach)" }}>
                    {groupLabel(u)}
                  </div>
                  <p className="mb-2 text-[11px] font-medium leading-snug" style={{ color: "var(--c-brown)" }}>
                    {u.description}
                  </p>
                  <p className="mb-2 text-[11px] font-bold leading-snug" style={{ color: "var(--c-greendark)" }}>
                    Эффект: {effectLabel(u)}
                  </p>
                  <div className="mb-2 flex items-center justify-between text-[12px]">
                    <span className="inline-flex items-center gap-1 font-medium" style={{ color: "var(--c-golddark)" }}>
                      <Coins className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--c-golddark)" }} aria-hidden />
                      {u.cost}
                    </span>
                    {owned ? (
                      <span className="font-medium" style={{ color: "var(--c-greendark)" }}>
                        Куплено
                      </span>
                    ) : !isUnlocked ? (
                      <span style={{ color: "var(--c-muted)" }}>Ур. {u.requiredLevel}</span>
                    ) : !canAfford ? (
                      <span style={{ color: "var(--c-rose)" }}>Не хватает</span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    disabled={!canBuy}
                    onClick={() => {
                      onPurchaseUpgrade(u.id);
                    }}
                    className={
                      canBuy
                        ? "ds-btn-primary w-full"
                        : owned
                          ? "ds-btn-secondary ds-btn-disabled w-full cursor-default"
                          : "ds-btn-secondary ds-btn-disabled w-full"
                    }
                  >
                    {owned ? "В наличии" : "Купить"}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

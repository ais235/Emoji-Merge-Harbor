/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Coins, X } from "lucide-react";
import { META_COIN_UPGRADES, UPGRADES } from "../progressionData";
import type { Upgrade } from "../types";

const SHOP_UPGRADES: Upgrade[] = META_COIN_UPGRADES.map((id) => UPGRADES.find((u) => u.id === id)).filter(
  (u): u is Upgrade => u != null
);

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
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-2 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="coin-shop-title"
    >
      <div className="max-h-[85dvh] w-full max-w-[360px] overflow-hidden rounded-t-2xl border border-gray-100 bg-[#F8F9FA] shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 bg-white px-3 py-2">
          <h2 id="coin-shop-title" className="text-sm font-black text-gray-900">
            Улучшения за 🍪
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="no-scrollbar max-h-[min(70dvh,520px)] overflow-y-auto p-2">
          <div className="mb-2 flex items-center justify-center gap-1.5 rounded-xl border border-yellow-100 bg-yellow-50 py-2">
            <Coins className="h-4 w-4 fill-yellow-600 text-yellow-600" />
            <span className="text-sm font-bold text-yellow-800">{coins}</span>
          </div>
          <ul className="space-y-2">
            {SHOP_UPGRADES.map((u) => {
              const owned = purchasedUpgrades.includes(u.id);
              const isUnlocked = level >= u.requiredLevel;
              const canAfford = coins >= u.cost;
              const canBuy = !owned && isUnlocked && canAfford;
              return (
                <li key={u.id} className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
                  <div className="mb-1 font-bold text-gray-900">{u.name}</div>
                  <p className="mb-2 text-[11px] text-gray-500">{u.description}</p>
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="font-bold text-gray-700">🍪 {u.cost}</span>
                    {owned ? (
                      <span className="font-bold text-green-600">Куплено</span>
                    ) : !isUnlocked ? (
                      <span className="text-gray-400">Ур. {u.requiredLevel}</span>
                    ) : !canAfford ? (
                      <span className="text-amber-600">Не хватает</span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    disabled={!canBuy}
                    onClick={() => {
                      onPurchaseUpgrade(u.id);
                    }}
                    className={`w-full rounded-lg py-2 text-xs font-bold uppercase ${
                      canBuy
                        ? "bg-blue-500 text-white shadow-sm active:bg-blue-600"
                        : owned
                          ? "cursor-default bg-gray-100 text-gray-400"
                          : "cursor-not-allowed bg-gray-100 text-gray-400"
                    }`}
                  >
                    {owned ? "В наличии" : "Купить"}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}

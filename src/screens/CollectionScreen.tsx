/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import {
  ITEM_CHAINS,
  itemIsGenerator,
  itemIsResourcePickup,
  type ItemDefinition,
  type ProgressionState,
} from "../types";
import { CHAIN_COMPLETE_REWARDS } from "../collection";

function rarityClass(rarity: string): string {
  if (rarity === "rare") return "border-blue-400 ring-1 ring-blue-200/80";
  if (rarity === "epic") return "border-purple-500 ring-1 ring-purple-200/80";
  return "border-gray-200";
}

export interface CollectionScreenProps {
  progState: ProgressionState;
  onBack: () => void;
}

export default function CollectionScreen({ progState, onBack }: CollectionScreenProps) {
  const chains = Object.values(ITEM_CHAINS);

  return (
    <div className="mx-auto flex h-[100dvh] w-full max-w-[400px] flex-col overflow-hidden bg-[#EEF2F6] font-sans select-none">
      <header className="flex flex-shrink-0 items-center gap-2 border-b border-gray-200 bg-white px-3 py-2 shadow-sm">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-bold text-blue-600 active:bg-gray-50"
        >
          ← Дом
        </button>
        <h1 className="min-w-0 flex-1 truncate text-center text-sm font-black text-gray-900">
          Коллекция
        </h1>
        <span className="w-10 flex-shrink-0" aria-hidden />
      </header>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-3 pb-[env(safe-area-inset-bottom,12px)]">
        {chains.map((chain) => {
          const reward = CHAIN_COMPLETE_REWARDS[chain.id];
          const mergeables = chain.items.filter(
            (it): it is ItemDefinition => !itemIsGenerator(it) && !itemIsResourcePickup(it)
          );
          const total = mergeables.length;
          const got = mergeables.filter((it) => progState.collectedItems[it.id] === true).length;
          const claimed = progState.collectionChainRewardsClaimed[chain.id] === true;

          return (
            <section
              key={chain.id}
              className="mb-3 rounded-xl border border-gray-100 bg-white p-3 shadow-sm"
            >
              <div className="mb-2">
                <h2 className="text-sm font-black text-gray-900">{chain.name}</h2>
                <p className="text-[10px] text-gray-500">
                  Собрано {got}/{total}
                  {reward ? (
                    <>
                      {" "}
                      · Полный сбор: +{reward.coins} 🍪 +{reward.energy} ⚡
                      {got === total && total > 0 ? (claimed ? " · награда получена ✓" : " · награда ждёт") : null}
                    </>
                  ) : null}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {mergeables.map((it) => {
                  const open = progState.collectedItems[it.id] === true;
                  const rc = rarityClass("rarity" in it ? it.rarity : "common");
                  return (
                    <div
                      key={it.id}
                      className={`flex w-[56px] flex-col items-center rounded-lg border bg-gray-50/80 p-1.5 ${rc} ${
                        open ? "" : "opacity-40 grayscale"
                      }`}
                      title={open ? it.name : "Не открыто"}
                    >
                      <span className="select-none text-2xl leading-none" aria-hidden>
                        {open ? it.emoji : "❔"}
                      </span>
                      <span className="mt-0.5 line-clamp-2 text-center text-[8px] font-bold leading-tight text-gray-700">
                        {open ? it.name : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}

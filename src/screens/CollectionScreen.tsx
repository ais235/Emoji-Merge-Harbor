/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { useUiScaling } from "../hooks/useUiScaling";
import { Coins, Home } from "lucide-react";
import {
  itemIsGenerator,
  itemIsResourcePickup,
  type ItemDefinition,
  type ProgressionState,
} from "../types";
import { CHAIN_COMPLETE_REWARDS, collectionChainsInHubOrder } from "../collection";

export interface CollectionScreenProps {
  progState: ProgressionState;
  onBack: () => void;
}

export default function CollectionScreen({ progState, onBack }: CollectionScreenProps) {
  const chains = collectionChainsInHubOrder();
  const { containerRef, uiScale, scalingStyle } = useUiScaling();

  return (
    <div
      ref={containerRef}
      className="ds-screen ds-screen-fill-viewport flex min-h-0 flex-col overflow-hidden p-2"
      style={scalingStyle}
    >
      <header className="ds-topbar -mx-2 -mt-2 mb-2 rounded-none px-2">
        <button type="button" onClick={onBack} className="ds-pill-home shrink-0 gap-1.5">
          <Home className="h-4 w-4 shrink-0" aria-hidden />
          Дом
        </button>
        <h1 className="ds-topbar-title">Коллекция</h1>
        <span className="ds-topbar-spacer" aria-hidden />
      </header>

      <div className="no-scrollbar scroll-touch-y min-h-0 flex-1 overflow-y-auto pb-[max(12px,env(safe-area-inset-bottom,12px))]">
        {chains.map((chain) => {
          const reward = CHAIN_COMPLETE_REWARDS[chain.id];
          const mergeables = chain.items.filter(
            (it): it is ItemDefinition => !itemIsGenerator(it) && !itemIsResourcePickup(it)
          );
          const total = mergeables.length;
          const got = mergeables.filter((it) => progState.collectedItems[it.id] === true).length;
          const claimed = progState.collectionChainRewardsClaimed[chain.id] === true;

          return (
            <section key={chain.id} className="ds-card mb-3 p-3">
              <div className="mb-2.5">
                <h2 className="text-[15px] font-bold" style={{ color: "var(--c-browndark)" }}>
                  {chain.name}
                </h2>
                <p className="mt-0.5 text-[12px] font-medium" style={{ color: "var(--c-muted)" }}>
                  Собрано {got}/{total}
                  {reward ? (
                    <>
                      {" "}
                      · Полный сбор: +{reward.coins} монет +{reward.energy} ⚡
                      {got === total && total > 0 ? (claimed ? " · награда получена" : " · награда ждёт") : null}
                    </>
                  ) : null}
                </p>
              </div>
              {reward && got === total && total > 0 ? (
                <div
                  className="mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-medium"
                  style={{ background: "var(--c-peach)", borderColor: "var(--c-peach2)", color: "var(--c-brown)" }}
                >
                  <Coins className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--c-golddark)" }} aria-hidden />
                  <span style={{ color: "var(--c-golddark)" }}>+{reward.coins}</span>
                  <span style={{ color: "var(--c-rose)" }}>⚡</span>
                  <span>+{reward.energy}</span>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2.5">
                {mergeables.map((it) => {
                  const open = progState.collectedItems[it.id] === true;
                  return (
                    <div
                      key={it.id}
                      className="flex w-[86px] flex-col items-center rounded-[var(--ds-radius-btn)] border px-2 py-2"
                      style={
                        open
                          ? { background: "var(--c-cream)", borderColor: "var(--c-peach2)" }
                          : { background: "var(--c-peach)", borderColor: "var(--c-peach2)" }
                      }
                      title={open ? it.name : "Не открыто"}
                    >
                      <span className="select-none text-[34px] leading-none" aria-hidden>
                        {open ? it.emoji : "?"}
                      </span>
                      <span
                        className="mt-1 line-clamp-2 min-h-[2.1em] text-center text-[11px] font-medium leading-tight"
                        style={{ color: open ? "var(--c-browndark)" : "var(--c-muted)" }}
                      >
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
    </div>
  );
}

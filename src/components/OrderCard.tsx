/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import {
  ALL_ITEMS,
  orderAllRemainingSatisfiedFromGrid,
  orderReqLineSatisfiedOnGrid,
  resolveOrderCustomerAvatar,
  type GridCell,
  type Order,
} from "../types";

export interface OrderCardProps {
  order: Order;
  grid: GridCell[];
  showCoinFly: boolean;
  coinFlyAmount: number;
  onItemInfo: (itemId: string) => void;
  onDeliver: (orderId: string, orderInstanceId: string, deliverButtonRect?: DOMRect) => void;
}

export function OrderCard({
  order,
  grid,
  showCoinFly,
  coinFlyAmount,
  onItemInfo,
  onDeliver,
}: OrderCardProps) {
  const allMet = orderAllRemainingSatisfiedFromGrid(grid, order);
  const portraitSrc = resolveOrderCustomerAvatar(order);
  const [portraitBroken, setPortraitBroken] = useState(false);

  useEffect(() => {
    setPortraitBroken(false);
  }, [order.instanceId, portraitSrc]);

  const reqs = order.requirements.slice(0, 2);

  return (
    <div
      className="order-card-slot relative flex min-h-0 flex-col self-start overflow-hidden rounded-[14px] border-2 bg-[#f5e6c8]"
      style={{
        borderColor: allMet ? "#4CAF50" : "#d4a84b",
        boxShadow: allMet ? "0 3px 0 #2E7D32" : "0 3px 0 #a67c2e",
      }}
    >
      {/* Жёлтая полоска — цена */}
      <div
        className="flex shrink-0 items-center justify-end gap-0.5 border-b-2 px-1.5 py-1"
        style={{
          background: "#FFD700",
          borderColor: "#C8A200",
        }}
      >
        <span
          className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border-[1.5px] border-[#D4810A]"
          style={{ background: "#F5A623" }}
          aria-hidden
        />
        <span className="text-[10px] font-bold tabular-nums leading-none text-[#6B4400]">
          {order.rewardCoins}
        </span>
      </div>

      {/* Портрет — эмодзи сразу под полосой цены, без лишнего пустого поля */}
      <div
        className="relative flex shrink-0 flex-col items-center overflow-hidden pt-0.5 pb-0"
        style={{
          background: "linear-gradient(175deg, #c9e8ff 0%, #a0c8f0 100%)",
        }}
      >
        {portraitBroken ? (
          <span
            className="order-card-portrait-emoji select-none leading-none"
            style={{
              marginBottom: -4,
              filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.15))",
            }}
            aria-hidden
          >
            🧑
          </span>
        ) : (
          <img
            src={portraitSrc}
            alt=""
            className="order-card-portrait-img pointer-events-none select-none"
            draggable={false}
            style={{
              marginBottom: -4,
              filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.18))",
            }}
            onError={() => setPortraitBroken(true)}
          />
        )}
      </div>

      {/* Поднос */}
      <div
        className="relative flex min-h-0 flex-col items-center gap-1 border-t-2 px-1.5 pb-1.5 pt-1"
        style={{
          background: "#e8d5aa",
          borderColor: "#c4a870",
        }}
      >
        {allMet ? (
          <button
            type="button"
            className="absolute left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-[20px] border-none px-[18px] py-[5px] text-xs font-extrabold text-white shadow-[0_3px_0_#2E7D32] outline-none"
            style={{
              top: -14,
              background: "#4CAF50",
              cursor: "pointer",
            }}
            onClick={(e) => onDeliver(order.id, order.instanceId, e.currentTarget.getBoundingClientRect())}
          >
            Отдать
          </button>
        ) : null}

        <div
          className="flex w-full min-h-0 items-center justify-center gap-1 rounded-md border-[1.5px] px-0.5 py-1"
          style={{
            background: "#f0e0c0",
            borderColor: "#c4a870",
          }}
        >
          {reqs.map((req) => {
            const def = ALL_ITEMS[req.itemId];
            const lineMet = orderReqLineSatisfiedOnGrid(grid, order, req);
            return (
              <button
                key={`${order.instanceId}-${req.itemId}`}
                type="button"
                className="relative flex shrink-0 flex-col items-center justify-center border-0 bg-transparent p-0"
                onClick={() => onItemInfo(req.itemId)}
                title="Подсказка по предмету"
              >
                <span className="order-card-tray-emoji block leading-none">{def?.emoji ?? "❓"}</span>
                {lineMet ? (
                  <span
                    className="absolute -bottom-0.5 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border-[1.5px] border-white text-[8px] font-black text-white"
                    style={{ background: "#4CAF50" }}
                    aria-hidden
                  >
                    ✓
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {showCoinFly ? (
          <span
            className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-0.5 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold text-[#6B4400]"
            aria-hidden
          >
            +{coinFlyAmount} 🍪
          </span>
        ) : null}
      </div>
    </div>
  );
}

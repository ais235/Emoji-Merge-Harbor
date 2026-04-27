/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { X } from "lucide-react";
import { ALL_ITEMS, ITEM_CHAINS, type ItemId } from "../types";

export interface OrderItemInfoModalProps {
  open: boolean;
  onClose: () => void;
  itemId: ItemId | null;
}

export default function OrderItemInfoModal({ open, onClose, itemId }: OrderItemInfoModalProps) {
  if (!open || !itemId) return null;
  const def = ALL_ITEMS[itemId];
  if (!def) return null;
  const chainId = "chain" in def ? def.chain : "";
  const chain = chainId ? ITEM_CHAINS[chainId] : undefined;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-item-info-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[280px] rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <h2 id="order-item-info-title" className="text-sm font-black uppercase tracking-wide text-gray-900">
            Предмет
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="text-5xl leading-none" aria-hidden>
            {"emoji" in def ? def.emoji : "❓"}
          </span>
          <p className="text-base font-bold text-gray-900">{"name" in def ? def.name : itemId}</p>
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
            Цепочка: {(chain?.name ?? chainId) || "—"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-xl bg-gray-900 py-2.5 text-sm font-bold text-white shadow-sm"
        >
          Понятно
        </button>
      </div>
    </div>
  );
}

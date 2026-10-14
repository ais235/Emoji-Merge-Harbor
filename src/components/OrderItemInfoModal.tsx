/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { X } from "lucide-react";
import { ALL_ITEMS, ITEM_CHAINS, itemIsMergeable, type ItemId } from "../types";
import { ROOM_GENERATOR_DEFS } from "../roomMergeCatalog";

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
  const generators = Object.values(ROOM_GENERATOR_DEFS).filter((g) => g.spawnsChainId === chainId);
  const chainItems = chain
    ? chain.items.filter(itemIsMergeable)
    : [];

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
          <div className="w-full rounded-xl border border-violet-100 bg-violet-50/50 p-2 text-left">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-violet-800">Генератор</p>
            {generators.length > 0 ? (
              <div className="space-y-1">
                {generators.map((g) => (
                  <div key={g.id} className="flex items-center gap-1.5 text-[12px] font-semibold text-violet-950">
                    <span className="text-base leading-none" aria-hidden>
                      {g.emoji}
                    </span>
                    {g.name}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] font-medium text-gray-500">Для этой цепочки генератор не найден.</p>
            )}
          </div>
          <div className="w-full rounded-xl border border-gray-200 bg-gray-50/80 p-2">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-700">Цепочка генератора</p>
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {chainItems.map((it) => (
                <div
                  key={it.id}
                  className={`flex min-w-[46px] flex-col items-center rounded-md border px-1.5 py-1 ${
                    it.id === itemId ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-white"
                  }`}
                >
                  <span className="text-base leading-none">{it.emoji}</span>
                  <span className="mt-0.5 text-[8px] font-bold text-gray-600">Ур. {it.level}</span>
                </div>
              ))}
            </div>
          </div>
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

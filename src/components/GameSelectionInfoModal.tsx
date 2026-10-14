/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { X } from "lucide-react";
import {
  ALL_ITEMS,
  ITEM_CHAINS,
  GENERATOR_RESOURCE_DROP_CHANCE,
  itemIsGenerator,
  itemIsResourcePickup,
  type GeneratorItemDefinition,
  type GridCell,
  type ItemDefinition,
  type ProgressionState,
} from "../types";
import { ItemIcon } from "./ItemIcon";

function rarityClass(rarity: string): string {
  if (rarity === "rare") return "border-blue-400 ring-1 ring-blue-200/80";
  if (rarity === "epic") return "border-purple-500 ring-1 ring-purple-200/80";
  return "border-gray-200";
}

function generatorsSpawningChain(chainId: string): GeneratorItemDefinition[] {
  return Object.values(ALL_ITEMS).filter(
    (d): d is GeneratorItemDefinition => itemIsGenerator(d) && d.spawnsChainId === chainId
  );
}

/** Заглушка до системы уровней генератора в прогрессии. */
const GENERATOR_INFO_LEVEL_STUB = 1;

export interface GameSelectionInfoModalProps {
  open: boolean;
  onClose: () => void;
  selectedCell: number | null;
  grid: GridCell[];
  progState: ProgressionState;
  energy: number;
  maxEnergy: number;
}

export default function GameSelectionInfoModal({
  open,
  onClose,
  selectedCell,
  grid,
  progState,
  energy,
  maxEnergy,
}: GameSelectionInfoModalProps) {
  if (!open) return null;

  const cell = selectedCell != null ? grid[selectedCell] : null;
  const itemId = cell?.item ?? null;
  const def = itemId ? ALL_ITEMS[itemId] : null;

  let title = "Подсказка по выделению";
  let body: React.ReactNode = null;

  if (selectedCell == null || !def) {
    body = (
      <div className="space-y-2 text-xs leading-relaxed text-gray-700">
        <p>
          Выбери клетку с предметом или генератором — появится рамка. <strong>Слияние и обмен</strong> — перетаскиванием
          одной клетки на другую.
        </p>
        <p className="text-[10px] text-gray-500">
          <strong>Ящики</strong> открываются после слияний рядом: внутри предмет под паутиной — перетащи на него такой
          же предмет, чтобы снять паутину и сдать в заказ.
        </p>
        <p className="text-[10px] text-gray-500">
          Генератор: первый клик выделяет, второй по той же клетке — создаёт предмет 1-го уровня (−1 ⚡ к общей
          энергии).
        </p>
      </div>
    );
  } else if (itemIsResourcePickup(def)) {
    title = "Награда";
    body = (
      <p className="text-xs leading-relaxed text-gray-700">
        Это разовая награда: кликни, чтобы забрать {def.grantsCoins > 0 ? "монеты" : "энергию"} и убрать предмет с
        клетки.
      </p>
    );
  } else if (itemIsGenerator(def)) {
    const chain = ITEM_CHAINS[def.spawnsChainId];
    const lvl1 = chain?.items.find(
      (it): it is ItemDefinition => !itemIsGenerator(it) && !itemIsResourcePickup(it)
    );
    const resPct = Math.round(GENERATOR_RESOURCE_DROP_CHANCE * 100);

    title = "Генератор";
    body = (
      <div className="space-y-3 text-xs text-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-3xl leading-none" aria-hidden>
            <ItemIcon itemId={def.id} size={48} />
          </span>
          <div>
            <p className="text-sm font-black text-gray-900">{def.name}</p>
            <p className="text-[10px] text-gray-500">Уровень: {GENERATOR_INFO_LEVEL_STUB}</p>
          </div>
        </div>
        <p>
          <span className="font-bold text-gray-700">Энергия для выдач:</span> {energy} / {maxEnergy} (та же шкала, что
          вверху экрана).
        </p>
        {chain ? (
          <>
            <p>
              <span className="font-bold text-gray-700">Цепочка:</span> {chain.name}
            </p>
            {lvl1 ? (
              <p>
                <span className="font-bold text-gray-700">Создаёт:</span> предмет 1-го уровня — {lvl1.emoji} {lvl1.name}
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-amber-700">Цепочка не найдена в данных ({def.spawnsChainId}).</p>
        )}
        <p className="text-[10px] leading-snug text-gray-600">
          С вероятностью около {resPct}% вместо предмета выпадут монеты или энергия на клетку.
        </p>
      </div>
    );
  } else if ("level" in def && "chain" in def && !itemIsGenerator(def)) {
    const chainId = def.chain;
    const chain = ITEM_CHAINS[chainId];
    const gens = generatorsSpawningChain(chainId);
    title = "Предмет и цепочка";
    body = (
      <div className="space-y-3 text-xs text-gray-800">
        <div className="flex items-center gap-2">
          <ItemIcon itemId={def.id} size={38} />
          <div>
            <p className="text-sm font-black text-gray-900">{def.name}</p>
            <p className="text-[10px] text-gray-500">Уровень в цепочке: {def.level}</p>
          </div>
        </div>
        {chain ? (
          <>
            <p className="font-bold text-gray-900">{chain.name}</p>
            <div className="flex flex-wrap gap-2">
              {chain.items
                .filter((it): it is ItemDefinition => !itemIsGenerator(it) && !itemIsResourcePickup(it))
                .map((it) => {
                  const open = progState.collectedItems[it.id] === true;
                  const current = it.id === itemId;
                  const rc = rarityClass("rarity" in it ? it.rarity : "common");
                  return (
                    <div
                      key={it.id}
                      className={`flex w-[56px] flex-col items-center rounded-lg border bg-gray-50/80 p-1.5 ${rc} ${
                        open ? "" : "opacity-40 grayscale"
                      } ${current ? "ring-2 ring-blue-500 ring-offset-1" : ""}`}
                    >
                      {open ? <ItemIcon itemId={it.id} size={30} /> : <span className="text-2xl leading-none">❔</span>}
                      <span className="mt-0.5 text-center text-[8px] font-bold leading-tight text-gray-700">
                        {open ? it.name : "—"}
                      </span>
                    </div>
                  );
                })}
            </div>
          </>
        ) : (
          <p className="text-amber-700">Цепочка не найдена ({chainId}).</p>
        )}
        <div>
          <p className="mb-1 font-bold text-gray-900">Генерируется из:</p>
          {gens.length > 0 ? (
            <ul className="space-y-1">
              {gens.map((g) => (
                <li
                  key={g.id}
                  className="flex items-center gap-2 rounded-md border border-violet-100 bg-violet-50/60 px-2 py-1"
                >
                  <span className="text-xl" aria-hidden>
                    {g.emoji}
                  </span>
                  <span className="font-semibold text-violet-950">{g.name}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[10px] text-gray-600">Для этой цепочки в справочнике нет отдельного генератора.</p>
          )}
        </div>
      </div>
    );
  } else {
    body = <p className="text-xs text-gray-600">Нет подсказки для этого типа предмета.</p>;
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-2 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="game-selection-info-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="scroll-touch-y max-h-[85dvh] w-full max-w-[360px] overflow-y-auto rounded-t-2xl border border-gray-100 bg-[#F8F9FA] shadow-xl sm:rounded-2xl sm:p-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 bg-white px-3 py-2">
          <h2 id="game-selection-info-title" className="text-sm font-black text-gray-900">
            {title}
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
        <div className="p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{body}</div>
      </div>
    </div>
  );
}

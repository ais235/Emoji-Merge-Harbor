/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from "react";
import type { FurnitureLayer, RoomVisual } from "../story/roomData";

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function formatRoomBlock(visual: RoomVisual, layers: FurnitureLayer[]): string {
  const bgImageLine = visual.bgImage
    ? `    bgImage: ${JSON.stringify(visual.bgImage)},\n`
    : "";
  const layerLines = layers.map((l) => {
    let line = `      { upgradeId: ${JSON.stringify(l.upgradeId)}, emoji: ${JSON.stringify(l.emoji)}, label: ${JSON.stringify(l.label)}, x: ${Number(l.x.toFixed(2))}, y: ${Number(l.y.toFixed(2))}, size: ${Number(l.size.toFixed(1))}`;
    if (l.imageSrc) line += `, imageSrc: ${JSON.stringify(l.imageSrc)}`;
    line += ` },`;
    return line;
  });
  return `  {
    zoneId: ${JSON.stringify(visual.zoneId)},
    bgColor: ${JSON.stringify(visual.bgColor)},
    bgEmoji: ${JSON.stringify(visual.bgEmoji)},
${bgImageLine}    layers: [
${layerLines.join("\n")}
    ],
  },`;
}

export type RoomLayoutEditorPanelProps = {
  roomVisual: RoomVisual;
  draftLayers: FurnitureLayer[];
  onLayersReplace: (next: FurnitureLayer[]) => void;
  draftBgImage: string;
  onDraftBgImageChange: (v: string) => void;
  selectedUpgradeId: string | null;
  onSelectUpgradeId: (id: string | null) => void;
};

export default function RoomLayoutEditorPanel({
  roomVisual,
  draftLayers,
  onLayersReplace,
  draftBgImage,
  onDraftBgImageChange,
  selectedUpgradeId,
  onSelectUpgradeId,
}: RoomLayoutEditorPanelProps) {
  const selected = draftLayers.find((l) => l.upgradeId === selectedUpgradeId) ?? null;

  const nudge = (dx: number, dy: number) => {
    if (!selectedUpgradeId) return;
    onLayersReplace(
      draftLayers.map((l) =>
        l.upgradeId === selectedUpgradeId
          ? {
              ...l,
              x: clamp(l.x + dx, 0, 100),
              y: clamp(l.y + dy, 0, 100),
            }
          : l
      )
    );
  };

  const adjustSize = (delta: number) => {
    if (!selectedUpgradeId) return;
    onLayersReplace(
      draftLayers.map((l) =>
        l.upgradeId === selectedUpgradeId
          ? { ...l, size: clamp(l.size + delta, 8, 160) }
          : l
      )
    );
  };

  const patchSelected = (patch: Partial<FurnitureLayer>) => {
    if (!selectedUpgradeId) return;
    onLayersReplace(
      draftLayers.map((l) => (l.upgradeId === selectedUpgradeId ? { ...l, ...patch } : l))
    );
  };

  useEffect(() => {
    const id = selectedUpgradeId;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (!id) return;
      const big = e.shiftKey;
      const step = big ? 2 : 0.5;
      const applyNudge = (dx: number, dy: number) => {
        onLayersReplace(
          draftLayers.map((l) =>
            l.upgradeId === id
              ? { ...l, x: clamp(l.x + dx, 0, 100), y: clamp(l.y + dy, 0, 100) }
              : l
          )
        );
      };
      const applySize = (delta: number) => {
        onLayersReplace(
          draftLayers.map((l) =>
            l.upgradeId === id ? { ...l, size: clamp(l.size + delta, 8, 160) } : l
          )
        );
      };
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          applyNudge(-step, 0);
          break;
        case "ArrowRight":
          e.preventDefault();
          applyNudge(step, 0);
          break;
        case "ArrowUp":
          e.preventDefault();
          applyNudge(0, -step);
          break;
        case "ArrowDown":
          e.preventDefault();
          applyNudge(0, step);
          break;
        case "+":
        case "=":
          e.preventDefault();
          applySize(big ? 4 : 1);
          break;
        case "-":
        case "_":
          e.preventDefault();
          applySize(big ? -4 : -1);
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedUpgradeId, draftLayers, onLayersReplace]);

  const mergedVisual: RoomVisual = {
    ...roomVisual,
    bgImage: draftBgImage.trim() ? draftBgImage.trim() : undefined,
  };

  const copySnippet = async () => {
    const text = formatRoomBlock(mergedVisual, draftLayers);
    try {
      await navigator.clipboard.writeText(text);
      // eslint-disable-next-line no-alert -- dev-only editor fallback
      window.alert(
        "Текст скопирован в буфер обмена.\n\n" +
          "Дальше ОБЯЗАТЕЛЬНО:\n" +
          "1) Откройте src/story/roomData.ts\n" +
          "2) Найдите блок этой зоны в ROOM_VISUALS и замените его целиком вставкой (Ctrl+V)\n" +
          "3) Сохраните файл Ctrl+S\n\n" +
          "Только после сохранения файла перезагрузка F5 покажет новую раскладку."
      );
    } catch {
      // eslint-disable-next-line no-console -- dev fallback
      console.log(text);
      // eslint-disable-next-line no-alert
      window.alert("Не удалось скопировать. Фрагмент выведен в консоль (F12).");
    }
  };

  return (
    <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50/90 p-2 text-[11px] text-amber-950 shadow-sm">
      <div className="mb-1.5 font-black uppercase tracking-wide text-amber-900">
        Редактор раскладки
      </div>
      <p className="mb-2 leading-snug text-amber-950/90">
        Тащите слой мышью или пальцем. Стрелки — сдвиг, +/− — масштаб. Удерживайте Shift для крупного шага.
      </p>

      <label className="mb-1.5 block font-semibold">
        Фон (bgImage)
        <input
          type="text"
          value={draftBgImage}
          onChange={(e) => onDraftBgImageChange(e.target.value)}
          placeholder="/rooms/hall-bg.png"
          className="mt-0.5 w-full rounded-lg border border-amber-200 bg-white px-2 py-1.5 font-mono text-[10px] text-gray-900"
        />
      </label>

      <label className="mb-1.5 block font-semibold">
        Слой
        <select
          value={selectedUpgradeId ?? ""}
          onChange={(e) => onSelectUpgradeId(e.target.value || null)}
          className="mt-0.5 w-full rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-[11px] text-gray-900"
        >
          {draftLayers.map((l) => (
            <option key={l.upgradeId} value={l.upgradeId}>
              {l.label} ({l.upgradeId})
            </option>
          ))}
        </select>
      </label>

      {selected ? (
        <label className="mb-1.5 block font-semibold">
          Картинка предмета (imageSrc)
          <input
            type="text"
            value={selected.imageSrc ?? ""}
            onChange={(e) =>
              patchSelected({ imageSrc: e.target.value.trim() ? e.target.value.trim() : undefined })
            }
            placeholder={`/rooms/${roomVisual.zoneId}/${selected.upgradeId}.png`}
            className="mt-0.5 w-full rounded-lg border border-amber-200 bg-white px-2 py-1.5 font-mono text-[10px] text-gray-900"
          />
        </label>
      ) : null}

      <div className="mb-2 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => nudge(-0.5, 0)}
          className="rounded-lg border border-amber-300 bg-white px-2 py-1 font-bold"
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => nudge(0.5, 0)}
          className="rounded-lg border border-amber-300 bg-white px-2 py-1 font-bold"
        >
          →
        </button>
        <button
          type="button"
          onClick={() => nudge(0, -0.5)}
          className="rounded-lg border border-amber-300 bg-white px-2 py-1 font-bold"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={() => nudge(0, 0.5)}
          className="rounded-lg border border-amber-300 bg-white px-2 py-1 font-bold"
        >
          ↓
        </button>
        <button
          type="button"
          onClick={() => adjustSize(-1)}
          className="rounded-lg border border-amber-300 bg-white px-2 py-1 font-bold"
        >
          −
        </button>
        <button
          type="button"
          onClick={() => adjustSize(1)}
          className="rounded-lg border border-amber-300 bg-white px-2 py-1 font-bold"
        >
          +
        </button>
      </div>

      <button
        type="button"
        onClick={() => void copySnippet()}
        className="w-full rounded-lg bg-amber-600 py-2 text-xs font-bold text-white shadow-sm active:bg-amber-700"
      >
        Скопировать блок в буфер (потом вставить в roomData.ts)
      </button>
    </div>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import type { StoryBeat } from "../story/storyData";

const NPC_STYLE: Record<
  StoryBeat["npc"],
  { emoji: string; bg: string; name: string }
> = {
  lena: { emoji: "👩‍🍳", bg: "#FFF3E0", name: "Лена" },
  tom: { emoji: "👨‍🔧", bg: "#E3F2FD", name: "Том" },
  guest: { emoji: "🎭", bg: "#F3E5F5", name: "Незнакомка" },
};

export interface DialogModalProps {
  beat: StoryBeat;
  onChoice: (nextBeatId: string | null) => void;
}

export default function DialogModal({ beat, onChoice }: DialogModalProps) {
  const npc = NPC_STYLE[beat.npc];
  const [a, b] = beat.choices;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black/45"
      role="dialog"
      aria-modal="true"
      aria-labelledby="story-dialog-title"
    >
      <button
        type="button"
        className="min-h-0 flex-1 cursor-default border-0 bg-transparent p-0"
        aria-hidden
        tabIndex={-1}
      />
      <div className="w-full rounded-t-3xl bg-white px-4 pb-6 pt-4 shadow-[0_-4px_24px_rgba(0,0,0,0.12)]">
        <div className="mx-auto flex w-full max-w-[360px] gap-3">
          <div
            className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full text-3xl"
            style={{ backgroundColor: npc.bg }}
          >
            <span aria-hidden>{npc.emoji}</span>
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <p
              id="story-dialog-title"
              className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-400"
            >
              {npc.name}
            </p>
            <p className="line-clamp-3 text-sm leading-snug text-gray-900">
              {beat.text}
            </p>
          </div>
        </div>

        <div className="mx-auto mt-4 flex w-full max-w-[360px] flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => onChoice(a.nextBeatId)}
            className="flex-1 rounded-xl border-2 border-gray-200 bg-white py-3 text-xs font-bold text-gray-800"
          >
            {a.label}
          </button>
          <button
            type="button"
            onClick={() => onChoice(b.nextBeatId)}
            className="flex-1 rounded-xl py-3 text-xs font-bold text-white"
            style={{ backgroundColor: "#378ADD" }}
          >
            {b.label}
          </button>
        </div>

        <p className="mx-auto mt-3 w-full max-w-[360px] text-center text-[10px] text-gray-400">
          Нажми, чтобы продолжить
        </p>
      </div>
    </div>
  );
}

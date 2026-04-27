/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Сюжетные диалоги на экране «Дом»: тёмная VN-панель с бюстом и outline-кнопками.
 * Контракт без изменений: beat + onChoice(nextBeatId); onDismiss опционально.
 */

import React, { useEffect, useState } from "react";
import type { StoryBeat } from "../story/storyData";

interface NPCStyle {
  name: string;
  color: string;
  avatar: string;
  avatarFallback: string;
}

/** Ключи должны совпадать с `StoryBeat["npc"]`: lena | tom | guest */
const NPC_STYLE: Record<StoryBeat["npc"], NPCStyle> = {
  lena: {
    name: "Лена",
    color: "#C96E4A",
    avatar: "/avatars/lena_neutral.png",
    avatarFallback: "👩‍🍳",
  },
  tom: {
    name: "Том",
    color: "#4A7D9E",
    avatar: "/avatars/tom_neutral.png",
    avatarFallback: "👨‍🔧",
  },
  guest: {
    name: "Незнакомка",
    color: "#8A6AAE",
    avatar: "/avatars/guest_neutral.png",
    avatarFallback: "🎭",
  },
};

/** Эмоция аватара по id бита (нет записи → neutral). */
const BEAT_EMOTION: Partial<Record<string, string>> = {
  start: "neutral",
  start_b: "neutral",
  first_order: "happy",
  first_upgrade: "neutral",
  tom_garage: "sheepish",
  kitchen_unlock: "happy",
  guest_first: "neutral",
  guest_mystery: "neutral",
  terrace_unlock: "proud",
  guest_hint: "neutral",
};

function avatarSrc(npc: StoryBeat["npc"], beatId: string): string {
  const emotion = BEAT_EMOTION[beatId] ?? "neutral";
  return `/avatars/${npc}_${emotion}.png`;
}

const FONT_UI = `"Nunito", system-ui, -apple-system, "Segoe UI", sans-serif`;

const STYLES = `
  @keyframes dm-fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes dm-slide-up {
    from { transform: translateY(100%); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  .dm-overlay {
    position: fixed;
    inset: 0;
    z-index: 400;
    display: flex;
    align-items: flex-end;
    background: rgba(0, 0, 0, 0.45);
    animation: dm-fade-in 0.2s ease forwards;
  }

  .dm-panel {
    width: 100%;
    background: rgba(22, 15, 8, 0.96);
    border-top: 2.5px solid var(--dm-color);
    display: flex;
    align-items: stretch;
    gap: 12px;
    padding-bottom: env(safe-area-inset-bottom, 10px);
    animation: dm-slide-up 0.3s cubic-bezier(.22,.68,0,1.1) forwards;
    min-height: 160px;
  }

  .dm-avatar {
    flex-shrink: 0;
    width: min(34vw, 118px);
    align-self: stretch;
    margin: 0;
    border-radius: 0;
    border: none;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 50px;
    line-height: 1;
  }
  .dm-avatar img {
    width: 100%;
    height: 100%;
    min-height: 100%;
    object-fit: cover;
    object-position: top center;
    display: block;
  }

  .dm-body {
    flex: 1;
    min-width: 0;
    padding: 14px 4px 16px 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    justify-content: center;
  }

  .dm-name {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--dm-color);
    font-family: ${FONT_UI};
  }

  .dm-text {
    font-size: 15px;
    line-height: 1.55;
    color: rgba(255, 245, 235, 0.95);
    font-family: ${FONT_UI};
  }

  .dm-choices {
    display: flex;
    flex-direction: column;
    gap: 7px;
    margin-top: 8px;
  }

  .dm-choice {
    background: rgba(255, 255, 255, 0.07);
    border: 1.5px solid var(--dm-color);
    border-radius: 9px;
    padding: 10px 14px;
    font-size: 14px;
    font-weight: 600;
    color: rgba(255, 245, 235, 0.92);
    text-align: left;
    cursor: pointer;
    transition: background 0.14s;
    font-family: ${FONT_UI};
    width: 100%;
  }
  .dm-choice:hover,
  .dm-choice:active {
    background: rgba(255, 255, 255, 0.16);
  }

`;

export interface DialogModalProps {
  beat: StoryBeat;
  onChoice: (nextBeatId: string | null) => void;
  onDismiss?: () => void;
}

export default function DialogModal({ beat, onChoice, onDismiss }: DialogModalProps) {
  const npc = NPC_STYLE[beat.npc];
  const [avatarBroken, setAvatarBroken] = useState(false);

  useEffect(() => {
    setAvatarBroken(false);
  }, [beat.id, beat.npc]);

  const hasChoices = Boolean(beat.choices && beat.choices.length > 0);

  const handleOverlayClick = () => {
    if (hasChoices) return;
    if (onDismiss) onDismiss();
    else onChoice(null);
  };

  return (
    <>
      <style>{STYLES}</style>
      <div
        className="dm-overlay"
        onClick={handleOverlayClick}
        role="dialog"
        aria-modal="true"
        aria-labelledby="story-dialog-name"
      >
        <div
          className="dm-panel"
          style={{ "--dm-color": npc.color } as React.CSSProperties}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="dm-body">
            <div className="dm-name" id="story-dialog-name">
              {npc.name}
            </div>
            <div className="dm-text">{beat.text}</div>

            {hasChoices ? (
              <div className="dm-choices">
                {beat.choices.map((choice, i) => (
                  <button
                    key={i}
                    type="button"
                    className="dm-choice"
                    onClick={() => onChoice(choice.nextBeatId)}
                  >
                    {choice.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="dm-avatar">
            {avatarBroken ? (
              <span className="flex h-full w-full items-center justify-center">{npc.avatarFallback}</span>
            ) : (
              <img
                src={avatarSrc(beat.npc, beat.id)}
                alt=""
                onError={() => setAvatarBroken(true)}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

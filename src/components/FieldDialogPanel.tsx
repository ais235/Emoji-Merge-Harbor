/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * VN-панель снизу экрана на поле миниигры.
 * Аватары: public/avatars/{npc}_{emotion}.png — при отсутствии файла показывается эмодзи.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { FieldNPC } from "../fieldDialogs";

export type NPCEmotion =
  | "neutral"
  | "happy"
  | "worried"
  | "surprised"
  | "proud"
  | "sheepish";

export interface PanelLine {
  npc: FieldNPC;
  emotion?: NPCEmotion;
  text: string;
  choices?: Array<{ label: string; onSelect: () => void }>;
  duration?: number;
}

interface FieldDialogCtx {
  showPanel: (line: PanelLine) => void;
  hidePanel: () => void;
}

const FieldDialogContext = createContext<FieldDialogCtx>({
  showPanel: () => {},
  hidePanel: () => {},
});

export function useFieldDialog() {
  return useContext(FieldDialogContext);
}

const NPC_CONFIG: Record<FieldNPC, { color: string; name: string; emoji: string }> = {
  lena: { color: "#C96E4A", name: "Лена", emoji: "👩‍🍳" },
  tom: { color: "#4A7D9E", name: "Том", emoji: "👨‍🔧" },
};

function avatarSrc(npc: FieldNPC, emotion: NPCEmotion = "neutral"): string {
  return `/avatars/${npc}_${emotion}.png`;
}

const FONT_UI = `"Nunito", system-ui, -apple-system, "Segoe UI", sans-serif`;

const STYLES = `
  @keyframes vn-slide-up {
    from { transform: translateY(100%); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }
  @keyframes vn-slide-down {
    from { transform: translateY(0);    opacity: 1; }
    to   { transform: translateY(100%); opacity: 0; }
  }

  .vn-overlay {
    position: fixed;
    inset: 0;
    z-index: 180;
    pointer-events: none;
    display: flex;
    align-items: flex-end;
  }
  .vn-overlay.vn-blocking {
    pointer-events: auto;
    background: rgba(0,0,0,0.28);
  }

  .vn-panel {
    width: 100%;
    background: rgba(30, 22, 14, 0.93);
    border-top: 2px solid var(--vn-color);
    padding: 0 0 env(safe-area-inset-bottom, 8px);
    pointer-events: auto;
    display: flex;
    align-items: stretch;
    gap: 12px;
    min-height: 148px;
    position: relative;
  }
  .vn-panel.vn-in  { animation: vn-slide-up   0.3s cubic-bezier(.22,.68,0,1.1) forwards; }
  .vn-panel.vn-out { animation: vn-slide-down  0.22s ease-in forwards; }

  .vn-avatar {
    flex-shrink: 0;
    width: min(34vw, 118px);
    align-self: stretch;
    margin: 0;
    border-radius: 0;
    overflow: hidden;
    border: none;
    background: rgba(0,0,0,0.15);
    display: flex;
    align-items: stretch;
    justify-content: center;
  }
  .vn-avatar img {
    width: 100%;
    height: 100%;
    min-height: 100%;
    object-fit: cover;
    object-position: top center;
    display: block;
  }
  .vn-avatar-emoji {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 44px;
  }

  .vn-body {
    flex: 1;
    min-width: 0;
    padding: 14px 4px 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    justify-content: center;
  }
  .vn-name {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--vn-color);
    font-family: ${FONT_UI};
  }
  .vn-text {
    font-size: 15px;
    line-height: 1.55;
    color: rgba(255,245,235,0.95);
    font-family: ${FONT_UI};
  }
  .vn-choices {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 6px;
  }
  .vn-choice-btn {
    background: rgba(255,255,255,0.08);
    border: 1.5px solid var(--vn-color);
    border-radius: 8px;
    padding: 9px 14px;
    font-size: 13px;
    font-weight: 600;
    color: rgba(255,245,235,0.9);
    text-align: left;
    cursor: pointer;
    transition: background 0.14s;
    font-family: ${FONT_UI};
  }
  .vn-choice-btn:hover, .vn-choice-btn:active {
    background: rgba(255,255,255,0.15);
  }
`;

export function FieldDialogProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<PanelLine | null>(null);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hidePanel = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    setVisible(false);
  }, []);

  const showPanel = useCallback((line: PanelLine) => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    setCurrent(line);
    setVisible(true);

    const duration = line.duration ?? (line.choices ? 0 : 4200);
    if (duration > 0) {
      timerRef.current = window.setTimeout(() => setVisible(false), duration);
    }
  }, []);

  const handleAnimEnd = () => {
    if (!visible) setCurrent(null);
  };

  return (
    <FieldDialogContext.Provider value={{ showPanel, hidePanel }}>
      {children}
      {current ? (
        <VNPanel
          line={current}
          visible={visible}
          onClose={hidePanel}
          onAnimationEnd={handleAnimEnd}
        />
      ) : null}
    </FieldDialogContext.Provider>
  );
}

interface PanelProps {
  line: PanelLine;
  visible: boolean;
  onClose: () => void;
  onAnimationEnd: () => void;
}

function VNPanel({ line, visible, onClose, onAnimationEnd }: PanelProps) {
  const cfg = NPC_CONFIG[line.npc];
  const emo = line.emotion ?? "neutral";
  const hasChoices = Boolean(line.choices && line.choices.length > 0);
  const blocking = hasChoices || line.duration === 0;
  const [imgOk, setImgOk] = useState(true);

  useEffect(() => {
    setImgOk(true);
  }, [line.npc, line.emotion, line.text]);

  return (
    <>
      <style>{STYLES}</style>
      <div
        className={`vn-overlay${blocking ? " vn-blocking" : ""}`}
        onClick={hasChoices ? undefined : onClose}
        style={{ "--vn-color": cfg.color } as React.CSSProperties}
        role="presentation"
      >
        <div
          className={`vn-panel ${visible ? "vn-in" : "vn-out"}`}
          onClick={(e) => e.stopPropagation()}
          onAnimationEnd={onAnimationEnd}
          style={{ "--vn-color": cfg.color } as React.CSSProperties}
          role="dialog"
          aria-modal="true"
          aria-labelledby="vn-dialog-name"
        >
          <div className="vn-body">
            <div className="vn-name" id="vn-dialog-name">
              {cfg.name}
            </div>
            <div className="vn-text">{line.text}</div>

            {hasChoices ? (
              <div className="vn-choices">
                {line.choices!.map((ch, i) => (
                  <button
                    key={i}
                    type="button"
                    className="vn-choice-btn"
                    onClick={() => {
                      ch.onSelect();
                      onClose();
                    }}
                  >
                    {ch.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="vn-avatar">
            {imgOk ? (
              <img
                src={avatarSrc(line.npc, emo)}
                alt=""
                onError={() => setImgOk(false)}
              />
            ) : (
              <div className="vn-avatar-emoji" aria-hidden>
                {cfg.emoji}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

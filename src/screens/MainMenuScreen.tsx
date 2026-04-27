/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { motion } from "motion/react";
export interface MainMenuScreenProps {
  hasSave: boolean;
  onContinue: () => void;
  onNewGame: () => void;
  onOpenSettings: () => void;
  devMode: boolean;
  onFullReset?: () => void;
  /** Минут с последнего сохранения; null — бейдж не показывать */
  saveAgeMinutes: number | null;
  playerLevel: number;
  currentRoomName: string;
  energy: number;
  maxEnergy: number;
}

export default function MainMenuScreen({
  hasSave,
  onContinue,
  onNewGame,
  onOpenSettings,
  devMode,
  onFullReset,
  saveAgeMinutes,
  playerLevel,
  currentRoomName,
  energy,
  maxEnergy,
}: MainMenuScreenProps) {
  return (
    <div className="ds-screen flex flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col px-3 pb-8 pt-6">
        <div
          className="mb-4 rounded-[14px] px-4 py-4"
          style={{ background: "var(--c-peach)", border: "1px solid var(--c-peach2)" }}
        >
          <div className="flex flex-col items-center text-center">
            <div
              className="mb-3 flex h-11 w-11 items-center justify-center rounded-[14px] text-2xl leading-none"
              style={{
                background: "var(--c-cream)",
                border: "1px solid var(--c-peach2)",
              }}
              aria-hidden
            >
              ☕
            </div>
            <h1 className="mb-0.5 text-[15px] font-medium leading-tight" style={{ color: "var(--c-browndark)" }}>
              Кафе Лены
            </h1>
            <p className="text-[10px] font-medium" style={{ color: "var(--c-brown)" }}>
              Уровень {playerLevel} · {currentRoomName}
            </p>
            {hasSave && saveAgeMinutes != null ? (
              <div
                className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[9px] font-medium"
                style={{
                  background: "var(--c-cream)",
                  border: "1px solid var(--c-peach2)",
                  color: "var(--c-greendark)",
                }}
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--c-green)" }} />
                Сохранено {saveAgeMinutes < 1 ? "только что" : `${saveAgeMinutes} мин назад`}
              </div>
            ) : null}
          </div>
        </div>

        <nav className="flex w-full flex-col gap-3" aria-label="Основное меню">
          {hasSave ? (
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={onContinue}
              className="ds-btn-primary flex w-full items-stretch justify-between gap-3 text-left"
            >
              <span className="flex flex-col justify-center">
                <span>Продолжить</span>
                <span className="mt-0.5 text-[10px] font-normal opacity-90">
                  ⚡ {energy}/{maxEnergy}
                </span>
              </span>
              <span className="flex items-center text-lg opacity-90" aria-hidden>
                →
              </span>
            </motion.button>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={onNewGame}
              className="ds-btn-secondary w-full"
            >
              {hasSave ? "Новая игра" : "Играть"}
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={onOpenSettings}
              className="ds-btn-secondary w-full"
            >
              Настройки
            </motion.button>
          </div>

          {devMode && onFullReset ? (
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={onFullReset}
              className="w-full rounded-[var(--ds-radius-btn)] border px-3 py-2.5 text-center text-[12px] font-medium"
              style={{
                borderColor: "var(--c-rose)",
                color: "var(--c-rosedark)",
                background: "var(--c-cream)",
              }}
            >
              Сбросить всё
            </motion.button>
          ) : null}
        </nav>
      </div>
    </div>
  );
}

/**
 * Стартовый экран «Кафе Лены»: типографика Playfair Display + Lora, портрет Лены (public/avatars/lena_neutral.png).
 */

import React from "react";
import { useUiScaling } from "../hooks/useUiScaling";

export interface StartScreenSaveInfo {
  level: number;
  zoneName: string;
  energy: number;
  maxEnergy: number;
  hasSave: boolean;
}

export interface StartScreenProps {
  saveInfo: StartScreenSaveInfo;
  /** Минут с последнего сохранения; показывается при hasSave */
  saveAgeMinutes: number | null;
  onContinue: () => void;
  onNewGame: () => void;
  onSettings: () => void;
  devMode?: boolean;
  onFullReset?: () => void;
}

export default function StartScreen({
  saveInfo,
  saveAgeMinutes,
  onContinue,
  onNewGame,
  onSettings,
  devMode,
  onFullReset,
}: StartScreenProps) {
  const saveAgeText =
    saveInfo.hasSave && saveAgeMinutes != null
      ? saveAgeMinutes < 1
        ? "Сохранено только что"
        : `Сохранено ${Math.round(saveAgeMinutes)} мин назад`
      : null;

  const { containerRef, uiScale, scalingStyle } = useUiScaling();

  return (
    <div className="ss-root">
      <div className="ss-bg" aria-hidden />
      <div className="ss-deco-1" aria-hidden />
      <div className="ss-deco-2" aria-hidden />
      <div className="ss-topline" aria-hidden />

      <div
        ref={containerRef}
        className="ss-screen"
        style={scalingStyle}
      >
        <div className="ss-intro-stack">
          <div className="ss-portrait">
            <img
              src={`${import.meta.env.BASE_URL}avatars/lena_neutral.png`}
              alt="Лена"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
          <div className="ss-header">
            <div className="ss-sup">добро пожаловать</div>
            <div className="ss-ornament">✦</div>
            <div className="ss-title">
              Кафе
              <br />
              <em>Лены</em>
            </div>
            <div className="ss-tagline">История одного маленького места</div>
          </div>
        </div>

        <div className="ss-actions-stack">
          <div className="ss-buttons">
            {saveInfo.hasSave ? (
              <button type="button" className="ss-btn ss-btn-primary" onClick={onContinue}>
                Продолжить →
                <span className="ss-btn-sub">
                  Уровень {saveInfo.level} · {saveInfo.zoneName} · {saveInfo.energy}/{saveInfo.maxEnergy} ⚡
                </span>
                {saveAgeText ? <span className="ss-btn-save-age">{saveAgeText}</span> : null}
              </button>
            ) : (
              <button type="button" className="ss-btn ss-btn-primary" onClick={onNewGame}>
                Начать игру →
              </button>
            )}
            <div className={`ss-btn-row${!saveInfo.hasSave ? " ss-btn-row--solo" : ""}`}>
              {saveInfo.hasSave ? (
                <button type="button" className="ss-btn ss-btn-secondary" onClick={onNewGame}>
                  Новая игра
                </button>
              ) : null}
              <button type="button" className="ss-btn ss-btn-secondary" onClick={onSettings}>
                Настройки
              </button>
            </div>
          </div>

          {devMode && onFullReset ? (
            <button type="button" className="ss-btn ss-btn-danger" onClick={onFullReset}>
              Сбросить всё (DEV)
            </button>
          ) : null}

          <div className="ss-footer">Кафе Лены · 2026</div>
        </div>
      </div>
    </div>
  );
}
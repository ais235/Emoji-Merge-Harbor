/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import StartScreen from "./StartScreen";

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
    <StartScreen
      saveInfo={{
        level: playerLevel,
        zoneName: currentRoomName,
        energy,
        maxEnergy,
        hasSave,
      }}
      saveAgeMinutes={saveAgeMinutes}
      onContinue={onContinue}
      onNewGame={onNewGame}
      onSettings={onOpenSettings}
      devMode={devMode}
      onFullReset={onFullReset}
    />
  );
}

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
}

function MenuButton({
  children,
  onClick,
  variant = "secondary",
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "primary" | "secondary" | "danger" | "outline";
  disabled?: boolean;
}) {
  const styles =
    variant === "primary"
      ? "bg-blue-500 text-white shadow-md shadow-blue-200 active:bg-blue-600"
      : variant === "danger"
        ? "border-2 border-red-300 bg-red-50 text-red-800 active:bg-red-100"
        : variant === "outline"
          ? "border-2 border-blue-400 bg-white text-blue-700 active:bg-blue-50"
          : "border-2 border-gray-200 bg-white text-gray-900 active:bg-gray-50";
  return (
    <motion.button
      type="button"
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      disabled={disabled}
      onClick={onClick}
      className={`w-full max-w-sm rounded-2xl py-4 text-base font-black uppercase tracking-wide ${styles} ${
        disabled ? "cursor-not-allowed opacity-45" : ""
      }`}
    >
      {children}
    </motion.button>
  );
}

export default function MainMenuScreen({
  hasSave,
  onContinue,
  onNewGame,
  onOpenSettings,
  devMode,
  onFullReset,
}: MainMenuScreenProps) {
  return (
    <div className="mx-auto flex h-[100dvh] w-full max-w-[400px] flex-col overflow-hidden bg-[#E8EDF2] font-sans select-none">
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 pb-8">
        <h1 className="mb-1 text-center text-2xl font-black tracking-tight text-gray-900">
          Кафе Лены
        </h1>
        <p className="mb-8 text-center text-sm text-gray-500">Главное меню</p>

        <nav
          className="flex w-full max-w-sm flex-col gap-3"
          aria-label="Основное меню"
        >
          {hasSave ? (
            <MenuButton variant="primary" onClick={onContinue}>
              Продолжить
            </MenuButton>
          ) : null}

          <MenuButton variant={hasSave ? "secondary" : "primary"} onClick={onNewGame}>
            Новая игра
          </MenuButton>

          <MenuButton onClick={onOpenSettings}>Настройки</MenuButton>

          {devMode && onFullReset ? (
            <MenuButton variant="danger" onClick={onFullReset}>
              Сбросить всё
            </MenuButton>
          ) : null}
        </nav>
      </div>
    </div>
  );
}

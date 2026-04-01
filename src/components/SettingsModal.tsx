/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { X } from "lucide-react";

export interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  devMode: boolean;
  onToggleDevMode: () => void;
  soundOn: boolean;
  onSoundOnChange: (on: boolean) => void;
}

export default function SettingsModal({
  open,
  onClose,
  devMode,
  onToggleDevMode,
  soundOn,
  onSoundOnChange,
}: SettingsModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <div className="w-full max-w-[340px] rounded-2xl border border-gray-100 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h2 id="settings-title" className="text-base font-black text-gray-900">
            Настройки
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 p-4">
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-3">
            <span className="text-sm font-bold text-gray-800">Звук</span>
            <button
              type="button"
              role="switch"
              aria-checked={soundOn}
              onClick={() => onSoundOnChange(!soundOn)}
              className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${
                soundOn ? "bg-blue-500" : "bg-gray-300"
              }`}
            >
              <span
                className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                  soundOn ? "left-7" : "left-1"
                }`}
              />
            </button>
          </label>

          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-3">
            <div>
              <span className="text-sm font-bold text-amber-950">DEV MODE</span>
              <p className="text-[10px] text-amber-900/80">Режим разработчика</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={devMode}
              onClick={onToggleDevMode}
              className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${
                devMode ? "bg-amber-500" : "bg-gray-300"
              }`}
            >
              <span
                className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                  devMode ? "left-7" : "left-1"
                }`}
              />
            </button>
          </label>
        </div>
        <div className="border-t border-gray-100 p-4 pt-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-gray-900 py-3 text-sm font-bold text-white shadow-sm active:bg-gray-800"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}

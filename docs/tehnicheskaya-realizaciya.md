# Техническая реализация

## Стек

- **React 19**, **TypeScript**
- **Vite** — сборка и дев-сервер
- **Tailwind CSS** (v4) — утилитарные стили
- **motion** (`motion/react`) — анимации отдельных UI-элементов (заказы, полоска XP и др.)
- **lucide-react** — иконки

Отдельного роутера нет: текущий экран — состояние `currentScreen` в корневом компоненте.

---

## Структура проекта (логическая)

| Путь | Назначение |
|------|------------|
| `src/main.tsx` | Точка входа, монтирование `App` |
| `src/App.tsx` | Оркестрация экранов, сохранение игры, хендлеры поля/заказов/покупок/квестов, оверлеи |
| `src/types.ts` | Типы: `GameState`, `ProgressionState`, `Order`, `Upgrade`, цепочки предметов `ITEM_CHAINS` |
| `src/progressionManager.ts` | `ProgressionManager` (XP, уровни, монеты, покупка улучшений, агрегация бонусов), `EconomyManager` (расчёт наград заказа) |
| `src/progressionData.ts` | Массив `LEVELS` и каталог `UPGRADES` |
| `src/dailyQuests.ts` | Модель квестов, загрузка/сохранение, нормализация по дате и неделе, `applyQuestProgress`, клейм-хелперы |
| `src/story/storyData.ts` | Массив `STORY_BEATS`, условия и ветки |
| `src/story/StoryEngine.ts` | Выбор следующего бита, проверка условий, маппинг `chair` → `chair_fix` |
| `src/story/roomData.ts` | Визуалы комнат (слои, фон) |
| `src/screens/*` | `MainMenuScreen`, `CafeHubScreen`, `RoomScreen`, `GameScreen`, `DailyScreen`, `CollectionScreen` |
| `src/utils/fieldZones.ts` | Зоны раскрытия поля и очереди открытия ящиков |
| `src/utils/mergeFieldProgress.ts` | Открытие ящиков по слияниям / заказам, бонусные находки |
| `src/reconstruction.ts` | Этапы «Реконструкции кафе» |
| `src/collection.ts` | Коллекция предметов и награды за полные цепочки |
| `scripts/smoke.ts` | Проверки игровой логики без UI (`npm test`) |
| `src/components/*` | `DialogModal`, `FieldDialogPanel`, `DailyBonusModal`, `OrderCard`, `CoinShopModal` |
| `src/utils/sounds.ts` | Программный звук через `AudioContext` |

---

## Два слоя состояния игры

Разделение сделано намеренно:

1. **`GameState`** (`types.ts`): сетка `grid`, энергия, заказы, флаг первого запуска. **Без** монет/уровня/XP.
2. **`ProgressionState`**: уровень, XP, монеты, `unlockedZones`, `purchasedUpgrades`,
   `reconstruction`, коллекция, `totalOrdersCompleted`, `maxSeenItemLevel`.

Все начисления монет в игре должны идти через **`ProgressionManager`** (или его же экземпляр в хендлере), чтобы не расходилось с бонусами и сохранением.

---

## Персистентность (`localStorage`)

| Ключ (константа в коде) | Содержимое |
|-------------------------|------------|
| `emoji_merge_harbor_state_v2` | `{ gameState, progState, ordersCompleted }` |
| `shownBeats` | JSON-массив id показанных сюжетных бит |
| `dailyQuests` | Состояние ежедневных/недельных квестов |
| `lastDailyBonus` | Timestamp последнего получения ежедневного бонуса |
| `dailyStreak` | Номер уже полученного дня стрика (1…7); сбрасывается при пропуске > 48 ч |
| `shownUpgradeHints` / `shownRoomHints` | Показанные подсказки Лены |
| `emoji_merge_harbor_music_on` | Настройка фоновой музыки |

Гидрация игры: разбор сохранённого JSON, при ошибке — `resetGame()`.

---

## Ключевая логика в `App.tsx`

- **`handleCellClick`**: выбор клетки, подбор ресурса, выдача с генератора; второй тап по такому же
  предмету — слияние (`canMergeGridPair`). Обмен местами — только перетаскиванием.
- **`applyGridPairInteraction`**: merge при одинаковых id и наличии следующей ступени в цепочке, иначе swap.
- **`handleCompleteOrder`**: всё считается заранее по текущему состоянию и только потом пишется в стейт —
  апдейтер `setState` обязан оставаться чистым (React вправе вызвать его повторно).
- **`handlePurchaseUpgrade`**: делегирование в `purchaseUpgrade`, обновление `maxEnergy` с учётом `INITIAL_ENERGY + energy_max`, квест `upgrade`.
- **`handleClaimDaily`**: монеты, энергия, запись кулдауна и стрика, закрытие модалки.
- **Квесты**: `dailyQuests` в `useState`, синхронизация с `localStorage` через `saveDailyQuests` в `useEffect`; клейм ежедневных/недельных наград через чистые функции из `dailyQuests.ts` и `addCoins`.

Сюжет: `useEffect` подставляет `currentBeat` через `StoryEngine.getNextBeat`, диалог — `DialogModal`.

---

## Экраны

- **CafeHubScreen**: зоны из `unlockedZones`, панель «Реконструкция», баннер заданий (`getHomeQuestSummary`).
- **RoomScreen**: `getRoomVisual(activeZone)`, список `UPGRADES` по зоне, покупка через колбэк в `App`.
- **GameScreen**: отрисовка сетки и заказов, колбэки без собственной бизнес-логики merge.
- **DailyScreen**: бонус, квесты, неделя; читает кулдаун бонуса из `localStorage` для таймера.

---

## Энергия

`ENERGY_REGEN_INTERVAL_MS` = 3 мин. Реген считается **от часов**, а не от тиков таймера
(`withEnergyRegenFromClock` в `App.tsx`): начисление происходит и пока вкладка закрыта, и когда
браузер тормозит фоновые интервалы. При загрузке сохранения применяется офлайн-начисление.

## Мета-улучшения

Каждый `effectType` в `Upgrade` обязан иметь потребителя в геймплее — это проверяет `npm test`:

| effectType | Где применяется |
|------------|-----------------|
| `visual` | слой интерьера в `RoomScreen` |
| `energy_max` | потолок энергии (`INITIAL_ENERGY + energy_max`) |
| `income_bonus` | множитель монет за заказ |
| `bonus_chance` | шанс удвоить монеты за заказ |
| `box_loot_chance` | бонусные монеты при открытии ящика |
| `free_spawn_chance` | шанс не потратить энергию на спавн |

## Анимации и звук

- **CSS**: классы на ячейках (`cell-merge-pop`, `cell-selected`, `cell-shake`), лет монет, вспышка level up, вход экрана `screen-entering`, искры в `RoomScreen` (`@keyframes sparkle` с CSS-переменными `--tx`/`--ty`).
- **Звук** (`utils/sounds.ts`): ленивая инициализация `AudioContext`, первый `pointerdown` на `window`
  вызывает `initAudio()` из `App`; осцилляторы для `merge`, `select`, `orderComplete`, `purchase`, `levelUp`.
- **`utils/playSfx.ts`**: пробует `public/sounds/<name>.mp3`, при отсутствии файла запоминает имя
  и дальше использует синтез (без повторных 404).
- **`utils/music.ts`**: фоновые треки из `public/music`, `preload="none"`, старт только после жеста игрока.

---

## Сборка и скрипты

Из `package.json`: `npm run dev` (Vite), `npm run build`, `npm run preview`.

---

## Проверки

- `npm run lint` — `tsc --noEmit` (включены `noUnusedLocals` / `noUnusedParameters`).
- `npm test` — `scripts/smoke.ts`: покрытие поля зонами, раскрытие зон, реализованность эффектов
  апгрейдов, достижимость этапов реконструкции, целостность цепочек.
- `npm run check` — то и другое.

## Известное ограничение: модальные окна и `AnimatePresence`

Оверлеи на весь экран рендерятся обычным условием + CSS-анимацией, а не через `AnimatePresence`:
exit-анимация не всегда завершалась, и узел оставался в DOM с `opacity: 0` и `pointer-events: auto`,
полностью блокируя нажатия по полю. Классы — `.modal-fade-in` / `.modal-pop-in` в `index.css`.

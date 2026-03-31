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
| `src/screens/*` | `HomeScreen`, `RoomScreen`, `GameScreen`, `DailyScreen` |
| `src/components/*` | `DialogModal`, `OnboardingOverlay`, `DailyBonusModal` |
| `src/utils/sounds.ts` | Программный звук через `AudioContext` |

---

## Два слоя состояния игры

Разделение сделано намеренно:

1. **`GameState`** (`types.ts`): сетка `grid`, энергия, заказы, флаг первого запуска. **Без** монет/уровня/XP.
2. **`ProgressionState`**: уровень, XP, монеты, `unlockedZones`, `purchasedUpgrades`.

Все начисления монет в игре должны идти через **`ProgressionManager`** (или его же экземпляр в хендлере), чтобы не расходилось с бонусами и сохранением.

---

## Персистентность (`localStorage`)

| Ключ (константа в коде) | Содержимое |
|-------------------------|------------|
| `emoji_merge_harbor_state_v2` | `{ gameState, progState, ordersCompleted }` |
| `shownBeats` | JSON-массив id показанных сюжетных бит |
| `dailyQuests` | Состояние ежедневных/недельных квестов |
| `lastDailyBonus` | Timestamp последнего получения ежедневного бонуса |
| `dailyStreak` | Номер дня стрика (1…7) для награды |

Гидрация игры: разбор сохранённого JSON, при ошибке — `resetGame()`.

---

## Ключевая логика в `App.tsx`

- **`handleCellClick`**: выбор / снятие выбора, merge при одинаковых id и наличии `nextItem` в цепочке, иначе swap. Обновление `GameState` и при merge — XP через `ProgressionManager.addXp`, опционально level up и квест `merge`.
- **`handleCompleteOrder`**: проверка наличия предмета, пересчёт монет с **income_bonus** и **bonus_chance**, `addXp`, обновление сетки и списка заказов, квесты `order` и `coins`.
- **`handlePurchaseUpgrade`**: делегирование в `purchaseUpgrade`, обновление `maxEnergy` с учётом `INITIAL_ENERGY + energy_max`, квест `upgrade`.
- **`handleClaimDaily`**: монеты, энергия, запись кулдауна и стрика, закрытие модалки.
- **Квесты**: `dailyQuests` в `useState`, синхронизация с `localStorage` через `saveDailyQuests` в `useEffect`; клейм ежедневных/недельных наград через чистые функции из `dailyQuests.ts` и `addCoins`.

Сюжет: `useEffect` подставляет `currentBeat` через `StoryEngine.getNextBeat`, диалог — `DialogModal`.

---

## Экраны

- **HomeScreen**: зоны из `unlockedZones`, баннер заданий (`getHomeQuestSummary`).
- **RoomScreen**: `getRoomVisual(activeZone)`, список `UPGRADES` по зоне, покупка через колбэк в `App`.
- **GameScreen**: отрисовка сетки и заказов, колбэки без собственной бизнес-логики merge.
- **DailyScreen**: бонус, квесты, неделя; читает кулдаун бонуса из `localStorage` для таймера.

---

## Анимации и звук

- **CSS**: классы на ячейках (`cell-merge-pop`, `cell-selected`, `cell-shake`), лет монет, вспышка level up, вход экрана `screen-entering`, искры в `RoomScreen` (`@keyframes sparkle` с CSS-переменными `--tx`/`--ty`).
- **Звук** (`utils/sounds.ts`): ленивая инициализация `AudioContext`, первый `pointerdown` на `window` вызывает `initAudio()` из `App`; осцилляторы для `merge`, `select`, `orderComplete`, `purchase`, `levelUp`.

Внешние аудиофайлы не используются.

---

## Сборка и скрипты

Из `package.json`: `npm run dev` (Vite), `npm run build`, `npm run lint` (`tsc --noEmit`).

---

## Зависимости, не относящиеся к клиентскому геймплею

В `package.json` присутствуют `@google/genai`, `express`, `dotenv` — для возможных серверных/интеграционных сценариев; **ядро игры в репозитории — клиентское SPA**.

# Ассеты комнат (`public/rooms/`)

Файлы из этой папки отдаются Vite как статика по URL с корня сайта: файл `public/rooms/hall-bg.png` → путь **`/rooms/hall-bg.png`**. Расширение любое (`.png`, `.webp`, `.jpg`…) — в коде указываете тот же путь, что и имя файла.

## Фоны комнат

Один файл на зону (по `zoneId` из `src/story/roomData.ts` и `src/types.ts`):

| Файл | Поле в `RoomVisual` |
|------|---------------------|
| `hall-bg.png` | `bgImage: "/rooms/hall-bg.png"` |
| `kitchen-bg.png` | `bgImage: "/rooms/kitchen-bg.png"` |
| `bedroom-bg.png` | … и т.д. |

Рекомендуемые имена: **`<zoneId>-bg.<ext>`**, например `hall-bg.png`.

Обычно для фонов удобен **PNG**; при желании можно **WebP** или **JPG** — главное, чтобы путь в `bgImage` совпадал с реальным именем файла.

## Спрайты предметов

Удобная схема — папка на зону + имя файла = **`upgradeId`** из `progressionData.ts`:

```text
public/rooms/hall/chair_fix.png
public/rooms/hall/table_fix.png
```

В `src/story/roomData.ts` путь к спрайту **прописывается автоматически**: функция `roomLayer` задаёт  
`imageSrc = /rooms/<zoneId>/<upgradeId>.png`. Достаточно положить файл с таким именем в `public/rooms/<zoneId>/` и обновить страницу (отдельно дописывать `imageSrc` не нужно). Другой URL можно указать полем **`imageSrc`** внутри объекта, переданного в `roomLayer` (оно перекрывает значение по умолчанию).

Альтернатива без подпапок: **`/rooms/hall-chair_fix.png`** — тогда в коде нужно явно передать `imageSrc`.

Имя файла предмета = **`upgradeId` + расширение** (ниже полный список). Папка = **`public/rooms/<zoneId>/`**.

### Координаты и имена файлов

**Позиция и размер (`x`, `y`, `size`) живут только в `roomData.ts`** (и в редакторе, пока вы не скопировали блок в файл). Они **никак не влияют** на имя картинки: файл всегда называется по **`upgradeId`**, а не по координатам.

### Почему `table_fix`, а шторы — `hall_window`

Имена заданы один раз в **`progressionData.ts`** как id улучшения — это исторический микс стилей:

- **`chair_fix`**, **`table_fix`** — ранние апгрейды с суффиксом `_fix` (связаны с сюжетом починки зала), без префикса `hall_`.
- **`hall_window`**, **`hall_light`** и др. — апгрейды с префиксом зоны **`hall_`**.

В игре важно одно: **имя файла спрайта = этот id + `.png`** (или другое расширение), а в слое в `roomData` прописан **`imageSrc`**. Пока нет `imageSrc`, на сцене остаётся эмодзи, даже если PNG уже лежит в `public/rooms/`.

## Каталог предметов по зонам

### Основной зал (`hall`)

| Предмет | Файл | `imageSrc` |
|---------|------|------------|
| Стул | `public/rooms/hall/chair_fix.png` | `/rooms/hall/chair_fix.png` |
| Стол | `public/rooms/hall/table_fix.png` | `/rooms/hall/table_fix.png` |
| Шторы | `public/rooms/hall/hall_window.png` | `/rooms/hall/hall_window.png` |
| Свет | `public/rooms/hall/hall_light.png` | `/rooms/hall/hall_light.png` |
| Картина | `public/rooms/hall/hall_picture.png` | `/rooms/hall/hall_picture.png` |
| Ковёр | `public/rooms/hall/hall_rug.png` | `/rooms/hall/hall_rug.png` |
| Ваза | `public/rooms/hall/hall_vase.png` | `/rooms/hall/hall_vase.png` |
| Часы | `public/rooms/hall/hall_clock.png` | `/rooms/hall/hall_clock.png` |

Фон: `public/rooms/hall-bg.png`

### Кухня (`kitchen`)

| Предмет | Файл | `imageSrc` |
|---------|------|------------|
| Плита | `public/rooms/kitchen/kitchen_stove.png` | `/rooms/kitchen/kitchen_stove.png` |
| Полки | `public/rooms/kitchen/kitchen_shelves.png` | `/rooms/kitchen/kitchen_shelves.png` |
| Холодильник | `public/rooms/kitchen/kitchen_fridge.png` | `/rooms/kitchen/kitchen_fridge.png` |
| Посуда | `public/rooms/kitchen/kitchen_dishes.png` | `/rooms/kitchen/kitchen_dishes.png` |
| Барный стул | `public/rooms/kitchen/kitchen_bar_stool.png` | `/rooms/kitchen/kitchen_bar_stool.png` |
| Шторы | `public/rooms/kitchen/kitchen_curtains.png` | `/rooms/kitchen/kitchen_curtains.png` |
| Вытяжка | `public/rooms/kitchen/kitchen_hood.png` | `/rooms/kitchen/kitchen_hood.png` |

Фон: `public/rooms/kitchen-bg.png`

### Спальня (`bedroom`)

| Предмет | Файл | `imageSrc` |
|---------|------|------------|
| Кровать | `public/rooms/bedroom/bedroom_bed.png` | `/rooms/bedroom/bedroom_bed.png` |
| Шкаф | `public/rooms/bedroom/bedroom_wardrobe.png` | `/rooms/bedroom/bedroom_wardrobe.png` |
| Лампа | `public/rooms/bedroom/bedroom_lamp.png` | `/rooms/bedroom/bedroom_lamp.png` |
| Зеркало | `public/rooms/bedroom/bedroom_mirror.png` | `/rooms/bedroom/bedroom_mirror.png` |
| Ковёр | `public/rooms/bedroom/bedroom_rug.png` | `/rooms/bedroom/bedroom_rug.png` |
| Тумба | `public/rooms/bedroom/bedroom_nightstand.png` | `/rooms/bedroom/bedroom_nightstand.png` |
| Шторы | `public/rooms/bedroom/bedroom_curtains.png` | `/rooms/bedroom/bedroom_curtains.png` |
| Картина | `public/rooms/bedroom/bedroom_painting.png` | `/rooms/bedroom/bedroom_painting.png` |

Фон: `public/rooms/bedroom-bg.png`

### Ванная (`bathroom`)

| Предмет | Файл | `imageSrc` |
|---------|------|------------|
| Ванна | `public/rooms/bathroom/bathroom_bath.png` | `/rooms/bathroom/bathroom_bath.png` |
| Раковина | `public/rooms/bathroom/bathroom_sink.png` | `/rooms/bathroom/bathroom_sink.png` |
| Полотенца | `public/rooms/bathroom/bathroom_towels.png` | `/rooms/bathroom/bathroom_towels.png` |
| Зеркало | `public/rooms/bathroom/bathroom_mirror.png` | `/rooms/bathroom/bathroom_mirror.png` |
| Полка | `public/rooms/bathroom/bathroom_rack.png` | `/rooms/bathroom/bathroom_rack.png` |
| Коврик | `public/rooms/bathroom/bathroom_mat.png` | `/rooms/bathroom/bathroom_mat.png` |
| Растения | `public/rooms/bathroom/bathroom_plants.png` | `/rooms/bathroom/bathroom_plants.png` |
| Свет | `public/rooms/bathroom/bathroom_light.png` | `/rooms/bathroom/bathroom_light.png` |

Фон: `public/rooms/bathroom-bg.png`

### Терраса (`terrace`)

| Предмет | Файл | `imageSrc` |
|---------|------|------------|
| Зонт | `public/rooms/terrace/terrace_umbrella.png` | `/rooms/terrace/terrace_umbrella.png` |
| Растения | `public/rooms/terrace/terrace_plants.png` | `/rooms/terrace/terrace_plants.png` |
| Перила | `public/rooms/terrace/terrace_railings.png` | `/rooms/terrace/terrace_railings.png` |
| Мебель | `public/rooms/terrace/terrace_furniture.png` | `/rooms/terrace/terrace_furniture.png` |
| Гирлянды | `public/rooms/terrace/terrace_garlands.png` | `/rooms/terrace/terrace_garlands.png` |
| Кормушка | `public/rooms/terrace/terrace_feeder.png` | `/rooms/terrace/terrace_feeder.png` |
| Фонарь | `public/rooms/terrace/terrace_lantern.png` | `/rooms/terrace/terrace_lantern.png` |
| Настил | `public/rooms/terrace/terrace_floor.png` | `/rooms/terrace/terrace_floor.png` |

Фон: `public/rooms/terrace-bg.png`

### Офис (`office`)

| Предмет | Файл | `imageSrc` |
|---------|------|------------|
| Стол | `public/rooms/office/office_desk.png` | `/rooms/office/office_desk.png` |
| Книги | `public/rooms/office/office_books.png` | `/rooms/office/office_books.png` |
| Компьютер | `public/rooms/office/office_computer.png` | `/rooms/office/office_computer.png` |
| Кресло | `public/rooms/office/office_chair.png` | `/rooms/office/office_chair.png` |
| Лампа | `public/rooms/office/office_lamp.png` | `/rooms/office/office_lamp.png` |
| Стеллаж | `public/rooms/office/office_shelf.png` | `/rooms/office/office_shelf.png` |
| Постер | `public/rooms/office/office_art.png` | `/rooms/office/office_art.png` |
| Часы | `public/rooms/office/office_clock.png` | `/rooms/office/office_clock.png` |

Фон: `public/rooms/office-bg.png`

### Лаунж (`lounge`)

| Предмет | Файл | `imageSrc` |
|---------|------|------------|
| Бар | `public/rooms/lounge/lounge_bar.png` | `/rooms/lounge/lounge_bar.png` |
| Бутылки | `public/rooms/lounge/lounge_bottles.png` | `/rooms/lounge/lounge_bottles.png` |
| Музыка | `public/rooms/lounge/lounge_music.png` | `/rooms/lounge/lounge_music.png` |
| Диван | `public/rooms/lounge/lounge_sofa.png` | `/rooms/lounge/lounge_sofa.png` |
| Свет | `public/rooms/lounge/lounge_lights.png` | `/rooms/lounge/lounge_lights.png` |
| Табуреты | `public/rooms/lounge/lounge_stools.png` | `/rooms/lounge/lounge_stools.png` |
| Вывеска | `public/rooms/lounge/lounge_sign.png` | `/rooms/lounge/lounge_sign.png` |
| Столик | `public/rooms/lounge/lounge_table.png` | `/rooms/lounge/lounge_table.png` |

Фон: `public/rooms/lounge-bg.png`

### Тайная комната (`secret`)

| Предмет | Файл | `imageSrc` |
|---------|------|------------|
| Сейф | `public/rooms/secret/secret_safe.png` | `/rooms/secret/secret_safe.png` |
| Документы | `public/rooms/secret/secret_documents.png` | `/rooms/secret/secret_documents.png` |
| Карта | `public/rooms/secret/secret_map.png` | `/rooms/secret/secret_map.png` |
| Часы | `public/rooms/secret/secret_clock.png` | `/rooms/secret/secret_clock.png` |
| Странное | `public/rooms/secret/secret_curios.png` | `/rooms/secret/secret_curios.png` |
| Лампа | `public/rooms/secret/secret_desk_lamp.png` | `/rooms/secret/secret_desk_lamp.png` |
| Сундук | `public/rooms/secret/secret_chest.png` | `/rooms/secret/secret_chest.png` |
| Гобелен | `public/rooms/secret/secret_tapestry.png` | `/rooms/secret/secret_tapestry.png` |

Фон: `public/rooms/secret-bg.png`

### Сад (`garden`)

| Предмет | Файл | `imageSrc` |
|---------|------|------------|
| Деревья | `public/rooms/garden/garden_trees.png` | `/rooms/garden/garden_trees.png` |
| Дорожки | `public/rooms/garden/garden_paths.png` | `/rooms/garden/garden_paths.png` |
| Фонтан | `public/rooms/garden/garden_fountain.png` | `/rooms/garden/garden_fountain.png` |
| Скамейка | `public/rooms/garden/garden_bench.png` | `/rooms/garden/garden_bench.png` |
| Цветы | `public/rooms/garden/garden_flowers.png` | `/rooms/garden/garden_flowers.png` |
| Калитка | `public/rooms/garden/garden_gate.png` | `/rooms/garden/garden_gate.png` |
| Статуя | `public/rooms/garden/garden_statue.png` | `/rooms/garden/garden_statue.png` |
| Пруд | `public/rooms/garden/garden_pond.png` | `/rooms/garden/garden_pond.png` |

Фон: `public/rooms/garden-bg.png`

Путь **`imageSrc`** для слоя уже задаётся в коде через `roomLayer`; в таблице он показан для справки. Достаточно добавить файл по пути из колонки «Файл». Раскладку (`x`, `y`, `size`) по-прежнему можно править в «Редактор раскладки» и вставлять блок в `roomData.ts`.

## Когда виден редактор в UI

В режиме разработки (`npm run dev`) на экране комнаты есть кнопка «Редактор раскладки». В production-сборке тот же режим можно включить, открыв игру с параметром **`?roomEditor=1`** в адресной строке.

**Координаты и размеры после правок не живут сами по себе:** кнопка копирования только кладёт текст в буфер. Нужно вставить его в `src/story/roomData.ts` (заменить весь объект зоны в `ROOM_VISUALS`) и **сохранить файл (Ctrl+S)** — иначе F5 снова загрузит старые значения из кода.

## Подсказка по размеру

Блок сцены комнаты в UI сейчас **фиксированной высоты ~220px**, ширина — как у колонки приложения (до ~360px). Картинку фона обычно делают с запасом и под то же соотношение сторон, что и макет, чтобы `object-cover` не «съедал» важные края.

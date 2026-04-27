# Аватары полевых диалогов (`FieldDialogPanel`)

URL в игре: `/avatars/{npc}_{emotion}.png`, где `npc` из кода — **`lena`** или **`tom`**.

## Текущие файлы в репозитории

**Лена (`lena`):**

| Файл | Эмоция в коде (`emotion`) |
|------|---------------------------|
| `lena_neutral.png` | `neutral` (по умолчанию) |
| `lena_happy.png` | `happy` |
| `lena_worried.png` | `worried` |
| `lena_surprised.png` | `surprised` |

**Том (`tom`):**

| Файл | Эмоция в коде (`emotion`) |
|------|---------------------------|
| `tom_neutral.png` | `neutral` |
| `tom_proud.png` | `proud` |
| `tom_sheepish.png` | `sheepish` |

Допустимые эмоции в типе `NPCEmotion`: `neutral` | `happy` | `worried` | `surprised` | `proud` | `sheepish`. Если для пары npc+эмоции файла ещё нет, показывается эмодзи (fallback в компоненте).

Рекомендуемый кадр: бюст, достаточное разрешение под **object-fit: cover**, **object-position: top**.

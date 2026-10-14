import type { GridCell } from "../types";
import { isBlockedCellType } from "../types";

function isSpawnableEmptyCell(cell: GridCell): boolean {
  return !isBlockedCellType(cell.cellType) && cell.cellType === "empty" && cell.item === null;
}

/**
 * Пустая клетка для выдачи от генератора:
 * выбираем только ближайшее «кольцо» вокруг генератора (Chebyshev distance),
 * а внутри кольца — случайную клетку.
 */
export function pickEmptyCellForGeneratorSpawn(
  grid: GridCell[],
  generatorIndex: number,
  width: number,
  height: number
): number | null {
  const len = width * height;
  if (!Number.isInteger(generatorIndex) || generatorIndex < 0 || generatorIndex >= len) return null;

  const gx = generatorIndex % width;
  const gy = Math.floor(generatorIndex / width);

  let bestRing = Number.POSITIVE_INFINITY;
  const bestCells: number[] = [];

  for (let i = 0; i < grid.length; i++) {
    const cell = grid[i];
    if (!isSpawnableEmptyCell(cell)) continue;

    const x = i % width;
    const y = Math.floor(i / width);
    const ring = Math.max(Math.abs(x - gx), Math.abs(y - gy));
    if (ring < bestRing) {
      bestRing = ring;
      bestCells.length = 0;
      bestCells.push(i);
    } else if (ring === bestRing) {
      bestCells.push(i);
    }
  }

  if (bestCells.length === 0) return null;
  return bestCells[Math.floor(Math.random() * bestCells.length)]!;
}

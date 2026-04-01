import type { GridCell } from "../types";
import { isObstacleCellState } from "../types";

/**
 * Соседи по горизонтали/вертикали в плоском массиве (строка за строкой, row-major).
 * Порядок: вверх, влево, вправо, вниз. Без переноса через край строки.
 */
export function getNeighborIndices(index: number, width: number, height: number): number[] {
  if (width < 1 || height < 1 || !Number.isInteger(width) || !Number.isInteger(height)) {
    return [];
  }
  const len = width * height;
  if (!Number.isInteger(index) || index < 0 || index >= len) return [];

  const row = Math.floor(index / width);
  const col = index % width;
  const neighbors: number[] = [];

  if (row > 0) neighbors.push(index - width);
  if (col > 0) neighbors.push(index - 1);
  if (col < width - 1) neighbors.push(index + 1);
  if (row < height - 1) neighbors.push(index + width);

  return neighbors;
}

/**
 * Пустая клетка для выдачи от генератора: сначала случайный сосед, иначе любая свободная.
 */
export function pickEmptyCellForGeneratorSpawn(
  grid: GridCell[],
  generatorIndex: number,
  width: number,
  height: number
): number | null {
  const neighbors = getNeighborIndices(generatorIndex, width, height);
  const emptyNear = neighbors.filter(
    (i) => !isObstacleCellState(grid[i].cellState) && grid[i].item === null
  );
  if (emptyNear.length > 0) {
    return emptyNear[Math.floor(Math.random() * emptyNear.length)];
  }
  const allEmpty: number[] = [];
  for (let i = 0; i < grid.length; i++) {
    if (!isObstacleCellState(grid[i].cellState) && grid[i].item === null) {
      allEmpty.push(i);
    }
  }
  if (allEmpty.length === 0) return null;
  return allEmpty[Math.floor(Math.random() * allEmpty.length)];
}

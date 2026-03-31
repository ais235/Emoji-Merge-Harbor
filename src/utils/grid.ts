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

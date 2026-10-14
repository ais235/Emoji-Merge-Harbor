/**
 * Нарезка спрайт-листов на отдельные иконки.
 *
 * Генерация не держит жёсткую сетку: в рядах бывает разное число элементов, попадаются
 * лишние и дубли, сверху висит вотермарка. Поэтому иконки не режутся по сетке, а находятся
 * по картинке: сначала горизонтальные полосы (ряды), внутри полосы — колонки по разрывам.
 *
 * Запуск:
 *   npm run icons            — нарезать всё из art/sheets
 *   npm run icons -- --debug — плюс art/debug/<лист>.png с пронумерованными рамками
 *   npm run icons -- hall_tea — только один лист
 */
import { readdirSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { ITEM_CHAINS, itemIsMergeable } from "../src/types";
import { ZONE_TO_GENERATOR_ID, ZONE_TO_MERGE_CHAIN_ID } from "../src/roomMergeCatalog";

const SHEETS = "art/sheets";
const OUT = "public/items";
const DEBUG_DIR = "art/debug";

/** Клетка поля рендерится максимум в 58 CSS-px; ×3 под retina плюс запас. */
const ICON_PX = 192;
/** Насколько далеко цвет должен уйти от фона, чтобы считаться содержимым (сумма по RGB). */
const BG_SOLID = 34;
/** Ниже этого расстояния — чистый фон. Между порогами альфа растёт плавно: мягкие края и тени. */
const BG_CLEAR = 12;
/**
 * Разрыв в пикселях, разделяющий две соседние иконки внутри ряда.
 * Подбирается автоматически: от большого к малому, пока число найденных сегментов
 * не совпадёт с ожидаемым. Иконки на листах стоят с разными интервалами, и одного
 * значения на все листы не существует.
 */
const COL_GAP_CANDIDATES = [40, 34, 28, 24, 20, 16, 12, 10, 8];
/** Полоса тоньше этого — мусор (вотермарка, артефакты). */
const MIN_BAND_H = 40;
/** Сегмент мельче этой доли площади листа — мусор. */
const MIN_SEGMENT_AREA = 0.0015;
/** Всё, что целиком выше этой доли высоты, отбрасывается: там висит «Made with AI». */
const HEADER_ZONE = 0.14;

/**
 * Правки под конкретные листы: какие найденные сегменты пропустить (индексы с нуля,
 * в порядке чтения). Нужно там, где генерация нарисовала лишний или дублирующий элемент.
 */
const SKIP_SEGMENTS: Record<string, number[]> = {
  // Ряд 1 заканчивается лишним стулом — генератор нарисован дважды.
  terrace_plants: [4],
};

/** Листы с фиксированным составом, которых нет в ITEM_CHAINS. */
const EXTRA_SHEETS: Record<string, string[]> = {
  resources: ["coin_item", "energy_item"],
  /**
   * Замены после аудита на 40 px: предметы, которые сливались с соседями по полю.
   * Порядок чтения — 2×2: слева направо, сверху вниз.
   */
  fixes: ["bd5", "kt5", "gn6", "gen_office"],
};

const chainToGenerator: Record<string, string> = {};
for (const [zone, chainId] of Object.entries(ZONE_TO_MERGE_CHAIN_ID)) {
  const gen = ZONE_TO_GENERATOR_ID[zone as keyof typeof ZONE_TO_GENERATOR_ID];
  if (gen) chainToGenerator[chainId] = gen;
}

/** Ожидаемый порядок ячеек: предметы 1→7, затем генератор цепочки. */
function expectedIds(sheetId: string): string[] {
  if (EXTRA_SHEETS[sheetId]) return EXTRA_SHEETS[sheetId];
  const chain = ITEM_CHAINS[sheetId];
  if (!chain) return [];
  const items = chain.items
    .filter(itemIsMergeable)
    .sort((a, b) => a.level - b.level)
    .map((i) => i.id);
  const gen = chainToGenerator[sheetId];
  return gen ? [...items, gen] : items;
}

type Box = { x0: number; y0: number; x1: number; y1: number };

/** Цвет фона — медиана по четырём углам. */
function backgroundColor(data: Buffer, w: number, h: number): [number, number, number] {
  const at = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    return [data[i], data[i + 1], data[i + 2]] as [number, number, number];
  };
  const corners = [at(4, 4), at(w - 5, 4), at(4, h - 5), at(w - 5, h - 5)];
  const median = (k: 0 | 1 | 2) => corners.map((c) => c[k]).sort((a, b) => a - b)[1];
  return [median(0), median(1), median(2)];
}

/** Ряды: непрерывные полосы по вертикали, где есть содержимое. */
function rowBands(mask: Uint8Array, w: number, h: number): [number, number][] {
  const bands: [number, number][] = [];
  let start: number | null = null;
  for (let y = 0; y < h; y++) {
    let count = 0;
    for (let x = 0; x < w; x++) if (mask[y * w + x]) count++;
    const filled = count > 2;
    if (filled && start === null) start = y;
    if (!filled && start !== null) {
      bands.push([start, y - 1]);
      start = null;
    }
  }
  if (start !== null) bands.push([start, h - 1]);
  return bands;
}

/** Колонки внутри ряда: группы, разделённые пустотой шире minGap. */
function columnGroups(mask: Uint8Array, w: number, y0: number, y1: number, minGap: number): [number, number][] {
  const filled: boolean[] = [];
  for (let x = 0; x < w; x++) {
    let count = 0;
    for (let y = y0; y <= y1; y++) if (mask[y * w + x]) count++;
    filled.push(count > 0);
  }
  const groups: [number, number][] = [];
  let start: number | null = null;
  let gap = 0;
  for (let x = 0; x < w; x++) {
    if (filled[x]) {
      if (start === null) start = x;
      gap = 0;
    } else if (start !== null) {
      gap++;
      if (gap >= minGap) {
        groups.push([start, x - gap]);
        start = null;
        gap = 0;
      }
    }
  }
  if (start !== null) groups.push([start, w - 1]);
  return groups;
}

/** Точный bbox сегмента внутри колонки ряда. */
function tightBox(mask: Uint8Array, w: number, band: [number, number], col: [number, number]): Box | null {
  let x0 = col[1], x1 = col[0], y0 = band[1], y1 = band[0];
  let any = false;
  for (let y = band[0]; y <= band[1]; y++) {
    for (let x = col[0]; x <= col[1]; x++) {
      if (!mask[y * w + x]) continue;
      any = true;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return any ? { x0, y0, x1, y1 } : null;
}


/**
 * Плотность содержимого по колонкам внутри бокса — для поиска места разреза.
 */
function columnDensity(mask: Uint8Array, w: number, b: Box): number[] {
  const out: number[] = [];
  for (let x = b.x0; x <= b.x1; x++) {
    let c = 0;
    for (let y = b.y0; y <= b.y1; y++) if (mask[y * w + x]) c++;
    out.push(c);
  }
  return out;
}

/**
 * Две иконки могут соприкасаться — тогда никакой порог разрыва их не разделит.
 * Такой сегмент заметно шире остальных: режем его по самой разреженной колонке
 * в средней части. Возвращает два бокса или null, если резать нечего.
 */
function splitWidest(mask: Uint8Array, w: number, b: Box): [Box, Box] | null {
  const dens = columnDensity(mask, w, b);
  const width = dens.length;
  if (width < 40) return null;
  const from = Math.floor(width * 0.3);
  const to = Math.ceil(width * 0.7);
  let bestX = -1;
  let best = Infinity;
  for (let i = from; i <= to; i++) {
    if (dens[i] < best) {
      best = dens[i];
      bestX = i;
    }
  }
  if (bestX < 0) return null;
  const cut = b.x0 + bestX;
  const left = { ...b, x1: cut - 1 };
  const right = { ...b, x0: cut + 1 };
  if (left.x1 <= left.x0 || right.x1 <= right.x0) return null;
  return [left, right];
}

async function sliceSheet(file: string, debug: boolean) {
  const sheetId = path.basename(file, path.extname(file));
  const ids = expectedIds(sheetId);
  if (ids.length === 0) {
    console.warn(`  ! ${sheetId}: неизвестный лист (нет такой цепочки) — пропускаю`);
    return 0;
  }

  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const bg = backgroundColor(data, w, h);

  // Маска содержимого + мягкая альфа: тени и антиалиасинг гаснут плавно, а не рваным краем.
  const mask = new Uint8Array(w * h);
  const rgba = Buffer.alloc(w * h * 4);
  for (let p = 0, i = 0; p < w * h; p++, i += 4) {
    const dist = Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]);
    const alpha = dist <= BG_CLEAR ? 0 : dist >= BG_SOLID ? 255 : Math.round(((dist - BG_CLEAR) / (BG_SOLID - BG_CLEAR)) * 255);
    rgba[i] = data[i];
    rgba[i + 1] = data[i + 1];
    rgba[i + 2] = data[i + 2];
    rgba[i + 3] = alpha;
    if (dist >= BG_SOLID) mask[p] = 1;
  }

  const bands = rowBands(mask, w, h).filter(
    (b) => b[1] - b[0] + 1 >= MIN_BAND_H && b[1] >= h * HEADER_ZONE // отсекаем вотермарку сверху
  );

  const findBoxes = (minGap: number): Box[] => {
    const out: Box[] = [];
    for (const band of bands) {
      for (const col of columnGroups(mask, w, band[0], band[1], minGap)) {
        const box = tightBox(mask, w, band, col);
        if (!box) continue;
        const area = (box.x1 - box.x0 + 1) * (box.y1 - box.y0 + 1);
        if (area < w * h * MIN_SEGMENT_AREA) continue;
        out.push(box);
      }
    }
    return out;
  };

  // Подбираем порог разрыва под ожидаемое число иконок (с учётом заведомо лишних).
  const skip = new Set(SKIP_SEGMENTS[sheetId] ?? []);
  const target = ids.length + skip.size;
  let boxes = findBoxes(COL_GAP_CANDIDATES[0]);
  let usedGap = COL_GAP_CANDIDATES[0];
  for (const gap of COL_GAP_CANDIDATES) {
    const candidate = findBoxes(gap);
    usedGap = gap;
    boxes = candidate;
    if (candidate.length >= target) break;
  }

  // Осталось меньше нужного — значит какие-то иконки соприкасаются. Режем самые широкие.
  let splits = 0;
  while (boxes.length < target && splits < 4) {
    const widths = boxes.map((b) => b.x1 - b.x0);
    const median = [...widths].sort((a, b) => a - b)[Math.floor(widths.length / 2)];
    const idx = widths.indexOf(Math.max(...widths));
    if (widths[idx] < median * 1.5) break;
    const parts = splitWidest(mask, w, boxes[idx]);
    if (!parts) break;
    boxes = [...boxes.slice(0, idx), ...parts, ...boxes.slice(idx + 1)];
    splits += 1;
  }

  const kept = boxes.filter((_, i) => !skip.has(i));

  if (debug) {
    mkdirSync(DEBUG_DIR, { recursive: true });
    const svg = boxes
      .map((b, i) => {
        const dropped = skip.has(i);
        const c = dropped ? "#d33" : "#2a7";
        return (
          `<rect x="${b.x0}" y="${b.y0}" width="${b.x1 - b.x0}" height="${b.y1 - b.y0}" ` +
          `fill="none" stroke="${c}" stroke-width="4"/>` +
          `<text x="${b.x0 + 8}" y="${b.y0 + 44}" font-size="44" fill="${c}" font-family="sans-serif">${i}</text>`
        );
      })
      .join("");
    await sharp(file)
      .composite([{ input: Buffer.from(`<svg width="${w}" height="${h}">${svg}</svg>`), top: 0, left: 0 }])
      .toFile(path.join(DEBUG_DIR, `${sheetId}.png`));
  }

  if (kept.length !== ids.length) {
    console.warn(
      `  ! ${sheetId}: найдено ${kept.length}, ожидалось ${ids.length} (разрыв ${usedGap}px). ` +
        `Смотрите ${DEBUG_DIR}/${sheetId}.png и добавьте лишние индексы в SKIP_SEGMENTS.`
    );
    return 0;
  }

  const base = sharp(rgba, { raw: { width: w, height: h, channels: 4 } });
  const pad = Math.round(ICON_PX * 0.06);
  let made = 0;
  for (let i = 0; i < kept.length; i++) {
    const b = kept[i];
    const cut = await base
      .clone()
      .extract({ left: b.x0, top: b.y0, width: b.x1 - b.x0 + 1, height: b.y1 - b.y0 + 1 })
      .png()
      .toBuffer();
    await sharp(cut)
      .resize(ICON_PX - pad * 2, ICON_PX - pad * 2, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 90, effort: 6 })
      .toFile(path.join(OUT, `${ids[i]}.webp`));
    made++;
  }
  console.log(`  ✓ ${sheetId}: ${made} иконок (разрыв ${usedGap}px${splits ? `, разрезов ${splits}` : ""})`);
  return made;
}

async function main() {
  const args = process.argv.slice(2);
  const debug = args.includes("--debug");
  const only = args.filter((a) => !a.startsWith("--"));

  if (!existsSync(SHEETS)) {
    console.error(`Нет папки ${SHEETS}. Положите туда листы: <chainId>.png (например hall_tea.png).`);
    process.exit(1);
  }
  mkdirSync(OUT, { recursive: true });

  const files = readdirSync(SHEETS)
    .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
    .filter((f) => only.length === 0 || only.includes(path.basename(f, path.extname(f))));

  if (files.length === 0) {
    console.error(`В ${SHEETS} нет подходящих изображений.`);
    process.exit(1);
  }

  let total = 0;
  for (const f of files) total += await sliceSheet(path.join(SHEETS, f), debug);
  console.log(`\nГотово: ${total} иконок в ${OUT}/`);

  if (only.length === 0) {
    const missing = Object.keys(ITEM_CHAINS).filter((id) => !files.some((f) => f.startsWith(id)));
    if (missing.length > 0) console.log(`Нет листов для: ${missing.join(", ")}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

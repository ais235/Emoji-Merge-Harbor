/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useLayoutEffect, useRef, useState } from "react";

/**
 * Хук для автоматического масштабирования контента под высоту экрана.
 * Применяется на десктопе (ширина > 900px), чтобы контент влезал без прокрутки.
 */
export function useUiScaling() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [uiScale, setUiScale] = useState(1);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measureScale = () => {
      // На мобильных (узких) экранах не масштабируем — там ожидается вертикальный скролл
      if (window.innerWidth < 900) {
        setUiScale(1);
        return;
      }

      // Замеряем "натуральную" высоту контента.
      // Важно: scrollHeight возвращает высоту контента до применения CSS transform.
      const naturalH = el.scrollHeight;
      const vpH = window.innerHeight;

      if (naturalH > 0) {
        // Растягиваем на всю высоту окна (в пол)
        const next = Math.min(1, vpH / naturalH);
        // Обновляем только при заметном изменении, чтобы избежать дрожания
        setUiScale((prev) => (Math.abs(prev - next) > 0.005 ? next : prev));
      }
    };

    // Первый замер после рендера
    const raf = requestAnimationFrame(measureScale);
    
    // Пересчитываем при изменении размеров контента или окна
    const ro = new ResizeObserver(measureScale);
    ro.observe(el);
    window.addEventListener("resize", measureScale);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", measureScale);
    };
  }, []);

  // Базовая ширина окна на десктопе, которую мы хотим сохранить визуально
  const DESKTOP_BASE_WIDTH = 520;

  const scalingStyle: React.CSSProperties = (window.innerWidth >= 900) ? {
    transform: `scale(${uiScale})`,
    transformOrigin: "top center",
    // Компенсируем уменьшение ширины от scale, увеличивая саму ширину контейнера
    width: `${DESKTOP_BASE_WIDTH / uiScale}px`,
    maxWidth: "none", // Снимаем ограничение, чтобы ширина могла расти для компенсации
  } : {};

  return { containerRef, uiScale, scalingStyle };
}

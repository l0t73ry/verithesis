import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { SeriesPoint } from '@verithesis/enclave-worker';
import { ThesisChartView } from '@/components/ThesisChartView';
import { vt } from '@/lib/verithesis-visual-tokens';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('chart image load failed'));
    img.src = src;
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

let fontCssCache: Promise<string> | null = null;

/** SVG-as-image cannot see page web fonts; inline the same @font-face (base64) used by the page. */
async function collectEmbeddedFontCss(): Promise<string> {
  if (fontCssCache) return fontCssCache;
  fontCssCache = (async () => {
    const wanted = getComputedStyle(document.body).fontFamily;
    const chunks: string[] = [];
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      for (const rule of Array.from(rules)) {
        if (!(rule instanceof CSSFontFaceRule)) continue;
        const family = rule.style.getPropertyValue('font-family').replace(/["']/g, '').trim();
        if (!family || !wanted.includes(family)) continue;
        const src = rule.style.getPropertyValue('src');
        const m = src.match(/url\(["']?([^"')]+)["']?\)/);
        if (!m) continue;
        try {
          const res = await fetch(new URL(m[1], sheet.href ?? location.href).href);
          if (!res.ok) continue;
          const dataUrl = await blobToDataUrl(await res.blob());
          const css = rule.cssText.replace(/src:[^;]+;/, `src: url(${dataUrl});`);
          chunks.push(css);
        } catch {
          /* skip face */
        }
      }
    }
    return chunks.join('\n');
  })();
  return fontCssCache;
}

async function svgToImage(
  svg: SVGSVGElement,
  width: number,
  height: number,
  scale: number,
): Promise<HTMLImageElement> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('viewBox', `0 0 ${width} ${height}`);
  // Intrinsic size = export pixels, so the card canvas never upsamples (blur).
  clone.setAttribute('width', String(Math.round(width * scale)));
  clone.setAttribute('height', String(Math.round(height * scale)));
  clone.style.fontFamily = getComputedStyle(document.body).fontFamily;

  const fontCss = await collectEmbeddedFontCss();
  if (fontCss) {
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = fontCss;
    clone.insertBefore(style, clone.firstChild);
  }

  const serialized = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = await loadImage(url);
    if (img.naturalWidth < 1) throw new Error('chart SVG rasterized empty');
    // Decode while the blob URL is still valid.
    await img.decode().catch(() => undefined);
    return img;
  } finally {
    // Keep URL alive until drawn: revoke on next tick after decode is enough for data already decoded.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

async function waitForChartSvg(host: HTMLElement, timeoutMs = 4000): Promise<SVGSVGElement> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const svg = host.querySelector('svg');
    if (svg?.querySelector('.recharts-line-curve')) return svg;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
  throw new Error('Recharts chart did not render');
}

/**
 * Mount the same Recharts plot as Dashboard (no HTML legend) and rasterize at `scale`.
 * `height` is the plot height (THESIS_PLOT_HEIGHT).
 */
export async function rasterizeThesisChart(
  series: SeriesPoint[],
  width: number,
  height: number,
  labels: { price: string; tvl: string },
  scale = 2,
): Promise<HTMLImageElement> {
  if (typeof document === 'undefined') throw new Error('rasterizeThesisChart requires DOM');

  const shell = document.createElement('div');
  shell.setAttribute('aria-hidden', 'true');
  shell.style.cssText =
    'position:fixed;left:0;top:0;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none;z-index:-1';
  const host = document.createElement('div');
  host.style.cssText = `width:${width}px;height:${height}px;color:${vt.colorText}`;
  shell.appendChild(host);
  document.body.appendChild(shell);

  let root: Root | null = null;
  try {
    root = createRoot(host);
    root.render(
      createElement(ThesisChartView, {
        series,
        width,
        height,
        priceLabel: labels.price,
        tvlLabel: labels.tvl,
      }),
    );
    const svg = await waitForChartSvg(host);
    return await svgToImage(svg, width, height, scale);
  } finally {
    root?.unmount();
    shell.remove();
  }
}

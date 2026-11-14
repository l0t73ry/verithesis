import type { ThesisResult } from '@verithesis/enclave-worker';
import { rasterizeThesisChart } from '@/lib/rasterize-thesis-chart';
import { signalVisual } from '@/lib/signal-visual';
import { vt } from '@/lib/verithesis-visual-tokens';
import {
  THESIS_LEGEND_HEIGHT,
  THESIS_PLOT_HEIGHT,
  thesisChartStyle,
  thesisLegendStyle,
} from '@/lib/thesis-chart-config';

export interface ShareCardLabels {
  resultsTitle: string;
  signal: string;
  signalValue: string;
  sharpe: string;
  maxDrawdown: string;
  strategyVsBh: string;
  buyHoldLine: string;
  factorDemo: string;
  chartTitle: string;
  chartDays: string;
  chartPrice: string;
  chartTvl: string;
  verifyHint: string;
  cardTag: string;
}

const W = 560;
const PAD = vt.cardBodyPad.x;
const CONTENT_TOP = vt.cardHeaderHeight + vt.cardBodyPad.y;
const EXPORT_SCALE = 2;
const HERO_PAD = { x: 14, y: 12 };

const SANS = "Inter, var(--font-sans), system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif";
const MONO = '"JetBrains Mono", var(--font-mono), ui-monospace, Menlo, monospace';

async function ensureFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts?.load) return;
  const specs = [
    '600 18px Inter',
    '600 17px Inter',
    '600 15px Inter',
    '600 11px Inter',
    '500 17px Inter',
    '500 12px Inter',
    '500 11px Inter',
    '400 13px Inter',
    '400 12px Inter',
    '400 11px Inter',
    '500 17px "JetBrains Mono"',
    '400 11px "JetBrains Mono"',
  ];
  await Promise.all(specs.map((s) => document.fonts.load(s).catch(() => undefined)));
  await document.fonts.ready;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const tokens = text.match(/[\u3000-\u9fff\uff00-\uffef]|[^\s\u3000-\u9fff\uff00-\uffef]+\s*|\s+/g) ?? [text];
  const lines: string[] = [];
  let line = '';
  for (const tk of tokens) {
    const next = line + tk;
    if (line && ctx.measureText(next.trimEnd()).width > maxW) {
      lines.push(line.trimEnd());
      line = tk.trimStart();
    } else {
      line = next;
    }
  }
  if (line.trim()) lines.push(line.trimEnd());
  return lines;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = src;
  });
}

function drawQr(ctx: CanvasRenderingContext2D, qr: HTMLImageElement, x: number, y: number, size: number) {
  roundRect(ctx, x, y, size, size, vt.borderRadius);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = vt.colorBorder;
  ctx.lineWidth = 1;
  ctx.stroke();
  const pad = 6;
  const prev = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(qr, x + pad, y + pad, size - pad * 2, size - pad * 2);
  ctx.imageSmoothingEnabled = prev;
}

function drawSignalGlyph(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, glyph: 'up' | 'down' | 'flat', color: string) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  if (glyph === 'up') {
    ctx.beginPath();
    ctx.moveTo(cx, cy - 7);
    ctx.lineTo(cx - 6, cy + 4);
    ctx.lineTo(cx + 6, cy + 4);
    ctx.closePath();
    ctx.fill();
  } else if (glyph === 'down') {
    ctx.beginPath();
    ctx.moveTo(cx, cy + 7);
    ctx.lineTo(cx - 6, cy - 4);
    ctx.lineTo(cx + 6, cy - 4);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(cx - 7, cy);
    ctx.lineTo(cx + 7, cy);
    ctx.stroke();
  }
}

function statTitleLines(ctx: CanvasRenderingContext2D, title: string, maxW: number): string[] {
  ctx.font = `500 ${vt.statsTitle}px ${SANS}`;
  if (ctx.measureText(title).width <= maxW) return [title];
  const words = title.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (line && ctx.measureText(next).width > maxW) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 2);
}

function drawStatCol(
  ctx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  title: string,
  value: string,
  maxTitleW: number,
  opts: { valueColor?: string; sub?: string; mono?: boolean },
) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = vt.colorTextSecondary;
  const titleLines = statTitleLines(ctx, title, maxTitleW);
  titleLines.forEach((ln, i) => {
    ctx.font = `500 ${vt.statsTitle}px ${SANS}`;
    ctx.fillText(ln, cx, y + i * (vt.statsTitle + 2));
  });
  const titleBlock = titleLines.length * (vt.statsTitle + 2) - 2;
  ctx.fillStyle = opts.valueColor ?? vt.colorText;
  ctx.font = `${opts.mono ? '500' : '600'} ${vt.statsValueMetrics}px ${opts.mono ? MONO : SANS}`;
  ctx.fillText(value, cx, y + titleBlock + 6);
  if (opts.sub) {
    ctx.fillStyle = vt.colorTextSecondary;
    ctx.font = `400 11px ${SANS}`;
    ctx.fillText(opts.sub, cx, y + titleBlock + 6 + vt.statsValueMetrics + 2);
  }
  ctx.textAlign = 'left';
}

function measureTag(ctx: CanvasRenderingContext2D, text: string, padX: number): number {
  ctx.font = `400 11px ${SANS}`;
  return ctx.measureText(text).width + padX * 2;
}

function drawTag(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, padX: number, accent?: 'cyan') {
  const h = 22;
  ctx.font = `400 11px ${SANS}`;
  const w = ctx.measureText(text).width + padX * 2;
  roundRect(ctx, x, y, w, h, 6);
  ctx.fillStyle = accent === 'cyan' ? 'rgba(6, 182, 212, 0.28)' : 'rgba(51, 65, 85, 0.85)';
  ctx.fill();
  ctx.fillStyle = accent === 'cyan' ? '#a5f3fc' : vt.colorText;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + padX, y + h / 2);
  ctx.textBaseline = 'top';
  return w;
}

function drawThesisLegend(ctx: CanvasRenderingContext2D, labels: ShareCardLabels, cx: number, cy: number) {
  const { fontSize, swatchWidth, swatchGap, itemGap } = thesisLegendStyle;
  ctx.font = `400 ${fontSize}px ${SANS}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const items = [
    { color: thesisChartStyle.priceStroke, label: labels.chartPrice },
    { color: thesisChartStyle.tvlStroke, label: labels.chartTvl },
  ];
  const widths = items.map((it) => swatchWidth + swatchGap + ctx.measureText(it.label).width);
  const total = widths.reduce((a, b) => a + b, 0) + itemGap * (items.length - 1);
  let x = cx - total / 2;
  items.forEach((it, i) => {
    ctx.fillStyle = it.color;
    roundRect(ctx, x, cy - thesisChartStyle.lineWidth / 2, swatchWidth, thesisChartStyle.lineWidth, 1);
    ctx.fill();
    ctx.fillText(it.label, x + swatchWidth + swatchGap, cy);
    x += widths[i] + itemGap;
  });
}

function drawSignalHero(
  ctx: CanvasRenderingContext2D,
  result: ThesisResult,
  labels: ShareCardLabels,
  x: number,
  y: number,
  innerW: number,
  draw: boolean,
): number {
  const visual = signalVisual(result.conclusion.signal);
  const c = result.conclusion;
  const stratBeatBh = (c.strategy_return_pct ?? 0) >= (c.buy_hold_return_pct ?? 0);

  const leftW = vt.heroIcon + 12 + 64;
  const metricsW = innerW - HERO_PAD.x * 2 - leftW - 8;
  const colW = metricsW / 3;
  const titles = [labels.sharpe, labels.maxDrawdown, labels.strategyVsBh];
  const titleLineCount = Math.max(...titles.map((t) => statTitleLines(ctx, t, colW - 8).length));
  const titleBlock = titleLineCount * (vt.statsTitle + 2) - 2;
  const statsH = titleBlock + 6 + vt.statsValueMetrics + 2 + 13;
  const h = Math.max(vt.heroIcon, statsH) + HERO_PAD.y * 2;

  if (draw) {
    roundRect(ctx, x, y, innerW, h, vt.borderRadius);
    ctx.fillStyle = visual.bg;
    ctx.fill();
    ctx.strokeStyle = visual.border;
    ctx.lineWidth = 1;
    ctx.stroke();

    const iconX = x + HERO_PAD.x;
    const iconY = y + (h - vt.heroIcon) / 2;
    roundRect(ctx, iconX, iconY, vt.heroIcon, vt.heroIcon, 8);
    ctx.strokeStyle = visual.border;
    ctx.stroke();
    drawSignalGlyph(ctx, iconX, iconY, vt.heroIcon, visual.glyph, visual.color);

    const textX = iconX + vt.heroIcon + 12;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = vt.colorTextSecondary;
    ctx.font = `600 11px ${SANS}`;
    ctx.fillText(labels.signal.toUpperCase(), textX, iconY + 1);
    ctx.fillStyle = visual.color;
    ctx.font = `600 17px ${SANS}`;
    ctx.fillText(labels.signalValue, textX, iconY + 16);

    const statY = y + (h - statsH) / 2;
    const left = x + innerW - HERO_PAD.x - metricsW;
    drawStatCol(ctx, left + colW / 2, statY, labels.sharpe, String(c.sharpe_ratio ?? 0), colW - 8, { mono: true });
    drawStatCol(ctx, left + colW * 1.5, statY, labels.maxDrawdown, `${c.max_drawdown_pct ?? 0}%`, colW - 8, {
      mono: true,
    });
    drawStatCol(ctx, left + colW * 2.5, statY, labels.strategyVsBh, `${c.strategy_return_pct ?? 0}%`, colW - 8, {
      mono: true,
      valueColor: stratBeatBh ? vt.colorPrimary : vt.colorText,
      sub: labels.buyHoldLine,
    });
  }

  return h;
}

function layoutFactorTags(ctx: CanvasRenderingContext2D, result: ThesisResult, labels: ShareCardLabels, innerW: number): number {
  const c = result.conclusion;
  const tags = [
    { text: `GitHub ${c.github_commits_7d ?? 0}/7d`, accent: true as const },
    { text: `funding ~${c.funding_rate_bps ?? 0} bps` },
    { text: `whale ~${c.whale_net_flow_musd ?? 0}M` },
    { text: `w_tvl ${Math.round((c.tvl_weight ?? 0.5) * 100)}%` },
    { text: labels.factorDemo },
  ];
  const padX = 8;
  const gap = 6;
  const rowH = 22;
  let x = 0;
  let rows = 1;
  for (const tag of tags) {
    const w = measureTag(ctx, tag.text, padX);
    if (x > 0 && x + w > innerW) {
      rows++;
      x = 0;
    }
    x += w + gap;
  }
  return rows * rowH + (rows - 1) * 6;
}

function drawFactorTags(
  ctx: CanvasRenderingContext2D,
  result: ThesisResult,
  labels: ShareCardLabels,
  x: number,
  y: number,
  innerW: number,
) {
  const c = result.conclusion;
  const tags = [
    { text: `GitHub ${c.github_commits_7d ?? 0}/7d`, accent: true as const },
    { text: `funding ~${c.funding_rate_bps ?? 0} bps` },
    { text: `whale ~${c.whale_net_flow_musd ?? 0}M` },
    { text: `w_tvl ${Math.round((c.tvl_weight ?? 0.5) * 100)}%` },
    { text: labels.factorDemo },
  ];
  const padX = 8;
  const gap = 6;
  const rowH = 22;
  let cx = x;
  let cy = y;
  for (const tag of tags) {
    const w = measureTag(ctx, tag.text, padX);
    if (cx > x && cx + w > x + innerW) {
      cy += rowH + 6;
      cx = x;
    }
    drawTag(ctx, tag.text, cx, cy, padX, tag.accent ? 'cyan' : undefined);
    cx += w + gap;
  }
}

function paint(
  ctx: CanvasRenderingContext2D,
  result: ThesisResult,
  labels: ShareCardLabels,
  qr: HTMLImageElement | null,
  chartImg: HTMLImageElement | null,
  copy: { headline: string; summary: string },
  draw: boolean,
): number {
  const innerW = W - PAD * 2;
  let y = CONTENT_TOP;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  y += drawSignalHero(ctx, result, labels, PAD, y, innerW, draw) + 14;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  ctx.font = `400 ${vt.headlineSize}px ${SANS}`;
  const headlineLines = wrapText(ctx, copy.headline, innerW);
  for (const line of headlineLines) {
    if (draw) {
      ctx.fillStyle = vt.colorText;
      ctx.fillText(line, PAD, y);
    }
    y += 22;
  }

  y += 4;
  ctx.font = `400 ${vt.summarySize}px ${SANS}`;
  for (const line of wrapText(ctx, copy.summary, innerW)) {
    if (draw) {
      ctx.fillStyle = vt.colorTextSecondary;
      ctx.fillText(line, PAD, y);
    }
    y += 19;
  }

  y += 8;
  ctx.font = `400 11px ${SANS}`;
  const tagsH = layoutFactorTags(ctx, result, labels, innerW);
  if (draw) drawFactorTags(ctx, result, labels, PAD, y, innerW);
  y += tagsH + 18;

  if (draw) {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = `600 ${vt.chartTitleSize}px ${SANS}`;
    ctx.fillStyle = vt.colorText;
    ctx.fillText(labels.chartTitle, PAD, y);
    ctx.font = `400 ${vt.chartSubtitleSize}px ${SANS}`;
    ctx.fillStyle = vt.colorTextSecondary;
    ctx.fillText(labels.chartDays, PAD, y + 20);
  }
  y += 44;

  if (draw && chartImg) {
    ctx.drawImage(chartImg, PAD, y, innerW, THESIS_PLOT_HEIGHT);
  }
  y += THESIS_PLOT_HEIGHT;
  if (draw) drawThesisLegend(ctx, labels, W / 2, y + THESIS_LEGEND_HEIGHT / 2);
  y += THESIS_LEGEND_HEIGHT + 14;

  const qrSize = 88;
  const footY = y;
  const att = result.attestation;
  if (draw) {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = `500 12px ${SANS}`;
    ctx.fillStyle = vt.colorPrimary;
    ctx.fillText(labels.verifyHint, PAD, footY);
    ctx.font = `400 11px ${MONO}`;
    ctx.fillStyle = vt.colorTextSecondary;
    ctx.fillText(att.execution_timestamp, PAD, footY + 18);
    ctx.fillStyle = vt.colorPrimary;
    ctx.fillText(`in: ${att.input_hash.slice(0, 22)}…`, PAD, footY + 36);
    ctx.fillStyle = vt.colorWarning;
    ctx.fillText(`out: ${att.output_hash.slice(0, 22)}…`, PAD, footY + 52);
    ctx.fillStyle = vt.colorTextSecondary;
    ctx.font = `400 10px ${MONO}`;
    ctx.fillText(`${att.provider} · quote ${att.quote.status}`, PAD, footY + 70);
    if (qr) drawQr(ctx, qr, W - PAD - qrSize, footY, qrSize);
  }

  y += qrSize + 16 + vt.cardBodyPad.y;
  return y;
}

export async function renderShareCardPng(
  result: ThesisResult,
  labels: ShareCardLabels,
  qrDataUrl: string | null,
  copy: { headline: string; summary: string },
  scale = EXPORT_SCALE,
): Promise<string> {
  await ensureFonts();
  const innerW = W - PAD * 2;
  const qr = qrDataUrl ? await loadImage(qrDataUrl).catch(() => null) : null;
  const chartImg = await rasterizeThesisChart(
    result.series,
    innerW,
    THESIS_PLOT_HEIGHT,
    { price: labels.chartPrice, tvl: labels.chartTvl },
    scale,
  );

  const scratch = document.createElement('canvas').getContext('2d');
  if (!scratch) throw new Error('canvas 2d unavailable');
  const height = Math.ceil(paint(scratch, result, labels, qr, chartImg, copy, false));

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(W * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d unavailable');
  ctx.scale(scale, scale);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.fillStyle = 'rgba(15, 20, 25, 0.92)';
  roundRect(ctx, 0, 0, W, height, vt.borderRadius);
  ctx.fill();
  ctx.strokeStyle = vt.colorBorder;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = vt.colorBorder;
  ctx.fillRect(0, vt.cardHeaderHeight - 1, W, 1);
  ctx.font = `600 18px ${SANS}`;
  ctx.fillStyle = vt.colorText;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(labels.resultsTitle, PAD, vt.cardHeaderHeight / 2);
  ctx.font = `400 11px ${SANS}`;
  ctx.fillStyle = vt.colorTextSecondary;
  ctx.textAlign = 'right';
  ctx.fillText(labels.cardTag, W - PAD, vt.cardHeaderHeight / 2);
  ctx.textAlign = 'left';

  paint(ctx, result, labels, qr, chartImg, copy, true);
  return canvas.toDataURL('image/png');
}

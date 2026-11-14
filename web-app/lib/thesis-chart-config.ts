import type { SeriesPoint } from '@verithesis/enclave-worker';
import { vt } from '@/lib/verithesis-visual-tokens';

/** Single source for Dashboard + share-card chart (Recharts). */
export const THESIS_CHART_HEIGHT = vt.chartHeight;

/** Legend row below the plot (shared by Dashboard HTML + share-card canvas). */
export const THESIS_LEGEND_HEIGHT = 28;
export const THESIS_PLOT_HEIGHT = THESIS_CHART_HEIGHT - THESIS_LEGEND_HEIGHT;

export const thesisChartMargin = vt.chartMargin;

export const thesisChartStyle = {
  gridStroke: vt.colorGrid,
  gridDash: '4 4',
  axisStroke: vt.colorAxis,
  axisFontSize: 11,
  priceStroke: vt.colorPrimary,
  tvlStroke: vt.colorWarning,
  lineWidth: 2,
  axisLeftWidth: vt.chartAxisLeft,
  axisRightWidth: vt.chartAxisRight,
  tooltipBg: vt.colorBgContainer,
  tooltipBorder: vt.colorBorder,
  tooltipRadius: vt.borderRadius,
  legendFontSize: 12,
  legendPaddingTop: 8,
} as const;

export const thesisLegendStyle = {
  fontSize: 12,
  swatchWidth: 14,
  swatchGap: 6,
  itemGap: 20,
} as const;

export function seriesToChartData(series: SeriesPoint[]) {
  return series.map((s) => ({
    date: s.date.slice(5),
    price: Math.round(s.price_usd * 100) / 100,
    tvlM: Math.round((s.defi_tvl_usd / 1e6) * 10) / 10,
  }));
}

'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SeriesPoint } from '@verithesis/enclave-worker';
import {
  THESIS_LEGEND_HEIGHT,
  seriesToChartData,
  thesisChartMargin,
  thesisChartStyle,
  thesisLegendStyle,
} from '@/lib/thesis-chart-config';

/** Recharts only registers direct LineChart children — return an array, not a wrapper component. */
function thesisChartElements(priceLabel: string, tvlLabel: string) {
  return [
    <CartesianGrid
      key="grid"
      strokeDasharray={thesisChartStyle.gridDash}
      stroke={thesisChartStyle.gridStroke}
      vertical={false}
    />,
    <XAxis
      key="x"
      dataKey="date"
      stroke={thesisChartStyle.axisStroke}
      fontSize={thesisChartStyle.axisFontSize}
      tickLine={false}
      axisLine={false}
    />,
    <YAxis
      key="y-price"
      yAxisId="price"
      stroke={thesisChartStyle.priceStroke}
      fontSize={thesisChartStyle.axisFontSize}
      width={thesisChartStyle.axisLeftWidth}
      tickLine={false}
      axisLine={false}
    />,
    <YAxis
      key="y-tvl"
      yAxisId="tvl"
      orientation="right"
      stroke={thesisChartStyle.tvlStroke}
      fontSize={thesisChartStyle.axisFontSize}
      width={thesisChartStyle.axisRightWidth}
      tickLine={false}
      axisLine={false}
    />,
    <Tooltip
      key="tip"
      contentStyle={{
        background: thesisChartStyle.tooltipBg,
        border: `1px solid ${thesisChartStyle.tooltipBorder}`,
        borderRadius: thesisChartStyle.tooltipRadius,
        fontSize: 12,
      }}
      labelStyle={{ color: thesisChartStyle.axisStroke, marginBottom: 4 }}
    />,
    <Line
      key="line-price"
      yAxisId="price"
      type="monotone"
      dataKey="price"
      name={priceLabel}
      stroke={thesisChartStyle.priceStroke}
      dot={false}
      strokeWidth={thesisChartStyle.lineWidth}
      isAnimationActive={false}
      activeDot={{ r: 4, fill: thesisChartStyle.priceStroke }}
    />,
    <Line
      key="line-tvl"
      yAxisId="tvl"
      type="monotone"
      dataKey="tvlM"
      name={tvlLabel}
      stroke={thesisChartStyle.tvlStroke}
      dot={false}
      strokeWidth={thesisChartStyle.lineWidth}
      isAnimationActive={false}
      activeDot={{ r: 4, fill: thesisChartStyle.tvlStroke }}
    />,
  ];
}

/** Same legend spec as share-card canvas (`drawThesisLegend`). */
export function ThesisChartLegend({ priceLabel, tvlLabel }: { priceLabel: string; tvlLabel: string }) {
  const items = [
    { color: thesisChartStyle.priceStroke, label: priceLabel },
    { color: thesisChartStyle.tvlStroke, label: tvlLabel },
  ];
  return (
    <div
      style={{
        height: THESIS_LEGEND_HEIGHT,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: thesisLegendStyle.itemGap,
        fontSize: thesisLegendStyle.fontSize,
      }}
    >
      {items.map((it) => (
        <span key={it.label} style={{ display: 'inline-flex', alignItems: 'center', gap: thesisLegendStyle.swatchGap, color: it.color }}>
          <span
            style={{
              width: thesisLegendStyle.swatchWidth,
              height: thesisChartStyle.lineWidth,
              borderRadius: 1,
              background: it.color,
            }}
          />
          {it.label}
        </span>
      ))}
    </div>
  );
}

/**
 * Plot only (`width` set → fixed size for share-card raster) or plot + legend (Dashboard).
 * `height` is always the plot height; use THESIS_PLOT_HEIGHT.
 */
export function ThesisChartView({
  series,
  height,
  width,
  priceLabel,
  tvlLabel,
}: {
  series: SeriesPoint[];
  height: number;
  width?: number;
  priceLabel: string;
  tvlLabel: string;
}) {
  const data = seriesToChartData(series);

  if (width != null) {
    return (
      <div style={{ width, height }} data-vt-thesis-chart="">
        <LineChart width={width} height={height} data={data} margin={thesisChartMargin}>
          {thesisChartElements(priceLabel, tvlLabel)}
        </LineChart>
      </div>
    );
  }

  return (
    <div data-vt-thesis-chart="">
      <div style={{ height, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={thesisChartMargin}>
            {thesisChartElements(priceLabel, tvlLabel)}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <ThesisChartLegend priceLabel={priceLabel} tvlLabel={tvlLabel} />
    </div>
  );
}

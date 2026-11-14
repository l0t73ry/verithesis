import { theme, type ThemeConfig } from 'antd';

export const verithesisTheme: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: '#00e6b8',
    colorSuccess: '#34d399',
    colorWarning: '#f5c451',
    colorError: '#f87171',
    colorBgLayout: '#070a12',
    colorBgContainer: '#0f1419',
    colorBgElevated: '#151b26',
    colorBorder: '#334155',
    colorText: '#f1f5f9',
    colorTextSecondary: '#94a3b8',
    borderRadius: 10,
    fontSize: 14,
    fontSizeHeading1: 28,
    fontSizeHeading2: 22,
    fontSizeHeading3: 16,
    fontSizeHeading4: 16,
    fontSizeHeading5: 14,
    controlHeight: 36,
    controlHeightLG: 40,
    paddingContentHorizontalLG: 18,
    paddingLG: 14,
    marginLG: 16,
    fontFamily: 'var(--font-sans), system-ui, sans-serif',
    fontFamilyCode: 'var(--font-mono), ui-monospace, monospace',
  },
  components: {
    Layout: {
      headerHeight: 56,
      bodyBg: 'transparent',
      footerBg: 'transparent',
      headerBg: 'transparent',
    },
    Card: {
      colorBgContainer: 'rgba(15, 20, 25, 0.92)',
      headerHeight: 44,
      paddingLG: 14,
    },
    Form: {
      itemMarginBottom: 0,
      labelFontSize: 12,
      verticalLabelPadding: '0 0 4px',
    },
    Modal: {
      contentBg: '#151b26',
    },
    Statistic: {
      titleFontSize: 12,
      contentFontSize: 18,
    },
    Segmented: {
      itemSelectedBg: '#151b26',
    },
    Typography: {
      titleMarginBottom: 0,
      titleMarginTop: 0,
    },
  },
};

import type { ThesisConclusion } from '@verithesis/enclave-worker';
import { vt } from '@/lib/verithesis-visual-tokens';

export type SignalVisual = {
  color: string;
  bg: string;
  border: string;
  glyph: 'up' | 'down' | 'flat';
};

/** Shared signal colors — Dashboard hero + share card. */
export function signalVisual(signal: ThesisConclusion['signal']): SignalVisual {
  if (signal === 'bullish') {
    return {
      color: vt.colorPrimary,
      bg: 'rgba(0, 230, 184, 0.12)',
      border: 'rgba(0, 230, 184, 0.35)',
      glyph: 'up',
    };
  }
  if (signal === 'bearish') {
    return {
      color: vt.colorError,
      bg: 'rgba(248, 113, 113, 0.1)',
      border: 'rgba(248, 113, 113, 0.35)',
      glyph: 'down',
    };
  }
  return {
    color: '#cbd5e1',
    bg: 'rgba(148, 163, 184, 0.08)',
    border: 'rgba(148, 163, 184, 0.25)',
    glyph: 'flat',
  };
}

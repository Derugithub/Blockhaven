/** Inter faces loaded in the root layout. Ethiopic text falls back to the system face (see font-runs.ts). */
export const Fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semi: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

/** Menu palette. Gameplay draws its own sky and blocks. */
export const Colors = {
  bg: '#14171F',
  panel: '#1E2330',
  panelRaised: '#272D3D',
  line: '#343B4F',
  ink: '#F3F5FA',
  muted: '#A3ABBF',
  accent: '#6CC56A',
  accentInk: '#0E1A0E',
  danger: '#E5675E',
  warn: '#F2C14E',
  overlay: 'rgba(8, 10, 16, 0.72)',
} as const;

export const MAX_CONTENT_WIDTH = 720;

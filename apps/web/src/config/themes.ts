export type ThemePreset = {
  value: string // matches [data-theme="..."] in themes.css; 'default' = built-in palette
  name: string
}

// 'default' is the built-in palette (no data-theme attribute). The rest are
// generated into themes.css from tweakcn. Add a preset here after generating it.
export const themePresets: ThemePreset[] = [
  { value: 'default', name: 'Default' },
  { value: 'zen-inspired-theme', name: 'Zen Inspired Theme' },
  { value: 'chalk', name: 'Chalk' },
  { value: 'meridian', name: 'Meridian' },
  { value: 'my-openclaw', name: 'My Openclaw' },
]

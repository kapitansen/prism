import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react'

export type Theme = 'light' | 'dark' | 'system'
export type ColorTheme = string

type ThemeContextValue = {
  theme: Theme
  setTheme: (theme: Theme) => void
  colorTheme: ColorTheme
  setColorTheme: (colorTheme: ColorTheme) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

// Two independent axes, in-session only for now (persistence moves to the
// backend later, with this provider kept as the instant-apply layer):
//   - theme:      light / dark / system  -> `.dark` class on <html>
//   - colorTheme: tweakcn palette        -> `data-theme` attribute on <html>
export function ThemeProvider({
  children,
  defaultTheme = 'system',
  defaultColorTheme = 'default',
}: {
  children: ReactNode
  defaultTheme?: Theme
  defaultColorTheme?: ColorTheme
}) {
  const [theme, setTheme] = useState<Theme>(defaultTheme)
  const [colorTheme, setColorTheme] = useState<ColorTheme>(defaultColorTheme)

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('light', 'dark')

    const resolved =
      theme === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : theme

    root.classList.add(resolved)
  }, [theme])

  useEffect(() => {
    const root = document.documentElement
    if (colorTheme === 'default') {
      root.removeAttribute('data-theme')
    } else {
      root.setAttribute('data-theme', colorTheme)
    }
  }, [colorTheme])

  return (
    <ThemeContext.Provider
      value={{ theme, setTheme, colorTheme, setColorTheme }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return ctx
}

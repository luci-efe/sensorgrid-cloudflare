import { useState, useEffect } from 'react'

export type Theme = 'dark' | 'light'

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'dark'
    const stored = localStorage.getItem('sg-theme')
    return stored === 'dark' || stored === 'light' ? stored : 'dark'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('sg-theme', theme)
  }, [theme])

  const toggle = () => setThemeState(t => (t === 'dark' ? 'light' : 'dark'))
  return { theme, toggle }
}

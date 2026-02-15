import { useState, useEffect } from 'react'

/**
 * Hook para detectar si una media query coincide
 * @param query La media query a evaluar (ej: '(min-width: 1024px)')
 * @returns boolean true si la query coincide
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const media = window.matchMedia(query)
    if (media.matches !== matches) {
      setMatches(media.matches)
    }

    const listener = () => setMatches(media.matches)
    media.addEventListener('change', listener)
    
    return () => media.removeEventListener('change', listener)
  }, [matches, query])

  return matches
}

// Categories for reports (official categories - must match Home category stats)
export const ALL_CATEGORIES = [
  'Celulares',
  'Bicicletas',
  'Motos',
  'Autos',
  'Laptops',
  'Carteras'
] as const

export type Category = typeof ALL_CATEGORIES[number]

// Zones
export const ZONES = [
  'Centro',
  'Norte',
  'Sur',
  'Este',
  'Oeste'
] as const

export type Zone = typeof ZONES[number]

// Status options
export const STATUS_OPTIONS = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'en_proceso', label: 'En Proceso' },
  { value: 'resuelto', label: 'Resuelto' },
  { value: 'cerrado', label: 'Cerrado' }
] as const

// Categories for reports (official categories - must match Home category stats)
export const ALL_CATEGORIES = [
  'Celulares',
  'Bicicletas',
  'Motos',
  'Autos',
  'Laptops',
  'Carteras',
  'Robo',
  'Accidente',
  'Sospechoso',
  'Violencia'
] as const

export type Category = typeof ALL_CATEGORIES[number]

// Status options
export const STATUS_OPTIONS = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'en_proceso', label: 'En Proceso' },
  { value: 'resuelto', label: 'Resuelto' },
  { value: 'cerrado', label: 'Cerrado' }
] as const

export type ZoneType = 'home' | 'work' | 'frequent' | 'current'

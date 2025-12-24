// Datos mock para el frontend

export interface Report {
  id: string
  title: string
  description: string
  category: string
  status: 'pendiente' | 'en_proceso' | 'resuelto' | 'cerrado'
  zone: string
  location: {
    lat: number
    lng: number
    address: string
  }
  createdAt: string
  updatedAt: string
  anonId: string
  upvotes: number
  images?: string[]
}

export interface Comment {
  id: string
  reportId: string
  content: string
  anonId: string
  createdAt: string
  upvotes: number
}

export interface UserProfile {
  anonId: string
  totalReports: number
  totalUpvotes: number
  level: number
  points: number
  badges: string[]
  joinedAt: string
}

export const mockReports: Report[] = [
  {
    id: '1',
    title: 'Robo de bicicleta en Avenida Principal',
    description: 'Me robaron mi bicicleta roja marca Trek cerca de la intersección de Avenida Principal y Calle 5. Era una mountain bike con ruedas negras.',
    category: 'Robo de Bicicleta',
    status: 'pendiente',
    zone: 'Centro',
    location: {
      lat: -34.6037,
      lng: -58.3816,
      address: 'Av. Principal 1234'
    },
    createdAt: '2024-01-15T10:30:00Z',
    updatedAt: '2024-01-15T10:30:00Z',
    anonId: 'anon_abc123',
    upvotes: 12,
    images: []
  },
  {
    id: '2',
    title: 'Pérdida de celular en zona Norte',
    description: 'Perdí mi celular Samsung en la calle Norte. Tiene una funda negra con stickers. Si alguien lo encuentra, por favor avisar.',
    category: 'Pérdida de Objetos',
    status: 'en_proceso',
    zone: 'Norte',
    location: {
      lat: -34.6100,
      lng: -58.3900,
      address: 'Calle Norte 567'
    },
    createdAt: '2024-01-14T15:20:00Z',
    updatedAt: '2024-01-16T09:15:00Z',
    anonId: 'anon_xyz789',
    upvotes: 8,
    images: []
  },
  {
    id: '3',
    title: 'Encontrado: Cartera en Plaza Central',
    description: 'Encontré una cartera marrón en la plaza del barrio. Contiene documentos y tarjetas. Si es tuya, contacta con los datos que aparecen.',
    category: 'Encontrado',
    status: 'resuelto',
    zone: 'Sur',
    location: {
      lat: -34.6000,
      lng: -58.3700,
      address: 'Plaza Central'
    },
    createdAt: '2024-01-10T08:00:00Z',
    updatedAt: '2024-01-17T14:30:00Z',
    anonId: 'anon_def456',
    upvotes: 25,
    images: []
  },
  {
    id: '4',
    title: 'Robo de moto en zona Este',
    description: 'Robaron mi moto Honda CB 125 en la esquina de Av. Este y Calle 10. Era de color azul, placa ABC123.',
    category: 'Robo de Vehículo',
    status: 'pendiente',
    zone: 'Este',
    location: {
      lat: -34.6050,
      lng: -58.3850,
      address: 'Av. Este y Calle 10'
    },
    createdAt: '2024-01-18T11:45:00Z',
    updatedAt: '2024-01-18T11:45:00Z',
    anonId: 'anon_ghi789',
    upvotes: 5,
    images: []
  },
  {
    id: '5',
    title: 'Robo de laptop en café',
    description: 'Me robaron mi laptop MacBook Pro mientras estaba en un café de la Calle Oeste. Era plateada, modelo 2022.',
    category: 'Robo de Objetos Personales',
    status: 'en_proceso',
    zone: 'Oeste',
    location: {
      lat: -34.6080,
      lng: -58.3750,
      address: 'Calle Oeste 890'
    },
    createdAt: '2024-01-16T16:20:00Z',
    updatedAt: '2024-01-17T10:00:00Z',
    anonId: 'anon_jkl012',
    upvotes: 15,
    images: []
  },
  {
    id: '6',
    title: 'Pérdida de mochila con documentos',
    description: 'Perdí mi mochila negra con documentos importantes en la zona Centro. Contiene mi DNI y otros papeles.',
    category: 'Pérdida de Objetos',
    status: 'pendiente',
    zone: 'Centro',
    location: {
      lat: -34.6040,
      lng: -58.3820,
      address: 'Edificio Municipal'
    },
    createdAt: '2024-01-19T09:30:00Z',
    updatedAt: '2024-01-19T09:30:00Z',
    anonId: 'anon_mno345',
    upvotes: 3,
    images: []
  }
]

export const mockComments: Comment[] = [
  {
    id: 'c1',
    reportId: '1',
    content: 'Vi una bicicleta similar a la descrita en venta en el mercado. Te recomiendo revisar.',
    anonId: 'anon_xyz789',
    createdAt: '2024-01-15T14:20:00Z',
    upvotes: 5
  },
  {
    id: 'c2',
    reportId: '1',
    content: 'Lamento mucho lo que pasó. Voy a estar atento por si veo algo.',
    anonId: 'anon_def456',
    createdAt: '2024-01-15T16:45:00Z',
    upvotes: 8
  },
  {
    id: 'c3',
    reportId: '2',
    content: 'Espero que lo encuentres pronto. Revisa si tienes activado "Buscar mi dispositivo" en Samsung.',
    anonId: 'anon_abc123',
    createdAt: '2024-01-14T18:00:00Z',
    upvotes: 2
  },
  {
    id: 'c4',
    reportId: '3',
    content: 'Gracias por ser honesto y reportar lo encontrado. La comunidad te lo agradece.',
    anonId: 'anon_ghi789',
    createdAt: '2024-01-17T15:00:00Z',
    upvotes: 12
  }
]

export const mockUserProfile: UserProfile = {
  anonId: 'anon_current_user',
  totalReports: 3,
  totalUpvotes: 45,
  level: 5,
  points: 1250,
  badges: ['Primer Reporte', 'Colaborador Activo', 'Top Reporter'],
  joinedAt: '2024-01-01T00:00:00Z'
}

export const categories = [
  'Robo de Bicicleta',
  'Robo de Vehículo',
  'Robo de Objetos Personales',
  'Pérdida de Objetos',
  'Encontrado',
  'Otros'
]

export const zones = [
  'Centro',
  'Norte',
  'Sur',
  'Este',
  'Oeste'
]

export const statusOptions = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'en_proceso', label: 'En Proceso' },
  { value: 'resuelto', label: 'Resuelto' },
  { value: 'cerrado', label: 'Cerrado' }
]


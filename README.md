# SafeSpot - Frontend

Frontend completo de SafeSpot, una plataforma de reportes ciudadanos anónimos.

## 🎨 Sistema de Diseño

Este proyecto sigue estrictamente el sistema de diseño definido en `UX_UI_DESIGN_SYSTEM.md`:
- Modo oscuro exclusivo con estilo cyberpunk/neon
- Verde neón (#00ff88) como color principal
- Tipografía Inter
- Componentes modulares y reutilizables

## 🚀 Inicio Rápido

### Instalación

```bash
npm install
```

### Desarrollo

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`

### Build

```bash
npm run build
```

## 📁 Estructura del Proyecto

```
src/
├── components/
│   ├── layout/          # Header, Footer, Layout
│   └── ui/              # Componentes base (Button, Card, Badge, etc.)
├── lib/
│   ├── mockData.ts      # Datos mock para desarrollo
│   └── utils.ts         # Utilidades (cn function)
├── pages/               # Pantallas principales
│   ├── Home.tsx
│   ├── CrearReporte.tsx
│   ├── DetalleReporte.tsx
│   ├── Explorar.tsx
│   └── Perfil.tsx
├── App.tsx              # Router principal
├── main.tsx            # Entry point
└── index.css           # Estilos globales
```

## 🎯 Características

### Pantallas Implementadas

1. **Home** (`/`)
   - Listado de reportes con filtros
   - Búsqueda por texto
   - Filtros por categoría, zona y estado
   - Cards con información resumida

2. **Crear Reporte** (`/crear-reporte`)
   - Formulario completo con validaciones
   - Campos: título, descripción, categoría, zona, dirección
   - Validación visual de errores
   - Sin submit real (mock)

3. **Detalle de Reporte** (`/reporte/:id`)
   - Información completa del reporte
   - Estado y categoría
   - Sistema de upvotes (mock)
   - Comentarios (mock)
   - Formulario para agregar comentarios

4. **Explorar** (`/explorar`)
   - Vista de lista de todos los reportes
   - Toggle entre vista lista/mapa (mapa mock)
   - Estadísticas generales

5. **Perfil Anónimo** (`/perfil`)
   - Información del usuario anónimo
   - Sistema de niveles y puntos (mock)
   - Insignias (mock)
   - Historial de reportes del usuario

## 🎨 Componentes UI

Todos los componentes siguen el sistema de diseño:

- **Button**: Variantes (default, neon, outline, secondary, ghost, destructive, link)
- **Card**: Con efectos glow y glassmorphism
- **Badge**: Para estados y categorías
- **Input/Textarea/Select**: Con estilos consistentes

## 📊 Datos Mock

Los datos están en `src/lib/mockData.ts`:
- `mockReports`: Lista de reportes de ejemplo
- `mockComments`: Comentarios de ejemplo
- `mockUserProfile`: Perfil de usuario anónimo
- Categorías, zonas y estados predefinidos

## 🔧 Tecnologías

- **React 18** con TypeScript
- **Vite** como bundler
- **React Router** para navegación
- **Tailwind CSS** para estilos
- **Lucide React** para iconos

## 📝 Notas Importantes

- **100% Anónimo**: No hay sistema de autenticación
- **Sin Backend**: Todo funciona con datos mock locales
- **Sin API Calls**: Todas las interacciones son simuladas
- **Listo Visualmente**: El frontend está completo y funcional

## 🎯 Próximos Pasos (No Implementados)

- Integración con backend real
- Sistema de autenticación (si se requiere)
- Integración de mapas reales (Leaflet/Mapbox)
- Subida de imágenes
- Notificaciones en tiempo real

---

**Versión**: 1.0.0  
**Estado**: Frontend completo - Listo para integración con backend


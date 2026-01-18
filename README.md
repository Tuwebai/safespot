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
   - Integración con backend para crear reportes

3. **Detalle de Reporte** (`/reporte/:id`)
   - Información completa del reporte
   - Estado y categoría
   - Sistema de upvotes integrado con backend
   - Comentarios con sistema de hilos
   - Formulario para agregar comentarios

4. **Explorar** (`/explorar`)
   - Vista de lista de todos los reportes
   - Toggle entre vista lista/mapa
   - Estadísticas generales

5. **Perfil Anónimo** (`/perfil`)
   - Información del usuario anónimo
   - Sistema de niveles y puntos
   - Insignias y gamificación
   - Historial de reportes del usuario

## 🎨 Componentes UI

Todos los componentes siguen el sistema de diseño:

- **Button**: Variantes (default, neon, outline, secondary, ghost, destructive, link)
- **Card**: Con efectos glow y glassmorphism
- **Badge**: Para estados y categorías
- **Input/Textarea/Select**: Con estilos consistentes

## 🔧 Tecnologías

- **React 18** con TypeScript
- **Vite** como bundler
- **React Router** para navegación
- **Tailwind CSS** para estilos
- **Lucide React** para iconos

## 📝 Notas Importantes

- **100% Anónimo**: Sistema de identidad anónima basado en localStorage
- **Backend Integrado**: La aplicación consume APIs reales del backend
- **API Calls**: Todas las interacciones se realizan mediante llamadas al backend
- **Listo para Producción**: El frontend está completo y funcional

## 🛡️ Data Philosophy (Enterprise)

- **Single Source of Truth**: React Query manages all server state.
- **Fail Loud**: Backend enforces strict Zod contracts. Any violation 500s immediately.
- **UI Stability**: We prefer "stale" data over "loading" states or empty screens.
- **Last Known Good State**: Errors never wipe visible data.
- **No Silencing**: We never use `|| []` to mask API failures.


## 🎯 Próximos Pasos

- Integración de mapas reales (Leaflet/Mapbox)
- Notificaciones en tiempo real
- Mejoras de performance y optimizaciones

---

**Versión**: 1.0.0  
**Estado**: Frontend completo - Listo para integración con backend


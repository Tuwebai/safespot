# SafeSpot Anonymous Backend

Backend completamente anónimo para SafeSpot. **NO requiere autenticación, NO usa Supabase Auth, NO requiere login**.

## 🎯 Características

- ✅ **100% Anónimo**: Sin autenticación, sin login, sin signup
- ✅ **Identidad Persistente**: Cada usuario tiene un `anonymous_id` (UUID v4) almacenado en localStorage
- ✅ **Row Level Security (RLS)**: Todas las tablas tienen RLS habilitado
- ✅ **Validación Estricta**: Valida `anonymous_id` en cada request
- ✅ **Logging Detallado**: Todos los requests se registran con `anonymous_id`
- ✅ **Prevención de Duplicados**: No se pueden votar dos veces el mismo item
- ✅ **Future-Proof**: Estructura lista para migrar a usuarios autenticados

## 📋 Requisitos

- Node.js 18+
- PostgreSQL 12+ (o Supabase)
- Variables de entorno configuradas

## 🚀 Instalación

```bash
cd server
npm install
```

## ⚙️ Configuración

Copia `.env.example` a `.env` y configura:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/safespot

# Server
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5174

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## 🗄️ Base de Datos

### Ejecutar Schema

```bash
# Conecta a tu base de datos PostgreSQL/Supabase
psql -U postgres -d safespot -f ../database/schema.sql
```

O ejecuta el SQL en el editor de Supabase.

### Tablas Creadas

1. **anonymous_users**: Usuarios anónimos
2. **reports**: Reportes ciudadanos
3. **comments**: Comentarios en reportes
4. **votes**: Votos (upvotes) en reportes y comentarios
5. **gamification_stats**: Estadísticas de gamificación

Todas las tablas tienen **RLS habilitado**.

## 🏃 Ejecutar

```bash
# Desarrollo (con watch)
npm run dev

# Producción
npm start
```

El servidor estará en `http://localhost:3000`

## 📡 API Endpoints

### Reports

- `GET /api/reports` - Listar reportes (con filtros opcionales)
- `GET /api/reports/:id` - Obtener un reporte
- `POST /api/reports` - Crear reporte (requiere `X-Anonymous-Id`)
- `PATCH /api/reports/:id` - Actualizar reporte (solo owner)

### Comments

- `GET /api/comments/:reportId` - Listar comentarios de un reporte
- `POST /api/comments` - Crear comentario (requiere `X-Anonymous-Id`)
- `DELETE /api/comments/:id` - Eliminar comentario (solo owner)

### Votes

- `POST /api/votes` - Crear voto (requiere `X-Anonymous-Id`)
- `DELETE /api/votes` - Eliminar voto (requiere `X-Anonymous-Id`)
- `GET /api/votes/check` - Verificar si ya votó (requiere `X-Anonymous-Id`)

### Users

- `GET /api/users/profile` - Obtener perfil anónimo (requiere `X-Anonymous-Id`)
- `GET /api/users/stats` - Estadísticas globales (público)

## 🔐 Headers Requeridos

Todas las operaciones que modifican datos requieren el header:

```
X-Anonymous-Id: <uuid-v4>
```

El `anonymous_id` debe ser un UUID v4 válido. Se genera en el frontend y se almacena en localStorage.

## 🔒 Row Level Security (RLS)

Todas las tablas tienen RLS habilitado:

- **SELECT**: Público para reports/comments, privado para votes
- **INSERT**: Cualquiera puede insertar con su `anonymous_id`
- **UPDATE/DELETE**: Solo el owner puede modificar/eliminar

El backend establece `app.anonymous_id` antes de cada query usando `SET LOCAL`.

## 📝 Logging

Todos los requests se registran con:
- Timestamp
- Método y path
- `anonymous_id`
- IP address
- Request body (si aplica)
- Errores detallados

## 🚫 Seguridad

- ✅ Rate limiting (100 requests por 15 minutos por IP)
- ✅ CORS configurado
- ✅ Helmet para headers de seguridad
- ✅ Validación estricta de `anonymous_id`
- ✅ RLS en todas las tablas
- ✅ Prevención de votos duplicados

## 🔄 Migración Futura a Auth

La estructura está preparada para migrar a usuarios autenticados:

1. Agregar columna `user_id` a `anonymous_users`
2. Migrar datos: `UPDATE anonymous_users SET user_id = ... WHERE anonymous_id = ...`
3. Cambiar `current_anonymous_id()` por `auth.uid()` en RLS
4. Mantener `anonymous_id` para compatibilidad

## 📚 Estructura

```
server/
├── src/
│   ├── config/
│   │   └── database.js      # Pool de conexiones
│   ├── routes/
│   │   ├── reports.js       # Endpoints de reportes
│   │   ├── comments.js      # Endpoints de comentarios
│   │   ├── votes.js          # Endpoints de votos
│   │   └── users.js          # Endpoints de usuarios
│   ├── utils/
│   │   ├── logger.js         # Logging
│   │   ├── validation.js     # Validación
│   │   └── rls.js            # Helpers para RLS
│   └── index.js              # Servidor Express
├── package.json
└── README.md
```

## ⚠️ Notas Importantes

- **NO** uses Supabase Auth
- **NO** referencies tablas de usuarios autenticados
- **NO** requieras email/password
- **SÍ** valida `anonymous_id` en cada request
- **SÍ** establece `app.anonymous_id` antes de queries
- **SÍ** usa `queryWithRLS()` para todas las queries

## 🐛 Debugging

Para ver logs detallados, el servidor imprime:
- ✅ Requests exitosos
- ❌ Errores con stack trace
- 📊 `anonymous_id` en cada request

---

**Estado**: ✅ Backend anónimo completo y funcional


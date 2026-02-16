# Matriz de Errores — Auth + Realtime

## Contrato estándar de error (API)

Todas las rutas críticas de `auth` y `realtime` devuelven este shape en error:

```json
{
  "error": true,
  "code": "ERROR_CODE",
  "message": "Human readable message",
  "requestId": "req_xxx"
}
```

## Rutas críticas y estados esperados

| Ruta | 400 | 401 | 403 | 404 | 500 |
|---|---|---|---|---|---|
| `POST /api/auth/login` | Input inválido (`VALIDATION_ERROR`) | Credenciales inválidas (`UNAUTHORIZED`) | N/A | N/A | Error inesperado (`INTERNAL_ERROR`) |
| `POST /api/auth/register` | Input inválido (`VALIDATION_ERROR`) | N/A | N/A | N/A | Error inesperado (`INTERNAL_ERROR`) |
| `GET /api/auth/me` | N/A | No autenticado (`UNAUTHORIZED`) | N/A | N/A | Error inesperado (`INTERNAL_ERROR`) |
| `GET /api/realtime/catchup` | `since` faltante/inválido (`VALIDATION_ERROR`) | No autenticado (`AUTH_REQUIRED`) | N/A | N/A | Falla interna (`INTERNAL_ERROR`) |
| `GET /api/realtime/message-status/:messageId` | N/A | No autenticado (`AUTH_REQUIRED`) | N/A | No visible/no existe => respuesta funcional `200 { delivered:false, read:false }` (sin fuga) | Falla interna (`MESSAGE_STATUS_FAILED`) |
| `GET /api/realtime/chats/:roomId` | N/A | No autenticado (`AUTH_REQUIRED`) | No miembro (`NOT_ROOM_MEMBER`) | N/A | Error inesperado (`INTERNAL_ERROR`) |
| `GET /api/realtime/user/:anonymousId` | N/A | No autenticado (`AUTH_REQUIRED`) | Stream cruzado (`FORBIDDEN_STREAM`) | N/A | Error inesperado (`INTERNAL_ERROR`) |

## Logging

- Todas las respuestas de error incluyen `requestId`.
- Errores `5xx` se registran como `error`.
- Errores operacionales `4xx` se registran como `warn` con `requestId`, `code`, `statusCode`, `path`, `method`.


# Registro de Evidencia - Rotacion de Secretos

## Objetivo
Trazabilidad operativa de cada rotacion o simulacro de secretos, sin exponer valores sensibles.

## Formato obligatorio por entrada
| Fecha (UTC) | Entorno | Tipo | Secreto(s) | Ticket | Owner | Resultado | Evidencia |
|---|---|---|---|---|---|---|---|
| YYYY-MM-DD HH:mm | staging/prod | rotacion/simulacro | NOMBRE_SECRETO | CHG-XXXX | @owner | GO/ROLLBACK | requestId + smoke |

## Plantilla de evidencia (copiar/pegar)
```md
### CHG-XXXX - Rotacion <SECRETO>
- Fecha inicio (UTC):
- Fecha fin (UTC):
- Entorno:
- Owner tecnico:
- On-call:
- Security owner:
- Secretos rotados (nombre, no valor):
- Smoke ejecutado:
  - login email/password: OK/FAIL
  - login social (si aplica): OK/FAIL
  - catchup autenticado: OK/FAIL
  - push segun flag: OK/FAIL
- requestId de verificacion:
- Resultado: GO / ROLLBACK
- Observaciones:
```

## Entradas

### PENDIENTE INICIAL
- Estado: pendiente de primera entrada formal de rotacion/simulacro.
- Accion: completar en la siguiente ventana programada.

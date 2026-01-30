# AUDITORÍA TÉCNICA: Flujo de Creación y Ownership (Safespot v2)

## 1. Resumen Ejecutivo
El sistema presenta un comportamiento no determinista en la creación de reportes debido a una **fractura en la autoridad de identidad (SSOT)** y una **estrategia de actualización de cache demasiado agresiva y poco filtrada**. El hecho de que volver al punto "A" solucione el problema indica que las "mejoras" aplicadas en el punto "B" introdujeron dependencias circulares y condiciones de carrera entre la hidratación de la sesión y las mutaciones optimistas.

## 2. Línea de Tiempo del Bug (A vs B)
- **Estado A (Estable)**: Probablemente utilizaba una identidad más estática o un flujo de `setQueryData` menos reactivo pero más predecible. La lista se refrescaba de forma íntegra tras la creación.
- **Estado B (Buggy)**: Se introdujo `SessionAuthority` para mayor seguridad, pero se desacopló de la lógica de creación optimista (`resolveCreator`). Se implementó un `prepend` global que afecta a todas las listas sin respetar filtros, causando que datos incoherentes fluyan a la UI.

## 3. Root Cause Exacto

### Identidad: Discrepancia de Fuentes (Inconsistencia de Ownership)
- **Archivo**: [`resolveCreator.ts`](file:///c:/Users/juan/Documents/Proyectos/Safespot/src/lib/auth/resolveCreator.ts) vs [`useIsOwner.ts`](file:///c:/Users/juan/Documents/Proyectos/Safespot/src/hooks/useIsOwner.ts)
- **Motivo**: `resolveCreator` usa `getAnonymousIdSafe()` (síncrono, fallback agresivo a storage). `useIsOwner` usa `useAnonymousId()` (reactivo, espera a `SessionAuthority`).
- **Consecuencia**: Si el reporte se crea durante el bootstrapping (0-500ms), se guarda con `ID_A` (safe), pero la UI luego se estabiliza con `ID_B` (auth). `isOwner` devuelve `false` y el usuario pierde el control de su reporte.

### Cache: Sobrescritura Proactiva (Desaparición de Reportes)
- **Archivo**: [`useReportsQuery.ts`](file:///c:/Users/juan/Documents/Proyectos/Safespot/src/hooks/queries/useReportsQuery.ts) y [`cache-helpers.ts`](file:///c:/Users/juan/Documents/Proyectos/Safespot/src/lib/cache-helpers.ts)
- **Motivo**: 
    1. El `prepend` usa `exact: false` sobre `['reports', 'list']`. Esto añade el nuevo reporte a **todas** las listas filtradas, incluso si no pertenece a esa categoría.
    2. Existe una carrera entre el `onMutate` (cancelación de queries) y el montaje de componentes tras `navigate('/reportes')`. Si `isCreating` no se detecta instantáneamente, una query de "refetch on mount" puede dispararse y sobreescribir la cache con datos del servidor que aún no incluyen el nuevo reporte.
- **Consecuencia**: El reporte aparece un instante y desaparece al primer refetch, o "oculta" los anteriores si la cache se inicializó vacía durante la creación.

## 4. Por qué volver a A "lo arregló"
Volver a A eliminó las capas de "Enterprise Robustness" que estaban mal sincronizadas. Probablemente en A:
- La identidad era única y venía de una sola fuente directa (`localStorage`).
- Las listas se invalidaban (`invalidateQueries`) en lugar de intentar un `prepend` quirúrgico pero fallido. Aunque es menos eficiente, es determinista.

## 5. Invariantes Violadas
1. **SSOT de Identidad**: El ID del autor en el reporte debe provenir de la MISMA fuente que usa la UI para verificar ownership.
2. **Coherencia de Filtros**: Un `prepend` en cache no debe ignorar los filtros de la query original.
3. **Atomicidad de Transición**: La navegación a la lista no debe ocurrir antes de que el estado de `isMutating` sea globalmente visible para bloquear refetches.

## 6. Riesgos de Fixes sin Rediseño
- **Parches de IDs**: Intentar "forzar" el ID en un lado romperá la seguridad en el otro.
- **Invalidaciones Masivas**: Causarán parpadeos y "jumping UI" en conexiones lentas.
- **Zustand vs React Query**: Si se duplica el estado de la lista en un store local "por las dudas", se rompe definitivamente el SSOT.

## 7. Recomendaciones Conceptuales (Roadmap)
1. **Sincronización de Identidad**: `resolveCreator` debe ser el único punto de resolución de autoría, y debe estar acoplado al estado de preparación de `SessionAuthority`.
2. **Surgical Prepend**: El helper de cache debe validar si el reporte cumple con los `filters` de la llave antes de inyectarlo en una lista específica.
3. **Guardia de Refetch**: Fortalecer el bloqueo de refetches durante la ventana de "servidor pendiente" (SSE Latency).

---
**Auditado por: Principal Frontend Engineer / React State Specialist**

Esta es la propuesta técnica para la evolución del sistema de chat de SafeSpot a una arquitectura de Chat Global (Messenger Grade).

🧠 1. Análisis del Estado Actual
Puntos Fuertes (Reutilizables)
SSE Passive Patching: Ya existe una infraestructura de EventSource que aplica patches vía queryClient.setQueryData. Es el patrón correcto.
DMs Base: El backend ya soporta salas sin report_id (DMs), usando una normalización de IDs para evitar duplicados.
Echo Suppression: La lógica de originClientId ya está implementada, lo cual es vital para multi-tab consistency.
Limitaciones Críticas
Acoplamiento 1-a-1: La tabla chat_rooms tiene columnas fijas participant_a y participant_b. Esto impide grupos y escala mal.
Cache no Normalizada: El hook 
useChatRooms
 guarda objetos completos en la lista. Si un mensaje actualiza un alias, la lista y el detalle quedan inconsistentes si no se parchean ambos manualmente.
Lógica en Hooks: La gestión de la conexión SSE está dentro de los hooks UI (
useChatRooms
, 
useChatMessages
), lo que duplica conexiones si se usan múltiples componentes.
🧩 2. Propuesta de Arquitectura Global (Enterprise)
🧩 Modelo de Dominio (Database Schema)
Abandonamos la estructura de "Sala vinculada a reporte" por una de "Conversación abstracta".

mermaid
erDiagram
    CONVERSATION {
        uuid id PK
        uuid report_id FK "Null para Chat Global"
        string type "dm | group"
        timestamp last_message_at
        jsonb metadata "Config de grupo, nombre, icon"
    }
    CONVERSATION_MEMBER {
        uuid conversation_id FK
        uuid user_id FK
        timestamp joined_at
        uuid last_read_message_id
    }
    MESSAGE {
        uuid id PK
        uuid conversation_id FK
        uuid sender_id FK
        text content
        string type "text | image | system"
        timestamp created_at
    }
🗂️ Cache & Estado (React Query SSOT)
Forzamos una Single Source of Truth mediante la normalización agresiva.

Estructura de Keys
['conversations', 'list']: Retorna string[] (IDs).
['conversations', 'detail', id]: Retorna el objeto Conversation.
['messages', 'detail', id]: Retorna el objeto 
Message
.
['conversations', 'messages', convId]: Retorna string[] (IDs de mensajes).
Invariante de Componentes
[!IMPORTANT] Un componente <ConversationItem id={id} /> NUNCA recibe la conversación por props. Usa useConversation(id) que lee exclusivamente de la cache de detalle.

🔄 Realtime (SSE Autoritativo)
El backend emite eventos puramente descriptivos. El frontend no decide, solo obedece al estado del servidor.

Contrato de Evento:

json
{
  "event": "message-created",
  "payload": {
    "id": "msg_123",
    "conversation_id": "conv_456",
    "partial": {
      "content": "Hola!",
      "sender_id": "user_abc",
      "created_at": "2024-01-08T..."
    },
    "originClientId": "client_xyz"
  }
}
Lógica del Patch (Global Store):

typescript
// En un ChatProvider o Middleware de SSE
const handleMessageCreated = (data) => {
  // 1. Actualizamos cache de detalle del mensaje
  queryClient.setQueryData(['messages', 'detail', data.id], data.partial);
  
  // 2. Agregamos el ID a la lista de la conversación
  queryClient.setQueryData(['conversations', 'messages', data.conversation_id], (old) => {
    return [data.id, ...(old || [])];
  });
  
  // 3. Actualizamos puntero en la conversación
  queryClient.setQueryData(['conversations', 'detail', data.conversation_id], (old) => ({
    ...old,
    last_message_id: data.id,
    last_message_at: data.partial.created_at
  }));
};
⚡ UX (Nivel Messenger)
Optimistic Send: Al enviar, se inserta un mensaje con id: temp-ID en la lista y en la cache de detalle.
Reconciliación: Cuando el POST retorna, se hace un 
upsert
 que reemplaza el temp-ID por el real, evitando parpadeos (flicker).
Inbox Sorting: La lista de IDs se reordena automáticamente en el cliente cada vez que last_message_at de una conversación cambia.
3. Plan de Migración Incremental
Fase 1 (Dual Schema): Crear tabla conversation_members y migrar datos de chat_rooms. Los reportes ahora apuntan a una conversation_id.
Fase 2 (Normalización Front): Refactorizar 
useChatsQuery.ts
 para implementar la cache de detalle. Los componentes viejos siguen funcionando pero leen de la nueva cache.
Fase 3 (Global Inbox): Crear la vista /inbox que consulta ['conversations', 'list'] sin filtrar por report_id.
Fase 4 (Cleanup): Eliminar lógica de participant_a/b del backend y centralizar todo en el esquema de miembros.
4. Checklist de Invariantes (Enterprise)
 SSE no invalida: Solo admite patches. invalidateQueries está prohibido en el flujo realtime.
 Multi-tab Consistency: El originClientId descarta ecos en la tab emisora pero actualiza las otras tabs del mismo usuario.
 Zero Logic in UI: Los componentes de React no saben cómo se actualiza el chat; solo renderizan lo que React Query les da.
 Passive UI Cleanup: Al marcar como leído, se envía un patch unread_count: 0 antes de que el servidor responda.
 Normalización Total: No existen dos lugares en la cache donde resida el contenido del mismo mensaje.
5. Entregables de Implementación
Pseudocódigo de Hook Maestro
typescript
export const useConversation = (id: string) => {
  return useQuery({
    queryKey: ['conversations', 'detail', id],
    queryFn: () => api.getConversation(id),
    staleTime: Infinity, // Solo se actualiza vía SSE
  });
};
export const useConversationMessages = (convId: string) => {
  return useQuery({
    queryKey: ['conversations', 'messages', convId],
    queryFn: () => api.getMessagesIds(convId),
    select: (ids) => ids, // Solo IDs para virtualización
  });
};
Flujo Data End-to-End
User presiona "Enviar".
useMutation.onMutate inyecta ID temporal en ['conversations', 'messages', convId].
Backend inserta en DB y emite evento SSE.
SSE llega a todos los dispositivos (incluyendo otras tabs del emisor).
Patchers de cache actualizan el detalle y el orden del inbox global.
La UI reacciona en 0ms por el optimistic update y se confirma con el patch de SSE.
Este diseño garantiza una experiencia fluida, escalable y alineada con los estándares de ingeniería de una Big Tech.
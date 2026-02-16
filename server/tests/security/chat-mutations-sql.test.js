import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryWithRLSMock = vi.hoisted(() => vi.fn());
const txQueryMock = vi.hoisted(() => vi.fn());
const emitUserChatUpdateMock = vi.hoisted(() => vi.fn());
const emitChatStatusMock = vi.hoisted(() => vi.fn());
const broadcastMock = vi.hoisted(() => vi.fn());
const emitMessageDeliveredMock = vi.hoisted(() => vi.fn());
const emitMessageReadMock = vi.hoisted(() => vi.fn());
const transactionWithRLSMock = vi.hoisted(() => vi.fn(async (_anonymousId, callback) => {
    const sse = {
        emit: vi.fn((method, ...args) => {
            if (method === 'emitChatStatus') emitChatStatusMock(...args);
            if (method === 'emitUserChatUpdate') emitUserChatUpdateMock(...args);
            if (method === 'emitMessageDelivered') emitMessageDeliveredMock(...args);
            if (method === 'emitMessageRead') emitMessageReadMock(...args);
            if (method === 'broadcast') broadcastMock(...args);
        })
    };
    return callback({ query: txQueryMock }, sse);
}));

vi.mock('../../src/utils/rls.js', () => ({
    queryWithRLS: queryWithRLSMock,
    transactionWithRLS: transactionWithRLSMock
}));

vi.mock('../../src/utils/eventEmitter.js', () => ({
    realtimeEvents: {
        emitUserChatUpdate: emitUserChatUpdateMock,
        emitChatStatus: emitChatStatusMock,
        broadcast: broadcastMock,
        emitMessageDelivered: emitMessageDeliveredMock,
        emitMessageRead: emitMessageReadMock
    }
}));

import { unpinRoom, archiveRoom, unarchiveRoom, setUnreadRoom, deleteRoom, deleteRoomMessage, editRoomMessage, pinRoomMessage, unpinRoomMessage, starRoomMessage, unstarRoomMessage, createRoom, toggleMessageReaction, reconcileMessageStatus, getRoomMessages } from '../../src/routes/chats.mutations.js';

function createRes() {
    const res = {};
    res.status = vi.fn(() => res);
    res.json = vi.fn(() => res);
    return res;
}

describe('Chats Mutations SQL Contracts', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        queryWithRLSMock.mockResolvedValue({ rows: [], rowCount: 1 });
        txQueryMock.mockResolvedValue({ rows: [], rowCount: 1 });
    });

    it('unpin usa placeholders correctos ($1,$2) sin parametro fantasma', async () => {
        const req = {
            anonymousId: 'user-1',
            params: { roomId: 'room-1' }
        };
        const res = createRes();

        await unpinRoom(req, res);

        expect(transactionWithRLSMock).toHaveBeenCalledTimes(1);
        expect(txQueryMock).toHaveBeenCalledTimes(1);
        const [sql, params] = txQueryMock.mock.calls[0];
        expect(sql).toContain('conversation_id = $1');
        expect(sql).toContain('user_id = $2');
        expect(params).toEqual(['room-1', 'user-1']);
        expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('unarchive usa placeholders correctos ($1,$2) sin parametro fantasma', async () => {
        const req = {
            anonymousId: 'user-1',
            params: { roomId: 'room-1' }
        };
        const res = createRes();

        await unarchiveRoom(req, res);

        expect(transactionWithRLSMock).toHaveBeenCalledTimes(1);
        expect(txQueryMock).toHaveBeenCalledTimes(1);
        const [sql, params] = txQueryMock.mock.calls[0];
        expect(sql).toContain('conversation_id = $1');
        expect(sql).toContain('user_id = $2');
        expect(params).toEqual(['room-1', 'user-1']);
        expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('archive usa placeholders correctos ($1,$2,$3) en tx', async () => {
        const req = {
            anonymousId: 'user-1',
            params: { roomId: 'room-1' },
            body: { isArchived: true }
        };
        const res = createRes();

        await archiveRoom(req, res);

        expect(transactionWithRLSMock).toHaveBeenCalledTimes(1);
        expect(txQueryMock).toHaveBeenCalledTimes(1);
        const [sql, params] = txQueryMock.mock.calls[0];
        expect(sql).toContain('SET is_archived = $1');
        expect(sql).toContain('conversation_id = $2');
        expect(sql).toContain('user_id = $3');
        expect(params).toEqual([true, 'room-1', 'user-1']);
        expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('setUnread normaliza undefined a true para evitar params indefinidos', async () => {
        const req = {
            anonymousId: 'user-1',
            params: { roomId: 'room-1' },
            body: {}
        };
        const res = createRes();

        await setUnreadRoom(req, res);

        expect(transactionWithRLSMock).toHaveBeenCalledTimes(1);
        expect(txQueryMock).toHaveBeenCalledTimes(1);
        const [sql, params] = txQueryMock.mock.calls[0];
        expect(sql).toContain('SET is_manually_unread = $1');
        expect(params).toEqual([true, 'room-1', 'user-1']);
        expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('setUnread respeta campo canonical unread=false (marcar como leido manual)', async () => {
        const req = {
            anonymousId: 'user-1',
            params: { roomId: 'room-1' },
            body: { unread: false }
        };
        const res = createRes();

        await setUnreadRoom(req, res);

        const [, params] = txQueryMock.mock.calls[0];
        expect(params).toEqual([false, 'room-1', 'user-1']);
        expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('setUnread acepta campo legacy isUnread=true (backward compatibility)', async () => {
        const req = {
            anonymousId: 'user-1',
            params: { roomId: 'room-1' },
            body: { isUnread: true }
        };
        const res = createRes();

        await setUnreadRoom(req, res);

        const [, params] = txQueryMock.mock.calls[0];
        expect(params).toEqual([true, 'room-1', 'user-1']);
        expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('deleteRoom usa placeholders correctos ($1,$2) en tx', async () => {
        const req = {
            anonymousId: 'user-1',
            params: { roomId: 'room-1' }
        };
        const res = createRes();

        await deleteRoom(req, res);

        expect(transactionWithRLSMock).toHaveBeenCalledTimes(1);
        expect(txQueryMock).toHaveBeenCalledTimes(1);
        const [sql, params] = txQueryMock.mock.calls[0];
        expect(sql).toContain('DELETE FROM conversation_members');
        expect(sql).toContain('conversation_id = $1');
        expect(sql).toContain('user_id = $2');
        expect(params).toEqual(['room-1', 'user-1']);
        expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('deleteRoom falla en tx y no emite side-effects', async () => {
        const req = {
            anonymousId: 'user-1',
            params: { roomId: 'room-1' }
        };
        const res = createRes();

        transactionWithRLSMock.mockRejectedValueOnce(new Error('FORCED_ROLLBACK'));

        await deleteRoom(req, res);

        expect(emitUserChatUpdateMock).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });

    it('deleteRoomMessage ejecuta tx unica y emite side-effects post-commit', async () => {
        const req = {
            anonymousId: 'user-1',
            params: { roomId: 'room-1', messageId: 'msg-1' }
        };
        const res = createRes();

        txQueryMock
            .mockResolvedValueOnce({ rows: [{ sender_id: 'user-1' }] })
            .mockResolvedValueOnce({ rowCount: 1 })
            .mockResolvedValueOnce({ rows: [{ user_id: 'user-1' }, { user_id: 'user-2' }] });

        await deleteRoomMessage(req, res);

        expect(transactionWithRLSMock).toHaveBeenCalledTimes(1);
        expect(txQueryMock).toHaveBeenCalledTimes(3);
        expect(txQueryMock.mock.calls[0][0]).toContain('SELECT sender_id FROM chat_messages');
        expect(txQueryMock.mock.calls[1][0]).toContain('DELETE FROM chat_messages');
        expect(txQueryMock.mock.calls[2][0]).toContain('SELECT user_id FROM conversation_members');
        expect(emitUserChatUpdateMock).toHaveBeenCalledTimes(2);
        expect(emitChatStatusMock).toHaveBeenCalledWith('update', 'room-1', {
            action: 'message-deleted',
            messageId: 'msg-1'
        });
        expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('deleteRoomMessage devuelve 403 y no emite side-effects si no es owner', async () => {
        const req = {
            anonymousId: 'user-1',
            params: { roomId: 'room-1', messageId: 'msg-1' }
        };
        const res = createRes();

        txQueryMock.mockResolvedValueOnce({ rows: [{ sender_id: 'otro-user' }] });

        await deleteRoomMessage(req, res);

        expect(transactionWithRLSMock).toHaveBeenCalledTimes(1);
        expect(txQueryMock).toHaveBeenCalledTimes(1);
        expect(emitUserChatUpdateMock).not.toHaveBeenCalled();
        expect(emitChatStatusMock).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden: You can only delete your own messages' });
    });

    it('deleteRoomMessage falla en tx y no emite side-effects', async () => {
        const req = {
            anonymousId: 'user-1',
            params: { roomId: 'room-1', messageId: 'msg-1' }
        };
        const res = createRes();

        transactionWithRLSMock.mockRejectedValueOnce(new Error('FORCED_ROLLBACK'));

        await deleteRoomMessage(req, res);

        expect(emitUserChatUpdateMock).not.toHaveBeenCalled();
        expect(emitChatStatusMock).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });

    it('editRoomMessage ejecuta update en tx y emite broadcast post-commit', async () => {
        const req = {
            anonymousId: 'user-1',
            params: { roomId: 'room-1', messageId: 'msg-1' },
            body: { content: 'mensaje editado' }
        };
        const res = createRes();

        txQueryMock
            .mockResolvedValueOnce({ rows: [{ sender_id: 'user-1', type: 'text', created_at: new Date().toISOString() }] })
            .mockResolvedValueOnce({ rows: [{ id: 'msg-1', content: 'mensaje editado', edited_at: new Date().toISOString() }] });

        await editRoomMessage(req, res);

        expect(transactionWithRLSMock).toHaveBeenCalledTimes(1);
        expect(txQueryMock).toHaveBeenCalledTimes(2);
        expect(txQueryMock.mock.calls[0][0]).toContain('SELECT sender_id, type, created_at FROM chat_messages');
        expect(txQueryMock.mock.calls[1][0]).toContain('UPDATE chat_messages');
        expect(broadcastMock).toHaveBeenCalledTimes(1);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            message: expect.objectContaining({ id: 'msg-1', content: 'mensaje editado' })
        });
    });

    it('editRoomMessage devuelve 403 y no emite broadcast si no es owner', async () => {
        const req = {
            anonymousId: 'user-1',
            params: { roomId: 'room-1', messageId: 'msg-1' },
            body: { content: 'mensaje editado' }
        };
        const res = createRes();

        txQueryMock.mockResolvedValueOnce({ rows: [{ sender_id: 'otro-user', type: 'text', created_at: new Date().toISOString() }] });

        await editRoomMessage(req, res);

        expect(transactionWithRLSMock).toHaveBeenCalledTimes(1);
        expect(txQueryMock).toHaveBeenCalledTimes(1);
        expect(broadcastMock).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ error: 'You can only edit your own messages' });
    });

    it('editRoomMessage falla en tx y no emite broadcast', async () => {
        const req = {
            anonymousId: 'user-1',
            params: { roomId: 'room-1', messageId: 'msg-1' },
            body: { content: 'mensaje editado' }
        };
        const res = createRes();

        transactionWithRLSMock.mockRejectedValueOnce(new Error('FORCED_ROLLBACK'));

        await editRoomMessage(req, res);

        expect(broadcastMock).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });

    it('pinRoomMessage valida mensaje y actualiza pin en tx, luego emite estado', async () => {
        const req = {
            anonymousId: 'user-1',
            params: { roomId: 'room-1', messageId: 'msg-1' }
        };
        const res = createRes();

        txQueryMock
            .mockResolvedValueOnce({ rows: [{ id: 'msg-1' }] })
            .mockResolvedValueOnce({ rowCount: 1 });

        await pinRoomMessage(req, res);

        expect(transactionWithRLSMock).toHaveBeenCalledTimes(1);
        expect(txQueryMock).toHaveBeenCalledTimes(2);
        expect(txQueryMock.mock.calls[0][0]).toContain('SELECT id FROM chat_messages');
        expect(txQueryMock.mock.calls[1][0]).toContain('UPDATE conversations SET pinned_message_id = $1');
        expect(emitChatStatusMock).toHaveBeenCalledWith('message-pinned', 'room-1', {
            pinnedMessageId: 'msg-1'
        });
        expect(res.json).toHaveBeenCalledWith({ success: true, pinnedMessageId: 'msg-1' });
    });

    it('pinRoomMessage devuelve 404 y no emite estado si mensaje no existe', async () => {
        const req = {
            anonymousId: 'user-1',
            params: { roomId: 'room-1', messageId: 'msg-404' }
        };
        const res = createRes();

        txQueryMock.mockResolvedValueOnce({ rows: [] });

        await pinRoomMessage(req, res);

        expect(transactionWithRLSMock).toHaveBeenCalledTimes(1);
        expect(txQueryMock).toHaveBeenCalledTimes(1);
        expect(emitChatStatusMock).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ error: 'Message not found in this conversation' });
    });

    it('pinRoomMessage falla en tx y no emite estado', async () => {
        const req = {
            anonymousId: 'user-1',
            params: { roomId: 'room-1', messageId: 'msg-1' }
        };
        const res = createRes();

        transactionWithRLSMock.mockRejectedValueOnce(new Error('FORCED_ROLLBACK'));

        await pinRoomMessage(req, res);

        expect(emitChatStatusMock).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });

    it('unpinRoomMessage limpia pin en tx y emite estado post-commit', async () => {
        const req = {
            anonymousId: 'user-1',
            params: { roomId: 'room-1' }
        };
        const res = createRes();

        txQueryMock.mockResolvedValueOnce({ rowCount: 1 });

        await unpinRoomMessage(req, res);

        expect(transactionWithRLSMock).toHaveBeenCalledTimes(1);
        expect(txQueryMock).toHaveBeenCalledTimes(1);
        expect(txQueryMock.mock.calls[0][0]).toContain('UPDATE conversations SET pinned_message_id = NULL');
        expect(emitChatStatusMock).toHaveBeenCalledWith('message-pinned', 'room-1', {
            pinnedMessageId: null
        });
        expect(res.json).toHaveBeenCalledWith({ success: true, pinnedMessageId: null });
    });

    it('unpinRoomMessage falla en tx y no emite estado', async () => {
        const req = {
            anonymousId: 'user-1',
            params: { roomId: 'room-1' }
        };
        const res = createRes();

        transactionWithRLSMock.mockRejectedValueOnce(new Error('FORCED_ROLLBACK'));

        await unpinRoomMessage(req, res);

        expect(emitChatStatusMock).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });

    it('starRoomMessage valida acceso e inserta en starred_messages dentro de tx', async () => {
        const req = {
            anonymousId: 'user-1',
            params: { roomId: 'room-1', messageId: 'msg-1' }
        };
        const res = createRes();

        txQueryMock
            .mockResolvedValueOnce({ rows: [{ id: 'msg-1' }] })
            .mockResolvedValueOnce({ rowCount: 1 });

        await starRoomMessage(req, res);

        expect(transactionWithRLSMock).toHaveBeenCalledTimes(1);
        expect(txQueryMock).toHaveBeenCalledTimes(2);
        expect(txQueryMock.mock.calls[0][0]).toContain('SELECT cm.id FROM chat_messages');
        expect(txQueryMock.mock.calls[1][0]).toContain('INSERT INTO starred_messages');
        expect(res.json).toHaveBeenCalledWith({ success: true, starred: true });
    });

    it('starRoomMessage devuelve 404 cuando no hay acceso al mensaje', async () => {
        const req = {
            anonymousId: 'user-1',
            params: { roomId: 'room-1', messageId: 'msg-404' }
        };
        const res = createRes();

        txQueryMock.mockResolvedValueOnce({ rows: [] });

        await starRoomMessage(req, res);

        expect(transactionWithRLSMock).toHaveBeenCalledTimes(1);
        expect(txQueryMock).toHaveBeenCalledTimes(1);
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ error: 'Message not found or access denied' });
    });

    it('unstarRoomMessage elimina registro en tx y responde contrato estable', async () => {
        const req = {
            anonymousId: 'user-1',
            params: { roomId: 'room-1', messageId: 'msg-1' }
        };
        const res = createRes();

        txQueryMock.mockResolvedValueOnce({ rowCount: 1 });

        await unstarRoomMessage(req, res);

        expect(transactionWithRLSMock).toHaveBeenCalledTimes(1);
        expect(txQueryMock).toHaveBeenCalledTimes(1);
        expect(txQueryMock.mock.calls[0][0]).toContain('DELETE FROM starred_messages');
        expect(res.json).toHaveBeenCalledWith({ success: true, starred: false });
    });

    it('createRoom (DM existente) responde 201 con room sin recrear membresias', async () => {
        const req = {
            anonymousId: 'user-1',
            body: { recipientId: 'user-2' }
        };
        const res = createRes();

        txQueryMock
            .mockResolvedValueOnce({ rows: [{ id: 'conv-1' }] }) // existing
            .mockResolvedValueOnce({ rows: [{ id: 'conv-1', unread_count: 0 }] }); // fullRoom

        await createRoom(req, res);

        expect(transactionWithRLSMock).toHaveBeenCalledTimes(1);
        expect(txQueryMock).toHaveBeenCalledTimes(2);
        expect(txQueryMock.mock.calls[0][0]).toContain('SELECT c.id FROM conversations c');
        expect(txQueryMock.mock.calls[1][0]).toContain('FROM conversations c');
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 'conv-1' }));
    });

    it('createRoom (report inexistente) mantiene contrato 404', async () => {
        const req = {
            anonymousId: 'user-1',
            body: { report_id: 'report-404' }
        };
        const res = createRes();

        txQueryMock.mockResolvedValueOnce({ rows: [] }); // report lookup

        await createRoom(req, res);

        expect(transactionWithRLSMock).toHaveBeenCalledTimes(1);
        expect(txQueryMock).toHaveBeenCalledTimes(1);
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ error: 'Report not found' });
    });

    it('toggleMessageReaction actualiza reactions en tx y emite estado', async () => {
        const req = {
            anonymousId: 'user-1',
            params: { roomId: 'room-1', messageId: 'msg-1' },
            body: { emoji: '👍' }
        };
        const res = createRes();

        txQueryMock
            .mockResolvedValueOnce({ rows: [{ reactions: {} }] })
            .mockResolvedValueOnce({ rowCount: 1 });

        await toggleMessageReaction(req, res);

        expect(transactionWithRLSMock).toHaveBeenCalledTimes(1);
        expect(txQueryMock).toHaveBeenCalledTimes(2);
        expect(txQueryMock.mock.calls[0][0]).toContain('SELECT reactions FROM chat_messages');
        expect(txQueryMock.mock.calls[1][0]).toContain('UPDATE chat_messages SET reactions = $1');
        expect(emitChatStatusMock).toHaveBeenCalledWith('message-reaction', 'room-1', {
            messageId: 'msg-1',
            emoji: '👍',
            userId: 'user-1',
            action: 'add',
            reactions: { '👍': ['user-1'] }
        });
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            reactions: { '👍': ['user-1'] },
            action: 'add'
        });
    });

    it('toggleMessageReaction devuelve 404 cuando mensaje no existe', async () => {
        const req = {
            anonymousId: 'user-1',
            params: { roomId: 'room-1', messageId: 'msg-404' },
            body: { emoji: '👍' }
        };
        const res = createRes();

        txQueryMock.mockResolvedValueOnce({ rows: [] });

        await toggleMessageReaction(req, res);

        expect(transactionWithRLSMock).toHaveBeenCalledTimes(1);
        expect(txQueryMock).toHaveBeenCalledTimes(1);
        expect(emitChatStatusMock).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ error: 'Message not found' });
    });

    it('toggleMessageReaction falla en tx y no emite side-effects', async () => {
        const req = {
            anonymousId: 'user-1',
            params: { roomId: 'room-1', messageId: 'msg-1' },
            body: { emoji: '👍' }
        };
        const res = createRes();

        transactionWithRLSMock.mockRejectedValueOnce(new Error('FORCED_ROLLBACK'));

        await toggleMessageReaction(req, res);

        expect(emitChatStatusMock).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });

    it('reconcileMessageStatus procesa delivered/read en tx por mensaje y mantiene summary', async () => {
        const req = {
            anonymousId: 'user-1',
            body: {
                delivered: ['m-delivered'],
                read: ['m-read']
            },
            headers: {}
        };
        const res = createRes();

        txQueryMock
            // delivered access check
            .mockResolvedValueOnce({
                rows: [{ id: 'm-delivered', sender_id: 'user-2', conversation_id: 'room-1', is_delivered: false, is_read: false }]
            })
            // delivered update
            .mockResolvedValueOnce({ rowCount: 1 })
            // read access check
            .mockResolvedValueOnce({
                rows: [{ id: 'm-read', sender_id: 'user-2', conversation_id: 'room-1', is_delivered: true, is_read: false }]
            })
            // read update
            .mockResolvedValueOnce({ rowCount: 1 });

        await reconcileMessageStatus(req, res);

        expect(transactionWithRLSMock).toHaveBeenCalledTimes(2);
        expect(emitMessageDeliveredMock).toHaveBeenCalledTimes(1);
        expect(emitMessageReadMock).toHaveBeenCalledTimes(1);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            summary: {
                delivered: { processed: 1, newlyReconciled: 1 },
                read: { processed: 1, newlyReconciled: 1 }
            }
        }));
    });

    it('reconcileMessageStatus registra fail not_found_or_no_access sin romper contrato', async () => {
        const req = {
            anonymousId: 'user-1',
            body: {
                delivered: ['m-404'],
                read: []
            },
            headers: {}
        };
        const res = createRes();

        txQueryMock.mockResolvedValueOnce({ rows: [] });

        await reconcileMessageStatus(req, res);

        expect(transactionWithRLSMock).toHaveBeenCalledTimes(1);
        expect(emitMessageDeliveredMock).not.toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            results: expect.objectContaining({
                delivered: expect.objectContaining({
                    failed: [{ messageId: 'm-404', reason: 'not_found_or_no_access' }]
                })
            })
        }));
    });

    it('getRoomMessages marca delivered en tx cuando hay mensajes pendientes de otro usuario', async () => {
        const req = {
            anonymousId: 'user-1',
            params: { roomId: 'room-1' },
            query: {}
        };
        const res = createRes();

        const rows = [
            { id: 'm1', sender_id: 'user-2', is_delivered: false },
            { id: 'm2', sender_id: 'user-1', is_delivered: false }
        ];
        queryWithRLSMock
            .mockResolvedValueOnce({ rows: [{ id: 'membership-ok' }] })
            .mockResolvedValueOnce({ rows });
        txQueryMock.mockResolvedValueOnce({ rowCount: 1 });

        await getRoomMessages(req, res);

        expect(queryWithRLSMock).toHaveBeenCalledTimes(2);
        expect(transactionWithRLSMock).toHaveBeenCalledTimes(1);
        expect(txQueryMock).toHaveBeenCalledTimes(1);
        expect(txQueryMock.mock.calls[0][0]).toContain('UPDATE chat_messages');
        expect(emitMessageDeliveredMock).toHaveBeenCalledTimes(1);
        expect(res.json).toHaveBeenCalledWith(expect.arrayContaining([
            expect.objectContaining({ id: 'm1', is_delivered: true })
        ]));
    });

    it('getRoomMessages no abre tx si no hay mensajes pendientes para delivered', async () => {
        const req = {
            anonymousId: 'user-1',
            params: { roomId: 'room-1' },
            query: {}
        };
        const res = createRes();

        queryWithRLSMock
            .mockResolvedValueOnce({ rows: [{ id: 'membership-ok' }] })
            .mockResolvedValueOnce({
                rows: [{ id: 'm1', sender_id: 'user-1', is_delivered: false }]
            });

        await getRoomMessages(req, res);

        expect(transactionWithRLSMock).not.toHaveBeenCalled();
        expect(emitMessageDeliveredMock).not.toHaveBeenCalled();
        expect(queryWithRLSMock).toHaveBeenCalledTimes(2);
        expect(res.json).toHaveBeenCalled();
    });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryWithRLSMock = vi.hoisted(() => vi.fn());
const txQueryMock = vi.hoisted(() => vi.fn());
const transactionWithRLSMock = vi.hoisted(() => vi.fn(async (_anonymousId, callback) => callback({ query: txQueryMock })));
const emitUserChatUpdateMock = vi.hoisted(() => vi.fn());
const emitChatStatusMock = vi.hoisted(() => vi.fn());
const broadcastMock = vi.hoisted(() => vi.fn());

vi.mock('../../src/utils/rls.js', () => ({
    queryWithRLS: queryWithRLSMock,
    transactionWithRLS: transactionWithRLSMock
}));

vi.mock('../../src/utils/eventEmitter.js', () => ({
    realtimeEvents: {
        emitUserChatUpdate: emitUserChatUpdateMock,
        emitChatStatus: emitChatStatusMock,
        broadcast: broadcastMock
    }
}));

import { unpinRoom, archiveRoom, unarchiveRoom, setUnreadRoom, deleteRoom, deleteRoomMessage, editRoomMessage } from '../../src/routes/chats.mutations.js';

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
});

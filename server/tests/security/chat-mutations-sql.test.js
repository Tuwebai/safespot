import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryWithRLSMock = vi.hoisted(() => vi.fn());
const txQueryMock = vi.hoisted(() => vi.fn());
const transactionWithRLSMock = vi.hoisted(() => vi.fn(async (_anonymousId, callback) => callback({ query: txQueryMock })));
const emitUserChatUpdateMock = vi.hoisted(() => vi.fn());

vi.mock('../../src/utils/rls.js', () => ({
    queryWithRLS: queryWithRLSMock,
    transactionWithRLS: transactionWithRLSMock
}));

vi.mock('../../src/utils/eventEmitter.js', () => ({
    realtimeEvents: {
        emitUserChatUpdate: emitUserChatUpdateMock
    }
}));

import { unpinRoom, unarchiveRoom, setUnreadRoom } from '../../src/routes/chats.mutations.js';

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

        expect(queryWithRLSMock).toHaveBeenCalledTimes(1);
        const [, sql, params] = queryWithRLSMock.mock.calls[0];
        expect(sql).toContain('conversation_id = $1');
        expect(sql).toContain('user_id = $2');
        expect(params).toEqual(['room-1', 'user-1']);
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
});

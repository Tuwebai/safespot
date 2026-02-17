import { beforeEach, describe, expect, it, vi } from 'vitest';

function buildAuthSession() {
  const now = Date.now();
  return {
    anonymousId: 'anon-1',
    authId: 'auth-1',
    jwt: 'jwt-token',
    sessionId: 'session-1',
    signature: 'sig-1',
    issuedAt: now,
    expiresAt: now + 60_000,
    userMetadata: {
      alias: 'Usuario Test',
      email: 'test@example.com',
      avatarUrl: null,
    },
  };
}

describe('session expired enterprise handling', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    (globalThis as { __SW_VERSION__?: string }).__SW_VERSION__ = 'test';
    delete (window as Window & { __REALTIME_ORCHESTRATOR_INSTANCE__?: unknown }).__REALTIME_ORCHESTRATOR_INSTANCE__;
  });

  it('limpia sesion y redirige a login ante 401 en apiRequest sin loop', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ message: 'invalid token' }),
      })
    );

    const { sessionAuthority } = await import('@/engine/session/SessionAuthority');
    const forceLogoutModule = await import('@/lib/auth/forceLogout');
    const { apiRequest } = await import('@/lib/api/index');
    const onForceLogout = vi.fn();
    window.addEventListener('safespot:force-logout', onForceLogout as EventListener);

    forceLogoutModule.resetForceLogoutStateForTests();
    sessionAuthority.setSession(buildAuthSession());
    localStorage.setItem('auth-storage', JSON.stringify({ state: { token: 'legacy', user: { id: 1 } } }));

    await expect(apiRequest('/auth/me')).rejects.toMatchObject({ statusCode: 401 });
    await expect(apiRequest('/reports')).rejects.toMatchObject({ statusCode: 401 });

    expect(sessionAuthority.getToken()?.jwt).toBeNull();
    expect(sessionAuthority.getAuthId()).toBeNull();
    expect(localStorage.getItem('auth-storage')).toBeNull();
    expect(onForceLogout).toHaveBeenCalledTimes(1);
    window.removeEventListener('safespot:force-logout', onForceLogout as EventListener);
  });

  it('ante 401 en catchup limpia sesion y dispara forced logout', async () => {
    localStorage.setItem('safespot_session_v3', JSON.stringify(buildAuthSession()));

    vi.doMock('@/lib/realtime/LocalProcessedLog', () => ({
      localProcessedLog: {
        getLastProcessedAt: vi.fn().mockResolvedValue(0),
        isEventProcessed: vi.fn().mockResolvedValue(false),
        markEventAsProcessed: vi.fn().mockResolvedValue(undefined),
        updateCursor: vi.fn().mockResolvedValue(undefined),
      },
    }));

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/realtime/catchup')) {
          return {
            ok: false,
            status: 401,
            statusText: 'Unauthorized',
            json: async () => ({}),
          } as Response;
        }
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({}),
        } as Response;
      })
    );

    const { sessionAuthority } = await import('@/engine/session/SessionAuthority');
    const forceLogoutModule = await import('@/lib/auth/forceLogout');
    const { realtimeOrchestrator } = await import('@/lib/realtime/RealtimeOrchestrator');
    const onForceLogout = vi.fn();
    window.addEventListener('safespot:force-logout', onForceLogout as EventListener);

    forceLogoutModule.resetForceLogoutStateForTests();
    sessionAuthority.setSession(buildAuthSession());
    expect(sessionAuthority.getToken()?.jwt).toBe('jwt-token');

    (realtimeOrchestrator as unknown as { userId: string }).userId = 'anon-1';
    await realtimeOrchestrator.resync();

    expect(sessionAuthority.getToken()?.jwt).toBeNull();
    expect(sessionAuthority.getAuthId()).toBeNull();
    expect(onForceLogout).toHaveBeenCalledTimes(1);
    realtimeOrchestrator.clear();
    window.removeEventListener('safespot:force-logout', onForceLogout as EventListener);
  });
});

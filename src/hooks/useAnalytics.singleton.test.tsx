import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

describe('useAnalytics singleton session', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    localStorage.setItem('safespot_anonymous_id', '11111111-1111-1111-1111-111111111111');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('inicia session una sola vez por pestaña y cierra solo en beforeunload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'ok' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { useAnalytics } = await import('./useAnalytics');

    const h1 = renderHook(() => useAnalytics());
    const h2 = renderHook(() => useAnalytics());

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const [startUrl, startOptions] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(startUrl).toContain('/api/analytics/session');
    expect(startOptions.method).toBe('POST');
    expect(String(startOptions.body)).toContain('"action":"start"');

    h1.unmount();
    h2.unmount();

    // No debe cerrar sesión por desmontaje de hooks
    expect(fetchMock).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event('beforeunload'));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    const [, endOptions] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(String(endOptions.body)).toContain('"action":"end"');
  });
});


import { useCallback } from 'react';
import { API_BASE_URL } from '@/lib/api/client';
import { sessionAuthority } from '@/engine/session/SessionAuthority';

type JsonRecord = Record<string, unknown>;

async function postJson<T>(endpoint: string, payload: JsonRecord, extraHeaders?: Record<string, string>): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(extraHeaders || {}),
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (data as { error?: string; message?: string }).error
      || (data as { error?: string; message?: string }).message
      || 'Ocurrió un error inesperado';
    throw new Error(message);
  }
  return data as T;
}

export function useAuthApi() {
  const login = useCallback((email: string, password: string) => {
    return postJson('/auth/login', { email, password });
  }, []);

  const register = useCallback((email: string, password: string, currentAnonymousId: string) => {
    return postJson('/auth/register', {
      email,
      password,
      current_anonymous_id: currentAnonymousId,
    });
  }, []);

  const forgotPassword = useCallback((email: string) => {
    return postJson('/auth/forgot-password', { email });
  }, []);

  const googleLogin = useCallback((accessToken: string, currentAnonymousId: string) => {
    return postJson('/auth/google', {
      google_access_token: accessToken,
      current_anonymous_id: currentAnonymousId,
    });
  }, []);

  const changePassword = useCallback((currentPassword: string, newPassword: string) => {
    const jwt = sessionAuthority.getToken()?.jwt;
    if (!jwt) {
      throw new Error('No hay sesión activa. Por favor inicia sesión nuevamente.');
    }
    return postJson('/auth/change-password', { currentPassword, newPassword }, {
      Authorization: `Bearer ${jwt}`,
    });
  }, []);

  const resetPassword = useCallback((token: string, email: string | null, newPassword: string) => {
    return postJson('/auth/reset-password', {
      token,
      email,
      newPassword,
    });
  }, []);

  return {
    login,
    register,
    forgotPassword,
    googleLogin,
    changePassword,
    resetPassword,
  };
}


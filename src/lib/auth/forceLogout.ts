import { sessionAuthority } from '@/engine/session/SessionAuthority';
import { trafficController } from '@/engine/traffic/TrafficController';
import { queryClient } from '@/lib/queryClient';

export type ForceLogoutReason = 'SESSION_EXPIRED' | 'MANUAL_LOGOUT';

interface ForceLogoutOptions {
  redirectToLogin?: boolean;
}

let isForceLogoutActive = false;

function isAuthRoute(pathname: string): boolean {
  return pathname.startsWith('/login') || pathname.startsWith('/register');
}

export function forceLogout(
  reason: ForceLogoutReason,
  options: ForceLogoutOptions = {}
): void {
  const { redirectToLogin = reason === 'SESSION_EXPIRED' } = options;

  if (isForceLogoutActive && reason === 'SESSION_EXPIRED') {
    return;
  }

  isForceLogoutActive = reason === 'SESSION_EXPIRED' || isForceLogoutActive;

  // Local-first teardown: clear identity/auth state immediately.
  sessionAuthority.logout();
  trafficController.clear();
  localStorage.removeItem('auth-storage');
  localStorage.setItem('safespot_auth_logout', 'true');
  void queryClient.cancelQueries();

  window.dispatchEvent(
    new CustomEvent('safespot:force-logout', { detail: { reason } })
  );

  if (redirectToLogin && !isAuthRoute(window.location.pathname)) {
    redirectToLoginPage('/login?reason=session-expired');
  }
}

export function redirectToLoginPage(target: string): void {
  window.location.replace(target);
}

export function resetForceLogoutStateForTests(): void {
  isForceLogoutActive = false;
}

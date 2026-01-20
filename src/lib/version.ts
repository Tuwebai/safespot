/**
 * Runtime Version Loader (Single Source of Truth)
 * 
 * This module is the ONLY authority on the current application version.
 * It combines build-time constants (injected by Vite) with runtime checks.
 */

// Global Type Definition for consistency
export interface AppVersionInfo {
    deployId: string; // SSOT: ISO timestamp of deploy (e.g., "2026-01-20T18:42:31Z")
    appVersion: string; // SemVer for display (e.g., "2.4.0")
    environment: 'development' | 'production'; // Runtime environment
    buildHash?: string; // Optional: for debugging only
}

// 1. STATIC CONSTANTS (Available immediately, zero latency)
// These come from import.meta.env injected by Vite at build time.
// @ts-ignore - Injected by Vite
const STATIC_DEPLOY_ID = import.meta.env.APP_DEPLOY_ID || new Date().toISOString();
// @ts-ignore - Injected by Vite
const STATIC_APP_VERSION = import.meta.env.APP_VERSION || '0.0.0-dev';
// @ts-ignore - Injected by Vite
const STATIC_ENVIRONMENT = import.meta.env.MODE as 'development' | 'production';
// @ts-ignore - Injected by Vite (optional, for debugging)
const STATIC_BUILD_HASH = import.meta.env.APP_BUILD_HASH || 'dev-hash';

export const AppVersion: AppVersionInfo = {
    deployId: STATIC_DEPLOY_ID,
    appVersion: STATIC_APP_VERSION,
    environment: STATIC_ENVIRONMENT,
    buildHash: STATIC_BUILD_HASH
};

/**
 * Fetch the REMOTE version.json to check for new deploys.
 * Bypasses browser cache using no-store.
 */
export async function fetchRemoteVersion(): Promise<AppVersionInfo | null> {
    try {
        const res = await fetch('/version.json', { cache: 'no-store' });
        if (!res.ok) throw new Error('Version file 404');

        // Safety: Check content type to avoid parsing HTML SPA fallback
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('text/html')) {
            console.warn('[VersionLoader] Got HTML instead of JSON. SPA Fallback detected.');
            return null;
        }

        const data = await res.json();
        return {
            deployId: data.deployId,
            appVersion: data.appVersion,
            environment: data.environment || 'production',
            buildHash: data.buildHash // Optional
        };
    } catch (e) {
        console.warn('[VersionLoader] Failed to fetch remote version:', e);
        return null; // Fail safe
    }
}

/**
 * Check if we are running the latest deploy.
 * Returns TRUE if we match the remote deployId.
 */
export async function isLatestDeploy(): Promise<boolean> {
    const remote = await fetchRemoteVersion();
    if (!remote) return true; // Assume we are current if we can't check

    return remote.deployId === AppVersion.deployId;
}

// FORMATTED STRING FOR UI
export const APP_VERSION_DISPLAY = `v${AppVersion.appVersion} (${AppVersion.deployId.substring(0, 10)})`;

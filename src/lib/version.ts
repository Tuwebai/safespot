/**
 * Runtime Version Loader (Single Source of Truth)
 * 
 * This module is the ONLY authority on the current application version.
 * It combines build-time constants (injected by Vite) with runtime checks.
 */

// Global Type Definition for consistency
export interface AppVersionInfo {
    version: string;
    buildHash: string;
    buildTime: string;
    severity?: 'minor' | 'breaking'; // New Enterprise Field
}

// 1. STATIC CONSTANTS (Available immediately, zero latency)
// These come from import.meta.env injected by Vite at build time.
// @ts-ignore - Injected by Vite
const STATIC_VERSION = import.meta.env.APP_VERSION || '0.0.0-dev';
// @ts-ignore - Injected by Vite
const STATIC_HASH = import.meta.env.APP_BUILD_HASH || 'dev-hash';
// @ts-ignore - Injected by Vite
const STATIC_TIME = import.meta.env.APP_BUILD_TIME || new Date().toISOString();

export const AppVersion: AppVersionInfo = {
    version: STATIC_VERSION,
    buildHash: STATIC_HASH,
    buildTime: STATIC_TIME
};

/**
 * Fetch the REMOTE version.json to check for updates.
 * Bypasses browser cache using timestamp.
 */
export async function fetchRemoteVersion(): Promise<AppVersionInfo | null> {
    try {
        const res = await fetch(`/version.json?t=${Date.now()}`);
        if (!res.ok) throw new Error('Version file 404');

        // Safety: Check content type to avoid parsing HTML SPA fallback
        // (Though Vite middleware fix should prevent this in dev)
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('text/html')) {
            console.warn('[VersionLoader] Got HTML instead of JSON. SPA Fallback detected.');
            return null;
        }

        const data = await res.json();
        return {
            version: data.version,
            buildHash: data.buildHash,
            buildTime: data.buildTime,
            severity: data.severity || 'minor' // Default to minor
        };
    } catch (e) {
        console.warn('[VersionLoader] Failed to fetch remote version:', e);
        return null; // Fail safe
    }
}

/**
 * Check if we are running the latest version.
 * Returns TRUE if we match the remote version.
 */
export async function isLatestVersion(): Promise<boolean> {
    const remote = await fetchRemoteVersion();
    if (!remote) return true; // Assume we are efficient if we can't check

    return remote.buildHash === AppVersion.buildHash;
}

// FORMATTED STRING FOR UI
export const APP_VERSION_DISPLAY = `v${AppVersion.version} (${AppVersion.buildHash})`;

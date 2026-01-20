/**
 * Enterprise Update Manager - Silent Deploy-Based Updates
 * 
 * CRITICAL PRINCIPLES:
 * 1. deployId is SSOT (not buildHash)
 * 2. 1 deploy = 1 reload maximum per client
 * 3. SILENT updates (NO banners, NO prompts)
 * 4. DEV mode = DISABLED completely
 * 5. Polling every 5 minutes (PROD only)
 * 
 * ANTI-PATTERNS ELIMINATED:
 * ❌ buildHash comparison
 * ❌ Banners/prompts
 * ❌ Updates in DEV
 * ❌ sessionStorage loops
 * ❌ Reactive updates
 */

import { AppVersion, fetchRemoteVersion } from './version';
import * as Sentry from '@sentry/react';

// Enterprise constants
const DEPLOY_STORAGE_KEY = 'safespot_last_applied_deploy_id';
const POLLING_INTERVAL_PROD = 5 * 60 * 1000; // 5 minutes (PROD only)

class UpdateManager {
    private intervalId: number | null = null;

    /**
     * Initialize the UpdateManager
     * 
     * CRITICAL: Only runs in PRODUCTION
     * DEV mode exits immediately (HMR handles updates)
     */
    async init() {
        // 1. DEV MODE: Hard exit
        if (AppVersion.environment === 'development') {
            console.info('[UpdateManager] DEV mode → updates DISABLED (HMR active)');
            return;
        }

        console.log('[UpdateManager] PROD mode → silent deploy tracking enabled');

        // 2. Check immediately on boot
        await this.checkForDeployUpdate();

        // 3. Start polling (PROD only, every 5 minutes)
        this.intervalId = window.setInterval(() => {
            this.checkForDeployUpdate();
        }, POLLING_INTERVAL_PROD);

        console.log(`[UpdateManager] Polling every ${POLLING_INTERVAL_PROD / 1000}s`);
    }

    /**
     * Check for new deploy and apply silently
     * 
     * CRITICAL LOGIC:
     * - Compare deployId (NOT buildHash)
     * - Persist baseline BEFORE reload
     * - Silent reload (NO banner)
     * - 1 deploy = 1 reload max
     */
    private async checkForDeployUpdate() {
        try {
            // 1. Fetch server version
            const remote = await fetchRemoteVersion();

            if (!remote) {
                console.log('[UpdateManager] Could not fetch remote version');
                return;
            }

            // 2. Read local baseline
            const lastAppliedDeploy = localStorage.getItem(DEPLOY_STORAGE_KEY);

            // 3. Same deploy → DO NOTHING
            if (lastAppliedDeploy === remote.deployId) {
                // Silent - no logs unless debugging
                return;
            }

            // 4. NEW DEPLOY DETECTED (EDGE CASE)
            console.warn(
                '[UpdateManager] 🚀 New deploy detected!',
                `Last applied: ${lastAppliedDeploy || 'none'}`,
                `→ New: ${remote.deployId}`
            );

            // ✅ OBSERVABILITY: Track version mismatch
            if (AppVersion.environment === 'production') {
                Sentry.captureMessage('VERSION_MISMATCH', {
                    level: 'info',
                    extra: {
                        localDeployId: AppVersion.deployId,
                        remoteDeployId: remote.deployId,
                        appVersion: AppVersion.appVersion,
                        environment: AppVersion.environment,
                        lastAppliedDeploy: lastAppliedDeploy || 'none'
                    }
                });
            }

            // 5. CRITICAL: Persist baseline FIRST (before reload)
            // This ensures we only reload ONCE per deploy
            localStorage.setItem(DEPLOY_STORAGE_KEY, remote.deployId);
            console.log('[UpdateManager] Deploy baseline persisted');

            // 6. Silent hard update (NO banner, NO prompt)
            await this.forceSilentUpdate();

        } catch (error) {
            console.error('[UpdateManager] Error checking for deploy update:', error);
        }
    }

    /**
     * Force silent update
     * 
     * NO banner
     * NO prompt
     * NO user interaction
     * 
     * Just: cleanup → reload
     */
    private async forceSilentUpdate() {
        console.log('[UpdateManager] Applying new deploy silently...');

        // ✅ OBSERVABILITY: Track forced update
        if (AppVersion.environment === 'production') {
            Sentry.captureMessage('FORCED_UPDATE', {
                level: 'warning',
                extra: {
                    deployId: AppVersion.deployId,
                    reason: 'new_deploy_detected',
                    environment: AppVersion.environment
                }
            });
        }

        try {
            // 1. Unregister ALL Service Workers
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map(r => r.unregister()));
            console.log('[UpdateManager] ✅ Unregistered all SWs');

            // 2. Clear ALL caches
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => caches.delete(name)));
            console.log('[UpdateManager] ✅ Cleared all caches');

            // 3. Hard reload (silent, no banner)
            // Use location.replace() to prevent back button issues
            window.location.replace(window.location.href);

        } catch (error) {
            console.error('[UpdateManager] Error during silent update:', error);
            // Fallback: just reload
            window.location.replace(window.location.href);
        }
    }

    /**
     * Cleanup on unmount
     */
    destroy() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
}

// Singleton instance
export const updateManager = new UpdateManager();

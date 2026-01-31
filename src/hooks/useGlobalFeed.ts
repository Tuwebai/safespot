import { useEffect } from 'react'
import { telemetry, TelemetrySeverity } from '@/lib/telemetry/TelemetryEngine'

/**
 * 👑 Unified Passive Sync Refactor:
 * useGlobalFeed is now a PASSIVE shell. 
 * All logic has been migrated to the authoritative RealtimeOrchestrator
 * to ensure PERSIST-then-NOTIFY and Resync/Catchup support.
 */
export function useGlobalFeed() {
    useEffect(() => {
        // This hook is now a no-op as the Orchestrator handles everything globally.
        // We keep it here to avoid breaking imports in Layout/App, but it does nothing.
        telemetry.emit({
            engine: 'UI-Hook',
            severity: TelemetrySeverity.DEBUG,
            payload: { action: 'useGlobalFeed_mounted_passive' }
        });
    }, [])
}

export interface ReportErrorParams {
    title: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    metadata?: Record<string, unknown>;
}

/**
 * ✅ PUBLIC TELEMETRY ENGINE
 * Allows reporting of frontend issues to the management system.
 * This is a public utility and does NOT contain administrative logic.
 */
export const reportFrontendError = async ({
    title,
    description,
    severity,
    metadata = {}
}: ReportErrorParams) => {
    try {
        // We use a public endpoint if available, or the general admin task endpoint
        // NOTE: The backend handles authorization for WRITE access if needed.
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/tasks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                title: `[FE] ${title}`,
                description,
                severity,
                source: 'frontend',
                metadata: {
                    ...metadata,
                    url: window.location.href,
                    userAgent: navigator.userAgent,
                    timestamp: new Date().toISOString()
                }
            })
        });

        if (!response.ok) {
            // Failure is handled silently to avoid breaking the UX during an error
            console.warn('[Telemetry] Report rejected by gateway');
        }
    } catch (err) {
        console.warn('[Telemetry] Uplink failure:', err);
    }
};

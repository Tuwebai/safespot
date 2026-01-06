/**
 * Utility to report frontend errors to the Admin Task System
 */

interface ReportErrorParams {
    title: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    metadata?: any;
}

export const reportFrontendError = async ({
    title,
    description,
    severity,
    metadata = {}
}: ReportErrorParams) => {
    try {
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
            console.error('Failed to report frontend error to admin system');
        }
    } catch (err) {
        console.error('Error reporting to admin system:', err);
    }
};

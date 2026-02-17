import React, { Suspense } from 'react';
import { useHomeDataQuery } from '@/hooks/queries/useHomeDataQuery';
import { HeroSection } from './HeroSection';
import { OperationalFlow } from './OperationalFlow';
import { UrgentReportButton } from '@/components/urgent-mode/UrgentReportButton';
import { useLocationAuthority } from '@/hooks/useLocationAuthority';
import { lazyRetry } from '@/lib/lazyRetry';

// Lazy Load Heavy/Secondary Components for LCP Optimization
// Using adapter for named exports
const LiveTicker = React.lazy(() => import('./LiveTicker').then(module => ({ default: module.LiveTicker })));
const BentoGrid = React.lazy(() => import('./BentoGrid').then(module => ({ default: module.BentoGrid })));
const SafetyIntel = React.lazy(() => import('./SafetyIntel').then(module => ({ default: module.SafetyIntel })));
const UrgentReportDialog = lazyRetry(
    () => import('@/components/urgent-mode/UrgentReportDialog').then(module => ({ default: module.UrgentReportDialog })),
    'UrgentReportDialog'
);

export const HomeOrchestrator: React.FC = () => {
    const { data, isLoading, error } = useHomeDataQuery();
    const [showUrgent, setShowUrgent] = React.useState(false);
    const { position } = useLocationAuthority({ autoRequest: true });

    if (error) {
        console.error("Home Data Error:", error);
    }

    // Initial Loading State (Critical Path only)
    if (isLoading || !data) {
        return (
            <div className="min-h-screen bg-dark-bg flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-neon-green/30 border-t-neon-green rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-dark-bg text-foreground overflow-x-hidden relative">
            <main className="flex flex-col gap-0 relative">
                {/* 1. Hero (Instant, Eager) */}
                <HeroSection
                    activeUsers={data.activeUsersCount}
                    totalReports={data.stats?.total_reports || 0}
                />

                {/* 2. Live Ticker (Deferred) */}
                <Suspense fallback={<div className="h-12 w-full bg-transparent" />}>
                    <LiveTicker reports={data.recentReports} />
                </Suspense>

                {/* 3. Operational Flow (Static, Eager) */}
                <OperationalFlow />

                <div className="container mx-auto px-4 py-12 md:py-20 space-y-20">
                    {/* 4. Bento Grid (Lazy) */}
                    <section id="features" className="scroll-mt-20">
                        <Suspense fallback={<div className="h-[600px] w-full rounded-3xl bg-card/5 animate-pulse" />}>
                            <BentoGrid heatmapReports={data.heatmapReports} />
                        </Suspense>
                    </section>

                    {/* 5. Safety Intel (Lazy) */}
                    <section id="intel">
                        <Suspense fallback={<div className="h-[400px] w-full rounded-2xl bg-card/5 animate-pulse" />}>
                            <SafetyIntel />
                        </Suspense>
                    </section>
                </div>
            </main>

            {/* 🚨 SOS Floating Button (Home Screen) */}
            <UrgentReportButton
                onClick={() => setShowUrgent(true)}
                className="fixed bottom-24 right-4 z-[9999] md:bottom-8 md:right-8"
            />

            {showUrgent && (
                <Suspense fallback={null}>
                    <UrgentReportDialog
                        isOpen={showUrgent}
                        onClose={() => setShowUrgent(false)}
                        currentLocation={position ? { lat: position.lat, lng: position.lng } : null}
                    />
                </Suspense>
            )}
        </div>
    );
};

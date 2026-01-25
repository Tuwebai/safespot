import { useEffect, useState } from 'react';
import { bootstrapManager, BootstrapState } from '@/lib/lifecycle/ApplicationBootstrap';

export function useBootstrapState() {
    const [state, setState] = useState<BootstrapState>(bootstrapManager.getState());

    useEffect(() => {
        return bootstrapManager.subscribe(setState);
    }, []);

    return state;
}

/**
 * Hook to manually trigger recovery/checks if needed by specific components
 */
export function useLifecycleControl() {
    return {
        recover: () => bootstrapManager.recover(),
    };
}

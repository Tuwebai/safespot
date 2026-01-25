import { ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

/**
 * IdentityInitializer (Deprecated)
 * 
 * Logic moved to ApplicationBootstrapManager.
 * This component remains as a pass-through to prevent breaking existing imports.
 */
export function IdentityInitializer({ children }: Props) {
    return <>{children}</>;
}

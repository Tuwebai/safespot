import { Component, ErrorInfo, ReactNode } from 'react';
import { GlobalErrorFallback } from './GlobalErrorFallback';
import * as Sentry from '@sentry/react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

/**
 * 🛡️ GLOBAL ERROR BOUNDARY
 * 
 * Última línea de defensa. Si algo explota en React, esto lo atrapa
 * y muestra una UI digna en lugar de una pantalla blanca.
 */
export class GlobalErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('[GlobalErrorBoundary] 💥 Uncaught error:', error, errorInfo);

        // Report to Sentry in production
        Sentry.captureException(error, {
            extra: {
                componentStack: errorInfo.componentStack
            }
        });
    }

    public resetErrorBoundary = () => {
        this.setState({ hasError: false, error: null });
        window.location.reload();
    };

    public render() {
        if (this.state.hasError) {
            return (
                <GlobalErrorFallback
                    error={this.state.error || undefined}
                    resetErrorBoundary={this.resetErrorBoundary}
                />
            );
        }

        return this.props.children;
    }
}

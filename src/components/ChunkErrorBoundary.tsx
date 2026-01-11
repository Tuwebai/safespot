import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './ui/button';
import { FeedbackState } from './ui/feedback-state';
import { reportFrontendError } from '@/lib/adminTasks';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    errorType: 'chunk' | 'generic' | null;
}

export class ChunkErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        errorType: null
    };

    public static getDerivedStateFromError(error: Error): State {
        // Check if it's a chunk loading error (common in production when redeploying)
        const isChunkError =
            error.name === 'ChunkLoadError' ||
            (error.message && (
                error.message.includes('Loading chunk') ||
                error.message.includes('Failed to fetch dynamically imported module')
            ));

        return {
            hasError: true,
            errorType: isChunkError ? 'chunk' : 'generic'
        };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('[ChunkErrorBoundary] Uncaught error:', error, errorInfo);

        // Auto-report to Admin System
        reportFrontendError({
            title: `React Error: ${error.name}`,
            description: error.message,
            severity: error.name === 'ChunkLoadError' ? 'high' : 'critical',
            metadata: {
                componentStack: errorInfo.componentStack
            }
        }).catch(console.error);
    }

    private handleRetry = () => {
        if (this.state.errorType === 'chunk') {
            // Prevent infinite loops: check if we just reloaded
            const lastReload = sessionStorage.getItem('chunk_reload_ts');
            const now = Date.now();

            if (lastReload && (now - parseInt(lastReload)) < 10000) {
                // If we reloaded less than 10 seconds ago, don't do it again automatically
                // Just clear the flag so the button works next time
                sessionStorage.removeItem('chunk_reload_ts');
                // Force a hard reload ignoring cache
                window.location.href = window.location.href;
                return;
            }

            sessionStorage.setItem('chunk_reload_ts', String(now));
            window.location.reload();
        } else {
            this.setState({ hasError: false, errorType: null });
        }
    };

    public componentDidUpdate(_prevProps: Props, prevState: State) {
        if (this.state.hasError && this.state.errorType === 'chunk' && !prevState.hasError) {
            // Auto-retry logic directly on error detection (optional, but effectively handled by the button or render logic)
            // We'll leave the auto-reload to the user interaction or specific lifecycle if needed.
            // For now, let's auto-trigger the retry if it's the first time
            const lastReload = sessionStorage.getItem('chunk_reload_ts');
            if (!lastReload) {
                this.handleRetry();
            }
        }
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="container mx-auto px-4 py-20 flex items-center justify-center min-h-[50vh]">
                    <FeedbackState
                        state="error"
                        title={this.state.errorType === 'chunk' ? 'Error de actualización' : 'Algo salió mal'}
                        description={
                            this.state.errorType === 'chunk'
                                ? 'Se ha publicado una nueva versión de la aplicación. Necesitamos recargar la página para continuar.'
                                : 'Hubo un error al cargar esta sección. Por favor, intenta de nuevo.'
                        }
                        action={
                            <Button onClick={this.handleRetry} variant="neon">
                                {this.state.errorType === 'chunk' ? 'Recargar Aplicación' : 'Reintentar'}
                            </Button>
                        }
                    />
                </div>
            );
        }

        return this.props.children;
    }
}

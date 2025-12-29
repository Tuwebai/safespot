import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './ui/button';
import { FeedbackState } from './ui/feedback-state';

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

    public static getDerivedStateFromError(error: any): State {
        // Check if it's a chunk loading error (common in production when redeploying)
        const isChunkError =
            error.name === 'ChunkLoadError' ||
            error.message?.includes('Loading chunk') ||
            error.message?.includes('Failed to fetch dynamically imported module');

        return {
            hasError: true,
            errorType: isChunkError ? 'chunk' : 'generic'
        };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('[ChunkErrorBoundary] Uncaught error:', error, errorInfo);
    }

    private handleRetry = () => {
        if (this.state.errorType === 'chunk') {
            // For chunk errors, often a simple reload fixes it as it gets the latest manifest
            window.location.reload();
        } else {
            this.setState({ hasError: false, errorType: null });
        }
    };

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

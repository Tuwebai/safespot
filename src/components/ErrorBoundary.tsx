import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './ui/button';
import { RefreshCcw, Home, AlertTriangle } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallbackTitle?: string;
    onReset?: () => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    private handleRetry = () => {
        this.setState({ hasError: false, error: null });
        if (this.props.onReset) {
            this.props.onReset();
        }
    };

    private handleGoHome = () => {
        window.location.href = '/';
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center animate-in fade-in duration-500">
                    <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mb-6">
                        <AlertTriangle className="w-8 h-8" />
                    </div>

                    <h2 className="text-2xl font-bold mb-2 text-white">
                        {this.props.fallbackTitle || 'Algo salió mal'}
                    </h2>

                    <p className="text-muted-foreground max-w-md mb-8">
                        Lo sentimos, hubo un error al cargar esta sección. Por favor, intenta de nuevo o vuelve al inicio.
                    </p>

                    {import.meta.env.DEV && this.state.error && (
                        <div className="mb-8 p-4 bg-dark-bg/50 border border-dark-border rounded text-left text-xs text-red-400 overflow-auto max-w-full font-mono">
                            {this.state.error.toString()}
                        </div>
                    )}

                    <div className="flex flex-wrap gap-4 justify-center">
                        <Button onClick={this.handleRetry} variant="neon" className="gap-2">
                            <RefreshCcw className="w-4 h-4" />
                            Reintentar
                        </Button>

                        <Button onClick={this.handleGoHome} variant="outline" className="gap-2 text-white">
                            <Home className="w-4 h-4" />
                            Volver al inicio
                        </Button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

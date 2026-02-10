/**
 * 🏛️ SAFE MODE: CommunityErrorBoundary - Error Handling Enterprise
 * 
 * Error boundary específico para la sección de comunidad.
 * Reporta a telemetry y ofrece retry graceful.
 * 
 * @version 1.0 - Error Resilience
 */

import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { telemetry, TelemetrySeverity } from '@/lib/telemetry/TelemetryEngine';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    onReset?: () => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class CommunityErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // Report to telemetry
        telemetry.emit({
            engine: 'CommunityUI',
            severity: TelemetrySeverity.ERROR,
            payload: {
                action: 'community_render_error',
                error: error.message,
                stack: error.stack,
                componentStack: errorInfo.componentStack
            }
        });
    }

    private handleReset = () => {
        this.setState({ hasError: false, error: null });
        this.props.onReset?.();
    };

    public render() {
        if (this.state.hasError) {
            // Custom fallback UI
            return this.props.fallback || (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                    <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                        <AlertTriangle className="w-8 h-8 text-destructive" />
                    </div>
                    
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                        No pudimos cargar la comunidad
                    </h3>
                    
                    <p className="text-sm text-muted-foreground mb-6 max-w-xs">
                        Hubo un error inesperado. Intentá de nuevo o contactá soporte si el problema persiste.
                    </p>
                    
                    <div className="flex gap-3">
                        <Button
                            onClick={this.handleReset}
                            variant="outline"
                            className="border-neon-green/30 hover:bg-neon-green/5"
                        >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Intentar de nuevo
                        </Button>
                        
                        <Button
                            onClick={() => window.location.reload()}
                            variant="ghost"
                            className="text-muted-foreground"
                        >
                            Recargar página
                        </Button>
                    </div>
                    
                    {process.env.NODE_ENV === 'development' && this.state.error && (
                        <div className="mt-6 p-4 rounded bg-muted text-left overflow-auto max-w-md">
                            <p className="text-xs font-mono text-destructive">
                                {this.state.error.message}
                            </p>
                        </div>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}

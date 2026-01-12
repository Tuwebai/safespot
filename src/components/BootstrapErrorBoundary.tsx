import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2, Copy, CheckCircle2 } from 'lucide-react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: React.ErrorInfo | null;
    copied: boolean;
}

/**
 * BootstrapErrorBoundary
 * 
 * Catches catastrophic errors during application bootstrap and initial render.
 * Provides user-facing recovery UI instead of blank white screen.
 * 
 * @invariant This is the OUTERMOST error boundary - must not rely on ANY app context
 */
export class BootstrapErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
            copied: false,
        };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return {
            hasError: true,
            error,
        };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('[BootstrapErrorBoundary] Catastrophic error:', error, errorInfo);

        this.setState({
            error,
            errorInfo,
        });

        // Fire-and-forget diagnostic logging (don't block UI)
        this.logErrorToBackend(error, errorInfo);
    }

    logErrorToBackend(error: Error, errorInfo: React.ErrorInfo) {
        try {
            const diagnosticData = {
                type: 'bootstrap_failure',
                error: {
                    message: error.message,
                    stack: error.stack,
                },
                componentStack: errorInfo.componentStack,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                url: window.location.href,
            };

            // Fire-and-forget - don't wait for response
            fetch('/api/diagnostics/bootstrap-failure', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(diagnosticData),
            }).catch(() => {
                // Silently fail - we're already in error state
            });
        } catch (e) {
            // Don't let logging errors break the error UI
        }
    }

    handleClearCacheAndReload = async () => {
        try {
            // Clear all storage layers
            localStorage.clear();
            sessionStorage.clear();

            // Clear all cookies
            document.cookie.split(';').forEach((c) => {
                document.cookie = c
                    .replace(/^ +/, '')
                    .replace(/=.*/, `=;expires=${new Date().toUTCString()};path=/`);
            });

            // Clear IndexedDB
            if ('indexedDB' in window) {
                const databases = await indexedDB.databases();
                databases.forEach((db) => {
                    if (db.name) {
                        indexedDB.deleteDatabase(db.name);
                    }
                });
            }

            // Clear Service Worker caches
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                await Promise.all(cacheNames.map((name) => caches.delete(name)));
            }

            // Unregister Service Worker
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                await Promise.all(registrations.map((reg) => reg.unregister()));
            }

            // Hard reload
            window.location.reload();
        } catch (e) {
            console.error('Failed to clear cache:', e);
            // Fallback: just reload
            window.location.reload();
        }
    };

    handleSimpleReload = () => {
        window.location.reload();
    };

    handleCopyError = () => {
        const errorText = `SafeSpot Bootstrap Error

Error: ${this.state.error?.message || 'Unknown error'}

Stack:
${this.state.error?.stack || 'No stack trace'}

Component Stack:
${this.state.errorInfo?.componentStack || 'No component stack'}

User Agent: ${navigator.userAgent}
URL: ${window.location.href}
Time: ${new Date().toISOString()}
`;

        navigator.clipboard.writeText(errorText).then(() => {
            this.setState({ copied: true });
            setTimeout(() => this.setState({ copied: false }), 2000);
        });
    };

    render() {
        if (!this.state.hasError) {
            return this.props.children;
        }

        // Inline styles to avoid relying on app CSS (may not be loaded)
        const containerStyle: React.CSSProperties = {
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            padding: '1rem',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        };

        const cardStyle: React.CSSProperties = {
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '0.75rem',
            padding: '2rem',
            maxWidth: '42rem',
            width: '100%',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        };

        const iconStyle: React.CSSProperties = {
            width: '3rem',
            height: '3rem',
            color: '#ef4444',
            marginBottom: '1rem',
        };

        const titleStyle: React.CSSProperties = {
            fontSize: '1.5rem',
            fontWeight: '700',
            color: '#f1f5f9',
            marginBottom: '0.5rem',
        };

        const descStyle: React.CSSProperties = {
            color: '#94a3b8',
            marginBottom: '1.5rem',
            lineHeight: '1.5',
        };

        const buttonBaseStyle: React.CSSProperties = {
            padding: '0.75rem 1.5rem',
            borderRadius: '0.5rem',
            fontWeight: '600',
            cursor: 'pointer',
            border: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.875rem',
            transition: 'all 0.2s',
        };

        const primaryButtonStyle: React.CSSProperties = {
            ...buttonBaseStyle,
            backgroundColor: '#00ff88',
            color: '#0f172a',
        };

        const secondaryButtonStyle: React.CSSProperties = {
            ...buttonBaseStyle,
            backgroundColor: '#334155',
            color: '#f1f5f9',
        };

        const buttonRowStyle: React.CSSProperties = {
            display: 'flex',
            gap: '0.75rem',
            marginBottom: '1rem',
            flexWrap: 'wrap',
        };

        const errorBoxStyle: React.CSSProperties = {
            backgroundColor: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '0.5rem',
            padding: '1rem',
            marginTop: '1rem',
            maxHeight: '12rem',
            overflow: 'auto',
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            color: '#ef4444',
            lineHeight: '1.5',
        };

        return (
            <div style={containerStyle}>
                <div style={cardStyle}>
                    <AlertTriangle style={iconStyle} />

                    <h1 style={titleStyle}>Error crítico de inicialización</h1>

                    <p style={descStyle}>
                        La aplicación encontró un error al inicializarse. Esto puede deberse a datos corruptos
                        en el caché del navegador o un problema temporal.
                    </p>

                    <div style={buttonRowStyle}>
                        <button
                            onClick={this.handleClearCacheAndReload}
                            style={primaryButtonStyle}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#00e67a';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#00ff88';
                            }}
                        >
                            <Trash2 size={16} />
                            Limpiar caché y recargar
                        </button>

                        <button
                            onClick={this.handleSimpleReload}
                            style={secondaryButtonStyle}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#475569';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#334155';
                            }}
                        >
                            <RefreshCw size={16} />
                            Solo recargar
                        </button>
                    </div>

                    <button
                        onClick={this.handleCopyError}
                        style={{
                            ...secondaryButtonStyle,
                            width: '100%',
                            justifyContent: 'center',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#475569';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#334155';
                        }}
                    >
                        {this.state.copied ? (
                            <>
                                <CheckCircle2 size={16} />
                                Copiado al portapapeles
                            </>
                        ) : (
                            <>
                                <Copy size={16} />
                                Copiar detalles del error
                            </>
                        )}
                    </button>

                    {/* Error details (collapsed by default) */}
                    <details style={{ marginTop: '1rem' }}>
                        <summary
                            style={{
                                color: '#94a3b8',
                                cursor: 'pointer',
                                fontSize: '0.875rem',
                                marginBottom: '0.5rem',
                            }}
                        >
                            Ver detalles técnicos
                        </summary>
                        <div style={errorBoxStyle}>
                            <strong>Error:</strong> {this.state.error?.message || 'Unknown error'}
                            <br /><br />
                            <strong>Stack:</strong>
                            <pre style={{ margin: '0.5rem 0', whiteSpace: 'pre-wrap' }}>
                                {this.state.error?.stack || 'No stack trace'}
                            </pre>
                        </div>
                    </details>

                    <p
                        style={{
                            marginTop: '1.5rem',
                            fontSize: '0.75rem',
                            color: '#64748b',
                            textAlign: 'center',
                        }}
                    >
                        Si el problema persiste, contacta al soporte técnico con los detalles del error.
                    </p>
                </div>
            </div>
        );
    }
}

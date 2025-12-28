/**
 * Emergency Modal Component
 * 
 * Modal for police emergency contacts and official reporting links.
 * Shows 911 and provincial resources.
 */

import { X, Phone, ExternalLink, AlertTriangle, Shield } from 'lucide-react';

interface EmergencyModalProps {
    isOpen: boolean;
    onClose: () => void;
    province?: string;
}

// Provincial emergency links (can be expanded)
const PROVINCIAL_LINKS: Record<string, { name: string; url: string }> = {
    'Buenos Aires': {
        name: 'Denuncia Online BA',
        url: 'https://www.gba.gob.ar/seguridad/denuncia_online'
    },
    'Ciudad Autónoma de Buenos Aires': {
        name: 'Denuncia Online CABA',
        url: 'https://www.buenosaires.gob.ar/denuncias'
    },
    'Córdoba': {
        name: 'Policía de Córdoba',
        url: 'https://www.cba.gov.ar/reparticion/ministerio-de-seguridad/'
    }
};

export function EmergencyModal({ isOpen, onClose, province }: EmergencyModalProps) {
    if (!isOpen) return null;

    const provincialLink = province ? PROVINCIAL_LINKS[province] : null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div
                className="bg-dark-card border border-dark-border rounded-2xl max-w-md w-full shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-dark-border">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-500/20 rounded-lg">
                            <Phone className="h-5 w-5 text-red-400" />
                        </div>
                        <h2 className="text-lg font-semibold">Denunciar a la Policía</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-dark-bg rounded-lg transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">

                    {/* 911 Emergency */}
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
                        <p className="text-sm text-red-400 uppercase tracking-wide mb-2">
                            Emergencias
                        </p>
                        <a
                            href="tel:911"
                            className="text-5xl font-bold text-red-400 hover:text-red-300 transition-colors"
                        >
                            911
                        </a>
                        <p className="text-sm text-foreground/70 mt-3">
                            Llamá al 911 para emergencias en todo el país
                        </p>
                    </div>

                    {/* Other Numbers */}
                    <div className="space-y-3">
                        <a
                            href="tel:101"
                            className="flex items-center justify-between p-4 bg-dark-bg rounded-lg hover:bg-dark-border/50 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <Phone className="h-5 w-5 text-blue-400" />
                                <div>
                                    <p className="font-medium">101</p>
                                    <p className="text-sm text-muted-foreground">Policía Federal</p>
                                </div>
                            </div>
                            <ExternalLink className="h-4 w-4 text-muted-foreground" />
                        </a>

                        <a
                            href="tel:107"
                            className="flex items-center justify-between p-4 bg-dark-bg rounded-lg hover:bg-dark-border/50 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <Phone className="h-5 w-5 text-green-400" />
                                <div>
                                    <p className="font-medium">107</p>
                                    <p className="text-sm text-muted-foreground">SAME (Emergencias Médicas)</p>
                                </div>
                            </div>
                            <ExternalLink className="h-4 w-4 text-muted-foreground" />
                        </a>
                    </div>

                    {/* Provincial Link */}
                    {provincialLink && (
                        <a
                            href={provincialLink.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-4 bg-neon-green/10 border border-neon-green/30 rounded-lg hover:bg-neon-green/20 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <Shield className="h-5 w-5 text-neon-green" />
                                <div>
                                    <p className="font-medium text-neon-green">{provincialLink.name}</p>
                                    <p className="text-sm text-muted-foreground">Denuncia online para {province}</p>
                                </div>
                            </div>
                            <ExternalLink className="h-4 w-4 text-neon-green" />
                        </a>
                    )}

                    {/* Disclaimer */}
                    <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                        <AlertTriangle className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-foreground/80">
                            <strong className="text-yellow-400">Importante:</strong> SafeSpot no realiza
                            la denuncia por vos ni envía datos a la policía. Debés contactar directamente
                            a las autoridades.
                        </p>
                    </div>

                </div>

                {/* Footer */}
                <div className="p-4 border-t border-dark-border">
                    <button
                        onClick={onClose}
                        className="w-full py-3 bg-dark-bg hover:bg-dark-border rounded-lg transition-colors font-medium"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}

/**
 * Emergency Button - Compact version for use in various places
 */
export function EmergencyButton({ onClick }: { onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-lg hover:bg-red-500/20 transition-colors text-red-400"
        >
            <Phone className="h-4 w-4" />
            <span className="text-sm font-medium">Denunciar a Policía</span>
        </button>
    );
}


import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface UrgentReportButtonProps {
    onClick: () => void;
    className?: string;
}

export function UrgentReportButton({ onClick, className }: UrgentReportButtonProps) {
    return (
        <div className={cn("absolute bottom-24 right-4 z-[9999] animate-in slide-in-from-bottom-4 fade-in duration-500", className)}>
            <Button
                onClick={onClick}
                size="lg"
                className="h-16 w-16 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-[0_0_20px_rgba(220,38,38,0.5)] border-4 border-red-500/30 transition-all hover:scale-105 active:scale-95 flex flex-col items-center justify-center gap-1"
                aria-label="Reporte de Emergencia"
            >
                <AlertTriangle className="h-6 w-6 fill-white text-red-600" />
                <span className="text-[9px] font-black uppercase tracking-tighter">SOS</span>
            </Button>
            
            {/* Ping animation wrapper */}
            <span className="absolute -inset-1 rounded-full bg-red-500/30 animate-ping -z-10 pointer-events-none" />
        </div>
    );
}

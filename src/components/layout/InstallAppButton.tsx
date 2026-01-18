import { Download } from 'lucide-react'
import { usePWAInstall } from '@/hooks/usePWAInstall'
import { Button } from '@/components/ui/button'

export function InstallAppButton() {
    const { isInstallable, installApp } = usePWAInstall()

    if (!isInstallable) return null;

    return (
        <Button
            variant="neon"
            size="sm"
            onClick={installApp}
            className="neon-glow flex items-center gap-2 font-semibold"
        >
            <Download className="w-4 h-4" />
            Instalar App
        </Button>
    )
}


import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Smartphone, ShieldCheck, Key } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChangePasswordModal } from './ChangePasswordModal'

interface SecuritySectionProps {
    twoFactorEnabled: boolean
}

export function SecuritySection({ twoFactorEnabled }: SecuritySectionProps) {
    const [showPasswordModal, setShowPasswordModal] = useState(false)
    const navigate = useNavigate()

    return (
        <div className="space-y-6">
            <h3 className="text-lg font-medium text-white flex items-center gap-2 border-b border-[#1e293b] pb-2">
                <ShieldCheck className="h-5 w-5 text-[#00ff88]" />
                Seguridad de la Cuenta
            </h3>

            <div className="grid gap-4">
                {/* Change Password */}
                <div className="bg-[#0f172a]/50 border border-[#1e293b] rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-[#1e293b] flex items-center justify-center text-slate-400 shrink-0">
                            <Key className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-white font-medium">Contraseña</p>
                            <p className="text-sm text-slate-500">Se recomienda usar una contraseña fuerte y única.</p>
                        </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setShowPasswordModal(true)} className="w-full sm:w-auto">
                        Cambiar Contraseña
                    </Button>
                </div>

                {/* 2FA Status */}
                <div className="bg-[#0f172a]/50 border border-[#1e293b] rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${twoFactorEnabled ? 'bg-[#00ff88]/10 text-[#00ff88]' : 'bg-[#1e293b] text-slate-400'}`}>
                            <Smartphone className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <p className="text-white font-medium">Autenticación de Dos Factores (2FA)</p>
                                {twoFactorEnabled ? (
                                    <Badge variant="outline" className="bg-[#00ff88]/10 text-[#00ff88] border-[#00ff88]/20 shrink-0">ACTIVADO</Badge>
                                ) : (
                                    <Badge variant="outline" className="bg-slate-500/10 text-slate-400 border-slate-500/20 shrink-0">DESACTIVADO</Badge>
                                )}
                            </div>
                            <p className="text-sm text-slate-500">Aumenta la seguridad de tu cuenta con una segunda capa de verificación.</p>
                        </div>
                    </div>
                    <Button
                        variant={twoFactorEnabled ? "destructive" : "secondary"}
                        size="sm"
                        onClick={() => navigate('/admin/security')}
                        className="w-full sm:w-auto"
                    >
                        {twoFactorEnabled ? 'Gestionar' : 'Configurar'}
                    </Button>
                </div>
            </div>

            <ChangePasswordModal open={showPasswordModal} onOpenChange={setShowPasswordModal} />
        </div>
    )
}


import { useAdminProfile } from '@/admin/hooks/useAdminProfile'
import { ProfileHeader } from '@/admin/components/profile/ProfileHeader'
import { SecuritySection } from '@/admin/components/profile/SecuritySection'
import { PreferencesSection } from '@/admin/components/profile/PreferencesSection'
import { SessionsModal } from '@/admin/components/profile/SessionsModal'
import { ShieldCheck } from 'lucide-react'

export function AdminProfilePage() {
    const { data, isLoading, error } = useAdminProfile()

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin h-8 w-8 border-4 border-[#00ff88] border-t-transparent rounded-full"></div>
            </div>
        )
    }

    if (error || !data) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500">
                <ShieldCheck className="h-12 w-12 mb-4 opacity-20" />
                <p>Error cargando perfil</p>
            </div>
        )
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-12">
            <div>
                <h1 className="text-3xl font-bold text-white mb-2">Mi Perfil</h1>
                <p className="text-slate-400">Gestiona tu información personal y seguridad de la cuenta.</p>
            </div>

            <ProfileHeader data={data.user} />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Main Column */}
                <div className="md:col-span-2 space-y-8">
                    <SecuritySection twoFactorEnabled={data.user.two_factor_enabled} />
                    <PreferencesSection />
                </div>

                {/* Sidebar Column */}
                <div className="space-y-6">
                    <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-6">
                        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">
                            Estado de Cuenta
                        </h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500">Rol Global</span>
                                <span className="text-[#00ff88] bg-[#00ff88]/10 px-2 py-0.5 rounded border border-[#00ff88]/20 capitalize">
                                    {data.user.role}
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500">Ultimo Login</span>
                                <span className="text-white">
                                    {new Date(data.user.last_login_at || Date.now()).toLocaleDateString()}
                                </span>
                            </div>

                            <div className="pt-4 border-t border-[#1e293b]">
                                <SessionsModal sessions={data.sessions} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

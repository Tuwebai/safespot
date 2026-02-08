import { useState } from 'react'
import { User, Mail, Save, X, Camera } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AdminProfileData, useUpdateProfile } from '@/admin/hooks/useAdminProfile'
import { AvatarUploadModal } from './AvatarUploadModal'

interface ProfileHeaderProps {
    data: AdminProfileData['user']
}

export function ProfileHeader({ data }: ProfileHeaderProps) {
    const [isEditing, setIsEditing] = useState(false)
    const [alias, setAlias] = useState(data.alias)
    const [email, setEmail] = useState(data.email)
    const [showAvatarModal, setShowAvatarModal] = useState(false)
    const [avatarError, setAvatarError] = useState(false)

    const updateMutation = useUpdateProfile()

    const handleSave = async () => {
        if (!alias.trim()) return

        await updateMutation.mutateAsync({
            alias,
            email: email !== data.email ? email : undefined // Only send email if changed
        })
        setIsEditing(false)
    }

    const handleCancel = () => {
        setAlias(data.alias)
        setEmail(data.email)
        setIsEditing(false)
    }

    const handleAvatarSuccess = () => {
        setAvatarError(false)
    }

    return (
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-4 sm:p-6 flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
            {/* Avatar with Upload Overlay */}
            <div
                className="relative group cursor-pointer shrink-0"
                onClick={() => setShowAvatarModal(true)}
            >
                {data.avatar_url && !avatarError ? (
                    <img
                        src={data.avatar_url}
                        alt={data.alias}
                        className="h-20 w-20 rounded-full object-cover border-2 border-[#334155]"
                        onError={() => setAvatarError(true)}
                    />
                ) : (
                    <div className="h-20 w-20 rounded-full bg-[#1e293b] flex items-center justify-center border-2 border-[#334155]">
                        <span className="text-2xl font-bold text-[#00ff88]">
                            {data.alias?.substring(0, 2).toUpperCase()}
                        </span>
                    </div>
                )}

                {/* Overlay con ícono de cámara */}
                <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera className="h-6 w-6 text-white" />
                </div>
            </div>

            <AvatarUploadModal
                isOpen={showAvatarModal}
                onClose={() => setShowAvatarModal(false)}
                currentAvatarUrl={data.avatar_url}
                onSuccess={handleAvatarSuccess}
            />

            <div className="flex-1 space-y-4 w-full">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-1">
                        {!isEditing ? (
                            <>
                                <h2 className="text-xl sm:text-2xl font-bold text-white flex flex-wrap items-center gap-2">
                                    {data.alias}
                                    <span className="text-xs bg-[#00ff88]/10 text-[#00ff88] px-2 py-0.5 rounded border border-[#00ff88]/20 capitalize">
                                        {data.role}
                                    </span>
                                </h2>
                                <div className="flex items-center gap-2 text-slate-400 text-sm">
                                    <Mail className="h-4 w-4 shrink-0" />
                                    <span className="break-all">{data.email}</span>
                                </div>
                            </>
                        ) : (
                            <div className="space-y-3 max-w-md">
                                <div>
                                    <label className="text-xs text-slate-500 mb-1 block">Alias</label>
                                    <Input
                                        value={alias}
                                        onChange={e => setAlias(e.target.value)}
                                        className="bg-[#020617] border-[#334155]"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 mb-1 block">Email</label>
                                    <Input
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        className="bg-[#020617] border-[#334155]"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-2 text-slate-500 text-xs pt-1">
                            <User className="h-3 w-3" />
                            Miembro desde {new Date(data.created_at).toLocaleDateString()}
                        </div>
                    </div>

                    <div>
                        {!isEditing ? (
                            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                                Editar Perfil
                            </Button>
                        ) : (
                            <div className="flex items-center gap-2">
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={handleCancel}
                                    disabled={updateMutation.isPending}
                                >
                                    <X className="h-4 w-4 mr-1" />
                                    Cancelar
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={handleSave}
                                    disabled={updateMutation.isPending || !alias.trim()}
                                    className="bg-[#00ff88] text-black hover:bg-[#00cc6a]"
                                >
                                    {updateMutation.isPending ? 'Guardando...' : (
                                        <>
                                            <Save className="h-4 w-4 mr-2" />
                                            Guardar
                                        </>
                                    )}
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

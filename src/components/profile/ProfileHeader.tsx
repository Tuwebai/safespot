/**
 * 🏛️ SAFE MODE: ProfileHeader - Componente Visual Independiente
 * 
 * Fase 1 del refactor enterprise: Extracción quirúrgica del header de perfil.
 * Solo movimiento de código, sin cambio de lógica.
 * 
 * @version 1.0 - Extracción únicamente
 */

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Lock, LogOut, PencilIcon, Settings } from 'lucide-react';
import { getAvatarUrl, getAvatarFallback } from '@/lib/avatar';
import { calculateLevelProgress, getPointsToNextLevel } from '@/lib/levelCalculation';
import { VerifiedBadge } from '@/components/ui/VerifiedBadge';
import type { UserProfile } from '@/lib/api';
import type { GamificationSummary } from '@/lib/schemas';

export interface ProfileHeaderProps {
    /** Datos del perfil del usuario */
    profile: UserProfile | null;
    /** Datos de gamificación (nivel, puntos) */
    gamificationData: GamificationSummary | null | undefined;
    /** ID anónimo para avatar fallback */
    anonymousId: string;
    /** Estado de autenticación */
    isAuthenticated: boolean;
    /** Provider de autenticación (para mostrar/ocultar cambio de password) */
    authProvider?: string | null;
    /** Callback para abrir modal de edición de alias */
    onEditAlias: () => void;
    /** Callback para abrir modal de login */
    onLogin: () => void;
    /** Callback para navegar a configuración */
    onSettings: () => void;
    /** Callback para abrir modal de cambio de password */
    onPassword: () => void;
    /** Callback para iniciar logout */
    onLogout: () => void;
}

export function ProfileHeader({
    profile,
    gamificationData,
    anonymousId,
    isAuthenticated,
    authProvider,
    onEditAlias,
    onLogin,
    onSettings,
    onPassword,
    onLogout
}: ProfileHeaderProps) {
    const currentLevel = gamificationData?.profile?.level ?? profile?.level ?? 1;
    const currentPoints = gamificationData?.profile?.points ?? profile?.points ?? 0;
    const progressPercent = calculateLevelProgress(currentPoints, currentLevel).progressPercent;
    const pointsToNext = getPointsToNextLevel(currentPoints, currentLevel);

    return (
        <div className="mb-4 sm:mb-6">
            <div className="flex items-center justify-between gap-2">
                {/* Avatar + Info */}
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <Avatar className="h-12 w-12 sm:h-16 sm:w-16 border-2 border-neon-green/30 shadow-[0_0_15px_rgba(0,255,136,0.1)] shrink-0">
                        <AvatarImage 
                            src={profile?.avatarUrl || getAvatarUrl(anonymousId)} 
                            alt="Avatar" 
                            className="object-cover" 
                        />
                        <AvatarFallback className="bg-neon-green/10 text-neon-green text-xl font-bold">
                            {getAvatarFallback(anonymousId)}
                        </AvatarFallback>
                    </Avatar>

                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className={`text-xl font-bold ${profile?.alias ? "text-neon-green" : "text-foreground"}`}>
                                {profile?.alias ? `@${profile.alias}` : 'Usuario Anónimo'}
                            </h1>
                            {profile?.is_official && <VerifiedBadge size={16} className="text-blue-400" />}
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6 opacity-50 hover:opacity-100" 
                                onClick={onEditAlias}
                            >
                                <PencilIcon className="h-3 w-3" />
                            </Button>
                        </div>

                        <div className="flex items-center gap-3 mt-1">
                            <Badge variant="outline" className="text-xs bg-neon-green/10 border-neon-green/30 text-neon-green">
                                Nivel {currentLevel}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{currentPoints} pts</span>
                            {profile?.alias && (
                                <Link 
                                    to={`/usuario/${profile.alias}`} 
                                    className="text-[10px] text-neon-green hover:underline"
                                >
                                    Ver perfil público →
                                </Link>
                            )}
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-1 sm:gap-2">
                    {!isAuthenticated ? (
                        <Button 
                            onClick={onLogin} 
                            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20 animate-pulse" 
                            size="sm"
                        >
                            <Lock className="w-4 h-4 mr-1 sm:mr-2" />
                            <span className="hidden sm:inline">Guardar Progreso</span>
                            <span className="sm:hidden">Guardar</span>
                        </Button>
                    ) : (
                        <>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={onSettings}
                                className="text-muted-foreground hover:text-foreground h-8 w-8 sm:h-10 sm:w-10" 
                                title="Configuración"
                            >
                                <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
                            </Button>
                            {authProvider !== 'google' && (
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={onPassword}
                                    className="text-muted-foreground hover:text-foreground h-8 w-8 sm:h-10 sm:w-10" 
                                    title="Cambiar Contraseña"
                                >
                                    <Lock className="w-4 h-4 sm:w-5 sm:h-5" />
                                </Button>
                            )}
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={onLogout}
                                className="text-muted-foreground hover:text-destructive h-8 w-8 sm:h-10 sm:w-10" 
                                title="Cerrar Sesión"
                            >
                                <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-4">
                <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">
                        {pointsToNext} pts para Nivel {currentLevel + 1}
                    </span>
                    <span className="text-neon-green font-bold">{Math.round(progressPercent)}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                    <div 
                        className="bg-gradient-to-r from-neon-green to-emerald-400 h-full rounded-full transition-all duration-1000"
                        style={{ width: `${progressPercent}%` }} 
                    />
                </div>
            </div>
        </div>
    );
}

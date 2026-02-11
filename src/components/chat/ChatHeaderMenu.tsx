/**
 * 🏛️ ChatHeaderMenu - Menú de opciones del chat (3 puntos verticales)
 * 
 * Ubicado en el header del chat, extremo derecho.
 * Contiene opciones globales de la conversación.
 * 
 * @enterprise Este menú es extensible para futuras features:
 * - Silenciar notificaciones
 * - Fondo de pantalla
 * - Reportar usuario
 * - Bloquear usuario
 * - Vaciar chat
 * - Exportar chat
 */

import React from 'react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Search, Bell, BellOff, Trash2, Flag, Download, MoreVertical } from 'lucide-react';

interface ChatHeaderMenuProps {
    onSearchClick: () => void;
    onMuteToggle?: () => void;
    isMuted?: boolean;
    onClearChat?: () => void;
    onExportChat?: () => void;
    onReportUser?: () => void;
    onBlockUser?: () => void;
}

export const ChatHeaderMenu: React.FC<ChatHeaderMenuProps> = ({
    onSearchClick,
    onMuteToggle,
    isMuted = false,
    onClearChat,
    onExportChat,
    onReportUser,
    onBlockUser
}) => {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted"
                    aria-label="Más opciones"
                >
                    <MoreVertical className="h-5 w-5" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
                align="end" 
                sideOffset={8}
                className="w-56 bg-background border border-border shadow-lg"
            >
                {/* 🏛️ FEATURE: Búsqueda de mensajes */}
                <DropdownMenuItem 
                    onClick={onSearchClick}
                    className="cursor-pointer py-2.5 px-3 text-sm text-foreground hover:bg-muted focus:bg-muted focus:text-foreground"
                >
                    <Search className="w-4 h-4 mr-3 text-muted-foreground" />
                    Buscar mensajes
                </DropdownMenuItem>

                <DropdownMenuSeparator className="bg-border my-1" />

                {/* Futuras features - placeholders */}
                {onMuteToggle && (
                    <DropdownMenuItem 
                        onClick={onMuteToggle}
                        className="cursor-pointer py-2.5 px-3 text-sm text-foreground hover:bg-muted focus:bg-muted focus:text-foreground"
                    >
                        {isMuted ? (
                            <>
                                <BellOff className="w-4 h-4 mr-3 text-muted-foreground" />
                                Dejar de silenciar
                            </>
                        ) : (
                            <>
                                <Bell className="w-4 h-4 mr-3 text-muted-foreground" />
                                Silenciar notificaciones
                            </>
                        )}
                    </DropdownMenuItem>
                )}

                {onExportChat && (
                    <DropdownMenuItem 
                        onClick={onExportChat}
                        className="cursor-pointer py-2.5 px-3 text-sm text-foreground hover:bg-muted focus:bg-muted focus:text-foreground"
                    >
                        <Download className="w-4 h-4 mr-3 text-muted-foreground" />
                        Exportar chat
                    </DropdownMenuItem>
                )}

                {onClearChat && (
                    <>
                        <DropdownMenuSeparator className="bg-border my-1" />
                        <DropdownMenuItem 
                            onClick={onClearChat}
                            className="cursor-pointer py-2.5 px-3 text-sm text-destructive hover:bg-destructive/10 focus:bg-destructive/10 focus:text-destructive"
                        >
                            <Trash2 className="w-4 h-4 mr-3" />
                            Vaciar chat
                        </DropdownMenuItem>
                    </>
                )}

                {(onReportUser || onBlockUser) && (
                    <>
                        <DropdownMenuSeparator className="bg-border my-1" />
                        {onReportUser && (
                            <DropdownMenuItem 
                                onClick={onReportUser}
                                className="cursor-pointer py-2.5 px-3 text-sm text-destructive hover:bg-destructive/10 focus:bg-destructive/10 focus:text-destructive"
                            >
                                <Flag className="w-4 h-4 mr-3" />
                                Reportar usuario
                            </DropdownMenuItem>
                        )}
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

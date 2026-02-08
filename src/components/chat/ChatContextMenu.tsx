import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useChatActions } from "@/hooks/useChatActions";
import type { ChatRoom } from "@/lib/schemas";
import { Archive, Pin, PinOff, Trash2, Mail, MailOpen } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/ui/useConfirm";

interface ChatContextMenuProps {
    chat: ChatRoom;
    children?: React.ReactNode;
    trigger?: React.ReactNode;
    isOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
    triggerClassName?: string;
    onAction?: () => void;
}

export function ChatContextMenu({ chat, trigger, isOpen, onOpenChange, triggerClassName, onAction }: ChatContextMenuProps) {
    const { pinChat, archiveChat, markUnread, deleteChat } = useChatActions();
    const [open, setOpen] = useState(false);
    const { confirm } = useConfirm();

    // Controlled vs Uncontrolled
    const isControlled = isOpen !== undefined;
    const currentOpen = isControlled ? isOpen : open;
    const handleOpenChange = (newOpen: boolean) => {
        if (!isControlled) setOpen(newOpen);
        onOpenChange?.(newOpen);
    };

    const handleAction = (actionFn: () => void) => {
        actionFn();
        handleOpenChange(false);
        onAction?.();
    }

    return (
        <DropdownMenu open={currentOpen} onOpenChange={handleOpenChange}>
            <DropdownMenuTrigger asChild>
                <div className={cn("outline-none inline-flex", triggerClassName)}>
                    {trigger || <span className="w-0 h-0 opacity-0 absolute top-0 left-0" />}
                </div>
            </DropdownMenuTrigger>
            {/* Render children if passed, but usually we just want the menu content. Use children as trigger? No, explicit trigger prop is better. Keeping children render for legacy pattern check? 
               Wait, user might want to wrap something. The new pattern removes wrapping. 
               If I remove children rendering here, where does the content go? 
               The 'children' in the previous code was the Trigger. 
               Now 'trigger' is the Trigger.
            */}

            <DropdownMenuContent
                align="end"
                className="w-56 bg-zinc-900 border-zinc-800 text-zinc-200"
                onClick={(e) => e.stopPropagation()}
                onMouseUp={(e) => e.stopPropagation()}
                onTouchEnd={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
            >
                <DropdownMenuItem
                    onClick={(e) => { e.stopPropagation(); handleAction(() => pinChat({ roomId: chat.id, isPinned: !chat.is_pinned })) }}
                    className="focus:bg-zinc-800 focus:text-zinc-100 cursor-pointer"
                >
                    {chat.is_pinned ? (
                        <>
                            <PinOff className="w-4 h-4 mr-2" />
                            <span>Desfijar chat</span>
                        </>
                    ) : (
                        <>
                            <Pin className="w-4 h-4 mr-2" />
                            <span>Fijar chat</span>
                        </>
                    )}
                </DropdownMenuItem>

                <DropdownMenuItem
                    onClick={(e) => { e.stopPropagation(); handleAction(() => markUnread({ roomId: chat.id, isUnread: !chat.is_manually_unread })) }}
                    className="focus:bg-zinc-800 focus:text-zinc-100 cursor-pointer"
                >
                    {chat.is_manually_unread ? (
                        <>
                            <MailOpen className="w-4 h-4 mr-2" />
                            <span>Marcar como leído</span>
                        </>
                    ) : (
                        <>
                            <Mail className="w-4 h-4 mr-2" />
                            <span>Marcar como no leído</span>
                        </>
                    )}
                </DropdownMenuItem>

                <DropdownMenuItem
                    onClick={(e) => { e.stopPropagation(); handleAction(() => archiveChat({ roomId: chat.id, isArchived: !chat.is_archived })) }}
                    className="focus:bg-zinc-800 focus:text-zinc-100 cursor-pointer"
                >
                    <Archive className="w-4 h-4 mr-2" />
                    <span>{chat.is_archived ? 'Desarchivar' : 'Archivar chat'}</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="bg-zinc-800" />

                <DropdownMenuItem
                    onClick={async (e) => {
                        e.stopPropagation();
                        // Close menu first to prevent weird UI layering if modal opens
                        handleOpenChange(false);

                        if (await confirm({
                            title: '¿Eliminar chat?',
                            description: 'Se eliminará el historial de mensajes de este chat para ambos participantes. Esta acción no se puede deshacer.',
                            confirmText: 'Eliminar',
                            variant: 'danger'
                        })) {
                            deleteChat(chat.id);
                            onAction?.();
                        }
                    }}
                    className="focus:bg-red-900/50 focus:text-red-300 text-red-400 cursor-pointer"
                >
                    <Trash2 className="w-4 h-4 mr-2" />
                    <span>Eliminar chat</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

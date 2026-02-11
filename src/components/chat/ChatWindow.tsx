import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';

import { useVirtualizer } from '@tanstack/react-virtual';

import {
    useChatMessages,
    useSendMessageMutation,
    useMarkAsReadMutation,
    useUserPresence,
    useDeleteMessageMutation,
    useReactionMutation,
    useRetryMessageMutation
} from '../../hooks/queries/useChatsQuery';
import useLongPress from '../../hooks/useLongPress';


import { ChatRoom, ChatMessage, chatsApi } from '../../lib/api';
import { getAvatarUrl, getAvatarFallback } from '../../lib/avatar';
import { useAnonymousId } from '../../hooks/useAnonymousId';
import { isOwnMessage } from '../../lib/chatHelpers';
import { chatBroadcast } from '../../lib/chatBroadcast';
import {
    Send,
    Image as ImageIcon,
    Plus,
    X,
    ArrowLeft,
    Check,
    CheckCheck,
    MessageSquare,
    ChevronDown,
    Reply,
    Trash2,
    Pin,
    Star,
    SmilePlus, // ✅ UX: WhatsApp-style hover trigger
    Clock, // ✅ UX: Needed for pending state
    Pencil,
    Copy
} from 'lucide-react';

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '../ui/dropdown-menu';

import { Avatar, AvatarFallback, AvatarImage } from '../ui/Avatar';

import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChatReportContext } from './ChatReportContext';
import { useToast } from '../ui/toast/useToast';
import { MessageSearchModal } from './MessageSearchModal';
import { ChatHeaderMenu } from './ChatHeaderMenu';


interface ChatImageProps {
    src: string;
    localUrl?: string;
    alt?: string;
    className?: string;
    onClick?: () => void;
}

const ChatImage: React.FC<ChatImageProps> = ({ src, localUrl, alt, className, onClick }) => {
    const [currentSrc, setCurrentSrc] = useState(localUrl || src);
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        if (!src) return;
        if (src === currentSrc && isLoaded) return;

        // 🏛️ FIX: Detectar blob URLs inválidos (persistidos incorrectamente)
        const isInvalidBlob = src.startsWith('blob:') && !src.includes('http');
        if (isInvalidBlob) {
            setHasError(true);
            return;
        }

        const img = new Image();
        img.src = src;
        img.onload = () => {
            setCurrentSrc(src);
            setIsLoaded(true);
            setHasError(false);
        };
        img.onerror = () => {
            setHasError(true);
        };
    }, [src, localUrl, currentSrc, isLoaded]);

    // 🏛️ UX: Placeholder para imagen rota/pendiente
    if (hasError) {
        return (
            <div 
                className={`flex items-center justify-center bg-muted/50 ${className}`}
                onClick={onClick}
            >
                <div className="flex flex-col items-center gap-2 text-muted-foreground/60">
                    <ImageIcon className="w-8 h-8" />
                    <span className="text-[10px]">Imagen no disponible</span>
                </div>
            </div>
        );
    }

    return (
        <img
            src={currentSrc}
            alt={alt}
            className={className}
            onClick={onClick}
            style={{ opacity: currentSrc ? 1 : 0, transition: 'opacity 0.2s' }}
        />
    );
};

/**
 * ✅ WhatsApp-Grade floating reaction selector
 */
interface ReactionPickerProps {
    onSelect: (emoji: string) => void;
    onClose: () => void;
    currentReactions?: Record<string, string[]>;
    anonymousId: string;
}

const ReactionPicker: React.FC<ReactionPickerProps & { isMe: boolean }> = ({ onSelect, onClose, currentReactions, anonymousId, isMe }) => {
    // WhatsApp default order
    const emojis = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
    const pickerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        const handleScroll = () => {
            onClose();
        };

        document.addEventListener('mousedown', handleClickOutside);
        window.addEventListener('scroll', handleScroll, true); // Capture scroll on any element
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, [onClose]);

    return (
        <motion.div
            ref={pickerRef}
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            className={`absolute -top-14 z-[150] flex gap-1 bg-white border border-border/10 shadow-2xl rounded-full p-1.5 backdrop-blur-md whitespace-nowrap
            ${isMe ? 'right-0' : 'left-0'}`}
        >
            {emojis.map((emoji) => {
                const isSelected = currentReactions?.[emoji]?.includes(anonymousId);
                return (
                    <motion.button
                        key={emoji}
                        whileHover={{ scale: 1.3, y: -4 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => {
                            e.stopPropagation();
                            onSelect(emoji);
                            onClose();
                        }}
                        className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors hover:bg-muted/50 ${isSelected ? 'bg-primary/20' : ''}`}
                    >
                        <span className="text-2xl leading-none select-none">{emoji}</span>
                    </motion.button>
                );
            })}
            <motion.button
                whileHover={{ scale: 1.1 }}
                className="w-9 h-9 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted/50"
            >
                <Plus className="w-5 h-5" />
            </motion.button>
        </motion.div>
    );
};

// ✅ Mobile Top Action Bar (WhatsApp-Grade)
interface MobileMessageActionBarProps {
    selectedMessage: ChatMessage;
    onClose: () => void;
    onReply: (msg: ChatMessage) => void;
    onDelete: (msg: ChatMessage) => void;
    onPin: (msgId: string) => void;
    onStar: (msg: ChatMessage) => void;
    onEdit: (msg: ChatMessage) => void;
    onCopy: (msg: ChatMessage) => void;
    isMe: boolean;
    pinnedId: string | undefined;
}

const MobileMessageActionBar: React.FC<MobileMessageActionBarProps> = ({
    selectedMessage, onClose, onReply, onDelete, onPin, onStar, onEdit, onCopy, isMe, pinnedId
}) => {
    return (
        <AnimatePresence>
            <motion.div
                initial={{ y: -50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -50, opacity: 0 }}
                className="fixed top-0 left-0 right-0 h-14 bg-background/95 backdrop-blur-md border-b border-border/10 z-[9999] flex items-center justify-between px-3 shadow-md"
            >
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <span className="font-semibold text-lg">1</span>
                </div>

                <div className="flex items-center gap-0.5">
                    {/* Responder */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full"
                        onPointerDown={(e) => {
                            e.stopPropagation();
                            // Action handled silently
                            onReply(selectedMessage);
                            onClose();
                        }}
                    >
                        <Reply className="w-5 h-5" />
                    </Button>

                    {/* Copiar */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full"
                        onPointerDown={(e) => {
                            e.stopPropagation();
                            // Action handled silently
                            onCopy(selectedMessage);
                            onClose();
                        }}
                    >
                        <Copy className="w-5 h-5" />
                    </Button>

                    {/* Fijar */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full"
                        onPointerDown={(e) => {
                            e.stopPropagation();
                            // Action handled silently
                            onPin(selectedMessage.id);
                            onClose();
                        }}
                    >
                        <Pin className={`w-5 h-5 ${pinnedId === selectedMessage.id ? 'fill-current text-primary' : ''}`} />
                    </Button>

                    {/* Favorito (para todos) */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full"
                        onPointerDown={(e) => {
                            e.stopPropagation();
                            // Action handled silently
                            onStar(selectedMessage);
                            onClose();
                        }}
                    >
                        <Star className={`w-5 h-5 ${selectedMessage.is_starred ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                    </Button>

                    {/* Editar (solo mensaje propio) */}
                    {isMe && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-full"
                            onPointerDown={(e) => {
                                e.stopPropagation();
                                // Action handled silently
                                onEdit(selectedMessage);
                                onClose();
                            }}
                        >
                            <Pencil className="w-5 h-5" />
                        </Button>
                    )}

                    {/* Eliminar (solo mensaje propio) */}
                    {isMe && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-full"
                            onPointerDown={(e) => {
                                e.stopPropagation();
                                // Action handled silently
                                onDelete(selectedMessage);
                                onClose();
                            }}
                        >
                            <Trash2 className="w-5 h-5 text-destructive" />
                        </Button>
                    )}
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

/**
 * ✅ Message Bubble Wrapper to handle WhatsApp-grade interactions
 */
interface MessageBubbleWrapperProps {
    msg: ChatMessage;
    isMe: boolean;
    anonymousId: string;
    onReaction: (emoji: string) => void;
    pickerActive: boolean;
    setPickerActive: (active: boolean) => void;
    onSelectionChange: (selected: boolean) => void;
    children: React.ReactNode;
}

const MessageBubbleWrapper: React.FC<MessageBubbleWrapperProps> = ({
    msg,
    isMe,
    anonymousId,
    onReaction,
    pickerActive,
    setPickerActive,
    onSelectionChange,
    children
}) => {
    // Mobile Long Press Logic
    const longPress = useLongPress(() => {
        // Trigger both reaction picker AND selection mode
        setPickerActive(true);
        onSelectionChange(true);

        // Haptic feedback if available
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }
    }, undefined, { delay: 400 });

    return (
        <div
            className="relative group/bubble flex flex-col"
            onMouseEnter={() => { }} // Could be used for desktop hover state if needed
        >
            <div className="relative">
                <AnimatePresence>
                    {pickerActive && (
                        <ReactionPicker
                            anonymousId={anonymousId}
                            currentReactions={msg.reactions}
                            onSelect={onReaction}
                            onClose={() => {
                                setPickerActive(false);
                                onSelectionChange(false);
                            }}
                            isMe={isMe}
                        />
                    )}
                </AnimatePresence>

                {/* The actual bubble with LongPress support */}
                {/* Prevenir menú contextual nativo + selección de texto */}
                <div
                    {...longPress}
                    className={pickerActive ? 'select-none' : ''}
                    onContextMenu={(e) => e.preventDefault()}
                    style={{ touchAction: 'none', WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}
                >
                    {pickerActive && <div className="absolute inset-0 z-10 bg-black/5 rounded-lg pointer-events-none" />}
                    {children}
                </div>

                {/* Desktop Smile Trigger - HIDDEN on Mobile */}
                {!pickerActive && (
                    <button
                        onClick={() => setPickerActive(true)}
                        className={`hidden md:block absolute top-1/2 -translate-y-1/2 p-2 rounded-full bg-popover/80 backdrop-blur-md shadow-md border border-border/10 opacity-0 group-hover/bubble:opacity-100 transition-opacity z-40 hover:scale-110 active:scale-95
                        ${isMe ? '-left-12' : '-right-12'}`}
                    >
                        <SmilePlus className="w-4.5 h-4.5 text-muted-foreground hover:text-primary transition-colors" />
                    </button>
                )}
            </div>

            {/* ✅ WhatsApp-Grade: Reaction Chips (Outside & Below Bubble) */}
            {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                <div className={`flex flex-wrap gap-1 mt-1 z-10 ${isMe ? 'justify-end' : 'justify-start'}`}>
                    {Object.entries(msg.reactions).map(([emoji, users]) => (
                        <div
                            key={emoji}
                            onClick={() => onReaction(emoji)}
                            className={`text-[11px] px-1.5 py-0.5 rounded-full border shadow-sm flex items-center gap-1 cursor-pointer transition-all hover:scale-105 active:scale-95 bg-background
                                            ${Array.isArray(users) && users.includes(anonymousId || '')
                                    ? 'border-primary/40 text-primary-foreground font-bold bg-primary/10'
                                    : 'border-border/60 text-muted-foreground'}`}
                        >
                            <span>{emoji}</span>
                            {/* <span className="font-bold text-[10px]">{Array.isArray(users) ? users.length : 0}</span> */}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

interface ChatWindowProps {
    room: ChatRoom;
    onBack?: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ room, onBack }) => {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
    const { success: toastSuccess, error: toastError } = useToast();

    const [reactionPickerMessageId, setReactionPickerMessageId] = useState<string | null>(null);
    const [selectedMessageForActions, setSelectedMessageForActions] = useState<ChatMessage | null>(null);
    const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);

    // 🏛️ FEATURE: Estado de búsqueda de mensajes (modal externo)
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    // ✅ WhatsApp-Grade Quick Emoji Reactions


    // ✅ ENTERPRISE FIX: Use useAnonymousId hook instead of localStorage
    // Guarantees clean UUID without v1|/v2| prefixes
    const anonymousId = useAnonymousId();

    const [message, setMessage] = useState('');

    // ✅ FIX: Draft Persistence (Anti-Data Loss on Deploy)
    // Restore draft on mount if exists
    useEffect(() => {
        if (!room?.id) return;
        const draftKey = `chat_draft_${room.id}`;
        const savedDraft = localStorage.getItem(draftKey);
        if (savedDraft) {
            // Draft restored silently
            setMessage(savedDraft);
        }
    }, [room?.id]);

    // Save draft on change + auto-resize textarea
    const updateMessage = (newValue: string) => {
        setMessage(newValue);
        if (room?.id) {
            localStorage.setItem(`chat_draft_${room.id}`, newValue);
        }
        // 🏛️ FIX: Auto-resize textarea
        if (inputRef.current) {
            const textarea = inputRef.current as HTMLTextAreaElement;
            textarea.style.height = 'auto';
            textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
        }
    };


    const {
        data: messages,
        isLoading: messagesLoading,
        isOtherTyping
    } = useChatMessages(room.id);
    const { data: presence } = useUserPresence(room.other_participant_id);

    const sendMessageMutation = useSendMessageMutation();
    const deleteMessageMutation = useDeleteMessageMutation();
    const markAsReadMutation = useMarkAsReadMutation();
    const reactionMutation = useReactionMutation();
    const retryMessageMutation = useRetryMessageMutation();

    // Virtualization Refs
    const parentRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const otherParticipant = {
        alias: room.other_participant_alias || 'Anon',
        avatar: room.other_participant_avatar
    };

    // Initialize Virtualizer
    const rowVirtualizer = useVirtualizer({
        count: messages?.length ?? 0,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 80,
        overscan: 5,
    });

    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Focus input when replying
    useEffect(() => {
        if (replyingTo && inputRef.current) {
            // Small delay to ensure the DOM has updated (reply preview bar appearing)
            const timer = setTimeout(() => {
                inputRef.current?.focus();
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [replyingTo]);

    // Auto-scroll logic
    const lastMessageCount = useRef(0);
    const lastRoomId = useRef<string | null>(null);
    const hasMarkedRead = useRef(false);
    const isInitialLoad = useRef(true);

    // ✅ ENTERPRISE FIX: Use centralized isOwnMessage helper
    // Handles all edge cases: null safety, format normalization
    const isMe = (msg: ChatMessage) => isOwnMessage(msg, anonymousId);

    // 🏛️ FIX: Detectar si usuario está cerca del final (para auto-scroll)
    const isNearBottom = useCallback(() => {
        const scrollElement = parentRef.current;
        if (!scrollElement) return true; // Default a true si no hay ref
        
        const { scrollHeight, scrollTop, clientHeight } = scrollElement;
        // Considerar "cerca del final" si está a 300px del fondo
        return scrollHeight - scrollTop - clientHeight < 300;
    }, []);

    useEffect(() => {
        if (!messages) return;

        // Reset cuando cambia de sala
        if (lastRoomId.current !== room.id) {
            lastMessageCount.current = messages.length;
            lastRoomId.current = room.id;
            hasMarkedRead.current = false;
            isInitialLoad.current = true;
            return;
        }

        // 🏛️ FIX: Carga inicial (F5/refresh) - scrollear al final UNA VEZ
        if (isInitialLoad.current && messages.length > 0) {
            // Usar mayor delay para asegurar que el virtualizer está listo
            const scrollTimer = setTimeout(() => {
                rowVirtualizer.scrollToIndex(messages.length - 1, { 
                    align: 'end'
                });
                isInitialLoad.current = false;
            }, 300);
            
            lastMessageCount.current = messages.length;
            return () => clearTimeout(scrollTimer);
        }

        // 🏛️ FIX: Mensajes nuevos después de carga inicial
        if (messages.length > lastMessageCount.current) {
            const lastMessage = messages[messages.length - 1];
            const isLastMessageMine = lastMessage && isMe(lastMessage);
            
            // Scroll solo si:
            // 1. Es mensaje propio (envié yo), o
            // 2. Usuario está cerca del final (leyendo mensajes recientes)
            if (isLastMessageMine || isNearBottom()) {
                requestAnimationFrame(() => {
                    rowVirtualizer.scrollToIndex(messages.length - 1, { 
                        align: 'end'
                    });
                });
            }
            
            lastMessageCount.current = messages.length;

            if (lastMessage && !isMe(lastMessage) && !lastMessage.is_read) {
                markAsReadMutation.mutate(room.id);
            }
        } else {
            lastMessageCount.current = messages.length;
        }
    }, [messages, room.id, anonymousId, rowVirtualizer, isNearBottom]);

    // Highlight & Scroll to Message Logic
    const highlightId = searchParams.get('highlight_message');
    const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(highlightId);

    useEffect(() => {
        if (highlightId && messages) {
            const index = messages.findIndex(m => m.id === highlightId);
            if (index !== -1) {
                // 🏛️ FIX: Scroll sin animación para compatibilidad con virtualizer
                requestAnimationFrame(() => {
                    rowVirtualizer.scrollToIndex(index, { 
                        align: 'center'
                    });
                });
                setHighlightedMessageId(highlightId);

                // Remove params to clean URL
                setSearchParams(params => {
                    params.delete('highlight_message');
                    return params;
                }, { replace: true });

                // Clear highlight visual after 3s
                setTimeout(() => setHighlightedMessageId(null), 3000);
            }
        }
    }, [highlightId, messages, rowVirtualizer, setSearchParams]);

    useEffect(() => {
        if (!room.id || hasMarkedRead.current) return;

        // 🏛️ WHATSAPP-GRADE: Delivery ahora es backend-authoritative
        // El backend marca delivered automáticamente cuando el receptor pide mensajes
        // Solo llamamos markAsRead para los checks AZULES (leído)
        const performInitialMarking = async () => {
            if (markAsReadMutation.isPending) return;

            if (room.unread_count > 0) {
                markAsReadMutation.mutate(room.id);
            }
            hasMarkedRead.current = true;
        };

        performInitialMarking();
    }, [room.id, room.unread_count]);

    const lastTypingStatus = useRef(false);
    useEffect(() => {
        const hasText = message.trim().length > 0;
        if (hasText !== lastTypingStatus.current) {
            chatsApi.notifyTyping(room.id, hasText);
            lastTypingStatus.current = hasText;
        }
    }, [message, room.id]);

    useEffect(() => {
        return () => {
            if (lastTypingStatus.current) {
                chatsApi.notifyTyping(room.id, false);
            }
        };
    }, [room.id]);

    // ============================================
    // WHATSAPP-GRADE MESSAGE ACTIONS HANDLERS
    // ============================================

    const handleReaction = (messageId: string, emoji: string) => {
        reactionMutation.mutate({ roomId: room.id, messageId, emoji });
    };

    const handleRetry = (msg: ChatMessage) => {
        if (msg.localStatus !== 'failed') return;
        
        // 🏛️ UX: Feedback visual de reintento
        const isImage = msg.type === 'image';
        toastSuccess(isImage ? 'Reintentando envío de imagen...' : 'Reintentando mensaje...', 2000);
        
        retryMessageMutation.mutate({
            roomId: room.id,
            messageId: msg.id,
            content: msg.content,
            type: msg.type,
            caption: msg.caption,
            replyToId: msg.reply_to_id
        }, {
            onSuccess: () => {
                toastSuccess(isImage ? 'Imagen enviada' : 'Mensaje enviado', 2000);
            },
            onError: () => {
                toastError('No se pudo enviar. Intentá de nuevo.', 3000);
            }
        });
    };

    const handlePinMessage = async (messageId: string | null) => {
        // Optimistic Update
        const previousRoomDetail = queryClient.getQueryData<ChatRoom>(['chats', 'conversation', room.id]);

        // 1. Patch individual conversation cache
        queryClient.setQueryData<ChatRoom>(['chats', 'conversation', anonymousId || '', room.id], (old: ChatRoom | undefined) => {
            if (!old) return old;
            return { ...old, pinned_message_id: messageId };
        });

        // 2. Patch global rooms list
        queryClient.setQueryData<ChatRoom[]>(['chats', 'rooms', anonymousId || ''], (old: ChatRoom[] | undefined) => {
            if (!old) return old;
            return old.map((r: ChatRoom) => r.id === room.id ? { ...r, pinned_message_id: messageId } : r);
        });

        try {
            if (messageId) {
                await chatsApi.pinMessage(room.id, messageId);
            } else if (room.pinned_message_id) {
                await chatsApi.unpinMessage(room.id, room.pinned_message_id);
            }

            // 3. Broadcast to other tabs
            chatBroadcast.emit({
                type: 'message-pinned',
                roomId: room.id,
                pinnedMessageId: messageId
            });
        } catch (err) {
            console.error('[Chat] Pin failed:', err);
            // Rollback on error
            if (previousRoomDetail) {
                queryClient.setQueryData(['chats', 'conversation', anonymousId || '', room.id], previousRoomDetail);
                queryClient.setQueryData<ChatRoom[]>(['chats', 'rooms', anonymousId || ''], (old: ChatRoom[] | undefined) => {
                    if (!old) return old;
                    return old.map((r: ChatRoom) => r.id === room.id ? { ...r, pinned_message_id: previousRoomDetail.pinned_message_id } : r);
                });
            }
        }
    };

    const handleStarMessage = async (msg: ChatMessage) => {
        // Optimistic Update - Actualizar cache inmediatamente
        const newStarredState = !msg.is_starred;
        const messagesKey = ['chats', 'messages', anonymousId, room.id];

        queryClient.setQueryData<ChatMessage[]>(messagesKey, (old) => {
            if (!old) return old;
            return old.map(m => m.id === msg.id ? { ...m, is_starred: newStarredState } : m);
        });

        try {
            if (msg.is_starred) {
                await chatsApi.unstarMessage(room.id, msg.id);
            } else {
                await chatsApi.starMessage(room.id, msg.id);
            }
        } catch (err) {
            console.error('[Chat] Star toggle failed:', err);
            // Rollback en caso de error
            queryClient.setQueryData<ChatMessage[]>(messagesKey, (old) => {
                if (!old) return old;
                return old.map(m => m.id === msg.id ? { ...m, is_starred: msg.is_starred } : m);
            });
        }
    };

    const handleJumpToMessage = (messageId: string) => {
        if (!messages) return;
        const index = messages.findIndex(m => m.id === messageId);
        if (index !== -1) {
            // 🏛️ FIX: Scroll sin animación para compatibilidad con virtualizer
            requestAnimationFrame(() => {
                rowVirtualizer.scrollToIndex(index, { 
                    align: 'center'
                });
            });
            setHighlightedMessageId(messageId);
            setTimeout(() => setHighlightedMessageId(null), 3000);
        }
    };

    const handleSend = async () => {
        if (!message.trim() && !selectedFile) return;

        try {
            const contentToSend = message.trim();

            // ✅ MODO EDICIÓN: Actualizar mensaje existente
            if (editingMessage) {
                const messageId = editingMessage.id;
                const messagesKey = ['chats', 'messages', anonymousId, room.id];

                // Optimistic Update
                queryClient.setQueryData<ChatMessage[]>(messagesKey, (old) => {
                    if (!old) return old;
                    return old.map(m => m.id === messageId
                        ? { ...m, content: contentToSend, is_edited: true, edited_at: new Date().toISOString() }
                        : m
                    );
                });

                // Limpiar input y borradores
                setMessage('');
                if (room.id) localStorage.removeItem(`chat_draft_${room.id}`);

                setEditingMessage(null);
                setPreviewUrl(null);

                try {
                    await chatsApi.editMessage(room.id, messageId, contentToSend);
                } catch (err) {
                    console.error('Error editando mensaje:', err);
                    // Rollback (se rehydrata del server via SSE)
                }
                return;
            }

            // ✅ MODO NORMAL: Enviar nuevo mensaje
            const fileToSend = selectedFile;
            const captionToSend = selectedFile ? message : undefined;

            setMessage('');
            if (room.id) localStorage.removeItem(`chat_draft_${room.id}`);
            cancelImageSelection();

            if (contentToSend || fileToSend) {
                // Clear state IMMEDIATELY for 0ms lag feel
                const replyData = replyingTo ? {
                    id: replyingTo.id,
                    content: replyingTo.content,
                    type: replyingTo.type,
                    sender_alias: replyingTo.sender_alias,
                    sender_id: replyingTo.sender_id
                } : null;

                setReplyingTo(null);

                // ✅ Enterprise: Client-Side ID Generation
                const optimisticId = window.crypto.randomUUID();

                // 🏛️ BLOQUE 2: Loading state para uploads
                if (fileToSend) {
                    setIsUploading(true);
                    setUploadProgress(0);
                    // Simular progreso (la API no soporta tracking real)
                    const progressInterval = setInterval(() => {
                        setUploadProgress(prev => Math.min(prev + 10, 90));
                    }, 200);
                    
                    try {
                        await sendMessageMutation.mutateAsync({
                            id: optimisticId,
                            roomId: room.id,
                            content: contentToSend,
                            type: 'image',
                            file: fileToSend,
                            caption: captionToSend,
                            replyToId: replyData?.id,
                            replyToContent: replyData?.content,
                            replyToType: replyData?.type,
                            replyToSenderAlias: replyData?.sender_alias,
                            replyToSenderId: replyData?.sender_id
                        });
                        setUploadProgress(100);
                        toastSuccess('Imagen enviada', 2000);
                    } finally {
                        clearInterval(progressInterval);
                        setIsUploading(false);
                        setUploadProgress(0);
                    }
                } else {
                    await sendMessageMutation.mutateAsync({
                        id: optimisticId,
                        roomId: room.id,
                        content: contentToSend,
                        type: 'text',
                        caption: undefined,
                        replyToId: replyData?.id,
                        replyToContent: replyData?.content,
                        replyToType: replyData?.type,
                        replyToSenderAlias: replyData?.sender_alias,
                        replyToSenderId: replyData?.sender_id
                    });
                }
            }


        } catch (error) {
            console.error('Error sending message:', error);
        }
    };

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setSelectedFile(file);
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
    };

    const cancelImageSelection = () => {
        setSelectedFile(null);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // 🏛️ PASO A (Conservador): Extraer solo el renderizado del tipo de mensaje
    // Esto desacopla la lógica de presentación sin tocar el virtualizer ni handlers
    const renderMessageType = (msg: ChatMessage, messageIsMine: boolean) => {
        if (msg.type === 'image') {
            return (
                <>
                    {/* 🏛️ Label: Reenviado */}
                    {msg.is_forwarded && (
                        <div className="flex items-center gap-1 mb-1.5 opacity-70">
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M7 17L17 7M17 7H7M17 7V17" />
                            </svg>
                            <span className="text-[10px] uppercase tracking-wider font-medium">Reenviado</span>
                        </div>
                    )}
                    {msg.reply_to_id && (
                        <div className={`mb-1.5 p-2 rounded-md border-l-4 border-primary/60 text-[10px] flex flex-col gap-0.5 min-w-[200px] max-w-full ${messageIsMine ? 'bg-black/10' : 'bg-black/5'}`}>
                            <div className="font-bold text-[11px]">
                                {msg.reply_to_sender_id === (anonymousId || '') ? 'Tú' : (msg.reply_to_sender_alias || 'Mensaje')}
                            </div>
                            <div className="line-clamp-2 text-foreground/80 leading-normal">
                                {msg.reply_to_type === 'image' ? (
                                    <span className="flex items-center gap-1"><ImageIcon className="w-2.5 h-2.5" /> Foto</span>
                                ) : msg.reply_to_content}
                            </div>
                        </div>
                    )}
                    <div className="relative aspect-video rounded-md overflow-hidden bg-black/5 mb-1.5">
                        <ChatImage
                            src={msg.content}
                            localUrl={msg.localUrl}
                            alt="Mensaje de imagen"
                            className="w-full h-auto object-cover hover:scale-105 transition-transform cursor-pointer"
                            onClick={() => window.open(msg.content, '_blank')}
                        />
                        {/* 🏛️ UX: Indicador de carga para imágenes pending */}
                        {msg.localStatus === 'pending' && (
                            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                <div className="w-8 h-8 border-2 border-white/80 border-t-transparent rounded-full animate-spin" />
                            </div>
                        )}
                    </div>
                    <div className="flex justify-between items-end gap-2 pl-1">
                        <div className="text-sm whitespace-pre-wrap leading-relaxed overflow-hidden">
                            {msg.caption}
                        </div>
                        {renderMessageMeta(msg, messageIsMine)}
                    </div>
                </>
            );
        }
        
        // Text message
        return (
            <>
                {/* 🏛️ Label: Reenviado */}
                {msg.is_forwarded && (
                    <div className="flex items-center gap-1 mb-1 opacity-70">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M7 17L17 7M17 7H7M17 7V17" />
                        </svg>
                        <span className="text-[10px] uppercase tracking-wider font-medium">Reenviado</span>
                    </div>
                )}
                {msg.reply_to_id && (
                    <div className={`mb-1.5 p-2 rounded-md border-l-4 border-primary/60 text-[10px] flex flex-col gap-0.5 min-w-[180px] max-w-full ${messageIsMine ? 'bg-black/10' : 'bg-black/5'}`}>
                        <div className="font-bold text-[11px]">
                            {msg.reply_to_sender_id === (anonymousId || '') ? 'Tú' : (msg.reply_to_sender_alias || 'Mensaje')}
                        </div>
                        <div className="line-clamp-2 text-foreground/80 leading-normal">
                            {msg.reply_to_type === 'image' ? (
                                <span className="flex items-center gap-1"><ImageIcon className="w-2.5 h-2.5" /> Foto</span>
                            ) : msg.reply_to_content}
                        </div>
                    </div>
                )}
                <span className="whitespace-pre-wrap leading-relaxed break-words text-[15px] block pb-1 relative">
                    {msg.content}
                    {/* 🏛️ UX: Indicador sutil para mensaje pending */}
                    {msg.localStatus === 'pending' && (
                        <span className="inline-flex items-center gap-1 ml-2 text-[10px] opacity-60">
                            <span className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </span>
                    )}
                    <span className="inline-block w-14 h-3" aria-hidden="true"></span>
                </span>
                <span className="absolute bottom-[2px] right-2 flex items-center gap-1 select-none">
                    {renderMessageMeta(msg, messageIsMine)}
                </span>
            </>
        );
    };

    // Helper para metadatos del mensaje (hora, estado, estrella)
    const renderMessageMeta = (msg: ChatMessage, messageIsMine: boolean) => {
        return (
            <>
                {msg.is_starred && <Star className="w-2.5 h-2.5 text-yellow-400 fill-yellow-400 mr-0.5" />}
                {msg.is_edited && (
                    <span className="text-[10px] text-muted-foreground italic mr-1">Editado</span>
                )}
                <span className={`text-[10px] ${messageIsMine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                    {msg.created_at ? (() => {
                        const d = new Date(msg.created_at);
                        return isNaN(d.getTime()) ? '...' : format(d, 'HH:mm', { locale: es });
                    })() : '...'}
                </span>
                {messageIsMine && (
                    <div className="flex items-center">
                        {msg.localStatus === 'pending' ? (
                            <Clock className="w-3 h-3 text-primary-foreground/70 mr-1" />
                        ) : msg.localStatus === 'failed' ? (
                            <button 
                                onClick={() => handleRetry(msg)}
                                className="text-[10px] text-red-200 font-bold underline mr-1 cursor-pointer hover:text-red-100"
                                title="Tocá para reintentar"
                            >
                                Error
                            </button>
                        ) : msg.is_read ? (
                            <CheckCheck className="w-3.5 h-3.5 text-[#00E5FF] drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]" />
                        ) : msg.is_delivered ? (
                            <CheckCheck className="w-3.5 h-3.5 text-primary-foreground/60 drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]" />
                        ) : (
                            <Check className="w-3.5 h-3.5 text-primary-foreground/50 drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]" />
                        )}
                    </div>
                )}
            </>
        );
    };

    // 🏛️ PASO B: MessageItem como componente interno
    // Extrae todo el renderizado de un mensaje individual sin tocar el virtualizer
    interface MessageItemProps {
        msg: ChatMessage;
        isMessageMine: boolean;
    }

    const MessageItem = React.memo(({ msg, isMessageMine }: MessageItemProps) => {
        const isPinned = room.pinned_message_id === msg.id;
        const isPickerActive = reactionPickerMessageId === msg.id;

        return (
            <MessageBubbleWrapper
                msg={msg}
                isMe={isMessageMine}
                anonymousId={anonymousId || ''}
                onReaction={(emoji) => handleReaction(msg.id, emoji)}
                pickerActive={isPickerActive}
                setPickerActive={(active) => setReactionPickerMessageId(active ? msg.id : null)}
                onSelectionChange={(selected) => setSelectedMessageForActions(selected ? msg : null)}
            >
                <div className={`${msg.type === 'image' ? 'p-1.5' : 'px-4 py-2.5'} rounded-2xl relative group/bubble ${isMessageMine ? 'bg-primary text-primary-foreground rounded-tr-none shadow-md shadow-primary/10' : 'bg-card text-card-foreground rounded-tl-none border border-border/40 shadow-md shadow-black/5'}`}>
                    {/* WhatsApp-Style Action Chevron (Fixed Corner) */}
                    <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                onPointerDown={(e) => e.stopPropagation()}
                                className={`hidden md:flex absolute top-0 right-0 h-8 w-10 items-start justify-end pr-1 opacity-0 group-hover/bubble:opacity-100 data-[state=open]:opacity-100 transition-opacity outline-none z-30 rounded-tr-lg
                                ${isMessageMine
                                        ? 'bg-gradient-to-l from-primary via-primary/80 to-transparent text-primary-foreground/70 hover:text-primary-foreground'
                                        : 'bg-gradient-to-l from-card via-card/80 to-transparent text-foreground/40 hover:text-foreground'}`}
                            >
                                <ChevronDown className="w-4 h-4 mt-1" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            align={isMessageMine ? 'end' : 'start'}
                            sideOffset={5}
                            className="w-52 p-1.5 rounded-xl shadow-2xl bg-background border border-border z-[100] animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2"
                        >
                            <DropdownMenuItem onClick={() => setReplyingTo(msg)} className="cursor-pointer py-2 px-3 text-[14.5px] font-normal text-foreground hover:bg-muted focus:bg-muted rounded-lg">
                                <Reply className="w-4 h-4 mr-3 opacity-70" /> Responder
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handlePinMessage(isPinned ? null : msg.id)} className="cursor-pointer py-2 px-3 text-[14.5px] font-normal text-foreground hover:bg-muted focus:bg-muted rounded-lg">
                                <Pin className="w-4 h-4 mr-3 opacity-70" /> {isPinned ? 'Desfijar' : 'Fijar mensaje'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStarMessage(msg)} className="cursor-pointer py-2 px-3 text-[14.5px] font-normal text-foreground hover:bg-muted focus:bg-muted rounded-lg">
                                <Star className={`w-4 h-4 mr-3 ${msg.is_starred ? 'fill-yellow-400 text-yellow-400' : 'opacity-70'}`} /> {msg.is_starred ? 'Anular destaque' : 'Destacar'}
                            </DropdownMenuItem>
                            {isMessageMine && (
                                <DropdownMenuItem
                                    className="cursor-pointer py-2 px-3 text-[14.5px] font-normal text-foreground hover:bg-muted focus:bg-muted rounded-lg group/delete"
                                    onClick={() => deleteMessageMutation.mutate({ roomId: room.id, messageId: msg.id })}
                                >
                                    <Trash2 className="w-4 h-4 mr-3 opacity-70 group-hover/delete:text-destructive transition-colors" /> Eliminar
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Contenido del mensaje */}
                    {renderMessageType(msg, isMessageMine)}
                </div>
            </MessageBubbleWrapper>
        );
    });
    MessageItem.displayName = 'MessageItem';

    return (
        <motion.div
            className="h-full w-full"
        >
            <Card className="flex flex-col h-full bg-background border-border overflow-hidden shadow-2xl">
                <div className="p-4 border-b border-border flex items-center gap-3 bg-card/50">
                    {onBack && (
                        <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden text-muted-foreground">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    )}
                    <div className="flex-1 min-w-0 flex items-center gap-3">
                        <div className="relative shrink-0">
                            <Avatar className="w-9 h-9 border border-border">
                                <AvatarImage src={otherParticipant.avatar || getAvatarUrl(otherParticipant.alias)} />
                                <AvatarFallback className="text-[10px] font-bold">
                                    {getAvatarFallback(otherParticipant.alias)}
                                </AvatarFallback>
                            </Avatar>
                            {presence?.status === 'online' && (
                                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-primary rounded-full border-2 border-card ring-1 ring-primary/20 animate-in fade-in zoom-in duration-300" />
                            )}
                        </div>
                        <div>
                            <h3 className="text-foreground font-bold text-sm truncate uppercase tracking-wider">
                                @{otherParticipant.alias}
                            </h3>
                            <div className="flex items-center gap-1.5 h-4">
                                {presence?.status === 'online' ? (
                                    <span className="text-[10px] text-primary font-bold animate-pulse flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                                        EN LÍNEA
                                    </span>
                                ) : isOtherTyping ? (
                                    <span className="text-[10px] text-primary/70 italic animate-pulse">escribiendo...</span>
                                ) : (
                                    <span className="text-[10px] text-muted-foreground truncate">
                                        {presence?.last_seen_at ? (() => {
                                            const date = new Date(presence.last_seen_at);
                                            const now = new Date();
                                            const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

                                            let dayLabel = "";
                                            if (diffInDays === 0 && now.getDate() === date.getDate()) {
                                                dayLabel = "hoy";
                                            } else if (diffInDays === 1 || (diffInDays === 0 && now.getDate() !== date.getDate())) {
                                                dayLabel = "ayer";
                                            } else {
                                                dayLabel = format(date, "d 'de' MMM", { locale: es });
                                            }

                                            return `últ. vez ${dayLabel} a las ${format(date, "HH:mm")}`;
                                        })() : (room.report_category ? `Chat vinculado a: ${room.report_title}` : null)}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    {/* 🏛️ FEATURE: Menú de opciones del chat (3 puntos) */}
                    <ChatHeaderMenu
                        onSearchClick={() => setIsSearchOpen(true)}
                    />
                </div>

                <ChatReportContext reportId={room.report_id} />

                {/* Mobile Action Bar */}
                {selectedMessageForActions && (
                    <MobileMessageActionBar
                        selectedMessage={selectedMessageForActions}
                        onClose={() => {
                            setSelectedMessageForActions(null);
                            setReactionPickerMessageId(null);
                        }}
                        onReply={(msg) => setReplyingTo(msg)}
                        onDelete={(msg) => deleteMessageMutation.mutate({ roomId: room.id, messageId: msg.id })}
                        onPin={(msgId) => handlePinMessage(msgId)}
                        onStar={(msg) => handleStarMessage(msg)}
                        onEdit={(msg) => {
                            // Activar modo edición: poblar input con contenido actual
                            setEditingMessage(msg);
                            setMessage(msg.content || '');
                        }}
                        onCopy={async (msg) => {
                            try {
                                await navigator.clipboard.writeText(msg.content || '');
                                if (navigator.vibrate) navigator.vibrate(50);
                            } catch (err) {
                                console.error('Error copiando:', err);
                            }
                        }}
                        isMe={isOwnMessage(selectedMessageForActions, anonymousId)}
                        pinnedId={room.pinned_message_id ?? undefined}
                    />
                )}

                {/* ✅ WhatsApp-Grade: Pinned Message Banner */}
                {room.pinned_message_id && (
                    <div
                        onClick={() => handleJumpToMessage(room.pinned_message_id!)}
                        className="bg-card/90 backdrop-blur-md px-4 py-2.5 border-b border-border/50 flex items-center gap-3 cursor-pointer hover:bg-muted/50 transition-colors z-20"
                    >
                        <div className="bg-primary/10 p-1.5 rounded-lg">
                            <Pin className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-0.5">Mensaje Fijado</p>
                            <p className="text-xs text-muted-foreground truncate italic">
                                {messages?.find(m => m.id === room.pinned_message_id)?.content || 'Ver mensaje'}
                            </p>
                        </div>
                        <X
                            className="w-4 h-4 text-muted-foreground hover:text-foreground p-0.5"
                            onClick={(e) => {
                                e.stopPropagation();
                                handlePinMessage(null as any); // Unpin
                            }}
                        />
                    </div>
                )}

                <div
                    className="flex-1 p-4 overflow-y-auto custom-scrollbar bg-background/50 flex flex-col"
                    ref={parentRef}
                >
                    {messagesLoading ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
                            <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                            <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-[0.2em]">Sincronizando mensajes...</p>
                        </div>
                    ) : !messages || messages.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center animate-in fade-in zoom-in duration-500">
                            <div className="w-20 h-20 bg-muted/30 rounded-full flex items-center justify-center mb-6 relative">
                                <MessageSquare className="text-muted-foreground/20 w-10 h-10" />
                                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                                    <Send className="w-3 h-3 text-primary-foreground" />
                                </div>
                            </div>
                            <h4 className="text-foreground font-bold text-lg mb-2">¡Iniciá la charla!</h4>
                            <p className="text-muted-foreground text-xs max-w-[240px] leading-relaxed">
                                Saludá a <span className="text-primary font-bold">@{otherParticipant.alias}</span>. Las mejores colaboraciones empiezan con un simple "Hola".
                            </p>
                        </div>
                    ) : (
                        <div
                            style={{
                                height: `${rowVirtualizer.getTotalSize()}px`,
                                width: '100%',
                                position: 'relative',
                            }}
                        >
                            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                                const msg = messages[virtualRow.index];
                                return (
                                    <div
                                        key={virtualRow.key}
                                        ref={rowVirtualizer.measureElement}
                                        data-index={virtualRow.index}
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            transform: `translateY(${virtualRow.start}px)`,
                                        }}
                                        className={`flex ${isMe(msg) ? 'justify-end' : 'justify-start'} pb-4 ${msg.id === highlightedMessageId ? 'context-highlight' : ''}`}
                                    >
                                        <div className={`flex gap-2 max-w-[85%] ${isMe(msg) ? 'flex-row-reverse' : 'flex-row'}`}>
                                            {!isMe(msg) && (
                                                <div
                                                    className="relative group cursor-pointer shrink-0"
                                                    onClick={() => navigate(`/usuario/${msg.sender_alias}`)}
                                                >
                                                    <img
                                                        src={msg.sender_avatar || getAvatarUrl(msg.sender_alias || 'Anon')}
                                                        alt="Avatar"
                                                        className="w-8 h-8 rounded-full border border-border mt-1 object-cover"
                                                    />
                                                </div>
                                            )}
                                            <div className={`flex flex-col ${isMe(msg) ? 'items-end' : 'items-start'} max-w-full sm:max-w-[100%]`}>
                                                {/* 🏛️ PASO B: MessageItem componente interno */}
                                                <MessageItem msg={msg} isMessageMine={isMe(msg)} />
                                            </div>

                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>


                <div className="px-4 h-6 flex items-center">
                    <AnimatePresence>
                        {isOtherTyping && (
                            <motion.div
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 5 }}
                                className="flex items-center gap-2"
                            >
                                <div className="flex gap-1 items-center">
                                    <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                    <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                    <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce"></span>
                                </div>
                                <span className="text-[10px] text-muted-foreground italic lowercase">
                                    {room.type === 'group' ? `@${otherParticipant.alias} está escribiendo...` : 'escribiendo...'}
                                </span>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <AnimatePresence>
                    {replyingTo && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="px-4 pb-2"
                        >
                            <div className="bg-muted/50 border-l-4 border-primary rounded-r-lg p-2 relative group max-h-[100px] overflow-hidden">
                                <div className="text-[10px] font-bold text-primary mb-1 uppercase tracking-wider pr-6">
                                    Respondiendo a {replyingTo.sender_id === anonymousId ? 'Tú' : replyingTo.sender_alias}
                                </div>

                                <div className="text-xs text-muted-foreground line-clamp-3 pr-6 break-words">
                                    {replyingTo.type === 'image' ? (
                                        <span className="flex items-center gap-1">
                                            <ImageIcon className="w-3 h-3" /> Foto
                                            {replyingTo.caption && <span className="truncate">{replyingTo.caption}</span>}
                                        </span>
                                    ) : replyingTo.content}
                                </div>
                                <button
                                    onClick={() => setReplyingTo(null)}
                                    className="absolute top-1 right-1 p-1 hover:bg-background/50 rounded-full transition-colors"
                                >
                                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {previewUrl && (
                    <div className="bg-background/80 backdrop-blur-md border-t border-border p-4 transition-all duration-300">
                        <div className="flex items-center gap-4 max-w-2xl mx-auto">
                            <div className="relative group shrink-0">
                                <img
                                    src={previewUrl}
                                    alt="Vista previa"
                                    className={`h-20 w-20 object-cover rounded-lg border border-border shadow-lg ${isUploading ? 'opacity-50' : ''}`}
                                />
                                {/* 🏛️ BLOQUE 2: Loading overlay */}
                                {isUploading && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                    </div>
                                )}
                                {/* Cancel button - hidden during upload */}
                                {!isUploading && (
                                    <button
                                        onClick={cancelImageSelection}
                                        className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground p-1 rounded-full shadow-lg hover:bg-destructive/90 transition-colors"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                )}
                            </div>
                            <div className="flex-1 text-sm text-muted-foreground">
                                <p className="font-medium text-foreground mb-1 uppercase tracking-tighter text-xs">
                                    {isUploading ? 'Enviando imagen...' : 'Imagen seleccionada'}
                                </p>
                                {/* 🏛️ BLOQUE 2: Progress bar */}
                                {isUploading ? (
                                    <div className="w-full max-w-[200px]">
                                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-primary transition-all duration-200 rounded-full"
                                                style={{ width: `${uploadProgress}%` }}
                                            />
                                        </div>
                                        <p className="text-[10px] mt-1 text-muted-foreground">{uploadProgress}%</p>
                                    </div>
                                ) : (
                                    <p className="text-[11px]">Escribí una leyenda opcional abajo antes de enviar.</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <div className="p-4 bg-card border-t border-border">
                    <div className="flex items-end gap-2">
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={handleImageSelect}
                            disabled={isUploading}
                        />
                        <Button
                            variant="ghost"
                            size="icon"
                            className={`text-muted-foreground hover:text-foreground shrink-0 mb-1 ${previewUrl ? 'text-primary' : ''}`}
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                        >
                            <ImageIcon className="h-5 w-5" />
                        </Button>
                        
                        {/* 🏛️ FIX: Textarea auto-expandible como WhatsApp */}
                        <textarea
                            ref={inputRef}
                            value={message}
                            onChange={(e) => updateMessage(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey && !isUploading) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            placeholder={previewUrl ? "Añadir leyenda..." : "Escribí un mensaje..."}
                            disabled={isUploading}
                            rows={1}
                            className="flex-1 min-h-[40px] max-h-[120px] bg-muted border border-input rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none overflow-y-auto"
                            style={{ height: 'auto' }}
                        />

                        <Button
                            onClick={handleSend}
                            disabled={(!message.trim() && !selectedFile) || isUploading}
                            className="shrink-0 rounded-xl min-w-[40px] mb-1"
                        >
                            {isUploading ? (
                                <div className="w-4 h-4 border-2 border-white/80 border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <Send className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                </div>

                {/* 🏛️ FEATURE: Modal de búsqueda de mensajes */}
                <MessageSearchModal
                    isOpen={isSearchOpen}
                    onClose={() => setIsSearchOpen(false)}
                    messages={messages || []}
                    onNavigateToMessage={handleJumpToMessage}
                    currentUserId={anonymousId}
                />
            </Card>
        </motion.div>
    );
};

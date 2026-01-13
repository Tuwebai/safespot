import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { useVirtualizer } from '@tanstack/react-virtual';

import {
    useChatMessages,
    useSendMessageMutation,
    useMarkAsReadMutation,
    useMarkAsDeliveredMutation,
    useUserPresence,
    useDeleteMessageMutation
} from '../../hooks/queries/useChatsQuery';


import { ChatRoom, ChatMessage, chatsApi } from '../../lib/api';
import { getAvatarUrl } from '../../lib/avatar';
import { useAnonymousId } from '../../hooks/useAnonymousId';
import { isOwnMessage } from '../../lib/chatHelpers';
import {
    Send,
    Image as ImageIcon,
    X,
    ArrowLeft,
    Check,
    CheckCheck,
    MessageSquare,
    ChevronDown,
    Reply,
    Trash2,
    SmilePlus,
    Pin,
    Star,
    Clock // ✅ UX: Needed for pending state
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
import { Input } from '../ui/input';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChatReportContext } from './ChatReportContext';


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

    useEffect(() => {
        if (!src) return;
        if (src === currentSrc && isLoaded) return;

        const img = new Image();
        img.src = src;
        img.onload = () => {
            setCurrentSrc(src);
            setIsLoaded(true);
        };
    }, [src, localUrl, currentSrc, isLoaded]);

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

interface ChatWindowProps {
    room: ChatRoom;
    onBack?: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ room, onBack }) => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);

    // ✅ ENTERPRISE FIX: Use useAnonymousId hook instead of localStorage
    // Guarantees clean UUID without v1|/v2| prefixes
    const anonymousId = useAnonymousId();

    const [message, setMessage] = useState('');
    const {
        data: messages,
        isLoading: messagesLoading,
        isOtherTyping
    } = useChatMessages(room.id);
    const { data: presence } = useUserPresence(room.other_participant_id);

    const sendMessageMutation = useSendMessageMutation();
    const deleteMessageMutation = useDeleteMessageMutation();
    const markAsReadMutation = useMarkAsReadMutation();
    const markAsDeliveredMutation = useMarkAsDeliveredMutation();

    // Virtualization Refs
    const parentRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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

    const inputRef = useRef<HTMLInputElement>(null);

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

    // ✅ ENTERPRISE FIX: Use centralized isOwnMessage helper
    // Handles all edge cases: null safety, format normalization
    const isMe = (msg: ChatMessage) => isOwnMessage(msg, anonymousId);

    useLayoutEffect(() => {
        if (!messages) return;

        if (lastRoomId.current !== room.id) {
            lastMessageCount.current = 0;
            lastRoomId.current = room.id;
            hasMarkedRead.current = false;
        }

        if (messages.length > lastMessageCount.current) {
            rowVirtualizer.scrollToIndex(messages.length - 1, { align: 'end' });
            lastMessageCount.current = messages.length;

            const lastMessage = messages[messages.length - 1];
            if (lastMessage && !isMe(lastMessage) && !lastMessage.is_read) {
                markAsReadMutation.mutate(room.id);
            }
        }
    }, [messages, room.id, anonymousId, rowVirtualizer]);

    // Highlight & Scroll to Message Logic
    const highlightId = searchParams.get('highlight_message');
    const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(highlightId);

    useEffect(() => {
        if (highlightId && messages) {
            const index = messages.findIndex(m => m.id === highlightId);
            if (index !== -1) {
                rowVirtualizer.scrollToIndex(index, { align: 'center' });
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

        const performInitialMarking = async () => {
            if (markAsReadMutation.isPending || markAsDeliveredMutation.isPending) return;

            if (room.unread_count > 0) {
                markAsReadMutation.mutate(room.id);
            } else {
                markAsDeliveredMutation.mutate(room.id);
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

    const handleSend = async () => {
        if (!message.trim() && !selectedFile) return;

        try {
            const contentToSend = message;
            const fileToSend = selectedFile;
            const captionToSend = selectedFile ? message : undefined;

            setMessage('');
            cancelImageSelection();

            if (contentToSend.trim() || fileToSend) {
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

                await sendMessageMutation.mutateAsync({
                    id: optimisticId, // Pass generated ID
                    roomId: room.id,
                    content: contentToSend,
                    type: fileToSend ? 'image' : 'text',
                    file: fileToSend || undefined,
                    caption: captionToSend,
                    replyToId: replyData?.id,
                    replyToContent: replyData?.content,
                    replyToType: replyData?.type,
                    replyToSenderAlias: replyData?.sender_alias,
                    replyToSenderId: replyData?.sender_id
                });
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

    return (
        <motion.div
            className="h-full w-full"
            drag="x"
            dragConstraints={{ left: 0, right: 1000 }}
            dragElastic={0.1}
            onDragEnd={(_, info) => {
                if (info.offset.x > 100 && onBack) {
                    onBack();
                }
            }}
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
                                    {otherParticipant.alias?.substring(0, 2).toUpperCase()}
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
                </div>

                <ChatReportContext reportId={room.report_id} />

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
                                                {msg.type === 'image' ? (
                                                    <div className={`p-1.5 rounded-lg overflow-hidden relative group/bubble ${isMe(msg) ? 'bg-primary text-primary-foreground rounded-tr-none shadow-sm' : 'bg-card text-card-foreground rounded-tl-none border border-border/40 shadow-sm'}`}>
                                                        {/* WhatsApp-Style Action Chevron (Fixed Corner) */}
                                                        <DropdownMenu modal={false}>
                                                            <DropdownMenuTrigger asChild>
                                                                <button
                                                                    type="button"
                                                                    onPointerDown={(e) => e.stopPropagation()}
                                                                    className={`absolute top-0 right-0 h-8 w-10 flex items-start justify-end pr-1 opacity-0 group-hover/bubble:opacity-100 data-[state=open]:opacity-100 transition-opacity outline-none z-30 rounded-tr-lg
                                                                        ${isMe(msg)
                                                                            ? 'bg-gradient-to-l from-primary via-primary/80 to-transparent text-primary-foreground/70 hover:text-primary-foreground'
                                                                            : 'bg-gradient-to-l from-card via-card/80 to-transparent text-foreground/40 hover:text-foreground'}`}
                                                                >
                                                                    <ChevronDown className="w-4 h-4 mt-1" />
                                                                </button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent
                                                                align={isMe(msg) ? 'end' : 'start'}
                                                                sideOffset={5}
                                                                className="w-52 p-1.5 rounded-xl shadow-2xl bg-popover border-none z-[100] animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2"
                                                            >
                                                                <DropdownMenuItem onClick={() => setReplyingTo(msg)} className="cursor-pointer py-2 px-3 text-[14.5px] font-normal text-popover-foreground hover:bg-muted/50 focus:bg-muted/50 rounded-lg">
                                                                    <Reply className="w-4 h-4 mr-3 opacity-70" /> Responder
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem disabled className="cursor-not-allowed py-2 px-3 text-[14.5px] font-normal text-popover-foreground/50 hover:bg-transparent rounded-lg">
                                                                    <SmilePlus className="w-4 h-4 mr-3 opacity-50" /> Reaccionar
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem disabled className="cursor-not-allowed py-2 px-3 text-[14.5px] font-normal text-popover-foreground/50 hover:bg-transparent rounded-lg">
                                                                    <Pin className="w-4 h-4 mr-3 opacity-50" /> Fijar
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem disabled className="cursor-not-allowed py-2 px-3 text-[14.5px] font-normal text-popover-foreground/50 hover:bg-transparent rounded-lg">
                                                                    <Star className="w-4 h-4 mr-3 opacity-50" /> Destacar
                                                                </DropdownMenuItem>
                                                                {isMe(msg) && (
                                                                    <DropdownMenuItem
                                                                        className="cursor-pointer py-2 px-3 text-[14.5px] font-normal text-popover-foreground hover:bg-muted/50 focus:bg-muted/50 rounded-lg group/delete"
                                                                        onClick={() => deleteMessageMutation.mutate({ roomId: room.id, messageId: msg.id })}
                                                                    >
                                                                        <Trash2 className="w-4 h-4 mr-3 opacity-70 group-hover/delete:text-destructive transition-colors" /> Eliminar
                                                                    </DropdownMenuItem>
                                                                )}
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>

                                                        {msg.reply_to_id && (
                                                            <div className={`mb-1.5 p-2 rounded-md border-l-4 border-primary/60 text-[10px] flex flex-col gap-0.5 min-w-[200px] max-w-full ${isMe(msg) ? 'bg-black/10' : 'bg-black/5'}`}>
                                                                <div className="font-bold text-[11px]">
                                                                    {msg.reply_to_sender_id === anonymousId ? 'Tú' : (msg.reply_to_sender_alias || 'Mensaje')}
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
                                                        </div>

                                                        <div className="flex justify-between items-end gap-2 pl-1">
                                                            <div className="text-sm whitespace-pre-wrap leading-relaxed overflow-hidden">
                                                                {msg.caption}
                                                            </div>

                                                            <div className="flex items-center gap-1 shrink-0 pb-0.5">
                                                                <span className={`text-[10px] ${isMe(msg) ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                                                                    {format(new Date(msg.created_at), 'HH:mm', { locale: es })}
                                                                </span>
                                                                {isMe(msg) && (
                                                                    <div className="flex items-center">
                                                                        {msg.localStatus === 'pending' ? (
                                                                            <Clock className="w-3 h-3 text-muted-foreground mr-1" />
                                                                        ) : msg.is_read ? (
                                                                            <CheckCheck className="w-3.5 h-3.5 text-[#00E5FF] drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]" />
                                                                        ) : msg.is_delivered ? (
                                                                            <CheckCheck className="w-3.5 h-3.5 text-primary-foreground/60 drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]" />
                                                                        ) : (
                                                                            <Check className="w-3.5 h-3.5 text-primary-foreground/50 drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]" />
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className={`px-3 py-2 rounded-lg relative group/bubble ${isMe(msg) ? 'bg-primary text-primary-foreground rounded-tr-none shadow-sm' : 'bg-card text-card-foreground rounded-tl-none border border-border/40 shadow-sm'}`}>
                                                        {/* WhatsApp-Style Action Chevron (Fixed Corner) */}
                                                        <DropdownMenu modal={false}>
                                                            <DropdownMenuTrigger asChild>
                                                                <button
                                                                    type="button"
                                                                    onPointerDown={(e) => e.stopPropagation()}
                                                                    className={`absolute top-0 right-0 h-8 w-10 flex items-start justify-end pr-1 opacity-0 group-hover/bubble:opacity-100 data-[state=open]:opacity-100 transition-opacity outline-none z-30 rounded-tr-lg
                                                                        ${isMe(msg)
                                                                            ? 'bg-gradient-to-l from-primary via-primary/80 to-transparent text-primary-foreground/70 hover:text-primary-foreground'
                                                                            : 'bg-gradient-to-l from-card via-card/80 to-transparent text-foreground/40 hover:text-foreground'}`}
                                                                >
                                                                    <ChevronDown className="w-4 h-4 mt-1" />
                                                                </button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent
                                                                align={isMe(msg) ? 'end' : 'start'}
                                                                sideOffset={5}
                                                                className="w-52 p-1.5 rounded-xl shadow-2xl bg-popover border-none z-[100] animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2"
                                                            >
                                                                <DropdownMenuItem onClick={() => setReplyingTo(msg)} className="cursor-pointer py-2 px-3 text-[14.5px] font-normal text-popover-foreground hover:bg-muted/50 focus:bg-muted/50 rounded-lg">
                                                                    <Reply className="w-4 h-4 mr-3 opacity-70" /> Responder
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem disabled className="cursor-not-allowed py-2 px-3 text-[14.5px] font-normal text-popover-foreground/50 hover:bg-transparent rounded-lg">
                                                                    <SmilePlus className="w-4 h-4 mr-3 opacity-50" /> Reaccionar
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem disabled className="cursor-not-allowed py-2 px-3 text-[14.5px] font-normal text-popover-foreground/50 hover:bg-transparent rounded-lg">
                                                                    <Pin className="w-4 h-4 mr-3 opacity-50" /> Fijar
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem disabled className="cursor-not-allowed py-2 px-3 text-[14.5px] font-normal text-popover-foreground/50 hover:bg-transparent rounded-lg">
                                                                    <Star className="w-4 h-4 mr-3 opacity-50" /> Destacar
                                                                </DropdownMenuItem>
                                                                {isMe(msg) && (
                                                                    <DropdownMenuItem
                                                                        className="cursor-pointer py-2 px-3 text-[14.5px] font-normal text-popover-foreground hover:bg-muted/50 focus:bg-muted/50 rounded-lg group/delete"
                                                                        onClick={() => deleteMessageMutation.mutate({ roomId: room.id, messageId: msg.id })}
                                                                    >
                                                                        <Trash2 className="w-4 h-4 mr-3 opacity-70 group-hover/delete:text-destructive transition-colors" /> Eliminar
                                                                    </DropdownMenuItem>
                                                                )}
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>

                                                        {msg.reply_to_id && (
                                                            <div className={`mb-1.5 p-2 rounded-md border-l-4 border-primary/60 text-[10px] flex flex-col gap-0.5 min-w-[180px] max-w-full ${isMe(msg) ? 'bg-black/10' : 'bg-black/5'}`}>
                                                                <div className="font-bold text-[11px]">
                                                                    {msg.reply_to_sender_id === anonymousId ? 'Tú' : (msg.reply_to_sender_alias || 'Mensaje')}
                                                                </div>
                                                                <div className="line-clamp-2 text-foreground/80 leading-normal">
                                                                    {msg.reply_to_type === 'image' ? (
                                                                        <span className="flex items-center gap-1"><ImageIcon className="w-2.5 h-2.5" /> Foto</span>
                                                                    ) : msg.reply_to_content}
                                                                </div>
                                                            </div>
                                                        )}

                                                        <span className="whitespace-pre-wrap leading-relaxed break-words text-[15px] block pb-1">
                                                            {msg.content}
                                                            <span className="inline-block w-14 h-3" aria-hidden="true"></span>
                                                        </span>

                                                        <span className="absolute bottom-[2px] right-2 flex items-center gap-1 select-none">
                                                            <span className={`text-[10px] ${isMe(msg) ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                                                                {msg.created_at ? (() => {
                                                                    const d = new Date(msg.created_at);
                                                                    return isNaN(d.getTime()) ? '...' : format(d, 'HH:mm', { locale: es });
                                                                })() : '...'}
                                                            </span>

                                                            {isMe(msg) && (
                                                                <div className="flex items-center">
                                                                    {msg.localStatus === 'pending' ? (
                                                                        <Clock className="w-3 h-3 text-primary-foreground/70 mr-1" />
                                                                    ) : msg.is_read ? (
                                                                        <CheckCheck className="w-3.5 h-3.5 text-[#00E5FF] drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]" />
                                                                    ) : msg.is_delivered ? (
                                                                        <CheckCheck className="w-3.5 h-3.5 text-primary-foreground/60 drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]" />
                                                                    ) : (
                                                                        <Check className="w-3.5 h-3.5 text-primary-foreground/50 drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]" />
                                                                    )}
                                                                </div>
                                                            )}
                                                        </span>
                                                    </div>
                                                )}
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
                            <div className="bg-muted/50 border-l-4 border-primary rounded-r-lg p-2 relative group">
                                <div className="text-[10px] font-bold text-primary mb-1 uppercase tracking-wider">
                                    Respondiendo a {replyingTo.sender_id === anonymousId ? 'Tú' : replyingTo.sender_alias}
                                </div>

                                <div className="text-xs text-muted-foreground truncate max-w-[90%]">
                                    {replyingTo.type === 'image' ? (
                                        <span className="flex items-center gap-1">
                                            <ImageIcon className="w-3 h-3" /> Foto
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
                                    className="h-20 w-20 object-cover rounded-lg border border-border shadow-lg"
                                />
                                <button
                                    onClick={cancelImageSelection}
                                    className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground p-1 rounded-full shadow-lg hover:bg-destructive/90 transition-colors"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </div>
                            <div className="flex-1 text-sm text-muted-foreground">
                                <p className="font-medium text-foreground mb-1 uppercase tracking-tighter text-xs">Imagen seleccionada</p>
                                <p className="text-[11px]">Escribí una leyenda opcional abajo antes de enviar.</p>
                            </div>
                        </div>
                    </div>
                )}

                <div className="p-4 bg-card border-t border-border">
                    <div className="flex items-center gap-2">
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={handleImageSelect}
                        />
                        <Button
                            variant="ghost"
                            size="icon"
                            className={`text-muted-foreground hover:text-foreground shrink-0 ${previewUrl ? 'text-primary' : ''}`}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <ImageIcon className="h-5 w-5" />
                        </Button>
                        <Input
                            ref={inputRef}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder={previewUrl ? "Añadir leyenda..." : "Escribí un mensaje..."}
                            className="bg-muted border-input text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/50"
                        />

                        <Button
                            onClick={handleSend}
                            disabled={!message.trim() && !selectedFile}
                            className="shrink-0 rounded-xl"
                        >
                            <Send className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </Card>
        </motion.div>
    );
};

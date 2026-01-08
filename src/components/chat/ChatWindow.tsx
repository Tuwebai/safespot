import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { motion } from 'framer-motion';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useChatMessages, useSendMessageMutation, useMarkAsReadMutation, useMarkAsDeliveredMutation } from '../../hooks/queries/useChatsQuery';
import { ChatRoom, ChatMessage, chatsApi } from '../../lib/api';
import { getAvatarUrl } from '../../lib/avatar';
import {
    Send,
    Image as ImageIcon,
    X,
    ArrowLeft,
    Check,
    CheckCheck
} from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { useNavigate } from 'react-router-dom';
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

        // Si el src remoto es el mismo que el actual (ya sea blob o remoto), no hacemos nada
        if (src === currentSrc && isLoaded) return;

        const img = new Image();
        img.src = src;
        img.onload = () => {
            setCurrentSrc(src);
            setIsLoaded(true);
        };
    }, [src, localUrl]);

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
    const [message, setMessage] = useState('');
    const {
        data: messages,
        isLoading: messagesLoading,
        isOtherTyping,
        isOtherOnline
    } = useChatMessages(room.id);
    const sendMessageMutation = useSendMessageMutation();
    const markAsReadMutation = useMarkAsReadMutation();
    const markAsDeliveredMutation = useMarkAsDeliveredMutation();

    // Virtualization Refs
    const parentRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const anonymousId = localStorage.getItem('safespot_anonymous_id');

    const otherParticipant = room.participant_a === anonymousId
        ? { alias: room.participant_b_alias, id: room.participant_b }
        : { alias: room.participant_a_alias, id: room.participant_a };

    // Initialize Virtualizer
    const rowVirtualizer = useVirtualizer({
        count: messages?.length ?? 0,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 80, // Avg message height guess
        overscan: 5,
    });

    // Auto-scroll logic
    const lastMessageCount = useRef(0);

    useLayoutEffect(() => {
        if (messages && messages.length > lastMessageCount.current) {
            // New messages arrived. 
            // In a real app, check if user is at bottom before force scrolling, 
            // but for "Instant App" feel, standard behavior is snap to bottom on new msg.
            rowVirtualizer.scrollToIndex(messages.length - 1, { align: 'end' });
            lastMessageCount.current = messages.length;

            // Mark as read check
            const lastMessage = messages[messages.length - 1];
            if (lastMessage && lastMessage.sender_id !== anonymousId && !lastMessage.is_read) {
                markAsReadMutation.mutate(room.id);
            }
        }
    }, [messages, room.id, anonymousId, rowVirtualizer, markAsReadMutation]);

    // Marcar como leído al entrar o cuando llegan mensajes (Legacy effect kept for safety)
    useEffect(() => {
        if (room.id) {
            markAsReadMutation.mutate(room.id);
            // También marcamos como entregado explícitamente al abrir
            markAsDeliveredMutation.mutate(room.id);
        }
    }, [room.id, markAsReadMutation, markAsDeliveredMutation]); // Removed messages length dep, handled above

    // Notificar cuando el usuario escribe
    useEffect(() => {
        if (!message.trim()) {
            chatsApi.notifyTyping(room.id, false);
            return;
        }

        chatsApi.notifyTyping(room.id, true);

        const timeout = setTimeout(() => {
            chatsApi.notifyTyping(room.id, false);
        }, 3000);

        return () => {
            clearTimeout(timeout);
            chatsApi.notifyTyping(room.id, false);
        };
    }, [message, room.id]);

    const handleSend = async () => {
        if ((!message.trim() && !selectedFile) || sendMessageMutation.isPending) return;

        try {
            const contentToSend = message;
            const fileToSend = selectedFile;
            const captionToSend = selectedFile ? message : undefined;

            // Optimistic clear
            setMessage('');
            cancelImageSelection();

            await sendMessageMutation.mutateAsync({
                roomId: room.id,
                content: contentToSend,
                type: fileToSend ? 'image' : 'text',
                caption: captionToSend,
                file: fileToSend || undefined
            });

        } catch (error) {
            console.error('Error sending message:', error);
            // Optional: Restore message on error if robust error handling is desired, 
            // but for now we follow the "instant" pattern.
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

    const isMe = (msg: ChatMessage) => msg.sender_id === anonymousId;

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
                {/* Header */}
                <div className="p-4 border-b border-border flex items-center gap-3 bg-card/50">
                    {onBack && (
                        <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden text-muted-foreground">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    )}
                    <div className="flex-1 min-w-0">
                        <h3 className="text-foreground font-bold text-sm truncate uppercase tracking-wider">
                            @{otherParticipant.alias}
                        </h3>
                        <div className="flex items-center gap-1.5 h-4">
                            {isOtherOnline ? (
                                <span className="text-[10px] text-primary font-bold animate-pulse flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                                    EN LÍNEA
                                </span>
                            ) : isOtherTyping ? (
                                <span className="text-[10px] text-primary/70 italic animate-pulse">escribiendo...</span>
                            ) : (
                                <span className="text-[10px] text-muted-foreground truncate">
                                    {room.report_category ? `Chat vinculado a: ${room.report_title}` : 'Mensaje Directo'}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Report Context (Expandable) */}
                <ChatReportContext reportId={room.report_id} />

                {/* Messages Area - VIRTUALIZED */}
                <div
                    className="flex-1 p-4 overflow-y-auto custom-scrollbar bg-background/50"
                    ref={parentRef}
                >
                    {messagesLoading ? (
                        <div className="text-center text-muted-foreground py-10 uppercase tracking-widest text-xs">Cargando mensajes...</div>
                    ) : !messages || messages.length === 0 ? (
                        <div className="text-center py-10">
                            <p className="text-muted-foreground text-xs italic">No hay mensajes aún. ¡Iniciá la conversación!</p>
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
                                        className={`flex ${isMe(msg) ? 'justify-end' : 'justify-start'} pb-4`}
                                    >
                                        <div className={`flex gap-2 max-w-[85%] ${isMe(msg) ? 'flex-row-reverse' : 'flex-row'}`}>
                                            {!isMe(msg) && (
                                                <div
                                                    className="relative group cursor-pointer shrink-0"
                                                    onClick={() => navigate(`/usuario/${msg.sender_alias}`)}
                                                >
                                                    <img
                                                        src={getAvatarUrl(msg.sender_alias || 'Anon')}
                                                        alt="Avatar"
                                                        className="w-8 h-8 rounded-full border border-border mt-1"
                                                    />
                                                </div>
                                            )}
                                            <div className={`flex flex-col ${isMe(msg) ? 'items-end' : 'items-start'} max-w-[85%] sm:max-w-[75%]`}>
                                                <div
                                                    className={`relative px-3 py-2 rounded-2xl text-sm shadow-sm ${isMe(msg)
                                                        ? 'bg-primary text-primary-foreground rounded-tr-none'
                                                        : 'bg-muted text-foreground border border-border rounded-tl-none'
                                                        }`}
                                                >
                                                    {msg.type === 'image' ? (
                                                        <div className="flex flex-col gap-1">
                                                            <div className="max-w-[200px] sm:max-w-[300px] overflow-hidden rounded-lg">
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
                                                                            {msg.is_read ? (
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
                                                        <div className="relative">
                                                            <span className="whitespace-pre-wrap leading-relaxed break-words text-[15px] block">
                                                                {msg.content}
                                                                {/* Spacer to reserve space for absolute timestamp */}
                                                                <span className="inline-block w-12 h-3" aria-hidden="true"></span>
                                                            </span>

                                                            {/* Timestamp Absolute Bottom Right */}
                                                            <span className="absolute bottom-[-4px] right-0 flex items-center gap-1 select-none">
                                                                <span className={`text-[10px] ${isMe(msg) ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                                                                    {format(new Date(msg.created_at), 'HH:mm', { locale: es })}
                                                                </span>
                                                                {isMe(msg) && (
                                                                    <div className="flex items-center">
                                                                        {msg.is_read ? (
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
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {isOtherTyping && (
                        <div className="flex items-center gap-2 mt-4 px-2">
                            {/* ... typing indicator ... */}
                            <div className="flex gap-1 items-center">
                                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"></span>
                            </div>
                            <span className="text-[10px] text-muted-foreground italic">
                                Escribiendo...
                            </span>
                        </div>
                    )}
                </div>

                {/* Image Preview Overlay */}
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

                {/* Input Area */}
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
                            disabled={sendMessageMutation.isPending}
                        >
                            <ImageIcon className="h-5 w-5" />
                        </Button>


                        <Input
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder={previewUrl ? "Añadir leyenda..." : "Escribí un mensaje..."}
                            className="bg-muted border-input text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/50"
                            disabled={sendMessageMutation.isPending}
                        />
                        <Button
                            onClick={handleSend}
                            disabled={(!message.trim() && !selectedFile) || sendMessageMutation.isPending}
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

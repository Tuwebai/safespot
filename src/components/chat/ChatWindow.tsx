import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
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
    const scrollRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const anonymousId = localStorage.getItem('safespot_anonymous_id');

    const otherParticipant = room.participant_a === anonymousId
        ? { alias: room.participant_b_alias, id: room.participant_b }
        : { alias: room.participant_a_alias, id: room.participant_a };

    // Auto-scroll al fondo y marcar como leído al recibir mensajes
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }

        // Si hay mensajes nuevos que no envié yo, marcar como leído
        const lastMessage = messages?.[messages.length - 1];
        if (lastMessage && lastMessage.sender_id !== anonymousId && !lastMessage.is_read) {
            markAsReadMutation.mutate(room.id);
        }
    }, [messages, room.id, anonymousId]);

    // Marcar como leído al entrar o cuando llegan mensajes
    useEffect(() => {
        if (room.id) {
            markAsReadMutation.mutate(room.id);
            // También marcamos como entregado explícitamente al abrir
            markAsDeliveredMutation.mutate(room.id);
        }
    }, [room.id, messages?.length]); // Re-ejecutar si la cantidad de mensajes cambia

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
            await sendMessageMutation.mutateAsync({
                roomId: room.id,
                content: message,
                type: selectedFile ? 'image' : 'text',
                caption: selectedFile ? message : undefined,
                file: selectedFile || undefined
            });

            setMessage('');
            cancelImageSelection();
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
            <Card className="flex flex-col h-full bg-[#111] border-white/10 overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="p-4 border-b border-white/5 flex items-center gap-3 bg-white/[0.03]">
                    {onBack && (
                        <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden text-white/70">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    )}
                    <div className="flex-1 min-w-0">
                        <h3 className="text-white font-bold text-sm truncate uppercase tracking-wider">
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
                                <span className="text-[10px] text-white/30 truncate">
                                    Chat vinculado a: {room.report_title}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Report Context (Expandable) */}
                <ChatReportContext reportId={room.report_id} />

                {/* Messages Area */}
                <div className="flex-1 p-4 overflow-y-auto custom-scrollbar" ref={scrollRef}>
                    <div className="space-y-4">
                        {messagesLoading ? (
                            <div className="text-center text-white/30 py-10 uppercase tracking-widest text-xs">Cargando mensajes...</div>
                        ) : messages?.length === 0 ? (
                            <div className="text-center py-10">
                                <p className="text-white/30 text-xs italic">No hay mensajes aún. ¡Iniciá la conversación!</p>
                            </div>
                        ) : (
                            messages?.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`flex ${isMe(msg) ? 'justify-end' : 'justify-start'} `}
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
                                                    className="w-8 h-8 rounded-full border border-white/10 mt-1"
                                                />
                                            </div>
                                        )}
                                        <div className={`flex flex-col ${isMe(msg) ? 'items-end' : 'items-start'} max-w-[85%] sm:max-w-[75%]`}>
                                            <div
                                                className={`relative px-3 py-2 rounded-2xl text-sm shadow-sm ${isMe(msg)
                                                    ? 'bg-primary text-primary-foreground rounded-tr-none'
                                                    : 'bg-white/10 text-white border border-white/10 rounded-tl-none'
                                                    }`}
                                            >
                                                <div className="flex flex-col gap-1">
                                                    {msg.type === 'image' ? (
                                                        <div className="flex flex-col gap-2">
                                                            <div className="max-w-[200px] sm:max-w-[300px] overflow-hidden rounded-lg">
                                                                <ChatImage
                                                                    src={msg.content}
                                                                    localUrl={msg.localUrl}
                                                                    alt="Mensaje de imagen"
                                                                    className="w-full h-auto object-cover hover:scale-105 transition-transform cursor-pointer"
                                                                    onClick={() => window.open(msg.content, '_blank')}
                                                                />
                                                            </div>
                                                            {msg.caption && (
                                                                <div className="text-sm pb-1 px-1 whitespace-pre-wrap leading-relaxed overflow-hidden">
                                                                    {msg.caption}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="whitespace-pre-wrap leading-relaxed pr-14 min-h-[1.25rem]">
                                                            {msg.content}
                                                        </div>
                                                    )}

                                                    {/* Meta info (Time + Ticks) inside bubble */}
                                                    <div className="absolute bottom-1 right-2 flex items-center gap-1 pl-4 py-0.5 bg-transparent">
                                                        <span className={`text-[10px] ${isMe(msg) ? 'text-primary-foreground/70' : 'text-white/40'}`}>
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
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {isOtherTyping && (
                        <div className="flex items-center gap-2 mt-4 px-2">
                            <div className="flex gap-1 items-center">
                                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"></span>
                            </div>
                            <span className="text-[10px] text-white/40 italic">
                                Escribiendo...
                            </span>
                        </div>
                    )}
                </div>

                {/* Image Preview Overlay */}
                {previewUrl && (
                    <div className="bg-black/60 backdrop-blur-md border-t border-white/10 p-4 transition-all duration-300">
                        <div className="flex items-center gap-4 max-w-2xl mx-auto">
                            <div className="relative group shrink-0">
                                <img
                                    src={previewUrl}
                                    alt="Vista previa"
                                    className="h-20 w-20 object-cover rounded-lg border border-white/20 shadow-lg"
                                />
                                <button
                                    onClick={cancelImageSelection}
                                    className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow-lg hover:bg-red-600 transition-colors"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </div>
                            <div className="flex-1 text-sm text-white/60">
                                <p className="font-medium text-white mb-1 uppercase tracking-tighter text-xs">Imagen seleccionada</p>
                                <p className="text-[11px]">Escribí una leyenda opcional abajo antes de enviar.</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Input Area */}
                <div className="p-4 bg-white/[0.03] border-t border-white/5">
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
                            className={`text-white/40 hover:text-white shrink-0 ${previewUrl ? 'text-primary' : ''}`}
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
                            className="bg-black/40 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-primary/50"
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

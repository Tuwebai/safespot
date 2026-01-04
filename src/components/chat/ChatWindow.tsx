import React, { useState, useEffect, useRef } from 'react';
import { useChatMessages, useSendMessageMutation, useMarkAsReadMutation } from '../../hooks/queries/useChatsQuery';
import { ChatRoom, ChatMessage, chatsApi } from '../../lib/api';
import { getAvatarUrl } from '../../lib/avatar';
import { Send, ArrowLeft, Image as ImageIcon, MapPin } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

import { useNavigate } from 'react-router-dom';

interface ChatWindowProps {
    room: ChatRoom;
    onBack?: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ room, onBack }) => {
    const navigate = useNavigate();
    const [message, setMessage] = useState('');
    const { data: messages, isLoading, isOtherTyping } = useChatMessages(room.id);
    const sendMessageMutation = useSendMessageMutation();
    const markAsReadMutation = useMarkAsReadMutation();
    const scrollRef = useRef<HTMLDivElement>(null);
    const anonymousId = localStorage.getItem('safespot_anonymous_id');

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

    // Marcar como leído al abrir el chat
    useEffect(() => {
        if (room.id) {
            markAsReadMutation.mutate(room.id);
        }
    }, [room.id]);

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
            // Asegurar que si desmontamos el componente dejamos de estar "escribiendo"
            chatsApi.notifyTyping(room.id, false);
        };
    }, [message, room.id]);

    const handleSend = () => {
        if (!message.trim() || sendMessageMutation.isPending) return;

        sendMessageMutation.mutate({
            roomId: room.id,
            content: message.trim(),
        });
        setMessage('');
    };

    const isMe = (msg: ChatMessage) => msg.sender_id === anonymousId;

    return (
        <Card className="flex flex-col h-full bg-black/40 backdrop-blur-xl border-white/10 overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex items-center gap-3 bg-white/5">
                {onBack && (
                    <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden text-white/70">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                )}
                <div className="flex-1">
                    <h3 className="text-white font-semibold text-sm line-clamp-1">{room.report_title}</h3>
                    <p
                        className="text-white/50 text-xs flex items-center gap-1 cursor-pointer hover:text-primary transition-colors w-fit"
                        onClick={() => {
                            const otherAlias = isMe({ sender_id: room.participant_a } as any) ? room.participant_b_alias : room.participant_a_alias;
                            navigate(`/usuario/${otherAlias}`);
                        }}
                    >
                        Chateando con {isMe({ sender_id: room.participant_a } as any) ? room.participant_b_alias : room.participant_a_alias}
                    </p>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 p-4 overflow-y-auto custom-scrollbar" ref={scrollRef}>
                <div className="space-y-4">
                    {isLoading ? (
                        <div className="text-center text-white/30 py-10 uppercase tracking-widest text-xs">Cargando mensajes...</div>
                    ) : messages?.length === 0 ? (
                        <div className="text-center py-10">
                            <p className="text-white/30 text-xs italic">No hay mensajes aún. ¡Iniciá la conversación!</p>
                        </div>
                    ) : (
                        messages?.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex ${isMe(msg) ? 'justify-end' : 'justify-start'}`}
                            >
                                <div className={`flex gap-2 max-w-[80%] ${isMe(msg) ? 'flex-row-reverse' : 'flex-row'}`}>
                                    {!isMe(msg) && (
                                        <div
                                            className="relative group cursor-pointer"
                                            onClick={() => navigate(`/usuario/${msg.sender_alias}`)}
                                        >
                                            <img
                                                src={getAvatarUrl(msg.sender_alias || 'Anon')}
                                                alt="Avatar"
                                                className="w-8 h-8 rounded-full border border-white/10 mt-1 transition-transform group-hover:scale-110 group-hover:border-primary/50"
                                            />
                                        </div>
                                    )}
                                    <div className="flex flex-col">
                                        <div
                                            className={`px-4 py-2 rounded-2xl text-sm ${isMe(msg)
                                                ? 'bg-primary text-primary-foreground rounded-tr-none shadow-lg shadow-primary/20'
                                                : 'bg-white/10 text-white border border-white/10 rounded-tl-none backdrop-blur-md'
                                                }`}
                                        >
                                            {msg.content}
                                        </div>
                                        <span className="text-[10px] text-white/30 mt-1 px-1">
                                            {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: es })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {isOtherTyping && (
                    <div className="flex items-center gap-2 mt-4 px-2 animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex gap-1 items-center">
                            <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                            <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                            <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"></span>
                        </div>
                        <span className="text-[10px] text-white/40 italic">
                            {isMe({ sender_id: room.participant_a } as any) ? room.participant_b_alias : room.participant_a_alias} está escribiendo...
                        </span>
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white/5 border-t border-white/10">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="text-white/40 hover:text-white shrink-0">
                        <ImageIcon className="h-5 w-5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-white/40 hover:text-white shrink-0">
                        <MapPin className="h-5 w-5" />
                    </Button>
                    <Input
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Escribí un mensaje..."
                        className="bg-black/40 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-primary/50"
                    />
                    <Button
                        onClick={handleSend}
                        disabled={!message.trim() || sendMessageMutation.isPending}
                        className="shrink-0 rounded-xl shadow-lg shadow-primary/20"
                    >
                        <Send className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </Card>
    );
};

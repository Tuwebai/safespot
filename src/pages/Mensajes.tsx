import React, { useState } from 'react';
import { useChatRooms } from '../hooks/queries/useChatsQuery';
import { ChatRoom } from '../lib/api';
import { ChatWindow } from '../components/chat/ChatWindow';
import { getAvatarUrl } from '../lib/avatar';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { MessageSquare, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { SEO } from '../components/SEO';

const Mensajes: React.FC = () => {
    const { data: rooms, isLoading } = useChatRooms();
    const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
    const anonymousId = localStorage.getItem('safespot_anonymous_id');

    const getOtherParticipant = (room: ChatRoom) => {
        return room.participant_a === anonymousId
            ? { alias: room.participant_b_alias, avatar: room.participant_b_avatar }
            : { alias: room.participant_a_alias, avatar: room.participant_a_avatar };
    };

    return (
        <div className="container mx-auto px-4 py-6 h-[calc(100vh-120px)] flex flex-col">
            <SEO
                title="Mensajes | SafeSpot"
                description="Centro de mensajes contextuales vinculados a tus reportes y colaboraciones."
            />

            <header className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-2">
                        Mensajes
                        <Badge variant="outline" className="text-primary border-primary/30">Privado</Badge>
                    </h1>
                    <p className="text-white/50 text-sm mt-1">Colaboración directa sobre reportes e incidentes.</p>
                </div>
            </header>

            <div className="flex-1 flex gap-6 overflow-hidden">
                {/* Inbox Sidebar */}
                <div className={`flex-1 md:flex-[0.4] flex flex-col gap-3 overflow-y-auto pr-2 custom-scrollbar ${selectedRoom ? 'hidden md:flex' : 'flex'}`}>
                    {isLoading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <Card key={i} className="p-4 bg-white/5 border-white/5 animate-pulse h-24" />
                        ))
                    ) : rooms?.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-12 text-center bg-white/5 rounded-3xl border border-dashed border-white/10">
                            <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-4">
                                <MessageSquare className="text-white/20 w-8 h-8" />
                            </div>
                            <h3 className="text-white font-medium">Bandeja Vacía</h3>
                            <p className="text-white/40 text-xs mt-2 max-w-xs">
                                Iniciá un chat desde el detalle de un reporte para colaborar con otros usuarios.
                            </p>
                        </div>
                    ) : (
                        rooms?.map((room) => {
                            const other = getOtherParticipant(room);
                            const isActive = selectedRoom?.id === room.id;

                            return (
                                <Card
                                    key={room.id}
                                    onClick={() => setSelectedRoom(room)}
                                    className={`p-4 cursor-pointer transition-all duration-300 border-l-4 ${isActive
                                        ? 'bg-primary/20 border-primary shadow-lg shadow-primary/10'
                                        : 'bg-white/5 border-transparent hover:bg-white/10 hover:border-white/20'
                                        }`}
                                >
                                    <div className="flex gap-4">
                                        <div className="relative">
                                            <img
                                                src={getAvatarUrl(other.alias)}
                                                alt="Avatar"
                                                className="w-12 h-12 rounded-full border border-white/20"
                                            />
                                            {room.unread_count > 0 && (
                                                <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center shadow-lg ring-2 ring-black">
                                                    {room.unread_count}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start mb-1">
                                                <h4 className="text-white/90 font-semibold text-sm truncate">@{other.alias}</h4>
                                                <span className="text-[10px] text-white/30 whitespace-nowrap">
                                                    {formatDistanceToNow(new Date(room.last_message_at), { addSuffix: true, locale: es })}
                                                </span>
                                            </div>
                                            <p className="text-primary/70 text-[11px] font-medium uppercase tracking-wider line-clamp-1 mb-1">
                                                {room.report_title}
                                            </p>
                                            <p className={`text-xs truncate ${room.unread_count > 0 ? 'text-white font-medium' : 'text-white/50'}`}>
                                                {room.last_message_content || 'Iniciá la conversación...'}
                                            </p>
                                        </div>
                                        <ChevronRight className={`h-5 w-5 self-center transition-opacity ${isActive ? 'opacity-100 text-primary' : 'opacity-20'}`} />
                                    </div>
                                </Card>
                            );
                        })
                    )}
                </div>

                {/* Chat Content Pane */}
                <div className={`flex-1 md:flex-[0.6] flex flex-col ${selectedRoom ? 'flex' : 'hidden md:flex'}`}>
                    {selectedRoom ? (
                        <ChatWindow
                            room={selectedRoom}
                            onBack={() => setSelectedRoom(null)}
                        />
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center bg-black/20 rounded-3xl border border-white/5 backdrop-blur-sm">
                            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6 animate-pulse">
                                <MessageSquare className="text-primary w-10 h-10" />
                            </div>
                            <h2 className="text-xl font-bold text-white mb-2">Seleccioná una conversación</h2>
                            <p className="text-white/40 text-sm max-w-xs text-center">
                                Elige un chat de la lista para ver los mensajes. Recordá que todos los chats están vinculados a reportes específicos.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Mensajes;

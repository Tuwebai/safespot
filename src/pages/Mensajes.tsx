import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatRooms } from '../hooks/queries/useChatsQuery';
import { ChatRoom } from '../lib/api';
import { ChatWindow } from '../components/chat/ChatWindow';
import { getAvatarUrl } from '../lib/avatar';
import { Search, MessageSquare, ArrowLeft, Camera } from 'lucide-react';
import { Input } from '../components/ui/input';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { SEO } from '../components/SEO';
import { useNavigate, useSearchParams } from 'react-router-dom';

const Mensajes: React.FC = () => {
    const navigate = useNavigate();
    const { data: rooms, isLoading } = useChatRooms();
    const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const anonymousId = localStorage.getItem('safespot_anonymous_id');

    const getOtherParticipant = (room: ChatRoom) => {
        return room.participant_a === anonymousId
            ? { alias: room.participant_b_alias, avatar: room.participant_b_avatar }
            : { alias: room.participant_a_alias, avatar: room.participant_a_avatar };
    };

    // Modificar filtro para incluir búsqueda por ID también (para deep linking)
    const filteredRooms = useMemo(() => {
        if (!rooms) return [];
        if (!searchTerm.trim()) return rooms;

        const term = searchTerm.toLowerCase();
        return rooms.filter(room => {
            const other = getOtherParticipant(room);
            return (
                other.alias.toLowerCase().includes(term) ||
                room.report_title?.toLowerCase().includes(term) ||
                room.id === searchTerm // Allow searching/filtering by exact ID
            );
        });
    }, [rooms, searchTerm, anonymousId]);

    // Deep linking support
    const [searchParams] = useSearchParams();
    const deepLinkRoomId = searchParams.get('roomId');

    React.useEffect(() => {
        if (deepLinkRoomId && rooms) {
            const targetRoom = rooms.find(r => r.id === deepLinkRoomId);
            if (targetRoom) {
                setSelectedRoom(targetRoom);
            }
        }
    }, [deepLinkRoomId, rooms]);

    // Variantes para las animaciones
    const sidebarVariants = {
        initial: { x: 0, opacity: 1 },
        animate: { x: 0, opacity: 1 },
        exit: { x: -20, opacity: 0.5, transition: { duration: 0.3 } }
    } as const;

    const chatVariants = {
        initial: { x: '100%' },
        animate: { x: 0, transition: { type: 'spring', damping: 25, stiffness: 200 } },
        exit: { x: '100%', transition: { duration: 0.2, ease: 'easeOut' } }
    } as const;

    return (
        <div className="flex-1 flex overflow-hidden h-full w-full bg-background relative transition-colors duration-300">
            <SEO
                title="Mensajes | SafeSpot"
                description="Centro de mensajes contextuales vinculados a tus reportes y colaboraciones."
            />

            {/* Inbox Sidebar */}
            <AnimatePresence mode="wait">
                {(!selectedRoom || window.innerWidth >= 768) && (
                    <motion.div
                        key="sidebar"
                        variants={sidebarVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        className={`flex-1 md:flex-[0.3] flex flex-col border-r border-border bg-card/30 overflow-hidden`}
                    >
                        <div className="p-4 border-b border-border space-y-4 bg-card/50">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => navigate('/')}
                                    className="p-2 -ml-2 hover:bg-muted rounded-full text-muted-foreground hover:text-foreground transition-colors"
                                    title="Volver al inicio"
                                >
                                    <ArrowLeft className="w-5 h-5" />
                                </button>
                                <h1 className="text-xl font-bold text-foreground tracking-tight">Mensajes</h1>
                            </div>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar chats..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 bg-muted/50 border-input text-foreground placeholder:text-muted-foreground text-xs h-9 focus-visible:ring-primary"
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {isLoading ? (
                                <div className="p-4 space-y-3">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                        <div key={i} className="h-20 bg-muted/50 animate-pulse rounded-lg" />
                                    ))}
                                </div>
                            ) : filteredRooms.length === 0 ? (
                                <div className="flex flex-col items-center justify-center p-8 text-center h-full">
                                    <MessageSquare className="text-muted-foreground/50 w-12 h-12 mb-4" />
                                    <h3 className="text-muted-foreground font-medium text-sm">
                                        {searchTerm ? 'Sin resultados' : 'Bandeja Vacía'}
                                    </h3>
                                    <p className="text-muted-foreground/70 text-[11px] mt-2">
                                        {searchTerm ? `No encontramos chats para "${searchTerm}"` : 'Inicia un chat desde un reporte para colaborar.'}
                                    </p>
                                </div>
                            ) : (
                                <div className="divide-y divide-border/50">
                                    {filteredRooms.map((room) => {
                                        const other = getOtherParticipant(room);
                                        const isActive = selectedRoom?.id === room.id;

                                        return (
                                            <div
                                                key={room.id}
                                                onClick={() => setSelectedRoom(room)}
                                                className={`p-4 cursor-pointer transition-colors border-l-4 ${isActive
                                                    ? 'bg-primary/10 border-primary'
                                                    : 'border-transparent hover:bg-muted/50'
                                                    }`}
                                            >
                                                <div className="flex gap-3">
                                                    <div className="relative shrink-0">
                                                        <img
                                                            src={getAvatarUrl(other.alias)}
                                                            alt="Avatar"
                                                            className="w-12 h-12 rounded-full border border-border"
                                                        />
                                                        {room.unread_count > 0 && (
                                                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-background">
                                                                {room.unread_count}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex justify-between items-start">
                                                            <h4 className="text-foreground font-semibold text-xs truncate">@{other.alias}</h4>
                                                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                                                {formatDistanceToNow(new Date(room.last_message_at), { addSuffix: true, locale: es })}
                                                            </span>
                                                        </div>
                                                        <p className="text-primary/90 text-[10px] uppercase font-bold tracking-wider truncate mt-0.5 flex items-center gap-1">
                                                            {room.report_category ? (
                                                                <>
                                                                    <span>{room.report_title}</span>
                                                                    <span className="opacity-50 text-muted-foreground">• {room.report_category}</span>
                                                                </>
                                                            ) : (
                                                                'Mensaje Directo'
                                                            )}
                                                        </p>
                                                        <p className={`text-[12px] truncate mt-1 flex items-center gap-1 ${room.unread_count > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                                                            {room.last_message_type === 'image' ? (
                                                                <>
                                                                    <Camera className="w-3.5 h-3.5 shrink-0" />
                                                                    <span>{room.last_message_caption || 'Imagen'}</span>
                                                                </>
                                                            ) : (
                                                                room.last_message_content || 'Iniciá la conversación...'
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Chat Content Pane */}
            <div className={`flex-1 flex flex-col bg-background/50 ${selectedRoom ? 'fixed inset-0 z-50 md:relative md:inset-auto md:z-0' : 'hidden md:flex'}`}>
                <AnimatePresence>
                    {selectedRoom ? (
                        <motion.div
                            key={`chat-${selectedRoom.id}`}
                            variants={chatVariants}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                            className="flex-1 overflow-hidden h-full bg-background"
                        >
                            <ChatWindow
                                room={selectedRoom}
                                onBack={() => setSelectedRoom(null)}
                            />
                        </motion.div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center hidden md:flex text-center p-8">
                            <div className="w-16 h-16 bg-muted/30 rounded-full flex items-center justify-center mb-4">
                                <MessageSquare className="text-muted-foreground/30 w-8 h-8" />
                            </div>
                            <h2 className="text-lg font-bold text-foreground">SafeSpot Chat</h2>
                            <p className="text-muted-foreground text-xs mt-2 max-w-xs">
                                Seleccioná una conversación del panel izquierdo para comenzar a chatear.
                            </p>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default Mensajes;

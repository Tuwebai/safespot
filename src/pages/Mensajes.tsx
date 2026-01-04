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
import { useNavigate } from 'react-router-dom';

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

    const filteredRooms = useMemo(() => {
        if (!rooms) return [];
        if (!searchTerm.trim()) return rooms;

        const term = searchTerm.toLowerCase();
        return rooms.filter(room => {
            const other = getOtherParticipant(room);
            return (
                other.alias.toLowerCase().includes(term) ||
                room.report_title.toLowerCase().includes(term)
            );
        });
    }, [rooms, searchTerm, anonymousId]);

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
        <div className="flex-1 flex overflow-hidden h-full w-full bg-black/20 relative">
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
                        className={`flex-1 md:flex-[0.3] flex flex-col border-r border-white/10 bg-white/[0.02] overflow-hidden`}
                    >
                        <div className="p-4 border-b border-white/10 space-y-4 bg-white/[0.02]">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => navigate('/')}
                                    className="p-2 -ml-2 hover:bg-white/5 rounded-full text-white/50 hover:text-white transition-colors"
                                    title="Volver al inicio"
                                >
                                    <ArrowLeft className="w-5 h-5" />
                                </button>
                                <h1 className="text-xl font-bold text-white tracking-tight">Mensajes</h1>
                            </div>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                                <Input
                                    placeholder="Buscar chats..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 bg-black/40 border-white/10 text-xs h-9"
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {isLoading ? (
                                <div className="p-4 space-y-3">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                        <div key={i} className="h-20 bg-white/5 animate-pulse rounded-lg" />
                                    ))}
                                </div>
                            ) : filteredRooms.length === 0 ? (
                                <div className="flex flex-col items-center justify-center p-8 text-center h-full">
                                    <MessageSquare className="text-white/10 w-12 h-12 mb-4" />
                                    <h3 className="text-white/60 font-medium text-sm">
                                        {searchTerm ? 'Sin resultados' : 'Bandeja Vacía'}
                                    </h3>
                                    <p className="text-white/30 text-[11px] mt-2">
                                        {searchTerm ? `No encontramos chats para "${searchTerm}"` : 'Inicia un chat desde un reporte para colaborar.'}
                                    </p>
                                </div>
                            ) : (
                                <div className="divide-y divide-white/5">
                                    {filteredRooms.map((room) => {
                                        const other = getOtherParticipant(room);
                                        const isActive = selectedRoom?.id === room.id;

                                        return (
                                            <div
                                                key={room.id}
                                                onClick={() => setSelectedRoom(room)}
                                                className={`p-4 cursor-pointer transition-colors border-l-4 ${isActive
                                                    ? 'bg-primary/10 border-primary'
                                                    : 'border-transparent hover:bg-white/5'
                                                    }`}
                                            >
                                                <div className="flex gap-3">
                                                    <div className="relative shrink-0">
                                                        <img
                                                            src={getAvatarUrl(other.alias)}
                                                            alt="Avatar"
                                                            className="w-12 h-12 rounded-full border border-white/10"
                                                        />
                                                        {room.unread_count > 0 && (
                                                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-black">
                                                                {room.unread_count}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex justify-between items-start">
                                                            <h4 className="text-white font-semibold text-xs truncate">@{other.alias}</h4>
                                                            <span className="text-[10px] text-white/30 whitespace-nowrap">
                                                                {formatDistanceToNow(new Date(room.last_message_at), { addSuffix: true, locale: es })}
                                                            </span>
                                                        </div>
                                                        <p className="text-primary/70 text-[10px] uppercase font-bold tracking-wider truncate mt-0.5">
                                                            {room.report_title}
                                                        </p>
                                                        <p className={`text-[12px] truncate mt-1 flex items-center gap-1 ${room.unread_count > 0 ? 'text-white font-medium' : 'text-white/50'}`}>
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
            <div className={`flex-1 flex flex-col bg-black/40 ${selectedRoom ? 'fixed inset-0 z-50 md:relative md:inset-auto md:z-0' : 'hidden md:flex'}`}>
                <AnimatePresence>
                    {selectedRoom ? (
                        <motion.div
                            key={`chat-${selectedRoom.id}`}
                            variants={chatVariants}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                            className="flex-1 overflow-hidden h-full bg-[#0a0a0a]"
                        >
                            <ChatWindow
                                room={selectedRoom}
                                onBack={() => setSelectedRoom(null)}
                            />
                        </motion.div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center hidden md:flex">
                            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
                                <MessageSquare className="text-white/10 w-8 h-8" />
                            </div>
                            <h2 className="text-lg font-bold text-white/80">SafeSpot Chat</h2>
                            <p className="text-white/30 text-xs mt-2">
                                Seleccioná una conversación para empezar
                            </p>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default Mensajes;

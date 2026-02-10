import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Search, MessageSquare, ArrowLeft, Camera, Plus, Archive } from 'lucide-react';

import { useChatRooms, useConversation, useUserPresence } from '../hooks/queries/useChatsQuery';
import { useAnonymousId } from '../hooks/useAnonymousId';
import { ChatRoom, chatsApi } from '../lib/api';
import { getAvatarUrl, getAvatarFallback } from '../lib/avatar';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/Avatar';
import { useToast } from '../components/ui/toast';

import { SEO } from '../components/SEO';
import { ChatWindow } from '../components/chat/ChatWindow';
import { ChatContextMenu } from '../components/chat/ChatContextMenu';
import { NewChatModal } from '../components/chat/NewChatModal';
import useLongPress from '../hooks/useLongPress';
import { ChevronDown, Pin } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
// 🔴 CRITICAL FIX: Auth guard for chat creation
import { useAuthGuard } from '@/hooks/useAuthGuard';

interface ChatRoomItemProps {
    room: ChatRoom;
    isActive: boolean;
    onClick: () => void;
}

const ChatRoomItem: React.FC<ChatRoomItemProps> = ({ room, isActive, onClick }) => {
    const { data: presence } = useUserPresence(room.other_participant_id);
    const isOnline = presence?.status === 'online';
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    // Long press for mobile context menu
    const longPressHandlers = useLongPress(
        () => setIsMenuOpen(true),
        onClick,
        { delay: 400, shouldPreventDefault: true }
    );

    return (
        <div
            {...longPressHandlers}
            onClick={onClick}
            className={`group relative p-4 cursor-pointer transition-colors border-l-4 ${isActive
                ? 'bg-primary/10 border-primary'
                : 'border-transparent hover:bg-muted/50'
                } ${room.is_pinned ? 'bg-muted/10' : ''}`}
        >
            <div className="flex gap-3">
                <div className="relative shrink-0">
                    <Avatar className="w-12 h-12 border border-border mt-1">
                        <AvatarImage src={room.other_participant_avatar || getAvatarUrl(room.other_participant_alias || 'Anon')} />
                        <AvatarFallback className="font-bold text-xs uppercase">
                            {getAvatarFallback(room.other_participant_alias)}
                        </AvatarFallback>
                    </Avatar>

                    {/* Online Indicator */}
                    {isOnline && (
                        <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-primary rounded-full border-2 border-card ring-1 ring-primary/20 animate-in fade-in zoom-in duration-300" />
                    )}

                    {room.unread_count > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-background animate-in zoom-in duration-300">
                            {room.unread_count}
                        </span>
                    )}
                    {/* Manual Unread Indicator (if no unread count but marked manually) */}
                    {!room.unread_count && room.is_manually_unread && (
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full ring-2 ring-background animate-in zoom-in duration-300" />
                    )}
                </div>
                <div className="flex-1 min-w-0 pr-6"> {/* Added padding right for chevron/pin */}
                    <div className="flex justify-between items-start">
                        <h4 className="text-foreground font-semibold text-xs truncate">@{room.other_participant_alias}</h4>
                        <div className="flex items-center gap-1">
                            {room.is_pinned && <Pin className="w-3 h-3 text-muted-foreground rotate-45" />}
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                {room.last_message_at ? formatDistanceToNow(new Date(room.last_message_at), { addSuffix: true, locale: es }) : ''}
                            </span>
                        </div>
                    </div>
                    {room.report_id && (
                        <p className="text-primary/90 text-[10px] uppercase font-bold tracking-wider truncate mt-0.5 flex items-center gap-1">
                            <span>{room.report_title || 'Reporte Contextual'}</span>
                            <span className="opacity-50 text-muted-foreground">• {room.report_category}</span>
                        </p>
                    )}

                    <p className={`text-[12px] truncate mt-1 flex items-center gap-1 ${room.is_typing ? 'text-primary font-bold animate-pulse' : (room.unread_count > 0 || room.is_manually_unread) ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                        {room.is_typing ? (
                            'Escribiendo...'
                        ) : room.last_message_type === 'image' ? (
                            <>
                                <Camera className="w-3.5 h-3.5 shrink-0" />
                                <span>Imagen</span>
                            </>
                        ) : (
                            room.last_message_content || 'Iniciá la conversación...'
                        )}
                    </p>
                </div>

                {/* Context Menu Trigger Area */}
                <div className="absolute right-2 top-8" onClick={(e) => e.stopPropagation()}>
                    <ChatContextMenu
                        chat={room}
                        isOpen={isMenuOpen}
                        onOpenChange={setIsMenuOpen}
                        trigger={
                            <button className="p-1.5 hover:bg-zinc-700/20 rounded-full text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100 pointer-events-none md:pointer-events-auto">
                                <ChevronDown className="w-4 h-4" />
                            </button>
                        }
                    />
                </div>
            </div>
        </div>
    );
};





const Mensajes: React.FC = () => {
    const { roomId: urlRoomId } = useParams<{ roomId?: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const toast = useToast();
    const { data: rooms, isLoading } = useChatRooms();
    const anonymousId = useAnonymousId();
    const [searchTerm, setSearchTerm] = useState('');
    const { checkAuth } = useAuthGuard(); // 🔴 CRITICAL FIX: Auth guard


    // New Chat State
    const [isNewChatOpen, setIsNewChatOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'inbox' | 'archived'>('inbox');


    // Modificar filtro para incluir búsqueda, archivados y ordenamiento
    const filteredRooms = useMemo(() => {
        // ✅ MEDIUM #10 FIX: Defensive array validation
        if (!rooms || !Array.isArray(rooms)) return [];
        let result = rooms;

        // 1. Filtrar por vista (Archivados vs Inbox)
        if (viewMode === 'archived') {
            result = result.filter(r => r.is_archived);
        } else {
            result = result.filter(r => !r.is_archived);
        }

        // 2. Filtro de búsqueda
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            result = result.filter(room => {
                return (
                    room.other_participant_alias?.toLowerCase().includes(term) ||
                    room.report_title?.toLowerCase().includes(term) ||
                    room.id === searchTerm
                );
            });
        }

        // 3. Ordenamiento (Pinned > Date)
        return result.sort((a, b) => {
            if (viewMode === 'inbox' && a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
            const dateA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
            const dateB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
            return dateB - dateA;
        });

    }, [rooms, searchTerm, viewMode]);

    const archivedCount = useMemo(() => {
        return rooms?.filter(r => r.is_archived).length || 0;
    }, [rooms]);

    const { data: selectedRoom } = useConversation(urlRoomId);



    // User Search logic moved to NewChatModal component

    // OPTIMISTIC CHAT CREATION / NAVIGATION
    const [searchParams] = useSearchParams();
    const startChatUserId = searchParams.get('userId');
    const isHandlingStartChat = React.useRef(false);

    React.useEffect(() => {
        if (!startChatUserId || isLoading || !rooms || isHandlingStartChat.current) return;

        const initChat = async () => {
            isHandlingStartChat.current = true;

            // 1. Check if we already have a DM with this user
            const existingRoom = rooms.find(r =>
                r.type === 'direct' &&
                r.other_participant_id === startChatUserId
            );

            if (existingRoom) {
                // Found! Open it.
                navigate(`/mensajes/${existingRoom.id}`, { replace: true });
            } else {
                // Not found. Create it.
                // 🔴 CRITICAL FIX: Block anonymous users
                if (!checkAuth()) {
                    navigate('/mensajes', { replace: true });
                    return;
                }

                try {
                    const newRoom = await chatsApi.createRoom({ recipientId: startChatUserId });
                    // Invalidate to refresh sidebar
                    queryClient.invalidateQueries({ queryKey: ['chats', 'rooms'] });
                    navigate(`/mensajes/${newRoom.id}`, { replace: true });
                } catch (e) {
                    toast.error('No se pudo iniciar el chat.');
                    console.error(e);
                    // Clear param to avoid loop
                    navigate('/mensajes', { replace: true });
                }
            }
        };

        initChat();
    }, [startChatUserId, rooms, isLoading, navigate, queryClient, toast]);


    const createChatMutation = useMutation({
        mutationFn: async (recipientId: string) => {
            // 🔴 CRITICAL FIX: Block anonymous users
            if (!checkAuth()) {
                throw new Error('AUTH_REQUIRED');
            }
            return chatsApi.createRoom({ recipientId });
        },
        onSuccess: (newRoom) => {
            if (anonymousId) {
                queryClient.invalidateQueries({ queryKey: ['chats', 'rooms', anonymousId] });
            }
            handleSelectRoom(newRoom.id);
            setIsNewChatOpen(false);
        },
        onError: () => {
            toast.error('Error al iniciar el chat');
        }
    });

    const handleCreateChat = (recipientId: string) => {
        createChatMutation.mutate(recipientId);
    };

    // Navigation helper
    const handleSelectRoom = (id: string | null) => {
        if (id) {
            navigate(`/mensajes/${id}`);
        } else {
            navigate('/mensajes');
        }
    };

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
            <AnimatePresence mode="wait" >
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
                                {viewMode === 'archived' ? (
                                    <button
                                        onClick={() => setViewMode('inbox')}
                                        className="p-2 -ml-2 hover:bg-muted rounded-full text-foreground transition-colors"
                                    >
                                        <ArrowLeft className="w-5 h-5" />
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => navigate('/')}
                                        className="p-2 -ml-2 hover:bg-muted rounded-full text-muted-foreground hover:text-foreground transition-colors"
                                        title="Volver al inicio"
                                    >
                                        <ArrowLeft className="w-5 h-5" />
                                    </button>
                                )}
                                <h1 className="text-xl font-bold text-foreground tracking-tight">
                                    {viewMode === 'archived' ? 'Archivados' : 'Mensajes'}
                                </h1>
                            </div>

                            <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Buscar chats..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-10 pr-4 bg-muted/50 border-input text-foreground placeholder:text-muted-foreground text-xs h-9 focus-visible:ring-primary rounded-xl w-full"
                                    />
                                </div>
                                {viewMode === 'inbox' && (
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => setIsNewChatOpen(true)}
                                        className="rounded-xl bg-primary/10 hover:bg-primary/20 text-primary w-9 h-9 shrink-0"
                                        title="Nuevo chat"
                                    >
                                        <Plus className="w-5 h-5" />
                                    </Button>
                                )}
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                            {/* New Chat Modal */}
                            <NewChatModal
                                isOpen={isNewChatOpen}
                                onClose={() => setIsNewChatOpen(false)}
                                onCreateChat={handleCreateChat}
                            />

                            {/* Archived Chats Access Row */}
                            {viewMode === 'inbox' && archivedCount > 0 && !searchTerm && (
                                <div
                                    onClick={() => setViewMode('archived')}
                                    className="px-4 py-3 flex items-center gap-4 cursor-pointer hover:bg-muted/50 border-b border-border/50 text-muted-foreground transition-colors group"
                                >
                                    <div className="w-10 h-10 flex items-center justify-center">
                                        <Archive className="w-5 h-5 group-hover:text-primary transition-colors" />
                                    </div>
                                    <div className="flex-1 font-medium text-sm">Archivados</div>
                                    <div className="text-xs font-bold text-primary">{archivedCount}</div>
                                </div>
                            )}

                            {isLoading ? (
                                <div className="p-4 space-y-3">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                        <div key={i} className="h-20 bg-muted/50 animate-pulse rounded-lg" />
                                    ))}
                                </div>
                            ) : filteredRooms.length === 0 ? (

                                <EmptyState
                                    variant={searchTerm ? "search" : "messages"}
                                    icon={viewMode === 'archived' ? Archive : MessageSquare}
                                    title={searchTerm ? 'Sin resultados' : viewMode === 'archived' ? 'No hay chats archivados' : 'Bandeja Vacía'}
                                    description={searchTerm
                                        ? `No encontramos conversaciones para "${searchTerm}"`
                                        : viewMode === 'archived'
                                            ? 'Tus conversaciones archivadas aparecerán aquí.'
                                            : 'Inicia una conversación con alguien o colabora en un reporte.'}
                                    action={(!searchTerm && viewMode === 'inbox') ? {
                                        label: "Iniciar Nuevo Chat",
                                        onClick: () => setIsNewChatOpen(true),
                                        variant: "neon"
                                    } : undefined}
                                    className="h-full justify-center"
                                />
                            ) : (
                                <div className="divide-y divide-border/50">
                                    {filteredRooms.map((room) => (
                                        <ChatRoomItem
                                            key={room.id}
                                            room={room}
                                            isActive={urlRoomId === room.id}
                                            onClick={() => handleSelectRoom(room.id)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence >

            {/* Chat Content Pane */}
            <div className={`flex-1 flex flex-col bg-background/50 ${urlRoomId ? 'fixed inset-0 z-50 md:relative md:inset-auto md:z-0' : 'hidden md:flex'}`}>
                <AnimatePresence mode="wait">
                    {urlRoomId ? (
                        <motion.div
                            key={`chat-${urlRoomId}`}
                            variants={chatVariants}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                            className="flex-1 overflow-hidden h-full bg-background"
                        >
                            {selectedRoom && (
                                <ChatWindow
                                    room={selectedRoom}
                                    onBack={() => handleSelectRoom(null)}
                                />
                            )}
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

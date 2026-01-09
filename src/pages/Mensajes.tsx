import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatRooms, useConversation } from '../hooks/queries/useChatsQuery';

import { ChatWindow } from '../components/chat/ChatWindow';
import { getAvatarUrl } from '../lib/avatar';
import { Search, MessageSquare, ArrowLeft, Camera } from 'lucide-react';
import { Input } from '../components/ui/input';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { SEO } from '../components/SEO';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { usersApi, UserProfile, chatsApi } from '../lib/api';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/Avatar';
import { Plus, X, User } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../components/ui/toast';
import { useDebounce } from '../hooks/useDebounce';



const Mensajes: React.FC = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const toast = useToast();
    const { data: rooms, isLoading } = useChatRooms();
    const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');


    // New Chat State
    const [isNewChatOpen, setIsNewChatOpen] = useState(false);
    const [userSearchTerm, setUserSearchTerm] = useState('');
    const debouncedUserSearch = useDebounce(userSearchTerm, 300);
    const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
    const [isSearchingUsers, setIsSearchingUsers] = useState(false);


    // Modificar filtro para incluir búsqueda por ID también (para deep linking)
    const filteredRooms = useMemo(() => {
        if (!rooms) return [];
        if (!searchTerm.trim()) return rooms;

        const term = searchTerm.toLowerCase();
        return rooms.filter(room => {
            return (
                room.other_participant_alias?.toLowerCase().includes(term) ||
                room.report_title?.toLowerCase().includes(term) ||
                room.id === searchTerm // Allow searching/filtering by exact ID
            );
        });
    }, [rooms, searchTerm]);

    const { data: selectedRoom } = useConversation(selectedRoomId || undefined);



    // User Search logic for new chat
    React.useEffect(() => {
        if (!debouncedUserSearch.trim() || debouncedUserSearch.length < 2) {
            setSearchResults([]);
            return;
        }

        const runSearch = async () => {
            setIsSearchingUsers(true);
            try {
                const results = await usersApi.search(debouncedUserSearch);
                setSearchResults(results);
            } catch (error) {
                console.error('Error searching users:', error);
            } finally {
                setIsSearchingUsers(false);
            }
        };

        runSearch();
    }, [debouncedUserSearch]);


    const createChatMutation = useMutation({
        mutationFn: (recipientId: string) => chatsApi.createRoom({ recipientId }),
        onSuccess: (newRoom) => {
            queryClient.invalidateQueries({ queryKey: ['chats', 'rooms'] });
            setSelectedRoomId(newRoom.id);
            setIsNewChatOpen(false);
            setUserSearchTerm('');
        },
        onError: () => {
            toast.error('Error al iniciar el chat');
        }
    });

    const handleCreateChat = (recipientId: string) => {
        createChatMutation.mutate(recipientId);
    };


    // Deep linking support
    const [searchParams] = useSearchParams();
    const deepLinkRoomId = searchParams.get('roomId');

    React.useEffect(() => {
        if (deepLinkRoomId && rooms) {
            const exists = rooms.some(r => r.id === deepLinkRoomId);
            if (exists && selectedRoomId !== deepLinkRoomId) {
                setSelectedRoomId(deepLinkRoomId);
            }
        }
    }, [deepLinkRoomId, rooms, selectedRoomId]);



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
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => setIsNewChatOpen(true)}
                                    className="rounded-xl bg-primary/10 hover:bg-primary/20 text-primary w-9 h-9 shrink-0"
                                    title="Nuevo chat"
                                >
                                    <Plus className="w-5 h-5" />
                                </Button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                            {/* New Chat Overlay/Modal logic inside sidebar for mobile-friendly feels */}
                            <AnimatePresence>
                                {isNewChatOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 10 }}
                                        className="absolute inset-0 z-20 bg-background flex flex-col"
                                    >
                                        <div className="p-4 border-b border-border flex items-center justify-between bg-card/50">
                                            <h2 className="font-bold text-sm">Nuevo Mensaje</h2>
                                            <button
                                                onClick={() => setIsNewChatOpen(false)}
                                                className="p-1 hover:bg-muted rounded-full text-muted-foreground"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <div className="p-3 border-b border-border">
                                            <div className="text-[10px] text-muted-foreground uppercase font-bold mb-2 ml-1 tracking-wider">Para:</div>
                                            <Input
                                                placeholder="Alias del usuario..."
                                                value={userSearchTerm}
                                                onChange={(e) => setUserSearchTerm(e.target.value)}
                                                className="bg-muted px-4 rounded-xl text-xs h-9 border-none focus-visible:ring-primary"
                                                autoFocus
                                            />
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                            {isSearchingUsers ? (
                                                <div className="p-4 text-center">
                                                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                                                    <span className="text-[10px] text-muted-foreground">Buscando...</span>
                                                </div>
                                            ) : searchResults.length > 0 ? (
                                                searchResults.map((user) => (
                                                    <div
                                                        key={user.anonymous_id}
                                                        onClick={() => handleCreateChat(user.anonymous_id)}
                                                        className="flex items-center gap-3 p-3 hover:bg-muted/50 rounded-xl cursor-pointer transition-colors"
                                                    >
                                                        <Avatar className="w-10 h-10 ring-1 ring-border">
                                                            <AvatarImage src={user.avatar_url || getAvatarUrl(user.anonymous_id)} />
                                                            <AvatarFallback className="text-[10px] font-bold">
                                                                {user.alias?.substring(0, 2).toUpperCase()}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-bold text-foreground truncate">@{user.alias}</p>
                                                            <p className="text-[10px] text-muted-foreground">Usuario verificado</p>
                                                        </div>
                                                        <Plus className="w-4 h-4 text-primary" />
                                                    </div>
                                                ))
                                            ) : userSearchTerm.length >= 2 ? (
                                                <div className="p-8 text-center text-muted-foreground">
                                                    <User className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                                    <p className="text-xs">No encontramos usuarios con ese alias</p>
                                                </div>
                                            ) : (
                                                <div className="p-8 text-center text-muted-foreground">
                                                    <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                                    <p className="text-xs">Escribe el alias de alguien para iniciar un chat</p>
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {isLoading ? (
                                <div className="p-4 space-y-3">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                        <div key={i} className="h-20 bg-muted/50 animate-pulse rounded-lg" />
                                    ))}
                                </div>
                            ) : filteredRooms.length === 0 ? (
                                <div className="flex flex-col items-center justify-center p-8 text-center h-full">
                                    <div className="w-16 h-16 bg-muted/30 rounded-full flex items-center justify-center mb-4">
                                        <MessageSquare className="text-muted-foreground/30 w-8 h-8" />
                                    </div>
                                    <h3 className="text-foreground font-bold text-base">
                                        {searchTerm ? 'Sin resultados' : 'Bandeja Vacía'}
                                    </h3>
                                    <p className="text-muted-foreground text-[12px] mt-2 max-w-[200px] leading-relaxed">
                                        {searchTerm
                                            ? `No encontramos conversaciones para "${searchTerm}"`
                                            : 'Inicia una conversación con alguien o colabora en un reporte.'}
                                    </p>
                                    {!searchTerm && (
                                        <Button
                                            variant="neon"
                                            size="sm"
                                            onClick={() => setIsNewChatOpen(true)}
                                            className="mt-6 rounded-full px-6 text-[11px]"
                                        >
                                            Iniciar Nuevo Chat
                                        </Button>
                                    )}
                                </div>
                            ) : (
                                <div className="divide-y divide-border/50">
                                    {filteredRooms.map((room) => {
                                        const isActive = selectedRoomId === room.id;

                                        return (
                                            <div
                                                key={room.id}
                                                onClick={() => setSelectedRoomId(room.id)}
                                                className={`p-4 cursor-pointer transition-colors border-l-4 ${isActive
                                                    ? 'bg-primary/10 border-primary'
                                                    : 'border-transparent hover:bg-muted/50'
                                                    }`}
                                            >
                                                <div className="flex gap-3">
                                                    <div className="relative shrink-0">
                                                        <Avatar className="w-12 h-12 border border-border mt-1">
                                                            <AvatarImage src={room.other_participant_avatar || getAvatarUrl(room.other_participant_alias || 'Anon')} />
                                                            <AvatarFallback className="font-bold text-xs uppercase">
                                                                {room.other_participant_alias?.substring(0, 2) || '??'}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        {room.unread_count > 0 && (
                                                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-background">
                                                                {room.unread_count}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex justify-between items-start">
                                                            <h4 className="text-foreground font-semibold text-xs truncate">@{room.other_participant_alias}</h4>
                                                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                                                {formatDistanceToNow(new Date(room.last_message_at), { addSuffix: true, locale: es })}
                                                            </span>
                                                        </div>
                                                        {room.report_id && (
                                                            <p className="text-primary/90 text-[10px] uppercase font-bold tracking-wider truncate mt-0.5 flex items-center gap-1">
                                                                <span>{room.report_title || 'Reporte Contextual'}</span>
                                                                <span className="opacity-50 text-muted-foreground">• {room.report_category}</span>
                                                            </p>
                                                        )}

                                                        <p className={`text-[12px] truncate mt-1 flex items-center gap-1 ${(room as any).is_typing ? 'text-primary font-bold animate-pulse' : room.unread_count > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                                                            {(room as any).is_typing ? (
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
            <div className={`flex-1 flex flex-col bg-background/50 ${selectedRoomId ? 'fixed inset-0 z-50 md:relative md:inset-auto md:z-0' : 'hidden md:flex'}`}>
                <AnimatePresence mode="wait">
                    {selectedRoomId ? (

                        <motion.div
                            key={`chat-${selectedRoomId}`}
                            variants={chatVariants}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                            className="flex-1 overflow-hidden h-full bg-background"
                        >
                            {selectedRoom && (
                                <ChatWindow
                                    room={selectedRoom}
                                    onBack={() => setSelectedRoomId(null)}
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

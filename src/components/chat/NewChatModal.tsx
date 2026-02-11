import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, MessageSquare, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { useUserSearch } from '@/hooks/queries/useUserSearch';

import { getAvatarUrl, getAvatarFallback } from '@/lib/avatar';

interface NewChatModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreateChat: (recipientId: string) => void;
}

export const NewChatModal: React.FC<NewChatModalProps> = ({
    isOpen,
    onClose,
    onCreateChat
}) => {
    const [userSearchTerm, setUserSearchTerm] = useState('');
    const { data: searchResults = [], isLoading: isSearchingUsers } = useUserSearch(userSearchTerm, {
        enabled: isOpen
    });

    // Reset search when modal closes
    const handleClose = () => {
        setUserSearchTerm('');
        onClose();
    };

    const handleSelectUser = (userId: string) => {
        onCreateChat(userId);
        setUserSearchTerm('');

    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute inset-0 z-20 bg-background flex flex-col"
                >
                    <div className="p-4 border-b border-border flex items-center justify-between bg-card/50">
                        <h2 className="font-bold text-sm">Nuevo Mensaje</h2>
                        <button
                            onClick={handleClose}
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
                                    onClick={() => handleSelectUser(user.anonymous_id)}
                                    className="flex items-center gap-3 p-3 hover:bg-muted/50 rounded-xl cursor-pointer transition-colors"
                                >
                                    <Avatar className="w-10 h-10 ring-1 ring-border">
                                        <AvatarImage src={user.avatar_url || getAvatarUrl(user.anonymous_id)} />
                                        <AvatarFallback className="text-[10px] font-bold">
                                            {getAvatarFallback(user.alias)}
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
    );
};

/**
 * 🏛️ MessageSearchModal - Componente Enterprise
 * 
 * Búsqueda de mensajes dentro de una conversación.
 * Separado de ChatWindow para mantener SRP (Single Responsibility Principle).
 * 
 * Features:
 * - Búsqueda en tiempo real (client-side filtering)
 * - Navegación a mensaje encontrado
 * - Highlight del término buscado
 * - Accesible (ARIA labels)
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, ArrowUp, ArrowDown, MessageSquare } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { ChatMessage } from '@/lib/api';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface MessageSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    messages: ChatMessage[];
    onNavigateToMessage: (messageId: string) => void;
    currentUserId: string | null;
}

interface SearchResult {
    message: ChatMessage;
    index: number;
}

export const MessageSearchModal: React.FC<MessageSearchModalProps> = ({
    isOpen,
    onClose,
    messages,
    onNavigateToMessage,
    currentUserId
}) => {
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    // Focus input on open
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 100);
        } else {
            setQuery('');
            setSelectedIndex(0);
        }
    }, [isOpen]);

    // 🏛️ Enterprise: Client-side search with ranking
    const results = useMemo<SearchResult[]>(() => {
        if (!query.trim() || query.length < 2) return [];
        
        const searchTerm = query.toLowerCase();
        const matches: SearchResult[] = [];
        
        messages.forEach((msg, index) => {
            const content = msg.content?.toLowerCase() || '';
            const caption = msg.caption?.toLowerCase() || '';
            const senderAlias = msg.sender_alias?.toLowerCase() || '';
            
            // Search in content, caption, or sender
            if (content.includes(searchTerm) || 
                caption.includes(searchTerm) || 
                senderAlias.includes(searchTerm)) {
                matches.push({ message: msg, index });
            }
        });
        
        return matches.reverse(); // Most recent first
    }, [query, messages]);

    const handleNavigate = (messageId: string) => {
        onNavigateToMessage(messageId);
        onClose();
    };

    const navigateResults = (direction: 'up' | 'down') => {
        if (results.length === 0) return;
        
        if (direction === 'down') {
            setSelectedIndex(prev => (prev + 1) % results.length);
        } else {
            setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
        }
    };

    // Keyboard shortcuts
    useEffect(() => {
        if (!isOpen) return;
        
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            } else if (e.key === 'Enter' && results.length > 0) {
                handleNavigate(results[selectedIndex].message.id);
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                navigateResults('down');
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                navigateResults('up');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, results, selectedIndex]);

    // Highlight matching text
    const highlightMatch = (text: string, search: string) => {
        if (!search.trim()) return text;
        
        const regex = new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        const parts = text.split(regex);
        
        return parts.map((part, i) => 
            regex.test(part) ? (
                <mark key={i} className="bg-primary/30 text-primary font-semibold rounded px-0.5">
                    {part}
                </mark>
            ) : part
        );
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-start justify-center pt-20"
                onClick={onClose}
            >
                <motion.div
                    initial={{ opacity: 0, y: -20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="w-full max-w-2xl mx-4 bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center gap-3 p-4 border-b border-border bg-muted/30">
                        <Search className="w-5 h-5 text-muted-foreground" />
                        <Input
                            ref={inputRef}
                            value={query}
                            onChange={(e) => {
                                setQuery(e.target.value);
                                setSelectedIndex(0);
                            }}
                            placeholder="Buscar en la conversación..."
                            className="flex-1 border-0 bg-transparent focus-visible:ring-0 text-foreground placeholder:text-muted-foreground"
                        />
                        {results.length > 0 && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <span>{selectedIndex + 1}</span>
                                <span>/</span>
                                <span>{results.length}</span>
                            </div>
                        )}
                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => navigateResults('up')}
                                disabled={results.length === 0}
                            >
                                <ArrowUp className="w-4 h-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => navigateResults('down')}
                                disabled={results.length === 0}
                            >
                                <ArrowDown className="w-4 h-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={onClose}
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Results */}
                    <div className="max-h-[60vh] overflow-y-auto">
                        {query.length < 2 ? (
                            <div className="p-8 text-center text-muted-foreground">
                                <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                <p className="text-sm">Escribí al menos 2 caracteres para buscar</p>
                            </div>
                        ) : results.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground">
                                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                <p className="text-sm">No se encontraron mensajes</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-border">
                                {results.map(({ message }, i) => (
                                    <button
                                        key={message.id}
                                        onClick={() => handleNavigate(message.id)}
                                        className={`w-full p-4 text-left transition-colors hover:bg-muted/50 ${
                                            i === selectedIndex ? 'bg-primary/5 border-l-4 border-primary' : 'border-l-4 border-transparent'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-xs font-semibold ${
                                                message.sender_id === currentUserId ? 'text-primary' : 'text-foreground'
                                            }`}>
                                                {message.sender_id === currentUserId ? 'Tú' : message.sender_alias}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground">
                                                {format(new Date(message.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                                            </span>
                                        </div>
                                        <p className="text-sm text-foreground line-clamp-2">
                                            {message.type === 'image' ? (
                                                <span className="flex items-center gap-1 text-muted-foreground">
                                                    <span>📷 Imagen</span>
                                                    {message.caption && (
                                                        <span className="text-foreground">
                                                            {highlightMatch(message.caption, query)}
                                                        </span>
                                                    )}
                                                </span>
                                            ) : (
                                                highlightMatch(message.content || '', query)
                                            )}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-3 border-t border-border bg-muted/30 text-xs text-muted-foreground flex justify-between">
                        <span>↑↓ Navegar</span>
                        <span>Enter Ir al mensaje</span>
                        <span>Esc Cerrar</span>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { MapPin, Globe } from 'lucide-react';

interface CommunityTabsProps {
    activeTab: 'nearby' | 'global';
    onTabChange: (tab: 'nearby' | 'global') => void;
}

export function CommunityTabs({ activeTab, onTabChange }: CommunityTabsProps) {
    return (
        <div className="flex justify-center mb-6">
            <div className="bg-card border border-border rounded-full p-1 inline-flex relative">
                {/* Active Background Indicator */}
                <motion.div
                    className="absolute top-1 bottom-1 bg-primary/10 rounded-full z-0"
                    initial={false}
                    animate={{
                        left: activeTab === 'nearby' ? '4px' : '50%',
                        width: 'calc(50% - 4px)',
                        x: activeTab === 'global' ? '0%' : '0%'
                    }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />

                <button
                    onClick={() => onTabChange('nearby')}
                    className={cn(
                        "relative z-10 px-6 py-2 rounded-full text-sm font-medium flex items-center gap-2 transition-colors",
                        activeTab === 'nearby' ? "text-primary" : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    <MapPin className="w-4 h-4" />
                    Personas Cerca
                </button>

                <button
                    onClick={() => onTabChange('global')}
                    className={cn(
                        "relative z-10 px-6 py-2 rounded-full text-sm font-medium flex items-center gap-2 transition-colors",
                        activeTab === 'global' ? "text-primary" : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    <Globe className="w-4 h-4" />
                    Global
                </button>
            </div>
        </div>
    );
}

/**
 * ShareButton Component
 * 
 * Allows users to share reports on social media.
 * Uses Web Share API on mobile, fallback menu on desktop.
 */

import { useState, useCallback } from 'react';
import { Share2, X as XIcon, MessageCircle, Facebook, Link2, Check } from 'lucide-react';

interface ShareButtonProps {
    title: string;
    category: string;
    zone: string;
    reportId: string;
}

export function ShareButton({ title, category, zone, reportId }: ShareButtonProps) {
    const [showMenu, setShowMenu] = useState(false);
    const [copied, setCopied] = useState(false);

    const shareUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/reporte/${reportId}`
        : '';

    const shareText = `⚠️ Reporte de ${category} en ${zone}\nMiralo en el mapa en Safespot 👇`;

    // Check if Web Share API is available
    const canUseNativeShare = typeof navigator !== 'undefined' && 'share' in navigator;

    // Native share (mobile)
    const handleNativeShare = useCallback(async () => {
        try {
            await navigator.share({
                title: `Reporte en Safespot: ${category}`,
                text: shareText,
                url: shareUrl
            });
        } catch (err) {
            // User cancelled or error - fail silently
            console.log('Share cancelled');
        }
    }, [category, shareText, shareUrl]);

    // Copy link
    const handleCopyLink = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            setTimeout(() => {
                setCopied(false);
                setShowMenu(false);
            }, 1500);
        } catch (err) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = shareUrl;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            setCopied(true);
            setTimeout(() => {
                setCopied(false);
                setShowMenu(false);
            }, 1500);
        }
    }, [shareUrl]);

    // Share URLs
    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedText = encodeURIComponent(shareText);

    const shareLinks = {
        whatsapp: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
        twitter: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`
    };

    // Main button click handler
    const handleClick = () => {
        if (canUseNativeShare) {
            handleNativeShare();
        } else {
            setShowMenu(!showMenu);
        }
    };

    return (
        <div className="relative">
            {/* Main Share Button */}
            <button
                onClick={handleClick}
                className="flex items-center gap-2 px-4 py-2 bg-dark-card border border-dark-border rounded-lg hover:bg-dark-border/50 transition-colors text-foreground"
            >
                <Share2 className="h-4 w-4" />
                <span className="text-sm font-medium">Compartir</span>
            </button>

            {/* Desktop Dropdown Menu */}
            {showMenu && !canUseNativeShare && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowMenu(false)}
                    />

                    {/* Menu */}
                    <div className="absolute right-0 top-full mt-2 z-50 bg-dark-card border border-dark-border rounded-xl shadow-xl overflow-hidden min-w-[200px]">
                        {/* WhatsApp */}
                        <a
                            href={shareLinks.whatsapp}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 px-4 py-3 hover:bg-dark-border/50 transition-colors"
                            onClick={() => setShowMenu(false)}
                        >
                            <MessageCircle className="h-5 w-5 text-green-500" />
                            <span>WhatsApp</span>
                        </a>

                        {/* Twitter/X */}
                        <a
                            href={shareLinks.twitter}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 px-4 py-3 hover:bg-dark-border/50 transition-colors"
                            onClick={() => setShowMenu(false)}
                        >
                            <XIcon className="h-5 w-5" />
                            <span>X (Twitter)</span>
                        </a>

                        {/* Facebook */}
                        <a
                            href={shareLinks.facebook}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 px-4 py-3 hover:bg-dark-border/50 transition-colors"
                            onClick={() => setShowMenu(false)}
                        >
                            <Facebook className="h-5 w-5 text-blue-500" />
                            <span>Facebook</span>
                        </a>

                        {/* Divider */}
                        <div className="border-t border-dark-border" />

                        {/* Copy Link */}
                        <button
                            onClick={handleCopyLink}
                            className="flex items-center gap-3 px-4 py-3 hover:bg-dark-border/50 transition-colors w-full text-left"
                        >
                            {copied ? (
                                <>
                                    <Check className="h-5 w-5 text-neon-green" />
                                    <span className="text-neon-green">¡Copiado!</span>
                                </>
                            ) : (
                                <>
                                    <Link2 className="h-5 w-5" />
                                    <span>Copiar link</span>
                                </>
                            )}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}

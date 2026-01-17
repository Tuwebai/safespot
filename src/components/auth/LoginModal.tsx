import { X } from 'lucide-react';
import { AuthForm, AuthMode } from './AuthForm';

interface LoginModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialMode?: AuthMode;
}

export function LoginModal({ isOpen, onClose, initialMode = 'login' }: LoginModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-t-2xl rounded-b-none sm:rounded-2xl shadow-2xl border-t border-x sm:border border-gray-200 dark:border-gray-800 overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 relative">

                {/* Close Button - Absolute over the form header */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-1 rounded-full hover:bg-white/20 text-white z-20 transition-colors"
                >
                    <X size={20} />
                </button>

                <AuthForm
                    initialMode={initialMode}
                    onSuccess={onClose}
                    showHeaderImage={true}
                />
            </div>
        </div>
    );
}

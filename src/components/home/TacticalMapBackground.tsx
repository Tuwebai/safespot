import React from 'react';

export const TacticalMapBackground: React.FC = () => {
    return (
        <div className="w-full h-full absolute inset-0 overflow-hidden bg-[#051014] perspective-[1000px]">
            <style>
                {`
                @keyframes pulse-target {
                    0% { transform: scale(0.95); opacity: 0.5; }
                    50% { transform: scale(1.05); opacity: 0.8; }
                    100% { transform: scale(0.95); opacity: 0.5; }
                }
                @keyframes scan-line {
                    0% { top: 0%; opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { top: 100%; opacity: 0; }
                }
                .animate-pulse-target {
                    animation: pulse-target 2s infinite ease-in-out;
                }
                .animate-scan-line {
                    animation: scan-line 4s linear infinite;
                }
                `}
            </style>

            {/* Tilted Container for Perspective */}
            <div
                className="w-[150%] h-[150%] absolute -top-[25%] -left-[25%]"
                style={{ transform: 'rotateX(20deg) scale(1.1)' }}
            >
                <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" preserveAspectRatio="none">
                    <defs>
                        {/* Grid Pattern */}
                        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(0, 255, 157, 0.15)" strokeWidth="0.5" />
                        </pattern>
                        {/* Glow Filters */}
                        <filter id="glow-green" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                            <feMerge>
                                <feMergeNode in="coloredBlur" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                        <filter id="glow-red" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                            <feMerge>
                                <feMergeNode in="coloredBlur" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                    </defs>

                    {/* Dark Background Base */}
                    <rect width="100%" height="100%" fill="#02080a" />

                    {/* The Grid */}
                    <rect width="100%" height="100%" fill="url(#grid)" />

                    {/* Irregular Street Geometry (Green Lines) */}
                    <g stroke="#00ff9d" strokeWidth="1" fill="none" opacity="0.4" filter="url(#glow-green)">
                        {/* Diagonals */}
                        <path d="M0 0 L400 300" />
                        <path d="M400 0 L0 300" />

                        {/* Random City Blocks */}
                        <path d="M100 50 L150 50 L150 100 L100 100 Z" strokeWidth="0.5" />
                        <path d="M250 200 L300 200 L300 250 L250 250 Z" strokeWidth="0.5" />
                        <path d="M50 200 L120 180 L140 250" strokeWidth="0.5" />
                        <path d="M300 50 L250 80 L280 140" strokeWidth="0.5" />
                    </g>

                    {/* Central Crosshairs (Thicker Green Lines) */}
                    <g stroke="#00ff9d" strokeWidth="2" fill="none" filter="url(#glow-green)">
                        <line x1="0" y1="150" x2="400" y2="150" opacity="0.6" />
                        <line x1="200" y1="0" x2="200" y2="300" opacity="0.6" />
                    </g>
                </svg>
            </div>

            {/* Vignette & Scanline Overlay */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.8)_90%)] pointer-events-none" />
            <div className="absolute inset-x-0 h-[2px] bg-neon-green/20 blur-sm pointer-events-none w-full animate-scan-line" />
        </div>
    );
};

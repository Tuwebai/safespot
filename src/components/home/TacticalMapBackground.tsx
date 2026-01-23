import React from 'react';

export const TacticalMapBackground: React.FC = () => {
    return (
        <div className="w-full h-full absolute inset-0 overflow-hidden perspective-[1000px]">
            <style>
                {`
                @keyframes patrol {
                    0% { stroke-dashoffset: 1000; }
                    100% { stroke-dashoffset: 0; }
                }
                .animate-patrol {
                    animation: patrol 15s linear infinite;
                }
                `}
            </style>

            <div
                className="w-[200%] h-[200%] absolute -top-[50%] -left-[50%] origin-center"
                style={{ transform: 'rotateX(60deg) rotateZ(15deg) scale(1.2)' }}
            >
                <svg className="w-full h-full opacity-30" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" preserveAspectRatio="none">
                    <defs>
                        <filter id="neon-strong" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="1" result="coloredBlur" />
                            <feMerge>
                                <feMergeNode in="coloredBlur" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                    </defs>

                    {/* COMPLEX CITY LAYOUT (Static) */}
                    <g stroke="currentColor" strokeWidth="0.8" fill="none" className="text-neon-green/80" filter="url(#neon-strong)">
                        {/* Sector A - Dense Grid (Top Left) */}
                        <path d="M0 20 H60 M0 40 H80 M0 60 H70" opacity="0.9" />
                        <path d="M20 0 V70 M40 0 V60" opacity="0.9" />

                        {/* Sector B - Main Diagonals (Center) */}
                        <path d="M60 20 L120 80 L180 20" strokeWidth="1" />
                        <path d="M40 80 L100 140 L160 80" strokeWidth="1" />

                        {/* Sector C - Curved Highways (Bottom Left) */}
                        <path d="M0 100 C 50 100, 50 150, 100 150 S 150 200, 200 200" strokeWidth="1.2" opacity="1" />
                        <path d="M0 120 C 60 120, 60 160, 120 160 S 180 200, 200 180" strokeWidth="1.2" opacity="1" />

                        {/* Sector D - The "Empty" Top Right (Now Dense) */}
                        <path d="M120 0 V60 M140 0 V40 M160 0 V60 M180 0 V40" opacity="0.8" />
                        <path d="M100 20 H200 M120 40 H200 M100 60 H180" opacity="0.8" />
                        <path d="M120 0 L200 80" strokeWidth="1" />
                        <path d="M160 0 L200 40" strokeWidth="0.8" />

                        {/* Sector E - Bottom Right Grid */}
                        <path d="M140 100 V180 M160 100 V200 M180 120 V200" opacity="0.7" />
                        <path d="M100 100 H200 M120 120 H200 M140 140 H200 M160 160 H200" opacity="0.7" />
                        <path d="M200 100 L100 200" strokeWidth="1" />

                        {/* Irregular Connectors */}
                        <path d="M80 40 L100 20 L140 20 L160 40 L160 80" strokeWidth="0.6" />
                        <path d="M120 80 V120 H160 V160" strokeWidth="0.6" />
                        <path d="M20 140 L60 140 L80 180" strokeWidth="0.6" />
                        <path d="M180 20 L200 40 L200 100 L150 150" strokeWidth="0.8" />
                    </g>

                    {/* SINGLE SLOW MOVING LIGHT (The Patrol) */}
                    <g filter="url(#neon-strong)">
                        {/* We use animateMotion to move the dot along a complex composite path covering multiple sectors */}
                        <circle r="2" fill="#fff" className="drop-shadow-[0_0_8px_rgba(255,255,255,1)]">
                            <animateMotion
                                dur="20s"
                                repeatCount="indefinite"
                                path="M0 120 C 60 120, 60 160, 120 160 S 180 200, 200 180 L 200 100 L 140 40 L 100 20 L 80 40 L 40 80 L 100 140"
                            />
                        </circle>
                    </g>
                </svg>
            </div>

            {/* Vignette Overlay for Depth */}
            <div className="absolute inset-0 bg-gradient-to-t from-dark-bg via-transparent to-dark-bg pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-r from-dark-bg/50 via-transparent to-dark-bg/50 pointer-events-none" />
        </div>
    );
};

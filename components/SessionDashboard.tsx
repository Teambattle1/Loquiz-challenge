import React, { useState, useEffect } from 'react';
import { fetchGameInfo } from '../services/loquizService';
import { HouseIcon } from './icons';

interface SessionDashboardProps {
    apiKey: string;
    gameId: string;
    onBack: () => void;
    onNavigate: (view: 'results' | 'showtime' | 'taskmaster' | 'timeline' | 'admin') => void;
}

const buttons = [
    { id: 'results' as const, label: 'Results', icon: '🏆', color: 'from-orange-600 to-amber-600', border: 'border-orange-500/40', glow: 'shadow-[0_0_40px_rgba(234,88,12,0.3)]', hoverGlow: 'hover:shadow-[0_0_60px_rgba(234,88,12,0.5)]' },
    { id: 'showtime' as const, label: 'Showtime', icon: '📸', color: 'from-pink-600 to-rose-600', border: 'border-pink-500/40', glow: 'shadow-[0_0_40px_rgba(236,72,153,0.3)]', hoverGlow: 'hover:shadow-[0_0_60px_rgba(236,72,153,0.5)]' },
    { id: 'taskmaster' as const, label: 'TaskMaster', icon: '📊', color: 'from-blue-600 to-cyan-600', border: 'border-blue-500/40', glow: 'shadow-[0_0_40px_rgba(37,99,235,0.3)]', hoverGlow: 'hover:shadow-[0_0_60px_rgba(37,99,235,0.5)]' },
    { id: 'timeline' as const, label: 'Timeline', icon: '⏱️', color: 'from-purple-600 to-violet-600', border: 'border-purple-500/40', glow: 'shadow-[0_0_40px_rgba(147,51,234,0.3)]', hoverGlow: 'hover:shadow-[0_0_60px_rgba(147,51,234,0.5)]' },
    { id: 'admin' as const, label: 'Admin', icon: '⚙️', color: 'from-zinc-600 to-zinc-500', border: 'border-zinc-500/40', glow: 'shadow-[0_0_40px_rgba(113,113,122,0.2)]', hoverGlow: 'hover:shadow-[0_0_60px_rgba(113,113,122,0.4)]' },
];

const SessionDashboard: React.FC<SessionDashboardProps> = ({ apiKey, gameId, onBack, onNavigate }) => {
    const [gameName, setGameName] = useState<string | null>(null);
    const [gameLogo, setGameLogo] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const info = await fetchGameInfo(gameId, apiKey);
                setGameName(info.name);
                setGameLogo(info.logoUrl || null);
            } catch (err) {
                console.warn('Failed to load game info:', err);
            }
        };
        load();
    }, [gameId, apiKey]);

    return (
        <div className="w-full flex flex-col items-center justify-center min-h-[80vh] animate-fade-in px-4">
            <div className="fixed top-8 left-8 z-50">
                <button onClick={onBack} className="p-3 bg-black/60 hover:bg-orange-600 text-orange-500 hover:text-white rounded-full transition-all border border-orange-500/30 shadow-2xl">
                    <HouseIcon className="w-6 h-6 md:w-8 md:h-8" />
                </button>
            </div>

            {gameLogo && (
                <div className="mb-8 animate-fade-in">
                    <img src={gameLogo} alt="Logo" className="h-32 md:h-48 object-contain drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]" />
                </div>
            )}

            <h1 className="text-4xl md:text-7xl font-black text-white mb-2 uppercase tracking-tighter drop-shadow-2xl">TEAMCHALLENGE</h1>
            {gameName && <p className="text-base md:text-xl text-orange-500 font-black uppercase tracking-[0.3em] drop-shadow-md mb-12">{gameName}</p>}

            <div className="grid grid-cols-3 gap-4 md:gap-6 w-full max-w-2xl">
                {buttons.map(btn => (
                    <button
                        key={btn.id}
                        onClick={() => onNavigate(btn.id)}
                        className={`aspect-square rounded-full bg-gradient-to-br ${btn.color} ${btn.border} border-2 ${btn.glow} ${btn.hoverGlow} hover:scale-110 active:scale-95 transition-all duration-300 flex flex-col items-center justify-center gap-2 md:gap-3`}
                    >
                        <span className="text-3xl md:text-5xl">{btn.icon}</span>
                        <span className="text-white font-black text-xs md:text-sm uppercase tracking-widest">{btn.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default SessionDashboard;

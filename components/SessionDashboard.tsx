import React, { useState, useEffect } from 'react';
import { fetchGameInfo } from '../services/loquizService';
import { TrophyIcon, CameraIcon, ChartIcon, ClockIcon, GearIcon, ListIcon } from './icons';
import { useT } from '../lib/i18n';

interface SessionDashboardProps {
    apiKey: string;
    gameId: string;
    onBack: () => void;
    onNavigate: (view: 'results' | 'showtime' | 'taskmaster' | 'timeline' | 'results-reveal' | 'admin' | 'client-tasks') => void;
}

const buttonDefs = [
    { id: 'results' as const, labelKey: 'menu.results', Icon: TrophyIcon },
    { id: 'showtime' as const, labelKey: 'menu.showtime', Icon: CameraIcon },
    { id: 'taskmaster' as const, labelKey: 'menu.taskmaster', Icon: ChartIcon },
    { id: 'timeline' as const, labelKey: 'menu.timeline', Icon: ClockIcon },
    { id: 'client-tasks' as const, labelKey: 'menu.client', Icon: ListIcon },
    { id: 'admin' as const, labelKey: 'menu.admin', Icon: GearIcon },
];

const buildSessionLink = (gameId: string, view?: string): string => {
    const base = `${window.location.origin}${window.location.pathname}`;
    const params = new URLSearchParams();
    params.set('game', gameId);
    if (view && view !== 'dashboard') params.set('view', view);
    return `${base}?${params.toString()}`;
};

const SessionDashboard: React.FC<SessionDashboardProps> = ({ apiKey, gameId, onBack, onNavigate }) => {
    const t = useT();
    const [gameName, setGameName] = useState<string | null>(null);
    const [gameLogo, setGameLogo] = useState<string | null>(null);
    const [copiedView, setCopiedView] = useState<string | null>(null);

    const copyLink = async (view?: string) => {
        const url = buildSessionLink(gameId, view);
        try {
            await navigator.clipboard.writeText(url);
            setCopiedView(view || 'dashboard');
            setTimeout(() => setCopiedView(null), 2000);
        } catch {
            window.prompt(t('menu.copyLink') + ':', url);
        }
    };

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

            {gameLogo && (
                <div className="mb-8 animate-fade-in">
                    <img src={gameLogo} alt="Logo" className="h-32 md:h-48 object-contain drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]" />
                </div>
            )}

            <h1 className="text-4xl md:text-7xl font-black text-white mb-2 uppercase tracking-tighter drop-shadow-2xl">TEAMCHALLENGE</h1>
            {gameName && <p className="text-base md:text-xl text-orange-500 font-black uppercase tracking-[0.3em] drop-shadow-md mb-12">{gameName}</p>}

            <div className="grid grid-cols-3 gap-5 md:gap-7 w-full max-w-xl">
                {buttonDefs.map(btn => {
                    const label = t(btn.labelKey);
                    return (
                        <div key={btn.id} className="relative group/card">
                            <button
                                onClick={() => onNavigate(btn.id)}
                                className="w-full group aspect-square rounded-2xl bg-zinc-900/80 border border-orange-500/20 hover:border-orange-500/60 shadow-[0_0_20px_rgba(234,88,12,0.1)] hover:shadow-[0_0_40px_rgba(234,88,12,0.3)] hover:scale-105 active:scale-95 transition-all duration-300 flex flex-col items-center justify-center gap-3"
                            >
                                <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-orange-600/10 border border-orange-500/30 group-hover:bg-orange-600/20 group-hover:border-orange-500/50 transition-all flex items-center justify-center">
                                    <btn.Icon className="w-6 h-6 md:w-8 md:h-8 text-orange-500 group-hover:text-orange-400 transition-colors" />
                                </div>
                                <span className="text-orange-500 group-hover:text-orange-400 font-black text-[10px] md:text-xs uppercase tracking-[0.2em] transition-colors">{label}</span>
                            </button>
                            {(btn.id === 'results' || btn.id === 'showtime') && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); copyLink(btn.id); }}
                                    title={`${t('menu.copyDirectLink')} ${label}`}
                                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 hover:bg-orange-600 text-orange-400 hover:text-white border border-orange-500/40 opacity-0 group-hover/card:opacity-100 transition-all flex items-center justify-center text-xs z-10"
                                >
                                    {copiedView === btn.id ? '✓' : '🔗'}
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Copy session link */}
            <div className="mt-8 flex items-center gap-3">
                <button
                    onClick={() => copyLink()}
                    className="px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-widest bg-zinc-900/80 border border-orange-500/30 text-orange-400 hover:text-white hover:border-orange-500/70 hover:bg-orange-600/20 transition-all"
                >
                    {copiedView === 'dashboard' ? t('menu.linkCopied') : t('menu.copySessionLink')}
                </button>
            </div>
        </div>
    );
};

export default SessionDashboard;

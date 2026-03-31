import React, { useState, useEffect, useRef } from 'react';
import { PlayerResult } from '../types';
import { TrophyIcon } from './icons';
import { useMusicPlayer } from '../hooks/useMusicPlayer';
import { getResultsPlaylistId } from '../services/musicService';

interface ResultsRevealProps {
    results: PlayerResult[];
    onClose: () => void;
}

const medalStyles: Record<number, { bg: string; border: string; text: string; rank: string; glow: string }> = {
    1: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/40', text: 'text-yellow-400', rank: 'text-yellow-500', glow: 'shadow-[0_0_30px_rgba(250,204,21,0.15)]' },
    2: { bg: 'bg-zinc-400/10', border: 'border-zinc-400/30', text: 'text-zinc-300', rank: 'text-zinc-400', glow: 'shadow-[0_0_20px_rgba(161,161,170,0.1)]' },
    3: { bg: 'bg-orange-600/10', border: 'border-orange-600/30', text: 'text-orange-500', rank: 'text-orange-600', glow: 'shadow-[0_0_20px_rgba(234,88,12,0.1)]' },
};

const ResultsReveal: React.FC<ResultsRevealProps> = ({ results, onClose }) => {
    // Reveal from bottom (highest position number first)
    const sortedResults = [...results].sort((a, b) => a.position - b.position);
    const totalTeams = sortedResults.length;

    // revealedCount: how many teams are revealed (from bottom up)
    const [revealedCount, setRevealedCount] = useState(0);
    const music = useMusicPlayer();
    const listRef = useRef<HTMLDivElement>(null);

    // Request fullscreen + start music on mount
    useEffect(() => {
        // Fullscreen
        try { document.documentElement.requestFullscreen?.(); } catch {}
        // Music
        const playlistId = getResultsPlaylistId();
        console.log('[ResultsReveal] Starting music, playlistId:', playlistId);
        if (playlistId) {
            music.playPlaylist(playlistId);
        }
        return () => {
            music.stop();
            try { if (document.fullscreenElement) document.exitFullscreen?.(); } catch {}
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Scroll to bottom on mount so last-place team is visible first
    useEffect(() => {
        setTimeout(() => {
            listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
        }, 300);
    }, []);

    const revealNext = () => {
        if (revealedCount < totalTeams) {
            setRevealedCount(prev => prev + 1);
        }
    };

    const revealAll = () => {
        setRevealedCount(totalTeams);
    };

    const allRevealed = revealedCount >= totalTeams;

    // A team at position P is revealed if revealedCount >= (totalTeams - P + 1)
    // i.e. last place revealed first, first place revealed last
    const isRevealed = (position: number) => revealedCount >= (totalTeams - position + 1);

    return (
        <div className="fixed inset-0 z-50 bg-black flex flex-col animate-fade-in">
            {/* Header */}
            <div className="p-4 md:p-6 flex justify-between items-center bg-black/60 border-b border-orange-500/20 shrink-0">
                <div>
                    <h2 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tighter">Results</h2>
                    <p className="text-orange-500 text-xs font-bold uppercase tracking-[0.3em] mt-1">
                        {revealedCount} / {totalTeams} revealed
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {!allRevealed && (
                        <button
                            onClick={revealAll}
                            className="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-zinc-800 text-zinc-400 border border-zinc-700 hover:text-white transition-all"
                        >
                            Vis alle
                        </button>
                    )}
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            </div>

            {/* Results list */}
            <div ref={listRef} className="flex-grow overflow-y-auto px-4 md:px-8 py-6">
                <div className="max-w-5xl mx-auto space-y-3">
                    {sortedResults.map(player => {
                        const revealed = isRevealed(player.position);
                        const isTop3 = player.position <= 3;
                        const style = isTop3 ? medalStyles[player.position] : null;

                        return (
                            <div
                                key={player.position}
                                className={`flex items-center gap-4 md:gap-6 px-6 md:px-8 py-4 md:py-5 rounded-2xl border transition-all duration-700 ${
                                    revealed
                                        ? isTop3
                                            ? `${style!.bg} ${style!.border} ${style!.glow}`
                                            : 'bg-zinc-900/40 border-zinc-800/50'
                                        : 'bg-zinc-900/20 border-zinc-800/20'
                                }`}
                            >
                                {/* Rank */}
                                <div className={`text-3xl md:text-5xl font-black w-16 md:w-20 text-center shrink-0 transition-all duration-700 ${
                                    revealed
                                        ? isTop3 ? style!.rank : 'text-zinc-600'
                                        : 'text-zinc-800'
                                }`}>
                                    {revealed ? (
                                        isTop3 ? (
                                            <TrophyIcon className={`w-8 h-8 md:w-12 md:h-12 mx-auto ${style!.text}`} />
                                        ) : `#${player.position}`
                                    ) : (
                                        <span className="text-zinc-700 text-2xl">?</span>
                                    )}
                                </div>

                                {/* Color bar + Name */}
                                <div className="flex items-center flex-grow min-w-0">
                                    <div
                                        className="w-2 h-10 md:h-14 rounded-sm mr-4 shrink-0 transition-all duration-700"
                                        style={{ backgroundColor: revealed ? (player.color || '#555') : '#222' }}
                                    />
                                    <span className={`font-black text-xl md:text-3xl truncate uppercase tracking-wider transition-all duration-700 ${
                                        revealed
                                            ? isTop3 ? 'text-white' : 'text-zinc-300'
                                            : 'text-zinc-300 blur-md select-none'
                                    }`}>
                                        {player.name}
                                    </span>
                                </div>

                                {/* Score */}
                                <div className={`font-mono font-black text-2xl md:text-4xl shrink-0 transition-all duration-700 ${
                                    revealed
                                        ? isTop3 ? style!.text : 'text-zinc-400'
                                        : 'text-zinc-400 blur-lg select-none'
                                }`}>
                                    {revealed ? player.score.toLocaleString() : '???'}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Bottom action bar */}
            {!allRevealed && (
                <div className="p-6 flex justify-center bg-gradient-to-t from-black via-black/80 to-transparent shrink-0">
                    <button
                        onClick={revealNext}
                        className="px-10 py-4 bg-orange-600 hover:bg-orange-500 text-white font-black text-lg uppercase tracking-widest rounded-full shadow-[0_0_40px_rgba(234,88,12,0.4)] hover:shadow-[0_0_60px_rgba(234,88,12,0.6)] hover:scale-105 active:scale-95 transition-all"
                    >
                        Vis næste
                    </button>
                </div>
            )}

            {/* Music indicator */}
            {music.isPlaying && music.currentTrack && (
                <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-black/60 px-3 py-1.5 rounded-full border border-zinc-700/50">
                    <div className="flex items-end gap-0.5 h-3">
                        <div className="w-0.5 bg-orange-500 animate-pulse" style={{ height: '40%' }} />
                        <div className="w-0.5 bg-orange-500 animate-pulse" style={{ height: '80%', animationDelay: '0.15s' }} />
                        <div className="w-0.5 bg-orange-500 animate-pulse" style={{ height: '60%', animationDelay: '0.3s' }} />
                    </div>
                    <span className="text-zinc-500 text-[10px] font-mono truncate max-w-[150px]">{music.currentTrack.title}</span>
                </div>
            )}
        </div>
    );
};

export default ResultsReveal;

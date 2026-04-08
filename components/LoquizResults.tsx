import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PlayerResult } from '../types';
import { fetchGameResults, fetchGameInfo } from '../services/loquizService';
import LiveToast from './LiveToast';
import { HouseIcon, TrophyIcon } from './icons';

interface LoquizResultsProps {
    apiKey: string;
    gameId: string;
    onBack: () => void;
}

const medalStyles = {
    1: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/40', text: 'text-yellow-400', rank: 'text-yellow-500', glow: 'shadow-[0_0_30px_rgba(250,204,21,0.15)]' },
    2: { bg: 'bg-zinc-400/10', border: 'border-zinc-400/30', text: 'text-zinc-300', rank: 'text-zinc-400', glow: 'shadow-[0_0_20px_rgba(161,161,170,0.1)]' },
    3: { bg: 'bg-orange-600/10', border: 'border-orange-600/30', text: 'text-orange-500', rank: 'text-orange-600', glow: 'shadow-[0_0_20px_rgba(234,88,12,0.1)]' },
};

const LoquizResults: React.FC<LoquizResultsProps> = ({ apiKey, gameId, onBack }) => {
    const [results, setResults] = useState<PlayerResult[] | null>(null);
    const [gameName, setGameName] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [liveEvent, setLiveEvent] = useState<{ message: string, subtext: string } | null>(null);
    const totalAnswerCountRef = useRef<number>(0);
    const isFirstLoadRef = useRef<boolean>(true);

    const [columns, setColumns] = useState<1 | 2>(1);
    const [hiddenPositions, setHiddenPositions] = useState<Set<number>>(new Set());
    const [revealedPositions, setRevealedPositions] = useState<Set<number>>(new Set());

    const toggleHidden = useCallback((pos: number) => {
        setHiddenPositions(prev => {
            const next = new Set(prev);
            if (next.has(pos)) next.delete(pos);
            else next.add(pos);
            return next;
        });
        setRevealedPositions(prev => {
            const next = new Set(prev);
            next.delete(pos);
            return next;
        });
    }, []);

    const resetReveal = useCallback(() => {
        setRevealedPositions(new Set());
    }, []);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.code !== 'Space') return;
            const target = e.target as HTMLElement | null;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
            e.preventDefault();
            setRevealedPositions(prev => {
                const pending = [...hiddenPositions].filter(p => !prev.has(p)).sort((a, b) => b - a);
                if (pending.length === 0) return prev;
                const next = new Set(prev);
                next.add(pending[0]);
                return next;
            });
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [hiddenPositions]);

    const loadData = useCallback(async (isRefresh = false) => {
        if (!gameId) return;
        if (!isRefresh) setIsLoading(true);

        try {
            const resultsData = await fetchGameResults(gameId, apiKey);
            setResults(resultsData);

            let currentTotalAnswers = 0;
            resultsData.forEach(team => currentTotalAnswers += (team.answers?.length || 0));

            if (!isFirstLoadRef.current && currentTotalAnswers > totalAnswerCountRef.current) {
                const diff = currentTotalAnswers - totalAnswerCountRef.current;
                setLiveEvent({ message: "INCOMING TRANSMISSION", subtext: `${diff} NEW ANSWER RECEIVED` });
                setTimeout(() => setLiveEvent(null), 4000);
            }
            totalAnswerCountRef.current = currentTotalAnswers;
            isFirstLoadRef.current = false;

            if (!isRefresh) {
                const info = await fetchGameInfo(gameId, apiKey);
                setGameName(info.name);
            }
        } catch (err) {
            console.warn("Sync error:", err);
            if (!isRefresh) setError(err instanceof Error ? err.message : 'Error syncing data');
        } finally {
            if (!isRefresh) setIsLoading(false);
        }
    }, [gameId, apiKey]);

    useEffect(() => {
        loadData();
        const intervalId = setInterval(() => loadData(true), 15000);
        return () => clearInterval(intervalId);
    }, [loadData]);

    if (isLoading) return (
        <div className="flex flex-col items-center justify-center text-center h-64">
            <div className="w-16 h-16 border-4 border-orange-500 border-t-white rounded-full animate-spin mb-6"></div>
            <p className="text-white/80 text-xl font-bold tracking-wider uppercase">Connecting to Satellite...</p>
        </div>
    );

    if (error) return (
        <div className="w-full max-w-md text-center glass-panel p-8 rounded-2xl border border-red-500/30 mx-auto">
            <h2 className="text-2xl font-bold text-red-400 mb-2 uppercase">Sync Error</h2>
            <p className="text-gray-400 mb-6">{error}</p>
            <div className="flex flex-col gap-3">
                <button onClick={() => { setError(null); loadData(); }} className="px-6 py-3 bg-orange-600 text-black rounded-lg hover:bg-orange-500 transition-all uppercase tracking-widest text-xs font-bold">Retry Connection</button>
                <button onClick={onBack} className="px-6 py-3 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors uppercase tracking-widest text-xs font-bold border border-zinc-700">Back to Dashboard</button>
            </div>
        </div>
    );

    if (!results || results.length === 0) return (
        <div className="w-full flex flex-col items-center pt-32 px-4 animate-fade-in">
            <div className="fixed top-3 left-3 z-50">
                <button onClick={onBack} className="p-2.5 bg-black/80 hover:bg-orange-600 text-orange-500 hover:text-white rounded-full transition-all border border-orange-500/30 shadow-2xl backdrop-blur-sm">
                    <HouseIcon className="w-5 h-5 md:w-6 md:h-6" />
                </button>
            </div>
            <div className="text-center glass-panel p-12 rounded-3xl border border-white/5 max-w-2xl">
                <h1 className="text-4xl font-black text-white uppercase mb-4 tracking-tighter">No Active Signals</h1>
                <p className="text-zinc-500 font-bold uppercase tracking-widest text-sm mb-8">This game code exists, but no scores or team results were found on the server.</p>
                <div className="flex flex-col items-center gap-4">
                    <button onClick={() => loadData(true)} className="text-orange-500 hover:text-orange-400 font-bold uppercase text-xs tracking-widest mt-4">Force Refresh Signal</button>
                    <button onClick={onBack} className="text-zinc-600 hover:text-zinc-400 font-bold uppercase text-[10px] tracking-[0.3em] mt-2">Return to Dashboard</button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="w-full max-w-full px-2 md:px-4 flex flex-col items-center relative z-10 h-full pt-20 md:pt-24">
            {liveEvent && <LiveToast message={liveEvent.message} subtext={liveEvent.subtext} />}

            <div className="fixed top-3 left-3 z-50">
                <button onClick={onBack} className="p-2.5 bg-black/80 hover:bg-orange-600 text-orange-500 hover:text-white rounded-full transition-all border border-orange-500/30 shadow-2xl backdrop-blur-sm">
                    <HouseIcon className="w-5 h-5 md:w-6 md:h-6" />
                </button>
            </div>

            <div className="w-full text-center mb-6">
                <h1 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tighter drop-shadow-2xl">Results</h1>
                {gameName && <p className="text-sm md:text-lg text-orange-500 font-black uppercase tracking-[0.3em] mt-1">{gameName}</p>}
            </div>

            {/* Controls */}
            <div className="w-full max-w-5xl flex flex-wrap items-center justify-center gap-2 md:gap-3 mb-6">
                <div className="flex items-center gap-1 bg-zinc-900/60 border border-zinc-800 rounded-lg p-1">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest px-2">Columns</span>
                    {[1, 2].map((c) => (
                        <button
                            key={c}
                            onClick={() => setColumns(c as 1 | 2)}
                            className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-widest transition-all ${
                                columns === c ? 'bg-orange-600 text-black' : 'text-zinc-400 hover:text-white'
                            }`}
                        >
                            {c}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-1 bg-zinc-900/60 border border-zinc-800 rounded-lg p-1">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest px-2">Hide</span>
                    {[1, 2, 3].map((pos) => {
                        const active = hiddenPositions.has(pos);
                        return (
                            <button
                                key={pos}
                                onClick={() => toggleHidden(pos)}
                                className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-widest transition-all ${
                                    active ? 'bg-orange-600 text-black' : 'text-zinc-400 hover:text-white'
                                }`}
                            >
                                #{pos}
                            </button>
                        );
                    })}
                </div>

                {hiddenPositions.size > 0 && (
                    <button
                        onClick={resetReveal}
                        className="px-3 py-2 rounded-lg bg-zinc-900/60 border border-zinc-800 text-zinc-400 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-all"
                    >
                        Reset reveal
                    </button>
                )}

                {hiddenPositions.size > 0 && (
                    <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest px-2">
                        Press <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-orange-400">space</kbd> to reveal from bottom
                    </div>
                )}
            </div>

            {/* All teams */}
            <div className={`w-full max-w-5xl mb-16 ${columns === 2 ? 'grid grid-cols-1 md:grid-cols-2 gap-3' : 'space-y-3'}`}>
                {results.map((player) => {
                    const isTop3 = player.position <= 3;
                    const style = isTop3 ? medalStyles[player.position as 1 | 2 | 3] : null;
                    const isHidden = hiddenPositions.has(player.position) && !revealedPositions.has(player.position);
                    const justRevealed = hiddenPositions.has(player.position) && revealedPositions.has(player.position);

                    return (
                        <div
                            key={player.position}
                            className={`flex items-center gap-4 md:gap-6 px-6 md:px-8 py-4 md:py-5 rounded-2xl border transition-all ${
                                isHidden
                                    ? 'bg-zinc-900/60 border-dashed border-zinc-700/60'
                                    : isTop3
                                        ? `${style!.bg} ${style!.border} ${style!.glow} ${justRevealed ? 'animate-fade-in' : ''}`
                                        : 'bg-zinc-900/40 border-zinc-800/50'
                            }`}
                        >
                            {/* Rank */}
                            <div className={`text-3xl md:text-5xl font-black w-16 md:w-20 text-center shrink-0 ${
                                isHidden ? 'text-zinc-600' : isTop3 ? style!.rank : 'text-zinc-600'
                            }`}>
                                {isTop3 && !isHidden ? (
                                    <TrophyIcon className={`w-8 h-8 md:w-12 md:h-12 mx-auto ${style!.text}`} />
                                ) : (
                                    `#${player.position}`
                                )}
                            </div>

                            {/* Color bar + Name */}
                            <div className="flex items-center flex-grow min-w-0">
                                <div
                                    className="w-2 h-10 md:h-14 rounded-sm mr-4 shrink-0"
                                    style={{ backgroundColor: isHidden ? '#3f3f46' : (player.color || '#555') }}
                                />
                                <span className={`font-black text-xl md:text-3xl truncate uppercase tracking-wider ${
                                    isHidden ? 'text-zinc-600' : isTop3 ? 'text-white' : 'text-zinc-300'
                                }`}>
                                    {isHidden ? '??????' : player.name}
                                </span>
                            </div>

                            {/* Score */}
                            <div className={`font-mono font-black text-2xl md:text-4xl shrink-0 ${
                                isHidden ? 'text-zinc-600' : isTop3 ? style!.text : 'text-zinc-400'
                            }`}>
                                {isHidden ? '???' : player.score.toLocaleString()}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default LoquizResults;

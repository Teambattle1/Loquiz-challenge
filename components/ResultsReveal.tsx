import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PlayerResult } from '../types';
import { TrophyIcon } from './icons';

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

    const [revealedCount, setRevealedCount] = useState(0);
    const [justRevealedPos, setJustRevealedPos] = useState<number | null>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [musicPlaying, setMusicPlaying] = useState(false);

    const TARGET_VOL = 0.25;
    const FADE_MS = 3000;

    const fadeAudio = useCallback((audio: HTMLAudioElement, from: number, to: number, ms: number): Promise<void> => {
        return new Promise(resolve => {
            const steps = 30;
            const stepMs = ms / steps;
            const delta = (to - from) / steps;
            let step = 0;
            audio.volume = from;
            const interval = setInterval(() => {
                step++;
                audio.volume = Math.max(0, Math.min(1, from + delta * step));
                if (step >= steps) {
                    clearInterval(interval);
                    audio.volume = Math.max(0, Math.min(1, to));
                    resolve();
                }
            }, stepMs);
        });
    }, []);

    const stopMusic = useCallback(() => {
        const audio = audioRef.current;
        if (audio && !audio.paused) {
            fadeAudio(audio, audio.volume, 0, FADE_MS).then(() => {
                audio.pause();
                setMusicPlaying(false);
            });
        }
    }, [fadeAudio]);

    // Start winner.mp3 on mount with fade-in at 25% volume
    useEffect(() => {
        try { document.documentElement.requestFullscreen?.(); } catch {}

        const audio = new Audio('/winner.mp3');
        audio.loop = true;
        audio.volume = 0;
        audioRef.current = audio;

        audio.play().then(() => {
            setMusicPlaying(true);
            fadeAudio(audio, 0, TARGET_VOL, FADE_MS);
        }).catch(e => console.warn('Winner audio failed:', e));

        return () => {
            audio.pause();
            audio.src = '';
            audioRef.current = null;
            try { if (document.fullscreenElement) document.exitFullscreen?.(); } catch {}
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Scroll to bottom on mount
    useEffect(() => {
        setTimeout(() => {
            listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
        }, 300);
    }, []);

    const [autoRevealing, setAutoRevealing] = useState(false);
    const autoRevealRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const winnerAudioRef = useRef<HTMLAudioElement | null>(null);

    // Fanfare sound for top 3
    const playFanfare = useCallback((place: 1 | 2 | 3) => {
        if (place === 1) {
            // #1 Winner: play the real fanfare MP3 at 75%
            try {
                const audio = new Audio('/winner-reveal.mp3');
                audio.volume = 0.75;
                audio.play();
                winnerAudioRef.current = audio;
            } catch {}
            return;
        }
        // #2 and #3: synthesized tones
        try {
            const ctx = new AudioContext();
            const now = ctx.currentTime;
            const gain = ctx.createGain();
            gain.connect(ctx.destination);
            gain.gain.setValueAtTime(0.15, now);

            const sequences: Record<number, number[]> = {
                3: [330, 392, 440],           // Bronze: E4 G4 A4
                2: [392, 494, 587],           // Silver: G4 B4 D5
            };
            const notes = sequences[place];
            const noteLen = 0.25;

            notes.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                osc.type = 'triangle';
                osc.frequency.value = freq;
                osc.connect(gain);
                osc.start(now + i * noteLen);
                osc.stop(now + i * noteLen + noteLen * 1.5);
            });

            const totalLen = notes.length * noteLen + noteLen;
            gain.gain.linearRampToValueAtTime(0, now + totalLen + 0.5);
        } catch {}
    }, []);

    const revealNext = () => {
        if (revealedCount < totalTeams) {
            const positionBeingRevealed = totalTeams - revealedCount;
            if (positionBeingRevealed <= 3) {
                playFanfare(positionBeingRevealed as 1 | 2 | 3);
                setJustRevealedPos(positionBeingRevealed);
                // Clear animation after 2s
                setTimeout(() => setJustRevealedPos(null), 2000);
            }
            setRevealedCount(prev => prev + 1);
        }
    };

    const revealAll = () => {
        setRevealedCount(totalTeams);
    };

    const allRevealed = revealedCount >= totalTeams;

    // How many reveals needed to reach top 3 (positions 1,2,3)
    // revealedCount needed for position P: totalTeams - P + 1
    // For position 4 (first non-top3): totalTeams - 4 + 1 = totalTeams - 3
    const revealsToTop3 = totalTeams - 3;

    // Auto-reveal: fast through non-top3, then stop for dramatic top3
    const startAutoReveal = () => {
        if (autoRevealing) return;
        setAutoRevealing(true);
        let count = revealedCount;
        const doNext = () => {
            count++;
            setRevealedCount(count);
            // Scroll the newly revealed team into view
            setTimeout(() => {
                const el = listRef.current;
                if (el) {
                    // Scroll up a bit to show the revealed team
                    const scrollTarget = el.scrollHeight - (el.scrollHeight * (count / totalTeams));
                    el.scrollTo({ top: Math.max(0, scrollTarget - 200), behavior: 'smooth' });
                }
            }, 100);

            if (count >= revealsToTop3) {
                // Stop at top 3 — fade out music, user clicks manually for dramatic reveal
                setAutoRevealing(false);
                stopMusic();
                return;
            }
            // 4 seconds between each reveal
            autoRevealRef.current = setTimeout(doNext, 4000);
        };
        doNext();
    };

    // Cleanup auto-reveal on unmount
    useEffect(() => {
        return () => { if (autoRevealRef.current) clearTimeout(autoRevealRef.current); };
    }, []);

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
                    {musicPlaying && (
                        <button
                            onClick={stopMusic}
                            className="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-zinc-800 text-orange-400 border border-orange-500/30 hover:bg-orange-600 hover:text-white transition-all flex items-center gap-1.5"
                        >
                            <span className="flex items-end gap-0.5 h-3">
                                <span className="w-0.5 bg-orange-400 animate-pulse" style={{ height: '40%' }} />
                                <span className="w-0.5 bg-orange-400 animate-pulse" style={{ height: '80%', animationDelay: '0.15s' }} />
                                <span className="w-0.5 bg-orange-400 animate-pulse" style={{ height: '60%', animationDelay: '0.3s' }} />
                            </span>
                            Stop musik
                        </button>
                    )}
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
                        const isAnimating = justRevealedPos === player.position;

                        return (
                            <div
                                key={player.position}
                                className={`flex items-center gap-4 md:gap-6 px-6 md:px-8 py-4 md:py-5 rounded-2xl border transition-all duration-700 ${
                                    revealed
                                        ? isTop3
                                            ? `${style!.bg} ${style!.border} ${style!.glow}`
                                            : 'bg-zinc-900/40 border-zinc-800/50'
                                        : 'bg-zinc-900/20 border-zinc-800/20'
                                } ${isAnimating ? 'podium-reveal' : ''}`}
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
                <div className="p-6 flex justify-center gap-4 bg-gradient-to-t from-black via-black/80 to-transparent shrink-0">
                    {/* Before top 3: show fast-forward + manual */}
                    {revealedCount < revealsToTop3 && !autoRevealing && (
                        <button
                            onClick={startAutoReveal}
                            className="px-8 py-4 bg-orange-600 hover:bg-orange-500 text-white font-black text-lg uppercase tracking-widest rounded-full shadow-[0_0_40px_rgba(234,88,12,0.4)] hover:shadow-[0_0_60px_rgba(234,88,12,0.6)] hover:scale-105 active:scale-95 transition-all"
                        >
                            ▶ Start Reveal
                        </button>
                    )}
                    {/* During auto-reveal */}
                    {autoRevealing && (
                        <div className="px-8 py-4 bg-zinc-800 text-orange-400 font-black text-lg uppercase tracking-widest rounded-full border border-orange-500/30 animate-pulse">
                            Revealing...
                        </div>
                    )}
                    {/* At top 3: dramatic manual reveal */}
                    {revealedCount >= revealsToTop3 && !autoRevealing && (
                        <button
                            onClick={revealNext}
                            className={`px-12 py-5 font-black text-xl uppercase tracking-widest rounded-full hover:scale-105 active:scale-95 transition-all ${
                                totalTeams - revealedCount === 3
                                    ? 'bg-gradient-to-r from-orange-700 to-amber-600 text-white shadow-[0_0_40px_rgba(234,88,12,0.4)]'
                                    : totalTeams - revealedCount === 2
                                    ? 'bg-gradient-to-r from-zinc-500 to-zinc-300 text-black shadow-[0_0_40px_rgba(161,161,170,0.4)]'
                                    : 'bg-gradient-to-r from-yellow-500 to-amber-400 text-black shadow-[0_0_60px_rgba(250,204,21,0.5)]'
                            }`}
                        >
                            {totalTeams - revealedCount === 3 ? '🥉 Vis #3' :
                             totalTeams - revealedCount === 2 ? '🥈 Vis #2' :
                             '🥇 Vis #1'}
                        </button>
                    )}
                </div>
            )}

            {/* Music indicator */}
            {musicPlaying && (
                <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-black/60 px-3 py-1.5 rounded-full border border-zinc-700/50 z-30">
                    <div className="flex items-end gap-0.5 h-3">
                        <div className="w-0.5 bg-orange-500 animate-pulse" style={{ height: '40%' }} />
                        <div className="w-0.5 bg-orange-500 animate-pulse" style={{ height: '80%', animationDelay: '0.15s' }} />
                        <div className="w-0.5 bg-orange-500 animate-pulse" style={{ height: '60%', animationDelay: '0.3s' }} />
                    </div>
                    <span className="text-zinc-500 text-[10px] font-mono">Winner</span>
                </div>
            )}
        </div>
    );
};

export default ResultsReveal;

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PlayerResult } from '../types';
import { TrophyIcon } from './icons';

interface ResultsRevealProps {
    results: PlayerResult[];
    onClose: () => void;
}

const medalStyles: Record<number, { bg: string; border: string; text: string; rank: string; glow: string; color: string }> = {
    1: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/40', text: 'text-yellow-400', rank: 'text-yellow-500', glow: 'shadow-[0_0_30px_rgba(250,204,21,0.15)]', color: '#eab308' },
    2: { bg: 'bg-zinc-400/10', border: 'border-zinc-400/30', text: 'text-zinc-300', rank: 'text-zinc-400', glow: 'shadow-[0_0_20px_rgba(161,161,170,0.1)]', color: '#a1a1aa' },
    3: { bg: 'bg-orange-600/10', border: 'border-orange-600/30', text: 'text-orange-500', rank: 'text-orange-600', glow: 'shadow-[0_0_20px_rgba(234,88,12,0.1)]', color: '#ea580c' },
};

type OverlayState = 'none' | 'highlight3' | 'highlight2' | 'winner' | 'podium' | 'thanks';

const ResultsReveal: React.FC<ResultsRevealProps> = ({ results, onClose }) => {
    const sortedResults = [...results].sort((a, b) => a.position - b.position);
    const totalTeams = sortedResults.length;

    const [revealedCount, setRevealedCount] = useState(0);
    const [overlay, setOverlay] = useState<OverlayState>('none');
    // Gate-screen: browsers block `requestFullscreen` + `audio.play()` without
    // a user gesture. When ResultsReveal auto-mounts after the showtime
    // slideshow there is no gesture — so we show a "Ready?" tap-target and run
    // fullscreen + music from the click handler instead of the mount effect.
    const [gateOpen, setGateOpen] = useState(true);
    const listRef = useRef<HTMLDivElement>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const winnerAudioRef = useRef<HTMLAudioElement | null>(null);
    const [musicPlaying, setMusicPlaying] = useState(false);

    const TARGET_VOL = 0.25;
    const FADE_MS = 3000;

    const top3 = sortedResults.filter(p => p.position <= 3);

    const fadeAudio = useCallback((audio: HTMLAudioElement, from: number, to: number, ms: number): Promise<void> => {
        return new Promise(resolve => {
            const steps = 30;
            const stepMs = ms / steps;
            const delta = (to - from) / steps;
            let step = 0;
            audio.volume = Math.max(0, Math.min(1, from));
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

    // Cleanup on unmount — audio and fullscreen get set up from the gate click,
    // not on mount, so we only guarantee teardown here.
    useEffect(() => {
        return () => {
            const audio = audioRef.current;
            if (audio) { audio.pause(); audio.src = ''; audioRef.current = null; }
            if (winnerAudioRef.current) {
                winnerAudioRef.current.pause();
                winnerAudioRef.current.src = '';
                winnerAudioRef.current = null;
            }
            try { if (document.fullscreenElement) document.exitFullscreen?.(); } catch {}
        };
    }, []);

    // Gate dismissal — the click here is the user gesture that lets us call
    // `requestFullscreen` and start audio playback without the browser blocking.
    const dismissGate = useCallback(() => {
        setGateOpen(false);
        try { document.documentElement.requestFullscreen?.(); } catch {}
        const audio = new Audio('/winner.mp3');
        audio.loop = true;
        audio.volume = 0;
        audioRef.current = audio;
        audio.play().then(() => {
            setMusicPlaying(true);
            fadeAudio(audio, 0, TARGET_VOL, FADE_MS);
        }).catch(() => {});
    }, [fadeAudio]);

    // Scroll to bottom on mount
    useEffect(() => {
        setTimeout(() => {
            listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
        }, 300);
    }, []);

    const [autoRevealing, setAutoRevealing] = useState(false);
    const autoRevealRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const revealsToTop3 = totalTeams - 3;
    const allRevealed = revealedCount >= totalTeams;
    const isRevealed = (position: number) => revealedCount >= (totalTeams - position + 1);

    const revealNext = () => {
        if (revealedCount >= totalTeams) return;
        const posBeingRevealed = totalTeams - revealedCount;

        if (posBeingRevealed === 3) {
            // Show highlight overlay for #3 — brugeren klikker for at lukke
            setOverlay('highlight3');
            setRevealedCount(prev => prev + 1);
        } else if (posBeingRevealed === 2) {
            // Show highlight overlay for #2 — brugeren klikker for at lukke
            setOverlay('highlight2');
            setRevealedCount(prev => prev + 1);
        } else if (posBeingRevealed === 1) {
            // #1: stop bg music, play winner-reveal.mp3, show trophy overlay.
            // Podium vises først når brugeren selv klikker videre.
            stopMusic();
            try {
                const wa = new Audio('/winner-reveal.mp3');
                wa.volume = 0.75;
                wa.play();
                winnerAudioRef.current = wa;
            } catch {}
            setOverlay('winner');
            setRevealedCount(prev => prev + 1);
        } else {
            setRevealedCount(prev => prev + 1);
        }
    };

    // Når podium har stået i 5s, lader vi en "TeamBattle takker for kampen"
    // animation svøbe ind over toppen. Brugeren kan selv klikke podium/thanks
    // videre til luk — vi tvinger ikke lukning efter animationen.
    useEffect(() => {
        if (overlay !== 'podium') return;
        const t = setTimeout(() => setOverlay('thanks'), 5000);
        return () => clearTimeout(t);
    }, [overlay]);

    const startAutoReveal = () => {
        if (autoRevealing) return;
        setAutoRevealing(true);
        let count = revealedCount;
        const doNext = () => {
            count++;
            setRevealedCount(count);
            setTimeout(() => {
                const el = listRef.current;
                if (el) {
                    const scrollTarget = el.scrollHeight - (el.scrollHeight * (count / totalTeams));
                    el.scrollTo({ top: Math.max(0, scrollTarget - 200), behavior: 'smooth' });
                }
            }, 100);
            if (count >= revealsToTop3) {
                setAutoRevealing(false);
                return;
            }
            autoRevealRef.current = setTimeout(doNext, 4000);
        };
        doNext();
    };

    useEffect(() => {
        return () => { if (autoRevealRef.current) clearTimeout(autoRevealRef.current); };
    }, []);

    // Mellemrumstast / Enter = samme som at klikke den aktive primær-knap på
    // skærmen: starter auto-reveal op til top 3, og reveal'er herefter #3/#2/#1
    // ét klik ad gangen — så man kan trykke rytmisk uden at ramme mus/touch.
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key !== ' ' && e.key !== 'Enter') return;
            // Ignore when an input/textarea/contentEditable has focus
            const target = e.target as HTMLElement | null;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
            e.preventDefault();
            if (gateOpen) { dismissGate(); return; }
            // Overlay-klik via spacebar: highlight → luk; winner → podium;
            // podium → thanks; thanks → luk helt.
            if (overlay === 'highlight3' || overlay === 'highlight2') { setOverlay('none'); return; }
            if (overlay === 'winner') { setOverlay('podium'); return; }
            if (overlay === 'podium') { setOverlay('thanks'); return; }
            if (overlay === 'thanks') { onClose(); return; }
            if (allRevealed) return;
            if (revealedCount < revealsToTop3) {
                if (!autoRevealing) startAutoReveal();
            } else {
                revealNext();
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [gateOpen, dismissGate, overlay, allRevealed, revealedCount, revealsToTop3, autoRevealing, onClose]); // eslint-disable-line react-hooks/exhaustive-deps

    // ─── Fullscreen overlays ────────────────────────────────────
    const renderOverlay = () => {
        if (overlay === 'highlight3' || overlay === 'highlight2') {
            const pos = overlay === 'highlight3' ? 3 : 2;
            const team = sortedResults.find(p => p.position === pos);
            if (!team) return null;
            const style = medalStyles[pos];
            const medal = pos === 3 ? '🥉' : '🥈';
            const label = pos === 3 ? '3RD PLACE' : '2ND PLACE';
            return (
                <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center animate-fade-in" onClick={() => setOverlay('none')}>
                    <div className="text-center highlight-pop">
                        <div className="text-8xl md:text-[10rem] mb-4">{medal}</div>
                        <p className="text-2xl md:text-4xl font-black uppercase tracking-[0.3em] mb-2" style={{ color: style.color }}>{label}</p>
                        <p className="text-4xl md:text-7xl font-black text-white uppercase tracking-tighter mb-4">{team.name}</p>
                        <p className="text-3xl md:text-5xl font-mono font-black" style={{ color: style.color }}>{team.score.toLocaleString()} pts</p>
                    </div>
                </div>
            );
        }

        if (overlay === 'winner') {
            const team = sortedResults.find(p => p.position === 1);
            if (!team) return null;
            return (
                <div className="fixed inset-0 z-[60] bg-black flex items-center justify-center cursor-pointer" onClick={() => setOverlay('podium')}>
                    <div className="text-center winner-entrance">
                        <TrophyIcon className="w-32 h-32 md:w-48 md:h-48 text-yellow-400 mx-auto mb-6 trophy-glow" />
                        <p className="text-3xl md:text-5xl font-black uppercase tracking-[0.3em] text-yellow-400 mb-2">Winner</p>
                        <p className="text-5xl md:text-8xl font-black text-white uppercase tracking-tighter mb-4">{team.name}</p>
                        <p className="text-4xl md:text-6xl font-mono font-black text-yellow-400">{team.score.toLocaleString()} pts</p>
                        <p className="text-zinc-600 text-[11px] uppercase tracking-widest mt-8">Tap to continue</p>
                    </div>
                </div>
            );
        }

        if (overlay === 'podium') {
            const p1 = top3.find(t => t.position === 1);
            const p2 = top3.find(t => t.position === 2);
            const p3 = top3.find(t => t.position === 3);
            return (
                <div className="fixed inset-0 z-[60] bg-black flex flex-col items-center justify-center cursor-pointer" onClick={() => setOverlay('thanks')}>
                    <h2 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tighter mb-12">Podium</h2>
                    <div className="flex items-end justify-center gap-4 md:gap-8 w-full max-w-4xl px-4">
                        {/* 2nd place — left, medium height */}
                        {p2 && (
                            <div className="flex flex-col items-center podium-rise" style={{ animationDelay: '0.3s' }}>
                                <p className="text-xl md:text-3xl font-black text-white uppercase tracking-tight mb-2 truncate max-w-[200px]">{p2.name}</p>
                                <p className="text-lg md:text-2xl font-mono font-black text-zinc-300 mb-3">{p2.score.toLocaleString()}</p>
                                <div className="w-28 md:w-40 rounded-t-xl flex flex-col items-center justify-end pb-4" style={{ height: '180px', background: 'linear-gradient(to top, #71717a, #a1a1aa)' }}>
                                    <span className="text-4xl md:text-5xl">🥈</span>
                                    <span className="text-2xl md:text-3xl font-black text-white mt-1">#2</span>
                                </div>
                            </div>
                        )}
                        {/* 1st place — center, tallest */}
                        {p1 && (
                            <div className="flex flex-col items-center podium-rise" style={{ animationDelay: '0.6s' }}>
                                <TrophyIcon className="w-12 h-12 md:w-16 md:h-16 text-yellow-400 mb-2 trophy-glow" />
                                <p className="text-2xl md:text-4xl font-black text-white uppercase tracking-tight mb-2 truncate max-w-[240px]">{p1.name}</p>
                                <p className="text-xl md:text-3xl font-mono font-black text-yellow-400 mb-3">{p1.score.toLocaleString()}</p>
                                <div className="w-32 md:w-48 rounded-t-xl flex flex-col items-center justify-end pb-4" style={{ height: '240px', background: 'linear-gradient(to top, #a16207, #eab308)' }}>
                                    <span className="text-5xl md:text-6xl">🥇</span>
                                    <span className="text-3xl md:text-4xl font-black text-white mt-1">#1</span>
                                </div>
                            </div>
                        )}
                        {/* 3rd place — right, shortest */}
                        {p3 && (
                            <div className="flex flex-col items-center podium-rise" style={{ animationDelay: '0s' }}>
                                <p className="text-xl md:text-3xl font-black text-white uppercase tracking-tight mb-2 truncate max-w-[200px]">{p3.name}</p>
                                <p className="text-lg md:text-2xl font-mono font-black text-orange-500 mb-3">{p3.score.toLocaleString()}</p>
                                <div className="w-28 md:w-40 rounded-t-xl flex flex-col items-center justify-end pb-4" style={{ height: '140px', background: 'linear-gradient(to top, #9a3412, #ea580c)' }}>
                                    <span className="text-4xl md:text-5xl">🥉</span>
                                    <span className="text-2xl md:text-3xl font-black text-white mt-1">#3</span>
                                </div>
                            </div>
                        )}
                    </div>
                    <p className="text-zinc-600 text-xs uppercase tracking-widest mt-12">Tap for afslutning</p>
                </div>
            );
        }

        // TeamBattle thanks — ligger OVER podium så publikum stadig ser
        // holdene nedenunder. Klik lukker ResultsReveal helt.
        if (overlay === 'thanks') {
            const p1 = top3.find(t => t.position === 1);
            const p2 = top3.find(t => t.position === 2);
            const p3 = top3.find(t => t.position === 3);
            return (
                <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center cursor-pointer" onClick={onClose}>
                    {/* Podium i baggrunden (lidt dæmpet) */}
                    <div className="absolute inset-0 bg-black" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center opacity-40 pointer-events-none">
                        <div className="flex items-end justify-center gap-4 md:gap-8 w-full max-w-4xl px-4">
                            {p2 && (
                                <div className="flex flex-col items-center">
                                    <p className="text-xl md:text-3xl font-black text-white uppercase tracking-tight mb-2 truncate max-w-[200px]">{p2.name}</p>
                                    <p className="text-lg md:text-2xl font-mono font-black text-zinc-300 mb-3">{p2.score.toLocaleString()}</p>
                                    <div className="w-28 md:w-40 rounded-t-xl flex flex-col items-center justify-end pb-4" style={{ height: '180px', background: 'linear-gradient(to top, #71717a, #a1a1aa)' }}>
                                        <span className="text-4xl md:text-5xl">🥈</span>
                                        <span className="text-2xl md:text-3xl font-black text-white mt-1">#2</span>
                                    </div>
                                </div>
                            )}
                            {p1 && (
                                <div className="flex flex-col items-center">
                                    <TrophyIcon className="w-12 h-12 md:w-16 md:h-16 text-yellow-400 mb-2" />
                                    <p className="text-2xl md:text-4xl font-black text-white uppercase tracking-tight mb-2 truncate max-w-[240px]">{p1.name}</p>
                                    <p className="text-xl md:text-3xl font-mono font-black text-yellow-400 mb-3">{p1.score.toLocaleString()}</p>
                                    <div className="w-32 md:w-48 rounded-t-xl flex flex-col items-center justify-end pb-4" style={{ height: '240px', background: 'linear-gradient(to top, #a16207, #eab308)' }}>
                                        <span className="text-5xl md:text-6xl">🥇</span>
                                        <span className="text-3xl md:text-4xl font-black text-white mt-1">#1</span>
                                    </div>
                                </div>
                            )}
                            {p3 && (
                                <div className="flex flex-col items-center">
                                    <p className="text-xl md:text-3xl font-black text-white uppercase tracking-tight mb-2 truncate max-w-[200px]">{p3.name}</p>
                                    <p className="text-lg md:text-2xl font-mono font-black text-orange-500 mb-3">{p3.score.toLocaleString()}</p>
                                    <div className="w-28 md:w-40 rounded-t-xl flex flex-col items-center justify-end pb-4" style={{ height: '140px', background: 'linear-gradient(to top, #9a3412, #ea580c)' }}>
                                        <span className="text-4xl md:text-5xl">🥉</span>
                                        <span className="text-2xl md:text-3xl font-black text-white mt-1">#3</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Thanks-banner animerer ind fra bunden oven på podiet */}
                    <div className="relative z-10 animate-thanks text-center px-6 max-w-4xl">
                        <h2
                            className="text-5xl md:text-8xl font-black uppercase tracking-tighter leading-none mb-6 animate-thanks-shimmer"
                            style={{ filter: 'drop-shadow(0 6px 24px rgba(251,146,60,0.45))' }}
                        >
                            TeamBattle<br />takker for kampen
                        </h2>
                        <p className="animate-thanks-sub text-2xl md:text-4xl font-bold text-white/90 uppercase tracking-[0.25em]" style={{ animationDelay: '0.4s' }}>
                            Håber i havde en god dag!
                        </p>
                        <p className="mt-12 text-zinc-500 text-xs uppercase tracking-widest">Tap for afslutning</p>
                    </div>
                </div>
            );
        }

        return null;
    };

    // ─── Gate screen ────────────────────────────────────────────
    // Big tap-target that gives the browser its required user gesture before
    // we call requestFullscreen + start the winner music. Også en elegant
    // glossy orange knap med hvid overskrift + mørk undertekst.
    if (gateOpen) {
        return (
            <div className="fixed inset-0 z-50 bg-black flex items-center justify-center p-6 animate-fade-in">
                <button
                    onClick={dismissGate}
                    aria-label="Start score reveal"
                    className="group relative overflow-hidden rounded-[2rem] px-12 py-16 max-w-2xl w-full border border-orange-300/50 hover:scale-[1.02] active:scale-[0.98] transition-transform duration-300"
                    style={{
                        background: 'linear-gradient(180deg, #fb923c 0%, #f97316 45%, #ea580c 100%)',
                        boxShadow:
                            '0 30px 80px -20px rgba(234, 88, 12, 0.8),' +
                            '0 10px 30px -10px rgba(0, 0, 0, 0.6),' +
                            'inset 0 2px 0 rgba(255, 255, 255, 0.4),' +
                            'inset 0 -3px 8px rgba(0, 0, 0, 0.18)',
                    }}
                >
                    {/* Glossy top-sheen — slips over halvdelen af knappen og giver et subtilt glasset look */}
                    <span
                        aria-hidden
                        className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-[2rem]"
                        style={{
                            background: 'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 100%)',
                        }}
                    />
                    {/* Soft radial highlight øverst venstre */}
                    <span
                        aria-hidden
                        className="pointer-events-none absolute -top-8 -left-10 w-56 h-56 rounded-full blur-2xl"
                        style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.45), transparent 70%)' }}
                    />

                    <div className="relative flex flex-col items-center gap-8">
                        <TrophyIcon className="w-24 h-24 md:w-32 md:h-32 text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.35)]" />
                        <div className="text-center">
                            <h2
                                className="text-4xl md:text-7xl font-black uppercase tracking-tighter leading-none mb-4 text-white"
                                style={{ textShadow: '0 2px 4px rgba(0,0,0,0.35), 0 1px 0 rgba(255,255,255,0.2)' }}
                            >
                                Ready to see<br />the score?
                            </h2>
                            <p className="text-sm md:text-base font-bold uppercase tracking-[0.3em] text-orange-950/80">
                                Tap to reveal the winners
                            </p>
                        </div>
                    </div>
                </button>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 bg-black flex flex-col animate-fade-in">
            {/* Overlays */}
            {renderOverlay()}

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
                        <button onClick={stopMusic} className="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-zinc-800 text-orange-400 border border-orange-500/30 hover:bg-orange-600 hover:text-white transition-all flex items-center gap-1.5">
                            <span className="flex items-end gap-0.5 h-3">
                                <span className="w-0.5 bg-orange-400 animate-pulse" style={{ height: '40%' }} />
                                <span className="w-0.5 bg-orange-400 animate-pulse" style={{ height: '80%', animationDelay: '0.15s' }} />
                                <span className="w-0.5 bg-orange-400 animate-pulse" style={{ height: '60%', animationDelay: '0.3s' }} />
                            </span>
                            Stop musik
                        </button>
                    )}
                    {!allRevealed && (
                        <button onClick={() => { setRevealedCount(totalTeams); setOverlay('podium'); stopMusic(); }} className="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-zinc-800 text-zinc-400 border border-zinc-700 hover:text-white transition-all">
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
                                <div className={`text-3xl md:text-5xl font-black w-16 md:w-20 text-center shrink-0 transition-all duration-700 ${
                                    revealed ? (isTop3 ? style!.rank : 'text-zinc-600') : 'text-zinc-800'
                                }`}>
                                    {revealed ? (
                                        isTop3 ? <TrophyIcon className={`w-8 h-8 md:w-12 md:h-12 mx-auto ${style!.text}`} /> : `#${player.position}`
                                    ) : <span className="text-zinc-700 text-2xl">?</span>}
                                </div>
                                <div className="flex items-center flex-grow min-w-0">
                                    <div className="w-2 h-10 md:h-14 rounded-sm mr-4 shrink-0 transition-all duration-700" style={{ backgroundColor: revealed ? (player.color || '#555') : '#222' }} />
                                    <span className={`font-black text-xl md:text-3xl truncate uppercase tracking-wider transition-all duration-700 ${
                                        revealed ? (isTop3 ? 'text-white' : 'text-zinc-300') : 'text-zinc-300 blur-md select-none'
                                    }`}>{player.name}</span>
                                </div>
                                <div className={`font-mono font-black text-2xl md:text-4xl shrink-0 transition-all duration-700 ${
                                    revealed ? (isTop3 ? style!.text : 'text-zinc-400') : 'text-zinc-400 blur-lg select-none'
                                }`}>{revealed ? player.score.toLocaleString() : '???'}</div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Bottom action bar */}
            {!allRevealed && overlay === 'none' && (
                <div className="p-6 flex justify-center gap-4 bg-gradient-to-t from-black via-black/80 to-transparent shrink-0">
                    {revealedCount < revealsToTop3 && !autoRevealing && (
                        <button onClick={startAutoReveal} className="px-8 py-4 bg-orange-600 hover:bg-orange-500 text-white font-black text-lg uppercase tracking-widest rounded-full shadow-[0_0_40px_rgba(234,88,12,0.4)] hover:shadow-[0_0_60px_rgba(234,88,12,0.6)] hover:scale-105 active:scale-95 transition-all">
                            ▶ Start Reveal
                        </button>
                    )}
                    {autoRevealing && (
                        <div className="px-8 py-4 bg-zinc-800 text-orange-400 font-black text-lg uppercase tracking-widest rounded-full border border-orange-500/30 animate-pulse">
                            Revealing...
                        </div>
                    )}
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

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { GamePhoto } from '../types';
import MusicConfig from './MusicConfig';
import { useMusicPlayer } from '../hooks/useMusicPlayer';
import { getShowtimePlaylistId } from '../services/musicService';

interface ShowtimeProps {
  photos: GamePhoto[];
  onClose: () => void;
  onShowtimeComplete?: () => void;
}

const DURATION_KEY = 'loquiz_slideshow_duration';
const ROTATION_KEY = 'loquiz_photo_rotations';

const getStoredDuration = (): number => {
    const val = localStorage.getItem(DURATION_KEY);
    return val ? parseInt(val, 10) : 5;
};

const getStoredRotations = (): Record<string, number> => {
    try {
        return JSON.parse(localStorage.getItem(ROTATION_KEY) || '{}');
    } catch { return {}; }
};

const Showtime = ({ photos, onClose, onShowtimeComplete }: ShowtimeProps) => {
    const [view, setView] = useState<'grid' | 'slideshow' | 'countdown'>('grid');
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [selectMode, setSelectMode] = useState(false);
    const [showMusicConfig, setShowMusicConfig] = useState(false);
    const [isShowtimeMode, setIsShowtimeMode] = useState(false);
    const [slideDuration, setSlideDuration] = useState(getStoredDuration);
    const [showDurationPicker, setShowDurationPicker] = useState(false);
    const [rotations, setRotations] = useState<Record<string, number>>(getStoredRotations);
    const [countdownProgress, setCountdownProgress] = useState(0);
    const [preloadDone, setPreloadDone] = useState(false);
    const music = useMusicPlayer();
    const showtimeCompleteTriggered = useRef(false);

    // Slideshow photos — selected subset or all
    const slideshowPhotos = useMemo(() => {
        if (selectedIds.size === 0) return photos;
        return photos.filter(p => selectedIds.has(p.id));
    }, [photos, selectedIds]);

    // Save duration to localStorage
    const changeDuration = (sec: number) => {
        setSlideDuration(sec);
        localStorage.setItem(DURATION_KEY, String(sec));
        setShowDurationPicker(false);
    };

    // Rotate a photo 90° clockwise
    const rotatePhoto = (id: string) => {
        setRotations(prev => {
            const next = { ...prev, [id]: ((prev[id] || 0) + 90) % 360 };
            localStorage.setItem(ROTATION_KEY, JSON.stringify(next));
            return next;
        });
    };

    // Preload images and show countdown
    const preloadAndStart = useCallback((startFn: () => void) => {
        const toPreload = slideshowPhotos.map(p => p.url);
        if (toPreload.length === 0) { startFn(); return; }

        setView('countdown');
        setPreloadDone(false);
        setCountdownProgress(0);

        let loaded = 0;
        const total = toPreload.length;

        const checkDone = () => {
            loaded++;
            setCountdownProgress(loaded / total);
            if (loaded >= total) {
                setPreloadDone(true);
                // Short pause to show 100%, then start
                setTimeout(startFn, 600);
            }
        };

        toPreload.forEach(url => {
            const img = new Image();
            img.onload = checkDone;
            img.onerror = checkDone;
            img.src = url;
        });
    }, [slideshowPhotos]);

    // Auto-play effect for slideshow
    useEffect(() => {
        let interval: ReturnType<typeof setInterval> | undefined;
        if (view === 'slideshow' && isPlaying && slideshowPhotos.length > 0) {
            interval = setInterval(() => {
                setCurrentIndex(prev => {
                    const next = prev + 1;
                    if (isShowtimeMode && next >= slideshowPhotos.length) {
                        if (!showtimeCompleteTriggered.current) {
                            showtimeCompleteTriggered.current = true;
                            music.stop();
                            setTimeout(() => onShowtimeComplete?.(), 500);
                        }
                        return prev;
                    }
                    return next % slideshowPhotos.length;
                });
            }, slideDuration * 1000);
        }
        return () => { if (interval) clearInterval(interval); };
    }, [isPlaying, view, slideshowPhotos.length, isShowtimeMode, slideDuration, music, onShowtimeComplete]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (view === 'slideshow') setView('grid');
                else if (view === 'countdown') setView('grid');
                else onClose();
            }
            if (view === 'slideshow') {
                if (e.key === 'ArrowRight') setCurrentIndex(prev => (prev + 1) % slideshowPhotos.length);
                if (e.key === 'ArrowLeft') setCurrentIndex(prev => (prev - 1 + slideshowPhotos.length) % slideshowPhotos.length);
                if (e.key === ' ') { e.preventDefault(); setIsPlaying(prev => !prev); }
                if (e.key === 'r' || e.key === 'R') {
                    const photo = slideshowPhotos[currentIndex];
                    if (photo) rotatePhoto(photo.id);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [view, slideshowPhotos, currentIndex, onClose]);

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const selectAll = () => setSelectedIds(new Set(photos.map(p => p.id)));
    const selectNone = () => setSelectedIds(new Set());

    const enterSlideshow = (startIndex?: number) => {
        const doStart = () => {
            setCurrentIndex(startIndex ?? 0);
            setView('slideshow');
            setIsPlaying(true);
            setSelectMode(false);
        };
        preloadAndStart(doStart);
    };

    const startShowtime = () => {
        showtimeCompleteTriggered.current = false;
        setIsShowtimeMode(true);
        const doStart = () => {
            setCurrentIndex(0);
            setView('slideshow');
            setIsPlaying(true);
            setSelectMode(false);
            const playlistId = getShowtimePlaylistId();
            if (playlistId) music.playPlaylist(playlistId);
        };
        preloadAndStart(doStart);
    };

    const startSelectedSlideshow = () => {
        const doStart = () => {
            setCurrentIndex(0);
            setView('slideshow');
            setIsPlaying(true);
            setSelectMode(false);
        };
        preloadAndStart(doStart);
    };

    // ─── Empty state ────────────────────────────────────────────
    if (photos.length === 0) {
        return (
            <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center backdrop-blur-md">
                <p className="text-zinc-500 font-bold uppercase tracking-widest mb-4">No photos found for this game</p>
                <button onClick={onClose} className="px-6 py-2 bg-zinc-800 text-white rounded-full border border-zinc-700 hover:bg-orange-600 transition-colors uppercase tracking-wider font-bold">Close</button>
            </div>
        );
    }

    // ─── Countdown / Preload screen ─────────────────────────────
    if (view === 'countdown') {
        const pct = Math.round(countdownProgress * 100);
        return (
            <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
                <div className="text-center mb-12">
                    <h2 className="text-5xl md:text-7xl font-black text-white uppercase tracking-tighter mb-3">
                        {preloadDone ? 'GO!' : 'Loading...'}
                    </h2>
                    <p className="text-orange-500 font-mono text-lg uppercase tracking-widest">
                        {preloadDone ? 'Starting showtime' : `${pct}% — ${slideshowPhotos.length} photos`}
                    </p>
                </div>
                {/* Full-width progress bar */}
                <div className="w-full max-w-2xl px-8">
                    <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-300 ${preloadDone ? 'bg-green-500' : 'bg-orange-500'}`}
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                </div>
            </div>
        );
    }

    // ─── Grid view ──────────────────────────────────────────────
    if (view === 'grid') {
        return (
            <div className="fixed inset-0 z-50 bg-zinc-950/95 backdrop-blur-xl flex flex-col animate-fade-in">
                {/* Header */}
                <div className="p-4 md:p-6 flex justify-between items-center bg-black/40 border-b border-white/5 shrink-0">
                    <div>
                        <h2 className="text-2xl md:text-3xl font-black text-orange-500 uppercase tracking-tighter flex items-center gap-3">
                            Showtime Gallery
                        </h2>
                        <p className="text-zinc-400 text-xs font-mono uppercase tracking-wide">
                            {photos.length} Photos
                            {selectedIds.size > 0 && <span className="text-orange-400 ml-2">• {selectedIds.size} Selected</span>}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                        {/* MUSIK */}
                        <button onClick={() => setShowMusicConfig(true)} className="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-zinc-800 text-zinc-400 border border-zinc-700 hover:text-white hover:border-zinc-500 transition-all">
                            ♪ Musik
                        </button>
                        {/* TIME / Duration picker */}
                        <div className="relative">
                            <button
                                onClick={() => setShowDurationPicker(!showDurationPicker)}
                                className="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-zinc-800 text-zinc-400 border border-zinc-700 hover:text-white hover:border-zinc-500 transition-all"
                            >
                                ⏱ {slideDuration}s
                            </button>
                            {showDurationPicker && (
                                <div className="absolute top-full right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl z-50 overflow-hidden">
                                    {[3, 4, 5, 7, 10, 15].map(sec => (
                                        <button
                                            key={sec}
                                            onClick={() => changeDuration(sec)}
                                            className={`block w-full px-4 py-2 text-xs font-bold text-left uppercase tracking-wider transition-colors ${
                                                slideDuration === sec ? 'bg-orange-600 text-white' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                                            }`}
                                        >
                                            {sec} sekunder
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        {/* Select */}
                        <button
                            onClick={() => { setSelectMode(!selectMode); setShowDurationPicker(false); }}
                            className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all ${
                                selectMode ? 'bg-orange-500/20 text-orange-400 border-orange-500/50' : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-white hover:border-zinc-500'
                            }`}
                        >
                            {selectMode ? 'Done' : 'Select'}
                        </button>
                        {/* SHOWTIME */}
                        <button onClick={startShowtime} className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-pink-600 to-orange-600 text-white border border-pink-500/50 hover:from-pink-500 hover:to-orange-500 transition-all shadow-[0_0_20px_rgba(236,72,153,0.3)] hover:shadow-[0_0_30px_rgba(236,72,153,0.5)]">
                            ★ Showtime
                        </button>
                        {/* Play selected */}
                        {selectedIds.size > 0 && !selectMode && (
                            <button onClick={startSelectedSlideshow} className="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-orange-600 text-white border border-orange-500 hover:bg-orange-500 transition-all shadow-[0_0_15px_rgba(234,88,12,0.3)]">
                                Play {selectedIds.size} ▶
                            </button>
                        )}
                        {/* Play all */}
                        {!selectMode && selectedIds.size === 0 && (
                            <button onClick={() => enterSlideshow(0)} className="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-orange-600 text-white border border-orange-500 hover:bg-orange-500 transition-all">
                                Play All ▶
                            </button>
                        )}
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>

                {/* Select toolbar */}
                {selectMode && (
                    <div className="flex items-center gap-3 px-4 md:px-6 py-2 bg-zinc-900/80 border-b border-zinc-800/50 shrink-0">
                        <span className="text-zinc-500 text-xs uppercase tracking-wider font-bold">Select photos:</span>
                        <button onClick={selectAll} className="text-orange-400 text-xs font-bold uppercase tracking-wider hover:text-orange-300 transition-colors">All</button>
                        <span className="text-zinc-700">|</span>
                        <button onClick={selectNone} className="text-zinc-400 text-xs font-bold uppercase tracking-wider hover:text-white transition-colors">None</button>
                    </div>
                )}

                {/* Grid */}
                <div className="flex-grow overflow-y-auto p-4 md:p-6 scrollbar-thin scrollbar-thumb-orange-600 scrollbar-track-zinc-900">
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {photos.map((photo, idx) => {
                            const isSelected = selectedIds.has(photo.id);
                            const rot = rotations[photo.id] || 0;
                            return (
                                <div
                                    key={photo.id}
                                    className={`aspect-square relative group cursor-pointer rounded-lg overflow-hidden transition-all hover:scale-105 hover:z-10 bg-zinc-900 ${
                                        selectMode && isSelected
                                            ? 'border-2 border-orange-500 shadow-[0_0_20px_rgba(234,88,12,0.3)]'
                                            : selectMode
                                            ? 'border-2 border-zinc-700/50 opacity-60 hover:opacity-100'
                                            : 'border border-white/10 hover:border-orange-500/50'
                                    }`}
                                    onClick={() => selectMode ? toggleSelect(photo.id) : enterSlideshow(idx)}
                                >
                                    <img
                                        src={photo.thumbnailUrl || photo.url}
                                        alt="Thumbnail"
                                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-all"
                                        style={rot ? { transform: `rotate(${rot}deg)`, transformOrigin: 'center' } : undefined}
                                        loading="lazy"
                                    />
                                    {/* Rotate button */}
                                    <button
                                        onClick={e => { e.stopPropagation(); rotatePhoto(photo.id); }}
                                        className="absolute top-2 left-2 w-6 h-6 bg-black/60 hover:bg-orange-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all text-xs border border-zinc-600"
                                        title="Rotate 90°"
                                    >
                                        ↻
                                    </button>
                                    {/* Selection indicator */}
                                    {selectMode && (
                                        <div className={`absolute top-2 right-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                                            isSelected ? 'bg-orange-500 border-orange-400' : 'bg-black/50 border-zinc-500'
                                        }`}>
                                            {isSelected && (
                                                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                                                    <polyline points="20 6 9 17 4 12" />
                                                </svg>
                                            )}
                                        </div>
                                    )}
                                    {/* Rotation badge */}
                                    {rot > 0 && (
                                        <div className="absolute bottom-2 left-2 bg-orange-600/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                                            {rot}°
                                        </div>
                                    )}
                                    {/* Hover overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                                        <span className="text-white text-[10px] font-bold uppercase truncate">{photo.teamName || 'Unknown Team'}</span>
                                        <span className="text-orange-400 text-[9px] uppercase truncate">{photo.taskTitle}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
                <MusicConfig open={showMusicConfig} onClose={() => setShowMusicConfig(false)} />
            </div>
        );
    }

    // ─── Slideshow view ─────────────────────────────────────────
    const currentPhoto = slideshowPhotos[currentIndex];
    if (!currentPhoto) return null;
    const currentRotation = rotations[currentPhoto.id] || 0;

    return (
        <div className="fixed inset-0 z-50 bg-black text-white flex flex-col animate-fade-in">
            {/* Header */}
            <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-center z-20 bg-gradient-to-b from-black/80 to-transparent">
                <div className="flex items-center gap-4">
                    <button onClick={() => { setView('grid'); setIsShowtimeMode(false); }} className="text-zinc-400 hover:text-white flex items-center gap-1 uppercase text-xs font-bold tracking-wider">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                        Grid
                    </button>
                    <span className="text-xs font-mono text-zinc-400 bg-black/50 px-2 py-1 rounded border border-zinc-700">
                        {currentIndex + 1} / {slideshowPhotos.length}
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    {/* Rotate current */}
                    <button
                        onClick={() => rotatePhoto(currentPhoto.id)}
                        className="px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-zinc-800/80 text-zinc-400 border border-zinc-700 hover:text-white transition-all"
                    >
                        ↻ Rotate
                    </button>
                    <button
                        onClick={() => setIsPlaying(!isPlaying)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border transition-all ${isPlaying ? 'bg-orange-500/20 text-orange-400 border-orange-500/50' : 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}
                    >
                        {isPlaying ? 'Pause ⏸' : 'Play ▶'}
                    </button>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-zinc-900/80 hover:bg-red-900/50 hover:text-red-400 border border-zinc-700 flex items-center justify-center transition-colors">✕</button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-grow flex items-center justify-center relative overflow-hidden h-full w-full">
                {/* Prev hover */}
                <div
                    className="absolute left-0 top-0 h-full w-1/4 z-10 opacity-0 hover:opacity-100 flex items-center justify-start pl-4 bg-gradient-to-r from-black/50 to-transparent cursor-pointer transition-opacity"
                    onClick={() => setCurrentIndex(prev => (prev - 1 + slideshowPhotos.length) % slideshowPhotos.length)}
                >
                    <div className="p-3 rounded-full bg-black/50 border border-white/20 text-white text-2xl">‹</div>
                </div>

                {/* Photo */}
                <div key={currentPhoto.id} className="relative max-w-full max-h-full flex items-center justify-center p-4 animate-fade-in">
                    <img
                        src={currentPhoto.url}
                        alt="Game Photo"
                        className="max-h-[85vh] max-w-[95vw] object-contain shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-white/10 rounded transition-transform duration-300"
                        style={currentRotation ? { transform: `rotate(${currentRotation}deg)` } : undefined}
                    />
                    {/* Caption */}
                    <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-black/70 backdrop-blur-md px-6 py-3 rounded-xl border border-white/10 text-center max-w-[90%]">
                        {currentPhoto.teamName && (
                            <p className="text-orange-400 font-black text-lg md:text-2xl uppercase tracking-wide leading-none mb-1">{currentPhoto.teamName}</p>
                        )}
                        {currentPhoto.taskTitle && (
                            <p className="text-zinc-300 font-bold text-xs md:text-sm uppercase tracking-wider">{currentPhoto.taskTitle}</p>
                        )}
                    </div>
                </div>

                {/* Next hover */}
                <div
                    className="absolute right-0 top-0 h-full w-1/4 z-10 opacity-0 hover:opacity-100 flex items-center justify-end pr-4 bg-gradient-to-l from-black/50 to-transparent cursor-pointer transition-opacity"
                    onClick={() => setCurrentIndex(prev => (prev + 1) % slideshowPhotos.length)}
                >
                    <div className="p-3 rounded-full bg-black/50 border border-white/20 text-white text-2xl">›</div>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="h-1 bg-zinc-900 w-full relative">
                <div
                    className={`h-full transition-all duration-300 ${isShowtimeMode ? 'bg-pink-500' : 'bg-orange-500'}`}
                    style={{ width: `${((currentIndex + 1) / slideshowPhotos.length) * 100}%` }}
                />
            </div>

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

export default Showtime;

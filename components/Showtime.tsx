import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { GamePhoto, PlayerResult } from '../types';
import MusicConfig from './MusicConfig';
import { useMusicPlayer } from '../hooks/useMusicPlayer';
import { getShowtimePlaylistId } from '../services/musicService';
import { saveGallery, fetchGallery, updateShowtimeSelection, getShowtimeShareUrl } from '../services/galleryService';

interface ShowtimeProps {
  photos: GamePhoto[];
  gameId?: string;
  gameName?: string;
  results?: PlayerResult[];
  // When true: skip grid, auto-run the slideshow, hide admin controls.
  // Used by PublicShowtime so the customer lands straight in the reveal flow.
  playbackMode?: boolean;
  onClose: () => void;
  onShowtimeComplete?: () => void;
}

const DURATION_KEY = 'loquiz_slideshow_duration';

const getStoredDuration = (): number => {
    const val = localStorage.getItem(DURATION_KEY);
    return val ? parseInt(val, 10) : 5;
};

const HIDDEN_KEY = 'loquiz_hidden_photos';
const getStoredHidden = (): Set<string> => {
    try { return new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]')); }
    catch { return new Set(); }
};

const Showtime = ({ photos, gameId, gameName, results, playbackMode = false, onClose, onShowtimeComplete }: ShowtimeProps) => {
    // In playback mode we skip the grid entirely — show a black screen until
    // the gallery loads and the slideshow auto-starts, so the customer never
    // sees admin chrome.
    const [view, setView] = useState<'grid' | 'slideshow' | 'countdown'>(playbackMode ? 'countdown' : 'grid');
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [selectMode, setSelectMode] = useState(false);
    const [showMusicConfig, setShowMusicConfig] = useState(false);
    const [isShowtimeMode, setIsShowtimeMode] = useState(false);
    const [slideDuration, setSlideDuration] = useState(getStoredDuration);
    const [showDurationPicker, setShowDurationPicker] = useState(false);
    const [countdownProgress, setCountdownProgress] = useState(0);
    const [hiddenIds, setHiddenIds] = useState<Set<string>>(getStoredHidden);
    const [shareMsg, setShareMsg] = useState<string | null>(null);
    const [preloadDone, setPreloadDone] = useState(false);
    const [taskFilter, setTaskFilter] = useState<string | null>(null);
    const [selectionLoaded, setSelectionLoaded] = useState(false);
    const music = useMusicPlayer();
    const showtimeCompleteTriggered = useRef(false);

    // Load persisted selection (+ hidden) from Supabase so reopening picks up
    // the admin's prior picks — and so the public showtime link stays in sync.
    useEffect(() => {
        if (!gameId) { setSelectionLoaded(true); return; }
        fetchGallery(gameId).then(data => {
            if (data?.selected_photo_ids && data.selected_photo_ids.length > 0) {
                setSelectedIds(new Set(data.selected_photo_ids));
            }
            if (data?.hidden_ids && data.hidden_ids.length > 0) {
                setHiddenIds(prev => {
                    const merged = new Set(prev);
                    data.hidden_ids.forEach(id => merged.add(id));
                    return merged;
                });
            }
            setSelectionLoaded(true);
        }).catch(() => setSelectionLoaded(true));
    }, [gameId]);

    // Unique task titles with counts — for filter badges
    const taskFilters = useMemo(() => {
        const counts = new Map<string, number>();
        photos.forEach(p => {
            const title = (p.taskTitle || 'Photo').trim();
            counts.set(title, (counts.get(title) || 0) + 1);
        });
        return [...counts.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([title, count]) => ({ title, count }));
    }, [photos]);

    // Photos visible in the grid, narrowed by the active task filter
    const filteredPhotos = useMemo(() => {
        if (!taskFilter) return photos;
        return photos.filter(p => (p.taskTitle || 'Photo').trim() === taskFilter);
    }, [photos, taskFilter]);

    // Slideshow photos — selected subset or all visible (excluding hidden + task filter)
    const slideshowPhotos = useMemo(() => {
        const visible = filteredPhotos.filter(p => !hiddenIds.has(p.id));
        if (selectedIds.size === 0) return visible;
        return visible.filter(p => selectedIds.has(p.id));
    }, [filteredPhotos, selectedIds, hiddenIds]);

    // Save duration to localStorage
    const changeDuration = (sec: number) => {
        setSlideDuration(sec);
        localStorage.setItem(DURATION_KEY, String(sec));
        setShowDurationPicker(false);
    };

    // Toggle photo visibility (hide/show)
    const toggleHidden = (id: string) => {
        setHiddenIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            localStorage.setItem(HIDDEN_KEY, JSON.stringify([...next]));
            return next;
        });
    };

    // Visible photos (not hidden, respects task filter)
    const visiblePhotos = useMemo(() => filteredPhotos.filter(p => !hiddenIds.has(p.id)), [filteredPhotos, hiddenIds]);

    // Persist showtime selection on close — keeps the customer link in sync with
    // whatever admin picked, so adding more photos over time just reuses the link.
    const persistSelection = useCallback(async () => {
        if (!gameId || playbackMode) return;
        try {
            await updateShowtimeSelection(gameId, [...selectedIds], [...hiddenIds]);
        } catch {
            // Non-fatal — selection is also kept in localStorage via existing flow.
        }
    }, [gameId, playbackMode, selectedIds, hiddenIds]);

    const handleClose = useCallback(() => {
        // Fire-and-forget; do not block the UI close.
        persistSelection();
        onClose();
    }, [persistSelection, onClose]);

    // Copy direct showtime link — auto-saves photos, selection, hidden + results
    // so the recipient gets whatever admin currently sees.
    const copyShowtimeLink = async () => {
        if (!gameId) return;
        await saveGallery(gameId, gameName || null, photos, [...hiddenIds], {
            selectedPhotoIds: [...selectedIds],
            results,
        });
        const url = getShowtimeShareUrl(gameId);
        try {
            await navigator.clipboard.writeText(url);
            setShareMsg('Showtime-link kopieret!');
        } catch {
            setShareMsg(url);
        }
        setTimeout(() => setShareMsg(null), 4000);
    };

    // Preload all media (images AND videos) before starting slideshow
    const preloadAndStart = useCallback((startFn: () => void) => {
        const items = slideshowPhotos.map(p => ({ url: p.url, isVideo: p.mediaType === 'video' }));
        if (items.length === 0) { startFn(); return; }

        setView('countdown');
        setPreloadDone(false);
        setCountdownProgress(0);

        let loaded = 0;
        const total = items.length;

        const checkDone = () => {
            loaded++;
            setCountdownProgress(loaded / total);
            if (loaded >= total) {
                setPreloadDone(true);
                setTimeout(startFn, 600);
            }
        };

        items.forEach(({ url, isVideo }) => {
            if (isVideo) {
                // Fetch entire video into browser cache so <video> plays instantly
                fetch(url, { mode: 'cors', credentials: 'omit' })
                    .then(res => res.blob())
                    .then(() => checkDone())
                    .catch(() => {
                        // Fallback: hidden <video preload="auto">
                        const v = document.createElement('video');
                        v.preload = 'auto';
                        v.muted = true;
                        v.src = url;
                        const done = () => { v.oncanplaythrough = null; v.onerror = null; checkDone(); };
                        v.oncanplaythrough = done;
                        v.onerror = done;
                        // Safety timeout so a slow video never blocks start forever
                        setTimeout(done, 8000);
                    });
            } else {
                const img = new Image();
                img.onload = checkDone;
                img.onerror = checkDone;
                img.src = url;
            }
        });
    }, [slideshowPhotos]);

    const currentVideoRef = useRef<HTMLVideoElement | null>(null);

    const advance = useCallback(() => {
        setCurrentIndex(prev => {
            const next = prev + 1;
            if (isShowtimeMode && next >= slideshowPhotos.length) {
                if (!showtimeCompleteTriggered.current) {
                    showtimeCompleteTriggered.current = true;
                    setTimeout(() => onShowtimeComplete?.(), 500);
                }
                return prev;
            }
            if (isShowtimeMode && next === slideshowPhotos.length - 1) {
                music.stop();
            }
            return next % slideshowPhotos.length;
        });
    }, [isShowtimeMode, slideshowPhotos.length, music, onShowtimeComplete]);

    // Auto-play effect: images use slideDuration, videos play to their end
    useEffect(() => {
        if (view !== 'slideshow' || !isPlaying || slideshowPhotos.length === 0) return;
        const current = slideshowPhotos[currentIndex];
        if (!current) return;
        // Videos advance via onEnded handler, not here
        if (current.mediaType === 'video') return;
        const timeout = setTimeout(advance, slideDuration * 1000);
        return () => clearTimeout(timeout);
    }, [isPlaying, view, currentIndex, slideshowPhotos, slideDuration, advance]);

    // Pause/play current video in sync with isPlaying
    useEffect(() => {
        const v = currentVideoRef.current;
        if (!v) return;
        if (isPlaying) {
            v.play().catch(() => {});
        } else {
            v.pause();
        }
    }, [isPlaying, currentIndex]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (playbackMode) { handleClose(); return; }
                if (view === 'slideshow') setView('grid');
                else if (view === 'countdown') setView('grid');
                else handleClose();
            }
            if (view === 'slideshow') {
                if (e.key === 'ArrowRight') setCurrentIndex(prev => (prev + 1) % slideshowPhotos.length);
                if (e.key === 'ArrowLeft') setCurrentIndex(prev => (prev - 1 + slideshowPhotos.length) % slideshowPhotos.length);
                if (e.key === ' ') { e.preventDefault(); setIsPlaying(prev => !prev); }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [view, slideshowPhotos, currentIndex, handleClose, playbackMode]);

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const selectAll = () => setSelectedIds(new Set(filteredPhotos.map(p => p.id)));
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

    const startShowtime = useCallback(() => {
        showtimeCompleteTriggered.current = false;
        setIsShowtimeMode(true);
        // Request fullscreen for big-screen presentation
        try { document.documentElement.requestFullscreen?.(); } catch {}
        const doStart = () => {
            setCurrentIndex(0);
            setView('slideshow');
            setIsPlaying(true);
            setSelectMode(false);
            const playlistId = getShowtimePlaylistId();
            if (playlistId) music.playPlaylist(playlistId);
        };
        preloadAndStart(doStart);
    }, [music, preloadAndStart]);

    // Playback mode: skip grid entirely and jump straight into the showtime flow
    // once the selection has been loaded (so we slideshow the picked photos only).
    const playbackStartedRef = useRef(false);
    useEffect(() => {
        if (!playbackMode || !selectionLoaded || playbackStartedRef.current) return;
        if (slideshowPhotos.length === 0) return;
        playbackStartedRef.current = true;
        startShowtime();
    }, [playbackMode, selectionLoaded, slideshowPhotos.length, startShowtime]);

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
                <button onClick={handleClose} className="px-6 py-2 bg-zinc-800 text-white rounded-full border border-zinc-700 hover:bg-orange-600 transition-colors uppercase tracking-wider font-bold">Close</button>
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
                            {visiblePhotos.length} / {photos.length} Photos
                            {hiddenIds.size > 0 && <span className="text-red-400 ml-2">• {hiddenIds.size} Hidden</span>}
                            {selectedIds.size > 0 && <span className="text-orange-400 ml-2">• {selectedIds.size} Selected</span>}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                        {/* Copy direct showtime link — slideshow + podium for the customer */}
                        {gameId && !playbackMode && (
                            <button
                                onClick={copyShowtimeLink}
                                title="Kopiér link der starter slideshow + podium-reveal hos kunden"
                                className="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-pink-600/20 text-pink-300 border border-pink-500/40 hover:bg-pink-600/40 hover:text-white transition-all"
                            >
                                🔗 Showtime-link
                            </button>
                        )}
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
                        <button onClick={handleClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
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

                {/* Task filter badges */}
                {taskFilters.length > 1 && (
                    <div className="flex items-center gap-2 px-4 md:px-6 py-2 bg-black/30 border-b border-zinc-800/50 shrink-0 overflow-x-auto scrollbar-thin scrollbar-thumb-zinc-700">
                        <span className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold shrink-0">Task:</span>
                        <button
                            onClick={() => setTaskFilter(null)}
                            className={`shrink-0 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all ${
                                taskFilter === null
                                    ? 'bg-orange-600 text-white border-orange-500 shadow-[0_0_15px_rgba(234,88,12,0.4)]'
                                    : 'bg-zinc-900/60 text-zinc-400 border-zinc-700 hover:text-white hover:border-zinc-500'
                            }`}
                        >
                            All ({photos.length})
                        </button>
                        {taskFilters.map(({ title, count }) => {
                            const active = taskFilter === title;
                            return (
                                <button
                                    key={title}
                                    onClick={() => setTaskFilter(active ? null : title)}
                                    title={title}
                                    className={`shrink-0 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all max-w-[200px] truncate ${
                                        active
                                            ? 'bg-orange-600 text-white border-orange-500 shadow-[0_0_15px_rgba(234,88,12,0.4)]'
                                            : 'bg-zinc-900/60 text-zinc-300 border-zinc-700 hover:text-white hover:border-orange-500/60'
                                    }`}
                                >
                                    {title} <span className="opacity-60">({count})</span>
                                </button>
                            );
                        })}
                        {taskFilter && (
                            <button
                                onClick={() => setTaskFilter(null)}
                                className="shrink-0 ml-auto text-zinc-500 hover:text-orange-400 text-[10px] font-bold uppercase tracking-wider"
                            >
                                ✕ Ryd filter
                            </button>
                        )}
                    </div>
                )}

                {/* Grid */}
                <div className="flex-grow overflow-y-auto p-4 md:p-6 scrollbar-thin scrollbar-thumb-orange-600 scrollbar-track-zinc-900">
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {filteredPhotos.map((photo, idx) => {
                            const isSelected = selectedIds.has(photo.id);
                            const isHidden = hiddenIds.has(photo.id);
                            return (
                                <div
                                    key={photo.id}
                                    className={`aspect-square relative group cursor-pointer rounded-lg overflow-hidden transition-all hover:scale-105 hover:z-10 bg-zinc-900 ${
                                        isHidden ? 'opacity-30 border-2 border-red-500/30' :
                                        selectMode && isSelected
                                            ? 'border-2 border-orange-500 shadow-[0_0_20px_rgba(234,88,12,0.3)]'
                                            : selectMode
                                            ? 'border-2 border-zinc-700/50 opacity-60 hover:opacity-100'
                                            : 'border border-white/10 hover:border-orange-500/50'
                                    }`}
                                    onClick={() => selectMode ? toggleSelect(photo.id) : !isHidden ? enterSlideshow(idx) : undefined}
                                >
                                    {photo.mediaType === 'video' ? (
                                        photo.thumbnailUrl ? (
                                            <img
                                                src={photo.thumbnailUrl}
                                                alt="Video thumbnail"
                                                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-all"
                                                loading="lazy"
                                            />
                                        ) : (
                                            <video
                                                src={photo.url}
                                                muted
                                                playsInline
                                                preload="metadata"
                                                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-all"
                                            />
                                        )
                                    ) : (
                                        <img
                                            src={photo.thumbnailUrl || photo.url}
                                            alt="Thumbnail"
                                            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-all"
                                            loading="lazy"
                                        />
                                    )}
                                    {photo.mediaType === 'video' && (
                                        <div className="absolute bottom-1 right-1 z-10 bg-black/70 text-white text-[10px] font-bold uppercase px-1.5 py-0.5 rounded pointer-events-none">▶ Video</div>
                                    )}
                                    {/* Hide/show toggle — always visible, large click target */}
                                    <div
                                        className="absolute top-0 left-0 z-10 p-1.5"
                                        onClick={e => { e.preventDefault(); e.stopPropagation(); toggleHidden(photo.id); }}
                                        onPointerDown={e => e.stopPropagation()}
                                    >
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold cursor-pointer transition-all ${
                                            isHidden
                                                ? 'bg-red-600 text-white shadow-lg'
                                                : 'bg-black/70 text-zinc-300 hover:bg-red-600 hover:text-white'
                                        }`}>
                                            {isHidden ? '👁' : '✕'}
                                        </div>
                                    </div>
                                    {/* Selection indicator */}
                                    {selectMode && !isHidden && (
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
                                    {/* Hidden overlay */}
                                    {isHidden && (
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                            <span className="text-red-400 text-xs font-bold uppercase tracking-wider">Skjult</span>
                                        </div>
                                    )}
                                    {/* Hover overlay */}
                                    {!isHidden && (
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2 pointer-events-none">
                                            <span className="text-white text-[10px] font-bold uppercase truncate">{photo.teamName || 'Unknown Team'}</span>
                                            {photo.taskTitle && (
                                                <button
                                                    onClick={e => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        const title = (photo.taskTitle || 'Photo').trim();
                                                        setTaskFilter(prev => prev === title ? null : title);
                                                    }}
                                                    title={`Filter by task: ${photo.taskTitle}`}
                                                    className="self-start mt-0.5 max-w-full truncate px-1.5 py-0.5 rounded bg-orange-500/20 hover:bg-orange-500 border border-orange-500/40 hover:border-orange-400 text-orange-300 hover:text-white text-[9px] uppercase font-bold tracking-wider transition-all pointer-events-auto"
                                                >
                                                    {photo.taskTitle}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
                <MusicConfig open={showMusicConfig} onClose={() => setShowMusicConfig(false)} />
                {/* Share message toast */}
                {shareMsg && (
                    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded-full font-bold text-sm uppercase tracking-wider shadow-2xl z-[70] animate-fade-in">
                        {shareMsg}
                    </div>
                )}
            </div>
        );
    }

    // ─── Card-deck slideshow view ─────────────────────────────────
    const currentPhoto = slideshowPhotos[currentIndex];
    if (!currentPhoto) return null;
    const prevIdx = (currentIndex - 1 + slideshowPhotos.length) % slideshowPhotos.length;
    const nextIdx = (currentIndex + 1) % slideshowPhotos.length;
    const prevPhoto = slideshowPhotos.length > 1 && prevIdx !== currentIndex ? slideshowPhotos[prevIdx] : null;
    const nextPhoto = slideshowPhotos.length > 1 && nextIdx !== currentIndex ? slideshowPhotos[nextIdx] : null;

    return (
        <div className="fixed inset-0 z-50 bg-black text-white flex flex-col">
            {/* Header */}
            <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-center z-30 bg-gradient-to-b from-black/80 to-transparent">
                <div className="flex items-center gap-4">
                    {!playbackMode && (
                        <button onClick={() => { setView('grid'); setIsShowtimeMode(false); }} className="text-zinc-400 hover:text-white flex items-center gap-1 uppercase text-xs font-bold tracking-wider">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                            Grid
                        </button>
                    )}
                    <span className="text-xs font-mono text-zinc-400 bg-black/50 px-2 py-1 rounded border border-zinc-700">
                        {currentIndex + 1} / {slideshowPhotos.length}
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsPlaying(!isPlaying)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border transition-all ${isPlaying ? 'bg-orange-500/20 text-orange-400 border-orange-500/50' : 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}
                    >
                        {isPlaying ? '⏸' : '▶'}
                    </button>
                    <button onClick={handleClose} className="w-8 h-8 rounded-full bg-zinc-900/80 hover:bg-red-900/50 hover:text-red-400 border border-zinc-700 flex items-center justify-center transition-colors">✕</button>
                </div>
            </div>

            {/* Card deck area — full screen */}
            <div className="flex-grow relative overflow-hidden" style={{ perspective: '1400px' }}>

                {/* Previous card (left side, blurred, fading out) */}
                {prevPhoto && (
                    <div
                        key={`prev-${prevIdx}`}
                        className="absolute inset-0 flex items-center justify-start pl-[2vw] z-5 pointer-events-none"
                    >
                        <div
                            style={{
                                width: '55vw',
                                maxHeight: '75vh',
                                transform: 'translateX(-20vw) rotateY(6deg) scale(0.75)',
                                transformOrigin: 'right center',
                                opacity: 0.3,
                                filter: 'blur(6px)',
                            }}
                        >
                            {prevPhoto.mediaType === 'video' ? (
                                <video
                                    src={prevPhoto.url}
                                    muted
                                    playsInline
                                    className="w-full h-auto max-h-[75vh] object-contain rounded-xl border-2 border-orange-500/20"
                                />
                            ) : (
                                <img
                                    src={prevPhoto.thumbnailUrl || prevPhoto.url}
                                    alt="Previous"
                                    className="w-full h-auto max-h-[75vh] object-contain rounded-xl border-2 border-orange-500/20"
                                />
                            )}
                        </div>
                    </div>
                )}

                {/* Next card (right side, tilted, blurred) */}
                {nextPhoto && (
                    <div
                        className="absolute inset-0 flex items-center justify-end pr-[2vw] z-10 pointer-events-none"
                    >
                        <div
                            style={{
                                width: '55vw',
                                maxHeight: '75vh',
                                transform: 'translateX(20vw) rotateY(-6deg) scale(0.75)',
                                transformOrigin: 'left center',
                                opacity: 0.3,
                                filter: 'blur(4px)',
                            }}
                        >
                            {nextPhoto.mediaType === 'video' ? (
                                <video
                                    src={nextPhoto.url}
                                    muted
                                    playsInline
                                    className="w-full h-auto max-h-[75vh] object-contain rounded-xl border-2 border-orange-500/20"
                                />
                            ) : (
                                <img
                                    src={nextPhoto.thumbnailUrl || nextPhoto.url}
                                    alt="Next"
                                    className="w-full h-auto max-h-[75vh] object-contain rounded-xl border-2 border-orange-500/20"
                                />
                            )}
                        </div>
                    </div>
                )}

                {/* Current card (center, orange frame tight around photo) */}
                <div
                    key={`card-${currentIndex}-${currentPhoto.id}`}
                    className="absolute inset-0 flex items-center justify-center z-20"
                    style={{
                        animation: 'cardSlideIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                    }}
                >
                    <div className="relative inline-flex flex-col items-center">
                        {/* Orange frame wrapper — hugs the media tightly */}
                        <div className="p-2 bg-orange-500 rounded-2xl shadow-[0_0_80px_rgba(234,88,12,0.4),0_20px_80px_rgba(0,0,0,0.9)] inline-block">
                            {currentPhoto.mediaType === 'video' ? (
                                <video
                                    ref={currentVideoRef}
                                    key={`v-${currentPhoto.id}`}
                                    src={currentPhoto.url}
                                    autoPlay
                                    playsInline
                                    controls={false}
                                    onEnded={advance}
                                    className="block max-h-[78vh] max-w-[85vw] object-contain rounded-xl"
                                />
                            ) : (
                                <img
                                    src={currentPhoto.url}
                                    alt="Game Photo"
                                    className="block max-h-[78vh] max-w-[85vw] object-contain rounded-xl"
                                />
                            )}
                        </div>
                        {/* Caption below frame */}
                        <div className="mt-3 bg-black/80 backdrop-blur-md px-6 py-3 rounded-xl border border-orange-500/30 text-center max-w-[80vw]">
                            {currentPhoto.teamName && (
                                <p className="text-orange-400 font-black text-xl md:text-3xl uppercase tracking-wide leading-none mb-1">{currentPhoto.teamName}</p>
                            )}
                            {currentPhoto.taskTitle && (
                                <p className="text-zinc-300 font-bold text-xs md:text-sm uppercase tracking-wider">{currentPhoto.taskTitle}</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Click zones for manual nav */}
                <div
                    className="absolute left-0 top-0 h-full w-1/3 z-25 cursor-pointer"
                    onClick={() => setCurrentIndex(prev => (prev - 1 + slideshowPhotos.length) % slideshowPhotos.length)}
                />
                <div
                    className="absolute right-0 top-0 h-full w-1/3 z-25 cursor-pointer"
                    onClick={() => setCurrentIndex(prev => (prev + 1) % slideshowPhotos.length)}
                />
            </div>

            {/* Progress Bar */}
            <div className="h-1.5 bg-zinc-900 w-full relative shrink-0">
                <div
                    className={`h-full transition-all duration-500 ${isShowtimeMode ? 'bg-pink-500' : 'bg-orange-500'}`}
                    style={{ width: `${((currentIndex + 1) / slideshowPhotos.length) * 100}%` }}
                />
            </div>

            {/* Music indicator */}
            {music.isPlaying && music.currentTrack && (
                <div className="absolute bottom-6 left-4 flex items-center gap-2 bg-black/60 px-3 py-1.5 rounded-full border border-zinc-700/50 z-30">
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

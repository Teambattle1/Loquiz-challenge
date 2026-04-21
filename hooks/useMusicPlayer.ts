import { useState, useRef, useCallback, useEffect } from 'react';
import { fetchTracks, getTrackUrl, MusicTrack } from '../services/musicService';

const FADE_IN_MS = 4000;  // Smooth fade in when starting
const FADE_MS = 2000;     // Crossfade between tracks
const STOP_FADE_MS = 5000; // Longer fade for manual stop
const CROSSFADE_LEAD = 3; // seconds before end to start crossfade
const MAX_CONSECUTIVE_ERRORS = 3; // bail out of auto-skip cascade after this many

export interface MusicPlayer {
    isPlaying: boolean;
    currentTrack: MusicTrack | null;
    trackIndex: number;
    totalTracks: number;
    volume: number;
    /** True when the browser blocked autoplay and we need a user gesture to resume. */
    needsUserGesture: boolean;
    playPlaylist: (playlistId: string) => Promise<void>;
    /** Resume after a user gesture (click/tap). Retries the track the autoplay policy blocked. */
    resumeAfterGesture: () => Promise<void>;
    stop: () => void;
    setVolume: (v: number) => void;
}

function fadeVolume(audio: HTMLAudioElement, from: number, to: number, ms: number): Promise<void> {
    return new Promise(resolve => {
        const steps = 20;
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
}

export function useMusicPlayer(): MusicPlayer {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTrack, setCurrentTrack] = useState<MusicTrack | null>(null);
    const [trackIndex, setTrackIndex] = useState(0);
    const [volume, setVolumeState] = useState(0.7);
    const [needsUserGesture, setNeedsUserGesture] = useState(false);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const tracksRef = useRef<MusicTrack[]>([]);
    const crossfadeTriggered = useRef(false);
    const stoppedRef = useRef(false);
    // Tracks the currently pending audio.play() promise so we can await it
    // before pausing/cleaning up — prevents the AbortError cascade.
    const playPromiseRef = useRef<Promise<void> | null>(null);
    // Counts consecutive track failures so a bad playlist doesn't spin forever.
    const consecutiveErrorsRef = useRef(0);
    // Remembers where autoplay got blocked so resumeAfterGesture can pick up
    // without refetching tracks.
    const pendingResumeRef = useRef<{ tracks: MusicTrack[]; idx: number } | null>(null);

    const cleanup = useCallback(async () => {
        const audio = audioRef.current;
        if (!audio) return;
        // Wait for any in-flight play() to settle before calling pause(), or
        // the browser throws AbortError and the catch fires spurious onerror.
        if (playPromiseRef.current) {
            try { await playPromiseRef.current; } catch { /* ignored */ }
        }
        try { audio.pause(); } catch { /* ignored */ }
        audio.src = '';
        audio.onerror = null;
        audio.onended = null;
        audio.ontimeupdate = null;
        audioRef.current = null;
        playPromiseRef.current = null;
    }, []);

    const playTrack = useCallback(async (tracks: MusicTrack[], idx: number, vol: number) => {
        if (idx >= tracks.length || stoppedRef.current) return;
        if (consecutiveErrorsRef.current >= MAX_CONSECUTIVE_ERRORS) {
            console.warn(`[useMusicPlayer] Giving up after ${MAX_CONSECUTIVE_ERRORS} consecutive errors.`);
            setIsPlaying(false);
            return;
        }

        await cleanup();
        if (stoppedRef.current) return;
        crossfadeTriggered.current = false;

        const track = tracks[idx];
        const url = getTrackUrl(track.file_path);
        const audio = new Audio(url);
        // `crossOrigin = 'anonymous'` would force CORS on every segment which
        // blocks public Supabase Storage audio. Leave it unset — we're only
        // playing, not reading samples, so CORS headers aren't required.
        audio.preload = 'auto';
        audio.volume = 0;
        audioRef.current = audio;

        setCurrentTrack(track);
        setTrackIndex(idx);
        setIsPlaying(true);

        // Crossfade detection
        audio.ontimeupdate = () => {
            if (!audio.duration || crossfadeTriggered.current) return;
            const remaining = audio.duration - audio.currentTime;
            if (remaining <= CROSSFADE_LEAD && remaining > 0) {
                crossfadeTriggered.current = true;
                // Fade out current, start next
                fadeVolume(audio, audio.volume, 0, FADE_MS).then(() => {
                    try { audio.pause(); } catch { /* ignored */ }
                });
                const nextIdx = (idx + 1) % tracks.length;
                playTrack(tracks, nextIdx, vol);
            }
        };

        // Fallback: if track ends without crossfade
        audio.onended = () => {
            if (!crossfadeTriggered.current && !stoppedRef.current) {
                consecutiveErrorsRef.current = 0; // track played to the end = healthy
                const nextIdx = (idx + 1) % tracks.length;
                playTrack(tracks, nextIdx, vol);
            }
        };

        audio.onerror = () => {
            // If cleanup is what caused this (src = '' fires an error), ignore.
            if (audioRef.current !== audio || stoppedRef.current) return;
            console.warn('Audio playback error for:', track.title, audio.error?.code);
            consecutiveErrorsRef.current++;
            const nextIdx = (idx + 1) % tracks.length;
            setTimeout(() => playTrack(tracks, nextIdx, vol), 500);
        };

        try {
            const p = audio.play();
            playPromiseRef.current = p;
            await p;
            playPromiseRef.current = null;
            consecutiveErrorsRef.current = 0;   // success = reset counter
            setNeedsUserGesture(false);         // we played, no gesture needed
            fadeVolume(audio, 0, vol, FADE_IN_MS);
        } catch (e) {
            playPromiseRef.current = null;
            // AbortError: another pause/load interrupted this play. Not fatal
            // — the newer playTrack call owns the state now. Swallow silently.
            if (e instanceof DOMException && e.name === 'AbortError') {
                return;
            }
            // NotAllowedError: browser autoplay policy blocked us. Don't
            // cascade through the playlist — stop and remember where we were
            // so resumeAfterGesture() can pick up after the user clicks.
            if (e instanceof DOMException && e.name === 'NotAllowedError') {
                console.warn('[useMusicPlayer] Autoplay blocked — waiting for user gesture.');
                pendingResumeRef.current = { tracks, idx };
                setNeedsUserGesture(true);
                setIsPlaying(false);
                // Prevent the audio element's own error handler from firing
                // a cascade of skip-to-next.
                if (audioRef.current === audio) audio.onerror = null;
                return;
            }
            console.warn('Failed to play track:', e);
        }
    }, [cleanup]);

    const playPlaylist = useCallback(async (playlistId: string) => {
        stoppedRef.current = false;
        consecutiveErrorsRef.current = 0;
        pendingResumeRef.current = null;
        const tracks = await fetchTracks(playlistId);
        if (tracks.length === 0) return;
        tracksRef.current = tracks;
        playTrack(tracks, 0, volume);
    }, [playTrack, volume]);

    const resumeAfterGesture = useCallback(async () => {
        const pending = pendingResumeRef.current;
        if (!pending) return;
        pendingResumeRef.current = null;
        consecutiveErrorsRef.current = 0;
        setNeedsUserGesture(false);
        await playTrack(pending.tracks, pending.idx, volume);
    }, [playTrack, volume]);

    const stop = useCallback(() => {
        stoppedRef.current = true;
        pendingResumeRef.current = null;
        setNeedsUserGesture(false);
        const audio = audioRef.current;
        if (audio) {
            fadeVolume(audio, audio.volume, 0, STOP_FADE_MS).then(async () => {
                // Wait for any in-flight play() before pausing to avoid AbortError.
                if (playPromiseRef.current) {
                    try { await playPromiseRef.current; } catch { /* ignored */ }
                }
                try { audio.pause(); } catch { /* ignored */ }
                audio.src = '';
                if (audioRef.current === audio) audioRef.current = null;
                playPromiseRef.current = null;
            });
        }
        // Delay state update so UI shows "stopping" briefly
        setTimeout(() => {
            setIsPlaying(false);
            setCurrentTrack(null);
        }, STOP_FADE_MS);
    }, []);

    const setVolume = useCallback((v: number) => {
        const clamped = Math.max(0, Math.min(1, v));
        setVolumeState(clamped);
        if (audioRef.current) audioRef.current.volume = clamped;
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stoppedRef.current = true;
            cleanup();
        };
    }, [cleanup]);

    return {
        isPlaying,
        currentTrack,
        trackIndex,
        totalTracks: tracksRef.current.length,
        volume,
        needsUserGesture,
        playPlaylist,
        resumeAfterGesture,
        stop,
        setVolume,
    };
}

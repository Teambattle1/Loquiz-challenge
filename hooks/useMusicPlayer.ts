import { useState, useRef, useCallback, useEffect } from 'react';
import { fetchTracks, getTrackUrl, MusicTrack } from '../services/musicService';

const FADE_MS = 2000;
const CROSSFADE_LEAD = 3; // seconds before end to start crossfade

export interface MusicPlayer {
    isPlaying: boolean;
    currentTrack: MusicTrack | null;
    trackIndex: number;
    totalTracks: number;
    volume: number;
    playPlaylist: (playlistId: string) => Promise<void>;
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

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const tracksRef = useRef<MusicTrack[]>([]);
    const crossfadeTriggered = useRef(false);
    const stoppedRef = useRef(false);

    const cleanup = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = '';
            audioRef.current = null;
        }
    }, []);

    const playTrack = useCallback(async (tracks: MusicTrack[], idx: number, vol: number) => {
        if (idx >= tracks.length || stoppedRef.current) return;

        cleanup();
        crossfadeTriggered.current = false;

        const track = tracks[idx];
        const url = getTrackUrl(track.file_path);
        const audio = new Audio(url);
        audio.crossOrigin = 'anonymous';
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
                    audio.pause();
                });
                const nextIdx = (idx + 1) % tracks.length;
                playTrack(tracks, nextIdx, vol);
            }
        };

        // Fallback: if track ends without crossfade
        audio.onended = () => {
            if (!crossfadeTriggered.current && !stoppedRef.current) {
                const nextIdx = (idx + 1) % tracks.length;
                playTrack(tracks, nextIdx, vol);
            }
        };

        audio.onerror = () => {
            console.warn('Audio playback error for:', track.title);
            // Skip to next track
            if (!stoppedRef.current) {
                const nextIdx = (idx + 1) % tracks.length;
                setTimeout(() => playTrack(tracks, nextIdx, vol), 500);
            }
        };

        try {
            await audio.play();
            fadeVolume(audio, 0, vol, FADE_MS);
        } catch (e) {
            console.warn('Failed to play track:', e);
        }
    }, [cleanup]);

    const playPlaylist = useCallback(async (playlistId: string) => {
        stoppedRef.current = false;
        const tracks = await fetchTracks(playlistId);
        if (tracks.length === 0) return;
        tracksRef.current = tracks;
        playTrack(tracks, 0, volume);
    }, [playTrack, volume]);

    const stop = useCallback(() => {
        stoppedRef.current = true;
        const audio = audioRef.current;
        if (audio) {
            fadeVolume(audio, audio.volume, 0, FADE_MS).then(() => {
                audio.pause();
                audio.src = '';
                audioRef.current = null;
            });
        }
        setIsPlaying(false);
        setCurrentTrack(null);
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
        playPlaylist,
        stop,
        setVolume,
    };
}

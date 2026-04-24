import { createClient } from '@supabase/supabase-js';

// Connect to Play project's Supabase (read-only for music)
const PLAY_SUPABASE_URL = 'https://infnlcqdwycjfssymeic.supabase.co';
const PLAY_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImluZm5sY3Fkd3ljamZzc3ltZWljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxNDYzMzUsImV4cCI6MjA3MTcyMjMzNX0.Mo4wpqV5Ax-TqOwMpNXM4NqiHv7fC0TLM3wBKAPj15Q';
const MUSIC_BUCKET = 'music';

const supabase = createClient(PLAY_SUPABASE_URL, PLAY_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

export interface MusicPlaylist {
    id: string;
    name: string;
    created_at?: string;
}

export interface MusicTrack {
    id: string;
    playlist_id: string;
    title: string;
    file_path: string;
    artwork_url?: string | null;
    sort_order: number;
}

export const fetchPlaylists = async (): Promise<MusicPlaylist[]> => {
    const { data, error } = await supabase
        .from('music_playlists')
        .select('id, name, created_at')
        .order('name');
    if (error) {
        console.warn('Failed to fetch playlists:', error.message);
        return [];
    }
    return data || [];
};

// Resolve a playlist by name — case-insensitive exact match. Used by the
// public Showtime link to fall back to a default playlist ("TeamPlay" under
// music.eventday.dk) when admin hasn't assigned one yet, so the customer-
// facing slideshow always has music.
export const fetchPlaylistByName = async (name: string): Promise<MusicPlaylist | null> => {
    const { data, error } = await supabase
        .from('music_playlists')
        .select('id, name, created_at')
        .ilike('name', name)
        .limit(1)
        .maybeSingle();
    if (error) {
        console.warn('Failed to fetch playlist by name:', error.message);
        return null;
    }
    return data || null;
};

export const fetchTracks = async (playlistId: string): Promise<MusicTrack[]> => {
    const { data, error } = await supabase
        .from('music_tracks')
        .select('id, playlist_id, title, file_path, artwork_url, sort_order')
        .eq('playlist_id', playlistId)
        .order('sort_order');
    if (error) {
        console.warn('Failed to fetch tracks:', error.message);
        return [];
    }
    return data || [];
};

export const getTrackUrl = (filePath: string): string => {
    const { data } = supabase.storage.from(MUSIC_BUCKET).getPublicUrl(filePath);
    return data.publicUrl;
};

// localStorage helpers for playlist assignment
const SHOWTIME_PLAYLIST_KEY = 'loquiz_music_showtime_playlist';
const RESULTS_PLAYLIST_KEY = 'loquiz_music_results_playlist';

export const getShowtimePlaylistId = (): string | null => localStorage.getItem(SHOWTIME_PLAYLIST_KEY);
export const setShowtimePlaylistId = (id: string) => localStorage.setItem(SHOWTIME_PLAYLIST_KEY, id);

export const getResultsPlaylistId = (): string | null => localStorage.getItem(RESULTS_PLAYLIST_KEY);
export const setResultsPlaylistId = (id: string) => localStorage.setItem(RESULTS_PLAYLIST_KEY, id);

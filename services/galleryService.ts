import { supabase } from '../lib/supabase';
import { GamePhoto, PlayerResult } from '../types';

export interface ShareSections {
    gallery: boolean;
    ranking: boolean;
    tasks: boolean;
    answers: boolean;
    teams: boolean; // when true, public client page exposes per-team share links
}

export const DEFAULT_SECTIONS: ShareSections = {
    gallery: true,
    ranking: true,
    tasks: false,
    answers: false,
    teams: true,
};

// Encode the selected sections into a short URL token (e.g. "tasks,photos,ranking")
export const encodeShowParam = (sections: ShareSections): string => {
    const parts: string[] = [];
    if (sections.tasks) parts.push('tasks');
    if (sections.gallery) parts.push('photos');
    if (sections.ranking) parts.push('ranking');
    if (sections.answers) parts.push('answers');
    if (sections.teams) parts.push('teams');
    return parts.join(',');
};

// Decode a ?show= URL token back into a ShareSections object
export const decodeShowParam = (show: string | null): ShareSections | null => {
    if (!show) return null;
    const parts = new Set(show.split(',').map(s => s.trim().toLowerCase()).filter(Boolean));
    return {
        gallery: parts.has('photos') || parts.has('gallery') || parts.has('media'),
        ranking: parts.has('ranking'),
        tasks: parts.has('tasks'),
        answers: parts.has('answers'),
        teams: parts.has('teams'),
    };
};

export interface SharedGallery {
    id: string;
    game_id: string;
    game_name: string | null;
    photos: GamePhoto[];
    hidden_ids: string[];
    hidden_team_ids?: string[];
    selected_photo_ids?: string[];
    sections?: ShareSections;
    results?: PlayerResult[];
    // Playlist admin valgte til Showtime — persisteres så kundens public link
    // kan afspille musikken (kunden har ikke adminens localStorage).
    showtime_playlist_id?: string | null;
    created_at: string;
}

// Save/update gallery to Supabase (upsert by game_id)
export const saveGallery = async (
    gameId: string,
    gameName: string | null,
    photos: GamePhoto[],
    hiddenIds: string[],
    extras?: { sections?: ShareSections; results?: PlayerResult[]; hiddenTeamIds?: string[]; selectedPhotoIds?: string[]; showtimePlaylistId?: string | null }
): Promise<void> => {
    const payload: any = {
        game_id: gameId,
        game_name: gameName,
        photos: photos,
        hidden_ids: hiddenIds,
        updated_at: new Date().toISOString(),
    };
    if (extras?.sections) payload.sections = extras.sections;
    if (extras?.results) payload.results = extras.results;
    if (extras?.hiddenTeamIds) payload.hidden_team_ids = extras.hiddenTeamIds;
    if (extras?.selectedPhotoIds) payload.selected_photo_ids = extras.selectedPhotoIds;
    if (extras?.showtimePlaylistId !== undefined) payload.showtime_playlist_id = extras.showtimePlaylistId;
    const { error } = await supabase
        .from('shared_galleries')
        .upsert(payload, { onConflict: 'game_id' });
    if (error) console.warn('Failed to save gallery:', error.message);
};

// Persist only the Showtime selection (lightweight update — keeps photos/results intact)
export const updateShowtimeSelection = async (
    gameId: string,
    selectedPhotoIds: string[],
    hiddenIds?: string[],
    showtimePlaylistId?: string | null,
): Promise<void> => {
    const payload: any = {
        selected_photo_ids: selectedPhotoIds,
        updated_at: new Date().toISOString(),
    };
    if (hiddenIds) payload.hidden_ids = hiddenIds;
    // Persister playlist-valget så kundens public link kan afspille musikken
    // uden at admin skal re-kopiere linket hver gang de vælger ny playlist.
    if (showtimePlaylistId !== undefined) payload.showtime_playlist_id = showtimePlaylistId;
    const { error } = await supabase
        .from('shared_galleries')
        .update(payload)
        .eq('game_id', gameId);
    if (error) console.warn('Failed to update showtime selection:', error.message);
};

// Update only the section visibility config
export const updateSections = async (gameId: string, sections: ShareSections): Promise<void> => {
    const { error } = await supabase
        .from('shared_galleries')
        .update({ sections, updated_at: new Date().toISOString() })
        .eq('game_id', gameId);
    if (error) console.warn('Failed to update sections:', error.message);
};

// Fetch gallery by game_id (public, no auth needed)
export const fetchGallery = async (gameId: string): Promise<SharedGallery | null> => {
    const { data, error } = await supabase
        .from('shared_galleries')
        .select('*')
        .eq('game_id', gameId)
        .maybeSingle();
    if (error || !data) return null;
    return data as SharedGallery;
};

// Update hidden IDs only
export const updateHiddenIds = async (gameId: string, hiddenIds: string[]): Promise<void> => {
    const { error } = await supabase
        .from('shared_galleries')
        .update({ hidden_ids: hiddenIds, updated_at: new Date().toISOString() })
        .eq('game_id', gameId);
    if (error) console.warn('Failed to update hidden IDs:', error.message);
};

// Get gallery share URL (legacy — photos only)
export const getGalleryShareUrl = (gameId: string): string => {
    return `${window.location.origin}?gallery=${gameId}`;
};

// Direct showtime link — customer lands on slideshow (selected photos) and
// is handed straight into the ResultsReveal podium flow afterwards.
export const getShowtimeShareUrl = (gameId: string): string => {
    return `${window.location.origin}?showtime=${gameId}`;
};

// Build a client share URL pointing to a specific section, optionally pre-selecting a team
export const getClientSectionUrl = (
    gameId: string,
    section?: 'gallery' | 'ranking' | 'tasks' | 'answers',
    teamId?: string,
    sections?: ShareSections,
): string => {
    const params = new URLSearchParams();
    params.set('client', gameId);
    if (section) params.set('section', section);
    if (teamId) params.set('team', teamId);
    if (sections) {
        const show = encodeShowParam(sections);
        if (show) params.set('show', show);
    }
    return `${window.location.origin}?${params.toString()}`;
};

// Master client link that encodes selected sections directly in the URL
export const getClientShareUrlWithSections = (gameId: string, sections: ShareSections): string => {
    const params = new URLSearchParams();
    params.set('client', gameId);
    const show = encodeShowParam(sections);
    if (show) params.set('show', show);
    return `${window.location.origin}?${params.toString()}`;
};

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
    teams: false,
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
    sections?: ShareSections;
    results?: PlayerResult[];
    created_at: string;
}

// Save/update gallery to Supabase (upsert by game_id)
export const saveGallery = async (
    gameId: string,
    gameName: string | null,
    photos: GamePhoto[],
    hiddenIds: string[],
    extras?: { sections?: ShareSections; results?: PlayerResult[]; hiddenTeamIds?: string[] }
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
    const { error } = await supabase
        .from('shared_galleries')
        .upsert(payload, { onConflict: 'game_id' });
    if (error) console.warn('Failed to save gallery:', error.message);
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

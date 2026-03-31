import { createClient } from '@supabase/supabase-js';
import { GamePhoto } from '../types';

const SUPABASE_URL = 'https://yktaxljydisfjyqhbnja.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrdGF4bGp5ZGlzZmp5cWhibmphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxMzQ2ODYsImV4cCI6MjA4MTcxMDY4Nn0.XeTW4vHGbEm6C7U94zMLsZiDB80cyvuqYbSRNX8oyQI';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export interface SharedGallery {
    id: string;
    game_id: string;
    game_name: string | null;
    photos: GamePhoto[];
    hidden_ids: string[];
    created_at: string;
}

// Save/update gallery to Supabase (upsert by game_id)
export const saveGallery = async (
    gameId: string,
    gameName: string | null,
    photos: GamePhoto[],
    hiddenIds: string[]
): Promise<void> => {
    const { error } = await supabase
        .from('shared_galleries')
        .upsert({
            game_id: gameId,
            game_name: gameName,
            photos: photos,
            hidden_ids: hiddenIds,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'game_id' });
    if (error) console.warn('Failed to save gallery:', error.message);
};

// Fetch gallery by game_id (public, no auth needed)
export const fetchGallery = async (gameId: string): Promise<SharedGallery | null> => {
    const { data, error } = await supabase
        .from('shared_galleries')
        .select('*')
        .eq('game_id', gameId)
        .single();
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

// Get gallery share URL
export const getGalleryShareUrl = (gameId: string): string => {
    return `${window.location.origin}?gallery=${gameId}`;
};

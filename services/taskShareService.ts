import { supabase } from '../lib/supabase';

export interface SharedTaskData {
    id: string;
    title: string;
    shortIntro?: string;
    taskTxt?: string;
    type?: string;
}

export interface SharedTasks {
    id: string;
    game_id: string;
    game_name: string | null;
    tasks: SharedTaskData[];
    visible_task_ids: string[];
    created_at: string;
}

export const saveSharedTasks = async (
    gameId: string,
    gameName: string | null,
    tasks: SharedTaskData[],
    visibleIds: string[]
): Promise<void> => {
    const { error } = await supabase
        .from('shared_tasks')
        .upsert({
            game_id: gameId,
            game_name: gameName,
            tasks,
            visible_task_ids: visibleIds,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'game_id' });
    if (error) console.warn('Failed to save shared tasks:', error.message);
};

export const fetchSharedTasks = async (gameId: string): Promise<SharedTasks | null> => {
    const { data, error } = await supabase
        .from('shared_tasks')
        .select('*')
        .eq('game_id', gameId)
        .maybeSingle();
    if (error || !data) return null;
    return data as SharedTasks;
};

export const updateVisibleTaskIds = async (gameId: string, visibleIds: string[]): Promise<void> => {
    const { error } = await supabase
        .from('shared_tasks')
        .update({ visible_task_ids: visibleIds, updated_at: new Date().toISOString() })
        .eq('game_id', gameId);
    if (error) console.warn('Failed to update visible task IDs:', error.message);
};

export const getClientShareUrl = (gameId: string): string => {
    return `${window.location.origin}?client=${gameId}`;
};

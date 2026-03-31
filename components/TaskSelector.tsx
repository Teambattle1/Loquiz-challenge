import React, { useState, useEffect } from 'react';
import { GameTask } from '../types';
import { saveSharedTasks, fetchSharedTasks, getClientShareUrl, SharedTaskData } from '../services/taskShareService';

interface TaskSelectorProps {
    tasks: GameTask[];
    gameId: string;
    gameName: string | null;
}

const stripHtml = (html: string): string => {
    return html.replace(/<\/[^>]+>/g, ' ').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
};

const extractText = (val: any): string => {
    if (!val) return '';
    if (typeof val === 'string') return stripHtml(val);
    if (typeof val === 'object') {
        if (val.text) return extractText(val.text);
        if (Array.isArray(val.content)) return val.content.map((c: any) => extractText(c)).filter(Boolean).join(' ');
        if (val.title) return extractText(val.title);
    }
    return '';
};

const getTaskTxt = (task: GameTask): string => {
    const raw = task.raw;
    if (!raw) return '';
    // Try multiple common Loquiz task text fields
    return extractText(raw.taskTxt) || extractText(raw.content) || extractText(raw.intro) || extractText(raw.text) || extractText(raw.question) || '';
};

const getShortIntro = (task: GameTask): string => {
    const raw = task.raw;
    if (!raw) return task.shortIntro || '';
    return extractText(raw.shortIntro) || extractText(raw.short_intro) || extractText(raw.comments?.shortIntro) || task.shortIntro || '';
};

const TaskSelector: React.FC<TaskSelectorProps> = ({ tasks, gameId, gameName }) => {
    const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);
    const [loaded, setLoaded] = useState(false);

    // Load existing selection from Supabase
    useEffect(() => {
        fetchSharedTasks(gameId).then(data => {
            if (data && data.visible_task_ids.length > 0) {
                setVisibleIds(new Set(data.visible_task_ids));
            }
            setLoaded(true);
        });
    }, [gameId]);

    const toggleTask = (taskId: string) => {
        setVisibleIds(prev => {
            const next = new Set(prev);
            if (next.has(taskId)) next.delete(taskId); else next.add(taskId);
            return next;
        });
    };

    const selectAll = () => setVisibleIds(new Set(tasks.map(t => t.id)));
    const selectNone = () => setVisibleIds(new Set());

    const handleSave = async () => {
        setSaving(true);
        const taskData: SharedTaskData[] = tasks.map(t => ({
            id: t.id,
            title: t.title,
            shortIntro: getShortIntro(t),
            taskTxt: getTaskTxt(t),
            type: t.type,
        }));
        await saveSharedTasks(gameId, gameName, taskData, Array.from(visibleIds));
        setSaving(false);
    };

    const handleCopyLink = async () => {
        // Auto-save before copying
        await handleSave();
        const url = getClientShareUrl(gameId);
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!loaded) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between gap-4 shrink-0">
                <div>
                    <h2 className="text-xl font-black text-white uppercase tracking-wider">Client Tasks</h2>
                    <p className="text-zinc-500 text-xs mt-1">
                        {visibleIds.size} af {tasks.length} tasks synlige for kunden
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={visibleIds.size === tasks.length ? selectNone : selectAll}
                        className="px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider bg-zinc-800 text-zinc-400 border border-zinc-700 hover:text-white hover:border-zinc-500 transition-all"
                    >
                        {visibleIds.size === tasks.length ? 'Fravælg alle' : 'Vælg alle'}
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider bg-orange-600 text-white border border-orange-500 hover:bg-orange-500 transition-all disabled:opacity-50"
                    >
                        {saving ? 'Gemmer...' : 'Gem'}
                    </button>
                    <button
                        onClick={handleCopyLink}
                        className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider bg-zinc-800 text-orange-400 border border-orange-500/30 hover:bg-orange-600 hover:text-white transition-all"
                    >
                        {copied ? 'Kopieret!' : 'Del link'}
                    </button>
                </div>
            </div>

            {/* Task list */}
            <div className="flex-grow overflow-y-auto p-6 space-y-3">
                {tasks.map(task => {
                    const isVisible = visibleIds.has(task.id);
                    const shortIntro = getShortIntro(task);
                    const taskTxt = getTaskTxt(task);

                    return (
                        <div
                            key={task.id}
                            onClick={() => toggleTask(task.id)}
                            className={`p-4 rounded-xl border cursor-pointer transition-all ${
                                isVisible
                                    ? 'bg-orange-600/10 border-orange-500/40 shadow-[0_0_15px_rgba(234,88,12,0.1)]'
                                    : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-600'
                            }`}
                        >
                            <div className="flex items-start gap-3">
                                {/* Checkbox */}
                                <div className={`mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                                    isVisible ? 'bg-orange-500 text-white' : 'bg-zinc-800 border border-zinc-600 text-zinc-500'
                                }`}>
                                    {isVisible && (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                    )}
                                </div>

                                <div className="min-w-0 flex-grow">
                                    {/* Title */}
                                    <h3 className={`font-bold text-sm uppercase tracking-wide ${isVisible ? 'text-orange-400' : 'text-white'}`}>
                                        {task.title}
                                    </h3>

                                    {/* Short intro */}
                                    {shortIntro && (
                                        <p className="text-zinc-400 text-xs mt-1 line-clamp-2">{shortIntro}</p>
                                    )}

                                    {/* Task text */}
                                    {taskTxt && (
                                        <p className="text-zinc-500 text-xs mt-2 line-clamp-3 leading-relaxed">{taskTxt}</p>
                                    )}

                                    {/* Meta */}
                                    <div className="flex items-center gap-3 mt-2">
                                        <span className="text-zinc-600 text-[10px] font-mono uppercase">{task.type}</span>
                                        <span className="text-zinc-700 text-[10px] font-mono">ID: {task.id}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {tasks.length === 0 && (
                    <div className="text-zinc-500 text-center py-12 uppercase tracking-widest text-sm">
                        Ingen tasks fundet
                    </div>
                )}
            </div>
        </div>
    );
};

export default TaskSelector;

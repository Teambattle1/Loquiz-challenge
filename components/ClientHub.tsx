import React, { useState, useEffect, useMemo } from 'react';
import { GameTask, GamePhoto } from '../types';
import { saveSharedTasks, fetchSharedTasks, getClientShareUrl, SharedTaskData } from '../services/taskShareService';
import { saveGallery, fetchGallery, getGalleryShareUrl } from '../services/galleryService';

type TabType = 'tasks' | 'photos' | 'share';

interface ClientHubProps {
    tasks: GameTask[];
    photos: GamePhoto[];
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
    return extractText(raw.taskTxt) || extractText(raw.content) || extractText(raw.intro) || extractText(raw.text) || extractText(raw.question) || '';
};

const getShortIntro = (task: GameTask): string => {
    const raw = task.raw;
    if (!raw) return task.shortIntro || '';
    return extractText(raw.shortIntro) || extractText(raw.short_intro) || extractText(raw.comments?.shortIntro) || task.shortIntro || '';
};

const ClientHub: React.FC<ClientHubProps> = ({ tasks, photos, gameId, gameName }) => {
    const [tab, setTab] = useState<TabType>('tasks');

    // Task state
    const [visibleTaskIds, setVisibleTaskIds] = useState<Set<string>>(new Set());
    const [taskSaving, setTaskSaving] = useState(false);

    // Photo state
    const [hiddenPhotoIds, setHiddenPhotoIds] = useState<Set<string>>(new Set());
    const [photoSaving, setPhotoSaving] = useState(false);

    // Share state
    const [copied, setCopied] = useState<string | null>(null);

    const [loaded, setLoaded] = useState(false);

    // Load existing selections from Supabase
    useEffect(() => {
        Promise.all([
            fetchSharedTasks(gameId),
            fetchGallery(gameId),
        ]).then(([tasksData, galleryData]) => {
            if (tasksData && tasksData.visible_task_ids.length > 0) {
                setVisibleTaskIds(new Set(tasksData.visible_task_ids));
            }
            if (galleryData && galleryData.hidden_ids.length > 0) {
                setHiddenPhotoIds(new Set(galleryData.hidden_ids));
            }
            setLoaded(true);
        });
    }, [gameId]);

    // --- Task actions ---
    const toggleTask = (id: string) => {
        setVisibleTaskIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };
    const selectAllTasks = () => setVisibleTaskIds(new Set(tasks.map(t => t.id)));
    const selectNoTasks = () => setVisibleTaskIds(new Set());

    const saveTasks = async () => {
        setTaskSaving(true);
        const taskData: SharedTaskData[] = tasks.map(t => ({
            id: t.id,
            title: t.title,
            shortIntro: getShortIntro(t),
            taskTxt: getTaskTxt(t),
            type: t.type,
        }));
        await saveSharedTasks(gameId, gameName, taskData, Array.from(visibleTaskIds));
        setTaskSaving(false);
    };

    // --- Photo actions ---
    const togglePhoto = (id: string) => {
        setHiddenPhotoIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };
    const showAllPhotos = () => setHiddenPhotoIds(new Set());
    const hideAllPhotos = () => setHiddenPhotoIds(new Set(photos.map(p => p.id)));

    const visiblePhotos = useMemo(() => photos.filter(p => !hiddenPhotoIds.has(p.id)), [photos, hiddenPhotoIds]);

    const savePhotos = async () => {
        setPhotoSaving(true);
        await saveGallery(gameId, gameName, photos, Array.from(hiddenPhotoIds));
        setPhotoSaving(false);
    };

    // --- Share actions ---
    const copyLink = async (type: 'client' | 'gallery') => {
        // Auto-save both before sharing
        await Promise.all([saveTasks(), savePhotos()]);
        const url = type === 'client' ? getClientShareUrl(gameId) : getGalleryShareUrl(gameId);
        await navigator.clipboard.writeText(url);
        setCopied(type);
        setTimeout(() => setCopied(null), 2500);
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
            {/* Header with tabs */}
            <div className="px-6 py-4 border-b border-zinc-800 shrink-0">
                <div className="flex items-center justify-between gap-4 mb-3">
                    <h2 className="text-xl font-black text-white uppercase tracking-wider">Client Hub</h2>
                    <div className="flex items-center gap-2">
                        {tab === 'tasks' && (
                            <>
                                <button onClick={visibleTaskIds.size === tasks.length ? selectNoTasks : selectAllTasks}
                                    className="px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider bg-zinc-800 text-zinc-400 border border-zinc-700 hover:text-white hover:border-zinc-500 transition-all">
                                    {visibleTaskIds.size === tasks.length ? 'Fravælg alle' : 'Vælg alle'}
                                </button>
                                <button onClick={saveTasks} disabled={taskSaving}
                                    className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider bg-orange-600 text-white border border-orange-500 hover:bg-orange-500 transition-all disabled:opacity-50">
                                    {taskSaving ? 'Gemmer...' : 'Gem tasks'}
                                </button>
                            </>
                        )}
                        {tab === 'photos' && (
                            <>
                                <button onClick={hiddenPhotoIds.size === 0 ? hideAllPhotos : showAllPhotos}
                                    className="px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider bg-zinc-800 text-zinc-400 border border-zinc-700 hover:text-white hover:border-zinc-500 transition-all">
                                    {hiddenPhotoIds.size === 0 ? 'Skjul alle' : 'Vis alle'}
                                </button>
                                <button onClick={savePhotos} disabled={photoSaving}
                                    className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider bg-orange-600 text-white border border-orange-500 hover:bg-orange-500 transition-all disabled:opacity-50">
                                    {photoSaving ? 'Gemmer...' : 'Gem billeder'}
                                </button>
                            </>
                        )}
                    </div>
                </div>
                <div className="flex gap-1 bg-zinc-900 rounded-lg p-1">
                    {([
                        { id: 'tasks' as const, label: 'Tasks', count: `${visibleTaskIds.size}/${tasks.length}` },
                        { id: 'photos' as const, label: 'Billeder', count: `${visiblePhotos.length}/${photos.length}` },
                        { id: 'share' as const, label: 'Del link', count: null },
                    ]).map(t => (
                        <button key={t.id} onClick={() => setTab(t.id)}
                            className={`flex-1 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                                tab === t.id
                                    ? 'bg-orange-600 text-white shadow-lg'
                                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                            }`}>
                            {t.label} {t.count && <span className="ml-1 opacity-70">({t.count})</span>}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab content */}
            <div className="flex-grow overflow-y-auto">
                {/* === TASKS TAB === */}
                {tab === 'tasks' && (
                    <div className="p-6 space-y-3">
                        {tasks.map(task => {
                            const isVisible = visibleTaskIds.has(task.id);
                            const shortIntro = getShortIntro(task);
                            const taskTxt = getTaskTxt(task);
                            return (
                                <div key={task.id} onClick={() => toggleTask(task.id)}
                                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                                        isVisible
                                            ? 'bg-orange-600/10 border-orange-500/40 shadow-[0_0_15px_rgba(234,88,12,0.1)]'
                                            : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-600'
                                    }`}>
                                    <div className="flex items-start gap-3">
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
                                            <h3 className={`font-bold text-sm uppercase tracking-wide ${isVisible ? 'text-orange-400' : 'text-white'}`}>
                                                {task.title}
                                            </h3>
                                            {shortIntro && <p className="text-zinc-400 text-xs mt-1 line-clamp-2">{shortIntro}</p>}
                                            {taskTxt && <p className="text-zinc-500 text-xs mt-2 line-clamp-3 leading-relaxed">{taskTxt}</p>}
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
                            <div className="text-zinc-500 text-center py-12 uppercase tracking-widest text-sm">Ingen tasks fundet</div>
                        )}
                    </div>
                )}

                {/* === PHOTOS TAB === */}
                {tab === 'photos' && (
                    <div className="p-6">
                        <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-3">
                            {photos.map(photo => {
                                const isHidden = hiddenPhotoIds.has(photo.id);
                                return (
                                    <div key={photo.id} onClick={() => togglePhoto(photo.id)}
                                        className={`relative rounded-xl overflow-hidden cursor-pointer transition-all group ${
                                            isHidden ? 'opacity-30 scale-95' : 'hover:scale-[1.02]'
                                        }`}>
                                        <div className="aspect-square">
                                            <img src={photo.thumbnailUrl || photo.url} alt={photo.teamName || 'Photo'}
                                                className="w-full h-full object-cover" loading="lazy" />
                                        </div>
                                        {/* Visibility indicator */}
                                        <div className={`absolute top-1.5 right-1.5 w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold transition-all ${
                                            isHidden
                                                ? 'bg-red-600 text-white'
                                                : 'bg-green-600 text-white'
                                        }`}>
                                            {isHidden ? (
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                                                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                                </svg>
                                            ) : (
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                                                    <polyline points="20 6 9 17 4 12" />
                                                </svg>
                                            )}
                                        </div>
                                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5">
                                            <p className="text-white text-[10px] font-bold uppercase truncate">{photo.teamName}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {photos.length === 0 && (
                            <div className="text-zinc-500 text-center py-12 uppercase tracking-widest text-sm">Ingen billeder fundet</div>
                        )}
                    </div>
                )}

                {/* === SHARE TAB === */}
                {tab === 'share' && (
                    <div className="p-6 flex flex-col items-center justify-center gap-6 min-h-[50vh]">
                        <p className="text-zinc-400 text-sm text-center max-w-md">
                            Del links til kundens public side. Tasks og billeder gemmes automatisk inden link kopieres.
                        </p>

                        {/* Client link (tasks + photos) */}
                        <button onClick={() => copyLink('client')}
                            className="w-full max-w-md p-5 rounded-2xl bg-orange-600/10 border border-orange-500/40 hover:bg-orange-600/20 hover:border-orange-500/60 transition-all text-left group">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-white font-black uppercase tracking-wider text-sm">Client Side</h3>
                                    <p className="text-zinc-400 text-xs mt-1">Tasks + billeder - kundens oversigt</p>
                                    <p className="text-zinc-600 text-[10px] font-mono mt-2 break-all">{getClientShareUrl(gameId)}</p>
                                </div>
                                <div className={`shrink-0 ml-4 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                                    copied === 'client'
                                        ? 'bg-green-600 text-white'
                                        : 'bg-orange-600 text-white group-hover:bg-orange-500'
                                }`}>
                                    {copied === 'client' ? 'Kopieret!' : 'Kopier'}
                                </div>
                            </div>
                        </button>

                        {/* Gallery link (photos only) */}
                        <button onClick={() => copyLink('gallery')}
                            className="w-full max-w-md p-5 rounded-2xl bg-zinc-900/80 border border-zinc-700 hover:border-zinc-500 transition-all text-left group">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-white font-black uppercase tracking-wider text-sm">Kun billeder</h3>
                                    <p className="text-zinc-400 text-xs mt-1">Galleri med download - kun billeder</p>
                                    <p className="text-zinc-600 text-[10px] font-mono mt-2 break-all">{getGalleryShareUrl(gameId)}</p>
                                </div>
                                <div className={`shrink-0 ml-4 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                                    copied === 'gallery'
                                        ? 'bg-green-600 text-white'
                                        : 'bg-zinc-700 text-white group-hover:bg-zinc-600'
                                }`}>
                                    {copied === 'gallery' ? 'Kopieret!' : 'Kopier'}
                                </div>
                            </div>
                        </button>

                        <div className="text-center mt-4">
                            <p className="text-zinc-600 text-xs uppercase tracking-widest">
                                {visibleTaskIds.size} tasks synlige &bull; {visiblePhotos.length} billeder synlige
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClientHub;

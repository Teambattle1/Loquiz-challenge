import React, { useState, useEffect, useMemo } from 'react';
import { GameTask, GamePhoto, PlayerResult } from '../types';
import { saveSharedTasks, fetchSharedTasks, SharedTaskData } from '../services/taskShareService';
import { saveGallery, fetchGallery, getClientSectionUrl, getClientShareUrlWithSections, ShareSections, DEFAULT_SECTIONS } from '../services/galleryService';

type TabType = 'tasks' | 'photos' | 'share';
type SectionKey = 'gallery' | 'ranking' | 'tasks' | 'answers' | 'teams';

interface ClientHubProps {
    tasks: GameTask[];
    photos: GamePhoto[];
    results: PlayerResult[];
    gameId: string;
    gameName: string | null;
    onBack?: () => void;
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

const ClientHub: React.FC<ClientHubProps> = ({ tasks, photos, results, gameId, gameName, onBack }) => {
    const [tab, setTab] = useState<TabType>('tasks');

    // Task state
    const [visibleTaskIds, setVisibleTaskIds] = useState<Set<string>>(new Set());
    const [taskSaving, setTaskSaving] = useState(false);

    // Photo state
    const [hiddenPhotoIds, setHiddenPhotoIds] = useState<Set<string>>(new Set());
    const [photoSaving, setPhotoSaving] = useState(false);

    // Hidden teams (per-team opt-out for the public team-links list)
    const [hiddenTeamIds, setHiddenTeamIds] = useState<Set<string>>(new Set());
    const toggleTeam = (id: string) => setHiddenTeamIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });

    // Section visibility
    const [sections, setSections] = useState<ShareSections>(DEFAULT_SECTIONS);
    const toggleSection = (key: SectionKey) => setSections(prev => ({ ...prev, [key]: !prev[key] }));

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
            if (galleryData?.sections) {
                setSections({ ...DEFAULT_SECTIONS, ...galleryData.sections });
            }
            const ht = (galleryData as any)?.hidden_team_ids as string[] | undefined;
            if (ht && ht.length > 0) setHiddenTeamIds(new Set(ht));
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

    const savePhotos = async (sectionsOverride?: ShareSections) => {
        setPhotoSaving(true);
        await saveGallery(gameId, gameName, photos, Array.from(hiddenPhotoIds), {
            sections: sectionsOverride || sections,
            results,
            hiddenTeamIds: Array.from(hiddenTeamIds),
        });
        setPhotoSaving(false);
    };

    // --- Share actions ---
    const copyLink = async (label: string, url: string) => {
        // Auto-save tasks + gallery (with sections + results) before sharing
        await Promise.all([saveTasks(), savePhotos()]);
        try {
            await navigator.clipboard.writeText(url);
        } catch {
            window.prompt('Kopiér link:', url);
        }
        setCopied(label);
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
                    <div className="flex items-center gap-3">
                        {onBack && (
                            <button onClick={onBack}
                                aria-label="Tilbage"
                                className="p-2 rounded-lg bg-zinc-800 text-zinc-400 border border-zinc-700 hover:text-white hover:border-zinc-500 transition-all">
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                        )}
                        <h2 className="text-xl font-black text-white uppercase tracking-wider">Client Hub</h2>
                    </div>
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
                    <div className="p-6 max-w-2xl mx-auto space-y-8">
                        {/* Master client link with embedded section checkboxes */}
                        <div>
                            <h3 className="text-white font-black uppercase tracking-wider text-sm mb-3">Client link</h3>
                            <div className="p-5 rounded-2xl bg-orange-600/10 border border-orange-500/40">
                                <p className="text-white font-black uppercase tracking-wider text-sm">Fælles client side</p>
                                <p className="text-zinc-500 text-xs mt-1 mb-4">Afkryds 1-3. Valget indlejres i linket.</p>

                                {/* Inline checkboxes */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                                    {([
                                        { key: 'tasks' as const, label: 'Tasks', desc: `${visibleTaskIds.size} synlige` },
                                        { key: 'gallery' as const, label: 'Billeder', desc: `${visiblePhotos.length} billeder` },
                                        { key: 'ranking' as const, label: 'Ranking', desc: `${results.length} hold` },
                                        { key: 'teams' as const, label: 'Team-links', desc: `${results.length} hold` },
                                    ]).map(s => {
                                        const active = sections[s.key];
                                        return (
                                            <button key={s.key} onClick={() => toggleSection(s.key)}
                                                className={`text-left p-3 rounded-lg border transition-all ${
                                                    active
                                                        ? 'bg-orange-500/20 border-orange-400/60'
                                                        : 'bg-zinc-900/60 border-zinc-700 hover:border-zinc-500'
                                                }`}>
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 transition-all ${
                                                        active ? 'bg-orange-500 text-white' : 'bg-zinc-800 border border-zinc-600'
                                                    }`}>
                                                        {active && (
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                                                                <polyline points="20 6 9 17 4 12" />
                                                            </svg>
                                                        )}
                                                    </div>
                                                    <p className={`font-bold text-xs uppercase tracking-wide ${active ? 'text-orange-300' : 'text-white'}`}>{s.label}</p>
                                                </div>
                                                <p className="text-zinc-500 text-[10px] mt-1 ml-6">{s.desc}</p>
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* URL + copy */}
                                <button onClick={() => copyLink('client', getClientShareUrlWithSections(gameId, sections))}
                                    disabled={!sections.tasks && !sections.gallery && !sections.ranking && !sections.answers && !sections.teams}
                                    className="w-full flex items-center justify-between gap-4 p-3 rounded-lg bg-zinc-900/60 border border-zinc-700 hover:border-orange-500/60 transition-all group disabled:opacity-40 disabled:cursor-not-allowed">
                                    <p className="text-zinc-400 text-[11px] font-mono break-all text-left min-w-0 flex-grow">{getClientShareUrlWithSections(gameId, sections)}</p>
                                    <div className={`shrink-0 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                                        copied === 'client' ? 'bg-green-600 text-white' : 'bg-orange-600 text-white group-hover:bg-orange-500'
                                    }`}>
                                        {copied === 'client' ? 'Kopieret!' : 'Kopier'}
                                    </div>
                                </button>
                            </div>
                        </div>

                        {/* Direct section links */}
                        <div>
                            <h3 className="text-white font-black uppercase tracking-wider text-sm mb-3">Direkte sektion-links</h3>
                            <div className="grid grid-cols-3 gap-2">
                                {([
                                    { key: 'tasks' as const, label: 'Tasks' },
                                    { key: 'gallery' as const, label: 'Billeder' },
                                    { key: 'ranking' as const, label: 'Ranking' },
                                ]).map(s => {
                                    const url = getClientSectionUrl(gameId, s.key, undefined, sections);
                                    const enabled = sections[s.key];
                                    return (
                                        <button key={s.key}
                                            onClick={() => copyLink(`section-${s.key}`, url)}
                                            disabled={!enabled}
                                            title={enabled ? url : 'Aktiver sektionen ovenfor for at dele dette link'}
                                            className={`text-left p-3 rounded-lg border transition-all ${
                                                !enabled
                                                    ? 'bg-zinc-900/30 border-zinc-800 opacity-40 cursor-not-allowed'
                                                    : 'bg-zinc-900/80 border-zinc-700 hover:border-orange-500/60 hover:bg-zinc-900'
                                            }`}>
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-white font-bold text-xs uppercase tracking-wider">{s.label}</span>
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                                    copied === `section-${s.key}` ? 'bg-green-600 text-white' : 'bg-zinc-800 text-orange-400'
                                                }`}>
                                                    {copied === `section-${s.key}` ? '✓' : 'Kopier'}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Per-team share */}
                        {results.length > 0 && (
                            <div>
                                <div className="flex items-baseline justify-between gap-3 mb-1">
                                    <h3 className="text-white font-black uppercase tracking-wider text-sm">Team-specifikke links</h3>
                                    {sections.teams && (
                                        <span className="text-orange-400 text-[10px] font-bold uppercase tracking-wider">
                                            {results.length - hiddenTeamIds.size}/{results.length} synlige for klient
                                        </span>
                                    )}
                                </div>
                                <p className="text-zinc-500 text-xs mb-3">
                                    {sections.teams
                                        ? 'Klik kopier for at få et link. Brug øjet for at skjule et hold for klienten på det fælles client-link.'
                                        : 'Linker direkte til ranking med holdets placering highlightet og åbner team-detalje under Answers.'}
                                </p>
                                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-700">
                                    {results.map(team => {
                                        const teamId = (team as any).id || team.name;
                                        const url = getClientSectionUrl(gameId, 'ranking', teamId, sections);
                                        const isCopied = copied === `team-${teamId}`;
                                        const isHidden = hiddenTeamIds.has(teamId);
                                        return (
                                            <div key={teamId}
                                                className={`w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all ${
                                                    isHidden && sections.teams
                                                        ? 'bg-zinc-900/30 border-zinc-800 opacity-50'
                                                        : 'bg-zinc-900/60 border-zinc-800 hover:border-orange-500/40 hover:bg-zinc-900'
                                                }`}
                                            >
                                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black shrink-0" style={{ backgroundColor: team.color || '#52525b', color: '#fff' }}>
                                                    #{team.position}
                                                </div>
                                                <button onClick={() => copyLink(`team-${teamId}`, url)} className="flex-grow min-w-0 text-left">
                                                    <p className="text-white font-bold text-sm uppercase truncate">{team.name}</p>
                                                    <p className="text-zinc-500 text-[10px] font-mono">{team.score.toLocaleString()} pts</p>
                                                </button>
                                                {sections.teams && (
                                                    <button
                                                        onClick={() => toggleTeam(teamId)}
                                                        title={isHidden ? 'Vis for klient' : 'Skjul for klient'}
                                                        className={`shrink-0 w-8 h-8 rounded-md flex items-center justify-center transition-all ${
                                                            isHidden
                                                                ? 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-white'
                                                                : 'bg-green-600/20 text-green-400 border border-green-500/30 hover:bg-green-600/30'
                                                        }`}
                                                    >
                                                        {isHidden ? (
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                                                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                                                                <line x1="1" y1="1" x2="23" y2="23"/>
                                                            </svg>
                                                        ) : (
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                                                <circle cx="12" cy="12" r="3"/>
                                                            </svg>
                                                        )}
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => copyLink(`team-${teamId}`, url)}
                                                    className={`shrink-0 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all ${
                                                        isCopied ? 'bg-green-600 text-white' : 'bg-orange-600/20 text-orange-400 border border-orange-500/30 hover:bg-orange-600/30'
                                                    }`}>
                                                    {isCopied ? 'Kopieret!' : '🔗 Kopier'}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClientHub;

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import JSZip from 'jszip';
import { useQueryState, parseAsStringLiteral, parseAsString } from 'nuqs';
import { fetchGallery, SharedGallery, DEFAULT_SECTIONS, ShareSections, decodeShowParam } from '../services/galleryService';
import { fetchSharedTasks, SharedTasks, SharedTaskData } from '../services/taskShareService';
import { GamePhoto, PlayerResult } from '../types';

type TabType = 'photos' | 'tasks' | 'ranking' | 'answers';

interface PublicGalleryProps {
    gameId: string;
    initialTab?: TabType;
}

const slugifyTeam = (t: PlayerResult): string => (t.id || t.name || `team-${t.position}`);

const teamInitials = (name: string): string => {
    const parts = name.trim().split(/\s+/).slice(0, 2);
    return parts.map(p => p[0] || '').join('').toUpperCase() || '?';
};

const SECTION_VALUES = ['photos', 'tasks', 'ranking', 'answers'] as const;

const PublicGallery: React.FC<PublicGalleryProps> = ({ gameId, initialTab }) => {
    const [gallery, setGallery] = useState<SharedGallery | null>(null);
    const [sharedTasks, setSharedTasks] = useState<SharedTasks | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [zipProgress, setZipProgress] = useState<{ current: number; total: number; status: string } | null>(null);

    // URL-synced state (refresh-safe) — nuqs writes changes back to ?section=... & ?team=...
    const [activeTab, setActiveTab] = useQueryState<TabType>(
        'section',
        parseAsStringLiteral(SECTION_VALUES).withDefault(initialTab || 'photos')
    );
    const [activeTeamSlug, setActiveTeamSlug] = useQueryState('team', parseAsString);

    useEffect(() => {
        Promise.all([
            fetchGallery(gameId),
            fetchSharedTasks(gameId),
        ]).then(([galleryData, tasksData]) => {
            setGallery(galleryData);
            setSharedTasks(tasksData);
            const sections: ShareSections = { ...DEFAULT_SECTIONS, ...(galleryData?.sections || {}) };
            // If the URL didn't ask for a specific section, fall back to the first enabled one
            const urlHasSection = new URLSearchParams(window.location.search).has('section');
            if (!urlHasSection) {
                if (galleryData?.results?.length && activeTeamSlug && sections.ranking) {
                    setActiveTab('ranking');
                } else if (sections.gallery && galleryData) {
                    setActiveTab('photos');
                } else if (sections.ranking && galleryData?.results?.length) {
                    setActiveTab('ranking');
                } else if (sections.tasks && tasksData) {
                    setActiveTab('tasks');
                } else if (sections.answers && galleryData?.results?.length) {
                    setActiveTab('answers');
                }
            }
            setLoading(false);
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gameId]);

    const visiblePhotos: GamePhoto[] = gallery
        ? (gallery.photos as GamePhoto[]).filter(p => !gallery.hidden_ids.includes(p.id))
        : [];

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const selectAll = () => setSelectedIds(new Set(visiblePhotos.map(p => p.id)));
    const selectNone = () => setSelectedIds(new Set());

    const downloadSingle = async (photo: GamePhoto) => {
        try {
            const response = await fetch(photo.url);
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${(photo.teamName || 'photo').replace(/[^a-zA-Z0-9æøåÆØÅ ]/g, '')}-${photo.id}.jpg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch {
            window.open(photo.url, '_blank');
        }
    };

    const downloadZip = useCallback(async (photos: GamePhoto[]) => {
        if (photos.length === 0) return;
        const zip = new JSZip();
        const total = photos.length;
        setZipProgress({ current: 0, total, status: 'Downloading photos...' });

        for (let i = 0; i < photos.length; i++) {
            const photo = photos[i];
            setZipProgress({ current: i, total, status: `Downloading ${i + 1}/${total}...` });
            try {
                const resp = await fetch(photo.url);
                const blob = await resp.blob();
                const name = `${(photo.teamName || 'photo').replace(/[^a-zA-Z0-9æøåÆØÅ ]/g, '')}-${photo.id}.jpg`;
                zip.file(name, blob);
            } catch {
                // Skip failed downloads
            }
        }

        setZipProgress({ current: total, total, status: 'Creating zip file...' });

        const zipBlob = await zip.generateAsync({ type: 'blob' }, (metadata) => {
            setZipProgress({ current: total, total, status: `Compressing... ${Math.round(metadata.percent)}%` });
        });

        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${gallery?.game_name || gameId}-photos.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setZipProgress(null);
    }, [gallery, gameId]);

    const downloadSelected = () => {
        const photos = visiblePhotos.filter(p => selectedIds.has(p.id));
        downloadZip(photos);
    };

    const downloadAll = () => {
        downloadZip(visiblePhotos);
    };

    // ─── Loading ────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-white font-bold uppercase tracking-widest text-sm">Loading gallery...</p>
                </div>
            </div>
        );
    }

    const visibleTasks: SharedTaskData[] = sharedTasks
        ? sharedTasks.tasks.filter(t => sharedTasks.visible_task_ids.includes(t.id))
        : [];

    // URL ?show=tasks,photos,ranking overrides DB sections so the link is self-sufficient
    const urlShow = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('show') : null;
    const urlSections = decodeShowParam(urlShow);
    const sections: ShareSections = urlSections || { ...DEFAULT_SECTIONS, ...(gallery?.sections || {}) };
    const sharedResults: PlayerResult[] = (gallery?.results as PlayerResult[]) || [];

    const hasPhotos = !!gallery && visiblePhotos.length > 0 && sections.gallery;
    const hasTasks = visibleTasks.length > 0 && sections.tasks;
    const hasRanking = sharedResults.length > 0 && sections.ranking;
    const hasAnswers = sharedResults.length > 0 && sections.answers;

    // Build task title lookup for the answers view
    const taskTitleById = new Map<string, string>();
    visibleTasks.forEach(t => taskTitleById.set(t.id, t.title));
    if (sharedTasks) sharedTasks.tasks.forEach(t => { if (!taskTitleById.has(t.id)) taskTitleById.set(t.id, t.title); });

    if (!hasPhotos && !hasTasks && !hasRanking && !hasAnswers) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="text-center">
                    <p className="text-zinc-500 font-bold uppercase tracking-widest text-lg mb-2">Not found</p>
                    <p className="text-zinc-600 text-sm">This link may have expired or does not exist.</p>
                </div>
            </div>
        );
    }

    const activeTeam = activeTeamSlug
        ? sharedResults.find(t => slugifyTeam(t) === activeTeamSlug)
        : null;
    const teamPhotos = activeTeam
        ? visiblePhotos.filter(p => (p.teamName || '').trim() === activeTeam.name.trim())
        : [];

    const tabConfig: { id: TabType; label: string; show: boolean; count?: number }[] = [
        { id: 'photos', label: 'Photos', show: hasPhotos, count: visiblePhotos.length },
        { id: 'ranking', label: 'Ranking', show: hasRanking, count: sharedResults.length },
        { id: 'tasks', label: 'Tasks', show: hasTasks, count: visibleTasks.length },
        { id: 'answers', label: 'Answers', show: hasAnswers, count: sharedResults.length },
    ];
    const visibleTabs = tabConfig.filter(t => t.show);

    const pct = zipProgress ? Math.round((zipProgress.current / zipProgress.total) * 100) : 0;

    const gameName = gallery?.game_name || sharedTasks?.game_name || 'TeamChallenge';

    return (
        <div className="min-h-screen bg-black">
            {/* Header */}
            <div className="sticky top-0 z-20 bg-black/90 backdrop-blur-md border-b border-orange-500/20 px-4 md:px-8 py-4">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl md:text-4xl font-black text-white uppercase tracking-tighter">
                            {gameName}
                        </h1>
                        {/* Tabs */}
                        {visibleTabs.length > 1 && (
                            <div className="flex flex-wrap gap-4 mt-2">
                                {visibleTabs.map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => { setActiveTab(t.id); if (t.id !== 'answers' && t.id !== 'ranking') setActiveTeamSlug(null); }}
                                        className={`text-xs font-bold uppercase tracking-[0.2em] pb-1 border-b-2 transition-all ${
                                            activeTab === t.id
                                                ? 'text-orange-500 border-orange-500'
                                                : 'text-zinc-500 border-transparent hover:text-zinc-300'
                                        }`}
                                    >
                                        {t.label}{typeof t.count === 'number' ? ` (${t.count})` : ''}
                                    </button>
                                ))}
                            </div>
                        )}
                        {activeTab === 'photos' && hasPhotos && (
                            <p className="text-orange-500 text-xs font-bold uppercase tracking-[0.2em] mt-1">
                                {visiblePhotos.length} photos
                                {selectedIds.size > 0 && <span className="text-white ml-2">• {selectedIds.size} selected</span>}
                            </p>
                        )}
                    </div>
                    {activeTab === 'photos' && hasPhotos && (
                        <div className="flex items-center gap-2 flex-wrap justify-end shrink-0">
                            <button
                                onClick={selectedIds.size === visiblePhotos.length ? selectNone : selectAll}
                                className="px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider bg-zinc-800 text-zinc-400 border border-zinc-700 hover:text-white hover:border-zinc-500 transition-all"
                            >
                                {selectedIds.size === visiblePhotos.length ? 'Fravælg alle' : 'Vælg alle'}
                            </button>
                            {selectedIds.size > 0 && (
                                <button
                                    onClick={downloadSelected}
                                    disabled={!!zipProgress}
                                    className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider bg-orange-600 text-white border border-orange-500 hover:bg-orange-500 transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(234,88,12,0.3)]"
                                >
                                    Download {selectedIds.size} photos
                                </button>
                            )}
                            <button
                                onClick={downloadAll}
                                disabled={!!zipProgress}
                                className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider bg-zinc-800 text-orange-400 border border-orange-500/30 hover:bg-orange-600 hover:text-white transition-all disabled:opacity-50"
                            >
                                Download alle
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Zip progress bar */}
            {zipProgress && (
                <div className="sticky top-[76px] z-20 bg-zinc-900 border-b border-orange-500/20 px-4 md:px-8 py-3">
                    <div className="flex items-center gap-4 max-w-4xl mx-auto">
                        <div className="flex-grow">
                            <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-orange-500 rounded-full transition-all duration-300"
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                        </div>
                        <span className="text-orange-400 text-xs font-mono font-bold shrink-0 w-32 text-right">
                            {zipProgress.status}
                        </span>
                    </div>
                </div>
            )}

            {/* Photo grid */}
            {activeTab === 'photos' && hasPhotos && (
                <div className="p-4 md:p-8">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {visiblePhotos.map(photo => {
                            const isSelected = selectedIds.has(photo.id);
                            return (
                                <div
                                    key={photo.id}
                                    className={`group relative rounded-xl overflow-hidden bg-zinc-900 transition-all cursor-pointer ${
                                        isSelected
                                            ? 'border-2 border-orange-500 shadow-[0_0_20px_rgba(234,88,12,0.3)]'
                                            : 'border border-zinc-800 hover:border-orange-500/50'
                                    }`}
                                    onClick={() => toggleSelect(photo.id)}
                                >
                                    <div className="aspect-square relative">
                                        <img
                                            src={photo.thumbnailUrl || photo.url}
                                            alt={photo.teamName || 'Photo'}
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                        />
                                        <div className={`absolute top-2 right-2 w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                                            isSelected
                                                ? 'bg-orange-500 text-white'
                                                : 'bg-black/60 text-zinc-400 group-hover:bg-black/80'
                                        }`}>
                                            {isSelected ? (
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                                                    <polyline points="20 6 9 17 4 12" />
                                                </svg>
                                            ) : (
                                                <span className="text-xs">&#9744;</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="p-3 bg-zinc-950 flex items-center justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="text-white text-sm font-bold uppercase truncate">{photo.teamName || 'Unknown Team'}</p>
                                            <p className="text-zinc-500 text-xs uppercase truncate">{photo.taskTitle}</p>
                                        </div>
                                        <button
                                            onClick={e => { e.stopPropagation(); downloadSingle(photo); }}
                                            className="shrink-0 w-9 h-9 rounded-lg bg-zinc-800 hover:bg-orange-600 text-zinc-400 hover:text-white flex items-center justify-center transition-all border border-zinc-700"
                                            title="Download"
                                        >
                                            &#11015;
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Tasks list */}
            {activeTab === 'tasks' && hasTasks && (
                <div className="p-4 md:p-8 max-w-4xl mx-auto">
                    <div className="space-y-4">
                        {visibleTasks.map((task, idx) => (
                            <div
                                key={task.id}
                                className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-5 md:p-6 hover:border-orange-500/30 transition-all"
                            >
                                <div className="flex items-start gap-4">
                                    <div className="w-8 h-8 rounded-lg bg-orange-600/20 border border-orange-500/30 flex items-center justify-center shrink-0 mt-0.5">
                                        <span className="text-orange-500 font-black text-sm">{idx + 1}</span>
                                    </div>
                                    <div className="min-w-0 flex-grow">
                                        <h3 className="text-white font-bold text-base md:text-lg uppercase tracking-wide">
                                            {task.title}
                                        </h3>
                                        {task.shortIntro && (
                                            <p className="text-orange-400/80 text-sm mt-1">{task.shortIntro}</p>
                                        )}
                                        {task.taskTxt && (
                                            <p className="text-zinc-400 text-sm mt-2 leading-relaxed whitespace-pre-line">{task.taskTxt}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Ranking */}
            {activeTab === 'ranking' && hasRanking && (
                <div className="p-4 md:p-8 max-w-3xl mx-auto">
                    <div className="space-y-2">
                        {sharedResults.map(team => {
                            const slug = slugifyTeam(team);
                            const isHighlighted = activeTeamSlug === slug;
                            const isTop3 = team.position <= 3;
                            return (
                                <div
                                    key={slug}
                                    className={`flex items-center gap-4 px-4 md:px-6 py-3 md:py-4 rounded-2xl border transition-all ${
                                        isHighlighted
                                            ? 'bg-orange-500/15 border-orange-500 shadow-[0_0_30px_rgba(234,88,12,0.4)] scale-[1.02]'
                                            : isTop3
                                                ? 'bg-yellow-500/5 border-yellow-500/30'
                                                : 'bg-zinc-900/60 border-zinc-800'
                                    }`}
                                >
                                    <div className={`w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center text-base md:text-lg font-black shrink-0 ${
                                        isHighlighted ? 'bg-orange-500 text-white' : isTop3 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-zinc-800 text-zinc-400'
                                    }`}>
                                        #{team.position}
                                    </div>
                                    <div className="w-1.5 h-10 rounded-sm shrink-0" style={{ backgroundColor: team.color || '#52525b' }} />
                                    <div className="flex-grow min-w-0">
                                        <p className={`font-black text-base md:text-xl uppercase truncate ${isHighlighted ? 'text-white' : 'text-zinc-200'}`}>{team.name}</p>
                                        {isHighlighted && <p className="text-orange-300 text-[10px] font-bold uppercase tracking-widest">Dit hold</p>}
                                    </div>
                                    <div className={`font-mono font-black text-lg md:text-2xl shrink-0 ${isHighlighted ? 'text-orange-300' : 'text-zinc-300'}`}>
                                        {team.score.toLocaleString()}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Answers — teams as round icons, click to drill into team detail */}
            {activeTab === 'answers' && hasAnswers && !activeTeam && (
                <div className="p-4 md:p-8 max-w-5xl mx-auto">
                    <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-6 text-center">Klik på et hold for at se billeder og svar</p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4 md:gap-6">
                        {sharedResults.map(team => {
                            const slug = slugifyTeam(team);
                            const photoCount = visiblePhotos.filter(p => (p.teamName || '').trim() === team.name.trim()).length;
                            const answerCount = team.answers?.length || 0;
                            return (
                                <button
                                    key={slug}
                                    onClick={() => setActiveTeamSlug(slug)}
                                    className="group flex flex-col items-center gap-2 p-3 rounded-2xl hover:bg-zinc-900/60 transition-all"
                                >
                                    <div
                                        className="w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center text-2xl md:text-3xl font-black text-white shadow-[0_8px_30px_rgba(0,0,0,0.5)] group-hover:scale-110 transition-transform border-4"
                                        style={{ backgroundColor: team.color || '#52525b', borderColor: team.color || '#52525b' }}
                                    >
                                        {teamInitials(team.name)}
                                    </div>
                                    <div className="text-center">
                                        <p className="text-white text-xs md:text-sm font-bold uppercase truncate max-w-[120px]">{team.name}</p>
                                        <p className="text-zinc-500 text-[10px] font-mono uppercase tracking-wider">#{team.position} • {photoCount}📷 {answerCount}✎</p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Answers — single team detail */}
            {activeTab === 'answers' && hasAnswers && activeTeam && (
                <div className="p-4 md:p-8 max-w-4xl mx-auto">
                    <button
                        onClick={() => setActiveTeamSlug(null)}
                        className="text-zinc-400 hover:text-orange-400 text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-1"
                    >
                        ← Tilbage til hold-oversigt
                    </button>
                    <div className="flex items-center gap-4 mb-6">
                        <div
                            className="w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center text-xl md:text-2xl font-black text-white shadow-2xl border-4"
                            style={{ backgroundColor: activeTeam.color || '#52525b', borderColor: activeTeam.color || '#52525b' }}
                        >
                            {teamInitials(activeTeam.name)}
                        </div>
                        <div>
                            <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tighter">{activeTeam.name}</h2>
                            <p className="text-orange-500 text-xs font-bold uppercase tracking-widest">
                                Position #{activeTeam.position} • {activeTeam.score.toLocaleString()} pts
                            </p>
                        </div>
                    </div>

                    {/* Team photos */}
                    {teamPhotos.length > 0 && (
                        <div className="mb-8">
                            <h3 className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-3">Billeder ({teamPhotos.length})</h3>
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                                {teamPhotos.map(photo => (
                                    <a
                                        key={photo.id}
                                        href={photo.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="aspect-square rounded-lg overflow-hidden bg-zinc-900 border border-zinc-800 hover:border-orange-500/50 transition-all group"
                                    >
                                        {photo.mediaType === 'video' ? (
                                            photo.thumbnailUrl ? (
                                                <img src={photo.thumbnailUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                                            ) : (
                                                <video src={photo.url} muted playsInline preload="metadata" className="w-full h-full object-cover" />
                                            )
                                        ) : (
                                            <img src={photo.thumbnailUrl || photo.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                                        )}
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Team answers */}
                    {(activeTeam.answers && activeTeam.answers.length > 0) && (
                        <div>
                            <h3 className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-3">Svar ({activeTeam.answers.length})</h3>
                            <div className="space-y-2">
                                {activeTeam.answers.map((ans, idx) => {
                                    const title = taskTitleById.get(ans.taskId) || `Task ${ans.taskId}`;
                                    return (
                                        <div
                                            key={idx}
                                            className={`flex items-center gap-3 p-3 rounded-xl border ${
                                                ans.isCorrect
                                                    ? 'bg-green-500/5 border-green-500/30'
                                                    : 'bg-zinc-900/60 border-zinc-800'
                                            }`}
                                        >
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-black ${
                                                ans.isCorrect ? 'bg-green-500/20 text-green-400' : 'bg-zinc-800 text-zinc-500'
                                            }`}>
                                                {ans.isCorrect ? '✓' : '–'}
                                            </div>
                                            <div className="flex-grow min-w-0">
                                                <p className="text-white text-sm font-bold uppercase truncate">{title}</p>
                                            </div>
                                            <div className="font-mono font-black text-sm text-orange-400 shrink-0">
                                                {(ans.score || 0).toLocaleString()}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {teamPhotos.length === 0 && (!activeTeam.answers || activeTeam.answers.length === 0) && (
                        <p className="text-zinc-500 text-center py-12 text-sm uppercase tracking-widest">Ingen data for dette hold</p>
                    )}
                </div>
            )}

            {/* Footer */}
            <div className="text-center py-8">
                <p className="text-zinc-700 text-xs uppercase tracking-widest">TeamChallenge Photo Gallery</p>
            </div>
        </div>
    );
};

export default PublicGallery;

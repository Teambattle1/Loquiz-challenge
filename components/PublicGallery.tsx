import React, { useState, useEffect, useCallback } from 'react';
import JSZip from 'jszip';
import { fetchGallery, SharedGallery } from '../services/galleryService';
import { GamePhoto } from '../types';

interface PublicGalleryProps {
    gameId: string;
}

const PublicGallery: React.FC<PublicGalleryProps> = ({ gameId }) => {
    const [gallery, setGallery] = useState<SharedGallery | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [zipProgress, setZipProgress] = useState<{ current: number; total: number; status: string } | null>(null);

    useEffect(() => {
        fetchGallery(gameId).then(data => {
            setGallery(data);
            setLoading(false);
        });
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

    if (!gallery || visiblePhotos.length === 0) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="text-center">
                    <p className="text-zinc-500 font-bold uppercase tracking-widest text-lg mb-2">Gallery not found</p>
                    <p className="text-zinc-600 text-sm">This gallery link may have expired or does not exist.</p>
                </div>
            </div>
        );
    }

    const pct = zipProgress ? Math.round((zipProgress.current / zipProgress.total) * 100) : 0;

    return (
        <div className="min-h-screen bg-black">
            {/* Header */}
            <div className="sticky top-0 z-20 bg-black/90 backdrop-blur-md border-b border-orange-500/20 px-4 md:px-8 py-4">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl md:text-4xl font-black text-white uppercase tracking-tighter">
                            {gallery.game_name || 'Photo Gallery'}
                        </h1>
                        <p className="text-orange-500 text-xs font-bold uppercase tracking-[0.2em] mt-1">
                            {visiblePhotos.length} photos
                            {selectedIds.size > 0 && <span className="text-white ml-2">• {selectedIds.size} selected</span>}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end shrink-0">
                        {/* Select all / none */}
                        <button
                            onClick={selectedIds.size === visiblePhotos.length ? selectNone : selectAll}
                            className="px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider bg-zinc-800 text-zinc-400 border border-zinc-700 hover:text-white hover:border-zinc-500 transition-all"
                        >
                            {selectedIds.size === visiblePhotos.length ? 'Fravælg alle' : 'Vælg alle'}
                        </button>
                        {/* Download selected */}
                        {selectedIds.size > 0 && (
                            <button
                                onClick={downloadSelected}
                                disabled={!!zipProgress}
                                className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider bg-orange-600 text-white border border-orange-500 hover:bg-orange-500 transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(234,88,12,0.3)]"
                            >
                                ⬇ Download {selectedIds.size} photos
                            </button>
                        )}
                        {/* Download all */}
                        <button
                            onClick={downloadAll}
                            disabled={!!zipProgress}
                            className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider bg-zinc-800 text-orange-400 border border-orange-500/30 hover:bg-orange-600 hover:text-white transition-all disabled:opacity-50"
                        >
                            ⬇ Download alle
                        </button>
                    </div>
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
                                    {/* Selection checkbox */}
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
                                            <span className="text-xs">☐</span>
                                        )}
                                    </div>
                                </div>
                                {/* Info + single download */}
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
                                        ⬇
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Footer */}
            <div className="text-center py-8">
                <p className="text-zinc-700 text-xs uppercase tracking-widest">TeamChallenge Photo Gallery</p>
            </div>
        </div>
    );
};

export default PublicGallery;

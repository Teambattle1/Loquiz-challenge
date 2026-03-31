import React, { useState, useEffect } from 'react';
import { fetchGallery, SharedGallery } from '../services/galleryService';
import { GamePhoto } from '../types';

interface PublicGalleryProps {
    gameId: string;
}

const PublicGallery: React.FC<PublicGalleryProps> = ({ gameId }) => {
    const [gallery, setGallery] = useState<SharedGallery | null>(null);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState<string | null>(null);

    useEffect(() => {
        fetchGallery(gameId).then(data => {
            setGallery(data);
            setLoading(false);
        });
    }, [gameId]);

    const visiblePhotos: GamePhoto[] = gallery
        ? (gallery.photos as GamePhoto[]).filter(p => !gallery.hidden_ids.includes(p.id))
        : [];

    const downloadPhoto = async (photo: GamePhoto) => {
        setDownloading(photo.id);
        try {
            const response = await fetch(photo.url);
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${photo.teamName || 'photo'}-${photo.id}.jpg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            // Fallback: open in new tab
            window.open(photo.url, '_blank');
        }
        setDownloading(null);
    };

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

    return (
        <div className="min-h-screen bg-black">
            {/* Header */}
            <div className="sticky top-0 z-20 bg-black/90 backdrop-blur-md border-b border-orange-500/20 px-4 md:px-8 py-4">
                <h1 className="text-2xl md:text-4xl font-black text-white uppercase tracking-tighter">
                    {gallery.game_name || 'Photo Gallery'}
                </h1>
                <p className="text-orange-500 text-xs font-bold uppercase tracking-[0.2em] mt-1">
                    {visiblePhotos.length} photos • Click to download
                </p>
            </div>

            {/* Photo grid */}
            <div className="p-4 md:p-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {visiblePhotos.map(photo => (
                        <div key={photo.id} className="group relative rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 hover:border-orange-500/50 transition-all">
                            <div className="aspect-square">
                                <img
                                    src={photo.thumbnailUrl || photo.url}
                                    alt={photo.teamName || 'Photo'}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                />
                            </div>
                            {/* Info + download */}
                            <div className="p-3 bg-zinc-950">
                                <p className="text-white text-sm font-bold uppercase truncate">{photo.teamName || 'Unknown Team'}</p>
                                <p className="text-zinc-500 text-xs uppercase truncate">{photo.taskTitle}</p>
                                <button
                                    onClick={() => downloadPhoto(photo)}
                                    disabled={downloading === photo.id}
                                    className="mt-2 w-full px-3 py-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-all disabled:opacity-50"
                                >
                                    {downloading === photo.id ? 'Downloading...' : '⬇ Download'}
                                </button>
                            </div>
                        </div>
                    ))}
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

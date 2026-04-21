import React, { useState, useEffect } from 'react';
import { fetchGallery, SharedGallery } from '../services/galleryService';
import { GamePhoto, PlayerResult } from '../types';
import Showtime from './Showtime';
import ResultsReveal from './ResultsReveal';
import LanguageToggle from './LanguageToggle';
import { useT } from '../lib/i18n';

interface PublicShowtimeProps {
    gameId: string;
}

type Stage = 'loading' | 'ready' | 'slideshow' | 'reveal' | 'done' | 'error';

// Customer-facing entry point: plays the admin-picked slideshow and rolls
// straight into the podium reveal. Reads everything from shared_galleries —
// admin just re-saves from Showtime/ClientHub and the link stays in sync.
//
// Flow: loading → ready (tap-to-start overlay) → slideshow → reveal → done.
// The `ready` stage is important — browsers block autoplay + fullscreen
// without a user gesture, so we gate the whole show behind one explicit tap.
const PublicShowtime: React.FC<PublicShowtimeProps> = ({ gameId }) => {
    const t = useT();
    const [stage, setStage] = useState<Stage>('loading');
    const [gallery, setGallery] = useState<SharedGallery | null>(null);

    useEffect(() => {
        fetchGallery(gameId).then(data => {
            if (!data) { setStage('error'); return; }
            setGallery(data);
            setStage('ready');
        }).catch(() => setStage('error'));
    }, [gameId]);

    if (stage === 'loading') {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <LanguageToggle />
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-white font-bold uppercase tracking-widest text-sm">{t('public.loading')}</p>
                </div>
            </div>
        );
    }

    if (stage === 'error' || !gallery) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <LanguageToggle />
                <div className="text-center">
                    <p className="text-zinc-500 font-bold uppercase tracking-widest text-lg mb-2">{t('public.notFound.title')}</p>
                    <p className="text-zinc-600 text-sm">{t('public.notFound.body')}</p>
                </div>
            </div>
        );
    }

    // Resolve the slideshow photo list: prefer admin's picks, fall back to all
    // non-hidden photos so the link still works before anything was picked.
    const allPhotos = (gallery.photos as GamePhoto[]) || [];
    const hiddenIds = new Set(gallery.hidden_ids || []);
    const selectedIds = new Set(gallery.selected_photo_ids || []);
    const slideshowPhotos = selectedIds.size > 0
        ? allPhotos.filter(p => selectedIds.has(p.id) && !hiddenIds.has(p.id))
        : allPhotos.filter(p => !hiddenIds.has(p.id));

    const results: PlayerResult[] = (gallery.results as PlayerResult[]) || [];

    if (stage === 'ready') {
        const photoCount = slideshowPhotos.length;
        const photoWord = photoCount === 1 ? 'photo' : 'photos';
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-6">
                <LanguageToggle />
                <button
                    onClick={() => setStage('slideshow')}
                    className="group relative flex flex-col items-center gap-6 px-10 py-12 rounded-3xl bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white shadow-2xl shadow-orange-500/30 transition-all hover:scale-[1.02] active:scale-[0.98] max-w-md w-full"
                    aria-label="Start showtime"
                >
                    <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center ring-4 ring-white/30 group-hover:ring-white/50 transition-all">
                        <svg className="w-12 h-12 ml-1" viewBox="0 0 24 24" fill="white" aria-hidden="true">
                            <path d="M8 5v14l11-7z" />
                        </svg>
                    </div>
                    <div className="text-center">
                        <p className="text-3xl font-black uppercase tracking-widest">{gallery.game_name || 'Showtime'}</p>
                        <p className="text-sm font-bold uppercase tracking-wider opacity-90 mt-2">
                            Tap to start — {photoCount} {photoWord}
                        </p>
                    </div>
                    <p className="text-[11px] font-bold uppercase tracking-wider opacity-75">
                        Music + fullscreen will start on your tap
                    </p>
                </button>
            </div>
        );
    }

    if (stage === 'done') {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <LanguageToggle />
                <div className="text-center">
                    <p className="text-orange-500 font-black uppercase tracking-widest text-2xl mb-2">{gallery.game_name || 'TeamChallenge'}</p>
                    <p className="text-zinc-500 text-sm uppercase tracking-wider">{t('public.footer')}</p>
                </div>
            </div>
        );
    }

    if (stage === 'reveal') {
        return <ResultsReveal results={results} onClose={() => setStage('done')} />;
    }

    // stage === 'slideshow' — hand everything to Showtime in playback mode.
    // When showtime completes we flip to reveal (if we have results) or 'done'.
    return (
        <Showtime
            photos={slideshowPhotos}
            gameId={gameId}
            gameName={gallery.game_name || undefined}
            results={results}
            playbackMode
            onClose={() => setStage(results.length > 0 ? 'reveal' : 'done')}
            onShowtimeComplete={() => setStage(results.length > 0 ? 'reveal' : 'done')}
        />
    );
};

export default PublicShowtime;

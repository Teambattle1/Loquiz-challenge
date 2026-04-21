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

type Stage = 'loading' | 'slideshow' | 'reveal' | 'done' | 'error';

// Customer-facing entry point: plays the admin-picked slideshow and rolls
// straight into the podium reveal. Reads everything from shared_galleries —
// admin just re-saves from Showtime/ClientHub and the link stays in sync.
const PublicShowtime: React.FC<PublicShowtimeProps> = ({ gameId }) => {
    const t = useT();
    const [stage, setStage] = useState<Stage>('loading');
    const [gallery, setGallery] = useState<SharedGallery | null>(null);

    useEffect(() => {
        fetchGallery(gameId).then(data => {
            if (!data) { setStage('error'); return; }
            setGallery(data);
            setStage('slideshow');
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

import React, { useState, useEffect } from 'react';
import {
    fetchPlaylists, fetchTracks,
    MusicPlaylist, MusicTrack,
    getShowtimePlaylistId, setShowtimePlaylistId,
    getResultsPlaylistId, setResultsPlaylistId,
} from '../services/musicService';

interface MusicConfigProps {
    open: boolean;
    onClose: () => void;
}

const MusicConfig: React.FC<MusicConfigProps> = ({ open, onClose }) => {
    const [playlists, setPlaylists] = useState<MusicPlaylist[]>([]);
    const [loading, setLoading] = useState(true);
    const [showtimeId, setShowtimeId] = useState<string | null>(getShowtimePlaylistId());
    const [resultsId, setResultsId] = useState<string | null>(getResultsPlaylistId());
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [tracks, setTracks] = useState<MusicTrack[]>([]);

    useEffect(() => {
        if (!open) return;
        setLoading(true);
        fetchPlaylists().then(data => {
            setPlaylists(data);
            setLoading(false);
        });
    }, [open]);

    useEffect(() => {
        if (!expandedId) { setTracks([]); return; }
        fetchTracks(expandedId).then(setTracks);
    }, [expandedId]);

    const assignPlaylist = (type: 'showtime' | 'results', id: string) => {
        if (type === 'showtime') {
            setShowtimePlaylistId(id);
            setShowtimeId(id);
        } else {
            setResultsPlaylistId(id);
            setResultsId(id);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div className="w-full max-w-lg bg-zinc-900 rounded-2xl border border-orange-500/20 shadow-[0_0_60px_rgba(0,0,0,0.8)] overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="px-5 py-4 bg-black/40 border-b border-orange-500/20 flex items-center justify-between">
                    <h3 className="text-lg font-black text-orange-500 uppercase tracking-wider">Musik</h3>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors text-xl">✕</button>
                </div>

                {/* Content */}
                <div className="p-5 max-h-[70vh] overflow-y-auto">
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : playlists.length === 0 ? (
                        <p className="text-zinc-500 text-center py-8 uppercase tracking-widest text-xs font-bold">Ingen playlister fundet</p>
                    ) : (
                        <>
                            {/* Assignment status */}
                            <div className="grid grid-cols-2 gap-3 mb-5">
                                <div className="bg-zinc-800/60 rounded-lg p-3 border border-zinc-700/50">
                                    <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Showtime</div>
                                    <div className="text-sm text-orange-400 font-bold truncate">
                                        {showtimeId ? playlists.find(p => p.id === showtimeId)?.name || 'Unknown' : '—'}
                                    </div>
                                </div>
                                <div className="bg-zinc-800/60 rounded-lg p-3 border border-zinc-700/50">
                                    <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Results</div>
                                    <div className="text-sm text-orange-400 font-bold truncate">
                                        {resultsId ? playlists.find(p => p.id === resultsId)?.name || 'Unknown' : '—'}
                                    </div>
                                </div>
                            </div>

                            {/* Playlist list */}
                            <div className="space-y-2">
                                {playlists.map(pl => (
                                    <div key={pl.id} className="bg-zinc-800/40 rounded-lg border border-zinc-700/30 overflow-hidden">
                                        <div
                                            className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-zinc-700/30 transition-colors"
                                            onClick={() => setExpandedId(expandedId === pl.id ? null : pl.id)}
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="text-white font-bold text-sm uppercase tracking-wide truncate">{pl.name}</span>
                                                {showtimeId === pl.id && <span className="text-[9px] bg-pink-600/20 text-pink-400 px-1.5 py-0.5 rounded font-bold uppercase">Showtime</span>}
                                                {resultsId === pl.id && <span className="text-[9px] bg-blue-600/20 text-blue-400 px-1.5 py-0.5 rounded font-bold uppercase">Results</span>}
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <button
                                                    onClick={e => { e.stopPropagation(); assignPlaylist('showtime', pl.id); }}
                                                    className={`px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider border transition-all ${
                                                        showtimeId === pl.id
                                                            ? 'bg-pink-600 text-white border-pink-500'
                                                            : 'bg-zinc-800 text-zinc-400 border-zinc-600 hover:text-white hover:border-zinc-400'
                                                    }`}
                                                >
                                                    Show
                                                </button>
                                                <button
                                                    onClick={e => { e.stopPropagation(); assignPlaylist('results', pl.id); }}
                                                    className={`px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider border transition-all ${
                                                        resultsId === pl.id
                                                            ? 'bg-blue-600 text-white border-blue-500'
                                                            : 'bg-zinc-800 text-zinc-400 border-zinc-600 hover:text-white hover:border-zinc-400'
                                                    }`}
                                                >
                                                    Result
                                                </button>
                                                <span className="text-zinc-600 text-xs">{expandedId === pl.id ? '▲' : '▼'}</span>
                                            </div>
                                        </div>

                                        {/* Expanded tracks */}
                                        {expandedId === pl.id && (
                                            <div className="border-t border-zinc-700/30 px-4 py-2 space-y-1 bg-black/20">
                                                {tracks.length === 0 ? (
                                                    <p className="text-zinc-600 text-xs py-2">Loading tracks...</p>
                                                ) : tracks.map((track, i) => (
                                                    <div key={track.id} className="flex items-center gap-2 py-1">
                                                        <span className="text-zinc-600 font-mono text-[10px] w-5 text-right">{i + 1}</span>
                                                        <span className="text-zinc-300 text-xs truncate">{track.title}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MusicConfig;

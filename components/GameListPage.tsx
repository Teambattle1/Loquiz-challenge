import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GameListItem } from '../types';
import { fetchGames } from '../services/loquizService';

interface GameListPageProps {
  apiKey: string;
  onGameSelect: (gameId: string) => void;
  onLogout?: () => void;
}

type TabType = 'today' | 'planned' | 'completed';

/**
 * Extract an event date from the game.
 *
 * Vi prioriterer titlen først, fordi den indeholder *event-datoen* (hvornår
 * spillet faktisk afholdes), mens `rawValue` (Loquiz `created.at`) er
 * server-side oprettelsestidspunkt og kan ligge dage før event'en. For
 * grupperingen i TODAY/PLANNED/COMPLETED er det event-datoen der tæller.
 *
 * Regex-separatorerne tillader nu også mellemrum mellem MM og YYYY for at
 * matche det nye titel-format `"DD-MM YYYY // ..."`.
 */
const parseGameDate = (rawValue: string | number | undefined, fallbackString?: string): Date | null => {
    const extractFromStr = (str: string): Date | null => {
        // DD-MM-YYYY / DD/MM/YY / DD.MM.YYYY samt nyt format DD-MM YYYY
        const euMatch = str.match(/(\d{1,2})[-./](\d{1,2})[-./\s](\d{2,4})/);
        if (euMatch) {
            const day = parseInt(euMatch[1], 10);
            const month = parseInt(euMatch[2], 10) - 1;
            let year = parseInt(euMatch[3], 10);
            if (year < 100) year += 2000;
            const d = new Date(year, month, day);
            if (!isNaN(d.getTime())) return d;
        }
        return null;
    };

    // Titel = event-dato (mest præcis) → forsøg først
    if (fallbackString) {
        const d = extractFromStr(fallbackString);
        if (d) return d;
    }

    // Fallback: timestamp fra Loquiz API (creation time)
    if (typeof rawValue === 'number') {
        const d = rawValue < 100000000000 ? new Date(rawValue * 1000) : new Date(rawValue);
        return isNaN(d.getTime()) ? null : d;
    }

    if (typeof rawValue === 'string' && rawValue.trim()) {
        const d = extractFromStr(rawValue);
        if (d) return d;

        // Standard ISO fallback
        const isoD = new Date(rawValue.replace(' ', 'T'));
        if (!isNaN(isoD.getTime())) return isoD;
    }

    return null;
};

const GameListPage: React.FC<GameListPageProps> = ({ apiKey, onGameSelect, onLogout }) => {
  const [games, setGames] = useState<GameListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [manualGameId, setManualGameId] = useState('');
  const manualInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<TabType>('today');
  
  const [completedLimit, setCompletedLimit] = useState(25);

  useEffect(() => {
    const loadGames = async () => {
      if (apiKey === 'GUEST' || apiKey === 'SKIP') {
          setIsLoading(false);
          return;
      }
      try {
        setListError(null);
        setIsLoading(true);
        const gameList = await fetchGames(apiKey);
        setGames(gameList);
      } catch (err: any) {
        setListError('Could not sync games. Check credentials or enter ID manually.');
      } finally {
        setIsLoading(false);
      }
    };
    loadGames();
  }, [apiKey]);

  const groupedGames = useMemo(() => {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      
      const res = { today: [] as GameListItem[], planned: [] as GameListItem[], completed: [] as GameListItem[] };

      games.forEach(game => {
          const statusStr = String(game.status || '').toLowerCase();
          const date = parseGameDate(game.created, game.name);
          
          const isArchived = statusStr === 'closed' || statusStr === 'ended' || statusStr === 'archived' || game.isPlayable === false;
          
          if (isArchived || !date || date.getTime() < todayStart.getTime()) {
              res.completed.push(game);
          } else if (date.getTime() > todayEnd.getTime()) {
              res.planned.push(game);
          } else {
              res.today.push(game);
          }
      });

      // Newest First
      const sortDesc = (a: GameListItem, b: GameListItem) => {
          const timeA = parseGameDate(a.created, a.name)?.getTime() || 0;
          const timeB = parseGameDate(b.created, b.name)?.getTime() || 0;
          if (timeB !== timeA) return timeB - timeA;
          return b.id.localeCompare(a.id); 
      };

      // Oldest First
      const sortAsc = (a: GameListItem, b: GameListItem) => {
          const timeA = parseGameDate(a.created, a.name)?.getTime() || 9999999999999;
          const timeB = parseGameDate(b.created, b.name)?.getTime() || 9999999999999;
          if (timeA !== timeB) return timeA - timeB;
          return a.id.localeCompare(b.id);
      };

      res.today.sort(sortAsc);
      res.planned.sort(sortAsc);
      res.completed.sort(sortDesc);

      return res;
  }, [games]);

  const displayedCompleted = useMemo(() => {
      return groupedGames.completed.slice(0, completedLimit);
  }, [groupedGames.completed, completedLimit]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualGameId.trim()) onGameSelect(manualGameId.trim());
  };

  const TabButton = ({ tab, label, count }: { tab: TabType, label: string, count: number }) => (
      <button onClick={() => setActiveTab(tab)} className={`flex-1 py-4 flex flex-col items-center justify-center relative transition-all ${activeTab === tab ? 'text-orange-500' : 'text-zinc-500 hover:text-zinc-300'}`}>
          <span className="text-sm md:text-lg font-black uppercase tracking-widest">{label}</span>
          <span className={`text-[10px] font-mono mt-1 ${activeTab === tab ? 'text-orange-300' : 'text-zinc-600'}`}>{count} Games</span>
          {activeTab === tab && <div className="absolute bottom-0 left-0 w-full h-1 bg-orange-600 shadow-[0_0_15px_rgba(245,158,11,0.5)]"></div>}
      </button>
  );

  return (
    <div className="w-full max-w-6xl flex flex-col items-center min-h-[85vh] animate-fade-in">
      <div className="text-center mb-8 relative w-full">
        {onLogout && (
             <button onClick={onLogout} className="absolute top-0 right-0 text-[10px] uppercase font-black text-zinc-600 hover:text-orange-500 border border-zinc-800 px-3 py-1.5 rounded transition-all">
                {apiKey === 'GUEST' ? 'Login' : 'Logout'}
             </button>
        )}
        <h1 className="text-5xl md:text-7xl font-black text-orange-500 mb-2 tracking-tighter uppercase drop-shadow-xl italic">TEAMCHALLENGE</h1>
        <p className="text-zinc-500 font-bold tracking-[0.5em] text-xs uppercase opacity-70">Select your battleground</p>
      </div>

      <div className="w-full max-w-5xl flex flex-col flex-grow glass-panel rounded-3xl overflow-hidden border border-white/5">
        <div className="flex border-b border-white/5 bg-zinc-900/40">
            <TabButton tab="today" label="Today" count={groupedGames.today.length} />
            <TabButton tab="planned" label="Planned" count={groupedGames.planned.length} />
            <TabButton tab="completed" label="Completed" count={groupedGames.completed.length} />
        </div>

        <div className="min-h-[450px] max-h-[60vh] overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-orange-600 relative">
            {isLoading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-zinc-500 uppercase tracking-widest text-xs">Accessing Servers...</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {(activeTab === 'completed' ? displayedCompleted : groupedGames[activeTab]).map(game => (
                        <button key={game.id} onClick={() => onGameSelect(game.id)} className="w-full text-left p-5 transition-all rounded-xl border border-white/5 bg-zinc-900/50 hover:bg-orange-500/10 hover:border-orange-500/30 group relative flex justify-between items-center">
                            <div>
                                <p className="font-black text-xl md:text-2xl text-zinc-100 group-hover:text-white mb-1 uppercase tracking-tight">{game.name}</p>
                                <div className="flex items-center gap-4 text-xs">
                                    <span className="font-mono text-zinc-600 bg-black/40 px-2 py-1 rounded">ID: {game.id}</span>
                                    <span className="text-zinc-500 font-bold uppercase tracking-wider">
                                        {parseGameDate(game.created, game.name)?.toLocaleDateString() || 'No Date'}
                                    </span>
                                </div>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:bg-orange-500 group-hover:text-black group-hover:scale-110 transition-all">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M9 5l7 7-7 7"/></svg>
                            </div>
                        </button>
                    ))}
                    
                    {activeTab === 'completed' && groupedGames.completed.length > completedLimit && (
                        <button 
                            onClick={() => setCompletedLimit(prev => prev + 25)}
                            className="w-full p-6 mt-4 border-2 border-dashed border-zinc-800 rounded-xl text-zinc-500 hover:text-orange-500 hover:border-orange-500/50 hover:bg-orange-500/5 transition-all font-black uppercase tracking-widest"
                        >
                            Load 25 More Battlegrounds (+{groupedGames.completed.length - completedLimit} left)
                        </button>
                    )}

                    {groupedGames[activeTab].length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 opacity-30">
                            <div className="text-5xl mb-4">🛸</div>
                            <p className="text-xl font-black uppercase tracking-widest">No Transmissions Found</p>
                        </div>
                    )}
                </div>
            )}
        </div>
      </div>

      <div className="w-full max-w-lg mt-8 mb-4">
        <form onSubmit={handleManualSubmit} className="bg-zinc-900/40 p-4 rounded-2xl border border-white/5 backdrop-blur-md flex items-center gap-3 shadow-2xl">
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-2">Manual Override:</span>
            <input
                ref={manualInputRef}
                type="text"
                value={manualGameId}
                onChange={(e) => setManualGameId(e.target.value)}
                placeholder="ENTER GAME ID"
                className="flex-grow px-4 py-2 bg-black/60 border border-zinc-700 rounded-lg focus:outline-none focus:border-orange-500 text-white font-mono uppercase text-center tracking-widest placeholder-zinc-800"
            />
            <button type="submit" disabled={!manualGameId.trim()} className="px-6 py-2 bg-orange-600 text-black font-black rounded-lg hover:bg-orange-500 disabled:opacity-30 transition-all uppercase tracking-widest text-xs">GO</button>
        </form>
      </div>
    </div>
  );
};

export default GameListPage;
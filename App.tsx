import React, { useState, useEffect, useCallback } from 'react';
import LoquizResults from './components/LoquizResults';
import GameListPage from './components/GameListPage';
import ApiKeyInput from './components/ApiKeyInput';
import SessionDashboard from './components/SessionDashboard';
import Showtime from './components/Showtime';
import TaskMaster from './components/TaskMaster';
import TaskInspector from './components/TaskInspector';
import Timeline from './components/Timeline';
import ResultsReveal from './components/ResultsReveal';
import PublicGallery from './components/PublicGallery';
import ClientHub from './components/ClientHub';
import { fetchGameResults, fetchGameTasks, fetchGameInfo, fetchGamePhotos, getTaskTitle } from './services/loquizService';
import { PlayerResult, GameTask, GamePhoto } from './types';
import { HouseIcon } from './components/icons';

// Define the exact allowed view states
type ViewState = 'login' | 'lobby' | 'dashboard' | 'results' | 'showtime' | 'taskmaster' | 'timeline' | 'results-reveal' | 'admin' | 'client-tasks';

// PASTE YOUR API KEY HERE - Leave empty to use manual input
const HARDCODED_API_KEY: string = "ApiKey-v1 63f6bec47b2cc86eb52ea7d84f2f96e250ab87544074cec8949d5862d368c154";

// Check for ?gallery=GAMEID or ?client=GAMEID in URL
const getGalleryIdFromUrl = (): string | null => {
  const params = new URLSearchParams(window.location.search);
  return params.get('gallery');
};

const getClientIdFromUrl = (): string | null => {
  const params = new URLSearchParams(window.location.search);
  return params.get('client');
};

const App: React.FC = () => {
  const [galleryId] = useState<string | null>(getGalleryIdFromUrl);
  const [clientId] = useState<string | null>(getClientIdFromUrl);

  // If ?gallery=GAMEID, show public gallery directly
  if (galleryId) {
    return <PublicGallery gameId={galleryId} />;
  }

  // If ?client=GAMEID, show public gallery with tasks tab
  if (clientId) {
    return <PublicGallery gameId={clientId} initialTab="tasks" />;
  }

  return <MainApp />;
};

const MainApp: React.FC = () => {
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [gameName, setGameName] = useState<string | null>(null);

  // Initialize key with hardcoded value or from localStorage
  const [apiKey, setApiKey] = useState<string | null>(() => {
    if (HARDCODED_API_KEY && HARDCODED_API_KEY.trim() !== "") {
      return HARDCODED_API_KEY.trim();
    }
    return localStorage.getItem('loquiz_api_key') || null;
  });

  const [currentView, setCurrentView] = useState<ViewState>(() => {
    const initialKey = HARDCODED_API_KEY || localStorage.getItem('loquiz_api_key');
    return !initialKey ? 'login' : 'lobby';
  });

  // Data state for sub-views
  const [results, setResults] = useState<PlayerResult[]>([]);
  const [tasks, setTasks] = useState<GameTask[]>([]);
  const [photos, setPhotos] = useState<GamePhoto[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Load game data when entering dashboard
  const loadGameData = useCallback(async (gameId: string, key: string) => {
    try {
      const [resultsData, taskList, info, photosData] = await Promise.all([
        fetchGameResults(gameId, key),
        fetchGameTasks(gameId, key),
        fetchGameInfo(gameId, key),
        fetchGamePhotos(gameId, key),
      ]);
      setResults(resultsData);
      setPhotos(photosData);
      setGameName(info.name || null);

      let finalTasks: GameTask[] = taskList.length > 0 ? taskList : [];
      if (finalTasks.length === 0 && info.tasks && Array.isArray(info.tasks)) {
        finalTasks = info.tasks.map((t: any) => ({
          id: t.id,
          title: getTaskTitle(t),
          type: t.type || 'v4-embedded',
          raw: t,
        }));
      }
      setTasks(finalTasks);
      setDataLoaded(true);
    } catch (err) {
      console.warn('Failed to preload game data:', err);
      setDataLoaded(true);
    }
  }, []);

  // Sync currentView when login/logout changes
  useEffect(() => {
    if (!apiKey) {
      setCurrentView('login');
    } else if (!selectedGameId && !['login'].includes(currentView)) {
      setCurrentView('lobby');
    }
  }, [apiKey]);

  // Preload data when a game is selected
  useEffect(() => {
    if (selectedGameId && apiKey) {
      setDataLoaded(false);
      loadGameData(selectedGameId, apiKey);
    }
  }, [selectedGameId, apiKey, loadGameData]);

  const viewResults = (gameId: string) => {
    setSelectedGameId(gameId);
    setCurrentView('dashboard');
  };

  const goBackToLobby = () => {
    setSelectedGameId(null);
    setResults([]);
    setTasks([]);
    setPhotos([]);
    setDataLoaded(false);
    setCurrentView('lobby');
  };

  const goBackToDashboard = () => {
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    if (HARDCODED_API_KEY && HARDCODED_API_KEY.trim() !== "") return;
    localStorage.removeItem('loquiz_api_key');
    setApiKey(null);
    setSelectedGameId(null);
  };

  useEffect(() => {
    if (apiKey && apiKey !== "GUEST") {
      localStorage.setItem('loquiz_api_key', apiKey);
    }
  }, [apiKey]);

  const handleKeySubmit = (key: string) => {
    setApiKey(key);
  };

  const handleGuestEntry = () => {
    setApiKey("GUEST");
  };

  const handleNavigate = (view: 'results' | 'showtime' | 'taskmaster' | 'timeline' | 'results-reveal' | 'admin' | 'client-tasks') => {
    setCurrentView(view);
  };

  const handleShowtimeComplete = () => {
    setCurrentView('results-reveal');
  };

  const isHardcoded = !!(HARDCODED_API_KEY && HARDCODED_API_KEY.trim() !== "");

  // Back button used by sub-views
  const BackButton = () => (
    <div className="fixed top-3 left-3 z-50">
      <button onClick={goBackToDashboard} className="p-2.5 bg-black/80 hover:bg-orange-600 text-orange-500 hover:text-white rounded-full transition-all border border-orange-500/30 shadow-2xl backdrop-blur-sm">
        <HouseIcon className="w-5 h-5 md:w-6 md:h-6" />
      </button>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 lg:p-8 transition-all duration-500 relative">
      <div className="w-full max-w-6xl flex items-center justify-center z-10 my-auto">
        {currentView === 'login' && (
          <ApiKeyInput onKeySubmit={handleKeySubmit} />
        )}

        {currentView === 'lobby' && (
          <GameListPage
            apiKey={apiKey!}
            onGameSelect={viewResults}
            onLogout={isHardcoded ? undefined : handleLogout}
          />
        )}

        {currentView === 'dashboard' && selectedGameId && (
          <SessionDashboard
            apiKey={apiKey!}
            gameId={selectedGameId}
            onBack={goBackToLobby}
            onNavigate={handleNavigate}
          />
        )}

        {currentView === 'results' && selectedGameId && (
          <LoquizResults apiKey={apiKey!} gameId={selectedGameId} onBack={goBackToDashboard} />
        )}

        {currentView === 'showtime' && selectedGameId && (
          <div className="w-full">
            <Showtime photos={photos} gameId={selectedGameId || undefined} gameName={gameName || undefined} onClose={goBackToDashboard} onShowtimeComplete={handleShowtimeComplete} />
          </div>
        )}

        {currentView === 'taskmaster' && selectedGameId && dataLoaded && (
          <div className="w-full max-w-[98vw] h-[80vh] glass-panel rounded-3xl overflow-hidden border-t-8 border-t-orange-600 flex flex-col shadow-[0_40px_80px_rgba(0,0,0,0.7)] relative">
            <BackButton />
            <TaskMaster tasks={tasks} results={results} />
          </div>
        )}

        {currentView === 'timeline' && selectedGameId && dataLoaded && (
          <div className="w-full max-w-[98vw] h-[80vh] glass-panel rounded-3xl overflow-hidden border-t-8 border-t-purple-600 flex flex-col shadow-[0_40px_80px_rgba(0,0,0,0.7)] relative">
            <BackButton />
            <Timeline tasks={tasks} results={results} />
          </div>
        )}

        {currentView === 'results-reveal' && selectedGameId && dataLoaded && (
          <ResultsReveal results={results} onClose={goBackToDashboard} />
        )}

        {currentView === 'client-tasks' && selectedGameId && dataLoaded && (
          <div className="w-full max-w-[98vw] h-[80vh] glass-panel rounded-3xl overflow-hidden border-t-8 border-t-orange-600 flex flex-col shadow-[0_40px_80px_rgba(0,0,0,0.7)] relative">
            <BackButton />
            <ClientHub tasks={tasks} photos={photos} gameId={selectedGameId} gameName={gameName} />
          </div>
        )}

        {currentView === 'admin' && selectedGameId && dataLoaded && (
          <TaskInspector tasks={tasks} results={results} onClose={goBackToDashboard} />
        )}
      </div>

      {currentView === 'login' && !isHardcoded && (
        <button
          onClick={handleGuestEntry}
          className="absolute bottom-4 text-zinc-600 text-xs hover:text-zinc-400 uppercase tracking-widest transition-colors"
        >
          Continue as Guest
        </button>
      )}
    </div>
  );
};

export default App;

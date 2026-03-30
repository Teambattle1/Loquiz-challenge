import { PlayerResult, GameInfo, GameListItem, GameTask, PlayerAnswer, GamePhoto } from '../types';

const V3_BASE_URL = 'https://api.loquiz.com/v3';
const V4_BASE_URL = 'https://api.loquiz.com/v4';

const SUPABASE_PROXY = 'https://yktaxljydisfjyqhbnja.supabase.co/functions/v1/loquiz-proxy';

// Fallback CORS proxies (used if Supabase proxy fails)
const CORS_PROXIES = [
    'https://corsproxy.io/?',
    'https://api.codetabs.com/v1/proxy?quest=',
];

const fetchWithRetry = async (urlStr: string, options: RequestInit): Promise<Response> => {
    let lastError: any = new Error("Network request failed");
    const apiKey = (options.headers as Record<string, string>)?.['Authorization'] || '';

    // 1. Try Supabase Edge Function proxy (server-side, no CORS issues)
    try {
        const res = await fetch(SUPABASE_PROXY, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: urlStr, apiKey }),
        });
        if (res.ok || [404, 401, 403, 422].includes(res.status)) {
            if (res.ok) console.debug(`Successfully fetched: ${urlStr} via supabase-proxy`);
            return res;
        }
        lastError = new Error(`Supabase proxy status: ${res.status}`);
    } catch (e) {
        lastError = e;
    }

    // 2. Try direct fetch (works on localhost / same-origin)
    try {
        const res = await fetch(urlStr, options);
        if (res.ok || [404, 401, 403, 422].includes(res.status)) {
            if (res.ok) console.debug(`Successfully fetched: ${urlStr} via direct`);
            return res;
        }
        lastError = new Error(`Status: ${res.status}`);
    } catch (e) {
        lastError = e;
    }

    // 3. Try CORS proxy fallbacks
    for (const proxyBase of CORS_PROXIES) {
        try {
            const finalUrl = `${proxyBase}${encodeURIComponent(urlStr)}`;
            const res = await fetch(finalUrl, options);
            if (res.ok || [404, 401, 403, 422].includes(res.status)) {
                if (res.ok) console.debug(`Successfully fetched: ${urlStr} via ${proxyBase}`);
                return res;
            }
            lastError = new Error(`Status: ${res.status}`);
        } catch (e) {
            lastError = e;
        }
    }
    throw lastError;
};

const getAuthHeaders = (apiKey: string) => {
  const trimmed = apiKey.trim();
  const cleanKey = trimmed.toLowerCase().startsWith('apikey-v1')
    ? trimmed.substring(9).trim()
    : trimmed;

  return {
    'Authorization': `ApiKey-v1 ${cleanKey}`,
    'Accept': 'application/json',
  };
};

export const getTaskTitle = (t?: any): string => {
    if (!t) return "Unknown task";
    
    const extract = (val: any): string | null => {
        if (!val) return null;
        if (typeof val === 'string') return val.replace(/<[^>]*>/g, '').trim();
        if (typeof val === 'object') {
            if (val.text) return extract(val.text);
            if (Array.isArray(val.content)) return val.content.map((c: any) => extract(c)).filter(Boolean).join(' ');
            if (val.title) return extract(val.title);
        }
        return null;
    };

    const short = t.shortIntro || t.short_intro || t.comments?.shortIntro;
    const content = t.content;
    const intro = t.intro || t.text || t.question || t.title;

    return extract(short) || extract(content) || extract(intro) || t.id || "Unknown task";
};

const mapApiTasksToGameTasks = (data: any[]): GameTask[] => {
    return data.map((task: any) => ({
        id: task.id,
        title: getTaskTitle(task),
        type: task.type || 'unknown',
        raw: task
    }));
};

export const fetchGames = async (apiKey: string): Promise<GameListItem[]> => {
    if (apiKey === 'GUEST') return [];
    const headers = getAuthHeaders(apiKey);
    const endpoints = [
        `${V4_BASE_URL}/games?limit=1000`,
        `${V3_BASE_URL}/games?limit=1000`
    ];

    const allFetchedGames: GameListItem[] = [];
    const seenIds = new Set<string>();

    for (const url of endpoints) {
        try {
            const response = await fetchWithRetry(url, { headers });
            if (response.ok) {
                const json = await response.json();
                const items = Array.isArray(json) ? json : (json.items || json.data || []);
                items.forEach((game: any) => {
                    if (!game.id || seenIds.has(game.id)) return;
                    seenIds.add(game.id);
                    allFetchedGames.push({
                        id: game.id,
                        name: game.title || game.name || game.id,
                        created: game.eventDate || game.date || game.startTime || game.start || game.created || game.createdAt,
                        isPlayable: game.playable !== false,
                        status: game.status
                    });
                });
            }
        } catch (e) {}
    }

    return allFetchedGames;
};

export const fetchGameInfo = async (gameId: string, apiKey: string): Promise<GameInfo> => {
  const headers = getAuthHeaders(apiKey);
  const infoEndpoints = [
      `${V4_BASE_URL}/games/${gameId}?includeTasks=true`,
      `${V3_BASE_URL}/games/${gameId}`
  ];

  for (const url of infoEndpoints) {
      try {
          const response = await fetchWithRetry(url, { headers });
          if (response.ok) {
              const data = await response.json();
              return {
                  name: data.title || data.name || gameId,
                  intro: data.intro,
                  outro: data.outro,
                  logoUrl: data.logoUrl || data.imageUrl,
                  tasks: data.tasks || data.questions
              };
          }
      } catch (e) {}
  }
  return { name: gameId };
};

export const fetchGameTasks = async (gameId: string, apiKey: string): Promise<GameTask[]> => {
    const headers = getAuthHeaders(apiKey);
    const taskEndpoints = [
        `${V4_BASE_URL}/games/${gameId}/tasks?limit=500`,
        `${V4_BASE_URL}/tasks?gameId=${gameId}&limit=500`,
        `${V3_BASE_URL}/games/${gameId}/questions?limit=500`
    ];

    for (const url of taskEndpoints) {
        try {
            const response = await fetchWithRetry(url, { headers });
            if (response.ok) {
                const json = await response.json();
                const data = Array.isArray(json) ? json : (json.data || json.items || []);
                if (data.length > 0) {
                    return mapApiTasksToGameTasks(data);
                }
            }
        } catch (e) {}
    }
    return [];
};

export const fetchGameResults = async (gameId: string, apiKey: string): Promise<PlayerResult[]> => {
  const headers = getAuthHeaders(apiKey);
  
  const resultEndpoints = [
      `${V4_BASE_URL}/games/${gameId}/results?sort=-totalScore&includeAnswers=true&limit=100`,
      `${V4_BASE_URL}/results?gameId=${gameId}&includeAnswers=true&limit=100`,
      `${V3_BASE_URL}/games/${gameId}/results`
  ];

  for (const url of resultEndpoints) {
      try {
          const response = await fetchWithRetry(url, { headers });
          if (response.ok) {
              const json = await response.json();
              const data: any[] = Array.isArray(json) ? json : (json.data || json.items || []);
              
              if (data.length === 0) continue;

              return data.map((team, index) => {
                  const answers = (team.answers || []).map((a: any) => {
                      const taskId = a.taskId || a.questionId || a.task?.id || a.question?.id || a.question_id;
                      return {
                          taskId: taskId || 'unknown-id',
                          isCorrect: a.isCorrect === true || (a.score && a.score > 0),
                          score: a.score || 0,
                          raw: a
                      };
                  }).filter((a: any) => a.taskId !== 'unknown-id');

                  return {
                      position: team.position || index + 1,
                      name: team.name || team.teamName || 'Unknown Team',
                      score: team.totalScore ?? team.answersScore ?? team.score ?? 0,
                      correctAnswers: team.correctAnswers,
                      incorrectAnswers: team.incorrectAnswers,
                      isFinished: team.isFinished,
                      color: team.color,
                      answers
                  };
              });
          }
      } catch (e) {}
  }
  return [];
};

export const fetchGamePhotos = async (gameId: string, apiKey: string): Promise<GamePhoto[]> => {
    const headers = getAuthHeaders(apiKey);
    let photos: any[] = [];
    
    const endpoints = [
        `${V4_BASE_URL}/results/media?gameId=${gameId}&limit=200`,
        `${V4_BASE_URL}/results/${gameId}/media`,
        `${V3_BASE_URL}/results/${gameId}/media`
    ];

    for (const url of endpoints) {
        try {
            const res = await fetchWithRetry(url, { headers });
            if (res.ok) {
                const json = await res.json();
                const data = Array.isArray(json) ? json : (json.items || json.data || []);
                if (data.length > 0) {
                    photos = [...photos, ...data];
                }
            }
        } catch (e) {}
    }

    // Comprehensive team/answer media scanning
    try {
        const results = await fetchGameResults(gameId, apiKey);
        results.forEach(team => {
            const teamRaw = (team as any).raw || {};
            
            // Check team-level media
            const teamMedia = teamRaw.media || [];
            if (Array.isArray(teamMedia)) {
                teamMedia.forEach(m => photos.push({ ...m, teamName: team.name }));
            }

            // Check individual answer media
            team.answers?.forEach(ans => {
                const raw = ans.raw || {};
                const possibleUrls = [
                    raw.mediaUrl, raw.url, raw.file, raw.imageUrl, 
                    raw.answer?.mediaUrl, raw.answer?.url
                ];
                
                possibleUrls.forEach(url => {
                    if (url && typeof url === 'string' && url.startsWith('http')) {
                        photos.push({ ...raw, url, teamName: team.name, taskTitle: 'Photo' });
                    }
                });
            });
        });
    } catch (e) {}

    const seenUrls = new Set<string>();
    return photos
        .map((p: any) => {
            const url = p.url || p.mediaUrl || p.file || p.imageUrl || p.large;
            const thumb = p.thumbnailUrl || p.thumbnail || p.thumb || p.small || url;
            return {
                id: p.id || String(Math.random()),
                url: url,
                thumbnailUrl: thumb,
                teamName: p.team?.name || p.teamName || 'Unknown Team',
                taskTitle: getTaskTitle(p.task || p.question) || p.taskTitle || 'Photo',
                timestamp: p.timestamp || p.created || p.createdAt
            };
        })
        .filter(p => {
            if (!p.url || seenUrls.has(p.url)) return false;
            seenUrls.add(p.url);
            return true;
        });
};

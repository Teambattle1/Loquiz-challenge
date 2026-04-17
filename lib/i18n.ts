import { useEffect, useState, useCallback } from 'react';

export type Lang = 'da' | 'en';

const STORAGE_KEY = 'loquiz_lang';
const EVENT = 'loquiz-lang-change';

const getInitialLang = (): Lang => {
    if (typeof window === 'undefined') return 'da';
    const stored = localStorage.getItem(STORAGE_KEY) as Lang | null;
    if (stored === 'da' || stored === 'en') return stored;
    return (navigator.language || '').toLowerCase().startsWith('da') ? 'da' : 'en';
};

export const setLang = (lang: Lang): void => {
    localStorage.setItem(STORAGE_KEY, lang);
    window.dispatchEvent(new CustomEvent(EVENT, { detail: lang }));
};

export const useLang = (): [Lang, (lang: Lang) => void] => {
    const [lang, setStateLang] = useState<Lang>(getInitialLang);
    useEffect(() => {
        const handler = (e: Event) => setStateLang((e as CustomEvent).detail);
        window.addEventListener(EVENT, handler);
        return () => window.removeEventListener(EVENT, handler);
    }, []);
    const update = useCallback((l: Lang) => setLang(l), []);
    return [lang, update];
};

type Dict = Record<string, { da: string; en: string }>;

const dict: Dict = {
    // SessionDashboard
    'menu.results': { da: 'Resultater', en: 'Results' },
    'menu.showtime': { da: 'Showtime', en: 'Showtime' },
    'menu.taskmaster': { da: 'TaskMaster', en: 'TaskMaster' },
    'menu.timeline': { da: 'Tidslinje', en: 'Timeline' },
    'menu.client': { da: 'Klient', en: 'Client' },
    'menu.admin': { da: 'Admin', en: 'Admin' },
    'menu.copyDirectLink': { da: 'Kopiér direkte link til', en: 'Copy direct link to' },
    'menu.copyLink': { da: 'Kopiér link', en: 'Copy link' },
    'menu.copySessionLink': { da: '🔗 Kopiér session-link', en: '🔗 Copy session link' },
    'menu.linkCopied': { da: '✓ Link kopieret', en: '✓ Link copied' },

    // ClientHub
    'hub.title': { da: 'Klient-hub', en: 'Client Hub' },
    'hub.back': { da: 'Tilbage', en: 'Back' },
    'hub.tab.tasks': { da: 'Opgaver', en: 'Tasks' },
    'hub.tab.photos': { da: 'Billeder', en: 'Photos' },
    'hub.tab.share': { da: 'Del link', en: 'Share link' },
    'hub.selectAll': { da: 'Vælg alle', en: 'Select all' },
    'hub.deselectAll': { da: 'Fravælg alle', en: 'Deselect all' },
    'hub.saveTasks': { da: 'Gem opgaver', en: 'Save tasks' },
    'hub.saving': { da: 'Gemmer...', en: 'Saving...' },
    'hub.hideAll': { da: 'Skjul alle', en: 'Hide all' },
    'hub.showAll': { da: 'Vis alle', en: 'Show all' },
    'hub.savePhotos': { da: 'Gem billeder', en: 'Save photos' },
    'hub.noTasks': { da: 'Ingen opgaver fundet', en: 'No tasks found' },
    'hub.noPhotos': { da: 'Ingen billeder fundet', en: 'No photos found' },
    'hub.share.clientLink': { da: 'Klient-link', en: 'Client link' },
    'hub.share.publicPage': { da: 'Fælles klient-side', en: 'Shared client page' },
    'hub.share.explainer': { da: 'Afkryds 1-3. Valget indlejres i linket.', en: 'Check 1-3. The selection is embedded in the link.' },
    'hub.share.section.tasks': { da: 'Opgaver', en: 'Tasks' },
    'hub.share.section.photos': { da: 'Billeder', en: 'Photos' },
    'hub.share.section.ranking': { da: 'Rangliste', en: 'Ranking' },
    'hub.share.section.teams': { da: 'Hold-links', en: 'Team links' },
    'hub.share.visible': { da: 'synlige', en: 'visible' },
    'hub.share.photos': { da: 'billeder', en: 'photos' },
    'hub.share.teams': { da: 'hold', en: 'teams' },
    'hub.share.copy': { da: 'Kopier', en: 'Copy' },
    'hub.share.copied': { da: 'Kopieret!', en: 'Copied!' },
    'hub.share.directLinks': { da: 'Direkte sektion-links', en: 'Direct section links' },
    'hub.share.enableSection': { da: 'Aktiver sektionen ovenfor for at dele dette link', en: 'Enable the section above to share this link' },
    'hub.share.teamLinks': { da: 'Hold-specifikke links', en: 'Team-specific links' },
    'hub.share.teamVisible': { da: 'synlige for klient', en: 'visible to client' },
    'hub.share.teamsExplainerOn': { da: 'Klik kopier for at få et link. Brug øjet for at skjule et hold for klienten på det fælles klient-link.', en: 'Click copy to get a link. Use the eye icon to hide a team from the client on the shared client link.' },
    'hub.share.teamsExplainerOff': { da: 'Linker direkte til ranglisten med holdets placering markeret og åbner hold-detalje under Svar.', en: "Links directly to the ranking with the team's position highlighted and opens team detail under Answers." },
    'hub.share.hideTeam': { da: 'Skjul for klient', en: 'Hide from client' },
    'hub.share.showTeam': { da: 'Vis for klient', en: 'Show to client' },
    'hub.share.copyTeam': { da: '🔗 Kopier', en: '🔗 Copy' },

    // PublicGallery
    'public.tab.photos': { da: 'Billeder', en: 'Photos' },
    'public.tab.ranking': { da: 'Rangliste', en: 'Ranking' },
    'public.tab.tasks': { da: 'Opgaver', en: 'Tasks' },
    'public.tab.answers': { da: 'Svar', en: 'Answers' },
    'public.tab.teams': { da: 'Hold-links', en: 'Team links' },
    'public.photos.count': { da: 'billeder', en: 'photos' },
    'public.photos.selected': { da: 'valgt', en: 'selected' },
    'public.photos.selectAll': { da: 'Vælg alle', en: 'Select all' },
    'public.photos.deselectAll': { da: 'Fravælg alle', en: 'Deselect all' },
    'public.photos.download': { da: 'Download', en: 'Download' },
    'public.photos.downloadAll': { da: 'Download alle', en: 'Download all' },
    'public.loading': { da: 'Henter galleri...', en: 'Loading gallery...' },
    'public.notFound.title': { da: 'Ikke fundet', en: 'Not found' },
    'public.notFound.body': { da: 'Linket er måske udløbet eller findes ikke.', en: 'This link may have expired or does not exist.' },
    'public.empty.photos': { da: 'Ingen billeder endnu', en: 'No photos yet' },
    'public.empty.tasks': { da: 'Ingen opgaver delt endnu', en: 'No tasks shared yet' },
    'public.empty.ranking': { da: 'Ingen resultater endnu', en: 'No results yet' },
    'public.empty.answers': { da: 'Ingen svar endnu', en: 'No answers yet' },
    'public.empty.teams': { da: 'Ingen hold endnu', en: 'No teams yet' },
    'public.empty.body': { da: 'Denne sektion fyldes når spillet er afviklet.', en: 'This section fills up once the game has been played.' },
    'public.answers.clickTeam': { da: 'Klik på et hold for at se billeder og svar', en: 'Click a team to see photos and answers' },
    'public.answers.back': { da: '← Tilbage til hold-oversigt', en: '← Back to team overview' },
    'public.answers.photos': { da: 'Billeder', en: 'Photos' },
    'public.answers.answersHeading': { da: 'Svar', en: 'Answers' },
    'public.answers.noData': { da: 'Ingen data for dette hold', en: 'No data for this team' },
    'public.teams.heading': { da: 'Hold-links', en: 'Team links' },
    'public.teams.explainer': { da: 'Klik et hold for at kopiere det direkte link.', en: 'Click a team to copy its direct link.' },
    'public.footer': { da: 'TeamChallenge Foto-galleri', en: 'TeamChallenge Photo Gallery' },
    'common.points': { da: 'point', en: 'pts' },
    'common.position': { da: 'Placering', en: 'Position' },
};

export const t = (key: string, lang: Lang): string => {
    const entry = dict[key];
    if (!entry) return key;
    return entry[lang];
};

export const useT = (): ((key: string) => string) => {
    const [lang] = useLang();
    return useCallback((key: string) => t(key, lang), [lang]);
};

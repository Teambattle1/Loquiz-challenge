import { PlayerResult } from '../types';

// Hold med præcis 0 point har reelt ikke spillet — vi skjuler dem fra alle
// ranglister (admin-results, public ranking, podium-reveal) så scene-listen
// ikke er fyldt op med spøgelses-teams der ikke har scoret.
export const filterScoringResults = (results: PlayerResult[]): PlayerResult[] =>
    results.filter(r => (r.score ?? 0) > 0);

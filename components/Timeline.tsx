import React, { useState, useMemo } from 'react';
import { PlayerResult, GameTask } from '../types';

interface TimelineProps {
    tasks: GameTask[];
    results: PlayerResult[];
}

interface TimelineEntry {
    taskId: string;
    taskTitle: string;
    time: number;
    score: number;
    isCorrect: boolean;
    duration: number;
}

type ViewMode = 'team-timeline' | 'time-per-task';

const formatTime = (unix: number): string => {
    const d = new Date(unix * 1000);
    return d.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const formatDuration = (seconds: number): string => {
    if (seconds < 0) seconds = 0;
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`;
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
};

const formatTotalDuration = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const parts: string[] = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    if (s > 0 || parts.length === 0) parts.push(`${s}s`);
    return parts.join(' ');
};

// ─── Time Per Task View ─────────────────────────────────────────────────────
interface TaskTimeData {
    taskId: string;
    taskTitle: string;
    teamTimes: { teamName: string; color: string; duration: number; score: number; isCorrect: boolean }[];
    avgDuration: number;
}

const TimePerTaskView: React.FC<{ tasks: GameTask[]; results: PlayerResult[] }> = ({ tasks, results }) => {
    const tasksById = useMemo(() => Object.fromEntries(tasks.map(t => [t.id, t])), [tasks]);

    const taskTimeData = useMemo((): TaskTimeData[] => {
        // Build per-team sorted answer lists to compute durations
        const teamDurations = new Map<string, Map<string, { duration: number; score: number; isCorrect: boolean }>>();

        results.forEach(team => {
            const answers = (team.answers || []).filter(a => a.raw?.time).sort((a, b) => a.raw.time - b.raw.time);
            const start = team.startTime || (answers[0]?.raw?.time || 0);
            const durations = new Map<string, { duration: number; score: number; isCorrect: boolean }>();

            answers.forEach((a, i) => {
                const prev = i === 0 ? start : answers[i - 1].raw.time;
                const dur = prev > 0 ? a.raw.time - prev : 0;
                durations.set(a.taskId, {
                    duration: dur,
                    score: a.score || 0,
                    isCorrect: a.isCorrect === true || (a.score || 0) > 0,
                });
            });
            teamDurations.set(team.name, durations);
        });

        // Collect all unique taskIds that have at least one answer
        const allTaskIds = new Set<string>();
        results.forEach(team => (team.answers || []).forEach(a => allTaskIds.add(a.taskId)));

        // Build task rows — preserve order from tasks array, then append any extras
        const orderedTaskIds: string[] = [];
        const seen = new Set<string>();
        tasks.forEach(t => { if (allTaskIds.has(t.id) && !seen.has(t.id)) { orderedTaskIds.push(t.id); seen.add(t.id); } });
        allTaskIds.forEach(id => { if (!seen.has(id)) orderedTaskIds.push(id); });

        return orderedTaskIds.map(taskId => {
            const teamTimes: TaskTimeData['teamTimes'] = [];
            results.forEach(team => {
                const d = teamDurations.get(team.name)?.get(taskId);
                if (d) {
                    teamTimes.push({ teamName: team.name, color: team.color || '#666', ...d });
                }
            });
            const durations = teamTimes.map(t => t.duration).filter(d => d > 0);
            const avg = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
            return {
                taskId,
                taskTitle: tasksById[taskId]?.title || taskId,
                teamTimes,
                avgDuration: avg,
            };
        }).filter(t => t.teamTimes.length > 0);
    }, [tasks, results, tasksById]);

    if (taskTimeData.length === 0) {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-zinc-500 font-bold uppercase tracking-widest text-sm">No task timing data available</p>
            </div>
        );
    }

    return (
        <div className="flex-grow overflow-y-auto px-4 md:px-6 py-4">
            <div className="space-y-4 max-w-4xl mx-auto">
                {taskTimeData.map((task, idx) => {
                    const fastest = Math.min(...task.teamTimes.map(t => t.duration).filter(d => d > 0));
                    const slowest = Math.max(...task.teamTimes.map(t => t.duration));

                    return (
                        <div key={task.taskId} className="bg-zinc-900/60 rounded-xl border border-zinc-800/50 overflow-hidden">
                            {/* Task header */}
                            <div className="px-4 py-3 bg-zinc-950/60 border-b border-zinc-800/50 flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-orange-500 font-mono text-xs font-bold">#{idx + 1}</span>
                                        <span className="text-white font-black text-base uppercase tracking-tight leading-tight line-clamp-1">
                                            {task.taskTitle}
                                        </span>
                                    </div>
                                </div>
                                <div className="shrink-0 text-right">
                                    <div className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold">Avg</div>
                                    <div className="text-white font-mono text-lg font-black">{formatDuration(task.avgDuration)}</div>
                                </div>
                            </div>

                            {/* Team times */}
                            <div className="px-4 py-2 space-y-1.5">
                                {task.teamTimes
                                    .sort((a, b) => a.duration - b.duration)
                                    .map((tt, i) => {
                                        const barWidth = slowest > 0 ? Math.max(5, (tt.duration / slowest) * 100) : 50;
                                        const isFastest = tt.duration === fastest && tt.duration > 0;

                                        return (
                                            <div key={i} className="flex items-center gap-3 py-1">
                                                {/* Team name */}
                                                <div className="w-32 shrink-0 flex items-center gap-1.5">
                                                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: tt.color }} />
                                                    <span className="text-white text-xs font-bold uppercase tracking-wide truncate">
                                                        {tt.teamName}
                                                    </span>
                                                </div>

                                                {/* Bar */}
                                                <div className="flex-grow h-7 bg-zinc-800/40 rounded overflow-hidden relative">
                                                    <div
                                                        className={`h-full rounded flex items-center px-2 transition-all ${
                                                            isFastest ? 'bg-green-600/40' :
                                                            tt.duration === slowest ? 'bg-red-600/30' :
                                                            'bg-purple-600/30'
                                                        }`}
                                                        style={{ width: `${barWidth}%` }}
                                                    >
                                                        <span className="text-white font-mono text-xs font-black whitespace-nowrap">
                                                            {formatDuration(tt.duration)}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Score */}
                                                <div className={`w-16 text-right shrink-0 font-mono text-xs font-bold ${
                                                    tt.isCorrect ? 'text-green-400' : 'text-red-400'
                                                }`}>
                                                    {tt.score} pts
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ─── Main Timeline Component ────────────────────────────────────────────────
const Timeline: React.FC<TimelineProps> = ({ tasks, results }) => {
    const [viewMode, setViewMode] = useState<ViewMode>('team-timeline');
    const [selectedTeamIdx, setSelectedTeamIdx] = useState<number>(0);

    const tasksById = useMemo(() => {
        return Object.fromEntries(tasks.map(t => [t.id, t]));
    }, [tasks]);

    const teamsWithTimeline = useMemo(() => {
        return results.filter(team => {
            const answers = team.answers || [];
            return answers.some(a => a.raw?.time);
        });
    }, [results]);

    const selectedTeam = teamsWithTimeline[selectedTeamIdx];

    const timeline = useMemo((): TimelineEntry[] => {
        if (!selectedTeam) return [];
        const sorted = (selectedTeam.answers || [])
            .filter(a => a.raw?.time)
            .map(a => ({
                taskId: a.taskId,
                taskTitle: tasksById[a.taskId]?.title || a.taskId,
                time: a.raw.time as number,
                score: a.score || 0,
                isCorrect: a.isCorrect === true || (a.score || 0) > 0,
                duration: 0,
            }))
            .sort((a, b) => a.time - b.time);
        const start = selectedTeam.startTime || (sorted[0]?.time || 0);
        sorted.forEach((entry, i) => {
            const prev = i === 0 ? start : sorted[i - 1].time;
            entry.duration = prev > 0 ? entry.time - prev : 0;
        });
        return sorted;
    }, [selectedTeam, tasksById]);

    const teamStartTime = selectedTeam?.startTime || (timeline[0]?.time || 0);
    const teamFinishTime = selectedTeam?.finishTime || (timeline[timeline.length - 1]?.time || 0);
    const totalDuration = teamFinishTime && teamStartTime ? teamFinishTime - teamStartTime : 0;

    if (teamsWithTimeline.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8">
                <p className="text-zinc-500 font-bold uppercase tracking-widest text-sm">No timeline data available</p>
                <p className="text-zinc-600 text-xs mt-2">Teams need answer timestamps to build a timeline</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between bg-black/40 px-4 md:px-6 py-3 border-b border-orange-500/30 shrink-0">
                <div className="flex items-center gap-3">
                    <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight">Timeline</h2>
                    {viewMode === 'team-timeline' && (
                        <span className="text-xs bg-orange-600/20 text-orange-400 px-2 py-1 rounded-full font-mono">
                            {timeline.length} answers
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    {viewMode === 'team-timeline' && totalDuration > 0 && (
                        <span className="text-xs text-zinc-400 font-mono uppercase tracking-wider hidden md:block">
                            Total: {formatTotalDuration(totalDuration)}
                        </span>
                    )}
                    {/* View mode toggle */}
                    <div className="flex bg-zinc-800/60 rounded-lg p-0.5">
                        <button
                            onClick={() => setViewMode('team-timeline')}
                            className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${
                                viewMode === 'team-timeline'
                                    ? 'bg-orange-600 text-white'
                                    : 'text-zinc-400 hover:text-white'
                            }`}
                        >
                            Team
                        </button>
                        <button
                            onClick={() => setViewMode('time-per-task')}
                            className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${
                                viewMode === 'time-per-task'
                                    ? 'bg-purple-600 text-white'
                                    : 'text-zinc-400 hover:text-white'
                            }`}
                        >
                            Per Task
                        </button>
                    </div>
                </div>
            </div>

            {/* View: Time Per Task */}
            {viewMode === 'time-per-task' && (
                <TimePerTaskView tasks={tasks} results={results} />
            )}

            {/* View: Team Timeline */}
            {viewMode === 'team-timeline' && (
                <>
                    {/* Team selector */}
                    <div className="flex gap-2 px-4 md:px-6 py-3 overflow-x-auto scrollbar-thin border-b border-zinc-800/50 shrink-0">
                        {teamsWithTimeline.map((team, idx) => (
                            <button
                                key={idx}
                                onClick={() => setSelectedTeamIdx(idx)}
                                className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all ${
                                    idx === selectedTeamIdx
                                        ? 'bg-orange-600 text-white shadow-[0_0_20px_rgba(234,88,12,0.4)]'
                                        : 'bg-zinc-800/60 text-zinc-400 hover:bg-zinc-700/60 hover:text-white'
                                }`}
                            >
                                <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: team.color || '#666' }} />
                                {team.name}
                            </button>
                        ))}
                    </div>

                    {/* Timeline content */}
                    <div className="flex-grow overflow-y-auto px-4 md:px-8 py-6">
                        <div className="max-w-2xl mx-auto relative">
                            <div className="absolute left-[19px] top-0 bottom-0 w-[2px] bg-zinc-800" />

                            {/* Start marker */}
                            {teamStartTime > 0 && (
                                <div className="flex items-center gap-4 mb-3">
                                    <div className="w-10 h-10 rounded-full bg-green-600/20 border-2 border-green-500 flex items-center justify-center z-10 shrink-0">
                                        <span className="text-green-400 text-sm">▶</span>
                                    </div>
                                    <div className="flex items-baseline gap-3">
                                        <span className="text-green-400 font-black text-sm uppercase tracking-widest">Start</span>
                                        <span className="text-green-300 font-mono text-xl font-black">{formatTime(teamStartTime)}</span>
                                    </div>
                                </div>
                            )}

                            {/* Timeline entries */}
                            {timeline.map((entry, idx) => (
                                <React.Fragment key={idx}>
                                    {entry.duration > 0 && (
                                        <div className="flex items-center gap-4 py-1.5 pl-[14px]">
                                            <div className="w-3 flex justify-center">
                                                <div className="text-zinc-600 text-xs font-mono">│</div>
                                            </div>
                                            <span className={`text-xs font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-md ${
                                                entry.duration > 300 ? 'text-red-400 bg-red-500/10 border border-red-500/20' :
                                                entry.duration > 120 ? 'text-yellow-400 bg-yellow-500/10 border border-yellow-500/20' :
                                                'text-zinc-400 bg-zinc-800/50 border border-zinc-700/30'
                                            }`}>
                                                + {formatDuration(entry.duration)}
                                            </span>
                                        </div>
                                    )}

                                    <div className="flex items-start gap-4">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center z-10 shrink-0 border-2 ${
                                            entry.isCorrect
                                                ? 'bg-green-600/10 border-green-500/50'
                                                : 'bg-red-600/10 border-red-500/50'
                                        }`}>
                                            <span className={`text-xs font-black ${entry.isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                                                {idx + 1}
                                            </span>
                                        </div>

                                        <div className={`flex-grow p-3 rounded-lg border-l-4 mb-1 ${
                                            entry.isCorrect
                                                ? 'bg-zinc-900/60 border-l-green-500 border border-green-500/10'
                                                : 'bg-zinc-900/60 border-l-red-500 border border-red-500/10'
                                        }`}>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-orange-400 font-mono text-lg font-black">
                                                    {formatTime(entry.time)}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    {entry.duration > 0 && (
                                                        <span className="text-purple-400 font-mono text-sm font-bold bg-purple-500/10 px-2 py-0.5 rounded">
                                                            ⏱ {formatDuration(entry.duration)}
                                                        </span>
                                                    )}
                                                    <span className={`text-sm font-mono font-bold px-2 py-0.5 rounded ${
                                                        entry.isCorrect
                                                            ? 'bg-green-500/10 text-green-400'
                                                            : 'bg-red-500/10 text-red-400'
                                                    }`}>
                                                        {entry.score} PTS
                                                    </span>
                                                </div>
                                            </div>
                                            <p className="text-sm font-black text-white uppercase tracking-tight leading-tight line-clamp-2">
                                                {entry.taskTitle}
                                            </p>
                                        </div>
                                    </div>
                                </React.Fragment>
                            ))}

                            {/* Finish marker */}
                            {teamFinishTime > 0 && timeline.length > 0 && (
                                <>
                                    {teamFinishTime > timeline[timeline.length - 1].time && (
                                        <div className="flex items-center gap-4 py-1.5 pl-[14px]">
                                            <div className="w-3 flex justify-center">
                                                <div className="text-zinc-600 text-xs font-mono">│</div>
                                            </div>
                                            <span className="text-zinc-400 text-xs font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-zinc-800/50 border border-zinc-700/30">
                                                + {formatDuration(teamFinishTime - timeline[timeline.length - 1].time)}
                                            </span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-4 mt-3">
                                        <div className="w-10 h-10 rounded-full bg-orange-600/20 border-2 border-orange-500 flex items-center justify-center z-10 shrink-0">
                                            <span className="text-orange-400 text-sm">■</span>
                                        </div>
                                        <div className="flex items-baseline gap-3">
                                            <span className="text-orange-400 font-black text-sm uppercase tracking-widest">Finish</span>
                                            <span className="text-orange-300 font-mono text-xl font-black">{formatTime(teamFinishTime)}</span>
                                            {totalDuration > 0 && (
                                                <span className="text-zinc-500 font-mono text-sm font-bold">({formatTotalDuration(totalDuration)})</span>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default Timeline;

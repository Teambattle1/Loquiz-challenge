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
}

const formatTime = (unix: number): string => {
    const d = new Date(unix * 1000);
    return d.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const formatDuration = (seconds: number): string => {
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

const Timeline: React.FC<TimelineProps> = ({ tasks, results }) => {
    const [selectedTeamIdx, setSelectedTeamIdx] = useState<number>(0);

    const tasksById = useMemo(() => {
        return Object.fromEntries(tasks.map(t => [t.id, t]));
    }, [tasks]);

    // Filter teams that have answers with timestamps
    const teamsWithTimeline = useMemo(() => {
        return results.filter(team => {
            const answers = team.answers || [];
            return answers.some(a => a.raw?.time);
        });
    }, [results]);

    const selectedTeam = teamsWithTimeline[selectedTeamIdx];

    const timeline = useMemo((): TimelineEntry[] => {
        if (!selectedTeam) return [];
        return (selectedTeam.answers || [])
            .filter(a => a.raw?.time)
            .map(a => ({
                taskId: a.taskId,
                taskTitle: tasksById[a.taskId]?.title || a.taskId,
                time: a.raw.time,
                score: a.score || 0,
                isCorrect: a.isCorrect === true || (a.score || 0) > 0,
            }))
            .sort((a, b) => a.time - b.time);
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
                    <span className="text-xs bg-orange-600/20 text-orange-400 px-2 py-1 rounded-full font-mono">
                        {timeline.length} answers
                    </span>
                </div>
                {totalDuration > 0 && (
                    <span className="text-xs text-zinc-400 font-mono uppercase tracking-wider">
                        Total: {formatTotalDuration(totalDuration)}
                    </span>
                )}
            </div>

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
                    {/* Vertical line */}
                    <div className="absolute left-[19px] top-0 bottom-0 w-[2px] bg-zinc-800" />

                    {/* Start marker */}
                    {teamStartTime > 0 && (
                        <div className="flex items-center gap-4 mb-2">
                            <div className="w-10 h-10 rounded-full bg-green-600/20 border-2 border-green-500 flex items-center justify-center z-10 shrink-0">
                                <span className="text-green-400 text-sm">▶</span>
                            </div>
                            <div>
                                <span className="text-green-400 font-black text-xs uppercase tracking-widest">Start</span>
                                <span className="text-zinc-500 font-mono text-xs ml-3">{formatTime(teamStartTime)}</span>
                            </div>
                        </div>
                    )}

                    {/* Timeline entries */}
                    {timeline.map((entry, idx) => {
                        const prevTime = idx === 0 ? teamStartTime : timeline[idx - 1].time;
                        const gap = prevTime > 0 ? entry.time - prevTime : 0;

                        return (
                            <React.Fragment key={idx}>
                                {/* Time gap indicator */}
                                {gap > 0 && (
                                    <div className="flex items-center gap-4 py-1 pl-[14px]">
                                        <div className="w-3 flex justify-center">
                                            <div className="text-zinc-600 text-[10px] font-mono tracking-wider">│</div>
                                        </div>
                                        <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded ${
                                            gap > 300 ? 'text-red-400/80 bg-red-500/5' :
                                            gap > 120 ? 'text-yellow-400/80 bg-yellow-500/5' :
                                            'text-zinc-500 bg-zinc-800/30'
                                        }`}>
                                            + {formatDuration(gap)}
                                        </span>
                                    </div>
                                )}

                                {/* Answer block */}
                                <div className="flex items-start gap-4">
                                    {/* Dot */}
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center z-10 shrink-0 border-2 ${
                                        entry.isCorrect
                                            ? 'bg-green-600/10 border-green-500/50'
                                            : 'bg-red-600/10 border-red-500/50'
                                    }`}>
                                        <span className={`text-xs font-black ${entry.isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                                            {idx + 1}
                                        </span>
                                    </div>

                                    {/* Card */}
                                    <div className={`flex-grow p-3 rounded-lg border-l-4 mb-1 ${
                                        entry.isCorrect
                                            ? 'bg-zinc-900/60 border-l-green-500 border border-green-500/10'
                                            : 'bg-zinc-900/60 border-l-red-500 border border-red-500/10'
                                    }`}>
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="text-sm font-black text-white uppercase tracking-tight leading-tight line-clamp-2">
                                                    {entry.taskTitle}
                                                </p>
                                                <p className="text-zinc-500 font-mono text-[10px] mt-1">
                                                    {formatTime(entry.time)}
                                                </p>
                                            </div>
                                            <div className={`text-xs font-mono px-2 py-1 rounded shrink-0 ${
                                                entry.isCorrect
                                                    ? 'bg-green-500/10 text-green-400'
                                                    : 'bg-red-500/10 text-red-400'
                                            }`}>
                                                {entry.score} PTS
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </React.Fragment>
                        );
                    })}

                    {/* Finish marker */}
                    {teamFinishTime > 0 && timeline.length > 0 && (
                        <>
                            {/* Gap to finish */}
                            {teamFinishTime > timeline[timeline.length - 1].time && (
                                <div className="flex items-center gap-4 py-1 pl-[14px]">
                                    <div className="w-3 flex justify-center">
                                        <div className="text-zinc-600 text-[10px] font-mono tracking-wider">│</div>
                                    </div>
                                    <span className="text-zinc-500 text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-800/30">
                                        + {formatDuration(teamFinishTime - timeline[timeline.length - 1].time)}
                                    </span>
                                </div>
                            )}
                            <div className="flex items-center gap-4 mt-2">
                                <div className="w-10 h-10 rounded-full bg-orange-600/20 border-2 border-orange-500 flex items-center justify-center z-10 shrink-0">
                                    <span className="text-orange-400 text-sm">■</span>
                                </div>
                                <div>
                                    <span className="text-orange-400 font-black text-xs uppercase tracking-widest">Finish</span>
                                    <span className="text-zinc-500 font-mono text-xs ml-3">{formatTime(teamFinishTime)}</span>
                                    {totalDuration > 0 && (
                                        <span className="text-zinc-600 font-mono text-[10px] ml-3">({formatTotalDuration(totalDuration)})</span>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Timeline;

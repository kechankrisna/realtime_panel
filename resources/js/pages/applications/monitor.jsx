import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useParams } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/axios';
import { AppLayout } from '@/components/layout/AppLayout';
import { createEcho } from '@/lib/echo';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    ChevronLeft, Activity, Wifi, WifiOff, Trash2, Pause, Play,
    Download, ChevronDown, ChevronRight, Circle,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTs(date) {
    return date.toISOString().replace('T', ' ').slice(0, 23);
}

function eventCategory(eventName) {
    if (!eventName) return 'unknown';
    if (eventName.startsWith('pusher:')) return 'system';
    if (eventName.startsWith('pusher_internal:')) return 'internal';
    if (eventName.startsWith('client-')) return 'client';
    return 'server';
}

const CATEGORY_STYLE = {
    system:   { dot: 'bg-zinc-400',  badge: 'bg-zinc-800 text-zinc-300 border-zinc-700',  row: '' },
    internal: { dot: 'bg-yellow-500', badge: 'bg-yellow-900/60 text-yellow-300 border-yellow-800', row: 'bg-yellow-950/10' },
    client:   { dot: 'bg-blue-400',  badge: 'bg-blue-900/60 text-blue-300 border-blue-800',   row: 'bg-blue-950/10' },
    server:   { dot: 'bg-emerald-400', badge: 'bg-emerald-900/60 text-emerald-300 border-emerald-800', row: 'bg-emerald-950/10' },
    unknown:  { dot: 'bg-zinc-600',  badge: 'bg-zinc-900 text-zinc-500 border-zinc-800',   row: '' },
};

function tryParseData(raw) {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'object') return raw;
    try { return JSON.parse(raw); } catch { return raw; }
}

function JsonTree({ value, depth = 0 }) {
    const [open, setOpen] = useState(depth < 2);
    if (value === null || value === undefined) return <span className="text-zinc-500">null</span>;
    if (typeof value === 'boolean') return <span className="text-orange-400">{String(value)}</span>;
    if (typeof value === 'number') return <span className="text-cyan-400">{value}</span>;
    if (typeof value === 'string') return <span className="text-green-400">"{value}"</span>;
    if (Array.isArray(value)) {
        if (value.length === 0) return <span className="text-zinc-500">[]</span>;
        return (
            <span>
                <button onClick={() => setOpen(o => !o)} className="text-zinc-400 hover:text-white">
                    {open ? '▾' : '▸'} [{value.length}]
                </button>
                {open && (
                    <div className="ml-4 border-l border-zinc-800 pl-2 mt-0.5 space-y-0.5">
                        {value.map((v, i) => (
                            <div key={i} className="flex gap-1.5 items-start text-xs">
                                <span className="text-zinc-600 select-none">{i}:</span>
                                <JsonTree value={v} depth={depth + 1} />
                            </div>
                        ))}
                    </div>
                )}
            </span>
        );
    }
    if (typeof value === 'object') {
        const keys = Object.keys(value);
        if (keys.length === 0) return <span className="text-zinc-500">{'{}'}</span>;
        return (
            <span>
                <button onClick={() => setOpen(o => !o)} className="text-zinc-400 hover:text-white">
                    {open ? '▾' : '▸'} {'{'}…{'}'} ({keys.length})
                </button>
                {open && (
                    <div className="ml-4 border-l border-zinc-800 pl-2 mt-0.5 space-y-0.5">
                        {keys.map((k) => (
                            <div key={k} className="flex gap-1.5 items-start text-xs">
                                <span className="text-purple-400 select-none shrink-0">"{k}":</span>
                                <JsonTree value={value[k]} depth={depth + 1} />
                            </div>
                        ))}
                    </div>
                )}
            </span>
        );
    }
    return <span className="text-zinc-300">{String(value)}</span>;
}

// ---------------------------------------------------------------------------
// EventRow
// ---------------------------------------------------------------------------

function EventRow({ ev, selected, onSelect }) {
    const cat = eventCategory(ev.event);
    const style = CATEGORY_STYLE[cat];
    const parsedData = tryParseData(ev.data);
    const isSelected = selected === ev.id;

    return (
        <>
            <tr
                onClick={() => onSelect(isSelected ? null : ev.id)}
                className={`cursor-pointer select-none border-b border-zinc-900 transition-colors hover:bg-zinc-800/60 ${isSelected ? 'bg-zinc-800/80' : style.row}`}
            >
                <td className="pl-3 pr-2 py-2 w-4">
                    <Circle className={`h-2 w-2 fill-current ${style.dot.replace('bg-', 'text-')}`} />
                </td>
                <td className="px-2 py-2 text-xs font-mono text-zinc-500 whitespace-nowrap">
                    {formatTs(ev.ts)}
                </td>
                <td className="px-2 py-2">
                    <span className={`inline-block text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded border ${style.badge}`}>
                        {ev.event}
                    </span>
                </td>
                <td className="px-2 py-2 text-xs font-mono text-zinc-400 max-w-[180px] truncate">
                    {ev.channel ?? <span className="text-zinc-700">—</span>}
                </td>
                <td className="px-2 py-2 text-xs text-zinc-500 max-w-[240px] truncate font-mono">
                    {parsedData !== null ? (
                        typeof parsedData === 'object'
                            ? <span className="text-zinc-600">{JSON.stringify(parsedData).slice(0, 80)}{JSON.stringify(parsedData).length > 80 ? '…' : ''}</span>
                            : String(parsedData).slice(0, 80)
                    ) : <span className="text-zinc-700">—</span>}
                </td>
                <td className="pr-3 py-2 w-5">
                    {isSelected
                        ? <ChevronDown className="h-3 w-3 text-zinc-500" />
                        : <ChevronRight className="h-3 w-3 text-zinc-700" />}
                </td>
            </tr>
            {isSelected && (
                <tr className="border-b border-zinc-900 bg-zinc-900/60">
                    <td colSpan={6} className="px-4 py-3">
                        <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                            <div>
                                <p className="text-zinc-600 uppercase tracking-widest text-[10px] mb-1">Event</p>
                                <p className="text-white">{ev.event}</p>
                            </div>
                            <div>
                                <p className="text-zinc-600 uppercase tracking-widest text-[10px] mb-1">Channel</p>
                                <p className="text-zinc-300">{ev.channel ?? '—'}</p>
                            </div>
                            <div className="col-span-2">
                                <p className="text-zinc-600 uppercase tracking-widest text-[10px] mb-1">Data</p>
                                <div className="rounded-lg bg-zinc-950 border border-zinc-800 p-3 text-xs overflow-x-auto leading-relaxed">
                                    <JsonTree value={parsedData} depth={0} />
                                </div>
                            </div>
                            <div className="col-span-2">
                                <p className="text-zinc-600 uppercase tracking-widest text-[10px] mb-1">Raw Frame</p>
                                <div className="rounded-lg bg-zinc-950 border border-zinc-800 p-3 text-xs overflow-x-auto leading-relaxed">
                                    <JsonTree value={ev.raw} depth={0} />
                                </div>
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ApplicationMonitorPage() {
    const { id } = useParams({ from: '/applications/$id/monitor' });

    const { data: app, isLoading } = useQuery({
        queryKey: ['application', id],
        queryFn: () => api.get(`/applications/${id}`).then((r) => r.data),
    });

    const [events, setEvents] = useState([]);
    const [connected, setConnected] = useState(false);
    const [connectedAt, setConnectedAt] = useState(null);
    const [paused, setPaused] = useState(false);
    const [filter, setFilter] = useState('');
    const [selectedId, setSelectedId] = useState(null);
    const [eventsPerMin, setEventsPerMin] = useState(0);

    const pausedRef = useRef(false);
    const eventIdRef = useRef(0);
    const echoRef = useRef(null);
    const eventsRef = useRef([]); // mirror of events for rate calculation

    const togglePause = () => {
        pausedRef.current = !pausedRef.current;
        setPaused(pausedRef.current);
    };

    const clearEvents = () => {
        setEvents([]);
        eventsRef.current = [];
        setSelectedId(null);
        eventIdRef.current = 0;
    };

    const exportJson = () => {
        const blob = new Blob([JSON.stringify(eventsRef.current.map(e => ({
            id: e.id,
            ts: e.ts.toISOString(),
            event: e.event,
            channel: e.channel,
            data: tryParseData(e.data),
            raw: e.raw,
        })), null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `monitor-${app?.name ?? id}-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Rate counter — recalculate every 5s
    useEffect(() => {
        const iv = setInterval(() => {
            const cutoff = Date.now() - 60_000;
            const recent = eventsRef.current.filter(e => e.ts.getTime() > cutoff);
            setEventsPerMin(recent.length);
        }, 5000);
        return () => clearInterval(iv);
    }, []);

    // Patch the Pusher WebSocket to intercept all frames
    const patchSocket = useCallback((pusher) => {
        // Small delay — Pusher sets up the socket asynchronously
        const tryPatch = (attempt = 0) => {
            const ws = pusher.connection.socket;
            if (!ws && attempt < 20) {
                setTimeout(() => tryPatch(attempt + 1), 50);
                return;
            }
            if (!ws) return;

            const origOnMessage = ws.onmessage;
            ws.onmessage = (msgEvent) => {
                if (!pausedRef.current) {
                    try {
                        const parsed = JSON.parse(msgEvent.data);
                        const ev = {
                            id: ++eventIdRef.current,
                            ts: new Date(),
                            event: parsed.event ?? '(unknown)',
                            channel: parsed.channel ?? null,
                            data: parsed.data ?? null,
                            raw: parsed,
                        };
                        eventsRef.current = [ev, ...eventsRef.current].slice(0, 500);
                        setEvents([...eventsRef.current]);
                    } catch {}
                }
                origOnMessage?.call(ws, msgEvent);
            };
        };
        tryPatch();
    }, []);

    // Connect Echo when app key is available
    useEffect(() => {
        if (!app?.key) return;

        const echo = createEcho({ key: app.key });
        echoRef.current = echo;
        const pusher = echo.connector.pusher;
        const conn = pusher.connection;

        conn.bind('connected', () => {
            setConnected(true);
            setConnectedAt(new Date());
            patchSocket(pusher);
        });
        conn.bind('reconnected', () => {
            setConnected(true);
            patchSocket(pusher);
        });
        conn.bind('disconnected', () => setConnected(false));
        conn.bind('unavailable',  () => setConnected(false));
        conn.bind('failed',       () => setConnected(false));

        return () => {
            echo.disconnect();
            echoRef.current = null;
            setConnected(false);
        };
    }, [app?.key, patchSocket]);

    // Filtered events
    const filterLower = filter.toLowerCase();
    const displayed = filter
        ? events.filter(e =>
            e.event.toLowerCase().includes(filterLower) ||
            (e.channel ?? '').toLowerCase().includes(filterLower)
        )
        : events;

    // Connection uptime
    const [uptime, setUptime] = useState('');
    useEffect(() => {
        if (!connectedAt) return;
        const iv = setInterval(() => {
            const secs = Math.floor((Date.now() - connectedAt.getTime()) / 1000);
            const h = Math.floor(secs / 3600);
            const m = Math.floor((secs % 3600) / 60);
            const s = secs % 60;
            setUptime(h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`);
        }, 1000);
        return () => clearInterval(iv);
    }, [connectedAt]);

    return (
        <AppLayout>
            <div className="space-y-4 h-full flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-2 text-sm">
                        <Link
                            to="/applications"
                            className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Applications
                        </Link>
                        <span className="text-muted-foreground/40">/</span>
                        {isLoading ? (
                            <span className="text-muted-foreground">Loading…</span>
                        ) : (
                            <>
                                <span className="text-muted-foreground">{app?.name}</span>
                                <span className="text-muted-foreground/40">/</span>
                                <span className="font-semibold flex items-center gap-1.5">
                                    <Activity className="h-3.5 w-3.5 text-emerald-500" />
                                    Monitor
                                </span>
                            </>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <Badge variant={connected ? 'success' : 'secondary'} className="gap-1.5 text-xs">
                            {connected
                                ? <><Wifi className="h-3 w-3" /> Connected</>
                                : <><WifiOff className="h-3 w-3" /> {isLoading ? 'Loading…' : 'Disconnected'}</>}
                        </Badge>
                    </div>
                </div>

                {/* Stats bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-shrink-0">
                    {[
                        { label: 'Total Events', value: events.length, accent: 'text-white' },
                        { label: 'Displayed', value: displayed.length, accent: 'text-zinc-300' },
                        { label: 'Events / min', value: eventsPerMin, accent: 'text-emerald-400' },
                        { label: 'Uptime', value: connected ? (uptime || '0s') : '—', accent: 'text-blue-400' },
                    ].map(({ label, value, accent }) => (
                        <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3">
                            <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-0.5">{label}</p>
                            <p className={`text-2xl font-black font-mono tabular-nums ${accent}`}>{value}</p>
                        </div>
                    ))}
                </div>

                {/* App info bar */}
                {app && (
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 flex flex-wrap gap-x-6 gap-y-1.5 text-xs font-mono flex-shrink-0">
                        <span className="text-zinc-600">ID: <span className="text-zinc-300">{app.id}</span></span>
                        <span className="text-zinc-600">Key: <span className="text-zinc-300">{app.key}</span></span>
                        <span className="text-zinc-600">Secret: <span className="text-zinc-500">{app.secret}</span></span>
                        <span className="text-zinc-600">Status:{' '}
                            <span className={app.enabled ? 'text-emerald-400' : 'text-red-400'}>
                                {app.enabled ? 'enabled' : 'disabled'}
                            </span>
                        </span>
                    </div>
                )}

                {/* Controls */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="relative flex-1 max-w-xs">
                        <Input
                            placeholder="Filter by event or channel…"
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="pl-8 h-8 text-xs bg-zinc-950 border-zinc-800 text-zinc-200 placeholder:text-zinc-600"
                        />
                        <Activity className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-600 pointer-events-none" />
                    </div>

                    <button
                        onClick={togglePause}
                        className={`flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-semibold border transition-all ${
                            paused
                                ? 'bg-yellow-500/10 border-yellow-700/50 text-yellow-400 hover:bg-yellow-500/20'
                                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                        }`}
                    >
                        {paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
                        {paused ? 'Resume' : 'Pause'}
                    </button>

                    <button
                        onClick={clearEvents}
                        className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-semibold border border-zinc-800 bg-zinc-900 text-zinc-500 hover:text-red-400 hover:border-red-900/50 transition-all"
                    >
                        <Trash2 className="h-3 w-3" />
                        Clear
                    </button>

                    <button
                        onClick={exportJson}
                        disabled={events.length === 0}
                        className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-semibold border border-zinc-800 bg-zinc-900 text-zinc-500 hover:text-blue-400 hover:border-blue-900/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <Download className="h-3 w-3" />
                        Export
                    </button>

                    {paused && (
                        <span className="text-xs text-yellow-500/80 font-medium animate-pulse ml-1">⏸ Paused</span>
                    )}
                </div>

                {/* Event log table */}
                <div className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden flex flex-col min-h-0">
                    {/* Table header */}
                    <div className="border-b border-zinc-800 bg-zinc-900/50">
                        <table className="w-full text-xs">
                            <thead>
                                <tr>
                                    <th className="pl-3 pr-2 py-2 w-4"></th>
                                    <th className="px-2 py-2 text-left font-semibold text-zinc-600 uppercase tracking-widest text-[10px] whitespace-nowrap w-44">Timestamp</th>
                                    <th className="px-2 py-2 text-left font-semibold text-zinc-600 uppercase tracking-widest text-[10px]">Event</th>
                                    <th className="px-2 py-2 text-left font-semibold text-zinc-600 uppercase tracking-widest text-[10px]">Channel</th>
                                    <th className="px-2 py-2 text-left font-semibold text-zinc-600 uppercase tracking-widest text-[10px]">Data</th>
                                    <th className="pr-3 py-2 w-5"></th>
                                </tr>
                            </thead>
                        </table>
                    </div>

                    {/* Scrollable body */}
                    <div className="flex-1 overflow-y-auto">
                        {displayed.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-40 gap-3 select-none">
                                <Activity className="h-8 w-8 text-zinc-800" />
                                <p className="text-sm text-zinc-700">
                                    {connected
                                        ? filter
                                            ? 'No events match your filter.'
                                            : 'Listening… waiting for events.'
                                        : 'Connecting to Soketi…'}
                                </p>
                            </div>
                        ) : (
                            <table className="w-full text-xs">
                                <tbody>
                                    {displayed.map((ev) => (
                                        <EventRow
                                            key={ev.id}
                                            ev={ev}
                                            selected={selectedId}
                                            onSelect={setSelectedId}
                                        />
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="border-t border-zinc-900 px-3 py-1.5 flex items-center justify-between flex-shrink-0">
                        <div className="flex items-center gap-4 text-[10px] text-zinc-700">
                            {Object.entries(CATEGORY_STYLE).filter(([k]) => k !== 'unknown').map(([cat, s]) => (
                                <span key={cat} className="flex items-center gap-1">
                                    <Circle className={`h-1.5 w-1.5 fill-current ${s.dot.replace('bg-', 'text-')}`} />
                                    {cat}
                                </span>
                            ))}
                        </div>
                        <span className="text-[10px] text-zinc-800 font-mono">max 500 events buffered</span>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

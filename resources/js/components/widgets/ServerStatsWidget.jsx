import { useQuery } from '@tanstack/react-query';
import api from '@/lib/axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Activity, MemoryStick, Wifi, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

function MemoryCard({ data, isError }) {
    const pct = data?.memory_percent ?? null;

    // V8 heap fills up quickly at startup then expands automatically — only
    // flag as warning/error at levels where GC pressure is genuinely high.
    const status = pct === null ? 'idle'
        : pct >= 98 ? 'critical'   // GC thrashing very likely
        : pct >= 90 ? 'warning'    // approaching expansion threshold
        : 'ok';

    const color = { idle: '', ok: 'text-green-500', warning: 'text-yellow-500', critical: 'text-destructive' }[status];
    const barColor = { idle: 'bg-muted', ok: 'bg-green-500', warning: 'bg-yellow-500', critical: 'bg-destructive' }[status];

    const used = data?.memory_used ?? null;
    const total = data?.memory_total ?? null;

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">JS Heap Usage</CardTitle>
                <div className="flex items-center gap-1.5">
                    <TooltipProvider delayDuration={100}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Info className="h-3.5 w-3.5 cursor-help text-muted-foreground/60" />
                            </TooltipTrigger>
                            <TooltipContent side="left" className="max-w-56 text-xs">
                                V8 JavaScript heap used by the Soketi process. High % is normal — V8 starts with a small heap and auto-expands as load grows. This does not limit WebSocket connections.
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <MemoryStick className={cn('h-4 w-4', isError ? 'text-destructive' : 'text-muted-foreground')} />
                </div>
            </CardHeader>
            <CardContent className="space-y-2">
                {isError || !data ? (
                    <p className={cn('text-2xl font-bold', isError && 'text-destructive')}>{isError ? 'N/A' : '…'}</p>
                ) : (
                    <>
                        <div className="flex items-end justify-between gap-2">
                            <div>
                                <p className="text-2xl font-bold">{used ?? '…'}</p>
                                <p className="text-xs text-muted-foreground">of {total} heap</p>
                            </div>
                            {pct !== null && (
                                <span className={cn('text-sm font-semibold tabular-nums', color)}>
                                    {pct}%
                                </span>
                            )}
                        </div>
                        {pct !== null && (
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                                <div
                                    className={cn('h-full rounded-full transition-all duration-500', barColor)}
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                        )}
                        {status === 'warning' && (
                            <p className="text-xs text-yellow-500">Heap nearing limit — will auto-expand</p>
                        )}
                        {status === 'critical' && (
                            <p className="text-xs text-destructive">GC pressure high — heap may be growing</p>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}

export function ServerStatsWidget() {
    const { data, isError } = useQuery({
        queryKey: ['metrics'],
        queryFn: () => api.get('/metrics').then((r) => r.data),
        refetchInterval: 5000,
        retry: false,
    });

    if (data === null) return null; // metrics disabled

    return (
        <div className="grid gap-4 sm:grid-cols-3">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Server Started</CardTitle>
                    <Activity className={cn('h-4 w-4', isError ? 'text-destructive' : 'text-muted-foreground')} />
                </CardHeader>
                <CardContent>
                    <p className={cn('text-2xl font-bold', isError && 'text-destructive')}>
                        {isError ? 'N/A' : (data?.started_at ?? '…')}
                    </p>
                </CardContent>
            </Card>

            <MemoryCard data={data} isError={isError} />

            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Open Connections</CardTitle>
                    <Wifi className={cn('h-4 w-4', isError ? 'text-destructive' : 'text-muted-foreground')} />
                </CardHeader>
                <CardContent>
                    <p className={cn('text-2xl font-bold', isError && 'text-destructive')}>
                        {isError ? 'N/A' : (data?.total_connections ?? '…')}
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}

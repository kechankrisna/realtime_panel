import { useQuery } from '@tanstack/react-query';
import api from '@/lib/axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Cpu, HardDrive, Network, Server, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

function StatCard({ title, icon: Icon, value, sub, tooltip, accent, progress, progressAccent }) {
    return (
        <Card className="bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                <div className="flex items-center gap-1.5">
                    {tooltip && (
                        <TooltipProvider delayDuration={100}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Info className="h-3.5 w-3.5 cursor-help text-muted-foreground/60" />
                                </TooltipTrigger>
                                <TooltipContent side="left" className="max-w-56 text-xs">{tooltip}</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                    <Icon className={cn('h-4 w-4', accent ?? 'text-muted-foreground')} />
                </div>
            </CardHeader>
            <CardContent>
                <p className="text-2xl font-bold">{value ?? '…'}</p>
                {progress != null && (
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                            className={cn('h-full rounded-full transition-all', progressAccent ?? 'bg-primary')}
                            style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                    </div>
                )}
                {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
            </CardContent>
        </Card>
    );
}

export function SystemStatsWidget() {
    const { data, isError } = useQuery({
        queryKey: ['metrics'],
        queryFn: () => api.get('/metrics').then((r) => r.data),
        refetchInterval: 5000,
        retry: false,
    });

    if (data === null) return null; // metrics disabled

    const cpuPct  = data?.cpu_percent ?? null;
    const cpuAccent = cpuPct != null && cpuPct >= 80 ? 'text-yellow-500' : undefined;
    const cpuBarAccent = cpuPct == null ? undefined : cpuPct >= 80 ? 'bg-yellow-500' : 'bg-primary';

    const ramPct    = data?.ram_percent ?? null;
    const ramAccent    = ramPct != null && ramPct >= 80 ? 'text-yellow-500' : undefined;
    const ramBarAccent = ramPct == null ? undefined : ramPct >= 80 ? 'bg-yellow-500' : 'bg-primary';

    const diskPct      = data?.disk_percent ?? null;
    const diskAccent    = diskPct != null && diskPct >= 80 ? 'text-yellow-500' : undefined;
    const diskBarAccent = diskPct == null ? undefined : diskPct >= 80 ? 'bg-yellow-500' : 'bg-primary';

    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
                title="CPU Usage"
                icon={Cpu}
                value={isError ? 'N/A' : (cpuPct != null ? `${cpuPct}%` : '…')}
                sub={cpuPct != null ? `${cpuPct}% of 1 core` : 'Calculating…'}
                progress={cpuPct}
                progressAccent={cpuBarAccent}
                accent={cpuAccent}
                tooltip="CPU usage of the Soketi process as a percentage of one core, measured over the last ~5 seconds. Node.js is single-threaded so 100% means one full core saturated. Shows '…' on first load while the baseline is established."
            />
            <StatCard
                title="RAM Usage"
                icon={Server}
                value={isError ? 'N/A' : (ramPct != null ? `${ramPct}%` : (data?.ram_rss ?? '…'))}
                sub={data?.ram_rss && data?.ram_total_mb ? `${data.ram_rss} of ${data.ram_total_mb} MB` : 'Resident set size'}
                progress={ramPct}
                progressAccent={ramBarAccent}
                accent={ramAccent}
                tooltip="Soketi process RSS (physical memory) as a percentage of total system RAM. Turns yellow at ≥80%."
            />
            <StatCard
                title="Network Traffic"
                icon={Network}
                value={isError ? 'N/A' : (data ? `↑ ${data.net_transmitted}` : '…')}
                sub={data ? `↓ ${data.net_received} received` : undefined}
                tooltip="Cumulative bytes sent (↑) and received (↓) by Soketi across all WebSocket and HTTP API connections since server start."
            />
            <StatCard
                title="Disk Usage"
                icon={HardDrive}
                value={isError ? 'N/A' : (diskPct != null ? `${diskPct}%` : '…')}
                sub={data?.disk_used && data?.disk_total ? `${data.disk_used} of ${data.disk_total}` : 'Disk partition usage'}
                progress={diskPct}
                progressAccent={diskBarAccent}
                accent={diskAccent}
                tooltip="Disk space used vs total on the partition where Soketi is installed. Turns yellow at ≥80%."
            />
        </div>
    );
}

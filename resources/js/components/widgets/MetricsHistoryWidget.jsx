import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '@/lib/axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

const PERIODS = [
    { value: 'live', label: 'Live' },
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'this_week', label: 'This Week' },
    { value: 'last_week', label: 'Last Week' },
    { value: 'this_month', label: 'This Month' },
    { value: 'last_month', label: 'Last Month' },
];

export function MetricsHistoryWidget() {
    const [period, setPeriod] = useState('live');
    const [applicationId, setApplicationId] = useState('all');

    const { data: appsData } = useQuery({
        queryKey: ['applications'],
        queryFn: () => api.get('/applications').then((r) => r.data.data),
    });

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const { data: historyData, isPending } = useQuery({
        queryKey: ['metrics-history', period, applicationId, timezone],
        queryFn: () =>
            api
                .get('/metrics/history', {
                    params: {
                        period,
                        timezone,
                        ...(applicationId !== 'all' && { application_id: applicationId }),
                    },
                })
                .then((r) => r.data),
        refetchInterval: period === 'live' ? 30_000 : false,
        staleTime: 0,
    });

    const chartData = historyData?.data ?? [];

    return (
        <Card>
            <CardHeader className="pb-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <CardTitle className="text-base font-semibold">Connection History</CardTitle>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <Select value={period} onValueChange={setPeriod}>
                            <SelectTrigger className="w-full sm:w-40">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {PERIODS.map(({ value, label }) => (
                                    <SelectItem key={value} value={value}>
                                        {label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={applicationId} onValueChange={setApplicationId}>
                            <SelectTrigger className="w-full sm:w-44">
                                <SelectValue placeholder="All Apps" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Apps</SelectItem>
                                {(appsData ?? []).map((app) => (
                                    <SelectItem key={app.id} value={String(app.id)}>
                                        {app.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {isPending ? (
                    <div className="flex h-[200px] items-center justify-center">
                        <p className="text-sm text-muted-foreground">Loading…</p>
                    </div>
                ) : chartData.length === 0 ? (
                    <div className="flex h-[200px] items-center justify-center">
                        <p className="text-sm text-muted-foreground">
                            No data yet. Metrics are collected every minute.
                        </p>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                            <defs>
                                <linearGradient id="connectionsGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="hsl(var(--border))"
                                vertical={false}
                            />
                            <XAxis
                                dataKey="label"
                                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                                tickLine={false}
                                axisLine={false}
                                interval="preserveStartEnd"
                            />
                            <YAxis
                                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                                tickLine={false}
                                axisLine={false}
                                allowDecimals={false}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'hsl(var(--popover))',
                                    border: '1px solid hsl(var(--border))',
                                    borderRadius: '6px',
                                    color: 'hsl(var(--popover-foreground))',
                                    fontSize: 12,
                                }}
                                cursor={{ stroke: 'hsl(var(--border))' }}
                                formatter={(value) => [value, 'Connections']}
                            />
                            <Area
                                type="monotone"
                                dataKey="connections"
                                stroke="hsl(var(--primary))"
                                strokeWidth={2}
                                fill="url(#connectionsGradient)"
                                dot={false}
                                activeDot={{ r: 4, fill: 'hsl(var(--primary))' }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </CardContent>
        </Card>
    );
}

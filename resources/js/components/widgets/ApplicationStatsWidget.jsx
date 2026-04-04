import { useQuery } from '@tanstack/react-query';
import api from '@/lib/axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Layers, CheckCircle, XCircle } from 'lucide-react';

export function ApplicationStatsWidget() {
    const { data } = useQuery({
        queryKey: ['application-stats'],
        queryFn: () => api.get('/applications/stats').then((r) => r.data),
    });

    const stats = [
        { label: 'Total Applications', value: data?.total ?? '…', icon: Layers, color: '' },
        { label: 'Active Applications', value: data?.active ?? '…', icon: CheckCircle, color: 'text-green-600' },
        { label: 'Inactive Applications', value: data?.inactive ?? '…', icon: XCircle, color: 'text-yellow-500' },
    ];

    return (
        <div className="grid gap-4 sm:grid-cols-3">
            {stats.map((stat) => (
                <Card key={stat.label}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
                        <stat.icon className={`h-4 w-4 ${stat.color || 'text-muted-foreground'}`} />
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">{stat.value}</p>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

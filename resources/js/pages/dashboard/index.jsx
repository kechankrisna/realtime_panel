import { AppLayout } from '@/components/layout/AppLayout';
import { ServerStatsWidget } from '@/components/widgets/ServerStatsWidget';
import { SystemStatsWidget } from '@/components/widgets/SystemStatsWidget';
import { ApplicationStatsWidget } from '@/components/widgets/ApplicationStatsWidget';
import { MetricsHistoryWidget } from '@/components/widgets/MetricsHistoryWidget';

export default function DashboardPage() {
    return (
        <AppLayout>
            <div className="space-y-6">
                <h1 className="text-2xl font-bold">Dashboard</h1>
                <ServerStatsWidget />
                <MetricsHistoryWidget />
                <SystemStatsWidget />
                <ApplicationStatsWidget />
            </div>
        </AppLayout>
    );
}

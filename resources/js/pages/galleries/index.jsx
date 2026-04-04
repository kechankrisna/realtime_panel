import { Link } from '@tanstack/react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Zap, Radio, BarChart2, Crown } from 'lucide-react';

const apps = [
    {
        title: 'Chat',
        description: 'Real-time group chat over a Soketi channel. Pick an application, join a channel, and exchange messages instantly.',
        href: '/galleries/chat',
        icon: MessageCircle,
        badge: 'Live',
        badgeVariant: 'default',
        color: 'text-blue-500',
        bg: 'bg-blue-500/10',
    },
    {
        title: 'Chess',
        description: 'Play chess against a minimax AI or challenge another player in real time via a Soketi channel.',
        href: '/galleries/chess',
        icon: Crown,
        badge: 'Live',
        badgeVariant: 'default',
        color: 'text-orange-500',
        bg: 'bg-orange-500/10',
    },
    {
        title: 'Live Events',
        description: 'Stream custom events to subscribers in real time. Great for notifications, feeds, and live updates.',
        href: null,
        icon: Zap,
        badge: 'Coming soon',
        badgeVariant: 'secondary',
        color: 'text-yellow-500',
        bg: 'bg-yellow-500/10',
    },
    {
        title: 'Presence Channel',
        description: 'Track who is currently online in a channel. Build collaborative features with live user lists.',
        href: null,
        icon: Radio,
        badge: 'Coming soon',
        badgeVariant: 'secondary',
        color: 'text-purple-500',
        bg: 'bg-purple-500/10',
    },
    {
        title: 'Live Dashboard',
        description: 'Push real-time metrics and charts to connected clients without polling.',
        href: null,
        icon: BarChart2,
        badge: 'Coming soon',
        badgeVariant: 'secondary',
        color: 'text-green-500',
        bg: 'bg-green-500/10',
    },
];

export default function GalleriesPage() {
    return (
        <AppLayout>
            <div className="mb-6">
                <h1 className="text-2xl font-bold">App Galleries</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Explore real-time application examples powered by your Soketi server.
                </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {apps.map((app) => {
                    const card = (
                        <Card className={`flex h-full flex-col transition-shadow ${app.href ? 'cursor-pointer hover:shadow-md hover:border-primary/40' : 'opacity-60'}`}>
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between gap-2">
                                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${app.bg}`}>
                                        <app.icon className={`h-5 w-5 ${app.color}`} />
                                    </div>
                                    <Badge variant={app.badgeVariant} className="shrink-0 text-xs">
                                        {app.badge}
                                    </Badge>
                                </div>
                                <CardTitle className="mt-3 text-base">{app.title}</CardTitle>
                                <CardDescription className="text-sm leading-relaxed">
                                    {app.description}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="mt-auto pt-0">
                                {app.href ? (
                                    <span className={`text-xs font-medium ${app.color}`}>Open app →</span>
                                ) : (
                                    <span className="text-xs text-muted-foreground/60">Not available yet</span>
                                )}
                            </CardContent>
                        </Card>
                    );

                    return app.href ? (
                        <Link key={app.title} to={app.href} className="flex">
                            {card}
                        </Link>
                    ) : (
                        <div key={app.title} className="flex">
                            {card}
                        </div>
                    );
                })}
            </div>
        </AppLayout>
    );
}

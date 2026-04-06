import { useQuery } from '@tanstack/react-query';
import api from '@/lib/axios';
import { AppLayout } from '@/components/layout/AppLayout';

function CodeBlock({ children }) {
    return (
        <pre className="rounded-md bg-muted p-4 text-sm font-mono overflow-x-auto whitespace-pre-wrap break-all">
            {children}
        </pre>
    );
}

function Section({ title, children }) {
    return (
        <section className="space-y-3">
            <h2 className="text-lg font-semibold">{title}</h2>
            {children}
        </section>
    );
}

export default function ClientDocPage() {
    const { data: cfg } = useQuery({
        queryKey: ['config'],
        queryFn: () => api.get('/config').then((r) => r.data),
    });

    const host = cfg?.app_host ?? 'your-server';
    const port = cfg?.app_port ?? '6001';
    const appName = cfg?.app_name ?? 'realtimepanel';

    return (
        <AppLayout>
            <div className="mx-auto max-w-3xl space-y-8">
                <div>
                    <h1 className="text-2xl font-bold">Client Configuration</h1>
                    <p className="mt-1 text-muted-foreground">How to connect your frontend clients to the <strong>{appName}</strong> WebSocket server.</p>
                </div>

                <Section title="Laravel Echo + Pusher JS">
                    <p className="text-sm text-muted-foreground">Install dependencies:</p>
                    <CodeBlock>npm install --save laravel-echo pusher-js</CodeBlock>
                    <p className="text-sm text-muted-foreground">Configure Echo:</p>
                    <CodeBlock>{`import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

window.Pusher = Pusher;

const echo = new Echo({
    broadcaster: 'pusher',
    key: 'YOUR_APP_KEY',
    wsHost: '${host}',
    wsPort: ${port},
    wssPort: ${port},
    forceTLS: false,
    encrypted: false,
    disableStats: true,
    enabledTransports: ['ws', 'wss'],
    cluster: 'mt1',
});

// Subscribe to a public channel
echo.channel('my-channel').listen('.my-event', (e) => {
    console.log(e);
});`}</CodeBlock>
                </Section>

                <Section title="Pusher JS (without Echo)">
                    <CodeBlock>{`import Pusher from 'pusher-js';

const pusher = new Pusher('YOUR_APP_KEY', {
    wsHost: '${host}',
    wsPort: ${port},
    forceTLS: false,
    cluster: 'mt1',
    enabledTransports: ['ws'],
});

const channel = pusher.subscribe('my-channel');
channel.bind('my-event', (data) => {
    console.log(data);
});`}</CodeBlock>
                </Section>

                <Section title="Private Channels">
                    <p className="text-sm text-muted-foreground">Private channels require server-side auth. Add the auth endpoint to your Echo config:</p>
                    <CodeBlock>{`const echo = new Echo({
    // ...same config as above
    authEndpoint: '/broadcasting/auth',
    auth: {
        headers: { Authorization: 'Bearer YOUR_TOKEN' },
    },
});

echo.private('private-channel').listen('.event', (e) => {
    console.log(e);
});`}</CodeBlock>
                </Section>
            </div>
        </AppLayout>
    );
}

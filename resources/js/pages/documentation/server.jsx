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

export default function ServerDocPage() {
    const { data: cfg } = useQuery({
        queryKey: ['config'],
        queryFn: () => api.get('/config').then((r) => r.data),
    });

    const host = cfg?.app_host ?? 'your-server';
    const port = cfg?.app_port ?? '6001';
    const appUrl = cfg?.app_url ?? 'http://your-server';
    const appName = cfg?.app_name ?? 'soketi';

    return (
        <AppLayout>
            <div className="mx-auto max-w-3xl space-y-8">
                <div>
                    <h1 className="text-2xl font-bold">Server Configuration</h1>
                    <p className="mt-1 text-muted-foreground">How to configure and trigger events from your backend using <strong>{appName}</strong>.</p>
                </div>

                <Section title="Laravel Broadcasting">
                    <p className="text-sm text-muted-foreground">Add to your <code className="text-xs bg-muted px-1 rounded">.env</code>:</p>
                    <CodeBlock>{`BROADCAST_DRIVER=pusher

PUSHER_APP_ID=YOUR_APP_ID
PUSHER_APP_KEY=YOUR_APP_KEY
PUSHER_APP_SECRET=YOUR_APP_SECRET
PUSHER_HOST=${host}
PUSHER_PORT=${port}
PUSHER_SCHEME=http
PUSHER_APP_CLUSTER=mt1`}</CodeBlock>
                    <p className="text-sm text-muted-foreground">In <code className="text-xs bg-muted px-1 rounded">config/broadcasting.php</code>:</p>
                    <CodeBlock>{`'pusher' => [
    'driver' => 'pusher',
    'key' => env('PUSHER_APP_KEY'),
    'secret' => env('PUSHER_APP_SECRET'),
    'app_id' => env('PUSHER_APP_ID'),
    'options' => [
        'host' => env('PUSHER_HOST', '${host}'),
        'port' => env('PUSHER_PORT', ${port}),
        'scheme' => env('PUSHER_SCHEME', 'http'),
        'encrypted' => true,
        'useTLS' => env('PUSHER_SCHEME', 'http') === 'https',
        'cluster' => env('PUSHER_APP_CLUSTER', 'mt1'),
    ],
],`}</CodeBlock>
                </Section>

                <Section title="Triggering Events via HTTP API">
                    <p className="text-sm text-muted-foreground">Soketi exposes the standard Pusher HTTP API at <code className="text-xs bg-muted px-1 rounded">{appUrl}</code>.</p>
                    <CodeBlock>{`# Trigger an event
curl -X POST '${appUrl}/apps/YOUR_APP_ID/events' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "name": "my-event",
    "channel": "my-channel",
    "data": "{\\"message\\":\\"Hello!\\"}"
  }'`}</CodeBlock>
                </Section>

                <Section title="PHP (Pusher PHP SDK)">
                    <CodeBlock>composer require pusher/pusher-php-server</CodeBlock>
                    <CodeBlock>{`$pusher = new Pusher\\Pusher(
    'YOUR_APP_KEY',
    'YOUR_APP_SECRET',
    'YOUR_APP_ID',
    [
        'host' => '${host}',
        'port' => ${port},
        'scheme' => 'http',
        'encrypted' => false,
    ]
);

$pusher->trigger('my-channel', 'my-event', ['message' => 'Hello!']);`}</CodeBlock>
                </Section>

                <Section title="Node.js (Pusher Node SDK)">
                    <CodeBlock>npm install pusher</CodeBlock>
                    <CodeBlock>{`const Pusher = require('pusher');

const pusher = new Pusher({
    appId: 'YOUR_APP_ID',
    key: 'YOUR_APP_KEY',
    secret: 'YOUR_APP_SECRET',
    host: '${host}',
    port: '${port}',
    useTLS: false,
});

pusher.trigger('my-channel', 'my-event', { message: 'Hello!' });`}</CodeBlock>
                </Section>
            </div>
        </AppLayout>
    );
}

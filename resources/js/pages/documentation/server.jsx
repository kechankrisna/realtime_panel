import { useQuery } from '@tanstack/react-query';
import { configQuery, docsEndpoint } from '@/lib/realtime';
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
    const { data: cfg } = useQuery(configQuery);

    // where servers reach Soketi (SOKETI_PUBLIC_*, else this panel's own URL)
    const { host, port, scheme, tls } = docsEndpoint(cfg);
    const appUrl = cfg?.app_url ?? 'http://your-server';
    const appName = cfg?.app_name ?? 'realtimepanel';

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
PUSHER_SCHEME=${scheme}
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
        'scheme' => env('PUSHER_SCHEME', '${scheme}'),
        'encrypted' => true,
        'useTLS' => env('PUSHER_SCHEME', '${scheme}') === 'https',
        'cluster' => env('PUSHER_APP_CLUSTER', 'mt1'),
    ],
],`}</CodeBlock>
                </Section>

                <Section title="Triggering Events via HTTP API">
                    <p className="text-sm text-muted-foreground">
                        This panel accepts the standard Pusher HTTP API at <code className="text-xs bg-muted px-1 rounded">{appUrl}</code>: it
                        forwards each event to Soketi and copies it to the Live Monitor. Events sent straight to Soketi
                        (<code className="text-xs bg-muted px-1 rounded">{`${scheme}://${host}:${port}`}</code>, the settings above) are
                        delivered too, but the Live Monitor does not see them.
                    </p>
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
        'scheme' => '${scheme}',
        'encrypted' => ${tls},
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
    useTLS: ${tls},
});

pusher.trigger('my-channel', 'my-event', { message: 'Hello!' });`}</CodeBlock>
                </Section>
            </div>
        </AppLayout>
    );
}

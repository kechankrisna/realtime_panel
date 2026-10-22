import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { queryClient } from '@/lib/queryClient';
import { configQuery, configuredEndpoint, echoConnectionOptions } from '@/lib/realtime';

window.Pusher = Pusher;

/**
 * endpoint: from useRealtimeEndpoint() ({ host, port, scheme }, or null for the page's own host). Left out, the config
 * already in the query cache decides (pages that connect on a click, long after it loaded).
 */
export function createEcho(app, endpoint) {
    const target = endpoint !== undefined ? endpoint : configuredEndpoint(queryClient.getQueryData(configQuery.queryKey));

    return new Echo({
        broadcaster: 'pusher',
        key: app.key,
        ...echoConnectionOptions(target),
        disableStats: true,
        enabledTransports: ['ws', 'wss'],
        cluster: 'mt1',
    });
}

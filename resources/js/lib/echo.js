import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

window.Pusher = Pusher;

export function createEcho(app) {
    return new Echo({
        broadcaster: 'pusher',
        key: app.key,
        wsHost: window.location.hostname,
        wsPort: window.location.port || (window.location.protocol === 'https:' ? 443 : 80),
        wssPort: window.location.port || 443,
        forceTLS: window.location.protocol === 'https:',
        encrypted: window.location.protocol === 'https:',
        disableStats: true,
        enabledTransports: ['ws', 'wss'],
        cluster: 'mt1',
    });
}

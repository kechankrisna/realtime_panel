import api from '@/lib/axios';

/** GET /api/config, shared by every page that needs it (one cache entry). */
export const configQuery = {
    queryKey: ['config'],
    queryFn: () => api.get('/config').then((r) => r.data),
    staleTime: 5 * 60_000,
};

function normalize(publicEndpoint) {
    const scheme = publicEndpoint.scheme === 'http' ? 'http' : 'https';
    const port = Number(publicEndpoint.port) || (scheme === 'https' ? 443 : 80);
    return { host: publicEndpoint.host, port, scheme };
}

/**
 * The public Soketi endpoint the server is configured with (SOKETI_PUBLIC_HOST), or null: then the browser connects to
 * the page's own host, which the bundled nginx forwards to Soketi.
 */
export function configuredEndpoint(cfg) {
    const p = cfg?.soketi_public;
    if (!p?.configured || !p.host) return null;
    return normalize(p);
}

/** Host, port and TLS options for Laravel Echo / pusher-js. */
export function echoConnectionOptions(endpoint, location = window.location) {
    if (!endpoint) {
        // the page's own host: exactly the behaviour from before SOKETI_PUBLIC_*
        const https = location.protocol === 'https:';
        return {
            wsHost: location.hostname,
            wsPort: location.port || (https ? 443 : 80),
            wssPort: location.port || 443,
            forceTLS: https,
            encrypted: https,
        };
    }

    const tls = endpoint.scheme === 'https';
    if (!tls && location.protocol === 'https:') {
        console.warn(`Soketi endpoint ${endpoint.host}:${endpoint.port} is plain http on an https page: the browser will block it (set SOKETI_PUBLIC_SCHEME=https).`);
    }
    return { wsHost: endpoint.host, wsPort: endpoint.port, wssPort: endpoint.port, forceTLS: tls, encrypted: tls };
}

/** Values for the Documentation pages' snippets: where clients and servers reach Soketi. */
export function docsEndpoint(cfg) {
    const p = cfg?.soketi_public;
    if (p?.host) {
        const endpoint = normalize(p);
        return { ...endpoint, tls: endpoint.scheme === 'https' };
    }
    // a server from before SOKETI_PUBLIC_*
    return { host: cfg?.app_host ?? 'your-server', port: Number(cfg?.app_port) || 6001, scheme: 'http', tls: false };
}

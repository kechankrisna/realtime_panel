import { describe, it, expect, vi } from 'vitest';
import { configuredEndpoint, docsEndpoint, echoConnectionOptions } from '@/lib/realtime';

const httpsPage = { protocol: 'https:', hostname: 'panel.example.com', port: '' };
const httpPage = { protocol: 'http:', hostname: 'localhost', port: '8080' };

describe('configuredEndpoint', () => {
    it('returns the configured public Soketi endpoint', () => {
        const cfg = { soketi_public: { host: 'pusher.example.com', port: 443, scheme: 'https', configured: true } };
        expect(configuredEndpoint(cfg)).toEqual({ host: 'pusher.example.com', port: 443, scheme: 'https' });
    });

    it('returns null when no public host is configured (the page host is used)', () => {
        const cfg = { soketi_public: { host: 'panel.example.com', port: 443, scheme: 'https', configured: false } };
        expect(configuredEndpoint(cfg)).toBeNull();
    });

    it('returns null for an older server without soketi_public, or no config', () => {
        expect(configuredEndpoint({ app_host: 'panel.example.com' })).toBeNull();
        expect(configuredEndpoint(undefined)).toBeNull();
    });
});

describe('echoConnectionOptions', () => {
    it('connects to the configured endpoint over TLS', () => {
        expect(echoConnectionOptions({ host: 'pusher.example.com', port: 443, scheme: 'https' }, httpsPage)).toEqual({
            wsHost: 'pusher.example.com', wsPort: 443, wssPort: 443, forceTLS: true, encrypted: true,
        });
    });

    it('connects to a plain-http endpoint on its port', () => {
        expect(echoConnectionOptions({ host: 'soketi.local', port: 6001, scheme: 'http' }, httpPage)).toEqual({
            wsHost: 'soketi.local', wsPort: 6001, wssPort: 6001, forceTLS: false, encrypted: false,
        });
    });

    it('warns when an https page is given a plain-http endpoint (the browser blocks it)', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        echoConnectionOptions({ host: 'soketi.local', port: 6001, scheme: 'http' }, httpsPage);
        expect(warn).toHaveBeenCalledOnce();
        warn.mockRestore();
    });

    it('without an endpoint keeps the previous page-host behaviour exactly (https)', () => {
        expect(echoConnectionOptions(null, httpsPage)).toEqual({
            wsHost: 'panel.example.com', wsPort: 443, wssPort: 443, forceTLS: true, encrypted: true,
        });
    });

    it('without an endpoint keeps the previous page-host behaviour exactly (http with a port)', () => {
        expect(echoConnectionOptions(null, httpPage)).toEqual({
            wsHost: 'localhost', wsPort: '8080', wssPort: '8080', forceTLS: false, encrypted: false,
        });
    });
});

describe('docsEndpoint', () => {
    it('shows the public Soketi endpoint from the server', () => {
        const cfg = { soketi_public: { host: 'pusher.example.com', port: 443, scheme: 'https', configured: true } };
        expect(docsEndpoint(cfg)).toEqual({ host: 'pusher.example.com', port: 443, scheme: 'https', tls: true });
    });

    it('shows the derived endpoint when not configured (the panel URL)', () => {
        const cfg = { soketi_public: { host: 'localhost', port: 8080, scheme: 'http', configured: false } };
        expect(docsEndpoint(cfg)).toEqual({ host: 'localhost', port: 8080, scheme: 'http', tls: false });
    });

    it('falls back to the old fields for an older server', () => {
        expect(docsEndpoint({ app_host: 'panel.example.com', app_port: 6001 })).toEqual({
            host: 'panel.example.com', port: 6001, scheme: 'http', tls: false,
        });
        expect(docsEndpoint(undefined)).toEqual({ host: 'your-server', port: 6001, scheme: 'http', tls: false });
    });
});

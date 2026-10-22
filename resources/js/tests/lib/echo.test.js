import { describe, it, expect, vi, beforeEach } from 'vitest';

// No real WebSocket in tests: capture the options createEcho hands to Echo.
const EchoMock = vi.fn();
vi.mock('laravel-echo', () => ({ default: EchoMock }));

const { createEcho } = await import('@/lib/echo');
const { queryClient } = await import('@/lib/queryClient');
const { configQuery } = await import('@/lib/realtime');

const lastOptions = () => EchoMock.mock.calls.at(-1)[0];

describe('createEcho', () => {
    beforeEach(() => {
        EchoMock.mockClear();
        queryClient.clear();
    });

    it('connects to the endpoint it is given', () => {
        createEcho({ key: 'k' }, { host: 'pusher.example.com', port: 443, scheme: 'https' });
        expect(lastOptions()).toMatchObject({ key: 'k', wsHost: 'pusher.example.com', wssPort: 443, forceTLS: true });
    });

    it('uses the cached config when called without an endpoint', () => {
        queryClient.setQueryData(configQuery.queryKey, {
            soketi_public: { host: 'pusher.example.com', port: 443, scheme: 'https', configured: true },
        });
        createEcho({ key: 'k' });
        expect(lastOptions()).toMatchObject({ wsHost: 'pusher.example.com', wssPort: 443, forceTLS: true });
    });

    it('falls back to the page host when nothing is configured', () => {
        createEcho({ key: 'k' }, null);
        expect(lastOptions()).toMatchObject({ wsHost: window.location.hostname });
    });
});

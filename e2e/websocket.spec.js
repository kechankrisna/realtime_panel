/**
 * WebSocket delivery smoke test.
 *
 * Prerequisites: The Docker stack must be running (`docker compose up -d`)
 * with a pre-existing Soketi application whose key/secret/appId match the
 * environment variables below (or the seeded demo app).
 */

import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = 'admin@email.com';
const ADMIN_PASSWORD = 'password';
const API_BASE = 'http://localhost/api';

async function getToken(request) {
    const resp = await request.post(`${API_BASE}/auth/login`, {
        data: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    });
    const { token } = await resp.json();
    return token;
}

async function getFirstEnabledApp(request, token) {
    const resp = await request.get(`${API_BASE}/applications?filter=active&per_page=1`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
    });
    const { data } = await resp.json();
    return data?.[0] ?? null;
}

test.describe('WebSocket message delivery (requires Docker stack)', () => {
    test.skip(process.env.E2E_WEBSOCKET !== '1', 'Set E2E_WEBSOCKET=1 to run WebSocket tests');

    test('chat message is delivered via WebSocket', async ({ page, browser }) => {
        const token = await getToken(page.request);
        const app = await getFirstEnabledApp(page.request, token);

        if (!app) {
            test.skip('No enabled application found — seed one first');
        }

        // Second context will receive the message
        const receiverContext = await browser.newContext();
        const receiverPage = await receiverContext.newPage();

        const received = receiverPage.waitForFunction(
            () => window.__ws_received_message,
            { timeout: 15_000 }
        );

        // Inject receiver WebSocket listener
        await receiverPage.goto('/');
        await receiverPage.evaluate(
            ({ appId, appKey, host, port }) => {
                window.__ws_received_message = false;
                const ws = new window.Pusher(appKey, {
                    wsHost: host,
                    wsPort: port,
                    forceTLS: false,
                    cluster: 'mt1',
                });
                const channel = ws.subscribe('chat-e2e-test');
                channel.bind('message', () => {
                    window.__ws_received_message = true;
                });
            },
            { appId: app.id, appKey: app.key, host: 'localhost', port: 6001 }
        );

        // Send the chat message via API
        await page.request.post(`${API_BASE}/chat/trigger`, {
            data: JSON.stringify({
                application_id: app.id,
                channel: 'chat-e2e-test',
                data: { id: 'e2e-1', sender: 'Playwright', content: 'Hello E2E!' },
            }),
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
        });

        await received;

        await receiverContext.close();
    });
});

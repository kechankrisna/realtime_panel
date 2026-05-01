import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = process.env.SUPER_USER_EMAIL || 'admin@email.com';
const ADMIN_PASSWORD = process.env.SUPER_USER_PASSWORD || 'password';

async function loginAs(page, email = ADMIN_EMAIL, password = ADMIN_PASSWORD) {
    await page.goto('/');
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole('button', { name: /sign in|login/i }).click();
    await expect(page).not.toHaveURL(/\/login/);
}

test.describe('Applications', () => {
    test('admin can view applications page', async ({ page }) => {
        await loginAs(page);
        await page.goto('/applications');

        await expect(page.getByRole('heading', { name: /applications/i })).toBeVisible();
    });

    test('admin can create a new application', async ({ page }) => {
        await loginAs(page);
        await page.goto('/applications');

        await page.getByRole('button', { name: /new|create|add/i }).first().click();

        const appName = `E2E Test App ${Date.now()}`;
        await page.getByLabel(/name/i).fill(appName);
        await page.getByRole('button', { name: /save|create|submit/i }).click();

        await expect(page.getByText(appName)).toBeVisible({ timeout: 10_000 });
    });

    test('application key and secret are displayed after creation', async ({ page }) => {
        await loginAs(page);
        await page.goto('/applications');

        await page.getByRole('button', { name: /new|create|add/i }).first().click();

        const appName = `Keys Test App ${Date.now()}`;
        await page.getByLabel(/name/i).fill(appName);
        await page.getByRole('button', { name: /save|create|submit/i }).click();

        await expect(page.getByRole('columnheader', { name: /App Key/i })).toBeVisible({ timeout: 5_000 });
        await expect(page.getByRole('columnheader', { name: /App Secret/i })).toBeVisible({ timeout: 5_000 });
    });

    test('admin can toggle an application active state', async ({ page }) => {
        await loginAs(page);

        // Ensure at least one application exists
        const loginResp = await page.request.post('/api/auth/login', {
            data: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        });
        const { token } = await loginResp.json();
        await page.request.post('/api/applications', {
            data: JSON.stringify({ name: `Toggle Test App ${Date.now()}`, enabled: true }),
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': `Bearer ${token}` },
        });

        await page.goto('/applications');

        // Find the first toggle and click it, then wait for the API to complete
        const toggle = page.getByRole('switch').first();
        await expect(toggle).toBeVisible({ timeout: 10_000 });
        const initialState = await toggle.getAttribute('aria-checked');

        const [response] = await Promise.all([
            page.waitForResponse((r) => r.url().includes('/toggle') && r.request().method() === 'PATCH'),
            toggle.click(),
        ]);
        expect(response.ok()).toBeTruthy();

        // State should have changed after the refetch
        await expect(toggle).not.toHaveAttribute('aria-checked', initialState, { timeout: 5_000 });
    });
});

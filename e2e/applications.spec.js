import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = 'admin@email.com';
const ADMIN_PASSWORD = 'password';

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

        await page.getByLabel(/name/i).fill(`E2E Test App ${Date.now()}`);
        await page.getByRole('button', { name: /save|create|submit/i }).click();

        await expect(page.getByText(/e2e test app/i)).toBeVisible({ timeout: 10_000 });
    });

    test('application key and secret are displayed after creation', async ({ page }) => {
        await loginAs(page);
        await page.goto('/applications');

        await page.getByRole('button', { name: /new|create|add/i }).first().click();

        const appName = `Keys Test App ${Date.now()}`;
        await page.getByLabel(/name/i).fill(appName);
        await page.getByRole('button', { name: /save|create|submit/i }).click();

        // Navigate to the application details
        await page.getByText(new RegExp(appName.substring(0, 10), 'i')).click();

        await expect(page.getByText(/key|secret/i)).toBeVisible({ timeout: 5_000 });
    });

    test('admin can toggle an application active state', async ({ page }) => {
        await loginAs(page);
        await page.goto('/applications');

        // Find the first toggle and click it
        const toggle = page.getByRole('switch').first();
        const initialState = await toggle.getAttribute('aria-checked');
        await toggle.click();

        // State should have changed
        const newState = await toggle.getAttribute('aria-checked');
        expect(newState).not.toBe(initialState);
    });
});

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

test.describe('Users', () => {
    test('admin can view users page', async ({ page }) => {
        await loginAs(page);
        await page.goto('/users');

        await expect(page.getByRole('heading', { name: /users/i })).toBeVisible();
    });

    test('admin can create a new user', async ({ page }) => {
        await loginAs(page);
        await page.goto('/users');

        await page.getByRole('button', { name: /new|create|add/i }).first().click();

        const email = `e2e-user-${Date.now()}@test.com`;
        await page.getByLabel(/name/i).fill('E2E User');
        await page.getByLabel(/email/i).fill(email);
        await page.getByLabel(/password/i).first().fill('password123');
        await page.getByRole('button', { name: /save|create|submit/i }).click();

        await expect(page.getByText(email)).toBeVisible({ timeout: 10_000 });
    });

    test('admin can delete a non-admin user', async ({ page }) => {
        await loginAs(page);

        // Create a user via API first
        const api = page.request;
        const loginResp = await api.post('/api/auth/login', {
            data: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        });
        const { token } = await loginResp.json();

        const createResp = await api.post('/api/users', {
            data: JSON.stringify({
                name: 'Delete Me',
                email: `delete-me-${Date.now()}@test.com`,
                password: 'password123',
                is_admin: false,
                is_active: true,
            }),
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
        });
        const createdUser = await createResp.json();

        await page.goto('/users');

        // Find and delete the user
        const row = page.getByText('Delete Me').first().locator('..');
        await row.getByRole('button', { name: /delete|remove/i }).click();
        await page.getByRole('button', { name: /confirm|yes|delete/i }).click();

        await expect(page.getByText('Delete Me')).toBeHidden({ timeout: 10_000 });
    });
});

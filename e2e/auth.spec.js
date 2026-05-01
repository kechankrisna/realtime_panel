import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = process.env.SUPER_USER_EMAIL || 'admin@email.com';
const ADMIN_PASSWORD = process.env.SUPER_USER_PASSWORD || 'password';

test.describe('Authentication', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('redirects unauthenticated users to login', async ({ page }) => {
        await expect(page).toHaveURL(/\/login/);
    });

    test('admin can log in with valid credentials', async ({ page }) => {
        await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
        await page.getByLabel(/password/i).fill(ADMIN_PASSWORD);
        await page.getByRole('button', { name: /sign in|login/i }).click();

        await expect(page).toHaveURL(/\/(dashboard)?$/);
    });

    test('shows error message for wrong password', async ({ page }) => {
        await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
        await page.getByLabel(/password/i).fill('wrong-password');
        await page.getByRole('button', { name: /sign in|login/i }).click();

        await expect(page.getByText(/invalid|credentials|incorrect/i)).toBeVisible();
    });

    test('authenticated user can log out', async ({ page }) => {
        // Log in first
        await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
        await page.getByLabel(/password/i).fill(ADMIN_PASSWORD);
        await page.getByRole('button', { name: /sign in|login/i }).click();
        await expect(page).toHaveURL(/\/(dashboard)?$/);

        // Log out (click profile dropdown, then sign out)
        await page.getByRole('button', { name: /admin/i }).click();
        await page.getByRole('menuitem', { name: /sign out/i }).click();

        await expect(page).toHaveURL(/\/login/);
    });
});

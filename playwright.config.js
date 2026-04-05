import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './e2e',
    timeout: 30_000,
    retries: 0,
    reporter: 'list',
    use: {
        baseURL: 'http://localhost',
        headless: true,
        screenshot: 'only-on-failure',
        video: 'off',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
});

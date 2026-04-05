import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const screenshotsDir = path.join(__dirname, '..', 'screenshots');
const BASE = 'http://localhost';
const EMAIL = 'admin@email.com';
const PASS  = 'password';
const W = 1440;
const H = 860;

async function shot(page, name) {
    // Disable all CSS animations and transitions for a clean screenshot
    await page.addStyleTag({
        content: `*, *::before, *::after {
            animation-duration: 0s !important;
            animation-delay: 0s !important;
            transition-duration: 0s !important;
            transition-delay: 0s !important;
        }`,
    });
    await page.screenshot({ path: path.join(screenshotsDir, `${name}.png`), fullPage: false });
    console.log(`  ✓ ${name}.png`);
}

// Wait for the SPA to finish rendering a given route.
// #root is the React mount point; we wait until it has children.
async function navigate(page, url) {
    await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
        () => {
            const root = document.getElementById('root');
            return root && root.children.length > 0;
        },
        { timeout: 15000 }
    );
    // Extra settle time for data fetching / animations
    await new Promise(r => setTimeout(r, 1500));
}

(async () => {
    const browser = await puppeteer.launch({
        headless: true,
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--force-device-scale-factor=1',
            `--window-size=${W},${H}`,
        ],
        defaultViewport: { width: W, height: H },
        protocolTimeout: 120000,
    });
    const page = await browser.newPage();
    await page.setViewport({ width: W, height: H });

    // ── Capture login page BEFORE auth ────────────────────────────────────
    console.log('login...');
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('input[type=email]', { timeout: 12000 });
    await new Promise(r => setTimeout(r, 800));
    await shot(page, 'login');

    // ── Authenticate via API — inject token directly into localStorage ─────
    // This is the most reliable approach for SPA + Sanctum token auth.
    console.log('authenticating...');
    const authData = await page.evaluate(async (email, pass) => {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password: pass }),
        });
        return res.json();
    }, EMAIL, PASS);

    if (!authData.token) {
        throw new Error(`Login failed: ${JSON.stringify(authData)}`);
    }

    // Store token + user exactly as useAuth.js does
    await page.evaluate((token, user) => {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
    }, authData.token, authData.user);

    console.log(`  token: ${authData.token.substring(0, 10)}...`);

    // ── Dashboard ──────────────────────────────────────────────────────────
    console.log('dashboard...');
    await navigate(page, '/');
    await new Promise(r => setTimeout(r, 1000)); // let metric cards load
    await shot(page, 'dashboard');

    // ── Applications list ──────────────────────────────────────────────────
    console.log('applications...');
    await navigate(page, '/applications');
    await shot(page, 'view-apps');

    // ── Edit application ───────────────────────────────────────────────────
    console.log('edit-app...');
    await navigate(page, '/applications/1/edit');
    await shot(page, 'edit-app');

    // ── Live Monitor ───────────────────────────────────────────────────────
    console.log('monitor...');
    await navigate(page, '/applications/1/monitor');
    await new Promise(r => setTimeout(r, 2000)); // wait for WS connect + stats
    await shot(page, 'monitor');

    // ── Users ──────────────────────────────────────────────────────────────
    console.log('users...');
    await navigate(page, '/users');
    await shot(page, 'users');

    // ── Playground ────────────────────────────────────────────────────────
    console.log('playground...');
    await navigate(page, '/playground');
    await shot(page, 'playground');

    // ── Galleries index ───────────────────────────────────────────────────
    console.log('galleries...');
    await navigate(page, '/galleries');
    await shot(page, 'galleries');

    // ── Chat gallery ──────────────────────────────────────────────────────
    console.log('galleries-chat...');
    await navigate(page, '/galleries/chat');
    await shot(page, 'galleries-chat');

    // ── Chess gallery ─────────────────────────────────────────────────────
    console.log('galleries-chess...');
    await navigate(page, '/galleries/chess');
    await new Promise(r => setTimeout(r, 800));
    await shot(page, 'galleries-chess');

    // ── Tiến Lên gallery ──────────────────────────────────────────────────
    console.log('galleries-tienlen...');
    await navigate(page, '/galleries/tienlen');
    await new Promise(r => setTimeout(r, 800));
    await shot(page, 'galleries-tienlen');

    // ── Client docs ───────────────────────────────────────────────────────
    console.log('docs-client...');
    await navigate(page, '/documentation/client');
    await shot(page, 'docs-client');

    // ── Server docs ───────────────────────────────────────────────────────
    console.log('docs-server...');
    await navigate(page, '/documentation/server');
    await shot(page, 'docs-server');

    // ── Profile ───────────────────────────────────────────────────────────
    console.log('profile...');
    await navigate(page, '/profile');
    await shot(page, 'profile');

    // ── Light mode — dashboard ─────────────────────────────────────────────
    console.log('dashboard-light...');
    await page.evaluate((token, user) => {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('soketi-theme', 'light');
    }, authData.token, authData.user);
    await navigate(page, '/');
    await new Promise(r => setTimeout(r, 1000));
    await shot(page, 'dashboard-light');

    await browser.close();
    console.log('\nDone! All screenshots saved to screenshots/');
})().catch(err => { console.error(err); process.exit(1); });

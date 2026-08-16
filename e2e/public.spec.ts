import { expect, test } from '@playwright/test';

/**
 * Flows that need no account. These verify routing, auth protection and the
 * PWA surface — the parts most likely to break silently on deploy.
 */

test.describe('landing page', () => {
  test('renders the value proposition and both calls to action', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Create an account' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
  });

  test('shows the medical disclaimer', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/should not be considered medical advice/i)).toBeVisible();
  });

  test('does not scroll horizontally on a phone viewport', async ({ page }) => {
    await page.goto('/');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe('authentication routing', () => {
  const PROTECTED = [
    '/dashboard',
    '/scan',
    '/diet-plan',
    '/history',
    '/progress',
    '/profile',
    '/onboarding',
  ];

  for (const path of PROTECTED) {
    test(`redirects ${path} to the login page when signed out`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`/login\\?redirectTo=${encodeURIComponent(path)}`));
    });
  }

  test('login page has accessible email and password fields', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });

  test('signup page links back to login', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
  });

  test('rejects an invalid email without leaving the page', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('not-an-email');
    await page.getByLabel('Password').fill('whatever');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByText(/valid email address/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('API authorisation', () => {
  const ENDPOINTS = [
    '/api/food/log',
    '/api/progress',
    '/api/nutrition/search?q=rice',
  ];

  for (const endpoint of ENDPOINTS) {
    test(`GET ${endpoint} is rejected when signed out`, async ({ request }) => {
      const response = await request.get(endpoint);
      expect(response.status()).toBe(401);

      const body = await response.json();
      expect(body.error.code).toBe('unauthenticated');
      // No stack traces or internal detail may reach the client.
      expect(JSON.stringify(body)).not.toMatch(/at .*\.(ts|js):\d+/);
    });
  }

  test('analyze rejects an unauthenticated upload', async ({ request }) => {
    const response = await request.post('/api/food/analyze');
    expect(response.status()).toBe(401);
  });
});

test.describe('PWA', () => {
  test('serves a valid, installable manifest', async ({ request }) => {
    const response = await request.get('/manifest.webmanifest');
    expect(response.ok()).toBe(true);

    const manifest = await response.json();
    expect(manifest.name).toBe('MyLyf');
    expect(manifest.short_name).toBe('MyLyf');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBeTruthy();

    // Chrome requires at least a 192px and a 512px icon to offer installation.
    const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');

    // A maskable icon keeps the Android launcher from clipping the artwork.
    expect(
      manifest.icons.some((icon: { purpose?: string }) =>
        icon.purpose?.includes('maskable'),
      ),
    ).toBe(true);
  });

  test('links the manifest and a theme colour from every page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
      'href',
      '/manifest.webmanifest',
    );
    expect(await page.locator('meta[name="theme-color"]').count()).toBeGreaterThan(0);
  });

  test('serves the service worker with no-cache headers', async ({ request }) => {
    const response = await request.get('/sw.js');
    expect(response.ok()).toBe(true);
    expect(response.headers()['cache-control']).toContain('no-cache');
  });

  test('serves every manifest icon', async ({ request }) => {
    const manifest = await (await request.get('/manifest.webmanifest')).json();

    for (const icon of manifest.icons as { src: string }[]) {
      const response = await request.get(icon.src);
      expect(response.ok(), `${icon.src} should be served`).toBe(true);
      expect(response.headers()['content-type']).toContain('image/png');
    }
  });

  test('serves the offline fallback page', async ({ request }) => {
    const response = await request.get('/offline.html');
    expect(response.ok()).toBe(true);
    expect(await response.text()).toContain('offline');
  });

  test('allows the viewport to be zoomed', async ({ page }) => {
    await page.goto('/');
    const viewport = await page
      .locator('meta[name="viewport"]')
      .getAttribute('content');

    // Blocking zoom would fail WCAG 1.4.4.
    expect(viewport).not.toContain('user-scalable=no');
    expect(viewport).not.toContain('maximum-scale=1');
  });
});

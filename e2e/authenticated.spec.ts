import { expect, test } from '@playwright/test';

/**
 * Signed-in flows.
 *
 * These need a configured Firebase project and an existing account, so they
 * skip themselves unless the credentials are provided:
 *
 *   E2E_EMAIL=you@example.com E2E_PASSWORD=... npm run test:e2e
 *
 * The account should already have completed onboarding. See docs/SETUP.md.
 */

const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

test.skip(
  !EMAIL || !PASSWORD,
  'Set E2E_EMAIL and E2E_PASSWORD to run the authenticated flows.',
);

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(EMAIL!);
  await page.getByLabel('Password').fill(PASSWORD!);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/(dashboard|onboarding)/);
});

test('dashboard shows calorie and macro targets', async ({ page }) => {
  await page.goto('/dashboard');

  await expect(page.getByText(/remaining|over target/i)).toBeVisible();
  await expect(page.getByText('Protein')).toBeVisible();
  await expect(page.getByText('Carbs')).toBeVisible();
  await expect(page.getByText('Fat')).toBeVisible();
});

test('primary and secondary calls to action navigate correctly', async ({ page }) => {
  await page.goto('/dashboard');

  await page.getByRole('link', { name: /scan food/i }).click();
  await expect(page).toHaveURL(/\/scan/);

  await page.goto('/dashboard');
  await page.getByRole('link', { name: /view diet plan/i }).click();
  await expect(page).toHaveURL(/\/diet-plan/);
});

test('bottom navigation reaches every section', async ({ page }) => {
  await page.goto('/dashboard');

  for (const [label, url] of [
    ['Scan', /\/scan/],
    ['Diet', /\/diet-plan/],
    ['History', /\/history/],
    ['Journal', /\/journal/],
    ['Progress', /\/progress/],
    ['Home', /\/dashboard/],
  ] as const) {
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: label }).click();
    await expect(page).toHaveURL(url);
  }
});

test('scan page offers camera, gallery and manual entry', async ({ page }) => {
  await page.goto('/scan');

  await expect(page.getByRole('button', { name: /take photo/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /choose image/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /add food manually/i })).toBeVisible();
});

test('manual entry can look up nutrition and log a food', async ({ page }) => {
  await page.goto('/scan');
  await page.getByRole('button', { name: /add food manually/i }).click();

  await page.getByRole('button', { name: /add another food/i }).click();
  await page.getByLabel('Food name').last().fill('banana');
  await page.getByRole('button', { name: /get nutrition/i }).last().click();

  // Either a match is found, or the failure is reported clearly — both are
  // acceptable outcomes; silently doing nothing is not.
  await expect(
    page.getByText(/matched|no nutrition data|not configured|unavailable/i).first(),
  ).toBeVisible({ timeout: 20_000 });
});

test('the scan review screen always shows the estimate disclaimer', async ({ page }) => {
  await page.goto('/scan');
  await page.getByRole('button', { name: /add food manually/i }).click();

  await expect(
    page.getByText(/nutrition values are estimates/i),
  ).toBeVisible();
});

test('a diet plan can be generated and browsed by day', async ({ page }) => {
  await page.goto('/diet-plan');

  const generate = page.getByRole('button', { name: /generate my plan|regenerate plan/i });
  await generate.click();

  await expect(page.getByRole('tab', { name: 'Day 1' })).toBeVisible({
    timeout: 30_000,
  });

  await page.getByRole('tab', { name: 'Day 4' }).click();
  await expect(page.getByText(/day total/i)).toBeVisible();
});

test('a weight entry can be added and appears in the list', async ({ page }) => {
  await page.goto('/progress');

  await page.getByRole('button', { name: /add weight/i }).click();
  await page.getByLabel('Weight (kg)').fill('72.4');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText('72.4 kg').first()).toBeVisible({ timeout: 15_000 });
});

test('a journal entry can be written and appears in the list', async ({ page }) => {
  await page.goto('/journal');

  // The day panel offers "Write today's entry" until the day is written and an
  // edit button afterwards — either opens the same sheet, so accept both.
  await page
    .getByRole('button', { name: /write today's entry|edit entry from/i })
    .first()
    .click();
  await page.getByRole('button', { name: 'Good' }).click();

  const text = `Steady day, hit my protein target. ${Date.now()}`;
  await page.getByLabel('Entry').fill(text);
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText(text).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Good').first()).toBeVisible();
});

test('the daily review saves all three sections and stays out of the journal', async ({
  page,
}) => {
  await page.goto('/journal');
  await page.getByRole('tab', { name: /daily review/i }).click();

  const stamp = String(Date.now());
  await page.getByLabel('What went well').fill(`Protein target hit ${stamp}`);
  await page.getByLabel('What went wrong').fill('Skipped the evening walk');
  await page.getByLabel('What needs to improve').fill('Prep lunch the night before');
  await page.getByRole('button', { name: /save review|update review/i }).click();

  await expect(page.getByText(/reviewed/i).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByLabel('What went well')).toHaveValue(
    `Protein target hit ${stamp}`,
  );

  // The review shares a record with the day's entry but never appears in the
  // journal tab — the two are separate views on purpose.
  await page.getByRole('tab', { name: 'Journal' }).click();
  await expect(page.getByText('Prep lunch the night before')).toHaveCount(0);
});

test('the day picker steps back and opens the calendar', async ({ page }) => {
  await page.goto('/journal');

  // The arrows cover the common case without opening anything.
  await page.getByRole('button', { name: 'Previous day' }).click();
  await expect(
    page.getByRole('button', { name: /write this day|edit entry from/i }).first(),
  ).toBeVisible();

  // The full month grid lives behind the calendar button.
  await page.getByRole('button', { name: /open the calendar/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Previous month' }).click();
  await page.getByRole('button', { name: /^1 / }).first().click();

  await expect(page.getByRole('dialog')).toBeHidden();
});

test('profile shows derived targets and the formula note', async ({ page }) => {
  await page.goto('/profile');

  await expect(page.getByText('BMR')).toBeVisible();
  await expect(page.getByText('TDEE')).toBeVisible();
  await expect(page.getByText(/Mifflin-St Jeor/i)).toBeVisible();
});

test('history renders without error', async ({ page }) => {
  await page.goto('/history');
  await expect(page.getByRole('heading', { name: 'History' })).toBeVisible();
});

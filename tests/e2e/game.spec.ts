import { test, expect } from '@playwright/test';

test('garage, racing, driving, pause, reset and free drive work without browser errors', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Drive your own line.' })).toBeVisible();
  await page.getByRole('button', { name: /BUILT FOR SPEED/ }).click();
  await expect(page.getByRole('button', { name: /BUILT FOR SPEED/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByLabel('Track', { exact: true }).selectOption('1');
  await expect(page.locator('#region')).toContainText('RED ROCK');
  await page.getByLabel('Graphics quality').selectOption('low');
  await page.screenshot({ path: 'artifacts/garage-desktop.png' });
  await page.getByRole('button', { name: /LET’S DRIVE/ }).click();
  await expect(page.locator('#hud')).toBeVisible();
  await expect(page.locator('#countdown')).toBeHidden({ timeout: 12000 });
  await page.keyboard.down('KeyW');
  await expect
    .poll(async () => Number(await page.locator('#speed').textContent()), { timeout: 10000 })
    .toBeGreaterThan(25);
  await page.keyboard.up('KeyW');
  await page.screenshot({ path: 'artifacts/racing-desktop.png' });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'On pause.' })).toBeVisible();
  // Let the HUD settle, then confirm the simulation clock remains frozen.
  await page.waitForTimeout(200);
  const pausedTime = await page.locator('#time').textContent();
  await page.waitForTimeout(500);
  await expect(page.locator('#time')).toHaveText(pausedTime!);
  await page.getByRole('button', { name: /KEEP DRIVING/ }).click();
  await expect(page.locator('#overlay')).toBeHidden();
  await page.keyboard.press('KeyR');
  await expect(page.locator('#toast')).toHaveText('Back on the road.');
  await page.keyboard.press('KeyC');
  await expect(page.locator('#toast')).toHaveText('Wide camera');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Back to garage' }).click();
  await page.getByRole('button', { name: 'Free drive', exact: true }).click();
  await expect(page.getByLabel('Race laps')).toBeDisabled();
  await page.getByRole('button', { name: /LET’S DRIVE/ }).click();
  await expect(page.locator('#lap')).toHaveText('∞');
  await expect(page.locator('#countdown')).toBeHidden();
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.getByRole('heading', { name: 'On pause.' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('phone layout fits and touch throttle releases cleanly', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByLabel('Graphics quality').selectOption('low');
  const start = page.getByRole('button', { name: /LET’S DRIVE/ });
  await expect(start).toBeInViewport();
  await page.screenshot({ path: 'artifacts/garage-mobile.png' });
  await page.getByRole('button', { name: 'Free drive', exact: true }).click();
  await start.click();
  const throttle = page.getByRole('button', { name: 'Accelerate', exact: true });
  await expect(throttle).toBeInViewport();
  const box = await throttle.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await expect
    .poll(async () => Number(await page.locator('#speed').textContent()), { timeout: 10000 })
    .toBeGreaterThan(20);
  await page.mouse.up();
  await expect(throttle).not.toHaveClass(/pressed/);
  await page.screenshot({ path: 'artifacts/racing-mobile.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

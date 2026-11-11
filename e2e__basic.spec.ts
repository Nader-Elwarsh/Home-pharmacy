import { expect, test } from '@playwright/test';

const PAGES = [
  { link: 'الخزانة', heading: 'الخزانة' },
  { link: 'الصحة', heading: 'الصحة' },
  { link: 'الأسرة', heading: 'الأسرة' },
  { link: 'المزيد', heading: 'المزيد' },
  { link: 'الرئيسية', heading: 'الرئيسية' },
];

test('الصفحة RTL وبالعربية', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.getByRole('heading', { level: 1, name: 'الرئيسية' })).toBeVisible();
});

test('التنقل بين الصفحات الخمس', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'التنقل الرئيسي' });
  for (const p of PAGES) {
    await nav.getByRole('link', { name: p.link }).click();
    await expect(page.getByRole('heading', { level: 1, name: p.heading })).toBeVisible();
  }
});

test('قاعدة البيانات المحلية تعمل في المتصفح', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('قاعدة البيانات المحلية تعمل')).toBeVisible();
});

test('يفتح دون اتصال بعد التحميل الأول', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  // نعيد التحميل مرة ليتحكم الـ Service Worker في الصفحة ويكتمل التخزين المؤقت
  await page.reload();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'الرئيسية' })).toBeVisible();
  await expect(page.getByText('قاعدة البيانات المحلية تعمل')).toBeVisible();
});

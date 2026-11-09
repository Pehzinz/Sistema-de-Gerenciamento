import { test, expect } from '@playwright/test';

test('rótulos acessíveis e mostrar senha preservam o valor sem enviar o formulário', async ({ page }) => {
  await page.goto('/');
  const cpf = page.getByRole('textbox', { name: 'CPF do Usuário', exact: true });
  await cpf.fill('12345678900');
  const password = page.getByLabel('Senha', { exact: true });
  await password.fill('uma senha de teste');
  let requests = 0;
  await page.route('**/api/login', route => { requests++; return route.fulfill({ status: 401, json: {} }); });
  await page.getByRole('button', { name: 'Mostrar senha', exact: true }).click();
  await expect(password).toHaveAttribute('type', 'text');
  await expect(password).toHaveValue('uma senha de teste');
  await page.getByRole('button', { name: 'Ocultar senha', exact: true }).click();
  await expect(password).toHaveAttribute('type', 'password');
  expect(requests).toBe(0);
});

test('login Mist aparece em desktop e celular sem cortar o formulário', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('.login-gradient canvas')).toBeVisible();
  await expect(page.locator('.login-card')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Entrar no Sistema' })).toHaveCSS('color', 'rgb(255, 255, 255)');
  await page.screenshot({ path: 'test-results/login-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/login-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test('login continua utilizável sem WebGL e com movimento reduzido', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return type === 'webgl2' ? null : original.call(this, type, ...args);
    };
  });
  await page.goto('/');
  await page.getByLabel('CPF do Usuário', { exact: true }).fill('123');
  await expect(page.getByRole('button', { name: 'Entrar no Sistema' })).toBeVisible();
  await expect(page.locator('.login-gradient')).toHaveCSS('background-image', /linear-gradient/);
});

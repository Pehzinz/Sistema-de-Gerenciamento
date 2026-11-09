import { test, expect } from '@playwright/test';

test.use({ reducedMotion: 'reduce' });

async function adminSession(page) {
  await page.addInitScript(() => {
    sessionStorage.setItem('token', 'test-token'); sessionStorage.setItem('perfil', 'ADMIN');
  });
  await page.route('**/api/**', route => route.fulfill({ json: new URL(route.request().url()).pathname.endsWith('/minha-empresa')
    ? { nome: 'Empresa teste', cnpj: '00.000.000/0001-00', email: '', telefone: '', endereco: '' } : [] }));
}

test('required fields and login errors use floating notices instead of native popups', async ({ page }) => {
  let logins = 0; let nativeDialogs = 0;
  page.on('dialog', dialog => { nativeDialogs++; void dialog.dismiss(); });
  await page.route('**/api/login', route => { logins++; return route.fulfill({ status: 503, json: {} }); });
  await page.goto('/');
  await page.getByRole('button', { name: 'Entrar no Sistema' }).click();
  await expect(page.locator('[data-notification-message]')).toContainText('Preencha este campo');
  expect(logins).toBe(0);
  await expect(page.getByLabel('CPF do Usuário', { exact: true })).toBeFocused();
  await page.getByLabel('CPF do Usuário', { exact: true }).fill('123');
  await page.getByLabel('Senha', { exact: true }).fill('senha de teste');
  await page.getByRole('button', { name: 'Entrar no Sistema' }).click();
  const notice = page.locator('.notification-card').filter({ hasText: 'HTTP 503' });
  await expect(notice).toBeVisible();
  const box = await notice.boundingBox();
  expect(box.x).toBeGreaterThan(page.viewportSize().width / 2);
  expect(box.y).toBeLessThan(250);
  await notice.getByRole('button', { name: 'Fechar notificação' }).click();
  await expect(notice).toHaveCount(0);
  expect(nativeDialogs).toBe(0);
});

test('a notification pauses while being read and dismisses after leaving it', async ({ page }) => {
  await page.clock.install();
  await page.route('**/api/login', route => route.fulfill({ status: 401, json: {} }));
  await page.goto('/');
  await page.getByLabel('CPF do Usuário', { exact: true }).fill('123');
  await page.getByLabel('Senha', { exact: true }).fill('senha de teste');
  await page.getByRole('button', { name: 'Entrar no Sistema' }).click();
  const notice = page.locator('.notification-card');
  await expect(notice).toBeVisible();
  await notice.hover();
  await page.clock.fastForward(10000);
  await expect(notice).toBeVisible();
  await page.mouse.move(0, 0);
  await page.clock.fastForward(8001);
  await expect(notice).toHaveCount(0);
});

test('centered form stays open and preserves fields while notices stay at the top right', async ({ page }) => {
  await page.clock.install();
  await adminSession(page);
  await page.route('**/api/categorias', route => route.fulfill(route.request().method() === 'POST'
    ? { status: 500, json: { erro: 'Não foi possível criar a categoria.' } } : { json: [] }));
  await page.goto('/cadastrar-produto');
  await page.getByRole('button', { name: '+ Nova Categoria' }).click();
  const panel = page.locator('.modal-overlay > div');
  await page.getByPlaceholder('Ex: Monitores').fill('Nova categoria');
  await page.getByRole('button', { name: 'Salvar Categoria' }).click();
  const notice = page.locator('.notification-card');
  await expect(notice).toContainText('Não foi possível criar a categoria');
  const centered = await panel.boundingBox();
  expect(Math.abs(centered.x + centered.width / 2 - page.viewportSize().width / 2)).toBeLessThanOrEqual(1);
  expect(Math.abs(centered.y + centered.height / 2 - page.viewportSize().height / 2)).toBeLessThanOrEqual(1);
  expect((await notice.boundingBox()).y).toBeLessThan(50);
  await page.screenshot({ path: 'test-results/centered-form-and-notice.png' });
  await page.mouse.move(0, 0);
  await page.clock.fastForward(10000);
  await expect(notice).toHaveCount(0);
  await expect(panel).toBeVisible();
  await expect(page.getByPlaceholder('Ex: Monitores')).toHaveValue('Nova categoria');
  await page.setViewportSize({ width: 320, height: 600 });
  const box = await panel.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(320);
  await page.screenshot({ path: 'test-results/floating-form-mobile.png' });
});

test('stock cleanup requires explicit confirmation and never auto-confirms', async ({ page }) => {
  await page.clock.install(); await adminSession(page);
  let cleared = 0;
  await page.route('**/api/empresas/limpar-estoque', route => { cleared++; return route.fulfill({ status: 204 }); });
  await page.goto('/configuracoes');
  await page.getByRole('button', { name: 'Limpar Estoque', exact: true }).click();
  const confirm = page.getByRole('alertdialog', { name: 'Confirmar ação' });
  await expect(confirm).toBeVisible();
  const box = await confirm.boundingBox();
  expect(Math.abs(box.x + box.width / 2 - page.viewportSize().width / 2)).toBeLessThanOrEqual(1);
  expect(Math.abs(box.y + box.height / 2 - page.viewportSize().height / 2)).toBeLessThanOrEqual(1);
  await page.clock.fastForward(60000);
  await expect(confirm).toBeVisible(); expect(cleared).toBe(0);
  await confirm.getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect(cleared).toBe(0);
  await page.getByRole('button', { name: 'Limpar Estoque', exact: true }).click();
  await confirm.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(page.locator('[data-notification-message]')).toContainText('limpo com sucesso');
  expect(cleared).toBe(1);
});

test('back navigation cancels a pending confirmation and does not resurrect it', async ({ page }) => {
  await adminSession(page);
  await page.goto('/admin');
  await page.getByRole('link', { name: 'Configurações', exact: true }).click();
  await page.getByRole('button', { name: 'Limpar Estoque', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.goBack(); await expect(page).toHaveURL(/\/admin$/);
  await page.goForward(); await expect(page).toHaveURL(/\/configuracoes$/);
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Limpar Estoque', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
});

import { test, expect } from '@playwright/test';

const cnpj = '00.000.000/0001-00';
const admin = { perfil: 'ADMIN', token: 'admin-authorization-only', cnpj };
async function seed(page, perfil = 'COLABORADOR') {
  await page.addInitScript(({ perfil, cnpj }) => {
    sessionStorage.setItem('token', 'collaborator-token');
    sessionStorage.setItem('perfil', perfil);
    sessionStorage.setItem('nome', 'Operador do totem');
    localStorage.setItem('cnpj', cnpj);
    localStorage.setItem('empresaNome', 'Empresa do totem');
    window.fullscreenRequests = 0;
    Element.prototype.requestFullscreen = () => { window.fullscreenRequests++; return Promise.resolve(); };
  }, { perfil, cnpj });
}
async function credentials(page) {
  await page.getByRole('button', { name: 'Saída do autoatendimento', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Autorização do Administrador' });
  await modal.getByLabel('ID do Administrador', { exact: true }).fill('12345678900');
  await modal.getByLabel('Senha do Administrador', { exact: true }).fill('senha do administrador');
  return modal;
}

test('collaborator gets a full-width PDV, discreet exit and no navigation', async ({ page }) => {
  await seed(page); await page.goto('/caixa');
  await expect(page.getByRole('navigation')).toHaveCount(0);
  const main = await page.locator('main').boundingBox();
  expect(main.x).toBe(0);
  expect(main.width).toBe(page.viewportSize().width);
  const exit = await page.getByRole('button', { name: 'Saída do autoatendimento' }).boundingBox();
  expect(exit.x).toBeLessThan(20);
  expect(exit.y + exit.height).toBeGreaterThan(page.viewportSize().height - 20);
  await page.screenshot({ path: 'test-results/kiosk-pdv.png' });
  // Fullscreen is requested once on a gesture, never toggled off by double click.
  await page.getByRole('heading', { name: 'Caixa Livre' }).dblclick();
  expect(await page.evaluate(() => window.fullscreenRequests)).toBe(1);
  await page.getByRole('heading', { name: 'Caixa Livre' }).dblclick();
  expect(await page.evaluate(() => window.fullscreenRequests)).toBe(1);
});

test('administrator keeps the navbar and normal PDV without fullscreen requests', async ({ page }) => {
  await seed(page, 'ADMIN'); await page.goto('/caixa');
  await expect(page.getByRole('navigation', { name: 'Menu principal' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Saída do autoatendimento' })).toHaveCount(0);
  await page.getByRole('heading', { name: 'Caixa Livre' }).dblclick();
  expect(await page.evaluate(() => window.fullscreenRequests)).toBe(0);
});

for (const [name, status, json] of [
  ['wrong password', 401, {}], ['server failure', 503, {}], ['rate limit', 429, {}],
  ['collaborator credentials', 200, { ...admin, perfil: 'COLABORADOR' }],
  ['another company', 200, { ...admin, cnpj: '99.999.999/0001-99' }],
  ['missing authorization token', 200, { ...admin, token: '' }],
]) test(`kiosk exit stays locked on ${name}`, async ({ page }) => {
  await seed(page);
  await page.route('**/api/login', route => route.fulfill({ status, json }));
  await page.goto('/caixa');
  const modal = await credentials(page);
  await modal.getByRole('button', { name: 'Autorizar Ação', exact: true }).click();
  await expect(modal.getByRole('alert')).toBeVisible();
  await expect(modal.getByLabel('Senha do Administrador', { exact: true })).toHaveValue('');
  expect(await page.evaluate(() => sessionStorage.getItem('token'))).toBe('collaborator-token');
  await expect(page).toHaveURL(/\/caixa$/);
});

test('admin of the terminal company authorizes exit without leaving an admin session', async ({ page }) => {
  await seed(page);
  await page.route('**/api/login', async route => {
    expect(route.request().postDataJSON()).toEqual({ cpf: '12345678900', senha: 'senha do administrador', cnpj });
    await route.fulfill({ json: admin });
  });
  await page.goto('/caixa');
  const modal = await credentials(page);
  await modal.getByRole('button', { name: 'Autorizar Ação', exact: true }).click();
  await expect(page).toHaveURL('http://127.0.0.1:5173/');
  expect(await page.evaluate(() => ['token', 'perfil', 'nome'].map(key => sessionStorage.getItem(key)))).toEqual([null, null, null]);
  expect(await page.evaluate(() => localStorage.getItem('cnpj'))).toBe(cnpj);
});

test('cancelling a pending authorization cannot log out after the response arrives', async ({ page }) => {
  await seed(page);
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  await page.route('**/api/login', async route => {
    await pending;
    await route.fulfill({ json: admin }).catch(() => {});
  });
  await page.goto('/caixa');
  const modal = await credentials(page);
  const request = page.waitForRequest('**/api/login');
  await modal.getByRole('button', { name: 'Autorizar Ação', exact: true }).click();
  await request;
  await modal.getByRole('button', { name: 'Cancelar', exact: true }).click();
  release();
  await expect(modal).toHaveCount(0);
  await expect(page).toHaveURL(/\/caixa$/);
  expect(await page.evaluate(() => sessionStorage.getItem('token'))).toBe('collaborator-token');
  await page.getByRole('button', { name: 'Saída do autoatendimento' }).click();
  await expect(page.getByLabel('ID do Administrador', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Senha do Administrador', { exact: true })).toHaveValue('');
});

test('a collaborator cannot return to login or admin screens through a URL', async ({ page }) => {
  await seed(page);
  for (const path of ['/', '/admin', '/configuracoes']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/caixa$/);
    await expect(page.getByRole('navigation')).toHaveCount(0);
  }
});

test('cart removal still requires admin authorization and preserves the collaborator session', async ({ page }) => {
  await seed(page);
  await page.route('**/api/produtos/catalogo/*', route => route.fulfill({ json: { id: '1234567890', nome: 'Produto do totem', preco: 10, estoque: 5 } }));
  await page.route('**/api/login', route => route.fulfill({ json: admin }));
  await page.goto('/caixa');
  await page.getByPlaceholder('Digite o código de barras (10 dígitos) - Ex: 1234567890').fill('1234567890');
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
  await page.getByRole('button', { name: /Remover/ }).click();
  const modal = page.getByRole('dialog', { name: 'Autorização do Administrador' });
  await modal.getByLabel('ID do Administrador', { exact: true }).fill('12345678900');
  await modal.getByLabel('Senha do Administrador', { exact: true }).fill('senha do administrador');
  await modal.getByRole('button', { name: 'Autorizar Ação', exact: true }).click();
  await expect(page.getByText('Produto do totem', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem('token'))).toBe('collaborator-token');
});

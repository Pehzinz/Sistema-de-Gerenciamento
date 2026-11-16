import { collectNotifications } from './helpers/notifications';
import { test, expect } from '@playwright/test';
test.use({ timezoneId: 'America/Sao_Paulo' });

async function sessao(page) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('testeInicializado')) return;
    sessionStorage.setItem('testeInicializado', 'sim');
    sessionStorage.setItem('token', 'test-token'); sessionStorage.setItem('perfil', 'ADMIN');
  });
  await page.route('**/api/**', route => {
    const caminho = new URL(route.request().url()).pathname;
    return route.fulfill({ json: caminho === '/api/empresas/minha-empresa' ? { id: 1, nome: 'Loja' } : [] });
  });
}

for (const status of [401, 403, 404, 500]) {
  test(`caixa preserva sessão válida ao consultar produto com HTTP ${status}`, async ({ page }) => {
    await sessao(page);
    await page.route('**/api/produtos/catalogo/*', route => route.fulfill({ status, body: '' }));
    const mensagens = await collectNotifications(page);
    await page.goto('/caixa');
    await page.getByPlaceholder('Digite o código de barras (10 dígitos) - Ex: 1234567890').fill('2121212121');
    await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
    await expect.poll(() => mensagens.length).toBe(1);
    await expect(page).toHaveURL(/caixa$/);
    expect(await page.evaluate(() => sessionStorage.getItem('token'))).toBe('test-token');
    if (status !== 404) expect(mensagens[0]).not.toContain('Produto não encontrado');
  });
}

test('caixa encerra sessão quando endpoint de sessão também rejeita o token', async ({ page }) => {
  await sessao(page);
  await page.route('**/api/produtos/catalogo/*', route => route.fulfill({ status: 401 }));
  await page.route('**/api/empresas/minha-empresa', route => route.fulfill({ status: 401 }));

  await page.goto('/caixa');
  await page.getByPlaceholder('Digite o código de barras (10 dígitos) - Ex: 1234567890').fill('2121212121');
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
  await expect(page).toHaveURL('http://127.0.0.1:5173/');
  expect(await page.evaluate(() => sessionStorage.getItem('token'))).toBeNull();
});

for (const disponivel of [0, 5]) {
  test(`caixa usa cota disponível ${disponivel} mesmo com estoque físico zero`, async ({ page }) => {
    await sessao(page);
    await page.route('**/api/produtos/catalogo/*', route => route.fulfill({ json: {
      id: '2121212121', nome: 'Torrada Integral', preco: 29.90, estoque: 0,
      tipoEstoque: 'COTA_TEMPO', limiteCota: 5, intervaloCotaMinutos: 3, quantidadeDisponivel: disponivel,
    } }));
    const mensagens = await collectNotifications(page);
    await page.goto('/caixa');
    await page.getByPlaceholder('Digite o código de barras (10 dígitos) - Ex: 1234567890').fill('2121212121');
    await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
    if (disponivel === 0) await expect.poll(() => mensagens.at(-1)).toContain('cota');
    else await expect(page.getByText('Torrada Integral', { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/caixa$/);
    expect(await page.evaluate(() => sessionStorage.getItem('token'))).toBe('test-token');
  });
}

test('calendário deriva validade do produto e remove o evento ao esgotar, vencer ou mudar o tipo', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-06T12:00:00-03:00') });
  await sessao(page);
  let produto = { id: '2222222222', nome: 'Cookies', estoque: 4, ativo: true, tipoEstoque: 'VALIDADE', validadeComercial: '2026-11-07T00:00:00-03:00' };
  await page.route('https://brasilapi.com.br/**', route => route.fulfill({ json: [] }));
  let consultas = 0;
  await page.route('**/api/produtos', route => { consultas++; return route.fulfill({ json: [produto] }); });
  await page.goto('/calendario');
  await expect(page.getByText('Validade: Cookies', { exact: true })).toHaveCount(1);
  await expect(page.getByText('⏳ 00:00 - Validade: Cookies', { exact: true })).toBeVisible();
  produto = { ...produto, estoque: 0 };
  await page.clock.runFor(30000);
  await expect.poll(() => consultas).toBeGreaterThanOrEqual(2);
  await expect(page.getByText(/Validade: Cookies/)).toHaveCount(0);
  produto = { ...produto, estoque: 4 };
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByText('Validade: Cookies', { exact: true })).toBeVisible();
  produto = { ...produto, tipoEstoque: 'PADRAO' };
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByText(/Validade: Cookies/)).toHaveCount(0);
  const prazoProximo = await page.evaluate(() => new Date(Date.now() + 5000).toISOString());
  produto = { ...produto, tipoEstoque: 'VALIDADE', validadeComercial: prazoProximo };
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByText(/Validade: Cookies/).first()).toBeVisible();
  await page.clock.runFor(6000);
  await expect(page.getByText(/Validade: Cookies/)).toHaveCount(0);
});

test.describe('vigência das promoções', () => {
  test.use({ timezoneId: 'UTC' });

  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: new Date('2026-11-07T02:59:00Z') });
    await sessao(page);
    const produto = { preco: 20, precoPromocional: 15, estoque: 10 };
    await page.route('**/api/produtos', route => route.fulfill({
      json: [
        { ...produto, id: '1000000001', nome: 'Café', dataInicioPromocao: '2026-11-06', dataFimPromocao: '2026-11-06' },
        { ...produto, id: '1000000002', nome: 'Chá', dataInicioPromocao: '2026-11-04', dataFimPromocao: '2026-11-05' },
        { ...produto, id: '1000000003', nome: 'Suco', dataInicioPromocao: '2026-11-07', dataFimPromocao: '2026-11-08' },
      ],
    }));
  });

  test('estoque troca os preços na virada do dia em São Paulo', async ({ page }) => {
    await page.goto('/admin');
    const precoDe = nome => page.getByRole('row').filter({ hasText: nome }).getByRole('cell').last();
    await expect(precoDe('Café').getByText('R$ 20,00', { exact: true })).toHaveCSS('text-decoration-line', 'line-through');
    await expect(precoDe('Café').getByText('R$ 15,00', { exact: true })).toBeVisible();
    await expect(precoDe('Chá')).toHaveText('R$ 20,00');
    await expect(precoDe('Suco')).toHaveText('R$ 20,00');

    await page.clock.fastForward(61000);
    await expect(precoDe('Café')).toHaveText('R$ 20,00');
    await expect(precoDe('Café').getByText('R$ 20,00', { exact: true })).toHaveCSS('text-decoration-line', 'none');
    await expect(precoDe('Suco').getByText('R$ 15,00', { exact: true })).toBeVisible();
  });

  test('calendário remove a oferta encerrada da grade, da agenda e das próximas atividades', async ({ page }) => {
    await page.route('https://brasilapi.com.br/**', route => route.fulfill({ json: [] }));
    await page.goto('/calendario');
    const ultimoDia = page.getByRole('button', { name: 'Selecionar dia 6/11/2026' });
    await ultimoDia.click();
    await expect(ultimoDia.getByText('🏷️ Promo: Café')).toBeVisible();
    await expect(page.getByText('Oferta: Café', { exact: true })).toBeVisible();
    await expect(page.getByText('Fim da Promo: Café', { exact: true })).toBeVisible();
    await expect(page.getByText('🏷️ Promo: Chá')).toHaveCount(0);
    const inicioFuturo = page.getByRole('button', { name: 'Selecionar dia 7/11/2026' });
    await expect(inicioFuturo.getByText('🏷️ Promo: Suco')).toBeVisible();

    await page.clock.fastForward(61000);
    await expect(ultimoDia.getByText('🏷️ Promo: Café')).toHaveCount(0);
    await expect(page.getByText('Oferta: Café', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Fim da Promo: Café', { exact: true })).toHaveCount(0);
    await expect(inicioFuturo.getByText('🏷️ Promo: Suco')).toBeVisible();
  });
});

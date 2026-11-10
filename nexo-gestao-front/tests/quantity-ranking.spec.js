import { test, expect } from '@playwright/test';

const names = ['Pão integral', 'Chocolate', 'Produto fora do catálogo', 'Café tradicional com nome muito longo para conferir a leitura no celular', 'Água mineral', 'Cesta premium'];
const quantities = [55, 20, 15, 8, 2, 1];
const ranking = {
  totalUnidades: 105, unidadesSemIdentificacao: 4, itensSemQuantidade: 0, vendasSemItens: 0,
  produtos: names.map((nome, i) => ({ produtoId: String(i + 1), nome, quantidade: quantities[i], participacaoPercentual: Math.round(quantities[i] / 105 * 10000) / 100 })),
};
async function prepare(page, getRanking = () => ranking) {
  await page.addInitScript(() => { sessionStorage.setItem('token', 'test-token'); sessionStorage.setItem('perfil', 'ADMIN'); });
  await page.route('https://brasilapi.com.br/**', route => route.fulfill({ json: [] }));
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    const json = path.endsWith('/curva-fluxo') ? { curva: [], fluxo: [], produtoAltaTendencia: 'Cesta premium', produtoParado: 'Água mineral', ...(getRanking() === undefined ? {} : { rankingQuantidade: getRanking() }) }
      : path.endsWith('/trafego') ? { grafico: [] }
      : path === '/api/produtos' ? [{ id: '1', nome: names[0], estoque: 0 }, { id: '2', nome: names[1], estoque: 0, quantidadeDisponivel: 7, tipoEstoque: 'COTA_TEMPO' }]
      : [];
    return route.fulfill({ json });
  });
}

test('calendar click and keyboard selection show the purple border even on white day cells', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-10T12:00:00-03:00') });
  await prepare(page); await page.goto('/calendario');
  const today = page.getByRole('button', { name: 'Selecionar dia 10/11/2026', exact: true });
  const future = page.getByRole('button', { name: 'Selecionar dia 12/11/2026', exact: true });
  await expect(today).toHaveAttribute('aria-pressed', 'true');
  await future.click();
  await expect(future).toHaveAttribute('aria-pressed', 'true');
  await expect(future).toHaveCSS('border-color', 'rgb(142, 68, 173)');
  await expect(today).toHaveAttribute('aria-pressed', 'false');
  const past = page.getByRole('button', { name: 'Selecionar dia 3/11/2026', exact: true });
  await past.focus(); await past.press('Enter');
  await expect(past).toHaveAttribute('aria-pressed', 'true');
  await expect(past).toHaveCSS('border-color', 'rgb(142, 68, 173)');
  await expect(past).toHaveCSS('opacity', '1');
  await expect(page.getByRole('heading', { name: '📅 Agenda para o dia 03/11/2026' })).toBeVisible();
  await page.screenshot({ path: 'test-results/calendar-selected-day.png' });
});

test('quantity ranking shows exact units, shares and availability without confusing revenue or quota', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await prepare(page); await page.goto('/tendencias');
  const panel = page.getByRole('region', { name: 'Mais vendidos em quantidade', exact: true });
  const rows = panel.getByRole('listitem');
  await expect(rows).toHaveCount(5);
  await expect(rows.nth(0)).toContainText('Pão integral');
  await expect(rows.nth(0)).toContainText('55 un.');
  await expect(rows.nth(0)).toContainText('52,38%');
  await expect(rows.nth(0)).toContainText('Disponível agora: 0 un.');
  await expect(rows.nth(1)).toContainText('Disponível agora: 7 un.');
  await expect(rows.nth(2)).toContainText('Fora do catálogo ativo');
  await expect(panel.getByRole('note')).toContainText('4 unidades');
  await expect(panel.locator('.quantity-ranking-total')).toHaveText('105');
  await panel.screenshot({ path: 'test-results/quantity-ranking-desktop.png' });
  await page.setViewportSize({ width: 320, height: 900 });
  await panel.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.querySelector('main').scrollWidth - document.querySelector('main').clientWidth)).toBeLessThanOrEqual(1);
  await panel.screenshot({ path: 'test-results/quantity-ranking-mobile.png' });
});

test('ranking refresh distinguishes an empty history from an API without quantities', async ({ page }) => {
  let data;
  await prepare(page, () => data); await page.goto('/tendencias');
  const panel = page.getByRole('region', { name: 'Mais vendidos em quantidade', exact: true });
  await expect(panel).toContainText('Atualize o backend');
  data = { produtos: [], totalUnidades: 0 };
  await page.getByRole('button', { name: 'Atualizar Análise Completa', exact: true }).click();
  await expect(panel).toContainText('Ainda não há produtos');
  data = ranking;
  await page.getByRole('button', { name: 'Atualizar Análise Completa', exact: true }).click();
  await expect(panel.getByRole('listitem')).toHaveCount(5);
});

test('agent offers the unit ranking as a quick query and a typed command without calling AI', async ({ page }) => {
  await prepare(page);
  let queries = 0; let ai = 0;
  await page.route('**/api/agente/consultas/mais-vendidos', route => { queries++; return route.fulfill({ json: { resposta: 'Pão integral — 55 unidades vendidas no histórico.' } }); });
  await page.route('**/api/agente/perguntar', route => { ai++; return route.fulfill({ json: { resposta: 'IA' } }); });
  await page.goto('/agente');
  await page.getByRole('button', { name: '🏆 Mais vendidos', exact: true }).click();
  await expect(page.getByText('Pão integral — 55 unidades vendidas no histórico.', { exact: true })).toBeVisible();
  await page.getByRole('textbox').fill('/MAIS-VENDIDOS');
  await page.getByRole('button', { name: 'Enviar', exact: true }).click();
  await expect(page.getByText('Pão integral — 55 unidades vendidas no histórico.', { exact: true })).toHaveCount(2);
  expect(queries).toBe(2); expect(ai).toBe(0);
});

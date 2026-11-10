import { test, expect } from '@playwright/test';
import { calcularVariacao, prepararProjecao } from '../src/utils/variacaoProjecao';

const names = ['Pão integral', 'Chocolate', 'Produto fora do catálogo', 'Café tradicional com nome muito longo para conferir a leitura no celular', 'Água mineral', 'Cesta premium'];
const quantities = [55, 20, 15, 8, 2, 1];
const ranking = {
  totalUnidades: 105, unidadesSemIdentificacao: 4, itensSemQuantidade: 0, vendasSemItens: 0,
  produtos: names.map((nome, i) => ({ produtoId: String(i + 1), nome, quantidade: quantities[i], participacaoPercentual: Math.round(quantities[i] / 105 * 10000) / 100 })),
};
async function prepare(page, getRanking = () => ranking, previsao = []) {
  await page.addInitScript(() => { sessionStorage.setItem('token', 'test-token'); sessionStorage.setItem('perfil', 'ADMIN'); });
  await page.route('https://brasilapi.com.br/**', route => route.fulfill({ json: [] }));
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    const json = path.endsWith('/curva-fluxo') ? { curva: [], fluxo: [], produtoAltaTendencia: 'Cesta premium', produtoParado: 'Água mineral', ...(getRanking() === undefined ? {} : { rankingQuantidade: getRanking() }) }
      : path.endsWith('/trafego') ? { grafico: [] }
      : path.endsWith('/previsao-vendas') ? previsao
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

test('ranking switches between the five highest and lowest quantities across the entire history', async ({ page }) => {
  await prepare(page); await page.goto('/tendencias');
  await page.getByRole('button', { name: 'Menos vendidos', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Menos vendidos em quantidade', exact: true });
  await expect(panel.getByRole('button', { name: 'Menos vendidos', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(panel.locator('.quantity-ranking-units')).toHaveText(['1 un.', '2 un.', '8 un.', '15 un.', '20 un.']);
  await expect(panel.getByRole('listitem').first()).toContainText('Cesta premium');
  await expect(panel.locator('.quantity-ranking-total')).toHaveText('105');
  const widths = await panel.locator('.quantity-ranking-track > span').evaluateAll(elements => elements.map(element => parseFloat(element.style.width)));
  expect(Math.max(...widths)).toBeLessThanOrEqual(100);
  await panel.screenshot({ path: 'test-results/quantity-ranking-lowest.png' });
  await page.setViewportSize({ width: 320, height: 900 });
  await panel.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.querySelector('main').scrollWidth - document.querySelector('main').clientWidth)).toBeLessThanOrEqual(1);
  await page.getByRole('button', { name: 'Mais vendidos', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Mais vendidos em quantidade', exact: true }).getByRole('listitem').first()).toContainText('Pão integral');
});

test('percentage variation handles zero, missing values and the actual-to-projected bridge', () => {
  expect(calcularVariacao(125, 100)).toBe(.25);
  expect(calcularVariacao(100, 125)).toBe(-.2);
  expect(calcularVariacao(0, 100)).toBe(-1);
  expect(calcularVariacao(0, 0)).toBe(0);
  expect(calcularVariacao(10, 0)).toBeNull();
  expect(calcularVariacao(null, 100)).toBeNull();
  const pontos = prepararProjecao([{ periodo: 'Semana 1', realizado: 100, previsto: null }, { periodo: 'Semana 2', realizado: 125, previsto: 125 }, { periodo: 'Semana 3', realizado: null, previsto: 150 }]);
  expect(pontos[0].variacaoRealizado).toBeNull();
  expect(pontos[1].variacaoRealizado).toBe(.25);
  expect(pontos[1].variacaoPrevisto).toBe(.25);
  expect(pontos[2].variacaoPrevisto).toBe(.2);
});

test('financial projection hover preserves currency values and adds signed percentage changes', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const previsao = [
    { periodo: 'Semana 1', realizado: 100, previsto: null },
    { periodo: 'Semana 2', realizado: 125, previsto: null },
    { periodo: 'Semana 3', realizado: 100, previsto: 100 },
    { periodo: 'Semana 4', realizado: null, previsto: 120 },
    { periodo: 'Semana 5', realizado: null, previsto: 0 },
    { periodo: 'Semana 6', realizado: null, previsto: 10 },
  ];
  await prepare(page, () => ranking, previsao); await page.goto('/tendencias');
  const chart = page.getByRole('heading', { name: 'Projeção Financeira (Regressão Linear)', exact: true }).locator('..');
  await chart.scrollIntoViewIfNeeded();
  const actual = chart.locator('circle.recharts-line-dot[name="Realizado"]');
  const projected = chart.locator('circle.recharts-line-dot[name="Projeção linear"]');
  const tooltip = page.locator('.projection-tooltip');
  const hoverPoint = async point => {
    await expect(point).toBeVisible();
    await point.scrollIntoViewIfNeeded();
    const box = await point.boundingBox();
    const cursor = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await page.mouse.move(cursor.x, cursor.y);
    await expect(tooltip).toBeVisible();
    const bounds = await tooltip.boundingBox();
    expect(cursor.x < bounds.x || cursor.x > bounds.x + bounds.width || cursor.y < bounds.y || cursor.y > bounds.y + bounds.height).toBe(true);
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(page.viewportSize().width);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(page.viewportSize().height);
  };
  await hoverPoint(actual.nth(0));
  await expect(tooltip).not.toContainText('%');
  await hoverPoint(actual.nth(1));
  await expect(tooltip).toContainText('Realizado');
  await expect(tooltip).toContainText('125,00');
  await expect(tooltip).toContainText('+25,00%');
  await expect(tooltip).not.toContainText('em relação');
  await hoverPoint(actual.nth(2));
  await expect(tooltip).toContainText('-20,00%');
  await expect(tooltip).toContainText('Projeção linear');
  await hoverPoint(projected.nth(1));
  await expect(tooltip).toContainText('120,00');
  await expect(tooltip).toContainText('+20,00%');
  await page.screenshot({ path: 'test-results/projection-percentage-tooltip.png' });
  await hoverPoint(projected.nth(2));
  await expect(tooltip).toContainText('0,00');
  await expect(tooltip).toContainText('-100,00%');
  await hoverPoint(projected.nth(3));
  await expect(tooltip).not.toContainText('%');
  await page.setViewportSize({ width: 320, height: 900 });
  await expect(async () => { await hoverPoint(actual.nth(1)); }).toPass({ timeout: 5000 });
  await expect(tooltip).toContainText('+25,00%');
  await page.mouse.move(0, 0);
  await expect(tooltip).toHaveCount(0);
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

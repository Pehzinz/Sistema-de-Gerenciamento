import { test, expect } from '@playwright/test';

const margens = {
  receitaComCusto: 100, custoProdutosVendidos: 120, margemBruta: -20,
  receitaSemCusto: 50, unidadesComCusto: 10, unidadesSemCusto: 5, produtosComMargemNegativa: 1,
  produtos: [{ nome: 'Produto vendido abaixo do custo', produtoId: '1234567890', receitaComCusto: 100,
    custoProdutosVendidos: 120, margemBruta: -20, unidadesComCusto: 10, unidadesSemCusto: 5 }],
};
const catalogo = {
  versao: 1, dataReferencia: '2026-11-09', produtosComCusto: 4, produtosSemCusto: 1, produtosAbaixoDoCusto: 1,
  medianaMargemPercentual: 35, primeiroQuartilPercentual: 10,
  produtos: [
    { produtoId: '1', nome: 'Produto abaixo do custo', precoVenda: 10, custoUnitario: 12, margemUnitaria: -2, margemPercentual: -20, unidadesVendidas: 0, faixa: 'ABAIXO_DO_CUSTO' },
    { produtoId: '2', nome: 'Produto sem vendas anteriores', precoVenda: 10, custoUnitario: 8, margemUnitaria: 2, margemPercentual: 20, unidadesVendidas: 0, faixa: 'MARGEM_POSITIVA' },
    { produtoId: '3', nome: 'Produto com maior volume histórico', precoVenda: 10, custoUnitario: 5, margemUnitaria: 5, margemPercentual: 50, unidadesVendidas: 100, faixa: 'MARGEM_POSITIVA' },
    { produtoId: '4', nome: 'Produto em promoção', precoVenda: 10, custoUnitario: 2, margemUnitaria: 8, margemPercentual: 80, unidadesVendidas: 20, faixa: 'MARGEM_POSITIVA', promocaoAtiva: true },
  ],
};
async function preparar(page, dados = margens) {
  await page.addInitScript(() => { sessionStorage.setItem('token', 'teste'); sessionStorage.setItem('perfil', 'ADMIN'); });
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    const json = path.endsWith('/curva-fluxo') ? {
      curva: [], fluxo: [{ mes: 'Sem 2/11/2026', receitas: 150 }], margens: dados,
      produtoAltaTendencia: 'Produto', produtoParado: 'Outro',
    } : path.endsWith('/margens-catalogo') ? catalogo : path.endsWith('/trafego') ? { grafico: [] }
      : path.endsWith('/vendas') ? [{ total: 150 }] : [];
    return route.fulfill({ json });
  });
}

test('inteligência mostra receita real, cobertura parcial e produtos com resultado negativo', async ({ page }, testInfo) => {
  await preparar(page); await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/tendencias');
  await expect(page.getByRole('heading', { name: 'Faturamento real por semana' })).toBeVisible();
  const secao = page.getByRole('region', { name: 'Margem bruta dos produtos' });
  await expect(secao).toContainText('Análise parcial');
  await expect(secao).toContainText('50,00');
  await expect(secao).toContainText('não representa o lucro líquido');
  await expect(secao).toContainText('1 produto(s) com resultado bruto negativo');
  await expect(secao.getByRole('row').nth(1)).toContainText('10 / 15 · parcial');
  await expect(secao.getByRole('row').nth(1)).toContainText('-R$');
  await expect(page.getByText(/Despesas Sim|Despesas estimadas em 60%|estimativa de despesas/)).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('inteligencia-desktop.png'), fullPage: true });
  await secao.screenshot({ path: testInfo.outputPath('margens-desktop.png') });
  await page.setViewportSize({ width: 320, height: 844 });
  await secao.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.querySelector('main').scrollWidth - document.querySelector('main').clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath('inteligencia-mobile.png'), fullPage: true });
});

test('catálogo mostra gráficos mesmo sem novas vendas e distingue margem atual do histórico', async ({ page }, testInfo) => {
  await preparar(page, { receitaComCusto: 0, custoProdutosVendidos: 0, margemBruta: null, receitaSemCusto: 0,
    unidadesComCusto: 0, unidadesSemCusto: 0, produtosComMargemNegativa: 0, produtos: [] });
  await page.route('**/api/vendas', route => route.fulfill({ json: [] }));
  await page.setViewportSize({ width: 1440, height: 1100 }); await page.goto('/tendencias');
  const secao = page.getByRole('region', { name: 'Margem atual do catálogo' });
  await expect(secao.getByRole('img', { name: 'Gráfico de margem atual por produto', exact: true })).toBeVisible();
  await expect(secao.getByRole('img', { name: /Dispersão do volume/ })).toBeVisible();
  await expect(secao).toContainText('4 produto(s) com custo · 1 sem custo');
  await expect(secao.getByRole('row').nth(1)).toContainText('Abaixo do custo');
  await expect(page.getByRole('region', { name: 'Margem bruta dos produtos' })).toContainText('Não há vendas com custo registrado');
  await secao.screenshot({ path: testInfo.outputPath('catalogo-desktop.png') });
  await secao.getByLabel('Comparar produtos por').selectOption('giro');
  await expect(secao.getByRole('row').nth(1)).toContainText('Produto com maior volume histórico');
  await page.setViewportSize({ width: 320, height: 844 });
  await secao.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.querySelector('main').scrollWidth - document.querySelector('main').clientWidth)).toBeLessThanOrEqual(1);
  await secao.screenshot({ path: testInfo.outputPath('catalogo-mobile.png') });
});

test('API antiga recebe diagnóstico claro em vez de gráfico de custos inventado', async ({ page }) => {
  await preparar(page);
  await page.route('**/api/tendencias/margens-catalogo', route => route.fulfill({ status: 404, json: {} }));
  await page.goto('/tendencias');
  const secao = page.getByRole('region', { name: 'Margem atual do catálogo' });
  await expect(secao.getByRole('alert')).toContainText('backend publicado');
  await expect(secao.getByRole('alert')).toContainText('custo_unitario');
  await expect(secao.getByRole('img')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Faturamento real por semana' })).toBeVisible();
});

test('histórico sem custos não é apresentado como lucro ou custo zero', async ({ page }) => {
  await preparar(page, { ...margens, receitaComCusto: 0, custoProdutosVendidos: 0, margemBruta: null,
    receitaSemCusto: 150, unidadesComCusto: 0, unidadesSemCusto: 15, produtosComMargemNegativa: 0, produtos: [] });
  await page.goto('/tendencias');
  const secao = page.getByRole('region', { name: 'Margem bruta dos produtos' });
  await expect(secao).toContainText('Não há vendas com custo registrado');
  await expect(secao.getByText('Não disponível', { exact: true })).toHaveCount(3);
});

test('falha de dados mostra erro em vez de indicadores zerados', async ({ page }) => {
  await preparar(page);
  await page.route('**/api/tendencias/curva-fluxo', route => route.fulfill({ status: 503, json: {} }));
  await page.goto('/tendencias');
  await expect(page.getByRole('alert')).toContainText('503');
  await expect(page.getByText('FATURAMENTO REAL (BRUTO)', { exact: true })).toHaveCount(0);
});

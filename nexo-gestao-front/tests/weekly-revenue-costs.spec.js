import { test, expect } from '@playwright/test';

async function preparar(page, fluxo) {
  await page.addInitScript(() => { sessionStorage.setItem('token', 'teste'); sessionStorage.setItem('perfil', 'ADMIN'); });
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    const json = path.endsWith('/curva-fluxo') ? { curva: [], fluxo, produtoAltaTendencia: 'Produto', produtoParado: 'Outro' }
      : path.endsWith('/trafego') ? { grafico: [] } : path.endsWith('/vendas') ? [{ total: 150 }] : [];
    return route.fulfill({ json });
  });
}

test('gráfico semanal tem receitas e custos reais e não exibe os painéis removidos', async ({ page }, testInfo) => {
  await preparar(page, [{ mes: 'Sem 2/11/2026', receitas: 100, custos: 40 }, { mes: 'Sem 9/11/2026', receitas: 50, custos: 25 }]);
  const requisicoes = []; page.on('request', req => requisicoes.push(req.url()));
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto('/tendencias');
  const grafico = page.getByRole('region', { name: 'Receitas e custos semanais' });
  await expect(grafico.locator('.recharts-area')).toHaveCount(2);
  await expect(grafico.getByText('Receitas', { exact: true })).toBeVisible();
  await expect(grafico.getByText('Custos dos produtos', { exact: true })).toBeVisible();
  await expect(grafico.getByRole('note')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /Margem|quartil|catálogo atual|Faturamento real por semana/i })).toHaveCount(0);
  expect(requisicoes.some(url => url.includes('margens-catalogo'))).toBe(false);
  await grafico.screenshot({ path: testInfo.outputPath('grafico-semanal.png') });
  await page.setViewportSize({ width: 320, height: 844 });
  await grafico.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.querySelector('main').scrollWidth - document.querySelector('main').clientWidth)).toBeLessThanOrEqual(1);
});

test('semana com custos ausentes tem aviso discreto e nenhuma estimativa fixa', async ({ page }) => {
  await preparar(page, [{ mes: 'Sem 2/11/2026', receitas: 100, custos: null, unidadesSemCusto: 2 }]);
  await page.goto('/tendencias');
  const grafico = page.getByRole('region', { name: 'Receitas e custos semanais' });
  await expect(grafico.getByRole('note')).toContainText('vendas sem custo registrado');
  await expect(page.getByText(/Despesas Sim|60%|estimativa de despesas/)).toHaveCount(0);
});

test('falha ao buscar dados não apresenta indicadores zerados', async ({ page }) => {
  await preparar(page, []);
  await page.route('**/api/tendencias/curva-fluxo', route => route.fulfill({ status: 503, json: {} }));
  await page.goto('/tendencias');
  await expect(page.getByRole('alert')).toContainText('503');
  await expect(page.getByText('FATURAMENTO REAL (BRUTO)', { exact: true })).toHaveCount(0);
});

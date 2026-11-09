import { test, expect } from '@playwright/test';

test('categorias de produtos removidos e nomes longos continuam identificados no gráfico e no PDF', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(() => {
    sessionStorage.setItem('token', 'teste'); sessionStorage.setItem('perfil', 'ADMIN');
  });
  const nomes = ['Doces', 'Salgados', 'Produtos de Limpeza e Higiene Pessoal', 'Bebidas', 'Frutas', 'Congelados e Alimentos Refrigerados', 'Açougue'];
  await page.route('**/api/**', route => route.fulfill({ json: new URL(route.request().url()).pathname === '/api/vendas'
    ? [{ id: 1, dataVenda: '2026-10-01T12:00:00', total: 70, formaPagamento: 'PIX',
      itens: nomes.map((nomeCategoria, i) => ({ produtoId: String(i), nomeProduto: `Produto ${i}`, nomeCategoria, quantidade: 1, precoUnitario: 10 })) }]
    : [] }));
  await page.goto('/dashboard');
  const rotulos = page.locator('.recharts-xAxis .recharts-cartesian-axis-tick');
  await expect(rotulos).toHaveCount(7);
  for (const nome of nomes) await expect(page.locator('svg title').filter({ hasText: nome })).toHaveCount(1);
  await expect(page.getByText('Sem Categoria', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('70,00');
  await page.screenshot({ path: testInfo.outputPath('categorias.png'), fullPage: true });
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /Baixar Relatório Contábil/ }).click();
  expect((await downloadPromise).suggestedFilename()).toBe('Relatorio_Contabil_Nexo.pdf');
});

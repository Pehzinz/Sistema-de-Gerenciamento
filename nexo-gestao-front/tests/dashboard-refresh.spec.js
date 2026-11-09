import { test, expect } from '@playwright/test';

test.use({ timezoneId: 'UTC' });

async function preparar(page) {
  // Depois da meia-noite UTC ainda é dia 8 em São Paulo.
  await page.clock.install({ time: new Date('2026-11-09T01:48:00Z') });
  await page.addInitScript(() => {
    sessionStorage.setItem('token', 'test-token');
    sessionStorage.setItem('perfil', 'ADMIN');
  });
  await page.route('**/api/**', route => route.fulfill({ json: [] }));
}

const venda = { id: 1, dataVenda: '2026-11-08T22:48:00', total: 10, formaPagamento: 'PIX',
  itens: [{ produtoId: '1234567890', nomeProduto: 'Produto', quantidade: 1, precoUnitario: 10 }] };

test('Dashboard inclui venda noturna e atualiza manualmente e ao voltar à aba', async ({ page }) => {
  await preparar(page);
  let vendas = [];
  await page.route('**/api/vendas', route => {
    return route.fulfill({ json: vendas });
  });
  await page.goto('/dashboard');
  await expect(page.getByRole('status')).toContainText('0 venda(s)');
  vendas = [venda];
  await page.getByRole('button', { name: 'Atualizar Dashboard', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('1 venda(s)');
  await expect(page.getByRole('status')).toContainText('10,00');
  await expect(page.getByRole('status')).toContainText('08/11/2026');
  vendas = [venda, { ...venda, id: 2, total: 20 }];
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('status')).toContainText('2 venda(s)');
  await expect(page.getByRole('status')).toContainText('30,00');
});

test('falha ao buscar vendas mostra erro e permite tentar novamente sem relatório zerado', async ({ page }) => {
  await preparar(page);
  let falhar = true;
  await page.route('**/api/vendas', route => falhar
    ? route.fulfill({ status: 503, body: '<html>indisponível</html>' })
    : route.fulfill({ json: [venda] }));
  await page.goto('/dashboard');
  await expect(page.getByRole('alert')).toContainText('HTTP 503');
  await expect(page.getByRole('button', { name: /Baixar Relatório/ })).toHaveCount(0);
  falhar = false;
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('1 venda(s)');
  await expect(page.getByRole('button', { name: /Baixar Relatório/ })).toBeVisible();
});

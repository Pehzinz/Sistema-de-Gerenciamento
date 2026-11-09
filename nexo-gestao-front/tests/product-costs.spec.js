import { collectNotifications } from './helpers/notifications';
import { test, expect } from '@playwright/test';

async function preparar(page, suporte = true) {
  await page.addInitScript(() => { sessionStorage.setItem('token', 'teste'); sessionStorage.setItem('perfil', 'ADMIN'); });
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({ json: path.endsWith('/recursos') ? { versaoCustosProdutos: suporte ? 1 : undefined }
      : path.endsWith('/categorias') ? [{ id: 1, nome: 'Teste' }] : [] });
  });

}

test('cadastro salva custo por unidade e alerta venda abaixo do custo', async ({ page }) => {
  await preparar(page);
  let enviado;
  await page.route('**/api/produtos', route => {
    enviado = route.request().postDataJSON(); return route.fulfill({ status: 201, json: enviado });
  });
  await page.goto('/cadastrar-produto');
  await page.getByPlaceholder('Ex: 7891020304').fill('1234567890');
  await page.getByPlaceholder('Ex: Mouse Gamer').fill('Produto');
  await page.getByPlaceholder('Ex: Razer').fill('Marca');
  await page.getByPlaceholder('R$ 0,00').fill('10');
  await page.getByLabel('Estoque Inicial').fill('5');
  await page.getByLabel(/Custo unitário/).fill('12,50');
  await expect(page.getByRole('status')).toContainText('abaixo do custo');
  await page.getByRole('button', { name: '+ Cadastrar produto', exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  expect(enviado.custoUnitario).toBe(12.5);
});

test('edição carrega custo e permite remover informação sem inventar custo zero', async ({ page }, testInfo) => {
  await preparar(page);
  let produto = { id: '1234567890', nome: 'Produto', preco: 10, custoUnitario: 12.5, estoque: 5, categoria: { id: 1 }, tipoEstoque: 'PADRAO' };
  let enviado;
  await page.route('**/api/produtos/1234567890', route => {
    if (route.request().method() === 'PUT') {
      enviado = route.request().postDataJSON(); produto = enviado;
    }
    return route.fulfill({ json: produto });
  });
  await page.route('**/api/produtos/1234567890/custo', route => {
    enviado = route.request().postDataJSON(); produto = { ...produto, ...enviado };
    expect(Object.keys(enviado)).toEqual(['custoUnitario']);
    return route.fulfill({ json: produto });
  });
  await page.goto('/cadastrar-produto');
  await page.getByRole('button', { name: /Editar ou Adicionar Estoque/ }).click();
  await page.getByPlaceholder('10 dígitos numéricos').fill(produto.id);
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page.getByLabel(/Custo unitário/)).toHaveValue('12.5');
  await page.getByLabel(/Custo unitário/).fill('0');
  await page.getByRole('button', { name: 'Salvar custo unitário' }).click();
  await expect.poll(() => enviado?.custoUnitario).toBe(0);
  await page.getByLabel(/Custo unitário/).fill('');
  await page.getByRole('button', { name: 'Salvar custo unitário' }).click();
  await expect.poll(() => enviado?.custoUnitario).toBeNull();
  await page.setViewportSize({ width: 320, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(321);
  await page.screenshot({ path: testInfo.outputPath('custo-edicao-mobile.png'), fullPage: true });
});

test('backend sem suporte não recebe custos nem exibe falso sucesso', async ({ page }) => {
  await preparar(page, false);
  let gravacoes = 0;
  await page.route('**/api/produtos', route => { gravacoes++; return route.fulfill({ status: 201, json: {} }); });
  const mensagens = await collectNotifications(page);
  await page.goto('/cadastrar-produto');
  await page.getByPlaceholder('Ex: 7891020304').fill('1234567890');
  await page.getByPlaceholder('Ex: Mouse Gamer').fill('Produto');
  await page.getByPlaceholder('Ex: Razer').fill('Marca');
  await page.getByPlaceholder('R$ 0,00').fill('10');
  await page.getByLabel('Estoque Inicial').fill('5');
  await page.getByLabel(/Custo unitário/).fill('5');
  await page.getByRole('button', { name: '+ Cadastrar produto', exact: true }).click();
  await expect.poll(() => mensagens.at(-1)).toContain('Atualize o back-end');
  expect(gravacoes).toBe(0);
  await expect(page.getByLabel(/Custo unitário/)).toHaveValue('5');
});

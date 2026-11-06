import { test, expect } from '@playwright/test';

async function preparar(page, produto = {}) {
  await page.addInitScript(() => {
    sessionStorage.setItem('token', 'test-token'); sessionStorage.setItem('perfil', 'ADMIN');
  });
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/produtos/recursos') return route.fulfill({ json: { versaoControleEstoque: 1 } });
    if (path === '/api/categorias') return route.fulfill({ json: [{ id: 1, nome: 'Categoria' }] });
    if (path.startsWith('/api/produtos/')) return route.fulfill({ json: produto });
    return route.fulfill({ json: [] });
  });
  page.on('dialog', dialog => dialog.dismiss());
}

test('cadastro alterna campos e envia cota sem estoque físico', async ({ page }) => {
  await preparar(page);
  let enviado;
  await page.route('**/api/produtos', route => {
    if (route.request().method() === 'POST') {
      enviado = route.request().postDataJSON(); return route.fulfill({ status: 201, json: enviado });
    }
    return route.fulfill({ json: [] });
  });
  await page.goto('/cadastrar-produto');
  await expect(page.getByLabel('Estoque Inicial')).toBeVisible();
  await page.getByLabel('Tipo de controle').selectOption('VALIDADE');
  await expect(page.getByLabel('Validade comercial')).toBeVisible();
  await page.getByLabel('Tipo de controle').selectOption('COTA_TEMPO');
  await expect(page.getByLabel('Estoque Inicial')).toHaveCount(0);
  await expect(page.getByLabel('Validade comercial')).toHaveCount(0);
  await page.getByPlaceholder('Ex: 7891020304').fill('1234567890');
  await page.getByPlaceholder('Ex: Mouse Gamer').fill('Ingresso');
  await page.getByPlaceholder('Ex: Razer').fill('Eventos');
  await page.getByPlaceholder('R$ 0,00').fill('10');
  await page.getByLabel('Limite de vendas').fill('50');
  await page.getByLabel('Renovar a cada').fill('60');
  await page.getByRole('button', { name: '+ Cadastrar produto', exact: true }).click();
  await expect.poll(() => enviado?.tipoEstoque).toBe('COTA_TEMPO');
  expect(enviado.estoque).toBe(0); expect(enviado.limiteCota).toBe(50);
  expect(enviado.intervaloCotaMinutos).toBe(60); expect(enviado.validadeComercial).toBeNull();
});

test('edição converte cota em estoque padrão e limpa as regras de tempo', async ({ page }) => {
  const produto = { id: '1234567890', nome: 'Ingresso', preco: 10, estoque: 0, tipoEstoque: 'COTA_TEMPO', limiteCota: 50, intervaloCotaMinutos: 60, quantidadeDisponivel: 20, categoria: { id: 1 } };
  await preparar(page, produto);
  let enviado;
  await page.route('**/api/produtos/1234567890', route => {
    if (route.request().method() === 'PUT') { enviado = route.request().postDataJSON(); return route.fulfill({ json: { mensagem: 'Salvo' } }); }
    return route.fulfill({ json: enviado || produto });
  });
  await page.goto('/cadastrar-produto');
  await page.getByRole('button', { name: /Editar ou Adicionar Estoque/ }).click();
  await page.getByPlaceholder('10 dígitos numéricos').fill(produto.id);
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page.getByText('Adicionar ao Estoque', { exact: true })).toHaveCount(0);
  await page.getByLabel('Tipo de controle').selectOption('PADRAO');
  await page.getByRole('button', { name: 'Salvar controle de estoque' }).click();
  expect(enviado).toBeUndefined();
  await page.getByLabel('Estoque físico').fill('25');
  await page.getByRole('button', { name: 'Salvar controle de estoque' }).click();
  await expect.poll(() => enviado?.tipoEstoque).toBe('PADRAO');
  expect(enviado.estoque).toBe(25); expect(enviado.limiteCota).toBeNull();
  expect(enviado.intervaloCotaMinutos).toBeNull(); expect(enviado.validadeComercial).toBeNull();
  await expect(page.getByText('Adicionar ao Estoque', { exact: true })).toBeVisible();
});

test('formulário de cota e validade cabe em tela de celular', async ({ page }) => {
  await preparar(page); await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/cadastrar-produto');
  for (const tipo of ['COTA_TEMPO', 'VALIDADE']) {
    await page.getByLabel('Tipo de controle').selectOption(tipo);
    const largura = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(largura).toBeLessThanOrEqual(321);
  }
});


test('API antiga não recebe cadastro de cota nem produz falso sucesso', async ({ page }) => {
  await preparar(page);
  let gravacoes = 0;
  await page.route('**/api/produtos/recursos', route => route.fulfill({ status: 404, json: {} }));
  await page.route('**/api/produtos', route => {
    if (route.request().method() === 'POST') gravacoes++;
    return route.fulfill({ json: [] });
  });
  const mensagens = [];
  page.on('dialog', dialog => mensagens.push(dialog.message()));
  await page.goto('/cadastrar-produto');
  await page.getByPlaceholder('Ex: 7891020304').fill('2121212121');
  await page.getByPlaceholder('Ex: Mouse Gamer').fill('Torrada');
  await page.getByPlaceholder('Ex: Razer').fill('Bauducco');
  await page.getByPlaceholder('R$ 0,00').fill('29,90');
  await page.getByLabel('Tipo de controle').selectOption('COTA_TEMPO');
  await page.getByLabel('Limite de vendas').fill('5');
  await page.getByLabel('Renovar a cada').fill('3');
  await page.getByRole('button', { name: '+ Cadastrar produto', exact: true }).click();
  await expect.poll(() => mensagens.at(-1)).toContain('Atualize o back-end');
  expect(gravacoes).toBe(0); await expect(page).toHaveURL(/cadastrar-produto$/);
  await expect(page.getByLabel('Limite de vendas')).toHaveValue('5');
});

test('edição não confirma sucesso quando o servidor ignora o controle enviado', async ({ page }) => {
  const legado = { id: '2121212121', nome: 'Torrada', preco: 29.90, estoque: 0, categoria: { id: 1 } };
  await preparar(page, legado);
  let gravacoes = 0;
  await page.route('**/api/produtos/2121212121', route => {
    if (route.request().method() === 'PUT') { gravacoes++; return route.fulfill({ json: { mensagem: 'Salvo' } }); }
    return route.fulfill({ json: legado });
  });
  const mensagens = [];
  page.on('dialog', dialog => mensagens.push(dialog.message()));
  await page.goto('/cadastrar-produto');
  await page.getByRole('button', { name: /Editar ou Adicionar Estoque/ }).click();
  await page.getByPlaceholder('10 dígitos numéricos').fill(legado.id);
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await page.getByLabel('Tipo de controle').selectOption('COTA_TEMPO');
  await page.getByLabel('Limite de vendas').fill('5'); await page.getByLabel('Renovar a cada').fill('3');
  await page.getByRole('button', { name: 'Salvar controle de estoque' }).click();
  await expect.poll(() => mensagens.at(-1)).toContain('não confirmou a gravação');
  expect(gravacoes).toBe(1);
  expect(mensagens.some(mensagem => mensagem === 'Controle de estoque atualizado!')).toBe(false);
  await expect(page.getByLabel('Tipo de controle')).toHaveValue('COTA_TEMPO');
});

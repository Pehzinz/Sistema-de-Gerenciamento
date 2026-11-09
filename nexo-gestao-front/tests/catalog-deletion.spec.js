import { collectNotifications } from './helpers/notifications';
import { test, expect } from '@playwright/test';

async function preparar(page) {
  await page.addInitScript(() => {
    sessionStorage.setItem('token', 'test-token');
    sessionStorage.setItem('perfil', 'ADMIN');
  });
  await page.route('**/api/**', route => route.fulfill({ json: [] }));
}

test('tipos de estoque combinam com marca e categoria e podem ser limpos', async ({ page }) => {
  await preparar(page);
  const produtos = [
    { id: '1111111111', nome: 'Legado', marca: 'A', preco: 10, estoque: 5, categoria: { id: 1, nome: 'Real' } },
    { id: '2222222222', nome: 'Ingresso', marca: 'A', preco: 10, estoque: 0, tipoEstoque: 'COTA_TEMPO', categoria: { id: 1, nome: 'Real' } },
    { id: '3333333333', nome: 'Perecível', marca: 'B', preco: 10, estoque: 5, tipoEstoque: 'VALIDADE', categoria: { id: 2, nome: 'Outra' } },
    { id: '4444444444', nome: 'Divergente', marca: 'B', preco: 10, estoque: 5, categoria: { id: 99, nome: 'Fantasma' } },
  ];
  await page.route('**/api/produtos', route => route.fulfill({ json: produtos }));
  await page.route('**/api/categorias', route => route.fulfill({ json: [{ id: 1, nome: 'Real' }, { id: 2, nome: 'Outra' }] }));
  await page.goto('/admin');
  await expect(page.getByText('Exibindo 4 de 4 produtos')).toBeVisible();
  await expect(page.getByLabel('Filtrar por categoria').getByRole('option', { name: 'Fantasma' })).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('categorias ausentes');
  for (const [tipo, nome] of [['PADRAO', 'Legado'], ['COTA_TEMPO', 'Ingresso'], ['VALIDADE', 'Perecível']]) {
    await page.getByLabel('Tipo de Estoque', { exact: true }).selectOption(tipo);
    await expect(page.locator('tbody')).toContainText(nome);
    await expect(page.locator('tbody')).not.toContainText(tipo === 'COTA_TEMPO' ? 'Legado' : 'Ingresso');
  }
  await page.getByLabel('Filtrar por marca').selectOption('A');
  await expect(page.locator('tbody')).toContainText('Nenhum produto encontrado');
  await page.getByLabel('Tipo de Estoque', { exact: true }).selectOption('COTA_TEMPO');
  await page.getByLabel('Filtrar por categoria').selectOption('1');
  await expect(page.getByText('Exibindo 1 de 4 produtos')).toBeVisible();
  await page.getByRole('button', { name: /Limpar Filtros/ }).click();
  await expect(page.getByText('Exibindo 4 de 4 produtos')).toBeVisible();
});

test('exclusão usa ID real e recarrega categorias após sucesso', async ({ page }) => {
  await preparar(page);
  let categorias = [{ id: 42, nome: 'Categoria com estoque' }];
  let excluido;
  await page.route('**/api/categorias', route => route.fulfill({ json: categorias }));
  await page.route('**/api/categorias/42', route => {
    excluido = route.request().method(); categorias = [];
    return route.fulfill({ status: 204 });
  });
  const mensagens = await collectNotifications(page);
  await page.goto('/excluir-produto');
  await page.getByLabel('Categoria cadastrada').selectOption('42');
  await page.getByPlaceholder('Digite "Delete"').nth(1).fill('Delete');
  await page.getByRole('button', { name: 'DELETAR CATEGORIA' }).click();
  await expect.poll(() => excluido).toBe('DELETE');
  await expect(page.getByText('Nenhuma categoria ativa cadastrada.')).toBeVisible();
  expect(mensagens).toContain('Categoria excluída com sucesso do sistema!');
});

test('categoria removida em outra sessão atualiza a lista sem falso sucesso', async ({ page }) => {
  await preparar(page);
  let categorias = [{ id: 42, nome: 'Removida' }];
  await page.route('**/api/categorias', route => route.fulfill({ json: categorias }));
  await page.route('**/api/categorias/42', route => {
    categorias = [];
    return route.fulfill({ status: 404, json: { erro: 'Categoria não encontrada.' } });
  });
  const mensagens = await collectNotifications(page);
  await page.goto('/excluir-produto');
  await page.getByLabel('Categoria cadastrada').selectOption('42');
  await page.getByPlaceholder('Digite "Delete"').nth(1).fill('Delete');
  await page.getByRole('button', { name: 'DELETAR CATEGORIA' }).click();
  await expect(page.getByText('Nenhuma categoria ativa cadastrada.')).toBeVisible();
  expect(mensagens).toEqual(['Categoria não encontrada.']);
});

test('erro sem JSON ao excluir produto mantém formulário e informa HTTP', async ({ page }) => {
  await preparar(page);
  await page.route('**/api/produtos/1234567890', route => route.fulfill({ status: 503, body: '<html>indisponível</html>' }));
  const mensagens = await collectNotifications(page);
  await page.goto('/excluir-produto');
  await page.getByPlaceholder('Apenas números').fill('1234567890');
  await page.getByPlaceholder('Digite "Delete"').first().fill('Delete');
  await page.getByRole('button', { name: 'DELETAR PRODUTO' }).click();
  await expect.poll(() => mensagens.at(-1)).toContain('HTTP 503');
  await expect(page.getByPlaceholder('Apenas números')).toHaveValue('1234567890');
});

for (const persistir of [true, false]) {
  test(`cadastro de categoria confere persistência: ${persistir}`, async ({ page }) => {
    await preparar(page);
    let categorias = [];
    await page.route('**/api/categorias', route => {
      if (route.request().method() === 'POST') {
        const salva = { id: 42, nome: 'Nova' };
        if (persistir) categorias = [salva];
        return route.fulfill({ status: 201, json: salva });
      }
      return route.fulfill({ json: categorias });
    });
    const mensagens = await collectNotifications(page);
    await page.goto('/cadastrar-produto');
    await page.getByRole('button', { name: '+ Nova Categoria' }).click();
    await page.getByPlaceholder('Ex: Monitores').fill('Nova');
    await page.getByRole('button', { name: 'Salvar Categoria' }).click();
    await expect.poll(() => mensagens.at(-1)).toContain(persistir ? 'Categoria criada com sucesso' : 'não confirmou a categoria');
    if (!persistir) expect(mensagens).not.toContain('Categoria criada com sucesso!');
  });
}

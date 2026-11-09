import { test, expect } from '@playwright/test';

const cota = { id: '2121212121', nome: 'Ingresso', marca: 'Nexo', preco: 10, estoque: 0,
  categoria: { id: 1, nome: 'Ingressos' }, tipoEstoque: 'COTA_TEMPO', limiteCota: 5,
  intervaloCotaMinutos: 1, inicioJanelaCota: '2026-11-06T15:00:00Z', quantidadeDisponivel: 0 };
async function preparar(page) {
  await page.clock.install({ time: new Date('2026-11-06T15:00:50Z') });
  await page.addInitScript(() => { sessionStorage.setItem('token', 'test-token'); sessionStorage.setItem('perfil', 'ADMIN'); });
  await page.route('**/api/**', route => route.fulfill({ json: [] }));

}

test('estoque consulta a cota na virada e em novas janelas sem recarregar a página', async ({ page }) => {
  await preparar(page);
  let saldo = 0; let consultas = 0; let navegacoes = 0;
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) navegacoes++; });
  await page.route('**/api/produtos', route => { consultas++; return route.fulfill({ json: [{ ...cota, quantidadeDisponivel: saldo }] }); });
  await page.goto('/admin');
  await expect(page.getByText('Cota: 0/5 a cada 1 min', { exact: true })).toBeVisible();
  const navegacoesIniciais = navegacoes;
  saldo = 5;
  await page.clock.runFor(11000);
  await expect(page.getByText('Cota: 5/5 a cada 1 min', { exact: true })).toBeVisible();
  // Outra venda fica visível pela sincronização periódica.
  saldo = 2;
  await page.clock.runFor(30000);
  await expect(page.getByText('Cota: 2/5 a cada 1 min', { exact: true })).toBeVisible();
  saldo = 5;
  await page.clock.runFor(30000);
  await expect(page.getByText('Cota: 5/5 a cada 1 min', { exact: true })).toBeVisible();
  expect(consultas).toBeGreaterThanOrEqual(4); expect(navegacoes).toBe(navegacoesIniciais);
});

test('edição atualiza o saldo da cota e preserva alterações ainda não salvas', async ({ page }) => {
  await preparar(page); let saldo = 0;
  await page.route('**/api/produtos/2121212121', route => route.fulfill({ json: { ...cota, quantidadeDisponivel: saldo } }));
  await page.goto('/cadastrar-produto');
  await page.getByRole('button', { name: /Editar ou Adicionar Estoque/ }).click();
  await page.getByPlaceholder('10 dígitos numéricos').fill(cota.id);
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page.getByText(/Cota: 0\/5/)).toBeVisible();
  await page.getByLabel('Limite de vendas').fill('8');
  saldo = 5; await page.clock.runFor(11000);
  await expect(page.getByText(/Cota: 5\/5/)).toBeVisible();
  await expect(page.getByLabel('Limite de vendas')).toHaveValue('8');
});

test('retornar à aba sincroniza a cota e sair da tela encerra as consultas', async ({ page }) => {
  await preparar(page); let saldo = 0; let consultas = 0;
  await page.route('**/api/produtos', route => { consultas++; return route.fulfill({ json: [{ ...cota, quantidadeDisponivel: saldo }] }); });
  await page.goto('/admin');
  await expect(page.getByText(/Cota: 0\/5/)).toBeVisible();
  saldo = 4; await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByText(/Cota: 4\/5/)).toBeVisible();
  await page.getByRole('link', { name: 'Cadastrar produto', exact: true }).click();
  await expect(page).toHaveURL(/cadastrar-produto$/);
  // A rota é carregada sob demanda: a URL muda antes de a tela anterior desmontar.
  await expect(page.getByRole('heading', { name: 'Gestão de Estoque e Produtos' })).toBeVisible();
  const antes = consultas; await page.clock.runFor(65000);
  expect(consultas).toBe(antes);
});

test('caixa consulta a cota renovada ao aumentar a quantidade do carrinho', async ({ page }) => {
  await preparar(page); let saldo = 1;
  await page.route('**/api/produtos/catalogo/2121212121', route => route.fulfill({ json: { ...cota, quantidadeDisponivel: saldo } }));
  await page.goto('/caixa');
  await page.getByPlaceholder('Digite o código de barras (10 dígitos) - Ex: 1234567890').fill(cota.id);
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
  await expect(page.getByText('Ingresso', { exact: true })).toBeVisible();
  saldo = 5;
  await page.getByRole('button', { name: '+', exact: true }).click();
  await expect(page.getByText('R$ 20,00', { exact: true }).first()).toBeVisible();
});
